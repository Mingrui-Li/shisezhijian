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

test('read-only diagnostic snapshots are detached deep copies and cannot mutate the live wallet or attempt', () => {
  sys.isBrowser = false;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__SHISE_STATE__');
  const live = {
    wallet: { points: 240, inventory: { locate: 2, peek: 1, addTime: 3 },
      levelScores: { L001: { bestScore: 180, doubleScoreClaimed: false } } },
    attempt: { board: { c1: 't1' }, pool: [null, 't2'], remainingTimeMs: 45000 },
  };
  try {
    new BrowserTestBridge(false, () => live);
    const first = globalThis.__SHISE_STATE__;
    assert.deepEqual(first, live);
    assert.notStrictEqual(first, live);
    assert.notStrictEqual(first.wallet, live.wallet);
    assert.notStrictEqual(first.wallet.inventory, live.wallet.inventory);
    assert.notStrictEqual(first.wallet.levelScores.L001, live.wallet.levelScores.L001);
    assert.notStrictEqual(first.attempt.pool, live.attempt.pool);
    first.wallet.points = 999999;
    first.wallet.inventory.locate = 99;
    first.wallet.levelScores.L001.doubleScoreClaimed = true;
    first.attempt.board.c1 = 'tampered';
    first.attempt.pool.push('extra');
    assert.equal(live.wallet.points, 240);
    assert.equal(live.wallet.inventory.locate, 2);
    assert.equal(live.wallet.levelScores.L001.doubleScoreClaimed, false);
    assert.equal(live.attempt.board.c1, 't1');
    assert.deepEqual(live.attempt.pool, [null, 't2']);
    const second = globalThis.__SHISE_STATE__;
    assert.deepEqual(second, live);
    assert.notStrictEqual(first, second);
    assert.throws(() => { globalThis.__SHISE_STATE__ = { wallet: { points: 0 } }; }, TypeError);
    // The getter is fresh rather than a stale snapshot cached at registration.
    live.wallet.points = 320;
    assert.equal(globalThis.__SHISE_STATE__.wallet.points, 320);
  } finally {
    if (originalDescriptor) Object.defineProperty(globalThis, '__SHISE_STATE__', originalDescriptor);
    else delete globalThis.__SHISE_STATE__;
    sys.isBrowser = false;
  }
});

function browserDocumentWithTools(registered) {
  const element = tag => ({
    tagName: tag, style: {}, children: [], attributes: {}, parent: null,
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    addEventListener() {},
    appendChild(child) { child.parent = this; this.children.push(child); },
    replaceChildren() { this.children = []; },
    querySelectorAll(selector) { return this.children.filter(child => selector === 'button' && child.tagName === 'button'); },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
  });
  return {
    body: element('body'), head: element('head'), createElement: element,
    getElementById() { return { getBoundingClientRect: () => ({ x: 0, y: 0, width: 390, height: 844 }) }; },
    modelContext: { registerTool(tool) { registered.set(tool.name, tool); return Promise.resolve(); } },
  };
}

const readToolState = tool => {
  const result = tool.execute({});
  assert.equal(result.content?.[0]?.type, 'text');
  const text = result.content[0].text;
  assert.doesNotMatch(text, /TypeError|Cannot read properties|undefined.*label/);
  return JSON.parse(text);
};

test('WebMCP state returns current control labels across additions, removals, modal changes and clear', () => {
  sys.isBrowser = true;
  const originalDocument = globalThis.document;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__SHISE_STATE__');
  const registered = new Map();
  globalThis.document = browserDocumentWithTools(registered);
  try {
    const live = { screen: 'home', wallet: { points: 200 } };
    const bridge = new BrowserTestBridge(true, () => live);
    assert.deepEqual([...registered.keys()], ['shise_state', 'shise_tap']);
    const stateTool = registered.get('shise_state');
    assert.equal(stateTool.annotations.readOnlyHint, true);
    bridge.text('拾色之间');
    bridge.control('开始游戏', () => {}, { x: 195, y: 400, width: 240, height: 60 });
    bridge.control('教程', () => {}, { x: 83, y: 500, width: 100, height: 80 });
    bridge.control('道具', () => {}, { x: 307, y: 500, width: 100, height: 80 });
    assert.deepEqual(readToolState(stateTool), {
      ...live, texts: ['拾色之间'], controls: [
        { id: 'control-1', label: '开始游戏' },
        { id: 'control-2', label: '教程' },
        { id: 'control-3', label: '道具' },
      ],
    });
    bridge.removeControls(['教程']);
    assert.deepEqual(readToolState(stateTool).controls.map(control => control.label), ['开始游戏', '道具']);
    bridge.modal();
    assert.deepEqual(readToolState(stateTool).controls, []);
    bridge.control('继续游戏', () => {});
    assert.deepEqual(readToolState(stateTool).controls, [{ id: 'control-4', label: '继续游戏' }]);
    bridge.clear();
    live.screen = 'game';
    bridge.text('第 1 关');
    bridge.control('候选槽 1 #FF0000', () => {});
    const current = readToolState(stateTool);
    assert.equal(current.screen, 'game');
    assert.deepEqual(current.texts, ['第 1 关']);
    assert.deepEqual(current.controls, [{ id: 'control-5', label: '候选槽 1 #FF0000' }]);
    // Mutating decoded tool output is also independent of the live wallet.
    current.wallet.points = 0;
    assert.equal(live.wallet.points, 200);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalDescriptor) Object.defineProperty(globalThis, '__SHISE_STATE__', originalDescriptor);
    else delete globalThis.__SHISE_STATE__;
    sys.isBrowser = false;
  }
});

test('WebMCP tap invokes only the requested current control and returns its updated labels', () => {
  sys.isBrowser = true;
  const originalDocument = globalThis.document;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__SHISE_STATE__');
  const registered = new Map();
  globalThis.document = browserDocumentWithTools(registered);
  try {
    const live = { taps: 0 };
    const bridge = new BrowserTestBridge(true, () => live);
    bridge.control('进入教程', () => {
      live.taps++;
      bridge.clear();
      bridge.control('教程 · 下一步', () => { live.taps++; });
    });
    const tapTool = registered.get('shise_tap');
    const result = JSON.parse(tapTool.execute({ id: 'control-1' }).content[0].text);
    assert.equal(result.taps, 1);
    assert.deepEqual(result.controls, [{ id: 'control-2', label: '教程 · 下一步' }]);
    // A removed or unknown id cannot call a stale callback or alter the current controls.
    for (const id of ['control-1', 'missing']) {
      const ignored = JSON.parse(tapTool.execute({ id }).content[0].text);
      assert.equal(ignored.taps, 1);
      assert.deepEqual(ignored.controls, result.controls);
    }
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalDescriptor) Object.defineProperty(globalThis, '__SHISE_STATE__', originalDescriptor);
    else delete globalThis.__SHISE_STATE__;
    sys.isBrowser = false;
  }
});
