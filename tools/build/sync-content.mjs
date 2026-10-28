import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../data/levels/levels.v0.6.json', import.meta.url);
const output = new URL('../../game/assets/resources/generated/levels.json', import.meta.url);
const bytes = await readFile(source);
const content = JSON.parse(bytes);
if (content.levels.length !== 100 || content.contentVersion !== '0.6.0'
  || content.schemaVersion !== '4.1.0' || content.gameplayMode !== 'click-fill' || content.inputMode !== 'tap'
  || content.levels.some(level => level.gameplayMode !== 'click-fill' || level.inputMode !== 'tap'
    || level.challenge.mode !== 'time' || !Number.isInteger(level.challenge.timeLimitSeconds)
    || level.challenge.timeLimitSeconds < 45 || level.challenge.timeLimitSeconds > 240
    || level.challenge.revive.addSeconds !== 30 || level.challenge.revive.maxPerAttempt !== 2
    || level.shuffle.candidateSlots !== 'any-empty' || level.initialPool.length < 4
    || level.shuffleQuality.displacedRatio < .75 || level.shuffleQuality.longestForwardOrReverseRun > 2)) {
  throw new Error('Unexpected level source; inspect the approved content before updating the client.');
}
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile(new URL('content-lock.json', output), `${JSON.stringify({
  source: 'data/levels/levels.v0.6.json', contentVersion: content.contentVersion,
  gameplayMode: content.gameplayMode, inputMode: content.inputMode, levels: content.levels.length, sha256,
}, null, 2)}\n`);
console.log(`Synced ${content.levels.length} levels: ${fileURLToPath(output)}\nSHA-256 ${sha256}`);
