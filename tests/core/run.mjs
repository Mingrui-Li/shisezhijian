import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const candidates = [
  process.env.SHISE_TSC_PATH,
  '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js',
].filter(Boolean);
const compiler = candidates.find(path => existsSync(path));
if (!compiler) throw new Error('TypeScript compiler unavailable; set SHISE_TSC_PATH to typescript/lib/tsc.js');
const build = mkdtempSync(join(tmpdir(), 'shise-core-'));
try {
  const compile = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2020', '--module', 'commonjs', '--outDir', build,
    join(root, 'game/assets/scripts/core/index.ts')], { cwd: root, stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const test = spawnSync(process.execPath, ['--test', join(root, 'tests/core/core.test.mjs')], {
      cwd: root, stdio: 'inherit', env: { ...process.env, SHISE_CORE_BUILD: join(build, 'index.js') },
    });
    process.exitCode = test.status ?? 1;
  }
} finally {
  rmSync(build, { recursive: true, force: true });
}
