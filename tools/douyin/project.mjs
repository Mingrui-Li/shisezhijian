#!/usr/bin/env node
/** Only public tt-minigame-ide-cli APIs are used; no IDE credentials are inspected. */
import { readFile, readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const toolDir = dirname(fileURLToPath(import.meta.url));
const repoDir = resolve(toolDir, '../..');
const require = createRequire(import.meta.url);
const [command = 'check', projectArgument] = process.argv.slice(2);
const allowed = new Set(['check', 'open', 'preview', 'session']);
const originalConsoleError = console.error.bind(console);
// The official package may log Axios request objects on telemetry failures.
// Keep diagnostic text, but never serialize third-party request/response objects.
console.error = (...values) => originalConsoleError(...values.map(value => {
  if (value instanceof Error) return value.message.slice(0, 400);
  if (typeof value === 'string') return value.slice(0, 1200);
  return '[third-party diagnostic details omitted]';
}));

async function exists(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

async function findProject() {
  if (projectArgument) return resolve(projectArgument);
  const root = join(repoDir, 'game/build');
  const directories = await readdir(root, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of directories) {
    if (!entry.isDirectory()) continue;
    const path = join(root, entry.name);
    if (await exists(join(path, 'game.json')) && await exists(join(path, 'project.config.json'))) {
      candidates.push(path);
    }
  }
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length) throw new Error('没有找到抖音构建产物。请先构建 Cocos bytedance-mini-game，或传入构建目录。');
  throw new Error('找到多个抖音构建目录，请在命令后传入本次构建的绝对路径。');
}

async function inspectProject(path) {
  for (const name of ['game.js', 'game.json', 'project.config.json']) {
    if (!await exists(join(path, name))) throw new Error(`目录缺少 ${name}，不能作为抖音小游戏导入：${path}`);
  }
  const config = JSON.parse(await readFile(join(path, 'project.config.json'), 'utf8'));
  const game = JSON.parse(await readFile(join(path, 'game.json'), 'utf8'));
  const appid = typeof config.appid === 'string' ? config.appid.trim() : '';
  // Placeholder values are never silently replaced with another game's AppID.
  const hasAppId = Boolean(appid) && !/YOUR|APP_?ID|PLACEHOLDER|TODO|^tt0+$/i.test(appid);
  return {
    path,
    projectName: config.projectname ?? config.projectName ?? '',
    compileType: config.compileType ?? config.compiletype ?? null,
    orientation: game.deviceOrientation ?? null,
    appIdConfigured: hasAppId,
    status: 'package-files-present',
  };
}

function getOfficialCli() {
  try { return require('tt-minigame-ide-cli'); }
  catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    throw new Error('缺少官方 CLI。运行 npm ci --prefix tools/douyin --ignore-scripts 后重试。');
  }
}

function print(value) { console.log(JSON.stringify(value, null, 2)); }

try {
  if (!allowed.has(command)) throw new Error('用法：node tools/douyin/project.mjs check|open|preview|session [抖音构建目录]');
  if (command === 'session') {
    const result = await getOfficialCli().checkSession();
    // Never print account names, tokens, cookies, or full response payloads.
    print({ cliSessionValid: result.isValid === true });
  } else {
    const project = await inspectProject(await findProject());
    if (command === 'check') {
      print(project);
    } else if (command === 'open') {
      try {
        await getOfficialCli().open({ project: { path: project.path, mode: 'lite' } });
      } catch (error) {
        if (process.platform !== 'darwin') throw error;
        // The installed IDE handles this public URL scheme; naming the app avoids a stale LaunchServices registration.
        const url = new URL('bytedanceide://open');
        url.searchParams.set('path', project.path);
        url.searchParams.set('project-type', 'microgame');
        url.searchParams.set('mode', 'lite');
        await promisify(execFile)('/usr/bin/open', ['-a', '/Applications/抖音开发者工具.app', url.toString()]);
      }
      print({ ...project, status: 'open-request-sent', note: '已通过官方 CLI 发出打开请求；不代表 IDE 编译或真机验收通过。' });
    } else {
      if (!project.appIdConfigured) throw new Error('构建产物尚未配置 AppID。请在抖音开发者工具中选择本项目的正式 AppID 或工具提供的测试号，再生成预览；测试号不能上传发布。');
      const cli = getOfficialCli();
      const session = await cli.checkSession();
      if (session.isValid !== true) throw new Error('官方 CLI 尚未登录或登录已过期。请由开发者通过官方 tmg login 完成登录；本工具不接收或读取账号密码。IDE 与 CLI 登录状态可能不同。');
      const outputDir = join(repoDir, 'artifacts/douyin-preview');
      await mkdir(outputDir, { recursive: true });
      const result = await cli.preview({
        project: { path: project.path },
        page: { path: '', query: '', scene: '', launchFrom: '', location: '' },
        qrcode: { format: 'imageFile', output: join(outputDir, 'preview.png') },
        cache: false,
        copyToClipboard: false,
      });
      if (typeof result.shortUrl !== 'string' || !result.shortUrl) throw new Error('官方接口未返回预览短链接，不能报告测试链接已生成。');
      const preview = {
        platform: 'douyin-mini-game',
        source: 'tt-minigame-ide-cli@2.1.2 preview',
        projectPath: project.path,
        shortUrl: result.shortUrl,
        expireTime: result.expireTime ?? null,
        generatedAt: new Date().toISOString(),
        qrCodePath: join(outputDir, 'preview.png'),
      };
      await writeFile(join(outputDir, 'preview.json'), JSON.stringify(preview, null, 2) + '\n');
      print(preview);
    }
  }
} catch (error) {
  // Official CLI internals may attach request data to errors; avoid dumping those.
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.replace(/(token|cookie|password|session_key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]').slice(0, 1200));
  process.exitCode = 1;
}
