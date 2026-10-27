// Publish a verified, immutable import directory outside Cocos's disposable build output.
import { readFile, mkdir, cp, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
execFileSync(process.execPath, [join(root, 'tools/build/inspect-build.mjs'), 'douyin'], { stdio: 'inherit' });
const report = JSON.parse(await readFile(join(root, 'artifacts/build/douyin.manifest.json'), 'utf8'));
const digest = createHash('sha256').update(JSON.stringify(report.files)).digest('hex').slice(0, 12);
const destination = join(root, 'releases', `douyin-test-${digest}`);
await mkdir(join(root, 'releases'), { recursive: true });
async function verify(directory) {
  for (const file of report.files) {
    const bytes = await readFile(join(directory, file.path));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Package changed: ${file.path}`);
  }
}
let existing = false;
try { await readFile(join(destination, 'project.config.json')); existing = true; }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing) {
  await verify(destination);
} else {
  const temporary = `${destination}.staging-${process.pid}`;
  try {
    await cp(report.output, temporary, { recursive: true, errorOnExist: true, force: false });
    await verify(temporary);
    await rename(temporary, destination);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
console.log(`Verified import directory: ${destination}`);
