import { sys } from 'cc';
import { emptyProgress, ProgressSave, SAVE_KEY } from '../application/Progress';
import { LevelDefinition, recoverInterruptedGame, reduceGame } from '../core';
import { restoreProgress } from '../application/RestoreProgress';
import { SnapshotStore, StorageBackend } from './SnapshotStore';

export class LocalSave {
  error = '';
  private snapshots: SnapshotStore<ProgressSave> | null = null;

  constructor(private readonly backend: StorageBackend = sys.localStorage) {}

  load(contentVersion: string, levels: LevelDefinition[]): ProgressSave {
    this.snapshots = new SnapshotStore(this.backend, SAVE_KEY, input =>
      restoreProgress(input, contentVersion, levels, `restored-${Date.now()}-${++this.recoveryId}`));
    const latest = this.snapshots.load();
    this.error = this.snapshots.error;
    if (latest.value) return this.recoverColdStart(latest.value);
    // Earlier development snapshots contribute only validated global data, never old board rules.
    for (const key of ['shisezhijian.progress.v1', 'shisezhijian.progress.v1.backup']) {
      try {
        const value = this.backend.getItem(key);
        if (!value) continue;
        const parsed = restoreProgress(JSON.parse(value), contentVersion, levels,
          `restored-${Date.now()}-${++this.recoveryId}`);
        return this.recoverColdStart(parsed);
      } catch { this.error = '本地存档暂时不可用'; }
    }
    return emptyProgress(contentVersion);
  }

  private recoveryId = 0;

  private recoverColdStart(save: ProgressSave): ProgressSave {
    if (!save.game) return save;
    save.game = recoverInterruptedGame(save.game);
    // A cold-started process has no surviving SDK instance to resolve the old callback. Release
    // only unconfirmed requests so they cannot permanently block all future videos. Confirmed
    // grants and deferred revival entitlements remain exactly as saved; no reward is invented.
    for (const request of Object.values(save.game.wallet.rewardLedger)) {
      if (request.status === 'pending') {
        save.game = reduceGame(save.game, { type: 'settleReward', requestId: request.id, outcome: 'failed' }).state;
      }
    }
    return save;
  }

  write(save: ProgressSave): boolean {
    if (!this.snapshots) {
      this.error = '本地存档尚未读取，本次进度尚未保存';
      return false;
    }
    const saved = this.snapshots.write(save);
    this.error = this.snapshots.error;
    return saved;
  }
}
