import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
  const contentPath = join(root, 'game/assets/resources/generated/levels.json');
  const contentBytes = readFileSync(contentPath);
  const content = JSON.parse(contentBytes.toString('utf8'));
  assert.equal(content.contentVersion, '0.6.0', 'Formal opening checks require the current accepted content');
  const openingLevels = content.levels.slice(0, 12);
  assert.equal(openingLevels.length, 12);
  assert.deepEqual(openingLevels.slice(0, 2).map(level => [level.grid.columns, level.grid.rows, level.initialPool.length]),
    [[4, 4, 5], [5, 5, 7]], 'Opening examples must use the real v0.6 L001 and L002');
  const cases = [
    ...[
      [844, 24, 20, 6, 6, 32], [844, 71, 46, 6, 6, 32],
      [694, 24, 20, 6, 6, 32], [932, 71, 46, 6, 6, 32],
      [844, 24, 20, 4, 4, 12], [694, 24, 20, 5, 5, 21],
    ].map((args, index) => ({ name: `generic-${index + 1}`, args })),
    ...openingLevels.flatMap(level => [[844, 24, 20], [844, 71, 46], [694, 24, 20]].map(viewport => ({
      name: level.id,
      args: [...viewport, level.grid.columns, level.grid.rows, level.initialPool.length],
    }))),
  ];
  const rows = cases.map(({ name, args }) => {
    const [height, top, bottom, columns, boardRows, count] = args;
    const layout = boardLayout(...args);
    assert.ok(layout.cellSize >= 44, 'Minimum board touch target on supported test viewports');
    const trayGap = layout.trayTop - layout.boardTop - layout.boardHeight;
    assert.ok(trayGap >= 30 && trayGap <= 56, 'Board and tray form one close functional group');
    if (boardRows >= 5) assert.ok(trayGap <= 40, 'Large boards keep a compact tray gap');
    assert.equal(layout.groupTop, layout.boardTop, 'Group begins with the board');
    assert.equal(layout.groupTop + layout.groupHeight, layout.trayTop + layout.trayHeight, 'Group contains both board and tray');
    assert.ok(layout.groupTop >= top + 92, 'Puzzle avoids the header and countdown');
    assert.ok(layout.trayTop + layout.trayHeight <= layout.actionsY - 32, 'Tray avoids footer actions');
    if (count > layout.slotsPerPage) {
      assert.ok(layout.pagerY - 20 >= layout.trayTop + layout.trayHeight, 'Paging controls avoid tray slots');
      assert.ok(layout.pagerY + 20 <= layout.actionsY - 22, 'Paging controls avoid footer touch targets');
    }
    assert.ok(columns * layout.cellSize + (columns - 1) * 6 <= 342, 'Board fits width');
    assert.ok(layout.propsY + 26 <= height - bottom, 'Controls avoid bottom safe area');
    const slots = [];
    for (let page = 0; page < Math.ceil(count / layout.slotsPerPage); page++) {
      for (let index = page * layout.slotsPerPage; index < Math.min(count, (page + 1) * layout.slotsPerPage); index++) slots.push(index);
    }
    assert.deepEqual(slots, Array.from({ length: count }, (_, i) => i), 'Every candidate tray slot is reachable once, independently of tile position');
    return { case: name, viewport: `390x${height}`, board: `${columns}x${boardRows}`, trayCount: count,
      cell: Number(layout.cellSize.toFixed(2)), trayGap, slotsPerPage: layout.slotsPerPage };
  });
  console.log(JSON.stringify({ status: 'passed', contentVersion: content.contentVersion,
    contentSha256: createHash('sha256').update(contentBytes).digest('hex'), caseCount: rows.length, cases: rows,
    scope: 'Pure layout geometry only; no browser, engine rendering or device input verified.' }, null, 2));
} finally { rmSync(output, { recursive: true, force: true }); }
