import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.env.SHISE_PLATFORM_BUILD, 'entry.js'));
const { BrowserTestBridge } = require('./platform/BrowserTestBridge.js');
const { sys } = require('cc');

test('mini-game document shim must never be used by browser tester controls', () => {
  sys.isBrowser = false;
  // The real Cocos Douyin adapter exposes document, but not replaceChildren.
  let accesses = 0;
  globalThis.document = new Proxy({}, { get() { accesses++; throw new Error('Mini-game DOM accessed'); } });
  try {
    const bridge = new BrowserTestBridge(true, () => ({}));
    bridge.text('正在拾色');
    bridge.control('候选色', () => {}, { x: 0, y: 0, width: 44, height: 44 });
    bridge.clear();
    bridge.modal();
    assert.equal(accesses, 0);
  } finally { delete globalThis.document; }
});

test('browser tester controls still clear and create visible action targets', () => {
  sys.isBrowser = true;
  const nodes = [];
  const element = () => ({ style: {}, children: [], setAttribute() {}, addEventListener() {},
    appendChild(child) { this.children.push(child); }, replaceChildren() { this.children = []; } });
  globalThis.document = { body: element(), head: element(),
    createElement() { const node = element(); nodes.push(node); return node; },
    getElementById() { return { getBoundingClientRect: () => ({ x: 0, y: 0, width: 390, height: 844 }) }; } };
  try {
    const bridge = new BrowserTestBridge(true, () => ({}));
    bridge.control('候选色', () => {}, { x: 22, y: 22, width: 44, height: 44 });
    assert.equal(nodes[0].children.length, 1);
    bridge.clear();
    assert.equal(nodes[0].children.length, 0);
  } finally { delete globalThis.document; sys.isBrowser = false; }
});
