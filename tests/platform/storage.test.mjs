import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const build = process.env.SHISE_PLATFORM_BUILD;
const { SnapshotStore } = require(join(build, 'platform/SnapshotStore.js'));
const { LocalSave } = require(join(build, 'platform/LocalSave.js'));
const { emptyProgress, SAVE_KEY } = require(join(build, 'application/Progress.js'));
const { adaptLevel, createGame, reduceGame } = require(join(build, 'core/index.js'));
const { restoreProgress } = require(join(build, 'application/RestoreProgress.js'));
const pack = JSON.parse(readFileSync(new URL('../../data/levels/levels.v0.4.json', import.meta.url), 'utf8'));
const levels = pack.levels.map(adaptLevel);
const version = pack.contentVersion;
const clone = input => JSON.parse(JSON.stringify(input));
const envelope = (payload, revision) => JSON.stringify({ snapshotFormat: 1, revision, payload });
const backup = `${SAVE_KEY}.backup`;

class MemoryStorage {
  values = new Map();
  failWrites = new Set();
  silentlyCorrupt = new Set();
  failReads = new Set();
  getItem(key) {
    if (this.failReads.has(key)) throw new Error('read unavailable');
    return this.values.get(key) ?? null;
  }
  setItem(key, value) {
    if (this.failWrites.has(key)) throw new Error('storage full');
    this.values.set(key, this.silentlyCorrupt.has(key) ? '{truncated' : value);
  }
}

function earned() {
  const save = emptyProgress(version);
  save.completed = levels.slice(0, 4).map(level => level.id);
  save.starterGranted = true;
  save.game = createGame(levels[4], 'played', { locate: 7, peek: 4, addMoves: 2 });
  return save;
}
function store(memory) {
  let sequence = 0;
  return new SnapshotStore(memory, SAVE_KEY, raw => restoreProgress(raw, version, levels, `recovery-${++sequence}`));
}

test('verified main and backup share one atomic envelope and revisions increase across reloads', () => {
  const memory = new MemoryStorage();
  let disk = store(memory);
  const save = earned();
  assert.equal(disk.write(save), true);
  assert.equal(memory.values.get(SAVE_KEY), memory.values.get(backup));
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).revision, 1);
  disk = store(memory);
  assert.deepEqual(disk.load().value, save);
  save.settings.sound = false;
  assert.equal(disk.write(save), true);
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).revision, 2);
  assert.equal(store(memory).load().value.settings.sound, false);
});

test('newer valid backup wins over an older valid primary', () => {
  const memory = new MemoryStorage();
  const older = earned(), newer = earned();
  newer.game.wallet.inventory.peek = 8;
  memory.values.set(SAVE_KEY, envelope(older, 3));
  memory.values.set(backup, envelope(newer, 4));
  const result = store(memory).load();
  assert.equal(result.revision, 4);
  assert.equal(result.value.game.wallet.inventory.peek, 8);
});

test('a newer broken wallet never hides or overwrites an older legal backup', () => {
  const memory = new MemoryStorage();
  const legal = earned(), broken = earned();
  broken.game.wallet.inventory.locate = -1;
  memory.values.set(SAVE_KEY, envelope(broken, 99));
  memory.values.set(backup, envelope(legal, 4));
  const disk = store(memory);
  assert.equal(disk.load().revision, 4);
  assert.equal(disk.load().value.game.wallet.inventory.locate, 7);
  assert.equal(disk.write(legal), true);
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).revision, 5);
});

test('a blocked primary can still commit a verified backup while reporting degraded redundancy', () => {
  const memory = new MemoryStorage();
  const legal = earned();
  memory.values.set(SAVE_KEY, envelope(legal, 1));
  memory.values.set(backup, envelope(legal, 1));
  memory.failWrites.add(SAVE_KEY);
  const updated = clone(legal); updated.settings.sound = false;
  const disk = store(memory);
  assert.equal(disk.write(updated), true);
  assert.match(disk.error, /已保存/);
  assert.equal(store(memory).load().value.settings.sound, false);
  assert.equal(store(memory).load().revision, 2);
});

test('failed repair of a bad primary preserves the only valid backup and explicitly fails saving', () => {
  const memory = new MemoryStorage();
  const legal = earned();
  memory.values.set(SAVE_KEY, '{broken');
  memory.values.set(backup, envelope(legal, 7));
  const untouched = memory.values.get(backup);
  memory.silentlyCorrupt.add(SAVE_KEY);
  const updated = clone(legal); updated.game.wallet.inventory.peek++;
  const disk = store(memory);
  assert.equal(disk.write(updated), false);
  assert.match(disk.error, /尚未保存/);
  assert.equal(memory.values.get(backup), untouched);
  assert.equal(store(memory).load().value.game.wallet.inventory.peek, 4);
});

test('failed backup write cannot overwrite the only valid primary without a verified replacement', () => {
  const memory = new MemoryStorage();
  memory.values.set(SAVE_KEY, envelope(earned(), 5));
  const untouched = memory.values.get(SAVE_KEY);
  memory.failWrites.add(backup);
  const disk = store(memory);
  assert.equal(disk.write(emptyProgress(version)), false);
  assert.equal(memory.values.get(SAVE_KEY), untouched);
});

test('silent write/readback mismatch is detected, and a good second slot is permitted for fresh storage', () => {
  const memory = new MemoryStorage();
  memory.silentlyCorrupt.add(SAVE_KEY);
  const disk = store(memory);
  assert.equal(disk.write(earned()), true);
  assert.match(disk.error, /备用/);
  assert.equal(store(memory).load().value.game.wallet.inventory.locate, 7);
});

test('invalid new payload never overwrites either verified previous snapshot', () => {
  const memory = new MemoryStorage();
  const disk = store(memory);
  assert.equal(disk.write(earned()), true);
  const before = [...memory.values];
  const invalid = earned(); invalid.game.wallet.inventory.peek = -5;
  assert.equal(disk.write(invalid), false);
  assert.deepEqual([...memory.values], before);
});

test('confirmed reward ledger and inventory survive together when mirroring fails after commit', () => {
  const memory = new MemoryStorage();
  const disk = store(memory);
  const save = earned();
  assert.equal(disk.write(save), true);
  save.game.wallet.inventory.peek++;
  save.game.wallet.rewardLedger.reward = { id: 'reward', attemptId: 'old-attempt', levelId: 'L005',
    levelContentVersion: version, rewardType: 'restock', amount: 1, prop: 'peek', status: 'granted' };
  memory.failWrites.add(SAVE_KEY);
  assert.equal(disk.write(save), true);
  const restored = store(memory).load().value;
  assert.equal(restored.game.wallet.inventory.peek, 5);
  assert.equal(restored.game.wallet.rewardLedger.reward.status, 'granted');
  assert.equal(restored.starterGranted, true);
});

test('plain current saves migrate to revisioned envelopes without losing progress or settings', () => {
  const memory = new MemoryStorage();
  const save = earned(); save.settings.haptics = false;
  memory.values.set(SAVE_KEY, JSON.stringify(save));
  const disk = store(memory);
  assert.equal(disk.load().revision, 0);
  assert.deepEqual(disk.load().value, save);
  assert.equal(disk.write(save), true);
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).snapshotFormat, 1);
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).revision, 1);
});

test('LocalSave migrates legacy global inventory and grants while discarding obsolete board rules', () => {
  const memory = new MemoryStorage();
  const save = earned();
  save.version = 1;
  delete save.settings;
  delete save.game.attempt.rulesVersion;
  memory.values.set('shisezhijian.progress.v1', JSON.stringify(save));
  const local = new LocalSave(memory);
  const restored = local.load(version, levels);
  assert.equal(restored.game.wallet.inventory.locate, 7);
  assert.equal(restored.starterGranted, true);
  assert.deepEqual(restored.settings, { sound: true, haptics: true, reducedMotion: false });
  assert.notEqual(restored.game.attempt.id, 'played');
  assert.equal(local.write(restored), true);
  assert.equal(JSON.parse(memory.values.get(SAVE_KEY)).payload.starterGranted, true);
});

test('LocalSave chooses newest legal copy and retains earned rewards', () => {
  const memory = new MemoryStorage();
  const save = earned();
  save.game.wallet.rewardLedger.confirmed = { id: 'confirmed', attemptId: 'old-attempt', levelId: 'L005',
    levelContentVersion: version, rewardType: 'restock', amount: 1, prop: 'peek', status: 'granted' };
  const newer = clone(save); newer.game.wallet.inventory.peek++;
  memory.values.set(SAVE_KEY, envelope(save, 2));
  memory.values.set(backup, envelope(newer, 3));
  const restored = new LocalSave(memory).load(version, levels);
  assert.equal(restored.game.wallet.inventory.peek, 5);
  assert.equal(restored.game.wallet.rewardLedger.confirmed.status, 'granted');
});

test('cold startup releases abandoned unconfirmed video requests without consuming rewards or blocking a new request', () => {
  const memory = new MemoryStorage();
  const save = earned();
  save.game.wallet.inventory.peek = 0;
  save.game.wallet.rewardLedger.confirmedRevive = { id: 'confirmedRevive', attemptId: 'old-attempt', levelId: 'L005',
    levelContentVersion: version, rewardType: 'revive', amount: 5, prop: null, status: 'granted' };
  save.game.wallet.pendingRevives = [{ requestId: 'confirmedRevive', originAttemptId: 'old-attempt', amount: 5 }];
  save.game = reduceGame(save.game, { type: 'beginReward', requestId: 'interrupted', rewardType: 'restock', prop: 'peek' }).state;
  assert.equal(save.game.attempt.status, 'AdPending');
  memory.values.set(SAVE_KEY, envelope(save, 8));
  const restored = new LocalSave(memory).load(version, levels);
  assert.equal(restored.game.attempt.status, 'Playing');
  assert.equal(restored.game.wallet.rewardLedger.interrupted.status, 'failed');
  assert.equal(restored.game.wallet.rewardLedger.confirmedRevive.status, 'granted');
  assert.deepEqual(restored.game.wallet.pendingRevives, save.game.wallet.pendingRevives);
  assert.equal(restored.game.wallet.inventory.peek, 0);
  assert.equal(restored.game.attempt.propRestockAdsGranted, 0);
  assert.equal(restored.game.attempt.revivesUsed, 0);
  const retry = reduceGame(restored.game, { type: 'beginReward', requestId: 'after-relaunch', rewardType: 'restock', prop: 'peek' });
  assert.equal(retry.changed, true, retry.reason);
  assert.equal(retry.state.attempt.status, 'AdPending');
});

test('both unavailable storage and writing before loading are explicit failures', () => {
  const memory = new MemoryStorage();
  const local = new LocalSave(memory);
  assert.equal(local.write(earned()), false);
  assert.match(local.error, /尚未读取/);
  memory.failReads.add(SAVE_KEY); memory.failReads.add(backup);
  local.load(version, levels);
  memory.failWrites.add(SAVE_KEY); memory.failWrites.add(backup);
  assert.equal(local.write(earned()), false);
  assert.match(local.error, /尚未保存/);
});
