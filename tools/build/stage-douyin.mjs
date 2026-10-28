// Keep one complete, verified import directory outside Cocos's disposable build output.
import { readFile, mkdir, cp, rename, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
execFileSync(process.execPath, [join(root, 'tools/build/inspect-build.mjs'), 'douyin'], { stdio: 'inherit' });
const report = JSON.parse(await readFile(join(root, 'artifacts/build/douyin.manifest.json'), 'utf8'));
const releases = join(root, 'releases');
const destination = join(releases, 'douyin');
const temporary = join(releases, `.douyin-staging-${process.pid}`);
const previous = join(releases, `.douyin-previous-${process.pid}`);
await mkdir(releases, { recursive: true });
async function verify(directory) {
  for (const file of report.files) {
    const bytes = await readFile(join(directory, file.path));
    if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Package changed: ${file.path}`);
  }
}
let movedPrevious = false;
try {
  await cp(report.output, temporary, { recursive: true, errorOnExist: true, force: false });
  await verify(temporary);
  try { await rename(destination, previous); movedPrevious = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await rename(temporary, destination); }
  catch (error) { if (movedPrevious) await rename(previous, destination); throw error; }
  await verify(destination);
  // Explicit user request: retain only the currently delivered Douyin project, no older versions.
  if (movedPrevious) await rm(previous, { recursive: true, force: true });
  for (const entry of await readdir(releases, { withFileTypes: true })) {
    if (entry.isDirectory() && /^douyin-test-[a-f0-9]{12}$/.test(entry.name))
      await rm(join(releases, entry.name), { recursive: true, force: true });
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
console.log(`Verified import directory: ${destination}`);
