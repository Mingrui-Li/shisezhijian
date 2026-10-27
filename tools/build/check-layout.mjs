import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const compiler = process.env.SHISE_TSC_PATH
  || '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js';
if (!existsSync(compiler)) throw new Error('Set SHISE_TSC_PATH to typescript/lib/tsc.js');
const output = mkdtempSync(join(tmpdir(), 'shise-layout-'));
try {
  const result = spawnSync(process.execPath, [compiler, '--strict', '--target', 'ES2020', '--module', 'commonjs',
    '--outDir', output, join(root, 'game/assets/scripts/render/BoardLayout.ts')], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Layout compilation failed');
  const { boardLayout } = createRequire(import.meta.url)(join(output, 'BoardLayout.js'));
  const cases = [
    [844, 24, 20, 6, 6, 32], [844, 71, 46, 6, 6, 32],
    [694, 24, 20, 6, 6, 32], [932, 71, 46, 6, 6, 32],
    [844, 24, 20, 4, 4, 12], [694, 24, 20, 3, 1, 1],
  ];
  const rows = cases.map(args => {
    const [height, top, bottom, columns, boardRows, count] = args;
    const layout = boardLayout(...args);
    assert.ok(layout.cellSize >= 44, 'Minimum board touch target on supported test viewports');
    assert.ok(layout.trayTop >= layout.boardTop + layout.boardHeight + 30, 'Board and tray do not overlap');
    assert.ok(columns * layout.cellSize + (columns - 1) * 6 <= 342, 'Board fits width');
    assert.ok(layout.propsY + 26 <= height - bottom, 'Controls avoid bottom safe area');
    const homes = [];
    for (let page = 0; page < Math.ceil(count / layout.slotsPerPage); page++) {
      for (let index = page * layout.slotsPerPage; index < Math.min(count, (page + 1) * layout.slotsPerPage); index++) homes.push(index);
    }
    assert.deepEqual(homes, Array.from({ length: count }, (_, i) => i), 'Every stable tray slot is reachable once');
    return { viewport: `390x${height}`, board: `${columns}x${boardRows}`, trayCount: count,
      cell: Number(layout.cellSize.toFixed(2)), slotsPerPage: layout.slotsPerPage };
  });
  console.log(JSON.stringify({ status: 'passed', cases: rows,
    scope: 'Pure layout geometry only; no browser, engine rendering or device input verified.' }, null, 2));
} finally { rmSync(output, { recursive: true, force: true }); }
