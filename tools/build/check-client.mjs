import { existsSync, mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const resources = process.env.SHISE_COCOS_RESOURCES
  || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources';
const compiler = process.env.SHISE_TSC_PATH || join(resources, 'app.asar.unpacked/node_modules/typescript/lib/tsc.js');
const declarations = join(resources, 'resources/3d/engine/bin/.declarations/cc.d.ts');
if (!existsSync(compiler) || !existsSync(declarations)) {
  throw new Error('Set SHISE_COCOS_RESOURCES to Cocos Creator 3.8.8 Contents/Resources.');
}
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? walk(join(path, entry.name)) : entry.name.endsWith('.ts') ? [join(path, entry.name)] : []);
const workspace = mkdtempSync(join(tmpdir(), 'shise-client-check-'));
try {
  const files = [...walk(join(root, 'game/assets/scripts')), declarations];
  const config = {
    compilerOptions: { target: 'ES2020', module: 'ESNext', moduleResolution: 'node', strict: true,
      experimentalDecorators: true, useDefineForClassFields: false, skipLibCheck: true, noEmit: true,
      lib: ['ES2020', 'DOM'] }, files,
  };
  const path = join(workspace, 'tsconfig.json');
  writeFileSync(path, JSON.stringify(config));
  const check = spawnSync(process.execPath, [compiler, '-p', path], { stdio: 'inherit' });
  if (check.status !== 0) { process.exitCode = check.status ?? 1; }
  else {
    const scene = JSON.parse(readFileSync(join(root, 'game/assets/scenes/Boot.scene'), 'utf8'));
    const meta = JSON.parse(readFileSync(join(root, 'game/assets/scripts/Boot.ts.meta'), 'utf8'));
    const hex = meta.uuid.replaceAll('-', '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let compressed = hex.slice(0, 5);
    for (let i = 5; i < hex.length; i += 3) {
      const value = parseInt(hex.slice(i, i + 3), 16);
      compressed += chars[value >> 6] + chars[value & 63];
    }
    if (!scene.some(item => item.__type__ === compressed)) throw new Error('Boot component UUID is not attached to scene');
    console.log('Client TypeScript checked against installed Cocos 3.8.8 declarations; Boot scene component link checked.');
    console.log('This is a static check, not an engine build or device test.');
  }
} finally { rmSync(workspace, { recursive: true, force: true }); }
