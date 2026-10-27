/** Synchronous storage shared by Cocos localStorage, tt storage and the test backend. */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Snapshot<T> { key: string; revision: number; value: T; encoded: string; }
export interface SnapshotRead<T> {
  value: T | null;
  revision: number;
  warning: boolean;
  found: boolean;
}

/**
 * Two independently valid, monotonically versioned snapshots. An existing good copy is never
 * overwritten until a replacement has been written and read back byte-for-byte. The format is
 * an integrity/compatibility envelope, not an anti-cheat signature or a cloud save.
 */
export class SnapshotStore<T> {
  error = '';
  revision = 0;

  constructor(private readonly backend: StorageBackend, private readonly key: string,
    private readonly validate: (input: unknown) => T) {}

  private decode(key: string, encoded: string): Snapshot<T> {
    const raw = JSON.parse(encoded) as unknown;
    if (raw && typeof raw === 'object' && 'snapshotFormat' in raw) {
      const envelope = raw as Record<string, unknown>;
      if (envelope.snapshotFormat !== 1 || !Number.isSafeInteger(envelope.revision)
        || (envelope.revision as number) < 1 || !('payload' in envelope)) throw new Error('Invalid snapshot envelope');
      return { key, revision: envelope.revision as number, value: this.validate(envelope.payload), encoded };
    }
    // Earlier saves had a plain versioned progress payload, before the storage envelope existed.
    return { key, revision: 0, value: this.validate(raw), encoded };
  }

  private inspect(): { valid: Snapshot<T>[]; warning: boolean; found: boolean } {
    const valid: Snapshot<T>[] = [];
    let warning = false;
    let found = false;
    for (const key of [this.key, `${this.key}.backup`]) {
      try {
        const encoded = this.backend.getItem(key);
        if (encoded === null || encoded === '') continue;
        found = true;
        valid.push(this.decode(key, encoded));
      } catch { warning = true; }
    }
    valid.sort((a, b) => b.revision - a.revision || Number(a.key.endsWith('.backup')) - Number(b.key.endsWith('.backup')));
    return { valid, warning, found };
  }

  load(): SnapshotRead<T> {
    const inspected = this.inspect();
    const latest = inspected.valid[0];
    this.revision = latest?.revision ?? 0;
    this.error = inspected.warning ? '部分本地存档不可用，已尝试恢复有效副本' : '';
    return { value: latest?.value ?? null, revision: this.revision,
      warning: inspected.warning, found: inspected.found };
  }

  write(value: T): boolean {
    try {
      const inspected = this.inspect();
      const nextRevision = Math.max(this.revision, ...inspected.valid.map(snapshot => snapshot.revision)) + 1;
      if (!Number.isSafeInteger(nextRevision)) throw new Error('Snapshot revision exhausted');
      const encoded = JSON.stringify({ snapshotFormat: 1, revision: nextRevision, payload: value });
      this.decode(this.key, encoded); // Never overwrite good storage with unserialisable/invalid state.
      const latestKey = inspected.valid[0]?.key;
      // Write the older, invalid or absent slot first, preserving the newest legal previous save.
      const firstKey = latestKey === this.key ? `${this.key}.backup` : this.key;
      const secondKey = firstKey === this.key ? `${this.key}.backup` : this.key;
      let committed = 0;
      for (const key of [firstKey, secondKey]) {
        if (key === latestKey && !committed) continue;
        try {
          this.backend.setItem(key, encoded);
          const readback = this.backend.getItem(key);
          if (readback !== encoded) throw new Error('Snapshot readback mismatch');
          this.decode(key, readback);
          committed++;
        } catch {
          // Keep the newest old copy if no replacement has been verified. With empty storage,
          // trying the other slot is safe; after a verified write, mirroring is also safe.
        }
      }
      if (!committed) throw new Error('No new snapshot verified');
      this.revision = nextRevision;
      this.error = committed < 2 ? '进度已保存，备用存档暂时不可写' : '';
      return true;
    } catch {
      this.error = '本地空间不足或存储不可用，本次进度尚未保存';
      return false;
    }
  }
}
