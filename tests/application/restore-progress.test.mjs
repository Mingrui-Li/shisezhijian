import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = process.env.SHISE_APPLICATION_BUILD;
const { adaptLevel, createGame, reduceGame, RULES_VERSION } = require(join(build, 'core/index.js'));
const { emptyProgress, completeLevel } = require(join(build, 'application/Progress.js'));
const { restoreProgress } = require(join(build, 'application/RestoreProgress.js'));
const pack = JSON.parse(readFileSync(new URL('../../data/levels/levels.v0.4.json', import.meta.url), 'utf8'));
const levels = pack.levels.map(adaptLevel);
const allIds = levels.map(level => level.id);
const version = pack.contentVersion;
const clone = input => JSON.parse(JSON.stringify(input));
const restore = input => restoreProgress(input, version, levels, 'replacement-attempt');
function played(number = 5) {
  const save = emptyProgress(version);
  save.completed = allIds.slice(0, number - 1);
  save.starterGranted = number > 4;
  save.game = createGame(levels[number - 1], 'original-attempt', { locate: 7, peek: 4, addMoves: 2 });
  return save;
}
function win(save) {
  for (const step of pack.levels[save.game.level.number - 1].challenge.witnessSolution) {
    const result = reduceGame(save.game, { type: 'place', poolIndex: step.fromPoolIndex, toCellId: step.toCellId });
    assert.equal(result.changed, true, result.reason);
    save.game = result.state;
  }
  assert.equal(save.game.attempt.status, 'Won');
  return save;
}
function pendingWallet(save) {
  save.game.wallet.rewardLedger.confirmed = {
    id: 'confirmed', attemptId: 'before-restart', levelId: 'L005', levelContentVersion: 'old-content',
    rewardType: 'revive', amount: 5, prop: null, status: 'granted',
  };
  save.game.wallet.pendingRevives = [{ requestId: 'confirmed', originAttemptId: 'before-restart', amount: 5 }];
  save.game.wallet.rewardLedger.unconfirmed = {
    id: 'unconfirmed', attemptId: 'original-attempt', levelId: 'L005', levelContentVersion: 'old-content',
    rewardType: 'restock', amount: 1, prop: 'peek', status: 'pending',
  };
  return save;
}

test('pristine progress round-trips without inventing inventory, completion or gifts', () => {
  const save = emptyProgress(version);
  assert.deepEqual(restore(clone(save)), save);
});

test('a valid current attempt is resumed, rebound to accepted levels and leaves input unchanged', () => {
  const save = played();
  const step = pack.levels[4].challenge.witnessSolution[0];
  save.game = reduceGame(save.game, { type: 'place', poolIndex: step.fromPoolIndex, toCellId: step.toCellId }).state;
  const before = JSON.stringify(save);
  const result = restore(save);
  assert.equal(result.game.attempt.id, 'original-attempt');
  assert.strictEqual(result.game.level, levels[4]);
  assert.deepEqual(result.game.attempt, save.game.attempt);
  assert.equal(JSON.stringify(save), before);
});

test('a legacy version-1 attempt is replaced but all earned global and wallet rights survive', () => {
  const save = pendingWallet(played(21));
  save.version = 1;
  delete save.gameplayMode; delete save.inputMode;
  save.contentVersion = '0.3.0-candidate';
  save.chapterGifts = [1];
  delete save.game.attempt.rulesVersion;
  save.game.attempt.board = { obsolete: 'board' };
  const result = restore(clone(save));
  assert.equal(result.version, 2);
  assert.equal(result.gameplayMode, 'click-fill');
  assert.equal(result.inputMode, 'tap');
  assert.equal(result.contentVersion, version);
  assert.deepEqual(result.completed, save.completed);
  assert.equal(result.starterGranted, true);
  assert.deepEqual(result.chapterGifts, [1]);
  assert.deepEqual(result.game.wallet, save.game.wallet);
  assert.equal(result.game.attempt.id, 'replacement-attempt');
  assert.equal(result.game.attempt.rulesVersion, RULES_VERSION);
  assert.deepEqual(result.game.attempt.board, { ...levels[20].initialBoard });
  assert.deepEqual(result.game.attempt.pool, levels[20].initialPool);
});

test('cross-content saves retain completion, inventory and gift markers while recreating only an obsolete attempt', () => {
  const save = clone(played(21));
  save.chapterGifts = [1];
  save.contentVersion = 'prior-content';
  save.game.level.contentVersion = 'prior-content';
  save.game.attempt.levelContentVersion = 'prior-content';
  const result = restore(clone(save));
  assert.equal(result.game.attempt.id, 'replacement-attempt');
  assert.deepEqual(result.game.wallet.inventory, { locate: 7, peek: 4, addMoves: 2 });
  assert.deepEqual(result.completed, allIds.slice(0, 20));
  assert.equal(result.starterGranted, true);
  assert.deepEqual(result.chapterGifts, [1]);
  assert.equal(result.game.level.contentVersion, version);
});

test('a changed outer content version alone does not discard an otherwise compatible current attempt', () => {
  const save = played();
  save.contentVersion = 'old-envelope-version';
  assert.equal(restore(clone(save)).game.attempt.id, 'original-attempt');
});

test('damaged attempt metadata, layout, history or unknown level cannot erase valid global rights', () => {
  for (const mutate of [
    save => { save.game.attempt.board = {}; },
    save => { save.game.attempt.remainingMoves = -1; },
    save => { delete save.game.attempt; },
    save => { save.game.attempt.undoStack = [{ kind: 'unknown' }]; },
    save => { save.game.level.id = 'removed-level'; },
    save => { delete save.game.level; },
  ]) {
    const save = clone(played());
    mutate(save);
    const result = restore(save);
    assert.equal(result.game.attempt.id, 'replacement-attempt');
    assert.deepEqual(result.completed, allIds.slice(0, 4));
    assert.equal(result.starterGranted, true);
    assert.deepEqual(result.game.wallet.inventory, { locate: 7, peek: 4, addMoves: 2 });
    assert.equal(result.game.level.id, 'L005');
  }
});

test('a tampered locked future level is rebuilt at the first unfinished level', () => {
  const save = played();
  save.game = createGame(levels[99], 'future', save.game.wallet.inventory);
  const result = restore(save);
  assert.equal(result.game.level.id, 'L005');
  assert.equal(result.game.attempt.id, 'replacement-attempt');
});

test('invalid wallets always throw to permit backup fallback rather than silently zeroing earned inventory', () => {
  for (const mutate of [
    save => { delete save.game.wallet; },
    save => { save.game.wallet.inventory.locate = -1; },
    save => { save.game.wallet.inventory.peek = 0.5; },
    save => { delete save.game.wallet.inventory.addMoves; },
    save => { save.game.wallet.rewardLedger = { broken: {} }; },
    save => { save.game.wallet.pendingRevives = [{ requestId: 'missing', originAttemptId: 'origin', amount: 5 }]; },
    save => { save.game = null; },
  ]) {
    const save = clone(played()); mutate(save);
    assert.throws(() => restore(save));
  }
});

test('invalid global envelopes, level IDs and duplicate gift markers are rejected', () => {
  for (const mutate of [
    save => { save.version = 9; },
    save => { save.contentVersion = ''; },
    save => { save.completed.push('missing-level'); },
    save => { save.completed.push(save.completed[0]); },
    save => { save.starterGranted = 1; },
    save => { save.chapterGifts = [1, 1]; },
    save => { save.chapterGifts = [6]; },
  ]) {
    const save = clone(played()); mutate(save);
    assert.throws(() => restore(save));
  }
});

test('migrated starter and chapter markers prevent duplicate grants after replayed wins and repeated restoration', () => {
  const save = played(21);
  save.chapterGifts = [1];
  save.version = 1;
  delete save.game.attempt.rulesVersion;
  let result = restore(save);
  const inventory = clone(result.game.wallet.inventory);
  result.game = createGame(levels[3], 'replay-four', inventory);
  result = win(result);
  completeLevel(result, allIds);
  assert.deepEqual(result.game.wallet.inventory, inventory);
  completeLevel(result, allIds);
  assert.deepEqual(result.game.wallet.inventory, inventory);
  result = restore(clone(result));
  completeLevel(result, allIds);
  assert.deepEqual(result.game.wallet.inventory, inventory);
  assert.deepEqual(result.chapterGifts, [1]);
  assert.equal(result.starterGranted, true);
});

test('an unclaimed starter gift still grants exactly once after migration and legitimate level-four completion', () => {
  const save = played(4);
  save.starterGranted = false;
  save.version = 1;
  delete save.game.attempt.rulesVersion;
  const result = win(restore(clone(save)));
  const before = clone(result.game.wallet.inventory);
  completeLevel(result, allIds);
  assert.deepEqual(result.game.wallet.inventory, { locate: before.locate + 3, peek: before.peek + 2, addMoves: before.addMoves + 1 });
  const after = clone(result.game.wallet.inventory);
  completeLevel(result, allIds);
  assert.deepEqual(result.game.wallet.inventory, after);
  assert.equal(result.starterGranted, true);
});

test('replacement attempt IDs must not collide with discarded attempts or reward origins', () => {
  const save = pendingWallet(played());
  delete save.game.attempt.rulesVersion;
  for (const id of ['original-attempt', 'before-restart']) assert.throws(() => restoreProgress(clone(save), version, levels, id));
});

test('settings round-trip and absent legacy settings adopt gentle defaults without altering earned rights', () => {
  const save = played();
  save.settings = { sound: false, haptics: false, reducedMotion: true };
  assert.deepEqual(restore(clone(save)).settings, save.settings);
  delete save.settings;
  const result = restore(clone(save));
  assert.deepEqual(result.settings, { sound: true, haptics: true, reducedMotion: false });
  assert.deepEqual(result.game.wallet.inventory, { locate: 7, peek: 4, addMoves: 2 });
});

test('damaged settings reset only invalid fields without erasing inventory or gift markers', () => {
  const save = played(21);
  save.chapterGifts = [1];
  save.settings = { sound: 'invalid', haptics: false, reducedMotion: true };
  const result = restore(clone(save));
  assert.deepEqual(result.settings, { sound: true, haptics: false, reducedMotion: true });
  assert.deepEqual(result.game.wallet.inventory, { locate: 7, peek: 4, addMoves: 2 });
  assert.deepEqual(result.chapterGifts, [1]);
  assert.equal(result.starterGranted, true);
});
