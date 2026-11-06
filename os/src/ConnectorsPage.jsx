import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Activity,ArrowRight,Check,CircleAlert,ExternalLink,Eye,Globe,LayoutGrid,LoaderCircle,Megaphone,MonitorPlay,MousePointerClick,Package,Palette,Play,Plug,Power,RefreshCw,Search,ShieldCheck,Square,Store,Telescope,Users,MessagesSquare,Clock,CalendarClock} from 'lucide-react';
import {api} from './ui.jsx';
import {projectUrl} from './projectScope.mjs';
import {AgentAvatar,Sheet,timeAgo} from './kit.jsx';
import {SectionHead,Stat} from './cards.jsx';
import {CONNECTOR_GROUPS,CONNECTOR_KINDS,CONNECTOR_RULES,CONNECTOR_STEPS,agentConnectors,connectPlan,connectState,connectionQueue,connectorActivity,connectorCounts,groupConnectors} from './connectorsModel.mjs';
import {SCHEDULE_TOOLS,lastRun,mergeSchedules} from './schedulesModel.mjs';
import './connectors.css';

// Connect (#/connect, first built as Connectors): how the agents reach the apps we use. The owner, Nov 5: the
// agents work in "our in-browser ... it allows you to sign in once only and then it lives
// in that browser as your google chrome profile basically." This page starts and watches
// that agent browser, and lists every site to sign in to once. Its buttons are the owner's
// own actions (start or stop the browser, open a sign-in page, tick Signed in); nothing here
// gives an agent work. That happens in chat.

const TABS = [['overview','Connect',Plug],['browser','Live browser',MonitorPlay],['sites','Sign-ins',Globe],['agents','By subagent',Users],['scheduled','Scheduled',CalendarClock],['activity','Activity',Activity]];
const GROUP_ICONS = {ads:Megaphone,store:Store,research:Telescope,buyers:MessagesSquare,sourcing:Package,creative:Palette,'built-in':Plug};
const GROUP_TILE = {ads:1,store:2,research:3,buyers:4,sourcing:5,creative:6,'built-in':1};
const monogram = name => String(name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
const titleCase = id => String(id||'').split('-').map(word=>word?word[0].toUpperCase()+word.slice(1):'').join(' ');
const pictureUrl = (id,tick) => projectUrl(`/api/agent-browser/picture?id=${encodeURIComponent(id)}&t=${tick}`);

/** One line after a round of checks: how many turned on, how many still need you, how many were unclear. */
function checkSummary(results=[]) {
  const n = verdict => results.filter(item=>item.verdict===verdict).length;
  if (!results.length) return 'No site to check yet.';
  const parts = [`${n('in')} connected`];
  if (n('out')) parts.push(`${n('out')} need${n('out')===1?'s':''} you to sign in`);
  if (n('unknown')) parts.push(`${n('unknown')} unclear`);
  return parts.join(' · ');
}

function agentOfId(team,id) {
  return team?.agents?.find(agent=>agent.id===id)||{id,name:titleCase(id),role:'manager',icon:'',missing:true};
}

function Pill({status}) {
  if (!status) return null;
  return <span className={`mv-cn-pill is-${status.tone}`}>{['connected','built-in'].includes(status.id)&&<Check size={11} strokeWidth={3}/>}{status.label}</span>;
}

function Mark({connector,size=40}) {
  const Icon = GROUP_ICONS[connector.group]||Plug;
  return <span className={`mv-cn-mark is-tile-${GROUP_TILE[connector.group]||6}`} style={{width:size,height:size}} aria-hidden="true">
    <b>{monogram(connector.name)}</b><Icon size={Math.round(size*.3)} strokeWidth={2.4}/>
  </span>;
}

/**
 * Open to sign in, then Check: Launchroom visits the site in the agent browser and turns the
 * connection on when it lands signed in (owner, Nov 5). A site Launchroom can't check by
 * itself keeps the owner's tick.
 */
function SiteActions({connector,actions,compact,short}) {
  if (connector.how!=='browser') return null;
  const signed = connector.status.id==='connected';
  const busy = actions.busy===connector.id||actions.busy==='check';
  return <span className={`mv-cn-actions ${compact?'is-compact':''}`}>
    <button type="button" className="mv-btn sm" onClick={()=>actions.open(connector)} disabled={busy} title={`Open ${connector.name} in the agent browser`}><ExternalLink size={13}/>{signed||short?'Open':'Open to sign in'}</button>
    {connector.check
      ?<button type="button" className="mv-btn sm ghost" onClick={()=>actions.check([connector.id])} disabled={busy} title="Launchroom opens it in the agent browser and sees whether you're signed in">{actions.busy===connector.id?<LoaderCircle className="mv-spin" size={13}/>:<RefreshCw size={13}/>}{signed?'Recheck':'Check'}</button>
      :<button type="button" className={`mv-btn sm ${signed?'':'ghost'}`} aria-pressed={signed} onClick={()=>actions.tick(connector,!signed)} disabled={busy} title={signed?'Tap if it signed you out':'This site can’t be checked automatically: tick once you have signed in'}><Check size={13}/>{signed?'Signed in':short?'Signed in?':'Mark signed in'}</button>}
  </span>;
}

function ConnectorCard({connector,team,onOpen,actions}) {
  return <article className={`mv-cn-card is-${connector.status.id}`}>
    <button type="button" className="mv-cn-card-main" onClick={()=>onOpen(connector.id)} aria-label={`${connector.name}: ${connector.status.label}`}>
      <span className="mv-cn-card-top"><Mark connector={connector}/><Pill status={connector.status}/></span>
      <strong>{connector.name}</strong>
      <small className="mv-cn-card-by">{connector.provider}</small>
      <span className="mv-cn-card-line">{connector.line}</span>
      <span className="mv-cn-card-foot">
        <span className="mv-cn-faces">{connector.agents.slice(0,4).map(id=><AgentAvatar key={id} agent={agentOfId(team,id)} size={22}/>)}{connector.agents.length>4&&<em>+{connector.agents.length-4}</em>}</span>
        <span className="mv-cn-cost">{connector.cost}</span>
      </span>
    </button>
    {actions&&connector.how==='browser'&&<div className="mv-cn-card-actions"><SiteActions connector={connector} actions={actions} compact short/></div>}
  </article>;
}

function ConnectorSheet({connector,team,go,actions,onClose}) {
  const active = connector.how!=='built-in';
  return <Sheet wide title={connector.name} subtitle={connector.provider} onClose={onClose}>
    <div className="mv-cn-sheet">
      <div className="mv-cn-sheet-hero">
        <Mark connector={connector} size={56}/>
        <div><p>{connector.line}</p><span className="mv-cn-sheet-chips"><Pill status={connector.status}/><span className="mv-cn-chip">{connector.cost}</span>{active&&<span className="mv-cn-chip is-strong"><ShieldCheck size={12}/>Full control</span>}{connector.how==='browser'&&<span className="mv-cn-chip"><Globe size={12}/>Agent browser</span>}</span></div>
      </div>
      {connector.how==='browser'&&<SiteActions connector={connector} actions={actions}/>}
      {connector.missingOn.length>0&&<p className="mv-cn-warn"><CircleAlert size={15}/>Added, but not on {connector.missingOn.map(id=>agentOfId(team,id).name).join(' or ')} yet.</p>}
      <div className="mv-cn-sheet-grid">
        <section>
          <h3>What agents do there</h3>
          <ul className="mv-cn-does">{connector.does.map(line=><li key={line}><Check size={13} strokeWidth={3}/>{line}</li>)}</ul>
        </section>
        <section>
          <h3>Who uses it</h3>
          <div className="mv-cn-people">{connector.agents.length?connector.agents.map(id=>{const agent = agentOfId(team,id);return <button key={id} type="button" onClick={()=>go('agents?tab=team')}><AgentAvatar agent={agent} size={24}/>{agent.name}</button>;}):<em>Any of us</em>}</div>
          {connector.steps.length>0&&<><h3>Where it's used</h3>
          <div className="mv-cn-steps">{connector.steps.map(step=><button key={step} type="button" onClick={()=>go(CONNECTOR_STEPS[step][1])}>{CONNECTOR_STEPS[step][0]}<ArrowRight size={12}/></button>)}</div></>}
        </section>
      </div>
      <section>
        <h3>How it connects</h3>
        <dl className="mv-cn-facts">
          <div><dt>Where</dt><dd>{connector.where}</dd></div>
          <div><dt>Sign-in</dt><dd>{connector.signIn}</dd></div>
          <div><dt>Cost</dt><dd>{connector.cost}</dd></div>
          {active&&<div><dt>Control</dt><dd>Full control. Spend, budgets, publishing, orders, payments and messages still wait for your yes in chat.</dd></div>}
        </dl>
      </section>
      {connector.setup.length>0&&<section>
        <h3>Getting it connected</h3>
        <ol className="mv-cn-setup">{connector.setup.map((step,index)=><li key={index}><span className="mv-cn-setup-n">{index+1}</span><span className={`mv-cn-who is-${step.who}`}>{step.who==='owner'?'You':'Claude'}</span><span>{step.text}</span></li>)}</ol>
      </section>}
      {connector.watch&&<p className="mv-cn-watch"><CircleAlert size={15}/>{connector.watch}</p>}
      {connector.source&&<a className="mv-link mv-cn-source" href={connector.source} target="_blank" rel="noopener noreferrer"><ExternalLink size={13}/>Read the docs</a>}
    </div>
  </Sheet>;
}

/** Connect: one big button, and a green "Connected" once the agent browser runs. */
function BrowserCard({browser,error,actions,go,list}) {
  const running = browser?.running;
  const state = connectState(error?{error}:browser,list);
  const toOpen = running?connectPlan(list,browser.tabs):[];
  return <article className={`mv-cn-browser is-${state.id}`}>
    <span className="mv-cn-browser-icon">{running?<Check size={28} strokeWidth={3}/>:<Plug size={26}/>}</span>
    <div className="mv-cn-browser-text">
      <span className="mv-cn-browser-state"><i/>{error?'Only on the home computer':running?'Connected':'Not connected'}</span>
      <strong>{running?'Launchroom is ready to go':'Connect to start working'}</strong>
      <p>{error||(running?`${state.line} · ${browser.tabs.length} tab${browser.tabs.length===1?'':'s'} open in the agent browser`:'Starts the agent browser, its own Chrome profile, and opens every site you signed in to, plus Gemini.')}</p>
    </div>
    {!error&&<div className="mv-cn-browser-actions">
      {running?<>
        {toOpen.length>0&&<button type="button" className="mv-btn primary" onClick={actions.connect} disabled={actions.busy==='browser'}><Plug size={15}/>Open {toOpen.length} site{toOpen.length===1?'':'s'}</button>}
        <button type="button" className="mv-btn" onClick={()=>actions.check()} disabled={!!actions.busy}>{actions.busy==='check'?<LoaderCircle className="mv-spin" size={15}/>:<RefreshCw size={15}/>}Check sign-ins</button>
        <button type="button" className={`mv-btn ${toOpen.length?'':'primary'}`} onClick={()=>go('connect?tab=browser')}><Eye size={15}/>Watch it</button>
        {browser.ours&&<button type="button" className="mv-btn ghost" onClick={actions.stop} disabled={actions.busy==='browser'}><Square size={14}/>Disconnect</button>}
      </>:<button type="button" className="mv-btn primary mv-cn-connect" onClick={actions.connect} disabled={actions.busy==='browser'}>{actions.busy==='browser'?<LoaderCircle className="mv-spin" size={17}/>:<Plug size={17}/>}Connect</button>}
    </div>}
  </article>;
}

function QueueTrack({queue,team,onOpen,actions}) {
  return <ol className="mv-cn-queue">{queue.map((connector,index)=><li key={connector.id} className={`is-${connector.status.id}`}>
    <button type="button" className="mv-cn-queue-main" onClick={()=>onOpen(connector.id)}>
      <span className="mv-cn-queue-n">{connector.status.id==='connected'?<Check size={13} strokeWidth={3}/>:index+1}</span>
      <Mark connector={connector} size={34}/>
      <span className="mv-cn-queue-text"><strong>{connector.name}</strong><small>{connector.agents.map(id=>agentOfId(team,id).name).join(', ')}</small></span>
      <Pill status={connector.status}/>
    </button>
    <SiteActions connector={connector} actions={actions} compact/>
  </li>)}</ol>;
}

function Overview({list,browser,browserError,team,onOpen,go,actions}) {
  const counts = connectorCounts(list);
  const queue = connectionQueue(list);
  const sites = list.filter(item=>item.how==='browser');
  const next = queue.find(item=>item.status.id==='next')||queue.find(item=>item.status.id!=='connected');
  const drivers = list.filter(item=>item.how==='built-in');
  const agents = new Set(sites.flatMap(item=>item.agents));
  return <>
    <BrowserCard browser={browser} error={browserError} actions={actions} go={go} list={list}/>
    <div className="mv-cn-stats">
      <Stat tile={1} icon={Check} label="Signed in" value={`${counts.connected} of ${sites.length}`} sub={counts.connected?'sites ready for the agents':'none yet'}/>
      <Stat tile={2} icon={ArrowRight} label="Sign in next" value={next?next.name:'—'} sub={next?next.provider:'every site is signed in'} onClick={next?()=>onOpen(next.id):undefined}/>
      <Stat tile={3} icon={MonitorPlay} label="Tabs open" value={browser?.running?browser.tabs.length:0} sub={browser?.running?'in the agent browser':'browser is off'} onClick={()=>go('connect?tab=browser')}/>
      <Stat tile={4} icon={Users} label="Subagents" value={agents.size} sub="work in these sites" onClick={()=>go('connect?tab=agents')}/>
    </div>
    <section className="mv-cn-section">
      <SectionHead icon={ArrowRight} title="Sign in once, one at a time" count={queue.length}/>
      <p className="mv-cn-quiet">Open each site in the agent browser and sign in. Launchroom checks it and turns it green. Each one gets tested on real work before the next.</p>
      <QueueTrack queue={queue} team={team} onOpen={onOpen} actions={actions}/>
    </section>
    <section className="mv-cn-section">
      <SectionHead icon={ShieldCheck} title="The rules"/>
      <div className="mv-cn-rules">{CONNECTOR_RULES.map((rule,index)=><article key={rule.id} className={`mv-cn-rule is-tile-${index%6+1}`}><strong>{rule.title}</strong><p>{rule.line}</p></article>)}</div>
    </section>
    <section className="mv-cn-section">
      <SectionHead icon={MousePointerClick} title="How agents drive it" count={drivers.length}/>
      <div className="mv-cn-grid is-small">{drivers.map(connector=><ConnectorCard key={connector.id} connector={connector} team={team} onOpen={onOpen}/>)}</div>
    </section>
  </>;
}

function TabPicture({id,tick,large}) {
  const [failed,setFailed] = useState(false);
  useEffect(()=>setFailed(false),[id,tick]);
  if (failed) return <span className={`mv-cn-shot is-empty ${large?'is-large':''}`}><MonitorPlay size={large?30:18}/><small>{large?'This tab is in the background or busy. Bring it to the front to see it.':'In the background'}</small></span>;
  return <span className={`mv-cn-shot ${large?'is-large':''}`}><img src={pictureUrl(id,tick)} alt="" onError={()=>setFailed(true)}/></span>;
}

function LiveBrowser({browser,error,list,actions,go,reload}) {
  const tabs = browser?.tabs||[];
  const [selected,setSelected] = useState(''),[tick,setTick] = useState(0);
  const current = tabs.find(tab=>tab.id===selected)||tabs.find(tab=>!tab.blank)||tabs[0];
  useEffect(()=>{if(!browser?.running)return undefined;const timer = setInterval(()=>{setTick(value=>value+1);reload();},3000);return ()=>clearInterval(timer);},[browser?.running,reload]);
  if (error) return <div className="mv-cn-empty-card"><Globe size={22}/><strong>Open Launchroom on this computer</strong><p>{error}</p></div>;
  if (!browser?.running) return <div className="mv-cn-empty-card"><Globe size={22}/><strong>The agent browser is off</strong><p>Start it to see what the agents see, live. It opens as its own Chrome window on this computer.</p><button type="button" className="mv-btn primary" onClick={actions.start} disabled={actions.busy==='browser'}><Power size={15}/>Start the agent browser</button></div>;
  const sites = list.filter(item=>item.how==='browser');
  return <div className="mv-cn-live">
    <div className="mv-cn-live-stage">
      {current?<>
        <div className="mv-cn-live-bar"><span><strong>{current.title||current.host||'New tab'}</strong><small>{current.url||'about:blank'}</small></span><button type="button" className="mv-btn sm" onClick={()=>actions.focus(current.id)}><MousePointerClick size={13}/>Bring to front</button></div>
        <TabPicture id={current.id} tick={tick} large/>
      </>:<div className="mv-cn-empty-card"><strong>No tabs open</strong></div>}
      <p className="mv-cn-quiet">It's a normal Chrome window on this computer: click into it any time to take over. The picture updates every few seconds.</p>
    </div>
    <aside className="mv-cn-live-side">
      <SectionHead icon={MonitorPlay} title="Tabs" count={tabs.length}/>
      <ul className="mv-cn-tabs">{tabs.map(tab=><li key={tab.id}><button type="button" aria-pressed={current?.id===tab.id} onClick={()=>setSelected(tab.id)}>
        <TabPicture id={tab.id} tick={Math.floor(tick/3)}/>
        <span><strong>{tab.title||tab.host||'New tab'}</strong><small>{tab.host||'blank'}</small></span>
      </button></li>)}</ul>
      <SectionHead icon={Play} title="Open a site"/>
      <div className="mv-cn-open">{sites.map(site=><button key={site.id} type="button" onClick={()=>actions.open(site)} disabled={actions.busy===site.id}><Mark connector={site} size={24}/>{site.name}</button>)}</div>
      <button type="button" className="mv-link" onClick={()=>go('connect?tab=sites')}>All sign-ins<ArrowRight size={13}/></button>
    </aside>
  </div>;
}

function AllSites({list,team,onOpen,actions}) {
  const [group,setGroup] = useState(''),[query,setQuery] = useState('');
  const groups = useMemo(()=>groupConnectors(list,{group,query}),[list,group,query]);
  const count = id => list.filter(item=>item.group===id).length;
  return <>
    <div className="mv-cn-toolbar">
      <div className="mv-filter" role="group" aria-label="Connector groups">
        <button aria-pressed={!group} onClick={()=>setGroup('')}>All<b>{list.length}</b></button>
        {CONNECTOR_GROUPS.filter(([id])=>count(id)).map(([id,label])=><button key={id} aria-pressed={group===id} onClick={()=>setGroup(group===id?'':id)}>{label}<b>{count(id)}</b></button>)}
      </div>
      <label className="mv-sa-search"><Search size={14}/><input type="search" aria-label="Search sites" placeholder="Search sites" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    </div>
    {groups.length?<div className="mv-cn-grid is-sites">{groups.flatMap(entry=>entry.items).map(connector=><ConnectorCard key={connector.id} connector={connector} team={team} onOpen={onOpen} actions={actions}/>)}</div>:<p className="mv-cn-empty">No site matches.</p>}
  </>;
}

function BySubagent({list,team,onOpen,go}) {
  const ids = [...new Set([...(team?.agents||[]).map(agent=>agent.id),...list.flatMap(item=>item.agents)])];
  const rows = ids.map(id=>({agent:agentOfId(team,id),items:agentConnectors(id,list)}))
    .sort((a,b)=>(a.items.find(item=>item.order>0)?.order||99)-(b.items.find(item=>item.order>0)?.order||99));
  return <div className="mv-cn-agents">{rows.map(({agent,items})=>{const sites = items.filter(item=>item.order>0), drivers = items.filter(item=>!item.order);return <article key={agent.id} className="mv-cn-agent">
    <header><AgentAvatar agent={agent} size={36}/><span><strong>{agent.name}</strong><small>{agent.missing?'Not on the team list yet':`${(agent.skills||[]).length} skills · ${(agent.workflow||[]).length} workflow steps`}</small></span></header>
    {sites.length?<ul>{sites.map(item=><li key={item.id}><button type="button" onClick={()=>onOpen(item.id)}><Mark connector={item} size={28}/><span>{item.name}</span><Pill status={item.status}/></button></li>)}</ul>:<p className="mv-cn-quiet">No site yet.</p>}
    {drivers.length>0&&<p className="mv-cn-also">Drives the browser with {drivers.map(item=>item.name).join(', ')}</p>}
    {!agent.missing&&<button type="button" className="mv-link" onClick={()=>go('agents?tab=team')}>Skills and workflow<ArrowRight size={13}/></button>}
  </article>;})}</div>;
}

/** One scheduled job: when, in which tool, by whom, on which sites, and how its last run went. */
function ScheduleCard({job,team,list,activity}) {
  const run = lastRun(job,activity);
  const last = run?.at||job.lastRunAt;
  const agent = job.agent?agentOfId(team,job.agent):null;
  const sites = (job.sites||[]).map(id=>list.find(item=>item.id===id)).filter(Boolean);
  const source = job.found?' · found by Launchroom':job.addedBy?` · added by ${agentOfId(team,job.addedBy).name}`:'';
  return <article className={`mv-cn-job ${job.enabled===false?'is-off':''}`}>
    <header>
      <span className="mv-cn-job-icon"><Clock size={18}/></span>
      <span className="mv-cn-job-when"><strong>{job.when}</strong><small>{SCHEDULE_TOOLS[job.runsIn]||job.runsIn}{source}</small></span>
      <span className={`mv-cn-pill is-${job.enabled===false?'muted':'done'}`}>{job.enabled===false?'Paused':'On'}</span>
    </header>
    <strong className="mv-cn-job-name">{job.name}</strong>
    {job.what&&<p>{job.what}</p>}
    <footer>
      {agent&&<span className="mv-cn-job-who"><AgentAvatar agent={agent} size={20}/>{agent.name}</span>}
      {sites.map(site=><span key={site.id} className="mv-cn-chip"><Globe size={11}/>{site.name}</span>)}
      <span className="mv-cn-job-last">{last?`Last run ${timeAgo(last)}${run?.status?` · ${run.status}`:''}`:'No run reported yet'}</span>
    </footer>
  </article>;
}

function ScheduledList({schedules,error,activity,team,list}) {
  if (error) return <div className="mv-error" style={{marginTop:12}}>{error}</div>;
  if (!schedules) return <div className="mv-loading"><LoaderCircle className="mv-spin" size={20}/>Reading scheduled jobs…</div>;
  const jobs = mergeSchedules(schedules.schedules,schedules.found);
  return <>
    <p className="mv-cn-quiet" style={{marginTop:14}}>Every job set to run on its own, in any tool. Agents add theirs with <code>os.mjs schedule add</code>, and Launchroom finds its own timer and the Claude app's tasks by itself. Each run reports under the job's name, and money still waits for your yes.</p>
    {schedules.problems?.length>0&&<div className="mv-cn-problems">{schedules.problems.map(problem=><p key={problem}><CircleAlert size={14}/>{problem}</p>)}</div>}
    {jobs.length?<div className="mv-cn-jobs">{jobs.map(job=><ScheduleCard key={job.id} job={job} team={team} list={list} activity={activity}/>)}</div>
    :<div className="mv-cn-empty-card"><CalendarClock size={22}/><strong>Nothing scheduled yet</strong><p>When any agent sets a job to run on its own, it shows up here.</p></div>}
  </>;
}

function ActivityList({rows,team}) {
  if (!rows.length) return <div className="mv-cn-empty-card">
    <Activity size={22}/>
    <strong>Nothing logged in a site yet</strong>
    <p>When a subagent changes something in a site, it starts a line in its job report with the site's name, like “meta-ads-manager: daily budget $50 → $75”. Every change shows here with its old and new value.</p>
  </div>;
  return <ul className="mv-cn-activity">{rows.map((row,index)=><li key={`${row.report.id}-${index}`}>
    <Mark connector={row.connector} size={32}/>
    <span><b>{row.text}</b><small>{agentOfId(team,row.report.agent).name} · {row.report.title}</small></span>
    <time>{timeAgo(row.at)}</time>
  </li>)}</ul>;
}

export function ConnectorsPage({data,activity,route,go,notify,browserState,setBrowserState,reloadBrowser,browserError:sharedBrowserError,connectorsState,setConnectorsState,reloadConnectors}) {
  // App holds the agent browser and the site list (the sidebar's green light reads them too);
  // this page shares that state so Connect turns green the moment the browser starts.
  const [ownResult,setOwnResult] = useState(null),[error,setError] = useState('');
  const [ownBrowser,setOwnBrowser] = useState(null),[ownBrowserError,setOwnBrowserError] = useState(''),[busy,setBusy] = useState('');
  const shared = typeof setBrowserState==='function';
  const result = shared?connectorsState:ownResult, setResult = shared?setConnectorsState:setOwnResult;
  const browser = shared?browserState:ownBrowser, setBrowser = shared?setBrowserState:setOwnBrowser;
  const browserError = shared?(sharedBrowserError||''):ownBrowserError;
  const [schedules,setSchedules] = useState(null),[schedulesError,setSchedulesError] = useState('');
  const loadSchedules = useCallback(async()=>{try{setSchedules(await api('/api/schedules'));setSchedulesError('');}catch(e){setSchedulesError(e.status===404?'Launchroom needs a restart to show scheduled jobs.':e.message);}},[]);
  useEffect(()=>{loadSchedules();const timer = setInterval(loadSchedules,30000);return ()=>clearInterval(timer);},[loadSchedules]);
  const load = useCallback(async()=>{try{setResult(await api('/api/connectors'));setError('');}catch(e){setError(e.status===404?'Launchroom needs a restart to show Connect.':e.message);}},[setResult]);
  const loadBrowser = useCallback(async()=>{if(shared){await reloadBrowser?.();return;}try{setOwnBrowser(await api('/api/agent-browser'));setOwnBrowserError('');}catch(e){setOwnBrowserError(e.status===404?'Launchroom needs a restart to control the agent browser.':e.message);}},[shared,reloadBrowser]);
  useEffect(()=>{load();loadBrowser();const timer = setInterval(()=>{load();loadBrowser();},20000);return ()=>clearInterval(timer);},[load,loadBrowser]);
  const asked = route?.params?.tab;
  const tab = TABS.some(([id])=>id===asked)?asked:'overview';
  const team = data?.team;
  const list = result?.connectors||[];
  const open = route?.params?.id&&list.find(item=>item.id===route.params.id);
  const rows = useMemo(()=>connectorActivity(activity,list),[activity,list]);
  const here = tab==='overview'?'connect':`connect?tab=${tab}`;
  const onOpen = id=>go(`${here}${here.includes('?')?'&':'?'}id=${id}`);
  const say = message=>notify?.(message);
  async function act(key,work,done){setBusy(key);try{const value = await work();if(done)say(done);return value;}catch(e){say(e.message);}finally{setBusy('');}}
  const actions = {
    busy,
    start:()=>act('browser',async()=>setBrowser(await api('/api/agent-browser/start',{})),'The agent browser is open.'),
    stop:()=>act('browser',async()=>setBrowser(await api('/api/agent-browser/stop',{})),'The agent browser is closed.'),
    open:site=>act(site.id,async()=>setBrowser(await api('/api/agent-browser/open',{url:site.url})),`${site.name} is open in the agent browser.`),
    focus:id=>act('focus',async()=>setBrowser(await api('/api/agent-browser/focus',{id}))),
    tick:(site,signedIn)=>act(site.id,async()=>setResult(await api('/api/connectors/signed-in',{id:site.id,signedIn,revision:result?.revision})),signedIn?`${site.name} marked signed in.`:`${site.name} marked not signed in.`),
    // Launchroom checks the sign-ins itself and turns each connection on or off.
    check:ids=>act(ids?.length===1?ids[0]:'check',async()=>{
      const res = await api('/api/connectors/check',{ids:ids||[]});
      setResult(res);
      say(checkSummary(res.results));
    }),
    // One tap: start the agent browser if it's off, open every signed-in site and Gemini, then check the sign-ins.
    connect:()=>act('browser',async()=>{
      let state = browser?.running?browser:await api('/api/agent-browser/start',{});
      const plan = connectPlan(list,state.tabs);
      for (const site of plan) state = await api('/api/agent-browser/open',{url:site.url});
      setBrowser(state);
      const res = await api('/api/connectors/check',{});
      setResult(res);
      say(`Connected. ${checkSummary(res.results)}`);
    }),
  };
  return <section className="mv-cn">
    <div className="mv-page-head"><div><span className="mv-eyebrow">Step one · before any work</span><h1 className="mv-h1">Connect</h1><p className="mv-sub">Agents need a browser to do real work. Connect starts the agent browser with every site you signed in to, and Launchroom is ready to go.</p></div></div>
    <div className="mv-ag-tabs"><div className="mv-seg" role="group" aria-label="Connectors view">{TABS.map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} onClick={()=>go(id==='overview'?'connect':`connect?tab=${id}`)}><Icon size={14}/>{label}{id==='browser'&&browser?.running&&<i className="mv-cn-live-dot" aria-label="running"/>}</button>)}</div></div>
    {error&&<div className="mv-error" style={{margin:'14px 0'}}>{error}</div>}
    {result?.problems?.length>0&&<div className="mv-cn-problems">{result.problems.map(problem=><p key={problem}><CircleAlert size={14}/>{problem}</p>)}</div>}
    {!result&&!error?<div className="mv-loading"><LoaderCircle className="mv-spin" size={20}/>Reading connectors…</div>
    :result&&<div className="mv-cn-body">
      {tab==='overview'?<Overview list={list} browser={browser} browserError={browserError} team={team} onOpen={onOpen} go={go} actions={actions}/>
      :tab==='browser'?<LiveBrowser browser={browser} error={browserError} list={list} actions={actions} go={go} reload={loadBrowser}/>
      :tab==='sites'?<AllSites list={list} team={team} onOpen={onOpen} actions={actions}/>
      :tab==='agents'?<BySubagent list={list} team={team} onOpen={onOpen} go={go}/>
      :tab==='scheduled'?<ScheduledList schedules={schedules} error={schedulesError} activity={activity} team={team} list={list}/>
      :<ActivityList rows={rows} team={team}/>}
    </div>}
    {open&&<ConnectorSheet connector={open} team={team} go={go} actions={actions} onClose={()=>go(here)}/>}
  </section>;
}

/** The connector list, for a subagent's card on the Subagents tab. */
export function useConnectors() {
  const [list,setList] = useState([]);
  useEffect(()=>{let alive = true;api('/api/connectors').then(res=>{if(alive)setList(res?.connectors||[]);}).catch(()=>{});return ()=>{alive = false;};},[]);
  return list;
}
export {Pill as ConnectorPill,Mark as ConnectorMark};
