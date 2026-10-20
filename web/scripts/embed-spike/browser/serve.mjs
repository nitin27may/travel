// Static server for the browser benchmark: the page, transformers.js, the ONNX Runtime wasm files and the pinned model snapshot.
// Everything is local, so nothing is fetched from a CDN. Large files are gzipped, as a CDN would. `?iso=1` pages get COOP/COEP
// so wasm threads can run. Start: node browser/serve.mjs <port>   Stop: kill the PID on that port.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { CACHE, HERE, MODEL } from '../common.mjs';

const port = Number(process.argv[2] ?? 4317);
const nm = path.join(HERE, 'node_modules');
const roots = [
  ['/lib/', path.join(nm, '@huggingface/transformers/dist/')],
  ['/ort/', path.join(nm, 'onnxruntime-web/dist/')],
  ['/models/pinned/', path.join(CACHE, 'models', MODEL.id, MODEL.revision) + path.sep],
  ['/', path.join(HERE, 'browser') + path.sep],
];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream' };
const gz = new Map();

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const hit = roots.find(([p]) => url.pathname.startsWith(p));
  const file = hit ? path.join(hit[1], decodeURIComponent(url.pathname.slice(hit[0].length))) : '';
  if (!hit || !file.startsWith(hit[1]) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end('not found'); return; }
  const ext = path.extname(file);
  const headers = { 'content-type': types[ext] ?? 'text/plain', 'cache-control': 'no-store' };
  if (url.searchParams.get('iso') === '1' || req.headers.referer?.includes('iso=1')) {
    headers['cross-origin-opener-policy'] = 'same-origin';
    headers['cross-origin-embedder-policy'] = 'require-corp';
    headers['cross-origin-resource-policy'] = 'same-origin';
  }
  let body = readFileSync(file);
  if (/gzip/.test(req.headers['accept-encoding'] ?? '') && ['.onnx', '.wasm', '.js', '.mjs', '.json'].includes(ext)) {
    if (!gz.has(file)) gz.set(file, gzipSync(body, { level: 9 }));
    body = gz.get(file);
    headers['content-encoding'] = 'gzip';
  }
  res.writeHead(200, headers).end(body);
}).listen(port, '127.0.0.1', () => console.log(`serving on ${port}`));
