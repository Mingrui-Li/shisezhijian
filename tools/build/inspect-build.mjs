import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = process.argv[2] || 'web-mobile';
if (!['web-mobile', 'douyin'].includes(target)) throw new Error('Target must be web-mobile or douyin');
const output = resolve(repository, 'game/build', target === 'douyin' ? 'bytedance-mini-game' : 'web-mobile');
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else {
      const data = readFileSync(path);
      files.push({ path: relative(output, path), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
}
walk(output);
files.sort((a, b) => a.path.localeCompare(b.path));
const result = JSON.parse(readFileSync(resolve(repository, `artifacts/build/${target}.result.json`), 'utf8'));
const checks = [];
function check(name, success, detail = '') { checks.push({ name, success: Boolean(success), detail }); }
check('Official Cocos CLI returned success code 36', result.success && result.exitCode === 36);
check('No gameplay source changed during build', result.sourceInputs && result.sourceChangedDuringBuild === false);
check('Build configuration did not change during compilation', result.configChangedDuringBuild === false);
check('Engine application entry emitted', existsSync(resolve(output, 'application.js')));
check('Main asset bundle emitted', existsSync(resolve(output, 'assets/main/config.json')));
check('Generated content bundle emitted', existsSync(resolve(output, 'assets/resources/config.json')));
const sourceContentPath = resolve(repository, 'game/assets/resources/generated/levels.json');
const sourceContent = JSON.parse(readFileSync(sourceContentPath, 'utf8'));
const contentMeta = JSON.parse(readFileSync(`${sourceContentPath}.meta`, 'utf8'));
const builtContentPath = resolve(output, 'assets/resources/import', contentMeta.uuid.slice(0, 2), `${contentMeta.uuid}.json`);
let builtContent = null;
function findContent(value) {
  if (!value || typeof value !== 'object') return;
  if (!Array.isArray(value) && value.gameplayMode === 'click-fill' && Array.isArray(value.levels)) {
    builtContent = value; return;
  }
  for (const child of Object.values(value)) if (!builtContent) findContent(child);
}
if (existsSync(builtContentPath)) findContent(JSON.parse(readFileSync(builtContentPath, 'utf8')));
check('All 100 click-fill levels are present', builtContent?.levels.length === 100 && builtContent?.inputMode === 'tap');
check('Compiled level data equals current fixed content exactly', builtContent && isDeepStrictEqual(sourceContent, builtContent));
let localAppId = null;
if (target === 'web-mobile') {
  const html = readFileSync(resolve(output, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  check('Cocos canvas is present', html.includes('GameCanvas'));
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(?:https?:|data:|\/\/)/.test(match[1])) continue;
    const path = match[1].split('?')[0];
    check(`HTML dependency ${path}`, existsSync(resolve(output, path)));
  }
} else {
  const gameConfig = JSON.parse(readFileSync(resolve(output, 'game.json'), 'utf8'));
  const projectConfig = JSON.parse(readFileSync(resolve(output, 'project.config.json'), 'utf8'));
  localAppId = projectConfig.appid;
  check('AppID matches official build input', localAppId === result.appid && Boolean(localAppId));
  check('Portrait Douyin mini game package', gameConfig.deviceOrientation === 'portrait');
  check('Douyin entry emitted', existsSync(resolve(output, 'game.js')));
  check('Cocos Douyin runtime adapters emitted', existsSync(resolve(output, 'engine-adapter.js')) && existsSync(resolve(output, 'web-adapter.js')));
}
const report = {
  target, verifiedAt: new Date().toISOString(), output,
  success: checks.every(item => item.success), checks,
  fileCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  localAppId, localDevelopmentOnly: target === 'douyin' && (!localAppId || /^testappid$/i.test(localAppId)),
  note: 'Package structure and official compiler verification only. This report does not assert browser, simulator, phone, or advertising runtime verification.',
  files,
};
writeFileSync(resolve(repository, `artifacts/build/${target}.manifest.json`), JSON.stringify(report, null, 2));
console.log(`${target}: ${report.success ? 'PASS' : 'FAIL'}; ${files.length} files; ${(report.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
for (const item of checks.filter(item => !item.success)) console.error(`FAIL: ${item.name}`);
process.exitCode = report.success ? 0 : 1;
