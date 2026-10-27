import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RewardedVideo } = require(join(process.env.SHISE_PLATFORM_BUILD, 'platform/RewardedVideo.js'));
const tick = () => new Promise(resolve => setImmediate(resolve));

function sdk(options = {}) {
  const state = { close: null, error: null, offClose: 0, offError: 0, destroyed: 0, loaded: 0, shown: 0, received: null };
  const ad = {
    load() { state.loaded++; return options.loadReject ? Promise.reject(new Error('load failure')) : Promise.resolve(); },
    show() { state.shown++; return options.showReject ? Promise.reject(new Error('show failure')) : Promise.resolve(); },
    onClose(callback) { state.close = callback; },
    onError(callback) { state.error = callback; if (options.synchronousError) callback({ code: 1 }); },
    offClose(callback) { assert.equal(callback, state.close); state.offClose++; },
    offError(callback) { assert.equal(callback, state.error); state.offError++; },
    destroy() { state.destroyed++; },
  };
  const runtime = { createRewardedVideoAd(config) { state.received = config; return ad; } };
  return { state, runtime };
}

test('Douyin with no configured real ad unit is unavailable and can never simulate success', () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime });
  assert.equal(service.available, false);
  assert.equal(service.simulationAvailable, false);
  const results = [];
  service.show(result => results.push(result), finish => finish());
  service.showSimulation(result => results.push(result), finish => finish());
  assert.deepEqual(results, ['failed', 'failed']);
  assert.equal(state.received, null);
});

test('web simulation must be explicitly presented, and duplicate UI callbacks settle only once', () => {
  const service = new RewardedVideo({ runtime: null });
  const results = [];
  service.show(result => results.push(result));
  service.show(result => results.push(result), (finish, cancel, fail) => { finish(); cancel(); fail(); finish(); });
  assert.deepEqual(results, ['failed', 'completed']);
  assert.equal(service.isShowing, false);
});

test('real SDK full viewing settles once, passes configured ID, removes listeners and destroys ad', async () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime, adUnitId: 'configured-ad-unit' });
  const results = [];
  service.show(result => results.push(result));
  await tick();
  assert.deepEqual(state.received, { adUnitId: 'configured-ad-unit' });
  assert.equal(state.loaded, 1); assert.equal(state.shown, 1);
  state.close({ isEnded: true });
  state.close({ isEnded: true }); state.error(new Error('late error'));
  assert.deepEqual(results, ['completed']);
  assert.equal(state.offClose, 1); assert.equal(state.offError, 1); assert.equal(state.destroyed, 1);
  assert.equal(service.isShowing, false);
});

test('incomplete and absent close results are cancellations with no completed reward', async () => {
  for (const closeResult of [{ isEnded: false }, undefined, {}, { count: 0, isEnded: true }]) {
    const { runtime, state } = sdk();
    const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
    const results = [];
    service.show(result => results.push(result)); await tick();
    state.close(closeResult);
    assert.deepEqual(results, ['cancelled']);
    assert.equal(state.destroyed, 1);
  }
});

test('documented count takes precedence and multiple completed videos still settle one request once', async () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
  const results = [];
  service.show(result => results.push(result)); await tick();
  state.close({ count: 2, isEnded: false });
  state.close({ count: 2, isEnded: true });
  assert.deepEqual(results, ['completed']);
});

test('load and show failures settle failed, clean up, and do not consume a completed reward', async () => {
  for (const options of [{ loadReject: true }, { showReject: true }]) {
    const { runtime, state } = sdk(options);
    const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
    const results = [];
    service.show(result => results.push(result)); await tick();
    assert.deepEqual(results, ['failed']);
    assert.equal(state.destroyed, 1);
    assert.equal(service.isShowing, false);
    state.error(new Error('duplicate')); state.close({ isEnded: true });
    assert.deepEqual(results, ['failed']);
  }
});

test('SDK error events, creation errors and unsupported runtime fail without browser simulation', async () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
  const results = [];
  service.show(result => results.push(result), finish => finish()); await tick();
  state.error({ errCode: 1 }); state.close({ isEnded: true });
  assert.deepEqual(results, ['failed']);
  const broken = new RewardedVideo({ runtime: { createRewardedVideoAd() { throw new Error('create'); } }, adUnitId: 'unit' });
  broken.show(result => results.push(result));
  new RewardedVideo({ runtime: {}, adUnitId: 'unit' }).show(result => results.push(result), finish => finish());
  assert.deepEqual(results, ['failed', 'failed', 'failed']);
});

test('concurrent requests are rejected while disposal cancels the original once and releases handles', async () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
  const results = [];
  service.show(result => results.push(`first:${result}`));
  service.show(result => results.push(`second:${result}`)); await tick();
  assert.equal(service.isShowing, true);
  service.dispose(); service.dispose(); state.close({ isEnded: true });
  assert.deepEqual(results, ['second:failed', 'first:cancelled']);
  assert.equal(state.destroyed, 1);
});

test('a synchronous SDK setup error never starts loading a destroyed ad or leaves an active request', () => {
  const { runtime, state } = sdk({ synchronousError: true });
  const service = new RewardedVideo({ runtime, adUnitId: 'unit' });
  const results = [];
  service.show(result => results.push(result));
  assert.deepEqual(results, ['failed']);
  assert.equal(state.loaded, 0);
  assert.equal(state.destroyed, 1);
  assert.equal(service.isShowing, false);
});

test('an SDK that never closes times out as failed and releases its handles', async () => {
  const { runtime, state } = sdk();
  const service = new RewardedVideo({ runtime, adUnitId: 'unit', timeoutMs: 1000 });
  const result = await new Promise(resolve => service.show(resolve));
  assert.equal(result, 'failed');
  assert.equal(service.isShowing, false);
  assert.equal(state.destroyed, 1);
});
