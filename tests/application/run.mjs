import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = [process.env.SHISE_TSC_PATH,
  '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js',
].filter(Boolean).find(path => existsSync(path));
if (!compiler) throw new Error('TypeScript compiler unavailable; set SHISE_TSC_PATH');
const build = mkdtempSync(join(tmpdir(), 'shise-progress-'));
try {
  const compile = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2020', '--module', 'commonjs',
    '--rootDir', join(root, 'game/assets/scripts'), '--outDir', build,
    join(root, 'game/assets/scripts/application/RestoreProgress.ts')], { cwd: root, stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const result = spawnSync(process.execPath, ['--test', join(root, 'tests/application/restore-progress.test.mjs')], {
      cwd: root, stdio: 'inherit', env: { ...process.env, SHISE_APPLICATION_BUILD: build },
    });
    process.exitCode = result.status ?? 1;
  }
} finally { rmSync(build, { recursive: true, force: true }); }
