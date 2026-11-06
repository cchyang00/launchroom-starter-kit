// The agent browser (owner, Nov 5): "We could have our in-browser here where it launches, and
// the agents completely control that browser ... it allows you to sign in once only and then
// it lives in that browser as your google chrome profile basically."
//
// One dedicated Chrome profile with its control port (Chrome DevTools Protocol) on this
// computer only. The owner signs in to each site once in it; agents then work in it (Claude
// through the Claude in Chrome extension installed in that profile, other agents through the
// port). Launchroom starts it, lists its tabs, shows a picture of a tab, opens a sign-in page,
// brings a tab to the front and closes the browser it started. It never reads cookies,
// passwords or page contents, and tab links lose their query and fragment before they leave.
// Only the owner's own browser on this computer reaches these routes (launchroom.mjs).
import {spawn} from 'node:child_process';
import {mkdir, readFile, stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// 9333, not 9222: the owner's personal Chrome already listens on 9222 (Nov 5), and that one stays theirs.
export const AGENT_BROWSER_PORT = Number(process.env.LAUNCHROOM_AGENT_BROWSER_PORT) || 9333;
const CHROME_PATHS = [
  process.env.LAUNCHROOM_CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].filter(Boolean);
const TARGET_ID = /^[A-Fa-f0-9]{16,64}$/;

export function defaultProfileDir() {
  return process.env.LAUNCHROOM_AGENT_BROWSER_PROFILE || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'Launchroom', 'agent-browser');
}

/** A tab link without its query or fragment (they can carry sign-in codes). */
export function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return {url: '', host: ''};
    return {url: `${url.origin}${url.pathname}`, host: url.host.replace(/^www\./, '')};
  } catch {return {url: '', host: ''};}
}

/** Tabs worth showing: real pages, not DevTools, extensions or Chrome's own pages. */
export function visibleTabs(list = []) {
  return (Array.isArray(list) ? list : [])
    .filter(target => target?.type === 'page' && TARGET_ID.test(target.id || '') && !/^(devtools|chrome-extension|chrome-untrusted):/i.test(target.url || ''))
    .map(target => {
      const blank = /^(about:blank|chrome:\/\/newtab)/i.test(target.url || '');
      const title = String(target.title || '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, '\'').replace(/&quot;/g, '"').slice(0, 200);
      return {id: target.id, title: blank ? 'New tab' : title, ...safeUrl(target.url), blank};
    });
}

/** The --user-data-dir in a Chrome command line, or ''. */
export function profileFromCommandLine(args = []) {
  for (const arg of Array.isArray(args) ? args : []) {
    const match = /^--user-data-dir=(.+)$/.exec(String(arg));
    if (match) return match[1].replace(/^"|"$/g, '');
  }
  return '';
}
const maskHome = value => value ? value.replace(os.homedir(), '~') : '';

export function createAgentBrowser({port = AGENT_BROWSER_PORT, profileDir = defaultProfileDir(), chromePaths = CHROME_PATHS, fetchImpl = fetch, spawnImpl = spawn} = {}) {
  const base = `http://127.0.0.1:${port}`;
  async function get(pathname, {method = 'GET', timeout = 1500} = {}) {
    const response = await fetchImpl(`${base}${pathname}`, {method, signal: AbortSignal.timeout(timeout)});
    if (!response.ok) throw Object.assign(new Error(`The agent browser answered ${response.status}.`), {status: response.status});
    return response.json();
  }
  async function version() {try {return await get('/json/version', {timeout: 800});} catch {return null;}}

  /** One DevTools command over a websocket, then close. */
  function command(wsUrl, method, params = {}, timeout = 6000) {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const timer = setTimeout(() => {try {socket.close();} catch {} reject(Object.assign(new Error('The tab did not answer in time.'), {code: 'TIMEOUT'}));}, timeout);
      socket.addEventListener('open', () => socket.send(JSON.stringify({id: 1, method, params})));
      socket.addEventListener('message', event => {
        let message; try {message = JSON.parse(String(event.data));} catch {return;}
        if (message.id !== 1) return;
        clearTimeout(timer); try {socket.close();} catch {}
        if (message.error) reject(new Error(message.error.message || 'The browser refused.')); else resolve(message.result);
      });
      socket.addEventListener('error', () => {clearTimeout(timer); reject(new Error('Could not reach the agent browser.'));});
    });
  }
  /**
   * Whether the browser on the port is the one using our profile. Chrome writes its control
   * port into <profile>/DevToolsActivePort when it does, and holds <profile>/lockfile while it
   * runs (Windows). Browser.getBrowserCommandLine only answers with --enable-automation,
   * which we don't want on a browser people sign in to.
   */
  async function isOurs() {
    try {return (await readFile(path.join(profileDir, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0].trim() === String(port);} catch {}
    try {await stat(path.join(profileDir, 'lockfile')); return true;} catch {return false;}
  }

  async function status() {
    const info = await version();
    if (!info) return {running: false, port, profile: maskHome(profileDir), tabs: []};
    const [list, ours] = await Promise.all([get('/json/list').catch(() => []), isOurs()]);
    return {running: true, port, browser: String(info.Browser || ''), ours, profile: maskHome(profileDir), tabs: visibleTabs(list)};
  }

  async function findChrome() {
    for (const candidate of chromePaths) {try {if ((await stat(candidate)).isFile()) return candidate;} catch {}}
    throw Object.assign(new Error('Chrome was not found on this computer.'), {status: 404, code: 'NO_CHROME'});
  }

  async function start() {
    if (await version()) return status();
    const chrome = await findChrome();
    await mkdir(profileDir, {recursive: true});
    const child = spawnImpl(chrome, [`--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'], {detached: true, stdio: 'ignore', windowsHide: false});
    child.unref?.();
    for (let i = 0; i < 40; i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      if (await version()) return status();
    }
    throw Object.assign(new Error(`Chrome started but its control port (${port}) did not open. Another program may be using that port, or another window is using this profile.`), {status: 504, code: 'NO_PORT'});
  }

  async function stop() {
    const info = await version();
    if (!info) return status();
    if (!(await isOurs())) throw Object.assign(new Error('The browser on this port is not the agent browser Launchroom started, so it stays open.'), {status: 409, code: 'NOT_OURS'});
    await command(info.webSocketDebuggerUrl, 'Browser.close', {}, 3000).catch(() => {});
    for (let i = 0; i < 20; i++) {if (!(await version())) break; await new Promise(resolve => setTimeout(resolve, 200));}
    return status();
  }

  async function tabById(id) {
    if (!TARGET_ID.test(id || '')) throw Object.assign(new Error('Unknown tab.'), {status: 400});
    const target = (await get('/json/list')).find(item => item.id === id && item.type === 'page');
    if (!target) throw Object.assign(new Error('That tab is closed.'), {status: 404});
    return target;
  }

  /** A JPEG of one tab, or null when the tab can't draw (in the background, or busy). */
  async function picture(id) {
    const target = await tabById(id);
    try {
      const result = await command(target.webSocketDebuggerUrl, 'Page.captureScreenshot', {format: 'jpeg', quality: 55, optimizeForSpeed: true}, 4000);
      return Buffer.from(result.data, 'base64');
    } catch {return null;}
  }

  async function open(rawUrl) {
    let url; try {url = new URL(String(rawUrl || ''));} catch {throw Object.assign(new Error('Use a full https:// link.'), {status: 400});}
    if (!['https:', 'http:'].includes(url.protocol)) throw Object.assign(new Error('Use a full https:// link.'), {status: 400});
    if (!(await version())) await start();
    await get(`/json/new?${encodeURI(url.href)}`, {method: 'PUT', timeout: 4000});
    return status();
  }

  /**
   * A sign-in check visit: opens the page in a background tab, waits until it stops moving,
   * reads where it landed, and closes the tab. Only the tab's address is read.
   */
  async function visit(url) {
    const info = await version();
    if (!info) throw Object.assign(new Error('Press Connect first: the agent browser is off.'), {status: 409, code: 'NOT_CONNECTED'});
    const {targetId} = await command(info.webSocketDebuggerUrl, 'Target.createTarget', {url, background: true}, 4000);
    const started = Date.now();
    let last = '', since = Date.now();
    try {
      while (Date.now() - started < 12000) {
        await new Promise(resolve => setTimeout(resolve, 600));
        const target = (await get('/json/list').catch(() => [])).find(item => item.id === targetId);
        const now = target?.url || '';
        if (now !== last) {last = now; since = Date.now();}
        if (now && !/^about:blank/i.test(now) && Date.now() - since >= 1800) break;
      }
      return last;
    } finally {
      await command(info.webSocketDebuggerUrl, 'Target.closeTarget', {targetId}, 3000).catch(() => {});
    }
  }

  async function focus(id) {
    await tabById(id);
    const response = await fetchImpl(`${base}/json/activate/${id}`, {signal: AbortSignal.timeout(2000)});
    if (!response.ok) throw Object.assign(new Error('Could not bring that tab forward.'), {status: 502});
    return status();
  }

  return {status, start, stop, picture, open, focus, visit, port, profileDir};
}

/** Routes under /api/agent-browser. The gateway has already checked it's the owner on this computer. */
export function agentBrowserMiddleware(browser, {readBody}) {
  const send = (res, code, value) => {res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(value));};
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;
    if (!route.startsWith('/api/agent-browser')) return next();
    try {
      if (req.method === 'GET' && route === '/api/agent-browser') return send(res, 200, await browser.status());
      if (req.method === 'GET' && route === '/api/agent-browser/picture') {
        const image = await browser.picture(url.searchParams.get('id') || '');
        if (!image) {res.writeHead(204, {'Cache-Control': 'no-store'}); return res.end();}
        res.writeHead(200, {'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': image.length});
        return res.end(image);
      }
      if (req.method === 'POST' && route === '/api/agent-browser/start') return send(res, 200, await browser.start());
      if (req.method === 'POST' && route === '/api/agent-browser/stop') return send(res, 200, await browser.stop());
      if (req.method === 'POST' && route === '/api/agent-browser/open') return send(res, 200, await browser.open((await readBody(req)).url));
      if (req.method === 'POST' && route === '/api/agent-browser/focus') return send(res, 200, await browser.focus((await readBody(req)).id));
      return send(res, 404, {error: 'Unknown agent browser route.'});
    } catch (error) {
      return send(res, error.status || 500, {error: error.message || 'The agent browser failed.', code: error.code || 'AGENT_BROWSER'});
    }
  };
}
