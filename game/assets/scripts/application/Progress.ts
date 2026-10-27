import type { GameState } from '../core';

export interface PlayerSettings {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}

export function defaultSettings(): PlayerSettings {
  return { sound: true, haptics: true, reducedMotion: false };
}

export interface ProgressSave {
  version: 2;
  gameplayMode: 'click-fill';
  inputMode: 'tap';
  contentVersion: string;
  completed: string[];
  starterGranted: boolean;
  chapterGifts: number[];
  settings: PlayerSettings;
  game: GameState | null;
}

export const SAVE_KEY = 'shisezhijian.click-fill.progress.v2';

export function emptyProgress(contentVersion: string): ProgressSave {
  return { version: 2, gameplayMode: 'click-fill', inputMode: 'tap', contentVersion,
    completed: [], starterGranted: false, chapterGifts: [], settings: defaultSettings(), game: null };
}

/** Progress has no engine dependency; the storage adapter decides where it is written. */
export function completeLevel(save: ProgressSave, allIds: string[]): void {
  if (!save.game || save.game.attempt.status !== 'Won') return;
  const id = save.game.level.id;
  if (!save.completed.includes(id)) save.completed.push(id);
  if (id === 'L004' && !save.starterGranted) {
    save.game.wallet.inventory.locate += 3;
    save.game.wallet.inventory.peek += 2;
    save.game.wallet.inventory.addMoves += 1;
    save.starterGranted = true;
  }
  for (let chapter = 1; chapter <= 5; chapter++) {
    const ids = allIds.slice((chapter - 1) * 20, chapter * 20);
    if (ids.length === 20 && ids.every(levelId => save.completed.includes(levelId))
      && !save.chapterGifts.includes(chapter)) {
      save.game.wallet.inventory.locate++;
      save.game.wallet.inventory.peek++;
      save.game.wallet.inventory.addMoves++;
      save.chapterGifts.push(chapter);
    }
  }
}

export function unlockedThrough(save: ProgressSave, allIds: string[]): number {
  const firstUnfinished = allIds.findIndex(id => !save.completed.includes(id));
  return firstUnfinished < 0 ? allIds.length - 1 : firstUnfinished;
}
