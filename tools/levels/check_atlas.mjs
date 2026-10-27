#!/usr/bin/env node
// Standard-library syntax and simulated-DOM checks. Does NOT launch a browser.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const url = new URL('../../docs/levels/atlas.html', import.meta.url);
const html = fs.readFileSync(url, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 1);
assert.ok(!html.includes('/*__BANK__*/'));
const source = scripts[0][1];
new vm.Script(source, { filename: 'atlas-inline.js' });
const checks = ['embedded-script-syntax', 'bank-placeholder-replaced'];

function harness(hash = '') {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, {
      id, innerHTML: '', textContent: '', open: false, dataset: {}, attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      showModal() { this.open = true; },
      close() { this.open = false; },
      scrollIntoView() { this.scrolled = true; },
    });
    return elements.get(id);
  };
  const chapterButtons = Array.from({ length: 6 }, (_, i) => {
    const button = element(`chapter-button-${i}`); button.dataset.ch = String(i); return button;
  });
  const document = {
    getElementById: element,
    querySelectorAll(selector) {
      if (selector === '[data-ch]') return chapterButtons;
      const attribute = selector === '[data-detail]' ? 'detail' : selector === '[data-jump]' ? 'jump' : null;
      if (!attribute) return [];
      const all = (attribute === 'jump' ? html.slice(0, html.indexOf('<main>')) : '') + element('chapters').innerHTML;
      return [...all.matchAll(new RegExp(`data-${attribute}="(L[0-9]{3})"`, 'g'))].map((m, i) => {
        const button = element(`${attribute}-${m[1]}-${i}`); button.dataset[attribute] = m[1]; return button;
      });
    },
  };
  const context = vm.createContext({ document, location: { hash } });
  vm.runInContext(source, context);
  return { element, context, chapterButtons, document };
}
const h = harness();
const cardCount = () => (h.element('chapters').innerHTML.match(/class="card"/g) || []).length;
assert.equal(cardCount(), 100);
assert.ok(h.element('stats').textContent.includes('上方空槽＋下方候选'));
assert.equal((h.element('chapters').innerHTML.match(/class="pool-label"/g) || []).length >= 100, true);
assert.ok(h.element('chapters').innerHTML.includes('stroke-dasharray="3 3"'));
assert.ok(h.element('summary-table').innerHTML.includes('30–36'));
assert.equal((h.element('curve').innerHTML.match(/<rect /g) || []).length, 100);
assert.ok(html.includes('palette-overview.html'));
assert.equal((h.element('chapters').innerHTML.match(/class="palette-strip"/g) || []).length, 100);
assert.equal((h.element('chapters').innerHTML.match(/class="nature"/g) || []).length, 100);
assert.ok(h.element('chapters').innerHTML.includes('平均 C'));
checks.push('100-initial-empty-rail-candidate-cards-and-staircase', '100-natural-themes-actual-corner-strips-and-metrics');
h.chapterButtons[4].onclick();
assert.equal(cardCount(), 20);
assert.ok(h.element('chapters').innerHTML.includes('L072'));
checks.push('chapter-filter-20-cards');
h.element('mode').onchange({ target: { value: 'initial' } });
h.element('hex').onchange({ target: { checked: true } });
assert.equal(cardCount(), 20);
assert.ok(h.element('chapters').innerHTML.includes('初始盘面'));
assert.ok(/#[0-9A-F]{6}<\/text>/.test(h.element('chapters').innerHTML));
checks.push('initial-anchors-empty-slots-and-hex');
h.chapterButtons[0].onclick();
assert.ok(h.element('chapters').innerHTML.includes('下方候选区'));
checks.push('candidate-pool-all-levels');
vm.runInContext("focusLevel('L072')", h.context);
assert.equal(cardCount(), 1);
assert.ok(h.element('chapters').innerHTML.includes('28格 / 23候选'));
assert.ok(h.element('chapters').innerHTML.includes('26共享格 / 22分叉 / 4四向'));
assert.ok(h.element('L072').scrolled);
vm.runInContext("focusLevel('L078')", h.context);
assert.equal(cardCount(), 1);
assert.ok(h.element('chapters').innerHTML.includes('30格 / 25候选'));
vm.runInContext("focusLevel('L100');detail('L100')", h.context);
assert.equal(cardCount(), 1);
assert.ok(h.element('chapters').innerHTML.includes('36格 / 32候选'));
assert.ok(h.element('chapters').innerHTML.includes('36共享格 / 32分叉 / 16四向'));
assert.ok(h.element('detail').open);
assert.ok(h.element('detail-content').innerHTML.includes('N次点击放置证解'));
assert.equal((h.element('detail-content').innerHTML.match(/<tr>/g) || []).length, 37);
assert.equal((h.element('detail-content').innerHTML.match(/<svg /g) || []).length, 2);
checks.push('L072-L078-L100-focus-and-full-detail', 'shared-branch-four-way-labels');
h.element('close').onclick();
assert.ok(!h.element('detail').open);
checks.push('detail-close');
vm.runInContext("poolPages.L100=1;render()", h.context);
assert.ok(h.element('chapters').innerHTML.includes('data-home="18"'));
assert.ok(h.element('chapters').innerHTML.includes('data-home="31"'));
assert.ok(!h.element('chapters').innerHTML.includes('data-home="0"'));
checks.push('candidate-page-two-keeps-fixed-home-indices');
h.element('mode').onchange({ target: { value: 'solved' } });
assert.ok(!h.element('chapters').innerHTML.includes('class="pool-tile"'));
assert.ok(h.element('stats').textContent.includes('目标盘面'));
checks.push('author-answer-toggle-hides-tray');

const deep = harness('#L078');
assert.equal((deep.element('chapters').innerHTML.match(/class="card"/g) || []).length, 1);
assert.ok(deep.element('chapters').innerHTML.includes('id="L078"'));
checks.push('direct-hash-link');
const overview = fs.readFileSync(new URL('../../docs/levels/palette-overview.html', import.meta.url), 'utf8');
assert.equal((overview.match(/class="item"/g) || []).length, 100);
assert.equal((overview.match(/<section class="chapter"/g) || []).length, 5);
assert.equal((overview.match(/<svg /g) || []).length, 100);
assert.equal((overview.match(/href="atlas.html#L[0-9]{3}"/g) || []).length, 100);
const data = JSON.parse(fs.readFileSync(new URL('../../data/levels/levels.v0.4.json', import.meta.url), 'utf8'));
for (const level of data.levels) {
  assert.ok(overview.includes(`id="${level.id}"`));
  for (const cell of level.cells) assert.ok(overview.includes(`fill="${cell.targetHex}"`));
}
assert.ok(!/<(?:script|iframe|img|link)\b/.test(overview));
checks.push('100-level-5-chapter-standalone-colour-overview', 'overview-exact-exported-hex-and-atlas-links', 'overview-no-external-media-or-code');
assert.equal(data.schemaVersion, '3.0.0');
assert.equal(data.gameplayMode, 'click-fill');
for(const l of data.levels){
  assert.equal(l.inputMode,'tap');
  assert.equal(l.initialPool.length,l.challenge.minimumMoves);
  for(const c of l.cells) assert.equal(l.initialBoard[c.id],l.anchors.includes(c.id)?c.targetTileId:null);
}
checks.push('schema-three-click-fill-tap-all-levels');
const report = { contentVersion: data.contentVersion, status: 'pass', checks, browserLaunched: false, visualInspection: 'not-run',
  scope: 'JavaScript syntax and simulated DOM smoke only; no CSS layout, rendering, touch or real browser certification' };
fs.writeFileSync(new URL('../../docs/levels/atlas-static-check.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
