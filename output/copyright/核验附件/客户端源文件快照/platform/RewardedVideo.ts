export type VideoResult = 'completed' | 'cancelled' | 'failed';
export type PresentVideoSimulation = (finish: () => void, cancel: () => void, fail: () => void) => void;
export interface VideoCloseResult { isEnded?: boolean; count?: number; }

export interface RewardedVideoHandle {
  load(): Promise<unknown>;
  show(): Promise<unknown>;
  onClose(callback: (result?: VideoCloseResult) => void): void;
  offClose?(callback: (result?: VideoCloseResult) => void): void;
  onError(callback: (error: unknown) => void): void;
  offError?(callback: (error: unknown) => void): void;
  destroy?(): void;
}
export interface DouyinVideoRuntime {
  createRewardedVideoAd?(options: { adUnitId: string }): RewardedVideoHandle;
}
export interface RewardedVideoOptions {
  /** Actual platform-issued ad unit, configured outside game rules. Empty means unavailable. */
  adUnitId?: string;
  /** Tests may inject a runtime; null explicitly selects the labelled web simulation. */
  runtime?: DouyinVideoRuntime | null;
  /** Upper bound for a callback that never arrives; does not award anything. */
  timeoutMs?: number;
}

function globalRuntime(): DouyinVideoRuntime | null {
  const runtime = (globalThis as unknown as { tt?: DouyinVideoRuntime }).tt;
  return runtime === undefined ? null : runtime ?? {};
}
export function isDouyinRuntime(): boolean {
  return typeof (globalThis as unknown as { tt?: unknown }).tt !== 'undefined';
}

/** Full viewing is confirmed by the real SDK close result; web simulation must be explicit. */
export class RewardedVideo {
  readonly simulationAvailable: boolean;
  readonly available: boolean;
  readonly unavailableReason: string;
  private readonly runtime: DouyinVideoRuntime | null;
  private readonly adUnitId: string;
  private readonly timeoutMs: number;
  private cancelActive: (() => void) | null = null;

  constructor(options: RewardedVideoOptions = {}) {
    this.runtime = options.runtime === undefined ? globalRuntime() : options.runtime;
    this.adUnitId = options.adUnitId?.trim() ?? '';
    this.timeoutMs = Math.max(1000, options.timeoutMs ?? 180000);
    this.simulationAvailable = this.runtime === null;
    this.available = this.simulationAvailable || (this.adUnitId.length > 0 && typeof this.runtime?.createRewardedVideoAd === 'function');
    this.unavailableReason = !this.adUnitId ? '激励视频尚未配置，请免费重试' : '当前环境暂不支持激励视频，请免费重试';
  }

  get isShowing(): boolean { return this.cancelActive !== null; }

  show(onResult: (outcome: VideoResult) => void, presentSimulation?: PresentVideoSimulation): void {
    if (this.cancelActive || !this.available) { onResult('failed'); return; }
    if (this.simulationAvailable) {
      if (!presentSimulation) { onResult('failed'); return; }
      let settled = false;
      const settle = (result: VideoResult) => {
        if (settled) return;
        settled = true;
        this.cancelActive = null;
        onResult(result);
      };
      this.cancelActive = () => settle('cancelled');
      try { presentSimulation(() => settle('completed'), () => settle('cancelled'), () => settle('failed')); }
      catch { settle('failed'); }
      return;
    }
    let ad: RewardedVideoHandle;
    try { ad = this.runtime!.createRewardedVideoAd!({ adUnitId: this.adUnitId }); }
    catch { onResult('failed'); return; }
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const close = (result?: VideoCloseResult) => {
      // Current SDKs return count even in ordinary single-video mode; follow its documented
      // precedence. One request still grants one reward, regardless of a larger count.
      const completed = result?.count !== undefined
        ? Number.isInteger(result.count) && result.count >= 1 : result?.isEnded === true;
      settle(completed ? 'completed' : 'cancelled');
    };
    const error = (_error: unknown) => settle('failed');
    const settle = (result: VideoResult) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      this.cancelActive = null;
      try { ad.offClose?.(close); } catch { /* SDK cleanup must not duplicate or suppress settlement. */ }
      try { ad.offError?.(error); } catch { /* Same as above. */ }
      try { ad.destroy?.(); } catch { /* Same as above. */ }
      onResult(result);
    };
    this.cancelActive = () => settle('cancelled');
    try {
      ad.onClose(close);
      if (settled) return;
      ad.onError(error);
      if (settled) return;
      timer = setTimeout(() => settle('failed'), this.timeoutMs);
      Promise.resolve(ad.load()).then(() => {
        if (!settled) return ad.show();
        return undefined;
      }).catch(error);
    } catch (caught) { error(caught); }
  }

  /** Intentionally request only the explicitly labelled web simulation. */
  showSimulation(onResult: (outcome: VideoResult) => void, present: PresentVideoSimulation): void {
    if (!this.simulationAvailable) { onResult('failed'); return; }
    this.show(onResult, present);
  }

  dispose(): void { this.cancelActive?.(); }
}
