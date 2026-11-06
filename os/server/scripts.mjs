import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SCRIPTS = [
  { id: 'verify-app', title: 'Verify app', description: 'Run the local app tests against temporary fixtures. No agent runs or business-data changes.' },
  { id: 'build-app', title: 'Build app', description: 'Build the React app into os/dist. Does not publish or deploy.' },
];
const TEST_FILES = ['documentPaths.test.mjs', 'domain.test.mjs', 'hub.test.mjs', 'runner.test.mjs', 'scripts.test.mjs', 'workspace.test.mjs'];
const MAX_OUTPUT = 64000;
const error = (status, message) => Object.assign(new Error(message), { status });
const within = (root, target) => { const relative = path.relative(root, target); return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); };
function respond(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function checkRequest(req, port) {
  const local = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (!local.has(req.headers.host) || req.headers.origin !== `http://${req.headers.host}`) throw error(403, 'Same local Host and Origin required.');
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw error(415, 'application/json required.');
  if (Number(req.headers['content-length']) > 1024) throw error(413, 'Request too large.');
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if (length > 1024) throw error(413, 'Request too large.'); chunks.push(chunk); }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw error(400, 'A JSON object body is required.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length) throw error(400, 'Send an empty object. Script arguments and commands are not accepted.');
}

/** Runs are runtime-only and disappear when the local server restarts. */
export async function createScripts({ workspaceRoot, port = 3000, spawnImpl = spawn }) {
  const root = await fs.realpath(workspaceRoot);
  const appRoot = path.join(root, 'os');
  const runs = [];
  let active = null, starting = false, closed = false;
  async function safeFile(relative, allowedRoot = appRoot) {
    const file = path.join(root, relative);
    const resolved = await fs.realpath(file);
    if (!within(root, resolved) || !within(allowedRoot, resolved) || !(await fs.stat(resolved)).isFile()) throw error(400, 'Script entry must be a file inside the local app.');
    return resolved;
  }
  async function command(id) {
    const cwd = await fs.realpath(appRoot);
    if (!within(root, cwd) || cwd !== appRoot) throw error(400, 'Linked app directories are not allowed.');
    if (id === 'build-app') return { cwd, args: [await safeFile('os/node_modules/vite/bin/vite.js', path.join(appRoot, 'node_modules')), 'build'] };
    const files = [];
    for (const filename of TEST_FILES) {
      try { files.push(await safeFile(`os/server/${filename}`, path.join(appRoot, 'server'))); }
      catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    if (!files.length) throw error(409, 'No supported app tests are installed.');
    return { cwd, args: ['--test', ...files] };
  }
  function finish(run, child, status, code = null, message) {
    if (run.status !== 'running') return;
    run.status = status; run.exitCode = code; run.finishedAt = new Date().toISOString();
    if (message) run.error = message;
    if (active && active.child === child) { clearTimeout(active.timer); active = null; }
  }
  function start(id, plan) {
    const run = { id: randomUUID(), scriptId: id, title: SCRIPTS.find(s => s.id === id).title, status: 'running', startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, output: '', outputTruncated: false };
    runs.unshift(run); runs.splice(30);
    let child;
    try {
      child = spawnImpl(process.execPath, plan.args, { cwd: plan.cwd, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      const collect = chunk => {
        if (run.status !== 'running') return;
        const combined = run.output + chunk.toString();
        if (combined.length > MAX_OUTPUT) run.outputTruncated = true;
        run.output = combined.slice(-MAX_OUTPUT);
      };
      child.stdout?.on('data', collect); child.stderr?.on('data', collect);
      const timer = setTimeout(() => { child.kill(); finish(run, child, 'failed', null, 'Script exceeded the 10-minute time limit.'); }, 10 * 60 * 1000);
      timer.unref?.();
      active = { child, run, timer };
      child.once('error', () => finish(run, child, 'failed', null, 'The local script process could not start.'));
      child.once('close', (code, signal) => finish(run, child, code === 0 ? 'completed' : 'failed', code, code !== 0 ? (signal ? `Script stopped (${signal}).` : 'Script returned an error; inspect the output.') : undefined));
    } catch { finish(run, child, 'failed', null, 'The local script process could not start.'); }
    return run;
  }
  const middleware = async (req, res, next) => {
    let route;
    try { route = new URL(req.url, 'http://localhost').pathname; } catch { return next?.(); }
    if (route !== '/api/scripts' && !route.startsWith('/api/scripts/')) return next?.();
    try {
      if (req.method === 'GET' && route === '/api/scripts') return respond(res, 200, { scripts: SCRIPTS, runs, history: 'runtime-only' });
      const match = /^\/api\/scripts\/([^/]+)\/run$/.exec(route);
      if (req.method !== 'POST' || !match) return respond(res, 405, { error: 'Method not allowed.' });
      await checkRequest(req, port);
      const id = match[1];
      if (!SCRIPTS.some(script => script.id === id)) throw error(404, 'Unknown script.');
      if (closed) throw error(503, 'Script runner is shutting down.');
      if (starting || active) throw error(409, 'A script is already running. Wait for it to finish.');
      starting = true;
      try {
        const plan = await command(id);
        if (closed) throw error(503, 'Script runner is shutting down.');
        return respond(res, 202, { run: start(id, plan) });
      } finally { starting = false; }
    } catch (e) { return respond(res, e.status ?? (e.code === 'ENOENT' ? 409 : 500), { error: e.status ? e.message : e.code === 'ENOENT' ? 'Script dependencies are missing. Install the local app dependencies first.' : 'Local script operation failed.' }); }
  };
  const close = async () => {
    closed = true;
    if (active) { const { child, run } = active; child.kill(); finish(run, child, 'cancelled', null, 'Local server stopped.'); }
  };
  return { middleware, close };
}
