import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, createWriteStream, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const target = process.argv[2] || 'web-mobile';
if (!['web-mobile', 'douyin'].includes(target)) {
  console.error('Usage: node tools/build/build-cocos.mjs [web-mobile|douyin]');
  process.exit(2);
}
const editor = process.env.COCOS_EDITOR || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/MacOS/CocosCreator';
if (!existsSync(editor)) throw new Error(`Cocos Creator 3.8.8 is required. Set COCOS_EDITOR to its executable: ${editor}`);
const project = resolve(repository, 'game');
const logDirectory = resolve(repository, 'artifacts/build');
mkdirSync(logDirectory, { recursive: true });
let configPath = resolve(repository, `tools/build/${target}.json`);
if (target === 'douyin' && process.env.DOUYIN_APP_ID) {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.packages['bytedance-mini-game'].appid = process.env.DOUYIN_APP_ID;
  configPath = resolve(logDirectory, 'douyin.local.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}
const logPath = resolve(logDirectory, `${target}.log`);
const buildConfiguration = JSON.parse(readFileSync(configPath, 'utf8'));
const configSha256 = createHash('sha256').update(readFileSync(configPath)).digest('hex');
const appid = target === 'douyin' ? buildConfiguration.packages['bytedance-mini-game'].appid : null;
const localDevelopmentOnly = target === 'douyin' && (!appid || /^testappid$/i.test(appid));
const log = createWriteStream(logPath, { flags: 'w' });
const startedAt = new Date().toISOString();
function inputSnapshot() {
  const entries = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:ts|scene|json|png|wav|ejs)$/.test(path)) {
        entries.push([relative(project, path), createHash('sha256').update(readFileSync(path)).digest('hex')]);
      }
    }
  }
  walk(resolve(project, 'assets'));
  if (existsSync(resolve(project, 'build-templates'))) walk(resolve(project, 'build-templates'));
  for (const path of ['package.json', 'settings/v2/packages/engine.json', 'settings/v2/packages/project.json']) {
    entries.push([path, createHash('sha256').update(readFileSync(resolve(project, path))).digest('hex')]);
  }
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return { digest: createHash('sha256').update(JSON.stringify(entries)).digest('hex'), files: entries };
}
const sourceInputs = inputSnapshot();
const arguments_ = ['--project', project, '--build', `configPath=${configPath}`];
console.log(`Building ${target} with Cocos Creator 3.8.8. Log: ${logPath}`);
const child = spawn(editor, arguments_, { cwd: project, stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', chunk => { log.write(chunk); if (process.env.COCOS_VERBOSE) process.stdout.write(chunk); });
child.stderr.on('data', chunk => { log.write(chunk); if (process.env.COCOS_VERBOSE) process.stderr.write(chunk); });
child.on('error', error => { log.end(String(error)); console.error(error); process.exitCode = 1; });
child.on('close', (code, signal) => {
  log.end();
  // Cocos documents 36 as the successful command-line build exit code.
  const output = resolve(project, 'build', target === 'douyin' ? 'bytedance-mini-game' : 'web-mobile');
  const entry = resolve(output, target === 'douyin' ? 'game.js' : 'index.html');
  const success = code === 36 && existsSync(entry);
  const sourceInputsAfter = inputSnapshot();
  const report = { target, startedAt, finishedAt: new Date().toISOString(), editor, project,
    configPath, configSha256, configChangedDuringBuild: configSha256 !== createHash('sha256').update(readFileSync(configPath)).digest('hex'),
    output, logPath, exitCode: code, signal, success, appid, localDevelopmentOnly,
    sourceInputs, sourceChangedDuringBuild: sourceInputs.digest !== sourceInputsAfter.digest,
    note: localDevelopmentOnly
      ? 'No real AppID supplied. This is a local development package only; Cocos may emit its own testappid placeholder.' : '' };
  writeFileSync(resolve(logDirectory, `${target}.result.json`), JSON.stringify(report, null, 2));
  console.log(success ? `Build succeeded: ${output}` : `Build failed; inspect ${logPath}`);
  process.exitCode = success ? 0 : 1;
});
