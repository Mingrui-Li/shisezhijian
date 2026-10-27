import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = await realpath(fileURLToPath(new URL('../../game/build/web-mobile/', import.meta.url)));
const port = Number(process.env.SHISE_PREVIEW_PORT || 7456);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const candidate = resolve(directory, `.${path === '/' ? '/index.html' : path}`);
    const file = await realpath(candidate);
    if (!file.startsWith(directory + sep) || !(await stat(file)).isFile()) throw new Error('Not found');
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : await readFile(file));
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Cocos test build: http://127.0.0.1:${port}/\nServing only ${directory}`));
