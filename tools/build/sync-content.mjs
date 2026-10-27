import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../data/levels/levels.v0.4.json', import.meta.url);
const output = new URL('../../game/assets/resources/generated/levels.json', import.meta.url);
const bytes = await readFile(source);
const content = JSON.parse(bytes);
if (content.levels.length !== 100 || content.contentVersion !== '0.4.0-candidate'
  || content.schemaVersion !== '3.0.0' || content.gameplayMode !== 'click-fill' || content.inputMode !== 'tap'
  || content.levels.some(level => level.gameplayMode !== 'click-fill' || level.inputMode !== 'tap')) {
  throw new Error('Unexpected level source; inspect the approved content before updating the client.');
}
await mkdir(new URL('.', output), { recursive: true });
await writeFile(output, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile(new URL('content-lock.json', output), `${JSON.stringify({
  source: 'data/levels/levels.v0.4.json', contentVersion: content.contentVersion,
  gameplayMode: content.gameplayMode, inputMode: content.inputMode, levels: content.levels.length, sha256,
}, null, 2)}\n`);
console.log(`Synced ${content.levels.length} levels: ${fileURLToPath(output)}\nSHA-256 ${sha256}`);
