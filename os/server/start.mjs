import http from 'node:http';
import { createLaunchroom } from './launchroom.mjs';
import { loadRemoteConfig, listenRemote } from './launchroomTls.mjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';
import { createRunner } from './runner.mjs';
import { createHub } from './hub.mjs';
import { createScripts } from './scripts.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const workspaceRoot = process.env.MERRIVY_WORKSPACE_ROOT || path.resolve(root, '..');
const port = Number(process.env.PORT || 3000);
const remoteConfig = await loadRemoteConfig(workspaceRoot);
const launchroom = await createLaunchroom({workspaceRoot,port,remoteOrigin:remoteConfig?.origin||'',openLocal:true});
const hub = await createHub({ workspaceRoot, port });
// The health check (GET /api/doctor) reads the same read-only store map as the Assets page.
const api = await createApi({ workspaceRoot, storeMap: hub.storeMap });
const runner = await createRunner({ workspaceRoot, port });
const scripts = await createScripts({ workspaceRoot, port });
const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ttf':'font/ttf', '.webp':'image/webp', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const handler = (req,res) => launchroom(req,res,() => {
  hub(req,res,() => scripts.middleware(req,res,() => runner.middleware(req,res,() => api(req,res,async () => {
    if (req.method !== 'GET' || req.url.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }
    try {
      const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file = path.resolve(dist, '.' + pathname);
      if (!file.startsWith(dist + path.sep) && file !== dist) { res.writeHead(403); return res.end(); }
      let data; let ext = path.extname(file);
      try { data = await fs.readFile(file); } catch { data = await fs.readFile(path.join(dist,'index.html')); ext='.html'; }
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' }); res.end(data);
    } catch { res.writeHead(500); res.end('Build the app with npm run build before starting.'); }
  }))));
});
const server = http.createServer(handler);
const remoteServer = await listenRemote(remoteConfig, handler);
server.listen(port,'127.0.0.1',()=>console.log(`Launchroom http://localhost:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{await scripts.close();await runner.close();await launchroom.close?.();remoteServer?.close();server.close();});
