/* Starts docs/v2/prototypes/serve.py on a free port; serve.py serves the prototypes folder as the site root, so /shared/ is served too. */
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const SERVE_PY = path.resolve(__dirname, '..', '..', 'serve.py');

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}
async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('prototype server did not start: ' + url);
}
/** @returns {Promise<{url: string, port: number, stop: () => void}>} */
async function startServer() {
  const port = await freePort();
  const child = spawn('python3', [SERVE_PY, String(port)], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(url + '/themes.css', 10000);
  return { url, port, stop: () => child.kill() };
}
module.exports = { startServer, SERVE_PY };
