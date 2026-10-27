import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { adaptLevel, createGame, startLevel, reduceGame, isSolved, isLocked, restoreAttempt, restoreGame, recoverInterruptedGame, RULES_VERSION } = require(process.env.SHISE_CORE_BUILD);
const copy = value => JSON.parse(JSON.stringify(value));
const stock = () => ({ locate: 3, peek: 2, addMoves: 3 });
const colours = ['#190000', '#3F0000', '#650000', '#8B0000', '#B10000', '#D70000'];
function rawLevel(number = 5) {
  const cells = colours.map((targetHex, x) => ({ id: `c${x}`, x, y: 0, targetHex }));
  const tiles = colours.map((hex, x) => ({ id: `t${x}`, hex }));
  const initialPool = ['t3', 't1', 't4', 't2'];
  return {
    gameplayMode: 'click-fill', inputMode: 'tap', contentVersion: '0.4.0-candidate',
    id: `L${String(number).padStart(3, '0')}`, number, title: '单元测试色路', chapter: 1, chapterName: '初拾',
    grid: { columns: 6, rows: 1 }, cells, tiles, paths: [{ id: 'p1', cellIds: cells.map(cell => cell.id) }], anchors: ['c0', 'c5'],
    initialBoard: { c0: 't0', c1: null, c2: null, c3: null, c4: null, c5: 't5' }, initialPool,
    trayHomeByTile: Object.fromEntries(initialPool.map((id, i) => [id, i])),
    solution: { targetByCell: Object.fromEntries(cells.map(cell => [cell.id, cell.targetHex])), acceptedAlternativeLayouts: [] },
    tutorialText: '先点色块，再点空格',
    challenge: { mode: number <= 4 ? 'none' : 'moves', minimumMoves: 4, minimumMovesMetric: 'tray-to-empty-board-placements', moveBudget: number <= 4 ? null : 8, revive: { maxPerAttempt: number <= 4 ? 0 : 2, addMoves: number <= 4 ? 0 : 5 } },
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
const back = (state, cell) => act(state, { type: 'returnToTray', fromCellId: cell });
const begin = (state, requestId, rewardType = 'revive', prop) => act(state, { type: 'beginReward', requestId, rewardType, prop });
const settle = (state, requestId, outcome = 'completed') => act(state, { type: 'settleReward', requestId, outcome });
const emptyMovable = state => state.level.cells.filter(cell => !isLocked(state, cell.id) && state.attempt.board[cell.id] === null);
function fail(state) {
  while (state.attempt.status === 'Playing') {
    // Free recovery creates space; repeatedly making a wrong placement consumes the finite budget.
    const filled = state.level.cells.find(cell => !isLocked(state, cell.id) && state.attempt.board[cell.id] !== null);
    if (filled) state = back(state, filled.id);
    let pair;
    for (const cell of emptyMovable(state)) {
      const index = state.attempt.pool.findIndex(id => id && state.level.tiles.find(tile => tile.id === id).hex !== cell.targetHex);
      if (index >= 0) { pair = [index, cell.id]; break; }
    }
    assert.ok(pair, 'failure fixture requires a wrong placement');
    state = place(state, ...pair);
  }
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

test('all 100 click-fill levels use only tray placement witnesses and win within their actual budgets', () => {
  const pack = JSON.parse(readFileSync(new URL('../../data/levels/levels.v0.4.json', import.meta.url), 'utf8'));
  assert.equal(pack.schemaVersion, '3.0.0');
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
      state = place(state, step.fromPoolIndex, step.toCellId);
      state = restoreGame(definition, copy(state));
      actions++;
    }
    assert.equal(state.attempt.status, 'Won', raw.id);
    assert.equal(isSolved(state.level, state.attempt.board, state.attempt.pool), true, raw.id);
    assert.ok(state.attempt.remainingMoves === null || state.attempt.remainingMoves >= 0, raw.id);
  }
  assert.ok(actions > 1500);
});

test('all tutorial levels start empty apart from anchors with unlimited placement and move accounting', () => {
  for (let number = 1; number <= 4; number++) {
    const state = solve(game(number));
    assert.equal(state.attempt.remainingMoves, null);
    assert.equal(state.attempt.movesSpent, 4);
    assert.equal(state.attempt.status, 'Won');
  }
});

test('placing a selected tray tile is immutable, costs one and leaves a permanent empty home slot', () => {
  const before = game();
  const json = JSON.stringify(before);
  const state = place(before, 1, 'c2');
  assert.equal(JSON.stringify(before), json);
  assert.deepEqual(state.attempt.pool, ['t3', null, 't4', 't2']);
  assert.equal(state.attempt.board.c2, 't1');
  assert.equal(state.attempt.remainingMoves, 7);
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

test('moving a placed tile into another empty cell costs exactly one without filling its tray slot', () => {
  let state = place(game(), 0, 'c1');
  state = act(state, { type: 'move', fromCellId: 'c1', toCellId: 'c3' });
  assert.equal(state.attempt.board.c1, null);
  assert.equal(state.attempt.board.c3, 't3');
  assert.equal(state.attempt.pool[0], null);
  assert.equal(state.attempt.remainingMoves, 6);
  assert.equal(state.attempt.movesSpent, 2);
  const occupied = place(state, 1, 'c1');
  deny(occupied, { type: 'move', fromCellId: 'c3', toCellId: 'c1' });
});

test('return to tray restores only the tile own home, is free, and never refunds earlier spent moves', () => {
  let state = place(game(), 2, 'c2');
  state = back(state, 'c2');
  assert.deepEqual(state.attempt.pool, state.level.initialPool);
  assert.equal(state.attempt.board.c2, null);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.remainingMoves, 7);
  assert.equal(state.attempt.undoStack[1].kind, 'returnToTray');
  state = act(state, { type: 'undo' });
  assert.equal(state.attempt.board.c2, 't4');
  assert.equal(state.attempt.pool[2], null);
  assert.equal(state.attempt.remainingMoves, 7);
});

test('undo restores place/move board and stable tray holes without refunding steps', () => {
  const before = game();
  let state = place(before, 0, 'c1');
  state = act(state, { type: 'move', fromCellId: 'c1', toCellId: 'c2' });
  state = act(state, { type: 'undo' });
  assert.equal(state.attempt.board.c1, 't3');
  assert.equal(state.attempt.board.c2, null);
  state = act(state, { type: 'undo' });
  assert.deepEqual(state.attempt.board, before.attempt.board);
  assert.deepEqual(state.attempt.pool, before.attempt.pool);
  assert.equal(state.attempt.remainingMoves, 6);
  assert.equal(state.attempt.movesSpent, 2);
  deny(state, { type: 'undo' });
});

test('a last-step solution wins before failure and requires a full correct board plus an empty tray', () => {
  const definition = level();
  definition.challenge.moveBudget = 4;
  let state = createGame(definition, 'last-move');
  let events = [];
  for (const [index, cell] of [[1, 'c1'], [3, 'c2'], [0, 'c3'], [2, 'c4']]) {
    const result = reduceGame(state, { type: 'place', poolIndex: index, toCellId: cell });
    state = result.state;
    events.push(...result.events);
  }
  assert.equal(state.attempt.remainingMoves, 0);
  assert.equal(state.attempt.status, 'Won');
  assert.deepEqual(events.map(event => event.type), ['won']);
  assert.equal(isSolved(definition, state.attempt.board, ['t3', null, null, null]), false);
  deny(state, { type: 'undo' });
});

test('a full incorrect board remains adjustable while steps remain rather than causing immediate failure', () => {
  let state = game();
  for (const [index, cell] of [[0, 'c1'], [1, 'c2'], [2, 'c3'], [3, 'c4']]) state = place(state, index, cell);
  assert.equal(state.attempt.status, 'Playing');
  assert.ok(state.attempt.pool.every(id => id === null));
  state = back(state, 'c1');
  assert.equal(state.attempt.remainingMoves, 4);
  assert.equal(state.attempt.status, 'Playing');
});

test('failure freezes placement, move, free return, undo and all props until a permitted revival', () => {
  const state = fail(game());
  for (const action of [{ type: 'place', poolIndex: 0, toCellId: 'c2' }, { type: 'move', fromCellId: 'c1', toCellId: 'c2' },
    { type: 'returnToTray', fromCellId: 'c1' }, { type: 'undo' }, { type: 'locate' }, { type: 'peek', pathId: 'p1', nowMs: 10 }, { type: 'addMoves' }]) deny(state, action);
});

test('locate from tray into empty cell is free, locks the target and undo restores tray without refunding inventory', () => {
  const before = game();
  let state = act(before, { type: 'locate' });
  assert.equal(state.attempt.board.c1, 't1');
  assert.equal(state.attempt.pool[1], null);
  assert.deepEqual(state.attempt.auxiliaryLocks, ['c1']);
  assert.equal(state.attempt.remainingMoves, 8);
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
  assert.equal(state.attempt.remainingMoves, before.attempt.remainingMoves);
  assert.equal(state.attempt.movesSpent, 1);
});

test('locate from another board cell leaves its source empty and returns displaced target tile to home', () => {
  let before = place(game(), 1, 'c2');
  before = place(before, 2, 'c1');
  const state = act(before, { type: 'locate' });
  assert.equal(state.attempt.board.c1, 't1');
  assert.equal(state.attempt.board.c2, null);
  assert.deepEqual(state.attempt.pool, ['t3', null, 't4', 't2']);
  assert.equal(state.attempt.remainingMoves, 6);
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

test('addMoves adds five at most twice only while playing and does not reset moves already spent', () => {
  let state = place(game(), 0, 'c1');
  state = act(state, { type: 'addMoves' });
  state = act(state, { type: 'addMoves' });
  assert.equal(state.attempt.remainingMoves, 17);
  assert.equal(state.attempt.movesSpent, 1);
  assert.equal(state.attempt.totalMovesGranted, 10);
  deny(state, { type: 'addMoves' });
  deny(game(1), { type: 'addMoves' });
  const empty = createGame(level(), 'no-inventory');
  for (const action of [{ type: 'locate' }, { type: 'peek', pathId: 'p1', nowMs: 1 }, { type: 'addMoves' }]) deny(empty, action);
});

test('cancelled/failed reward videos restore failure, preserve board and consume no reward quota', () => {
  const failed = fail(game());
  let state = begin(failed, 'cancel-request');
  deny(state, { type: 'beginReward', requestId: 'double', rewardType: 'revive' });
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
  assert.equal(state.attempt.remainingMoves, 5);
  for (const key of ['board', 'pool', 'undoStack', 'auxiliaryLocks', 'movesSpent']) assert.deepEqual(state.attempt[key], failed[key]);
  deny(state, { type: 'settleReward', requestId: 'revive-1', outcome: 'completed' });
  state = settle(begin(fail(state), 'revive-2'), 'revive-2');
  state = fail(state);
  assert.equal(state.attempt.revivesUsed, 2);
  assert.equal(state.attempt.reviveAdsGranted, 2);
  deny(state, { type: 'beginReward', requestId: 'revive-3', rewardType: 'revive' });
});

test('restock has its own one-video quota, adds inventory rather than using a prop, and remains independent from revival', () => {
  let state = createGame(level(), 'restock-attempt');
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
  let state = createGame(level(), 'limit', { locate: 2, peek: 0, addMoves: 0 });
  for (let i = 0; i < 2; i++) { state = act(state, { type: 'locate' }); state = act(state, { type: 'undo' }); }
  deny(state, { type: 'beginReward', requestId: 'limit-hit', rewardType: 'restock', prop: 'locate' });
});

test('restart restores empty rail and seeded tray/budget while preserving inventory and durable rewards', () => {
  const before = act(game(), { type: 'locate' });
  const state = act(before, { type: 'restart', attemptId: 'new-attempt' });
  assert.notEqual(state.attempt.id, before.attempt.id);
  assert.deepEqual(state.attempt.board, { ...state.level.initialBoard });
  assert.deepEqual(state.attempt.pool, state.level.initialPool);
  assert.equal(state.attempt.remainingMoves, state.level.challenge.moveBudget);
  assert.deepEqual(state.wallet, before.wallet);
  assert.deepEqual(state.attempt.propUses, { locate: 0, peek: 0, addMoves: 0 });
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
  assert.equal(state.attempt.remainingMoves, before.remainingMoves);
  assert.equal(state.wallet.pendingRevives.length, 1);
  deny(state, { type: 'applyPendingRevive', requestId: 'late-revival' });
  state = act(fail(state), { type: 'applyPendingRevive', requestId: 'late-revival' });
  assert.equal(state.attempt.remainingMoves, 5);
  assert.equal(state.attempt.revivesUsed, 1);
  assert.equal(state.attempt.reviveAdsGranted, 0);
  assert.equal(state.wallet.pendingRevives.length, 0);
  deny(state, { type: 'applyPendingRevive', requestId: 'late-revival' });
  deny(state, { type: 'settleReward', requestId: 'late-revival', outcome: 'completed' });
});

test('late restock credits inventory without mutating a new level board, tray or quota', () => {
  let state = createGame(level(), 'origin');
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

test('strict restoration rejects legacy rules, moved anchors, tray compaction, duplicate tiles, bad budgets and legacy history', () => {
  for (const mutate of [
    raw => { delete raw.rulesVersion; },
    raw => { raw.rulesVersion = 'legacy'; },
    raw => { raw.levelContentVersion = '0.3.0-candidate'; },
    raw => { raw.board.c0 = null; raw.pool[0] = 't0'; },
    raw => { raw.pool.reverse(); },
    raw => { raw.pool.pop(); },
    raw => { raw.board.c2 = raw.pool[1]; },
    raw => { raw.remainingMoves++; },
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
    raw => { raw.challenge.moveBudget = 3; },
    raw => { raw.trayHomeByTile.t3 = 1; },
    raw => { raw.initialBoard.c1 = raw.initialPool.shift(); },
    raw => { raw.cells[1].targetHex = '#000000'; },
    raw => { raw.paths[0].cellIds.push('missing'); },
    raw => { raw.solution.acceptedAlternativeLayouts.push({}); },
    raw => { raw.challenge.mode = 'none'; },
  ]) {
    const raw = rawLevel(); mutate(raw); assert.throws(() => adaptLevel(raw));
  }
});

test('win comparison accepts equivalent colour instances while preserving one tile in each stable home', () => {
  const raw = rawLevel();
  raw.tiles[2].hex = raw.tiles[1].hex;
  raw.cells[2].targetHex = raw.cells[1].targetHex;
  raw.solution.targetByCell.c2 = raw.cells[1].targetHex;
  let state = createGame(adaptLevel(raw), 'same-colour');
  for (const [index, cell] of [[3, 'c1'], [1, 'c2'], [0, 'c3'], [2, 'c4']]) state = place(state, index, cell);
  assert.equal(state.attempt.status, 'Won');
});
