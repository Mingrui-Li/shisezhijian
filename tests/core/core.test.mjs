import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { adaptLevel, createGame, startLevel, reduceGame, isSolved, isLocked, restoreAttempt, restoreGame, recoverInterruptedGame, RULES_VERSION } = require(process.env.SHISE_CORE_BUILD);
const copy = value => JSON.parse(JSON.stringify(value));
const stock = () => ({ locate: 3, peek: 2, addTime: 3 });
const colours = ['#190000', '#3F0000', '#650000', '#8B0000', '#B10000', '#D70000'];
function rawLevel(number = 5) {
  const cells = colours.map((targetHex, x) => ({ id: `c${x}`, x, y: 0, targetHex }));
  const tiles = colours.map((hex, x) => ({ id: `t${x}`, hex }));
  const initialPool = ['t3', 't1', 't4', 't2'];
  return {
    gameplayMode: 'click-fill', inputMode: 'tap', contentVersion: '0.5.0',
    id: `L${String(number).padStart(3, '0')}`, number, title: '单元测试色路', chapter: 1, chapterName: '初拾',
    grid: { columns: 6, rows: 1 }, cells, tiles, paths: [{ id: 'p1', cellIds: cells.map(cell => cell.id) }], anchors: ['c0', 'c5'],
    initialBoard: { c0: 't0', c1: null, c2: null, c3: null, c4: null, c5: 't5' }, initialPool,
    trayHomeByTile: Object.fromEntries(initialPool.map((id, i) => [id, i])),
    solution: { targetByCell: Object.fromEntries(cells.map(cell => [cell.id, cell.targetHex])), acceptedAlternativeLayouts: [] },
    tutorialText: '先点色块，再点空格',
    challenge: { mode: 'time', minimumMoves: 4, minimumMovesMetric: 'tray-to-empty-board-placements', timeLimitSeconds: number === 1 ? 45 : 69, revive: { maxPerAttempt: 2, addSeconds: 30 } },
  };
}
const level = (number = 5) => adaptLevel(rawLevel(number));
const game = (number = 5) => createGame(level(number), `attempt-${number}`, stock());
const act = (state, action) => {
  const result = reduceGame(state, action);
  assert.equal(result.changed, true, result.reason);
  return result.state;
};
const deny = (state, action) => {
  const before = JSON.stringify(state);
  const result = reduceGame(state, action);
  assert.equal(result.changed, false);
  assert.strictEqual(result.state, state);
  assert.equal(JSON.stringify(state), before);
};
const place = (state, index, cell) => act(state, { type: 'place', poolIndex: index, toCellId: cell });
const back = (state, cell, toPoolIndex) => act(state, { type: 'returnToTray', fromCellId: cell, toPoolIndex });
const begin = (state, requestId, rewardType = 'revive', prop) => act(state, { type: 'beginReward', requestId, rewardType, prop });
const settle = (state, requestId, outcome = 'completed') => act(state, { type: 'settleReward', requestId, outcome });
const emptyMovable = state => state.level.cells.filter(cell => !isLocked(state, cell.id) && state.attempt.board[cell.id] === null);
function fail(state) {
  state = act(state, { type: 'elapse', deltaMs: state.attempt.remainingTimeMs + 100 });
  assert.equal(state.attempt.status, 'Failed');
  return state;
}
const solve = state => {
  for (const cell of emptyMovable(state)) {
    const index = state.attempt.pool.findIndex(id => id && state.level.tiles.find(tile => tile.id === id).hex === cell.targetHex);
    state = place(state, index, cell.id);
  }
  return state;
};

test('all 100 timed levels follow real placement witnesses, tick each placement, restore every step and win within countdown', () => {
  const pack = JSON.parse(readFileSync(new URL('../../game/assets/resources/generated/levels.json', import.meta.url), 'utf8'));
  assert.match(pack.schemaVersion, /^4\.[01]\.0$/);
  assert.equal(pack.gameplayMode, 'click-fill');
  assert.equal(pack.inputMode, 'tap');
  assert.equal(pack.levels.length, 100);
  let actions = 0;
  for (const raw of pack.levels) {
    const definition = adaptLevel(raw);
    let state = createGame(definition, `witness-${raw.id}`);
    assert.equal(state.attempt.pool.length, definition.cells.length - definition.anchors.length);
    for (const step of raw.challenge.witnessSolution) {
      assert.equal(step.fromCellId, undefined, raw.id);
      state = act(state, {type:'elapse', deltaMs:1000});
      state = place(state, step.fromPoolIndex, step.toCellId);
      state = restoreGame(definition, copy(state));
      actions++;
    }
    assert.equal(state.attempt.status, 'Won', raw.id);
    assert.equal(isSolved(state.level, state.attempt.board, state.attempt.pool), true, raw.id);
    assert.ok(state.attempt.remainingTimeMs > 0, raw.id);
    assert.equal(state.wallet.points, state.attempt.score, raw.id);
    assert.ok(state.attempt.score >= 100 && state.attempt.score <= 200, raw.id);
  }
  assert.ok(actions > 1500);
});

test('all introductory levels also have a visible finite countdown while moves remain statistics', () => {
  for (let number = 1; number <= 4; number++) {
    const state = solve(game(number));
    assert.equal(state.attempt.remainingTimeMs, number === 1 ? 45000 : 69000);
    assert.equal(state.attempt.movesSpent, 4);
    assert.equal(state.attempt.status, 'Won');
  }
});

test('placing a selected tray tile is immutable, counts one move and leaves its previous tray slot empty', () => {
  const before = game();
  const json = JSON.stringify(before);
  const state = place(before, 1, 'c2');
  assert.equal(JSON.stringify(before), json);
  assert.deepEqual(state.attempt.pool, ['t3', null, 't4', 't2']);
  assert.equal(state.attempt.board.c2, 't1');
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.undoStack[0].kind, 'place');
});

test('invalid, occupied, fixed and same-cell targets never change board, budget or history', () => {
  const state = place(game(), 0, 'c1');
  for (const action of [
    { type: 'place', poolIndex: 1, toCellId: 'c1' },
    { type: 'place', poolIndex: 0, toCellId: 'c2' },
    { type: 'place', poolIndex: -1, toCellId: 'c2' },
    { type: 'place', poolIndex: 1, toCellId: 'c0' },
    { type: 'place', poolIndex: 1, toCellId: 'missing' },
    { type: 'move', fromCellId: 'c1', toCellId: 'c1' },
    { type: 'move', fromCellId: 'c0', toCellId: 'c2' },
    { type: 'move', fromCellId: 'c2', toCellId: 'c3' },
    { type: 'move', fromCellId: 'c1', toCellId: 'c5' },
    { type: 'returnToTray', fromCellId: 'c0' },
    { type: 'returnToTray', fromCellId: 'c2' },
    { type: 'swap', fromCellId: 'c1', toCellId: 'c2' },
  ]) deny(state, action);
});

test('moving a placed tile into another empty cell counts exactly one move without filling its tray slot', () => {
  let state = place(game(), 0, 'c1');
  state = act(state, { type: 'move', fromCellId: 'c1', toCellId: 'c3' });
  assert.equal(state.attempt.board.c1, null);
  assert.equal(state.attempt.board.c3, 't3');
  assert.equal(state.attempt.pool[0], null);
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.movesSpent, 2);
  const occupied = place(state, 1, 'c1');
  deny(occupied, { type: 'move', fromCellId: 'c3', toCellId: 'c1' });
});

test('automatic return prefers the initial home when free, is free, and does not alter elapsed time or earlier move statistics', () => {
  let state = place(game(), 2, 'c2');
  state = back(state, 'c2');
  assert.deepEqual(state.attempt.pool, state.level.initialPool);
  assert.equal(state.attempt.board.c2, null);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.undoStack[1].kind, 'returnToTray');
  state = act(state, { type: 'undo' });
  assert.equal(state.attempt.board.c2, 't4');
  assert.equal(state.attempt.pool[2], null);
  assert.equal(state.attempt.remainingTimeMs, 69000);
});

test('undo restores place/move board and stable tray holes without refunding elapsed time', () => {
  const before = game();
  let state = place(before, 0, 'c1');
  state = act(state, { type: 'move', fromCellId: 'c1', toCellId: 'c2' });
  state = act(state, { type: 'undo' });
  assert.equal(state.attempt.board.c1, 't3');
  assert.equal(state.attempt.board.c2, null);
  state = act(state, { type: 'undo' });
  assert.deepEqual(state.attempt.board, before.attempt.board);
  assert.deepEqual(state.attempt.pool, before.attempt.pool);
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.movesSpent, 2);
  deny(state, { type: 'undo' });
});

test('a solution with one millisecond remaining wins before failure and requires a full correct board plus an empty tray', () => {
  const definition = level();
  definition.challenge.timeLimitSeconds = 45;
  let state = createGame(definition, 'last-move');
  state = act(state, { type: 'elapse', deltaMs: 44999 });
  let events = [];
  for (const [index, cell] of [[1, 'c1'], [3, 'c2'], [0, 'c3'], [2, 'c4']]) {
    const result = reduceGame(state, { type: 'place', poolIndex: index, toCellId: cell });
    state = result.state;
    events.push(...result.events);
  }
  assert.equal(state.attempt.remainingTimeMs, 1);
  assert.equal(state.attempt.status, 'Won');
  assert.deepEqual(events.map(event => event.type), ['won']);
  assert.equal(isSolved(definition, state.attempt.board, ['t3', null, null, null]), false);
  deny(state, { type: 'undo' });
});

test('a full incorrect board remains adjustable while time remains rather than causing immediate failure', () => {
  let state = game();
  for (const [index, cell] of [[0, 'c1'], [1, 'c2'], [2, 'c3'], [3, 'c4']]) state = place(state, index, cell);
  assert.equal(state.attempt.status, 'Playing');
  assert.ok(state.attempt.pool.every(id => id === null));
  state = back(state, 'c1');
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.status, 'Playing');
});

test('failure freezes placement, move, free return, undo and all props until a permitted revival', () => {
  const state = fail(game());
  for (const action of [{ type: 'place', poolIndex: 0, toCellId: 'c2' }, { type: 'move', fromCellId: 'c1', toCellId: 'c2' },
    { type: 'returnToTray', fromCellId: 'c1' }, { type: 'undo' }, { type: 'locate' }, { type: 'peek', pathId: 'p1', nowMs: 10 }, { type: 'addTime' }]) deny(state, action);
});

test('locate from tray into empty cell is free, locks the target and undo restores tray without refunding inventory', () => {
  const before = game();
  let state = act(before, { type: 'locate' });
  assert.equal(state.attempt.board.c1, 't1');
  assert.equal(state.attempt.pool[1], null);
  assert.deepEqual(state.attempt.auxiliaryLocks, ['c1']);
  assert.equal(state.attempt.remainingTimeMs, 69000);
  deny(state, { type: 'returnToTray', fromCellId: 'c1' });
  deny(state, { type: 'move', fromCellId: 'c1', toCellId: 'c2' });
  state = act(state, { type: 'undo' });
  assert.deepEqual(state.attempt.board, before.attempt.board);
  assert.deepEqual(state.attempt.pool, before.attempt.pool);
  assert.deepEqual(state.attempt.auxiliaryLocks, []);
  assert.equal(state.wallet.inventory.locate, 2);
  assert.equal(state.attempt.propUses.locate, 1);
});

test('locate sends an occupied target wrong tile to its own home before filling from tray', () => {
  const before = place(game(), 0, 'c1');
  const state = act(before, { type: 'locate' });
  assert.equal(state.attempt.board.c1, 't1');
  assert.deepEqual(state.attempt.pool, ['t3', null, 't4', 't2']);
  assert.equal(state.attempt.remainingTimeMs, before.attempt.remainingTimeMs);
  assert.equal(state.attempt.movesSpent, 1);
});

test('locate from another board cell leaves its source empty and returns displaced target tile to home', () => {
  let before = place(game(), 1, 'c2');
  before = place(before, 2, 'c1');
  const state = act(before, { type: 'locate' });
  assert.equal(state.attempt.board.c1, 't1');
  assert.equal(state.attempt.board.c2, null);
  assert.deepEqual(state.attempt.pool, ['t3', null, 't4', 't2']);
  assert.equal(state.attempt.remainingTimeMs, 69000);
  const undo = act(state, { type: 'undo' });
  assert.deepEqual(undo.attempt.board, before.attempt.board);
  assert.deepEqual(undo.attempt.pool, before.attempt.pool);
  assert.equal(undo.wallet.inventory.locate, 2);
});

test('no-effect locate consumes no stock and the two-use limit remains consumed after undo', () => {
  const won = solve(game());
  deny(won, { type: 'locate' });
  let state = game();
  state = act(state, { type: 'locate' });
  state = act(state, { type: 'undo' });
  state = act(state, { type: 'locate' });
  state = act(state, { type: 'undo' });
  deny(state, { type: 'locate' });
  assert.equal(state.wallet.inventory.locate, 1);
});

test('peek freezes the selected path for three seconds and never changes board, tray or history', () => {
  const before = place(game(), 1, 'c2');
  let state = act(before, { type: 'peek', pathId: 'p1', nowMs: 100 });
  assert.deepEqual(state.attempt.board, before.attempt.board);
  assert.deepEqual(state.attempt.pool, before.attempt.pool);
  assert.deepEqual(state.attempt.undoStack, before.attempt.undoStack);
  assert.deepEqual(state.attempt.preview, { pathId: 'p1', expiresAtMs: 3100 });
  deny(state, { type: 'expirePeek', nowMs: 3099 });
  deny(state, { type: 'returnToTray', fromCellId: 'c2' });
  state = act(state, { type: 'expirePeek', nowMs: 3100 });
  assert.equal(state.attempt.status, 'Playing');
  deny(state, { type: 'peek', pathId: 'p1', nowMs: 5000 });
  deny(before, { type: 'peek', pathId: 'missing', nowMs: 1 });
});

test('background and save recovery end preview without refunding or showing it again', () => {
  const preview = act(game(), { type: 'peek', pathId: 'p1', nowMs: 100 });
  const state = recoverInterruptedGame(restoreGame(level(), copy(preview)));
  assert.equal(state.attempt.status, 'Playing');
  assert.equal(state.attempt.preview, null);
  assert.equal(state.attempt.propUses.peek, 1);
  deny(state, { type: 'peek', pathId: 'p1', nowMs: 200 });
  assert.equal(act(preview, { type: 'suspend' }).attempt.preview, null);
});

test('addTime adds thirty seconds at most twice only while playing and preserves elapsed time', () => {
  let state = place(game(), 0, 'c1');
  state = act(state, { type: 'addTime' });
  state = act(state, { type: 'addTime' });
  assert.equal(state.attempt.remainingTimeMs, 129000);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.totalTimeGrantedMs, 60000);
  deny(state, { type: 'addTime' });
  const empty = createGame(level(), 'no-inventory', {locate:0,peek:0,addTime:0});
  for (const action of [{ type: 'locate' }, { type: 'peek', pathId: 'p1', nowMs: 1 }, { type: 'addTime' }]) deny(empty, action);
});

test('cancelled/failed reward videos restore failure, preserve board and consume no reward quota', () => {
  const failed = fail(game());
  let state = begin(failed, 'cancel-request');
  deny(state, { type: 'beginReward', requestId: 'double', rewardType: 'revive' });
  deny(state, {type:'settleReward', requestId:'cancel-request', outcome:'invalid'});
  deny(state, { type: 'undo' });
  state = settle(state, 'cancel-request', 'cancelled');
  state = settle(begin(state, 'failed-request'), 'failed-request', 'failed');
  assert.equal(state.attempt.status, 'Failed');
  assert.equal(state.attempt.revivesUsed, 0);
  assert.equal(state.attempt.reviveAdsGranted, 0);
  assert.deepEqual(state.attempt.board, failed.attempt.board);
  assert.deepEqual(state.attempt.pool, failed.attempt.pool);
});

test('confirmed revival preserves board, tray, locks and history, grants exactly once and caps at two', () => {
  let state = fail(act(game(), { type: 'locate' }));
  const failed = copy(state.attempt);
  state = settle(begin(state, 'revive-1'), 'revive-1');
  assert.equal(state.attempt.status, 'Playing');
  assert.equal(state.attempt.remainingTimeMs, 30000);
  for (const key of ['board', 'pool', 'undoStack', 'auxiliaryLocks', 'movesSpent']) assert.deepEqual(state.attempt[key], failed[key]);
  deny(state, { type: 'settleReward', requestId: 'revive-1', outcome: 'completed' });
  state = settle(begin(fail(state), 'revive-2'), 'revive-2');
  state = fail(state);
  assert.equal(state.attempt.revivesUsed, 2);
  assert.equal(state.attempt.reviveAdsGranted, 2);
  deny(state, { type: 'beginReward', requestId: 'revive-3', rewardType: 'revive' });
});

test('restock has its own one-video quota, adds inventory rather than using a prop, and remains independent from revival', () => {
  let state = createGame(level(), 'restock-attempt', {locate:0,peek:0,addTime:0});
  state = settle(begin(state, 'restock-1', 'restock', 'locate'), 'restock-1');
  assert.equal(state.wallet.inventory.locate, 1);
  assert.equal(state.attempt.propUses.locate, 0);
  assert.equal(state.attempt.propRestockAdsGranted, 1);
  state = act(state, { type: 'locate' });
  deny(state, { type: 'beginReward', requestId: 'restock-2', rewardType: 'restock', prop: 'peek' });
  state = settle(begin(fail(state), 'revive'), 'revive');
  assert.equal(state.attempt.revivesUsed, 1);
  assert.equal(state.attempt.propRestockAdsGranted, 1);
});

test('restock rejects positive inventory and exhausted prop usage limits', () => {
  deny(game(), { type: 'beginReward', requestId: 'stock-remains', rewardType: 'restock', prop: 'locate' });
  let state = createGame(level(), 'limit', { locate: 2, peek: 0, addTime: 0 });
  for (let i = 0; i < 2; i++) { state = act(state, { type: 'locate' }); state = act(state, { type: 'undo' }); }
  deny(state, { type: 'beginReward', requestId: 'limit-hit', rewardType: 'restock', prop: 'locate' });
});

test('restart restores empty rail and seeded tray/budget while preserving inventory and durable rewards', () => {
  const before = act(game(), { type: 'locate' });
  const state = act(before, { type: 'restart', attemptId: 'new-attempt' });
  assert.notEqual(state.attempt.id, before.attempt.id);
  assert.deepEqual(state.attempt.board, { ...state.level.initialBoard });
  assert.deepEqual(state.attempt.pool, state.level.initialPool);
  assert.equal(state.attempt.remainingTimeMs, state.level.challenge.timeLimitSeconds * 1000);
  assert.deepEqual(state.wallet, before.wallet);
  assert.deepEqual(state.attempt.propUses, { locate: 0, peek: 0, addTime: 0 });
  assert.equal(state.attempt.undoStack.length, 0);
  deny(state, { type: 'restart', attemptId: state.attempt.id });
});

test('late verified revival cannot alter a restarted board; its deferred entitlement applies once after a later failure', () => {
  let state = begin(fail(game()), 'late-revival');
  state = act(state, { type: 'restart', attemptId: 'new-after-video' });
  const before = copy(state.attempt);
  state = settle(restoreGame(level(), copy(state)), 'late-revival');
  assert.deepEqual(state.attempt.board, before.board);
  assert.deepEqual(state.attempt.pool, before.pool);
  assert.equal(state.attempt.remainingTimeMs, before.remainingTimeMs);
  assert.equal(state.wallet.pendingRevives.length, 1);
  deny(state, { type: 'applyPendingRevive', requestId: 'late-revival' });
  state = act(fail(state), { type: 'applyPendingRevive', requestId: 'late-revival' });
  assert.equal(state.attempt.remainingTimeMs, 30000);
  assert.equal(state.attempt.revivesUsed, 1);
  assert.equal(state.attempt.reviveAdsGranted, 0);
  assert.equal(state.wallet.pendingRevives.length, 0);
  deny(state, { type: 'applyPendingRevive', requestId: 'late-revival' });
  deny(state, { type: 'settleReward', requestId: 'late-revival', outcome: 'completed' });
});

test('late restock credits inventory without mutating a new level board, tray or quota', () => {
  let state = createGame(level(), 'origin', {locate:0,peek:0,addTime:0});
  state = begin(state, 'late-restock', 'restock', 'peek');
  state = startLevel(state, level(6), 'next-level');
  const before = copy(state.attempt);
  state = settle(state, 'late-restock');
  assert.equal(state.wallet.inventory.peek, 1);
  assert.deepEqual(state.attempt, { ...before, revision: before.revision + 1 });
});

test('interrupted advertisement stays unawarded until a verified idempotent callback after JSON restoration', () => {
  let state = begin(fail(game()), 'interrupted');
  state = recoverInterruptedGame(restoreGame(level(), copy(state)));
  assert.equal(state.attempt.status, 'Failed');
  assert.equal(state.wallet.rewardLedger.interrupted.status, 'pending');
  assert.equal(state.attempt.revivesUsed, 0);
  deny(state, { type: 'beginReward', requestId: 'parallel', rewardType: 'revive' });
  state = settle(restoreGame(level(), copy(state)), 'interrupted');
  assert.equal(state.attempt.revivesUsed, 1);
  deny(restoreGame(level(), copy(state)), { type: 'settleReward', requestId: 'interrupted', outcome: 'completed' });
});

test('strict restoration accepts valid layouts and history through placement, return, locate and preview', () => {
  let state = place(game(), 0, 'c1');
  state = back(state, 'c1');
  state = act(state, { type: 'locate' });
  state = act(state, { type: 'peek', pathId: 'p1', nowMs: 50 });
  const restored = restoreGame(level(), copy(state));
  assert.deepEqual(restored, state);
  assert.equal(restored.attempt.rulesVersion, RULES_VERSION);
});

test('strict restoration rejects legacy rules, moved anchors, invalid tray sizes, duplicate tiles, bad budgets and legacy history', () => {
  for (const mutate of [
    raw => { delete raw.rulesVersion; },
    raw => { raw.rulesVersion = 'legacy'; },
    raw => { raw.levelContentVersion = '0.3.0-candidate'; },
    raw => { raw.board.c0 = null; raw.pool[0] = 't0'; },
        raw => { raw.pool.pop(); },
    raw => { raw.board.c2 = raw.pool[1]; },
    raw => { raw.remainingTimeMs++; },
    raw => { raw.status = 'Won'; },
    raw => { raw.auxiliaryLocks = ['c2']; },
    raw => { raw.undoStack[0].kind = 'swap'; },
  ]) {
    const raw = copy(place(game(), 0, 'c1').attempt);
    mutate(raw);
    assert.throws(() => restoreAttempt(level(), raw));
  }
});

test('adapter rejects old content, prefilled movable tiles, compacted home indices and an impossible placement budget', () => {
  for (const mutate of [
    raw => { delete raw.gameplayMode; },
    raw => { raw.inputMode = 'drag'; },
    raw => { raw.challenge.minimumMovesMetric = 'legacy'; },
    raw => { raw.challenge.minimumMoves = 1; },
    raw => { raw.challenge.timeLimitSeconds = 3; },
    raw => { raw.trayHomeByTile.t3 = 1; },
    raw => { raw.initialBoard.c1 = raw.initialPool.shift(); },
    raw => { raw.cells[1].targetHex = '#000000'; },
    raw => { raw.paths[0].cellIds.push('missing'); },
    raw => { raw.solution.acceptedAlternativeLayouts.push({}); },
    raw => { raw.challenge.mode = 'legacy'; },
  ]) {
    const raw = rawLevel(); mutate(raw); assert.throws(() => adaptLevel(raw));
  }
});

test('win comparison accepts equivalent colour instances while preserving tile conservation', () => {
  const raw = rawLevel();
  raw.tiles[2].hex = raw.tiles[1].hex;
  raw.cells[2].targetHex = raw.cells[1].targetHex;
  raw.solution.targetByCell.c2 = raw.cells[1].targetHex;
  let state = createGame(adaptLevel(raw), 'same-colour');
  for (const [index, cell] of [[3, 'c1'], [1, 'c2'], [0, 'c3'], [2, 'c4']]) state = place(state, index, cell);
  assert.equal(state.attempt.status, 'Won');
});

test('countdown elapses only in Playing, clamps at zero, and overshoot never corrupts accounting', () => {
  const initial = game();
  const ticking = act(initial, { type: 'elapse', deltaMs: 1234 });
  assert.equal(ticking.attempt.remainingTimeMs, 67766);
  assert.equal(ticking.attempt.elapsedMs, 1234);
  assert.equal(initial.attempt.elapsedMs, 0);
  for (const deltaMs of [0, -1, Infinity, NaN, 1.5]) deny(ticking, { type: 'elapse', deltaMs });
  const failed = fail(ticking);
  assert.equal(failed.attempt.remainingTimeMs, 0);
  assert.equal(failed.attempt.elapsedMs, 69000);
  assert.deepEqual(restoreGame(level(), copy(failed)), failed);
  for (const paused of [
    failed,
    solve(game()),
    act(ticking, { type: 'peek', pathId: 'p1', nowMs: 1 }),
    begin(failed, 'pause-video'),
  ]) deny(paused, { type: 'elapse', deltaMs: 1000 });
});

test('undo and restart never refund elapsed time, and purchased time participates in exact restoration', () => {
  let state = act(game(), { type: 'elapse', deltaMs: 5000 });
  state = place(state, 0, 'c1');
  state = act(state, { type: 'addTime' });
  state = act(state, { type: 'undo' });
  assert.equal(state.attempt.elapsedMs, 5000);
  assert.equal(state.attempt.remainingTimeMs, 94000);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.propUses.addTime, 1);
  assert.deepEqual(restoreGame(level(), copy(state)), state);
  state = act(state, { type: 'restart', attemptId: 'timer-restart' });
  assert.equal(state.attempt.remainingTimeMs, 69000);
  assert.equal(state.attempt.elapsedMs, 0);
  assert.equal(state.attempt.totalTimeGrantedMs, 0);
  assert.equal(state.wallet.inventory.addTime, 2);
});

test('performance awards the best-score improvement only and spending points cannot enable replay farming', () => {
  let state = act(game(), { type: 'elapse', deltaMs: 34500 });
  state = solve(state);
  assert.equal(state.attempt.score, 175);
  assert.equal(state.attempt.pointsEarned, 175);
  assert.equal(state.wallet.points, 175);
  state = act(state, { type: 'purchaseProp', prop: 'locate' });
  assert.equal(state.wallet.points, 55);
  assert.equal(state.wallet.inventory.locate, 4);
  assert.equal(state.wallet.levelScores.L005.bestScore, 175);
  state = act(state, { type: 'restart', attemptId: 'replay-fast' });
  state = solve(state);
  assert.equal(state.attempt.score, 200);
  assert.equal(state.attempt.pointsEarned, 25);
  assert.equal(state.wallet.points, 80);
  state = act(state, { type: 'restart', attemptId: 'replay-farm' });
  state = solve(state);
  assert.equal(state.attempt.pointsEarned, 0);
  assert.equal(state.wallet.points, 80);
  deny(state, { type: 'beginReward', requestId: 'zero-double', rewardType: 'doubleScore' });
});

test('performance penalizes inefficient placements and every prop/revival, with a 100-point floor', () => {
  let clean = solve(game());
  assert.equal(clean.attempt.score, 200);
  let inefficient = game();
  for (let i = 0; i < 8; i++) inefficient = back(place(inefficient, 0, 'c1'), 'c1');
  inefficient = solve(inefficient);
  assert.ok(inefficient.attempt.score < clean.attempt.score);
  let aided = act(game(), { type: 'locate' });
  aided = act(aided, { type: 'peek', pathId: 'p1', nowMs: 0 });
  aided = act(aided, { type: 'endPeek' });
  aided = act(aided, { type: 'addTime' });
  aided = settle(begin(fail(aided), 'score-revive'), 'score-revive');
  aided = act(aided, { type: 'elapse', deltaMs: 29999 });
  aided = solve(aided);
  assert.equal(aided.attempt.score, 110);
  assert.equal(aided.wallet.points, 110);
  assert.deepEqual(restoreGame(level(), copy(aided)), aided);
});

test('shop atomically exchanges point balances for stock in Playing, Won and Failed and rejects paused or unaffordable purchases', () => {
  for (let state of [game(), solve(game()), fail(game())]) {
    state.wallet.points = 300;
    const before = copy(state);
    const prices = { locate:120, peek:80, addTime:100 };
    for (const [prop, price] of Object.entries(prices)) {
      const bought = act(state, { type: 'purchaseProp', prop });
      assert.equal(bought.wallet.points, 300-price);
      assert.equal(bought.wallet.inventory[prop], state.wallet.inventory[prop] + 1);
      assert.deepEqual(bought.attempt.board, state.attempt.board);
    }
    assert.deepEqual(copy(state), before);
  }
  deny(game(), { type: 'purchaseProp', prop: 'peek' });
  deny(game(), { type: 'purchaseProp', prop: 'unknown' });
  const preview = act(game(), { type: 'peek', pathId: 'p1', nowMs: 1 });
  preview.wallet.points = 500;
  deny(preview, { type: 'purchaseProp', prop: 'peek' });
  const ad = begin(fail(game()), 'shop-video');
  ad.wallet.points = 500;
  deny(ad, { type: 'purchaseProp', prop: 'peek' });
});

test('double-score video is voluntary, cancelled video grants nothing, and verified grant is idempotent across saves', () => {
  let state = solve(game());
  assert.equal(state.wallet.points, 200);
  state = settle(begin(state, 'double-cancel', 'doubleScore'), 'double-cancel', 'cancelled');
  assert.equal(state.attempt.status, 'Won');
  assert.equal(state.wallet.points, 200);
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed, false);
  state = begin(state, 'double-success', 'doubleScore');
  state = restoreGame(level(), copy(state));
  state = settle(state, 'double-success');
  assert.equal(state.attempt.status, 'Won');
  assert.equal(state.wallet.points, 400);
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed, true);
  deny(restoreGame(level(), copy(state)), { type: 'settleReward', requestId: 'double-success', outcome:'completed' });
  deny(state, { type: 'beginReward', requestId: 'double-again', rewardType:'doubleScore' });
});

test('a late double-score callback credits only the wallet and cannot change a new board or level score', () => {
  let state = begin(solve(game()), 'late-double', 'doubleScore');
  state = startLevel(state, level(6), 'next-for-double');
  const before = copy(state.attempt);
  state = settle(state, 'late-double');
  assert.equal(state.wallet.points, 400);
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed, true);
  assert.equal(state.wallet.levelScores.L006, undefined);
  assert.deepEqual(state.attempt, { ...before, revision: before.revision + 1 });
});

test('strict restoration rejects damaged time accounting, score metadata, and wallet balances instead of resetting rights', () => {
  for (const mutate of [
    raw => raw.attempt.elapsedMs++,
    raw => raw.attempt.remainingTimeMs++,
    raw => raw.attempt.totalTimeGrantedMs += 1,
    raw => raw.attempt.initialTimeMs++,
    raw => raw.wallet.points = -1,
    raw => raw.wallet.points = 1.1,
    raw => delete raw.wallet.points,
    raw => delete raw.wallet.levelScores,
    raw => raw.wallet.levelScores.L005 = { bestScore: 900, doubleScoreClaimed: false },
  ]) {
    const raw = copy(game()); mutate(raw);
    assert.throws(() => restoreGame(level(), raw));
  }
});

test('two board tiles can return to each other empty tray slots and then be placed normally', () => {
  let state = act(game(), {type:'elapse',deltaMs:1234});
  state = place(state,0,'c1');
  state = place(state,1,'c2');
  const remaining = state.attempt.remainingTimeMs;
  state = back(state,'c1',1);
  state = back(state,'c2',0);
  assert.deepEqual(state.attempt.pool,['t1','t3','t4','t2']);
  assert.equal(state.attempt.board.c1,null);
  assert.equal(state.attempt.board.c2,null);
  assert.equal(state.attempt.movesSpent,2);
  assert.equal(state.attempt.remainingTimeMs,remaining);
  assert.equal(state.attempt.elapsedMs,1234);
  assert.equal(state.wallet.points,0);
  assert.equal(state.attempt.score,null);
  state = restoreGame(level(),copy(state));
  state = place(state,0,'c1');
  state = place(state,1,'c3');
  state = place(state,3,'c2');
  state = place(state,2,'c4');
  assert.equal(state.attempt.status,'Won');
  assert.equal(state.attempt.movesSpent,6);
  assert.equal(state.attempt.remainingTimeMs,remaining);
  assert.equal(state.wallet.points,state.attempt.score);
  assert.ok(state.attempt.score < 200);
});

test('automatic return uses the original slot if empty, otherwise the first available empty slot', () => {
  let state = place(game(),0,'c1');
  state = place(state,1,'c2');
  state = back(state,'c1',1); // Its original home is deliberately filled by a different tile.
  assert.deepEqual(state.attempt.pool,[null,'t3','t4','t2']);
  state = back(state,'c2');
  assert.deepEqual(state.attempt.pool,['t1','t3','t4','t2']);
  state = place(state,1,'c4');
  state = back(state,'c4'); // The original home of t3 is occupied; slot 1 is now free.
  assert.deepEqual(state.attempt.pool,['t1','t3','t4','t2']);
  assert.deepEqual(restoreGame(level(),copy(state)),state);
});

test('explicit tray return rejects occupied, out-of-range and noninteger slots without swapping or mutating history', () => {
  const state = place(game(),0,'c1');
  for (const toPoolIndex of [1,2,3,-1,4,NaN,Infinity,0.5,null]) {
    deny(state,{type:'returnToTray',fromCellId:'c1',toPoolIndex});
  }
  deny(state,{type:'returnToTray',fromCellId:'c0',toPoolIndex:0});
  deny(state,{type:'returnToTray',fromCellId:'c2',toPoolIndex:0});
  assert.deepEqual(state.attempt.pool,[null,'t1','t4','t2']);
  assert.equal(state.attempt.board.c1,'t3');
});

test('arbitrary tray placements survive undo and JSON restoration without refunding elapsed time or move statistics', () => {
  let state = place(game(),0,'c1');
  state = place(state,1,'c2');
  const before = copy(state.attempt);
  state = act(state,{type:'elapse',deltaMs:2300});
  state = back(state,'c1',1);
  state = back(state,'c2',0);
  state = restoreGame(level(),copy(state));
  state = act(state,{type:'undo'});
  assert.deepEqual(state.attempt.pool,[null,'t3','t4','t2']);
  assert.equal(state.attempt.board.c2,'t1');
  state = restoreGame(level(),copy(state));
  state = act(state,{type:'undo'});
  assert.deepEqual(state.attempt.board,before.board);
  assert.deepEqual(state.attempt.pool,before.pool);
  assert.equal(state.attempt.remainingTimeMs,66700);
  assert.equal(state.attempt.elapsedMs,2300);
  assert.equal(state.attempt.movesSpent,2);
});

test('returning to a slot on another tray page is independent of authored home indexes', () => {
  const pack = JSON.parse(readFileSync(new URL('../../game/assets/resources/generated/levels.json',import.meta.url),'utf8'));
  const definition = adaptLevel(pack.levels.find(raw => raw.initialPool.length > 18));
  let state = createGame(definition,'cross-page');
  const targets = definition.cells.filter(cell => !definition.anchors.includes(cell.id));
  const last = state.attempt.pool.length-1;
  const firstTile = state.attempt.pool[0],lastTile = state.attempt.pool[last];
  state = place(state,0,targets[0].id);
  state = place(state,last,targets[1].id);
  state = back(state,targets[0].id,last);
  state = back(state,targets[1].id,0);
  assert.equal(state.attempt.pool[0],lastTile);
  assert.equal(state.attempt.pool[last],firstTile);
  assert.deepEqual(restoreGame(definition,copy(state)),state);
  state = place(state,last,targets[2].id);
  assert.equal(state.attempt.board[targets[2].id],firstTile);
});

test('locate extracts a misplaced correct tray tile before returning a displaced tile whose home is occupied', () => {
  let state = place(game(),0,'c1'); // Target c1 contains wrong t3; original home 0 is empty.
  state = place(state,1,'c2');
  state = back(state,'c2',0); // Correct t1 occupies displaced t3 original home.
  assert.deepEqual(state.attempt.pool,['t1',null,'t4','t2']);
  const before = copy(state.attempt);
  state = act(state,{type:'locate'});
  assert.equal(state.attempt.board.c1,'t1');
  assert.deepEqual(state.attempt.pool,['t3',null,'t4','t2']);
  assert.deepEqual(state.attempt.auxiliaryLocks,['c1']);
  assert.equal(state.wallet.inventory.locate,2);
  state = restoreGame(level(),copy(state));
  state = act(state,{type:'undo'});
  assert.deepEqual(state.attempt.board,before.board);
  assert.deepEqual(state.attempt.pool,before.pool);
  assert.equal(state.attempt.propUses.locate,1);
});

test('locate takes a correct board tile and returns the displaced tile to another empty slot when its home is occupied', () => {
  let state = place(game(),0,'c1'); // Wrong t3 at first target.
  state = place(state,2,'c2');
  state = back(state,'c2',0); // t4 now occupies t3 authored home.
  state = place(state,1,'c2'); // Correct t1 is on another board cell.
  assert.deepEqual(state.attempt.pool,['t4',null,null,'t2']);
  state = act(state,{type:'locate'});
  assert.equal(state.attempt.board.c1,'t1');
  assert.equal(state.attempt.board.c2,null);
  assert.deepEqual(state.attempt.pool,['t4','t3',null,'t2']);
  assert.deepEqual(restoreGame(level(),copy(state)),state);
});

test('saved tray tile order may change while invalid IDs, duplicate IDs, missing tiles and altered length still fail', () => {
  const raw = copy(game());
  raw.attempt.pool.reverse();
  const restored = restoreGame(level(),raw);
  assert.deepEqual(restored.attempt.pool,['t2','t4','t1','t3']);
  for (const mutate of [
    item => item.attempt.pool.push(null),
    item => item.attempt.pool[0]='unknown',
    item => item.attempt.pool[0]=item.attempt.pool[1],
    item => item.attempt.pool[0]=null,
    item => {item.attempt.pool[0]='t0';item.attempt.board.c0=null;},
  ]) {
    const invalid = copy(restored);mutate(invalid);assert.throws(() => restoreGame(level(),invalid));
  }
});

test('a harder puzzle epoch earns its own first-clear score without losing earlier paid points or inventory', () => {
  let state = solve(act(game(),{type:'elapse',deltaMs:3000}));
  assert.equal(state.attempt.score,198);
  state = settle(begin(state,'old-design-double','doubleScore'),'old-design-double');
  assert.equal(state.wallet.points,396);
  const inventory = copy(state.wallet.inventory);
  const raw = rawLevel();raw.contentVersion='0.6.0';raw.scoreEpoch='expanded-0.6';
  const expanded = adaptLevel(raw);
  state = startLevel(state,expanded,'new-harder-design');
  state = solve(act(state,{type:'elapse',deltaMs:34500}));
  assert.equal(state.attempt.score,175);
  assert.equal(state.attempt.pointsEarned,175);
  assert.equal(state.wallet.points,571);
  assert.deepEqual(state.wallet.inventory,inventory);
  assert.deepEqual(state.wallet.levelScores.L005,{scoreEpoch:'expanded-0.6',bestScore:175,doubleScoreClaimed:false});
  state = settle(begin(state,'new-design-double','doubleScore'),'new-design-double');
  assert.equal(state.wallet.points,746);
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed,true);
  assert.deepEqual(restoreGame(expanded,copy(state)),state);
});

test('unchanged level epochs preserve old best-score comparisons and claimed doubles across content versions', () => {
  let state = createGame(level(13),'old-thirteenth',stock());
  state = solve(act(state,{type:'elapse',deltaMs:3000}));
  state = settle(begin(state,'thirteenth-double','doubleScore'),'thirteenth-double');
  const paid = state.wallet.points;
  // Legacy score records had no explicit epoch; they belong to the base design.
  delete state.wallet.levelScores.L013.scoreEpoch;
  const raw = rawLevel(13);raw.contentVersion='0.6.0';
  const unchanged = adaptLevel(raw);
  state = startLevel(state,unchanged,'same-design-new-content');
  state = solve(act(state,{type:'elapse',deltaMs:34500}));
  assert.equal(state.attempt.score,175);
  assert.equal(state.attempt.pointsEarned,0);
  assert.equal(state.wallet.points,paid);
  assert.equal(state.wallet.levelScores.L013.bestScore,198);
  assert.equal(state.wallet.levelScores.L013.doubleScoreClaimed,true);
});

test('a late old-epoch double preserves its confirmed bonus without consuming the new design double qualification', () => {
  let state = solve(act(game(),{type:'elapse',deltaMs:3000}));
  state = begin(state,'late-old-epoch','doubleScore');
  // Simulate a legal pre-epoch reward request restored from an existing version-3 wallet.
  delete state.wallet.rewardLedger['late-old-epoch'].scoreEpoch;
  const raw=rawLevel();raw.contentVersion='0.6.0';raw.scoreEpoch='expanded-0.6';
  const expanded=adaptLevel(raw);
  state=startLevel(state,expanded,'new-while-old-video-pending');
  state=solve(act(state,{type:'elapse',deltaMs:34500}));
  assert.equal(state.wallet.points,373);
  deny(state,{type:'beginReward',requestId:'parallel-new-epoch',rewardType:'doubleScore'});
  state=settle(restoreGame(expanded,copy(state)),'late-old-epoch');
  assert.equal(state.wallet.points,571);
  assert.equal(state.wallet.levelScores.L005.scoreEpoch,'expanded-0.6');
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed,false);
  deny(state,{type:'settleReward',requestId:'late-old-epoch',outcome:'completed'});
  state=settle(begin(state,'current-epoch-double','doubleScore'),'current-epoch-double');
  assert.equal(state.wallet.points,746);
  assert.equal(state.wallet.levelScores.L005.doubleScoreClaimed,true);
});
