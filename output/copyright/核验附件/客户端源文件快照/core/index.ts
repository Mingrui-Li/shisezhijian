/** Pure game rules. No Cocos, platform SDK, clock, randomness or storage dependencies. */
export const RULES_VERSION = 'click-fill-timed-flex-v3' as const;
export type Prop = 'locate' | 'peek' | 'addTime';
export type Inventory = Record<Prop, number>;
export type Board = Record<string, string | null>;
export type AttemptStatus = 'Playing' | 'Won' | 'Failed' | 'AdPending' | 'PreviewingReference';
export interface LevelDefinition {
  gameplayMode: 'click-fill';
  inputMode: 'tap';
  id: string;
  number: number;
  title: string;
  chapter: number;
  chapterName: string;
  contentVersion: string;
  /** Different puzzle designs only compare performance within the same scoring epoch. */
  scoreEpoch?: string;
  grid: { columns: number; rows: number };
  cells: { id: string; x: number; y: number; targetHex: string }[];
  paths: { id: string; cellIds: string[] }[];
  anchors: string[];
  tiles: { id: string; hex: string }[];
  initialBoard: Board;
  initialPool: string[];
  /** Authored initial slot indexes; movable tiles may occupy any empty tray slot at runtime. */
  trayHomeByTile: Record<string, number>;
  tutorialText: string;
  challenge: { mode: 'time'; timeLimitSeconds: number; revive: { maxPerAttempt: number; addSeconds: number } };
}
export interface UndoEntry {
  kind: 'place' | 'move' | 'returnToTray' | 'locate';
  board: Board;
  pool: (string | null)[];
  auxiliaryLocks: string[];
}
export interface Attempt {
  rulesVersion: typeof RULES_VERSION;
  id: string;
  levelId: string;
  levelContentVersion: string;
  revision: number;
  status: AttemptStatus;
  board: Board;
  pool: (string | null)[];
  auxiliaryLocks: string[];
  initialTimeMs: number;
  remainingTimeMs: number;
  elapsedMs: number;
  movesSpent: number;
  totalTimeGrantedMs: number;
  score: number | null;
  pointsEarned: number;
  undoStack: UndoEntry[];
  propUses: Inventory;
  revivesUsed: number;
  propRestockAdsGranted: number;
  reviveAdsGranted: number;
  pendingRewardRequestId: string | null;
  previousStatusBeforeAd: 'Playing' | 'Failed' | 'Won' | null;
  preview: { pathId: string; expiresAtMs: number } | null;
}
export interface RewardRequest {
  id: string;
  attemptId: string;
  levelId: string;
  levelContentVersion: string;
  rewardType: 'revive' | 'restock' | 'doubleScore';
  /** Double-score qualification belongs to the puzzle design that created the request. */
  scoreEpoch?: string;
  amount: number;
  prop: Prop | null;
  status: 'pending' | 'granted' | 'cancelled' | 'failed';
}
export interface PendingRevive {
  requestId: string;
  originAttemptId: string;
  amount: number;
}
export interface LevelScore {
  scoreEpoch?: string;
  bestScore: number;
  doubleScoreClaimed: boolean;
}
export interface Wallet {
  points: number;
  levelScores: Record<string, LevelScore>;
  inventory: Inventory;
  rewardLedger: Record<string, RewardRequest>;
  pendingRevives: PendingRevive[];
}
export interface GameState {
  level: LevelDefinition;
  attempt: Attempt;
  wallet: Wallet;
}
export type Action =
  | { type: 'place'; poolIndex: number; toCellId: string }
  | { type: 'move'; fromCellId: string; toCellId: string }
  | { type: 'returnToTray'; fromCellId: string; toPoolIndex?: number }
  | { type: 'undo' }
  | { type: 'locate' }
  | { type: 'peek'; pathId: string; nowMs: number }
  | { type: 'endPeek' }
  | { type: 'expirePeek'; nowMs: number }
  | { type: 'suspend' }
  | { type: 'addTime' }
  | { type: 'elapse'; deltaMs: number }
  | { type: 'purchaseProp'; prop: Prop }
  | { type: 'restart'; attemptId: string }
  | { type: 'beginReward'; requestId: string; rewardType: 'revive' | 'restock' | 'doubleScore'; prop?: Prop }
  /** The platform adapter must authenticate full viewing; this command is not an ad SDK. */
  | { type: 'settleReward'; requestId: string; outcome: 'completed' | 'cancelled' | 'failed' }
  | { type: 'applyPendingRevive'; requestId: string };
export type DomainEvent =
  | { type: 'won'; levelId: string; attemptId: string; score: number; pointsEarned: number }
  | { type: 'failed'; levelId: string; attemptId: string }
  | { type: 'rewardRequested'; requestId: string }
  | { type: 'rewardGranted'; requestId: string; deferred: boolean };
export interface Transition {
  state: GameState;
  changed: boolean;
  reason?: string;
  events: DomainEvent[];
}

export const DEFAULT_SCORE_EPOCH = 'base-v1';
export const PROP_LIMITS: Readonly<Inventory> = Object.freeze({ locate: 2, peek: 1, addTime: 2 });
export const PROP_PRICES: Readonly<Inventory> = Object.freeze({ locate: 120, peek: 80, addTime: 100 });
export const INITIAL_INVENTORY: Readonly<Inventory> = Object.freeze({ locate: 1, peek: 1, addTime: 1 });
export const STARTER_INVENTORY: Readonly<Inventory> = Object.freeze({ locate: 3, peek: 2, addTime: 1 });
const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);
const emptyInventory = (): Inventory => ({ locate: 0, peek: 0, addTime: 0 });
const hex = (value: unknown): string => {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid HEX colour');
  return value.toUpperCase();
};
const object = (value: unknown, name: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value as Record<string, unknown>;
};
const array = (value: unknown, name: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`Invalid ${name}`);
  return value;
};
const string = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Invalid ${name}`);
  return value;
};
const integer = (value: unknown, name: string, minimum = 0): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`Invalid ${name}`);
  return value;
};

/** Strict boundary adapter for the accepted candidate pack; it never repairs content. */
export function adaptLevel(input: unknown): LevelDefinition {
  const raw = object(input, 'level');
  if (raw.gameplayMode !== 'click-fill' || raw.inputMode !== 'tap') throw new Error('Only click-fill levels are supported');
  const grid = object(raw.grid, 'grid');
  const challenge = object(raw.challenge, 'challenge');
  const revive = object(challenge.revive, 'revive');
  const solution = object(raw.solution, 'solution');
  if (array(solution.acceptedAlternativeLayouts, 'alternative layouts').length !== 0) {
    throw new Error('Alternative answer layouts require an explicit adapter upgrade');
  }
  if (!['none', 'moves', 'time'].includes(challenge.mode as string)) throw new Error('Invalid challenge mode');
  const targetByCell = object(solution.targetByCell, 'targetByCell');
  const cells = array(raw.cells, 'cells').map(value => {
    const cell = object(value, 'cell');
    const id = string(cell.id, 'cell id');
    const targetHex = hex(cell.targetHex);
    if (hex(targetByCell[id]) !== targetHex) throw new Error('Cell and solution disagree');
    return { id, x: integer(cell.x, 'cell x'), y: integer(cell.y, 'cell y'), targetHex };
  });
  const tiles = array(raw.tiles, 'tiles').map(value => {
    const tile = object(value, 'tile');
    return { id: string(tile.id, 'tile id'), hex: hex(tile.hex) };
  });
  const paths = array(raw.paths, 'paths').map(value => {
    const path = object(value, 'path');
    return { id: string(path.id, 'path id'), cellIds: array(path.cellIds, 'path cells').map(v => string(v, 'path cell')) };
  });
  const initialBoardRaw = object(raw.initialBoard, 'initialBoard');
  const initialBoard: Board = Object.create(null) as Board;
  for (const cell of cells) {
    const value = initialBoardRaw[cell.id];
    initialBoard[cell.id] = value === null ? null : string(value, 'board tile');
  }
  const level: LevelDefinition = {
    gameplayMode: 'click-fill', inputMode: 'tap',
    id: string(raw.id, 'level id'), number: integer(raw.number, 'level number', 1),
    title: string(raw.title, 'level title'), chapter: integer(raw.chapter, 'chapter', 1),
    chapterName: string(raw.chapterName, 'chapterName'), contentVersion: string(raw.contentVersion, 'contentVersion'),
    scoreEpoch: raw.scoreEpoch === undefined ? DEFAULT_SCORE_EPOCH : string(raw.scoreEpoch, 'score epoch'),
    grid: { columns: integer(grid.columns, 'columns', 1), rows: integer(grid.rows, 'rows', 1) },
    cells, paths, anchors: array(raw.anchors, 'anchors').map(v => string(v, 'anchor')),
    tiles, initialBoard, initialPool: array(raw.initialPool, 'pool').map(v => string(v, 'pool tile')),
    trayHomeByTile: Object.fromEntries(Object.entries(object(raw.trayHomeByTile, 'trayHomeByTile')).map(([id, index]) => [id, integer(index, 'home slot')])),
    tutorialText: typeof raw.tutorialText === 'string' ? raw.tutorialText : '',
    challenge: {
      mode: 'time',
      timeLimitSeconds: challenge.mode === 'time' ? integer(challenge.timeLimitSeconds, 'time limit', 1)
        : defaultTimeLimitSeconds(integer(raw.number, 'number', 1), integer(raw.chapter, 'chapter', 1), array(raw.initialPool, 'pool').length),
      revive: { maxPerAttempt: 2, addSeconds: 30 },
    },
  };
  if (!cells.length || new Set(cells.map(c => c.id)).size !== cells.length) throw new Error('Duplicate or empty cells');
  if (new Set(cells.map(c => `${c.x}:${c.y}`)).size !== cells.length) throw new Error('Duplicate coordinates');
  if (cells.some(c => c.x >= level.grid.columns || c.y >= level.grid.rows)) throw new Error('Cell outside grid');
  if (new Set(tiles.map(t => t.id)).size !== tiles.length) throw new Error('Duplicate tile IDs');
  if (new Set(paths.map(p => p.id)).size !== paths.length) throw new Error('Duplicate path IDs');
  if (new Set(level.anchors).size !== level.anchors.length) throw new Error('Duplicate anchors');
  if (paths.some(p => !p.cellIds.length || p.cellIds.some(id => !own(initialBoard, id)))) throw new Error('Invalid path reference');
  if (Object.keys(initialBoardRaw).length !== cells.length || Object.keys(targetByCell).length !== cells.length) throw new Error('Unexpected board cell');
  if (level.anchors.some(id => !own(initialBoard, id))) throw new Error('Invalid anchor reference');
  const allTiles = [...Object.values(initialBoard), ...level.initialPool].filter((v): v is string => v !== null);
  const tileIds = new Set(tiles.map(t => t.id));
  if (allTiles.length !== tiles.length || new Set(allTiles).size !== tiles.length || allTiles.some(id => !tileIds.has(id))) {
    throw new Error('Initial tile conservation failed');
  }
  if (cells.length !== tiles.length) throw new Error('One tile per target cell required');
  const targets = cells.map(c => c.targetHex).sort();
  const colours = tiles.map(t => t.hex).sort();
  if (targets.some((colour, i) => colour !== colours[i])) throw new Error('Target colour multiset mismatch');
  if (level.anchors.some(id => colourAt(level, initialBoard, id) !== cells.find(c => c.id === id)!.targetHex)) {
    throw new Error('Initial anchor is not correct');
  }
  if (challenge.mode === 'time' && (revive.maxPerAttempt !== 2 || revive.addSeconds !== 30)) throw new Error('Invalid timed revival policy');
  if (cells.some(cell => !level.anchors.includes(cell.id) && initialBoard[cell.id] !== null)) throw new Error('Only anchor tiles may be prefilled');
  const movableCount = cells.length - level.anchors.length;
  if (movableCount < 1 || level.initialPool.length !== movableCount) throw new Error('All movable tiles must start in the tray');
  if (Object.keys(level.trayHomeByTile).length !== movableCount || level.initialPool.some((id, index) => level.trayHomeByTile[id] !== index)) throw new Error('Invalid permanent tray homes');
  if (challenge.minimumMovesMetric !== 'tray-to-empty-board-placements' || challenge.minimumMoves !== movableCount) throw new Error('Invalid minimum placement metric');
  if (level.challenge.timeLimitSeconds < 45 || level.challenge.timeLimitSeconds > 240) throw new Error('Time limit outside supported range');
  return level;
}

function colourAt(level: LevelDefinition, board: Board, cellId: string): string | null {
  const tileId = board[cellId];
  return tileId == null ? null : level.tiles.find(tile => tile.id === tileId)?.hex ?? null;
}
export function isSolved(level: LevelDefinition, board: Board, pool: (string | null)[]): boolean {
  return pool.length === level.initialPool.length && pool.every(id => id === null)
    && level.cells.every(cell => colourAt(level, board, cell.id) === cell.targetHex);
}
export function isLocked(state: GameState, cellId: string): boolean {
  return state.level.anchors.includes(cellId) || state.attempt.auxiliaryLocks.includes(cellId);
}

function makeAttempt(level: LevelDefinition, attemptId: string): Attempt {
  string(attemptId, 'attempt ID');
  return {
    rulesVersion: RULES_VERSION, id: attemptId, levelId: level.id, levelContentVersion: level.contentVersion, revision: 0,
    status: isSolved(level, level.initialBoard, level.initialPool) ? 'Won' : 'Playing',
    board: { ...level.initialBoard }, pool: [...level.initialPool], auxiliaryLocks: [],
    initialTimeMs: level.challenge.timeLimitSeconds * 1000, remainingTimeMs: level.challenge.timeLimitSeconds * 1000, elapsedMs: 0,
    movesSpent: 0, totalTimeGrantedMs: 0, score: null, pointsEarned: 0, undoStack: [], propUses: emptyInventory(),
    revivesUsed: 0, propRestockAdsGranted: 0, reviveAdsGranted: 0,
    pendingRewardRequestId: null, previousStatusBeforeAd: null, preview: null,
  };
}
function validateInventory(inventory: Inventory): Inventory {
  return { locate: integer(inventory.locate, 'locate stock'), peek: integer(inventory.peek, 'peek stock'), addTime: integer(inventory.addTime, 'addTime stock') };
}
export function createGame(level: LevelDefinition, attemptId: string, inventory: Inventory = { ...INITIAL_INVENTORY }): GameState {
  return { level, attempt: makeAttempt(level, attemptId), wallet: { points: 0, levelScores: {}, inventory: validateInventory(inventory), rewardLedger: {}, pendingRevives: [] } };
}

function restoreLayout(level: LevelDefinition, input: unknown): Pick<UndoEntry, 'board' | 'pool' | 'auxiliaryLocks'> {
  const raw = object(input, 'layout');
  const rawBoard = object(raw.board, 'saved board');
  if (Object.keys(rawBoard).length !== level.cells.length) throw new Error('Saved board size mismatch');
  const board: Board = {};
  for (const cell of level.cells) board[cell.id] = rawBoard[cell.id] === null ? null : string(rawBoard[cell.id], 'saved tile');
  const pool = array(raw.pool, 'saved tray').map(value => value === null ? null : string(value, 'saved tray tile'));
  const auxiliaryLocks = array(raw.auxiliaryLocks, 'saved locks').map(value => string(value, 'saved lock'));
  if (pool.length !== level.initialPool.length) throw new Error('Saved tray size mismatch');
  const ids = [...Object.values(board), ...pool].filter((id): id is string => id !== null);
  const tileIds = new Set(level.tiles.map(tile => tile.id));
  if (ids.length !== tileIds.size || new Set(ids).size !== tileIds.size || ids.some(id => !tileIds.has(id))) throw new Error('Saved tile conservation failed');
  if (level.anchors.some(id => board[id] !== level.initialBoard[id])) throw new Error('Saved anchor moved');
  if (new Set(auxiliaryLocks).size !== auxiliaryLocks.length || auxiliaryLocks.some(id => !own(board, id) || level.anchors.includes(id) || colourAt(level, board, id) !== level.cells.find(cell => cell.id === id)!.targetHex)) throw new Error('Saved lock invalid');
  return { board, pool, auxiliaryLocks };
}

/** Restores only this rules/content version. Old attempts must be discarded, never reinterpreted. */
export function restoreAttempt(level: LevelDefinition, input: unknown): Attempt {
  const raw = object(input, 'attempt');
  if (raw.rulesVersion !== RULES_VERSION || raw.levelId !== level.id || raw.levelContentVersion !== level.contentVersion) throw new Error('Incompatible attempt rules or level version');
  const layout = restoreLayout(level, raw);
  const propUses = validateInventory(object(raw.propUses, 'saved prop uses') as Inventory);
  for (const prop of Object.keys(PROP_LIMITS) as Prop[]) if (propUses[prop] > PROP_LIMITS[prop]) throw new Error('Saved prop limit exceeded');
  const initialTimeMs = integer(raw.initialTimeMs, 'saved initial time', 1);
  const remainingTimeMs = integer(raw.remainingTimeMs, 'saved remaining time');
  const elapsedMs = integer(raw.elapsedMs, 'saved elapsed time');
  const totalTimeGrantedMs = integer(raw.totalTimeGrantedMs, 'saved granted time');
  const movesSpent = integer(raw.movesSpent, 'saved spent moves');
  if (initialTimeMs !== level.challenge.timeLimitSeconds * 1000) throw new Error('Saved initial time mismatch');
  if (remainingTimeMs !== initialTimeMs + totalTimeGrantedMs - elapsedMs) throw new Error('Saved time accounting mismatch');
  const score = raw.score === null ? null : integer(raw.score, 'saved score', 100);
  if (score !== null && score > 200) throw new Error('Saved score too high');
  const pointsEarned = integer(raw.pointsEarned, 'saved points earned');
  if (pointsEarned > 200 || (score === null && pointsEarned !== 0)) throw new Error('Saved score award invalid');
  const revivesUsed = integer(raw.revivesUsed, 'saved revival count');
  const propRestockAdsGranted = integer(raw.propRestockAdsGranted, 'saved restock count');
  const reviveAdsGranted = integer(raw.reviveAdsGranted, 'saved rewarded revival count');
  if (totalTimeGrantedMs !== (propUses.addTime + revivesUsed) * 30000) throw new Error('Saved granted time mismatch');
  if (revivesUsed > level.challenge.revive.maxPerAttempt || propRestockAdsGranted > 1 || reviveAdsGranted > revivesUsed) throw new Error('Saved reward limit exceeded');
  const status = raw.status as AttemptStatus;
  if (!['Playing', 'Won', 'Failed', 'AdPending', 'PreviewingReference'].includes(status)) throw new Error('Saved status invalid');
  const solved = isSolved(level, layout.board, layout.pool);
  const previousStatusBeforeAd = raw.previousStatusBeforeAd === null ? null : raw.previousStatusBeforeAd as 'Playing' | 'Failed' | 'Won';
  const pendingRewardRequestId = raw.pendingRewardRequestId === null ? null : string(raw.pendingRewardRequestId, 'pending request');
  const baseStatus = status === 'AdPending' ? previousStatusBeforeAd : status === 'PreviewingReference' ? 'Playing' : status;
  if (!['Playing', 'Won', 'Failed'].includes(baseStatus ?? '')) throw new Error('Saved base status invalid');
  if (solved !== (baseStatus === 'Won') || (baseStatus === 'Failed' && remainingTimeMs !== 0) || (baseStatus === 'Playing' && remainingTimeMs === 0)) throw new Error('Saved status disagrees with board or budget');
  if ((baseStatus === 'Won') !== (score !== null)) throw new Error('Saved score status mismatch');
  if ((status === 'AdPending') !== (pendingRewardRequestId !== null && previousStatusBeforeAd !== null)) throw new Error('Saved ad state invalid');
  let preview: Attempt['preview'] = null;
  if (status === 'PreviewingReference') {
    const item = object(raw.preview, 'saved preview');
    const pathId = string(item.pathId, 'saved preview path');
    if (!level.paths.some(path => path.id === pathId) || typeof item.expiresAtMs !== 'number' || !Number.isFinite(item.expiresAtMs)) throw new Error('Saved preview invalid');
    preview = { pathId, expiresAtMs: item.expiresAtMs };
  } else if (raw.preview !== null) throw new Error('Unexpected saved preview');
  const undoStack = array(raw.undoStack, 'saved history').map(value => {
    const entry = object(value, 'saved history entry');
    if (!['place', 'move', 'returnToTray', 'locate'].includes(entry.kind as string)) throw new Error('Incompatible history action');
    return { kind: entry.kind as UndoEntry['kind'], ...restoreLayout(level, entry) };
  });
  return { ...layout, rulesVersion: RULES_VERSION, id: string(raw.id, 'saved attempt ID'), levelId: level.id,
    levelContentVersion: level.contentVersion, revision: integer(raw.revision, 'saved revision'), status,
    initialTimeMs, remainingTimeMs, elapsedMs, movesSpent, totalTimeGrantedMs, score, pointsEarned, undoStack,
    propUses, revivesUsed, propRestockAdsGranted, reviveAdsGranted, pendingRewardRequestId, previousStatusBeforeAd, preview };
}

/** The application may preserve wallet/progress separately when an incompatible attempt is discarded. */
export function restoreGame(level: LevelDefinition, input: unknown): GameState {
  const raw = object(input, 'saved game');
  const attempt = restoreAttempt(level, raw.attempt);
  const wallet = restoreWallet(raw.wallet);
  if (attempt.pendingRewardRequestId) {
    const request = wallet.rewardLedger[attempt.pendingRewardRequestId];
    if (!request || request.status !== 'pending' || request.attemptId !== attempt.id || request.levelId !== level.id || request.levelContentVersion !== level.contentVersion) throw new Error('Saved pending reward mismatch');
  }
  return { level, attempt, wallet };
}

/** Validates earned rights independently of the attempt. Legacy move entitlements become seconds. */
export function restoreWallet(input: unknown, legacy = false): Wallet {
  const rawWallet = object(input, 'saved wallet');
  const rawInventory = object(rawWallet.inventory, 'saved inventory');
  const inventory = validateInventory({ ...rawInventory,
    addTime: rawInventory.addTime ?? (legacy ? rawInventory.addMoves : undefined),
  } as Inventory);
  const points = legacy && rawWallet.points === undefined ? 0 : integer(rawWallet.points, 'saved points');
  const levelScores: Record<string, LevelScore> = {};
  for (const [id, value] of Object.entries(legacy && rawWallet.levelScores === undefined ? {} : object(rawWallet.levelScores, 'level scores'))) {
    const item = object(value, 'level score');
    const bestScore = integer(item.bestScore, 'best score', 100);
    if (!/^L\d{3}$/.test(id) || bestScore > 200 || typeof item.doubleScoreClaimed !== 'boolean') throw new Error('Saved level score invalid');
    const scoreEpoch = item.scoreEpoch === undefined ? {} : { scoreEpoch: string(item.scoreEpoch, 'saved score epoch') };
    levelScores[id] = { ...scoreEpoch, bestScore, doubleScoreClaimed: item.doubleScoreClaimed };
  }
  const rewardLedger: Record<string, RewardRequest> = {};
  for (const [id, value] of Object.entries(object(rawWallet.rewardLedger, 'reward ledger'))) {
    const item = object(value, 'reward request');
    if (!validId(id) || item.id !== id || !['pending', 'granted', 'cancelled', 'failed'].includes(item.status as string) || !['revive', 'restock', 'doubleScore'].includes(item.rewardType as string)) throw new Error('Saved reward request invalid');
    const rewardType = item.rewardType as RewardRequest['rewardType'];
    const prop = rewardType === 'restock' ? (legacy && item.prop === 'addMoves' ? 'addTime' : item.prop) as Prop : null;
    const oldAmount = integer(item.amount, 'saved reward amount', 1);
    const amount = legacy && rewardType === 'revive' ? 30 : oldAmount;
    if (rewardType === 'restock' && (!own(PROP_LIMITS, prop!) || amount !== 1)) throw new Error('Saved restock reward invalid');
    if (rewardType === 'revive' && amount !== 30) throw new Error('Saved revival amount invalid');
    if (rewardType === 'doubleScore' && amount > 200) throw new Error('Saved bonus amount invalid');
    rewardLedger[id] = { id, attemptId: string(item.attemptId, 'reward attempt'), levelId: string(item.levelId, 'reward level'),
      levelContentVersion: string(item.levelContentVersion, 'reward content version'), rewardType, prop, amount,
      ...(item.scoreEpoch === undefined ? {} : { scoreEpoch: string(item.scoreEpoch, 'reward score epoch') }), status: item.status as RewardRequest['status'] };
  }
  if (Object.values(rewardLedger).filter(item => item.status === 'pending').length > 1) throw new Error('Multiple pending rewards');
  const pendingRevives = array(rawWallet.pendingRevives, 'pending revivals').map(value => {
    const item = object(value, 'pending revival');
    const requestId = string(item.requestId, 'pending revival request');
    const request = rewardLedger[requestId];
    const originAttemptId = string(item.originAttemptId, 'pending revival attempt');
    const oldAmount = integer(item.amount, 'pending revival amount', 1);
    const amount = legacy ? 30 : oldAmount;
    if (!request || request.status !== 'granted' || request.rewardType !== 'revive' || request.attemptId !== originAttemptId || request.amount !== amount) throw new Error('Saved pending revival mismatch');
    return { requestId, originAttemptId, amount };
  });
  if (new Set(pendingRevives.map(item => item.requestId)).size !== pendingRevives.length) throw new Error('Duplicate pending revival');
  return { points, levelScores, inventory, rewardLedger, pendingRevives };
}
/** Application owns sequential level unlocks and one-time starter/chapter grants. */
export function startLevel(previous: GameState, level: LevelDefinition, attemptId: string): GameState {
  if (attemptId === previous.attempt.id || Object.values(previous.wallet.rewardLedger).some(request => request.attemptId === attemptId)) {
    throw new Error('A new attempt ID is required');
  }
  return { level, attempt: makeAttempt(level, attemptId), wallet: cloneWallet(previous.wallet) };
}
/** Resume presentation-independent state. Unverified ad requests remain in the ledger. */
export function recoverInterruptedGame(state: GameState): GameState {
  if (state.attempt.status !== 'PreviewingReference' && state.attempt.status !== 'AdPending') return state;
  const next = clone(state);
  if (next.attempt.status === 'PreviewingReference') {
    next.attempt.preview = null;
    next.attempt.status = 'Playing';
  } else {
    next.attempt.status = next.attempt.previousStatusBeforeAd ?? 'Failed';
    next.attempt.previousStatusBeforeAd = null;
    next.attempt.pendingRewardRequestId = null;
  }
  next.attempt.revision++;
  return next;
}
function cloneWallet(wallet: Wallet): Wallet {
  const rewardLedger: Record<string, RewardRequest> = {};
  for (const id of Object.keys(wallet.rewardLedger)) rewardLedger[id] = { ...wallet.rewardLedger[id] };
  return { points: wallet.points, levelScores: Object.fromEntries(Object.entries(wallet.levelScores).map(([id, score]) => [id, { ...score }])), inventory: { ...wallet.inventory }, rewardLedger, pendingRevives: wallet.pendingRevives.map(item => ({ ...item })) };
}
function clone(state: GameState): GameState {
  const attempt = state.attempt;
  return {
    level: state.level,
    attempt: { ...attempt, board: { ...attempt.board }, pool: [...attempt.pool], auxiliaryLocks: [...attempt.auxiliaryLocks],
      undoStack: [...attempt.undoStack], propUses: { ...attempt.propUses }, preview: attempt.preview ? { ...attempt.preview } : null },
    wallet: cloneWallet(state.wallet),
  };
}
function snapshot(state: GameState, kind: UndoEntry['kind']): void {
  state.attempt.undoStack.push({ kind, board: { ...state.attempt.board }, pool: [...state.attempt.pool], auxiliaryLocks: [...state.attempt.auxiliaryLocks] });
}
function rejected(state: GameState, reason: string): Transition {
  return { state, changed: false, reason, events: [] };
}
function committed(state: GameState, events: DomainEvent[] = []): Transition {
  state.attempt.revision++;
  return { state, changed: true, events };
}
export function defaultTimeLimitSeconds(number: number, chapter: number, movableCount: number): number {
  return number === 1 ? 45 : Math.min(240, Math.max(45, 45 + movableCount * (chapter <= 2 ? 6 : chapter <= 4 ? 5 : 4)));
}
/** 100 base + 0..50 placement efficiency + 0..50 remaining original time, with aid penalties. */
export function calculateScore(state: GameState): number {
  const attempt = state.attempt;
  const minimum = state.level.initialPool.length;
  const efficiency = Math.round(50 * Math.min(1, minimum / Math.max(minimum, attempt.movesSpent)));
  const time = Math.round(50 * Math.min(1, Math.max(0, attempt.remainingTimeMs / attempt.initialTimeMs)));
  const aids = Object.values(attempt.propUses).reduce((sum, uses) => sum + uses, 0) + attempt.revivesUsed;
  return Math.max(100, 100 + efficiency + time - aids * 10);
}
function effectiveScoreEpoch(value: { scoreEpoch?: string }): string {
  return value.scoreEpoch ?? DEFAULT_SCORE_EPOCH;
}
export function canClaimDoubleScore(state: GameState): boolean {
  const record = state.wallet.levelScores[state.level.id];
  return state.attempt.status === 'Won' && state.attempt.pointsEarned > 0 && !!record
    && effectiveScoreEpoch(record) === effectiveScoreEpoch(state.level) && !record.doubleScoreClaimed;
}
function resolveBoard(state: GameState, spendMove: boolean): DomainEvent[] {
  const attempt = state.attempt;
  if (spendMove) attempt.movesSpent++;
  if (isSolved(state.level, attempt.board, attempt.pool)) {
    attempt.status = 'Won';
    attempt.score = calculateScore(state);
    const saved = state.wallet.levelScores[state.level.id];
    const previous = saved && effectiveScoreEpoch(saved) === effectiveScoreEpoch(state.level) ? saved : undefined;
    const bestScore = Math.max(previous?.bestScore ?? 0, attempt.score);
    attempt.pointsEarned = bestScore - (previous?.bestScore ?? 0);
    state.wallet.points += attempt.pointsEarned;
    state.wallet.levelScores[state.level.id] = { scoreEpoch: effectiveScoreEpoch(state.level), bestScore, doubleScoreClaimed: previous?.doubleScoreClaimed ?? false };
    return [{ type: 'won', levelId: state.level.id, attemptId: attempt.id, score: attempt.score, pointsEarned: attempt.pointsEarned }];
  }
  attempt.status = 'Playing';
  return [];
}
function propReason(state: GameState, prop: Prop): string | undefined {
  if (state.attempt.status !== 'Playing') return '当前状态不能使用道具';
  if (state.attempt.propUses[prop] >= PROP_LIMITS[prop]) return '本次尝试已达道具使用上限';
  if (state.wallet.inventory[prop] <= 0) return '道具库存不足';
  return undefined;
}
function spendProp(state: GameState, prop: Prop): void {
  state.wallet.inventory[prop]--;
  state.attempt.propUses[prop]++;
}
function validId(value: string): boolean {
  return typeof value === 'string' && value.length > 0 && value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
}

/** Returns a new atomic snapshot. Persist the entire snapshot together, before animations. */
export function reduceGame(state: GameState, action: Action): Transition {
  const attempt = state.attempt;
  if (action.type === 'restart') {
    if (!validId(action.attemptId) || action.attemptId === attempt.id || Object.values(state.wallet.rewardLedger).some(r => r.attemptId === action.attemptId)) {
      return rejected(state, '重开必须使用新的尝试 ID');
    }
    const next = startLevel(state, state.level, action.attemptId);
    return committed(next);
  }
  if (action.type === 'settleReward') return settleReward(state, action.requestId, action.outcome);
  if (action.type === 'beginReward') return beginReward(state, action);
  if (action.type === 'applyPendingRevive') {
    if (attempt.status !== 'Failed' || attempt.revivesUsed >= state.level.challenge.revive.maxPerAttempt) return rejected(state, '当前不能使用待用复活权益');
    const item = state.wallet.pendingRevives.find(r => r.requestId === action.requestId);
    if (!item) return rejected(state, '待用复活权益不存在');
    const next = clone(state);
    next.wallet.pendingRevives = next.wallet.pendingRevives.filter(r => r.requestId !== action.requestId);
    applyRevive(next, item.amount);
    return committed(next);
  }
  if (action.type === 'endPeek' || action.type === 'expirePeek' || action.type === 'suspend') {
    if (attempt.status !== 'PreviewingReference') return rejected(state, '没有正在显示的参考');
    if (action.type === 'expirePeek' && (!Number.isFinite(action.nowMs) || action.nowMs < attempt.preview!.expiresAtMs)) return rejected(state, '参考尚未到期');
    const next = clone(state);
    next.attempt.status = 'Playing';
    next.attempt.preview = null;
    return committed(next);
  }
  if (action.type === 'purchaseProp') {
    if (attempt.status === 'AdPending' || attempt.status === 'PreviewingReference') return rejected(state, '请先结束当前操作');
    if (!own(PROP_PRICES, action.prop)) return rejected(state, '无效道具');
    const price = PROP_PRICES[action.prop];
    if (state.wallet.points < price) return rejected(state, '积分不足');
    const next = clone(state);
    next.wallet.points -= price;
    next.wallet.inventory[action.prop]++;
    return committed(next);
  }
  if (attempt.status !== 'Playing') return rejected(state, '当前状态不能操作棋盘');
  if (action.type === 'elapse') {
    if (!Number.isSafeInteger(action.deltaMs) || action.deltaMs <= 0) return rejected(state, '无效计时增量');
    const next = clone(state);
    const elapsed = Math.min(action.deltaMs, next.attempt.remainingTimeMs);
    next.attempt.remainingTimeMs -= elapsed;
    next.attempt.elapsedMs += elapsed;
    if (next.attempt.remainingTimeMs === 0) {
      next.attempt.status = 'Failed';
      return committed(next, [{ type: 'failed', levelId: next.level.id, attemptId: next.attempt.id }]);
    }
    return committed(next);
  }
  if (action.type === 'move') {
    const from = action.fromCellId, to = action.toCellId;
    if (from === to || !own(attempt.board, from) || !own(attempt.board, to) || isLocked(state, from) || isLocked(state, to) || !attempt.board[from] || attempt.board[to] !== null) {
      return rejected(state, '请选择色块和另一个空格');
    }
    const next = clone(state);
    snapshot(next, 'move');
    next.attempt.board[to] = next.attempt.board[from];
    next.attempt.board[from] = null;
    return committed(next, resolveBoard(next, true));
  }
  if (action.type === 'returnToTray') {
    const from = action.fromCellId;
    if (!own(attempt.board, from) || isLocked(state, from) || !attempt.board[from]) return rejected(state, '请选择可取回的色块');
    const home = state.level.trayHomeByTile[attempt.board[from]!];
    const index = action.toPoolIndex !== undefined ? action.toPoolIndex
      : attempt.pool[home] === null ? home : attempt.pool.findIndex(tile => tile === null);
    if (!Number.isInteger(index) || index < 0 || index >= attempt.pool.length || attempt.pool[index] !== null) return rejected(state, '请选择待选区的空槽');
    const next = clone(state);
    snapshot(next, 'returnToTray');
    next.attempt.pool[index] = next.attempt.board[from];
    next.attempt.board[from] = null;
    return committed(next, resolveBoard(next, false));
  }
  if (action.type === 'place') {
    const index = action.poolIndex, target = action.toCellId;
    if (!Number.isInteger(index) || index < 0 || index >= attempt.pool.length || !attempt.pool[index] || !own(attempt.board, target) || attempt.board[target] !== null || isLocked(state, target)) {
      return rejected(state, '请把待选色块放入空格');
    }
    const next = clone(state);
    snapshot(next, 'place');
    next.attempt.board[target] = next.attempt.pool[index];
    next.attempt.pool[index] = null;
    return committed(next, resolveBoard(next, true));
  }
  if (action.type === 'undo') {
    const entry = attempt.undoStack[attempt.undoStack.length - 1];
    if (!entry) return rejected(state, '还没有可以撤销的操作');
    const next = clone(state);
    next.attempt.undoStack.pop();
    next.attempt.board = { ...entry.board };
    next.attempt.pool = [...entry.pool];
    next.attempt.auxiliaryLocks = [...entry.auxiliaryLocks];
    return committed(next);
  }
  if (action.type === 'addTime') {
    const reason = propReason(state, 'addTime');
    if (reason) return rejected(state, reason);
    const next = clone(state);
    spendProp(next, 'addTime');
    next.attempt.remainingTimeMs += 30000;
    next.attempt.totalTimeGrantedMs += 30000;
    return committed(next);
  }
  if (action.type === 'peek') {
    const reason = propReason(state, 'peek');
    if (reason) return rejected(state, reason);
    if (!state.level.paths.some(p => p.id === action.pathId) || !Number.isFinite(action.nowMs)) return rejected(state, '请选择一条有效色路');
    const next = clone(state);
    spendProp(next, 'peek');
    next.attempt.status = 'PreviewingReference';
    next.attempt.preview = { pathId: action.pathId, expiresAtMs: action.nowMs + 3000 };
    return committed(next);
  }
  if (action.type === 'locate') {
    const reason = propReason(state, 'locate');
    if (reason) return rejected(state, reason);
    const candidates = state.level.cells.filter(c => !isLocked(state, c.id) && colourAt(state.level, attempt.board, c.id) !== c.targetHex);
    const target = candidates[0];
    if (!target) return rejected(state, '没有可归位的色块');
    const sourceCell = state.level.cells.find(c => !isLocked(state, c.id) && colourAt(state.level, attempt.board, c.id) === target.targetHex);
    const sourcePool = attempt.pool.findIndex(id => id !== null && state.level.tiles.find(t => t.id === id)?.hex === target.targetHex);
    if (!sourceCell && sourcePool < 0) return rejected(state, '没有可用的目标色块');
    const next = clone(state);
    snapshot(next, 'locate');
    const displacedTile = next.attempt.board[target.id];
    // Extract the correct tile first. Its old tray position becomes available before any
    // displaced tile is returned, so arbitrary tray rearrangements never require a swap.
    const correctTile = sourceCell ? next.attempt.board[sourceCell.id] : next.attempt.pool[sourcePool];
    if (sourceCell) next.attempt.board[sourceCell.id] = null;
    else next.attempt.pool[sourcePool] = null;
    if (displacedTile !== null) {
      const home = state.level.trayHomeByTile[displacedTile];
      const slot = next.attempt.pool[home] === null ? home : next.attempt.pool.findIndex(tile => tile === null);
      if (slot < 0) return rejected(state, '没有可用的待选空槽');
      next.attempt.pool[slot] = displacedTile;
    }
    next.attempt.board[target.id] = correctTile;
    next.attempt.auxiliaryLocks.push(target.id);
    spendProp(next, 'locate');
    return committed(next, resolveBoard(next, false));
  }
  return rejected(state, '未知动作');
}

function beginReward(state: GameState, action: Extract<Action, { type: 'beginReward' }>): Transition {
  const attempt = state.attempt;
  if (!validId(action.requestId) || own(state.wallet.rewardLedger, action.requestId)) return rejected(state, '奖励请求 ID 已使用或无效');
  // A detached, unconfirmed request remains busy until the platform resolves it.
  if (Object.values(state.wallet.rewardLedger).some(r => r.status === 'pending')) return rejected(state, '已有视频请求等待确认');
  if (action.rewardType === 'revive') {
    if (attempt.status !== 'Failed' || attempt.revivesUsed >= state.level.challenge.revive.maxPerAttempt) return rejected(state, '当前不能申请视频复活');
  } else if (action.rewardType === 'doubleScore') {
    if (!canClaimDoubleScore(state)) return rejected(state, '当前不能申请双倍积分');
  } else if (action.rewardType === 'restock') {
    if (attempt.status !== 'Playing' || !action.prop || !own(PROP_LIMITS, action.prop)) return rejected(state, '当前不能申请道具补货');
    if (attempt.propRestockAdsGranted >= 1) return rejected(state, '本次尝试已领取过道具补货');
    if (state.wallet.inventory[action.prop] !== 0 || attempt.propUses[action.prop] >= PROP_LIMITS[action.prop]) return rejected(state, '当前道具无需或无法补货');
  } else return rejected(state, '无效奖励类型');
  const next = clone(state);
  next.wallet.rewardLedger[action.requestId] = {
    id: action.requestId, attemptId: attempt.id, levelId: state.level.id, levelContentVersion: state.level.contentVersion,
    rewardType: action.rewardType,
    ...(action.rewardType === 'doubleScore' ? { scoreEpoch: effectiveScoreEpoch(state.level) } : {}), amount: action.rewardType === 'revive' ? state.level.challenge.revive.addSeconds : action.rewardType === 'doubleScore' ? attempt.pointsEarned : 1,
    prop: action.rewardType === 'restock' ? action.prop! : null, status: 'pending',
  };
  next.attempt.previousStatusBeforeAd = attempt.status as 'Playing' | 'Failed' | 'Won';
  next.attempt.status = 'AdPending';
  next.attempt.pendingRewardRequestId = action.requestId;
  return committed(next, [{ type: 'rewardRequested', requestId: action.requestId }]);
}
function applyRevive(state: GameState, amount: number): void {
  state.attempt.remainingTimeMs += amount * 1000;
  state.attempt.totalTimeGrantedMs += amount * 1000;
  state.attempt.revivesUsed++;
  state.attempt.status = 'Playing';
}
function settleReward(state: GameState, requestId: string, outcome: 'completed' | 'cancelled' | 'failed'): Transition {
  if (!['completed', 'cancelled', 'failed'].includes(outcome)) return rejected(state, '无效视频结算结果');
  const request = own(state.wallet.rewardLedger, requestId) ? state.wallet.rewardLedger[requestId] : undefined;
  if (!request || request.status !== 'pending') return rejected(state, '奖励请求不存在或已经处理');
  const next = clone(state);
  const sameAttempt = request.attemptId === next.attempt.id && request.levelId === next.level.id && request.levelContentVersion === next.level.contentVersion;
  if (sameAttempt && next.attempt.pendingRewardRequestId === requestId) {
    next.attempt.status = next.attempt.previousStatusBeforeAd ?? 'Failed';
    next.attempt.previousStatusBeforeAd = null;
    next.attempt.pendingRewardRequestId = null;
  }
  next.wallet.rewardLedger[requestId].status = outcome === 'completed' ? 'granted' : outcome;
  if (outcome !== 'completed') return committed(next);
  let deferred = false;
  if (request.rewardType === 'doubleScore') {
    const entry = next.wallet.levelScores[request.levelId];
    const matchingEpoch = !!entry && effectiveScoreEpoch(entry) === effectiveScoreEpoch(request);
    if (!matchingEpoch || !entry.doubleScoreClaimed) {
      // A late confirmed video from an old puzzle design keeps its earned bonus, but cannot
      // consume the new design's independent double-score qualification.
      next.wallet.points += request.amount;
      if (matchingEpoch) entry.doubleScoreClaimed = true;
    }
  } else if (request.rewardType === 'restock') {
    next.wallet.inventory[request.prop!] += request.amount;
    if (sameAttempt) next.attempt.propRestockAdsGranted++;
  } else if (sameAttempt && next.attempt.status === 'Failed' && next.attempt.revivesUsed < next.level.challenge.revive.maxPerAttempt) {
    applyRevive(next, request.amount);
    next.attempt.reviveAdsGranted++;
  } else {
    deferred = true;
    next.wallet.pendingRevives.push({ requestId, originAttemptId: request.attemptId, amount: request.amount });
  }
  return committed(next, [{ type: 'rewardGranted', requestId, deferred }]);
}
