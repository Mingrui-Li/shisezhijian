import { createGame, GameState, LevelDefinition, restoreGame, restoreWallet } from '../core';
import { defaultSettings, PlayerSettings, ProgressSave, unlockedThrough } from './Progress';

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as Record<string, unknown>;
}

/** Settings damage cannot erase otherwise valid earned progress or inventory. */
function restoreSettings(value: unknown): PlayerSettings {
  const defaults = defaultSettings();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const raw = value as Record<string, unknown>;
  return {
    sound: typeof raw.sound === 'boolean' ? raw.sound : defaults.sound,
    haptics: typeof raw.haptics === 'boolean' ? raw.haptics : defaults.haptics,
    reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : defaults.reducedMotion,
  };
}

/**
 * Extracts global player rights from supported save envelopes and binds them to current content.
 * The old attempt is never interpreted using new rules. Invalid wallets throw so storage can try
 * another backup rather than silently replacing earned inventory or confirmed rewards with zero.
 */
export function restoreProgress(input: unknown, contentVersion: string,
    levels: LevelDefinition[], attemptId: string): ProgressSave {
  if (!levels.length || !contentVersion) throw new Error('Current content is required');
  const raw = record(input, 'progress');
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3) throw new Error('Unsupported progress version');
  if (typeof raw.contentVersion !== 'string' || !raw.contentVersion) throw new Error('Invalid saved content version');
  if (typeof raw.starterGranted !== 'boolean' || !Array.isArray(raw.completed) || !Array.isArray(raw.chapterGifts)) throw new Error('Invalid global progress');
  const allIds = levels.map(level => level.id);
  const ids = new Set(allIds);
  const completed = raw.completed as unknown[];
  const chapterGifts = raw.chapterGifts as unknown[];
  if (completed.some(id => typeof id !== 'string' || !ids.has(id)) || new Set(completed).size !== completed.length) throw new Error('Invalid completed levels');
  if (chapterGifts.some(chapter => typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > 5)
      || new Set(chapterGifts).size !== chapterGifts.length) throw new Error('Invalid chapter gift markers');
  const save: ProgressSave = {
    version: 3, gameplayMode: 'click-fill', inputMode: 'tap', contentVersion,
    completed: [...completed] as string[], starterGranted: raw.starterGranted,
    chapterGifts: [...chapterGifts] as number[], settings: restoreSettings(raw.settings), game: null,
  };
  if (raw.game === null) {
    // A pristine save has no wallet yet. A played save without one cannot be reconstructed safely.
    if (save.completed.length || save.starterGranted || save.chapterGifts.length) throw new Error('Played progress is missing its wallet');
    return save;
  }
  const rawGame = record(raw.game, 'saved game');
  const unlocked = unlockedThrough(save, allIds);
  const savedLevelId = rawGame.level && typeof rawGame.level === 'object'
    ? (rawGame.level as Record<string, unknown>).id : undefined;
  const savedIndex = levels.findIndex(level => level.id === savedLevelId);
  const level = levels[savedIndex >= 0 && savedIndex <= unlocked ? savedIndex : unlocked];
  const fresh = createGame(level, attemptId);
  // Validate the wallet independently of any damaged/obsolete board or attempt metadata.
  const wallet = restoreWallet(rawGame.wallet, raw.version !== 3);
  const walletOnly = restoreGame(level, { ...fresh, wallet });
  let restored: GameState | null = null;
  if (savedLevelId === level.id) {
    try { restored = restoreGame(level, { ...rawGame, wallet }); } catch { /* Only the attempt is replaced below. */ }
  }
  if (restored) save.game = restored;
  else {
    const rawAttempt = rawGame.attempt;
    const oldAttemptId = rawAttempt && typeof rawAttempt === 'object'
      ? (rawAttempt as Record<string, unknown>).id : undefined;
    if (attemptId === oldAttemptId || Object.values(walletOnly.wallet.rewardLedger).some(request => request.attemptId === attemptId)) throw new Error('Replacement attempt ID must be fresh');
    save.game = walletOnly;
  }
  return save;
}
