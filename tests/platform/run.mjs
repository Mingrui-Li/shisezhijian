import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = [process.env.SHISE_TSC_PATH,
  '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js',
].filter(Boolean).find(path => existsSync(path));
if (!compiler) throw new Error('TypeScript compiler unavailable; set SHISE_TSC_PATH');
const build = mkdtempSync(join(tmpdir(), 'shise-platform-'));
try {
  // LocalSave's only engine dependency is the injected synchronous storage default.
  const declaration = join(build, 'cc.d.ts');
  writeFileSync(declaration, 'declare module "cc" { export const sys: { isBrowser:boolean; localStorage: { getItem(key:string):string|null; setItem(key:string,value:string):void } }; }\n');
  mkdirSync(join(build, 'node_modules/cc'), { recursive: true });
  writeFileSync(join(build, 'node_modules/cc/index.js'), 'exports.sys = { isBrowser:false, localStorage: { getItem() { return null; }, setItem() {} } };\n');
  const compile = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2020', '--module', 'commonjs',
    '--rootDir', join(root, 'game/assets/scripts'), '--outDir', build,
    declaration, join(root, 'game/assets/scripts/platform/LocalSave.ts'),
    join(root, 'game/assets/scripts/platform/RewardedVideo.ts'),
    join(root, 'game/assets/scripts/platform/BrowserTestBridge.ts')], { cwd: root, stdio: 'inherit' });
  if (compile.status !== 0) process.exitCode = compile.status ?? 1;
  else {
    const result = spawnSync(process.execPath, ['--test', join(root, 'tests/platform/storage.test.mjs'),
      join(root, 'tests/platform/rewarded-video.test.mjs'), join(root, 'tests/platform/browser-bridge.test.mjs')], {
      cwd: root, stdio: 'inherit', env: { ...process.env, SHISE_PLATFORM_BUILD: build },
    });
    process.exitCode = result.status ?? 1;
  }
} finally { rmSync(build, { recursive: true, force: true }); }
