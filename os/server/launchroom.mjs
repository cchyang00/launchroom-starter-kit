import path from 'node:path';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createLaunchroomAuth } from './launchroomAuth.mjs';
import { createLaunchroomProjects } from './launchroomProjects.mjs';
import { createApi } from './api.mjs';
import { createHub } from './hub.mjs';
import { createClaudeRunner } from './claudeRunner.mjs';
import { agentBrowserMiddleware, createAgentBrowser } from './agentBrowser.mjs';
import { checkConnectors } from './connectors.mjs';

const LOOPBACK = new Set(['127.0.0.1','::1','::ffff:127.0.0.1']);
const MUTATIONS = new Set(['POST','PUT','PATCH','DELETE']);
const fail = (status, message) => Object.assign(new Error(message), {status});
const local = req => LOOPBACK.has(req.socket?.remoteAddress);
const cookieName = req => req.socket?.encrypted ? '__Host-launchroom' : 'launchroom-local';
function token(req) {
  const name = cookieName(req);
  return (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1) || '';
}
function cookie(req,res,value,expiresAt) {
  res.setHeader('Set-Cookie', `${cookieName(req)}=${value}; Path=/; HttpOnly; SameSite=Strict${req.socket?.encrypted?'; Secure':''}; Max-Age=${value?Math.max(0,Math.floor((Date.parse(expiresAt)-Date.now())/1000)):0}`);
}
function json(res,status,value) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(value));
}
async function body(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw fail(415,'Send JSON.');
  let size=0;const chunks=[];
  for await (const c of req) {size+=c.length;if(size>32*1024)throw fail(413,'Request too large.');chunks.push(c);}
  try {const v=JSON.parse(Buffer.concat(chunks));if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch {throw fail(400,'Invalid JSON.');}
}
function publicProject({root,...project}) {return project;}
// One "bytes=a-b", "bytes=a-" or "bytes=-n" range; anything else is ignored (full body).
export function byteRange(header,size) {
  const match=typeof header==='string'&&header.match(/^bytes=(\d*)-(\d*)$/);
  if(!match||(!match[1]&&!match[2]))return null;
  let start,end;
  if(!match[1]){const suffix=Number(match[2]);if(!suffix)return 'unsatisfiable';start=Math.max(0,size-suffix);end=size-1;}
  else {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return 'unsatisfiable';
  return {start,end};
}

// A request is delegated only after original Host/Origin, session and project membership
// checks. No localhost-header rewriting or trust in X-Forwarded-* is used.
export async function createLaunchroom({workspaceRoot,port=3000,remoteOrigin='',development=false,claude={},openLocal=false}) {
  const dataDir=path.join(workspaceRoot,'os','private','launchroom');
  const auth=await createLaunchroomAuth({dataDir});
  const projects=await createLaunchroomProjects({workspaceRoot,dataDir});
  const accepted=new WeakSet(), handlers=new Map();
  const localOrigins=new Set([`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`]);
  if(remoteOrigin && (new URL(remoteOrigin).protocol!=='https:'||new URL(remoteOrigin).origin!==remoteOrigin))throw Error('LAUNCHROOM_REMOTE_ORIGIN must be one exact HTTPS origin.');
  function localControl(req) {
    const origin=`http://${req.headers.host}`;
    // A TLS proxy may connect from loopback. Local privileges still belong only
    // to plaintext loopback requests for the exact local application origin.
    return local(req)&&!req.socket?.encrypted&&localOrigins.has(origin)
      &&(!req.headers.origin||req.headers.origin===origin);
  }
  function checkOrigin(req) {
    const origin=`${req.socket?.encrypted?'https':'http'}://${req.headers.host}`;
    if (!(local(req)&&localOrigins.has(origin)) && !(req.socket?.encrypted&&remoteOrigin&&origin===remoteOrigin)) throw fail(403,'This address is not an enabled Launchroom entry point.');
    if(req.headers.origin && req.headers.origin!==origin)throw fail(403,'Use the same Launchroom origin.');
    if(MUTATIONS.has(req.method)&&!req.headers.origin)throw fail(403,'An Origin header is required.');
    const navigationPath=(req.url||'').split('?')[0];
    const entryNavigation=['GET','HEAD'].includes(req.method)
      &&(navigationPath==='/'||/^\/p\/[a-z0-9-]+\/?$/.test(navigationPath));
    // External links may open the app shell. APIs and mutations retain the
    // cross-site block; scoped entry pages still pass session/membership checks.
    if(req.headers['sec-fetch-site']==='cross-site'&&!entryNavigation)throw fail(403,'Cross-site requests are unavailable.');
  }
  const authorizeRequest=req=>{if(!accepted.has(req))throw fail(403,'Authenticated project access required.');};
  // Run buttons (Oct 3): only a request this gateway cleared as the owner's own browser on this computer may start or stop a run.
  const runOwners=new WeakMap();
  const authorizeRun=req=>{const user=runOwners.get(req);if(!user)throw Object.assign(fail(403,'Runs start only from the owner\'s browser on this computer.'),{code:'RUN_NOT_ALLOWED'});return user;};
  const runners=new Set();
  const agentBrowser=createAgentBrowser();
  const agentBrowserRoutes=agentBrowserMiddleware(agentBrowser,{readBody:body});
  const isBrowserRoute=route=>route==='/api/agent-browser'||route.startsWith('/api/agent-browser/')||route==='/api/connectors/check';
  // Sign-in checks write the project's connector list, so they run with that project's folder.
  async function browserRoute(req,res,route,search,root) {
    if(route==='/api/connectors/check') {
      if(req.method!=='POST')throw fail(405,'Method not allowed.');
      const input=await body(req);
      return json(res,200,await checkConnectors(root,agentBrowser,{ids:Array.isArray(input?.ids)?input.ids.map(String):[]}));
    }
    req.url=route+search;
    return await agentBrowserRoutes(req,res,()=>json(res,404,{error:'Not found.'}));
  }
  async function projectHandlers(project) {
    if(!handlers.has(project.id)) handlers.set(project.id,(async()=>{
      const hub=await createHub({workspaceRoot:project.root,port,authorizeRequest});
      const runner=await createClaudeRunner({workspaceRoot:project.root,project:project.id,authorizeRun,...claude});runners.add(runner);
      return {hub,api:createApi({workspaceRoot:project.root,storeMap:hub.storeMap,authorizeRequest}),claude:runner};
    })());
    return handlers.get(project.id);
  }
  async function launchroom(req,res,next) {
    try {
      checkOrigin(req);
      // All route names are ASCII. File names travel in query parameters and are
      // validated by project storage. Reject ambiguous paths before any parser,
      // Vite, or Windows filesystem gets a chance to normalize them differently.
      const rawPath=(req.url||'').split('?')[0];
      if(!rawPath.startsWith('/')||/[\\%\x00-\x20\x7f#]/.test(rawPath)||rawPath.includes('//')||rawPath.split('/').some(p=>p==='.'||p==='..'))throw fail(400,'Use a canonical request path.');
      res.setHeader('Referrer-Policy','same-origin');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('X-Frame-Options','DENY');
      const url=new URL(req.url,'http://localhost');
      const route=url.pathname;
      const isApi=route.startsWith('/api/');
      const canControlLocally=localControl(req);
      const localAgent=canControlLocally&&req.headers['x-launchroom-local-agent']==='1'&&!req.headers['sec-fetch-site']&&!req.headers.cookie;
      // Explicit host-local agent access preserves CLI work. It cannot be obtained
      // through a remote connection or browser CORS request and is never proxied.
      const authenticatedUser=localAgent?{id:'local-agent',name:'Local agent',role:'admin'}:await auth.authenticate(token(req));
      const user=authenticatedUser||(openLocal?{id:'owner',name:'Owner',username:'owner',role:'admin'}:null);
      const scoped=route.match(/^\/p\/([a-z0-9-]+)(\/.*)?$/)||(openLocal&&!localAgent&&isApi&&!route.startsWith('/api/launchroom/')?[`/p/merrivy${route}`,'merrivy',route]:null);
      if(route==='/api/launchroom/session'&&req.method==='GET')return json(res,200,{...(await auth.status()),user,canSetup:canControlLocally,remoteEnabled:!!remoteOrigin});
      if(route==='/api/launchroom/setup'&&req.method==='POST') {
        if(!canControlLocally)throw fail(403,'Create the first account on the home computer.');
        const input=await body(req);await auth.setup(input);
        const session=await auth.login({username:input.username,password:input.password},req.socket.remoteAddress);cookie(req,res,session.token,session.expiresAt);return json(res,201,{user:session.user});
      }
      if(route==='/api/launchroom/login'&&req.method==='POST') {
        const session=await auth.login(await body(req),req.socket.remoteAddress);cookie(req,res,session.token,session.expiresAt);return json(res,200,{user:session.user});
      }
      // The new member's own username comes back so the sign-in screen can fill it in.
      if(route==='/api/launchroom/accept-invite'&&req.method==='POST') {const joined=await auth.acceptInvite(await body(req));return json(res,201,{ok:true,username:joined.username});}
      if(route==='/api/launchroom/logout'&&req.method==='POST') {await auth.logout(token(req));cookie(req,res,'');return json(res,200,{ok:true});}
      const entryDocNavigation=['GET','HEAD'].includes(req.method)
        &&(req.headers['sec-fetch-site']==='cross-site'||req.headers['sec-fetch-mode']==='navigate'||/\btext\/html\b/i.test(req.headers.accept||''))
        &&/^\/p\/[a-z0-9-]+\/?$/.test(route);
      if(!user&&entryDocNavigation){req.url='/';return next();}
      if((isApi||scoped)&&!user)throw fail(401,'Sign in to Launchroom.');
      if(route==='/api/launchroom/projects'&&req.method==='GET')return json(res,200,{projects:(await projects.list(user)).map(publicProject)});
      if(route==='/api/launchroom/projects'&&req.method==='POST')return json(res,201,publicProject(await projects.create(user,await body(req))));
      if(route==='/api/launchroom/users'&&req.method==='GET')return json(res,200,{users:await auth.users(user)});
      if(route==='/api/launchroom/invites'&&req.method==='POST') {
        if(localAgent)throw fail(403,'Create invitations from your signed-in account.');
        return json(res,201,await auth.createInvite(user,await body(req)));
      }
      if(route==='/api/launchroom/users/revoke'&&req.method==='POST') {const input=await body(req);return json(res,200,await auth.revokeUser(user,input.userId));}
      const members=route.match(/^\/api\/launchroom\/projects\/([a-z0-9-]+)\/members$/);
      if(members&&req.method==='POST') {
        if(localAgent)throw fail(403,'Manage sharing from your signed-in account.');
        const input=await body(req), users=await auth.users(user);
        if(!Array.isArray(input.userIds)||input.userIds.some(id=>!users.some(u=>u.id===id&&!u.disabled)))throw fail(400,'Choose active members.');
        return json(res,200,publicProject(await projects.setMembers(user,members[1],input.userIds)));
      }
      if(scoped) {
        const project=await projects.get(user,scoped[1]), sub=scoped[2]||'/';
        if(sub==='/api/files'&&req.method==='GET') {
          const files=url.searchParams.has('removed')?await projects.removed(user,project.id):await projects.files(user,project.id,url.searchParams.get('folder')||'');
          const names=await auth.displayNames([...new Set(files.map(f=>f.uploadedBy).filter(Boolean))]);
          return json(res,200,{files:files.map(f=>({...f,uploaderName:names[f.uploadedBy]||'Team member'}))});
        }
        if(sub==='/api/files/folders'&&req.method==='POST')return json(res,201,await projects.mkdir(user,project.id,await body(req)));
        if(sub==='/api/files/upload'&&req.method==='POST')return json(res,201,await projects.upload(user,project.id,{folder:url.searchParams.get('folder')||'',name:url.searchParams.get('name'),stream:req,contentLength:req.headers['content-length']}));
        if(sub==='/api/files/remove'&&req.method==='POST') {const input=await body(req);return json(res,200,await projects.remove(user,project.id,input.path));}
        if(sub==='/api/files/restore'&&req.method==='POST') {const input=await body(req);return json(res,200,await projects.restore(user,project.id,input.id));}
        if(sub==='/api/files/download'&&['GET','HEAD'].includes(req.method)) {
          const file=await projects.download(user,project.id,url.searchParams.get('path'));
          res.writeHead(200,{'Content-Type':file.mime,'Content-Length':file.size,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'"});
          if(req.method==='HEAD')return res.end();return await pipeline(createReadStream(file.filePath),res);
        }
        // Thumbnails and the preview sheet: images and videos inline (sandboxed, nosniff,
        // short private cache, single byte ranges for video); txt/md/csv as JSON text data.
        if(sub==='/api/files/preview'&&['GET','HEAD'].includes(req.method)) {
          const file=await projects.preview(user,project.id,{path:url.searchParams.get('path'),removedId:url.searchParams.get('removed')});
          if(file.kind==='text')return json(res,200,{name:file.name,mime:file.mime,size:file.size,text:file.text,truncated:file.truncated});
          const headers={'Content-Type':file.mime,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'private, max-age=120','Content-Security-Policy':"sandbox; default-src 'none'",'Cross-Origin-Resource-Policy':'same-origin','Accept-Ranges':'bytes'};
          const range=byteRange(req.headers.range,file.size);
          if(range==='unsatisfiable'){res.writeHead(416,{...headers,'Content-Range':`bytes */${file.size}`});return res.end();}
          if(range)res.writeHead(206,{...headers,'Content-Range':`bytes ${range.start}-${range.end}/${file.size}`,'Content-Length':range.end-range.start+1});
          else res.writeHead(200,{...headers,'Content-Length':file.size});
          if(req.method==='HEAD')return res.end();
          return await pipeline(createReadStream(file.filePath,range?{start:range.start,end:range.end}:{}),res);
        }
        if(sub.startsWith('/api/')) {
          // Run buttons (owner, Oct 3): fixed jobs run headless with Claude Code. The owner's own browser on this
          // computer starts and stops them; agents, remote connections and shared members only watch.
          // The agent browser (owner, Nov 5): its own Chrome profile the agents work in. Its pictures show
          // signed-in pages, so only this computer reaches it: the owner's own browser, or an agent on this
          // computer ("the agent verifies and turns on that connection ... and will open those dedicated tabs").
          // Closing it stays the owner's. Never over a remote connection, never for a shared member.
          if(isBrowserRoute(sub)) {
            if(localAgent&&sub==='/api/agent-browser/stop')throw Object.assign(fail(403,'Only the owner closes the agent browser.'),{code:'AGENT_BROWSER_OWNER_ONLY'});
            if(!canControlLocally)throw Object.assign(fail(403,'The agent browser opens only on this computer, never over a remote connection.'),{code:'REMOTE_REFUSED'});
            if(user.role!=='admin')throw Object.assign(fail(403,'Only the owner controls the agent browser.'),{code:'OWNER_ONLY'});
            if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')throw Object.assign(fail(403,'The agent browser opens only from Launchroom itself.'),{code:'REMOTE_REFUSED'});
            return await browserRoute(req,res,sub,url.search,project.root);
          }
          if(sub==='/api/claude'||sub.startsWith('/api/claude/')) {
            if(MUTATIONS.has(req.method)) {
              if(localAgent)throw Object.assign(fail(403,'Agents can\'t start or stop runs. The owner starts them with a Run button in Launchroom.'),{code:'AGENT_RUN_REFUSED'});
              if(!canControlLocally)throw Object.assign(fail(403,'Runs start only from the owner\'s browser on this computer, never over a remote connection.'),{code:'REMOTE_RUN_REFUSED'});
              if(user.role!=='admin')throw Object.assign(fail(403,'Only the owner starts runs. Shared members can watch them on the Agents tab.'),{code:'OWNER_ONLY'});
              if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')throw Object.assign(fail(403,'Runs start only from Launchroom itself.'),{code:'REMOTE_RUN_REFUSED'});
              runOwners.set(req,user);
            }
            accepted.add(req);req.url=sub+url.search;
            const {claude:runner}=await projectHandlers(project);
            return await runner.middleware(req,res,()=>json(res,404,{error:'Not found.'}));
          }
          // The older Codex runner stays off inside projects; the Run buttons (Claude) replace it.
          if(sub==='/api/runtime')return json(res,200,{available:false,reason:'Codex runs are off here. Use the Run buttons: Claude runs the fixed jobs headless.'});
          if(sub==='/api/runs') {if(req.method==='GET')return json(res,200,{runs:[]});throw fail(403,'Codex runs are off. Start a job with a Run button instead.');}
          if(sub.startsWith('/api/runs/')||sub.startsWith('/api/scripts'))throw fail(403,'Process execution is available only through the Run buttons or the local agent chat.');
          // Upload permissions never confer filesystem editing or authority to change
          // host tooling, skills, secrets or the project registry.
          accepted.add(req);req.url=sub+url.search;
          const {hub,api}=await projectHandlers(project);
          return await hub(req,res,()=>api(req,res,()=>json(res,404,{error:'Not found.'})));
        }
        // Project pages use the same compiled frontend; all data URLs remain scoped.
        req.url='/';return next();
      }
      if(isApi) {
        if(route.startsWith('/api/launchroom/'))throw fail(404,'Unknown Launchroom route.');
        if(!localAgent)throw fail(403,'Choose a project before opening its records.');
        // An agent on this computer checks sign-ins and opens tabs in the agent browser (os.mjs connect).
        if(isBrowserRoute(route)) {
          if(route==='/api/agent-browser/stop')throw Object.assign(fail(403,'Only the owner closes the agent browser.'),{code:'AGENT_BROWSER_OWNER_ONLY'});
          return await browserRoute(req,res,route,url.search,workspaceRoot);
        }
        // No recursion: an agent never starts a run, a script or a Codex job.
        if(MUTATIONS.has(req.method)&&(route==='/api/runs'||route.startsWith('/api/runs/')||route.startsWith('/api/scripts')||route==='/api/claude'||route.startsWith('/api/claude/')))throw Object.assign(fail(403,'Agents can\'t start runs or scripts.'),{code:'AGENT_RUN_REFUSED'});
        return next();
      }
      if(req.method!=='GET'&&req.method!=='HEAD')throw fail(405,'Method not allowed.');
      // Serve only built app entry/assets; no private workspace paths.
      const devAsset=development&&local(req)&&(route.startsWith('/src/')||route.startsWith('/node_modules/.vite/deps/')||['/@vite/client','/@react-refresh','/node_modules/vite/dist/client/env.mjs'].includes(route));
      if(!devAsset&&route!=='/'&&!route.startsWith('/assets/')&&!route.startsWith('/fonts/')&&!['/favicon.svg','/favicon.ico','/manifest.webmanifest'].includes(route))throw fail(404,'Not found.');
      return next();
    }catch(error) {
      if(res.headersSent){res.destroy();return;}
      const status=error.status||error.statusCode||500;
      json(res,status,{error:status>=500?'Launchroom could not complete this request. Check the local server.':error.message,code:error.code||'REQUEST_FAILED'});
    }
  };
  launchroom.close=async()=>{for(const runner of runners)await runner.close();};
  return launchroom;
}
