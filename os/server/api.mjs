import { createStore } from './store.mjs';
import { ApiError, fail } from './domain.mjs';
import { createDoctor } from './doctor.mjs';
import { createStoreEditor } from './storeEditor.mjs';
import { readAgentPrompt, saveAgent, readSkillFile, saveSkill } from './team.mjs';
import { readConnectors, saveSignedIn } from './connectors.mjs';
import { readSchedules, removeSchedule, saveSchedule } from './schedules.mjs';

export const MAX_BODY_BYTES = 96 * 1024;
const localHosts = new Set(['localhost:3000', '127.0.0.1:3000']);
function localRequest(req, mutation) {
  if (!localHosts.has(req.headers.host?.toLowerCase())) fail('The OS API is available only on localhost:3000 or 127.0.0.1:3000.', 'LOCAL_HOST_REQUIRED', 403);
  const origin = req.headers.origin;
  if (origin) {
    let parsed; try { parsed = new URL(origin); } catch { fail('Invalid request origin.', 'LOCAL_ORIGIN_REQUIRED', 403); }
    if (parsed.protocol !== 'http:' || !localHosts.has(parsed.host) || parsed.origin !== origin) fail('Only the local OS origin may access this API.', 'LOCAL_ORIGIN_REQUIRED', 403);
  }
  if (mutation && !origin) fail('Mutations require the local browser Origin header.', 'LOCAL_ORIGIN_REQUIRED', 403);
  if (req.headers['sec-fetch-site'] === 'cross-site') fail('Cross-site API requests are unavailable.', 'LOCAL_ORIGIN_REQUIRED', 403);
}
async function body(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail('Send application/json for mutations.', 'JSON_REQUIRED', 415);
  const declared = Number(req.headers['content-length']); if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) fail('Request exceeds the 96 KB limit.', 'BODY_TOO_LARGE', 413);
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY_BYTES) fail('Request exceeds the 96 KB limit.', 'BODY_TOO_LARGE', 413); chunks.push(chunk); }
  let parsed; try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('Request contains malformed JSON.', 'MALFORMED_JSON'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('Request JSON must be an object.');
  return parsed;
}
function send(res, status, value) {
  res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(JSON.stringify(value));
}
// `storeMap` is the hub's read-only store map (start.mjs passes it) so the health check covers store pictures.
export function createApi({ workspaceRoot, storeMap = null, authorizeRequest = localRequest }) {
  const store = createStore({ workspaceRoot });
  const doctor = createDoctor({ workspaceRoot, store, storeMap });
  // The Store editor (owner, Oct 2): words and pictures in a product packet; diary lines and publish requests go through workspace notes.
  const storeEditor = createStoreEditor({ workspaceRoot, notes: { add: input => store.addWorkspaceNote(input), address: (id, response) => store.patchWorkspaceNote(id, { status: 'addressed', response }), workspace: () => store.getWorkspace() } });
  return async function api(req, res, next) {
    if (!req.url?.startsWith('/api/') && req.url !== '/api') return next?.();
    try {
      const mutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
      authorizeRequest(req, mutation);
      const url = new URL(req.url, 'http://localhost:3000'); const pathname = url.pathname;
      if (req.method === 'GET' && pathname === '/api/bootstrap') return send(res, 200, await store.bootstrap());
      if (req.method === 'GET' && pathname === '/api/research') return send(res, 200, await store.getResearch());
      if (req.method === 'GET' && pathname === '/api/curation') return send(res, 200, await store.getCuration());
      // The eye test is the owner's: a write from an agent (the helper's local-agent header) may not change it.
      if (req.method === 'PATCH' && pathname === '/api/research') return send(res, 200, await store.patchResearch(await body(req), {agent: req.headers['x-launchroom-local-agent'] === '1'}));
      if (req.method === 'GET' && pathname === '/api/workspace') return send(res, 200, await store.getWorkspace());
      if (req.method === 'GET' && pathname === '/api/planner') return send(res, 200, await store.getPlanner());
      if (req.method === 'GET' && pathname === '/api/memory/context') return send(res, 200, await store.getMemoryContext());
      if (req.method === 'GET' && pathname === '/api/memory/brief') return send(res, 200, await store.getBrief(url.searchParams.get('agent') || 'manager'));
      if (req.method === 'GET' && pathname === '/api/line') return send(res, 200, await store.getStep());
      if (req.method === 'GET' && pathname === '/api/pipeline') return send(res, 200, await store.getPipeline());
      if (req.method === 'GET' && pathname === '/api/pipeline/item') return send(res, 200, await store.getPipelineItem(url.searchParams.get('id')));
      if (req.method === 'GET' && pathname === '/api/rounds') return send(res, 200, await store.getRounds());
      // Work done ahead of the owner's Save (Oct 3): each card's Prove it file, summarised; read-only.
      if (req.method === 'GET' && pathname === '/api/prove-ahead') return send(res, 200, await store.getProveAhead());
      if (req.method === 'GET' && pathname === '/api/issues') return send(res, 200, await store.getIssues());
      if (req.method === 'POST' && pathname === '/api/rounds') return send(res, 200, await store.saveRounds(await body(req)));
      // Step 0 (owner, Oct 3): the owner's one-tap issue pick (Test this issue / Not now); an agent's write is refused (OWNER_DECISION_ONLY).
      if (req.method === 'POST' && pathname === '/api/issues/pick') return send(res, 200, await store.pickIssue(await body(req), {agent: req.headers['x-launchroom-local-agent'] === '1'}));
      // The owner's "Build this one" (with a reason); there is no helper command for it.
      if (req.method === 'POST' && pathname === '/api/workspace/build') { if (req.headers['x-launchroom-local-agent'] === '1') fail('Only the owner picks what builds. The manager records a pick the owner said in chat with os.mjs owner-said build and the owner\'s words.', 'OWNER_DECISION_ONLY', 403); return send(res, 200, await store.pickBuild(await body(req))); }
      // Owner decisions said in chat (Oct 3): the manager's one path, always with the owner's words; never from a headless run.
      if (req.method === 'POST' && pathname === '/api/owner-said') return send(res, 200, await store.ownerSaid(await body(req), {run: String(req.headers['x-launchroom-run'] || '')}));
      if (req.method === 'GET' && pathname === '/api/store-editor') return send(res, 200, await storeEditor.view(url.searchParams.get('packet') || ''));
      if (req.method === 'POST' && pathname === '/api/store-editor/save') return send(res, 200, await storeEditor.save(await body(req)));
      if (req.method === 'POST' && pathname === '/api/store-editor/undo') return send(res, 200, await storeEditor.undo(await body(req)));
      // Records a publish request (an open owner note) for the manager; the server never deploys.
      if (req.method === 'POST' && pathname === '/api/store-editor/publish') return send(res, 200, await storeEditor.publish(await body(req)));
      if (req.method === 'POST' && pathname === '/api/store-editor/clone') return send(res, 201, await storeEditor.clone(await body(req)));
      if (req.method === 'GET' && pathname === '/api/team/agent-prompt') return send(res, 200, await readAgentPrompt(workspaceRoot, url.searchParams.get('id') || ''));
      if (req.method === 'POST' && pathname === '/api/team/agent') return send(res, 200, await saveAgent(workspaceRoot, await body(req)));
      if (req.method === 'GET' && pathname === '/api/team/skill') return send(res, 200, await readSkillFile(workspaceRoot, url.searchParams.get('name') || ''));
      if (req.method === 'GET' && pathname === '/api/connectors') return send(res, 200, await readConnectors(workspaceRoot));
      if (req.method === 'POST' && pathname === '/api/connectors/signed-in') return send(res, 200, await saveSignedIn(workspaceRoot, await body(req)));
      if (req.method === 'GET' && pathname === '/api/schedules') return send(res, 200, await readSchedules(workspaceRoot));
      if (req.method === 'POST' && pathname === '/api/schedules') return send(res, 200, await saveSchedule(workspaceRoot, await body(req)));
      if (req.method === 'POST' && pathname === '/api/schedules/remove') return send(res, 200, await removeSchedule(workspaceRoot, await body(req)));
      if (req.method === 'POST' && pathname === '/api/team/skill') return send(res, 200, await saveSkill(workspaceRoot, await body(req)));
      if (req.method === 'GET' && pathname === '/api/doctor') return send(res, 200, await doctor.run());
      if (req.method === 'GET' && pathname === '/api/lessons') return send(res, 200, await store.getLessons());
      if (req.method === 'POST' && pathname === '/api/lessons') return send(res, 200, await store.saveLesson(await body(req)));
      if (req.method === 'GET' && pathname === '/api/library') return send(res, 200, await store.getLibrary());
      if (req.method === 'POST' && pathname === '/api/library') return send(res, 200, await store.saveLibraryEntry(await body(req)));
      if (req.method === 'GET' && pathname === '/api/library/search') return send(res, 200, await store.searchLibrary(url.searchParams.get('q') || ''));
      // The starting rules (os/data/rules.json): the kill line, the loss limit, the target cost per sale and more.
      if (req.method === 'GET' && pathname === '/api/rules') return send(res, 200, await store.getRules());
      if (req.method === 'POST' && pathname === '/api/rules') return send(res, 200, await store.saveRules(await body(req)));
      if (req.method === 'GET' && pathname === '/api/tools') return send(res, 200, await store.getTools());
      if (req.method === 'POST' && pathname === '/api/tools') return send(res, 200, await store.saveTool(await body(req)));
      if (req.method === 'POST' && pathname === '/api/planner/tasks') return send(res, 200, await store.savePlannerTask(await body(req)));
      if (req.method === 'POST' && pathname === '/api/planner/move') return send(res, 200, await store.movePlannerTasks(await body(req)));
      if (req.method === 'POST' && pathname === '/api/planner/delete') return send(res, 200, await store.deletePlannerTasks(await body(req), {by: req.headers['x-launchroom-local-agent'] === '1' ? 'agent' : 'owner'}));
      if (req.method === 'POST' && pathname === '/api/planner/restore') return send(res, 200, await store.restorePlannerTasks(await body(req)));
      if (req.method === 'POST' && pathname === '/api/workspace/notes') return send(res, 201, await store.addWorkspaceNote(await body(req)));
      const workspaceNote = pathname.match(/^\/api\/workspace\/notes\/([^/]+)$/);
      if (workspaceNote && req.method === 'PATCH') return send(res, 200, await store.patchWorkspaceNote(workspaceNote[1], await body(req)));
      if (req.method === 'PATCH' && pathname === '/api/workspace/handoff') return send(res, 200, await store.patchWorkspaceHandoff(await body(req)));
      if (req.method === 'POST' && pathname === '/api/workspace/review') return send(res, 201, await store.reviewWorkspaceCycle(await body(req)));
      if (req.method === 'GET' && pathname === '/api/scrape-runs') return send(res, 200, await store.getScrapeRuns());
      if (req.method === 'GET' && pathname === '/api/doc') return send(res, 200, await store.readDocument(url.searchParams.get('path')));
      if (req.method === 'GET' && pathname === '/api/activity') return send(res, 200, await store.getActivity());
      if (req.method === 'POST' && pathname === '/api/activity') {
        const report = await store.reportActivity(await body(req)); return send(res, report.created ? 201 : 200, report.record);
      }
      if (req.method === 'POST' && pathname === '/api/products') return send(res, 201, await store.createProduct(await body(req)));
      const buildPacket = pathname.match(/^\/api\/products\/([^/]+)\/build-packet$/);
      if (buildPacket && req.method === 'GET') return send(res, 200, await store.getBuildPacket(buildPacket[1], url.searchParams.get('marketId')));
      if (buildPacket && req.method === 'PATCH') return send(res, 200, await store.patchBuildPacket(buildPacket[1], url.searchParams.get('marketId'), await body(req)));
      const p = pathname.match(/^\/api\/products\/([^/]+)$/);
      if (p && req.method === 'GET') return send(res, 200, await store.getProduct(p[1]));
      if (p && req.method === 'PATCH') return send(res, 200, await store.patchProduct(p[1], await body(req)));
      const sc = pathname.match(/^\/api\/store-checks\/([^/]+)$/);
      if (sc && req.method === 'PATCH') return send(res, 200, await store.patchStoreCheck(sc[1], await body(req)));
      if (req.method === 'POST' && pathname === '/api/jobs') return send(res, 201, await store.createJob(await body(req)));
      const j = pathname.match(/^\/api\/jobs\/([^/]+)$/);
      if (j && req.method === 'PATCH') return send(res, 200, await store.patchJob(j[1], await body(req)));
      if (req.method === 'POST' && pathname === '/api/improvements') return send(res, 201, await store.createImprovement(await body(req)));
      const i = pathname.match(/^\/api\/improvements\/([^/]+)$/);
      if (i && req.method === 'PATCH') return send(res, 200, await store.patchImprovement(i[1], await body(req)));
      send(res, 404, { error: 'API route not found.', code: 'NOT_FOUND' });
    } catch (error) {
      if (res.writableEnded) return;
      const known = error instanceof ApiError;
      send(res, known ? error.status : 500, { error: known ? error.message : 'Local storage operation failed. Check file access and server output before retrying.', code: known ? error.code : 'STORAGE_ERROR', ...(error.details ? { details: error.details } : {}) });
      if (!known) console.error('Launchroom API:', error);
    }
  };
}
