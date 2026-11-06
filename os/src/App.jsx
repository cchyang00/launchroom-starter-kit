import React,{useState,useEffect,useCallback,useMemo} from 'react';
import {createPortal} from 'react-dom';
import {Compass,LayoutDashboard,ListTodo,Bot,BookOpen,Images,Brain,FlaskConical,GitBranch,Search,RefreshCw,Menu,CheckCheck,Undo2,FileText,ChevronRight,LoaderCircle,MessageSquareText,Route,Wrench,Workflow,FolderOpen,Globe,ChevronDown,MoreHorizontal,Store as StoreIcon,Settings as SettingsIcon,MessageSquareQuote,Flame,Megaphone,TrendingUp,Plug} from 'lucide-react';
import {useLaunchroom,ProjectMark} from './LaunchroomShell.jsx';
import {FilesView} from './FilesView.jsx';
import {productRoute,productPath,docTitle,MERRIVY_ID} from './launchroomModel.mjs';
import {api,ErrorText,DocumentViewer} from './ui.jsx';
import {processScope,processState} from './processModel.mjs';
import {LINE,VISIBLE_LINE,buildLeads,stageSignals,ownerDecisionCandidate,agentsNavCount} from './workflowView.mjs';
import {decisionOf,undoCandidate,DECISION_WORDS,UNDO_MS,saidOf,undoSaidCandidate} from './eyeTest.mjs';
import {findItem,reopenCandidate,unreopenCandidate} from './pipeline.mjs';
import {issueStationOf} from './pipelineView.mjs';
import {currentStep,LINE_PATH} from './theLine.mjs';
import {STAGE_SLUGS,SLUG_STAGES,OLD_STEP_SLUGS,localDay} from './kit.jsx';
import {Palette} from './Palette.jsx';
import {Home} from './Home.jsx';
import {StagePage} from './StagePage.jsx';
import {CatalogPage} from './CatalogPage.jsx';
import {VerifyPage} from './VerifyPage.jsx';
import {IssuesPage} from './IssuesPage.jsx';
import {ISSUE_LIBRARY_SLUG,OLD_LIBRARY_SLUGS} from './steps.mjs';
import {TodayView} from './TodayView.jsx';
import {AgentsView} from './AgentsView.jsx';
import {LibraryView} from './LibraryView.jsx';
import {ToolsView} from './ToolsView.jsx';
import {SettingsView} from './SettingsView.jsx';
import {LearningView} from './LearningView.jsx';
import {MemoryView} from './MemoryView.jsx';
import {PipelinePage,PipelineContext} from './Pipeline.jsx';
import {ProductPage} from './ProductPage.jsx';
import {AssetsView} from './AssetsView.jsx';
import {StoreEditor} from './StoreEditor.jsx';
import {MetaAdBoard} from './MetaAdBoard.jsx';
import {TrendsView} from './TrendsView.jsx';
import {HubsPage} from './HubsPage.jsx';
import {WorkflowMap as FreeformMap} from './MindMap.jsx';
import {SourceManager} from './ProductSources.jsx';
import {ChecklistPage} from './ChecklistPage.jsx';
import {LaunchPage} from './LaunchPage.jsx';
import {CreativesPage} from './CreativesPage.jsx';
import {WinnersPage} from './WinnersPage.jsx';
import {ImprovePage} from './ImprovePage.jsx';
import {MorePage} from './MorePage.jsx';
import {ConnectorsPage} from './ConnectorsPage.jsx';
import {connectState} from './connectorsModel.mjs';
import {MORE_PAGES} from './moreView.mjs';
import {ChecklistContext,DISPLAY_ICONS} from './LineNav.jsx';
import {displayStations,DISPLAY_LINE} from './displayLine.mjs';


// Library in the sidebar. The ads live on the Launch page (#/launch); #/ads still opens them all.
// Legacy/secondary pages sit under More so nothing breaks.
const WORKSPACE_NAV = [
  ['hubs','Library Home',Compass],['store','Themes & Palettes',StoreIcon],['assets','Good Copy & Ad Vault',Images],['trends','Trends & Deep Research',Flame],['agents','Subagents & General Skills',Bot],['library','All Saved Docs',BookOpen],
];
// More (#/more, Nov 5) is one page of doors; these pages open from it, and More stays marked while one is open.
const MORE_NAV = [['memory','Memory & Lessons',Brain],['tools','Tools',Wrench],['files','Files',FolderOpen],['learning','Learning log',FlaskConical],['issues','Issues (archive)',MessageSquareQuote],['maps','Maps',GitBranch]];
const MORE_IDS = MORE_PAGES;
// Colours: Settings (#/settings) picks the scheme and mode; appearance.mjs saves them, tokens.css holds them.
const VIEW_TITLES = Object.fromEntries([['pipeline','Pipeline'],['today','To-do'],['settings','Settings'],['issues','Issues'],['ads','Meta Ads'],['winners','Winners'],['build','Store'],['create','Creatives'],['creatives','Creatives'],['checklist','Launch Checklist'],['launch','Launch'],['manage','Manage'],['improve','Manage'],...WORKSPACE_NAV,...MORE_NAV,['hubs','Library'],['more','More'],['connect','Connect']].map(([id,label])=>[id,label]));

function parseHash() {
  // Split before decoding so a folder or file name holding "&", "=" or "?" stays one value.
  const [rawPath,query=''] = window.location.hash.replace(/^#\/?/,'').split('?');
  let path = rawPath; try {path = decodeURIComponent(rawPath);} catch {}
  const params = Object.fromEntries(new URLSearchParams(query));
  // The owner's seven pipeline steps ending at Launch (Product, Verify, Winners, Store, Creatives, Checklist, Launch) + Manage in its own tab.
  if (path==='winners') return {view:'winners',params};
  // Connect (#/connect) was first built as Connectors; the old link still lands here.
  if (path==='connectors') {history.replaceState(null,'',`#/connect${query?`?${query}`:''}`);return {view:'connect',params};}
  if (path==='build') return {view:'build',params};
  if (path==='create'||path==='creatives') {
    if (path==='creatives') history.replaceState(null,'',`#/create${query?`?${query}`:''}`);
    return {view:'creatives',params};
  }
  if (path==='checklist') return {view:'checklist',params};
  if (path==='launch') return {view:'launch',params};
  if (path==='manage'||path==='improve') return {view:'improve',params};
  if (path==='learn') {history.replaceState(null,'',`#/manage${query?`?${query}`:''}`);return {view:'improve',params};}
  if (path==='verify') return {view:'stage',stage:'prove',params};
  if (path==='buyers'||path==='prove') {history.replaceState(null,'','#/verify');return {view:'stage',stage:'prove',params};}
  if (OLD_STEP_SLUGS[path]) {history.replaceState(null,'','#/pipeline');return {view:'pipeline',params};}
  if (SLUG_STAGES[path]) return {view:'stage',stage:SLUG_STAGES[path],params};
  // Step 0, the issue list (owner, Oct 3): the old Step 1 page (#/issue) opens #/issues.
  if (OLD_LIBRARY_SLUGS.includes(path)) {history.replaceState(null,'',`#/${ISSUE_LIBRARY_SLUG}`);return {view:ISSUE_LIBRARY_SLUG,params};}
  // One product's own line: #/product/L096 or #/product/P001 (a card or its product record).
  // The older #/p/<id> looked like Launchroom's project path (/p/<project>/), so it redirects.
  const item = productRoute(path);
  if (item?.redirect) {history.replaceState(null,'',`#/${item.redirect}${query?`?${query}`:''}`);return {view:'item',id:item.id,params};}
  if (item) return {view:'item',id:item.id,params};
  if (VIEW_TITLES[path]) return {view:path,params};
  return {view:'home',params};
}

function usePoll(url, interval) {
  const [value,setValue] = useState(null), [error,setError] = useState('');
  const load = useCallback(async()=>{try{setValue(await api(url));setError('');}catch(e){setError(e.message);}},[url]);
  useEffect(()=>{load();const timer=setInterval(load,interval);return()=>clearInterval(timer);},[load,interval]);
  return [value,setValue,load,error];
}

const MERRIVY = {id:MERRIVY_ID,name:'Merrivy',kind:'legacy'};

export default function App({project:projectProp}) {
  // The project this workspace shows (Launchroom passes it; the Merrivy defaults keep a bare dev build working).
  const lr = useLaunchroom();
  const project = projectProp||lr?.project||MERRIVY;
  const projectName = project.name;
  const [route,setRoute] = useState(parseHash);
  const [data,setData] = useState(null),[hub,setHub] = useState({assets:[],resourceMedia:[],maps:[],folders:[]}),[activity,setActivity] = useState([]),[activityError,setActivityError] = useState(''),[error,setError] = useState(''),[synced,setSynced] = useState(false);
  const [research,setResearch,loadResearch] = usePoll('/api/research',10000);
  const [curation,,loadCuration] = usePoll('/api/curation',60000);
  const [planner,setPlanner,loadPlanner,plannerError] = usePoll('/api/planner',5000);
  const [tools,setTools,loadTools,toolsError] = usePoll('/api/tools',30000);
  // The store map (Assets, and the picture counts on Create and Build) for the packet in the store.
  const [assetMap,setAssetMap,loadAssets,assetsError] = usePoll('/api/assets',20000);
  // Work done ahead of the owner's Save (Oct 3): each card's Prove it file, summarised by the server (read-only).
  const [proveAhead] = usePoll('/api/prove-ahead',30000);
  // The Launch Checklist ticks (Nov 4): they split Checklist from Launch on the line.
  const [launchChecklists,,loadLaunchChecklists] = usePoll('/api/launch-checklists',15000);
  // Connect (Nov 5): the agent browser and the sites signed in to it, for the green light at the top of the sidebar.
  // Only the owner's own browser on this computer reads the agent browser; elsewhere it answers with a refusal.
  const [agentBrowser,setAgentBrowser,loadAgentBrowser,agentBrowserError] = usePoll('/api/agent-browser',15000);
  const [connectorList,setConnectorList,loadConnectorList] = usePoll('/api/connectors',60000);
  const connect = connectState(agentBrowserError?{error:agentBrowserError}:agentBrowser,connectorList?.connectors||[]);
  const [doc,setDoc] = useState(null),[toast,setToast] = useState(''),[palette,setPalette] = useState(false),[mobile,setMobile] = useState(false);
  const onMorePage = route.view==='more'||MORE_IDS.includes(route.view);
  const [sourceProduct,setSourceProduct] = useState(null),[libraryView,setLibraryView] = useState('shelf');

  const loadWork = useCallback(async()=>{
    const bootstrap = api('/api/bootstrap').then(value=>{setData(value);setError('');setSynced(true);}).catch(e=>{setError(e.message);setSynced(false);});
    try {const value = await api('/api/activity');setActivity(value.activity||[]);setActivityError('');} catch {setActivityError('Activity could not refresh. Last saved updates are shown.');}
    await bootstrap;
  },[]);
  // The hub walks the files on disk and is half a megabyte, so it refreshes every 30 seconds (and on any action), not every 5.
  const loadHub = useCallback(async()=>{try {setHub(await api('/api/hub'));} catch {}},[]);
  const refresh = useCallback(async()=>{await Promise.all([loadWork(),loadHub()]);},[loadWork,loadHub]);
  useEffect(()=>{refresh();const work=setInterval(loadWork,5000),files=setInterval(loadHub,30000);return()=>{clearInterval(work);clearInterval(files);};},[refresh,loadWork,loadHub]);
  useEffect(()=>{const onHash=()=>{setRoute(parseHash());setMobile(false);};window.addEventListener('hashchange',onHash);return()=>window.removeEventListener('hashchange',onHash);},[]);
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'});},[route.view,route.stage,route.id]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4200);return()=>clearTimeout(t);},[toast]);
  // The eye test's Undo (owner, Oct 3): one toast for 5 seconds after a decision.
  const [undo,setUndo] = useState(null);
  useEffect(()=>{if(!undo)return;const t=setTimeout(()=>setUndo(null),UNDO_MS);return()=>clearTimeout(t);},[undo]);
  useEffect(()=>{
    const onKey = event => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable;
      if ((event.key==='k'||event.key==='K')&&(event.metaKey||event.ctrlKey)) {event.preventDefault();setPalette(open=>!open);}
      else if (event.key==='/'&&!typing&&!document.querySelector('dialog[open]')) {event.preventDefault();setPalette(true);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);

  const go = useCallback(path=>{const next='#/'+(path||'');if(window.location.hash===next){setRoute(parseHash());}else window.location.hash=next;setMobile(false);},[]);
  const notify = useCallback(message=>{setToast(message);refresh();loadPlanner();loadResearch();},[refresh,loadPlanner,loadResearch]);

  const leads = useMemo(()=>buildLeads(research,curation),[research,curation]);
  const scope = data?processScope(data.products,data.workspace?.activeProductId):{product:null,market:null};
  const flow = data?processState(data.stages,data.checks,scope.market):null;
  const signals = useMemo(()=>data?stageSignals({data,research,leads,hub}):{},[data,research,leads,hub]);
  // The pipeline (every product's own line) and its focus step, worked out once (the same function as the server's briefs).
  // Every product has its own line; `current` is the pipeline's focus step plus the whole `current.pipeline`.
  const current = useMemo(()=>data?currentStep({line:data.line,lineError:data.lineError,stages:data.stages,checks:data.checks,products:data.products,archivedProducts:data.archivedProducts||[],reviews:data.workspace?.reviews||[],buildProductId:data.workspace?.buildProductId??data.workspace?.activeProductId??null,leads,rounds:data.rounds?.rounds||[],roundsRevision:data.rounds?.revision??null,roundsError:data.roundsError||'',issues:Array.isArray(data.issues)?data.issues:null}):null,[data,leads]);
  const day = localDay();
  const ownerToday = (planner?.tasks||[]).filter(task=>task.status!=='done'&&task.assignee!=='agent'&&task.date&&task.date<=day).length;
  const agentsCount = agentsNavCount({tasks:planner?.tasks||[],activity});

  async function saveTask(input) {
    const next = await api('/api/planner/tasks',input);
    setPlanner(next);return next;
  }
  // Today's "From earlier" buttons and Wrap up the day: one revision-checked move.
  async function moveTasks(input) {
    const {moved,unflagged,...next} = await api('/api/planner/move',input);
    setPlanner(next);return {moved,unflagged,planner:next};
  }
  // To-do: delete leaves every list at once; restore brings it back (Undo, Recently deleted).
  async function deleteTasks(input) {const next = await api('/api/planner/delete',input);setPlanner(next);return next;}
  async function restoreTasks(input) {const next = await api('/api/planner/restore',input);setPlanner(next);return next;}
  // One tap decides (owner, Oct 3): `extra` holds the optional quick-reason chips and note.
  async function recordDecision(lead, decision, extra = {}) {
    // Undo a decision said in chat (Oct 3): the decision before it comes back; the chat record goes.
    if (decision==='undo-said') {
      const fresh = await api('/api/research');
      const current = fresh.candidates.find(c=>c.id===lead.id);
      if (!current) throw new Error(`${lead.id} is no longer in the research record.`);
      const was = saidOf(current.screen)?.before?.ownerDecision||'unreviewed';
      const saved = await api('/api/research',{revision:fresh.revision,candidate:undoSaidCandidate(current)},'PATCH');
      setResearch(saved);setToast(was==='unreviewed'?`${lead.id} is waiting for your eye test again.`:`${lead.id} is ${DECISION_WORDS[was]} again.`);
      return saved;
    }
    const {tags = [], note = ''} = typeof extra === 'string' ? {note: extra} : extra || {};
    const candidate = ownerDecisionCandidate(lead,decision,note,tags);
    const before = decisionOf(lead.candidate?.screen);
    try {
      const saved = await api('/api/research',{revision:research.revision,candidate},'PATCH');
      setResearch(saved);
      setToast('');
      setUndo({key:Date.now(),leadId:lead.id,before,message:`${lead.id} ${DECISION_WORDS[decision]}.`});
      return saved;
    } catch (e) {
      if (/revision|changed|reload/i.test(e.message)) await loadResearch();
      throw e;
    }
  }
  // Reopen (owner, Oct 3, CHECKS.md rule 3): a failed check took the product out of the line; one tap sends that exact failure back, with Undo.
  async function reopenProduct(item) {
    const mark = item?.outcome?.check?.mark;
    if (!mark||!item.leadId) throw new Error('Only a product that failed a check can be reopened.');
    const fresh = await api('/api/research');
    const current = fresh.candidates.find(c=>c.id===item.leadId);
    if (!current) throw new Error(`${item.leadId} is no longer in the research record.`);
    const saved = await api('/api/research',{revision:fresh.revision,candidate:reopenCandidate(current,mark)},'PATCH');
    setResearch(saved);setToast('');
    setUndo({key:Date.now(),kind:'reopen',leadId:item.leadId,mark,line:item.outcome.check.line,message:`${item.leadId} is back on the line.`});
    return saved;
  }
  // Undo puts the card's earlier decision (or its failure, after a Reopen) back on the latest saved record.
  async function undoDecision(item) {
    setUndo(null);
    try {
      const fresh = await api('/api/research');
      const current = fresh.candidates.find(c=>c.id===item.leadId);
      if (!current) throw new Error(`${item.leadId} is no longer in the research record.`);
      if (item.kind==='reopen') {
        setResearch(await api('/api/research',{revision:fresh.revision,candidate:unreopenCandidate(current,item.mark)},'PATCH'));
        setToast(`${item.leadId} is failed at ${item.line} again.`);
        return;
      }
      const saved = await api('/api/research',{revision:fresh.revision,candidate:undoCandidate(current,item.before)},'PATCH');
      setResearch(saved);
      // The Find drawer moved on to the next card after the tap; Undo brings the owner back to this one.
      if (route.params?.lead&&route.params.lead!==item.leadId) go(`find?lead=${item.leadId}`);
      setToast(item.before.ownerDecision==='unreviewed'?`${item.leadId} is waiting for your eye test again.`:`${item.leadId} is ${DECISION_WORDS[item.before.ownerDecision]} again.`);
    } catch (e) {
      setToast(`Undo did not save: ${e.message}`);
      loadResearch();
    }
  }

  // Products start from a card the owner saved (agents run os.mjs product start); there is no form for it.
  const requestProduct = ()=>{setToast('A product starts from a card you saved. Ask Claude: "Start the product record for L###".');go('pipeline');};
  const pipeline = current?.pipeline||null;
  // Step 0 · the issue list (owner, Oct 3): how many issues, how many testing, from the saved statuses.
  const issueStation = useMemo(()=>issueStationOf(pipeline),[pipeline]);
  const shared = {data,hub,activity,activityError,refresh,notify,openDoc:setDoc,requestProduct,
    openMap:()=>go(STAGE_SLUGS[LINE[current?.index??0].id]),openStore:()=>go('build'),openAssets:()=>go('assets'),openLibrary:view=>{setLibraryView(view||'shelf');go('library');},libraryView,openLearning:()=>go('learning'),openMemory:()=>go('memory'),
    research,setResearch,loadResearch,curation,leads,reopenProduct,proveAhead,planner,tools,setTools,loadTools,toolsError,assetMap,setAssetMap,loadAssets,assetsError,plannerError,loadPlanner,deleteTasks,restoreTasks,saveTask,moveTasks,recordDecision,flow,scope,signals,current,line:data?.line||null,go,route,day,
    // Merrivy's own store, previews and links show only in Merrivy (the original workspace).
    project,isMerrivy:project.id===MERRIVY_ID};
  const filesParams = useCallback(next=>{const query = new URLSearchParams(Object.entries(next).filter(([,value])=>value)).toString();go(`files${query?`?${query}`:''}`);},[go]);

  const stageTitle = route.view==='stage'?(route.stage==='launch'?'Launch':DISPLAY_LINE.find(entry=>entry.steps.includes(route.stage))?.title||LINE.find(s=>s.id===route.stage)?.title):null;
  const openItem = route.view==='item'?findItem(pipeline,route.id):null;
  const crumb = route.view==='item'?(openItem?`${openItem.id} · ${openItem.name}`:route.id):route.view==='home'?'Home':route.view==='stage'?stageTitle:route.view==='files'&&route.params.view==='removed'?'Files › Removed':VIEW_TITLES[route.view];
  useEffect(()=>{document.title=docTitle(crumb,projectName);},[crumb,projectName]);

  const checklistContextValue = useMemo(
    () => ({
      ...(launchChecklists ? {...launchChecklists, metaCampaigns: hub?.metaCampaigns || []} : {items: [], products: {}, metaCampaigns: hub?.metaCampaigns || []}),
      team: data?.team || {agents: [], skills: []},
      refresh,
      notify,
      openDoc: setDoc,
    }),
    [launchChecklists, hub?.metaCampaigns, data?.team, refresh, notify]
  );

  return <ChecklistContext.Provider value={checklistContextValue}><PipelineContext.Provider value={pipeline}><div className="mv-app">
    {mobile&&<button className="mv-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    <aside className={`mv-side ${mobile?'is-open':''}`} aria-label="Launchroom navigation">
      <div className="mv-lr-side-head"><a className="mv-lr-wordmark" href="#/" onClick={e=>{e.preventDefault();go('');}}>Launchroom</a></div>
      {/* Connect first (owner, Nov 5): "in order for agents to do work, they need a browser ... once you're connected, it says in green." */}
      <button className={`mv-side-connect is-${connect.id}`} aria-current={route.view==='connect'?'page':undefined} onClick={()=>go('connect')} title={connect.line}>
        <span className="mv-side-connect-icon"><Plug size={16}/></span>
        <span className="mv-side-connect-text"><strong>{connect.id==='on'?'Connected':'Connect'}</strong><small>{connect.id==='on'?connect.line:connect.id==='off'?'Not connected · start here':connect.line}</small></span>
        <i className="mv-side-connect-dot" aria-hidden="true"/>
      </button>
      <button className="mv-nav-item" aria-current={route.view==='home'?'page':undefined} onClick={()=>go('')}><LayoutDashboard size={17}/>Home</button>
      <button className="mv-nav-item" aria-current={route.view==='today'?'page':undefined} onClick={()=>go('today')}><ListTodo size={17}/>To-do
        {ownerToday>0&&<span className="mv-nav-count" title={`${ownerToday} open for today`}>{ownerToday}</span>}
      </button>
      {(()=>{
        const allStations = displayStations(pipeline,checklistContextValue);
        const discoveryStations = allStations.slice(0,3);
        const buildStations = allStations.slice(3);
        const renderStation = station => {
          const here = station.count+station.ready;
          const Icon = DISPLAY_ICONS[station.id];
          const at = route.view===station.id||(route.view==='stage'&&station.steps.includes(route.stage)&&station.id!=='winners'&&station.id!=='checklist'&&station.id!=='launch'&&station.id!=='build'&&station.id!=='creatives');
          return <button key={station.id} className={`mv-line-item ${here?'mv-pl-side-busy':''} ${station.owner?'is-owner mv-pl-side-owner':''}`} aria-current={at?'page':undefined} onClick={()=>go(station.target)} aria-label={`${station.short}: ${station.label}`}>
            <span className="mv-line-dot"/>
            <span className="mv-line-text"><strong><Icon size={13} style={{verticalAlign:'-2px',marginRight:5}}/>{station.short}</strong><small>{station.id==='winners'&&station.ready?`${station.ready} ready to choose`:station.ready?`${station.ready} ready to build`:station.owner&&station.id==='product'?'waits for your eye test':station.owner?'waits for you':station.count?`${station.count} product${station.count===1?'':'s'}`:'none'}</small></span>
            <span className={`mv-pl-side-count ${here?'has-items':''} ${station.owner?'is-owner':''}`}>{here}</span>
          </button>;
        };
        const liveCampaigns = hub?.metaCampaigns || [];
        const liveCount = liveCampaigns.length;
        const totalAdsCount = liveCampaigns.reduce((acc, c) => acc + (c.ads?.length || 0), 0);
        const totalOrdersCount = liveCampaigns.reduce((acc, c) => acc + Number(c.summaryLifetime?.purchases ?? c.summaryToday?.purchases ?? 0), 0);
        const activeManageTab = route.view==='improve' ? (route.params?.tab || 'overview') : '';
        const manageTabs = [
          { id: 'overview', short: 'Daily Numbers', sub: 'spend, ROAS & daily pulse', count: liveCount, Icon: TrendingUp, target: 'manage?tab=overview' },
          { id: 'ads', short: 'Ad Testing', sub: 'winners, bleeders & new ads', count: totalAdsCount, Icon: Megaphone, target: 'manage?tab=ads' },
          { id: 'store', short: 'Store & CRO', sub: 'conversion, bundles & orders', count: totalOrdersCount, Icon: StoreIcon, target: 'manage?tab=store' },
          { id: 'grow', short: 'Scale or Cut', sub: 'baseline test, scale or cancel', count: liveCount, Icon: Flame, target: 'manage?tab=grow' },
        ];
        return <>
          <div className="mv-nav-label">Find &amp; Winners</div>
          <nav className="mv-line-nav" aria-label="Discovery and Winner selection">
            {discoveryStations.map(renderStation)}
          </nav>
          <div className="mv-nav-label">Build &amp; Launch</div>
          <nav className="mv-line-nav" aria-label="Build and launch chosen winner">
            {buildStations.map(renderStation)}
          </nav>
          <div className="mv-nav-label">Manage</div>
          <nav className="mv-line-nav" aria-label="Manage, improve and scale launched products">
            {manageTabs.map(tab => {
              const Icon = tab.Icon;
              const at = activeManageTab === tab.id;
              return <button key={tab.id} className={`mv-line-item ${tab.count?'mv-pl-side-busy':''}`} aria-current={at?'page':undefined} onClick={()=>go(tab.target)} aria-label={`${tab.short}: ${tab.sub}`}>
                <span className="mv-line-dot"/>
                <span className="mv-line-text"><strong><Icon size={13} style={{verticalAlign:'-2px',marginRight:5}}/>{tab.short}</strong><small>{tab.sub}</small></span>
                <span className={`mv-pl-side-count ${tab.count?'has-items':''}`}>{tab.count}</span>
              </button>;
            })}
          </nav>
        </>;
      })()}
      <div className="mv-nav-label">Library</div>
      {WORKSPACE_NAV.map(([id,label,Icon])=><button key={id} className="mv-nav-item" aria-current={route.view===id?'page':undefined} onClick={()=>{if(id==='library')setLibraryView('shelf');go(id==='agents'?'agents?tab=skills':id);}}><Icon size={17}/>{label}
        {id==='agents'&&agentsCount.value>0&&<span className={`mv-nav-count ${agentsCount.kind==='live'?'is-live':''}`} title={agentsCount.label} aria-label={agentsCount.label}>{agentsCount.value}</span>}
      </button>)}
      <button className="mv-nav-item mv-side-more-link" aria-current={onMorePage?'page':undefined} onClick={()=>go('more')}><MoreHorizontal size={17}/>More<small>Memory, rules, tools, files</small></button>
      <div className="mv-side-foot">
        <button className="mv-nav-item mv-side-settings" aria-current={route.view==='settings'?'page':undefined} onClick={()=>go('settings')}><SettingsIcon size={17}/>Settings<small>Light, dark, colours</small></button>
      </div>
    </aside>
    <div className="mv-shell">
      <header className="mv-top">
        <button className="mv-icon-btn mv-menu-btn" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu size={19}/></button>
        <div className="mv-crumbs mv-lr-crumbs-top"><button className="mv-lr-crumb-home" onClick={()=>go('')} title="Home"><ProjectMark project={project} size={18}/>Launchroom</button><ChevronRight size={13}/>{MORE_IDS.includes(route.view)&&<><button className="mv-lr-crumb-home" onClick={()=>go('more')}>More</button><ChevronRight size={13}/></>}<strong>{crumb}</strong></div>
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <span className={`mv-sync ${synced?'':'is-off'}`} title={synced?'Workspace records refresh every few seconds':'Reconnecting to the local server'}><i/><span>{synced?'Live':'Connecting'}</span></span>
          <button className="mv-icon-btn mv-lr-refresh" title="Refresh now" aria-label="Refresh workspace" onClick={()=>{refresh();loadPlanner();loadResearch();loadCuration();loadTools();loadAssets();}}><RefreshCw size={15}/></button>
        </div>
      </header>
      <main className="mv-main" id="main-content">
        {error&&<div className="mv-error" style={{marginBottom:16}}><ErrorText error={error}/><button className="mv-btn sm" onClick={refresh}>Reconnect</button></div>}
        {data?.lineError&&<div className="mv-error" role="alert" style={{marginBottom:16}}>{data.lineError} The step guide is unavailable until it is repaired.</div>}
        {!data&&!error?<div className="mv-loading"><LoaderCircle className="mv-spin" size={22}/>Opening Launchroom…</div>:data&&<div key={route.view+(route.stage||'')+(route.id||'')} className="mv-fade-in">
          {route.view==='home'?<Home {...shared}/>
          :route.view==='pipeline'?<PipelinePage {...shared}/>
          :route.view==='hubs'?<HubsPage {...shared}/>
          :route.view==='trends'?<TrendsView {...shared}/>
          :route.view==='ads'?<MetaAdBoard hub={hub}/>
          :route.view==='winners'?<WinnersPage {...shared}/>
          :route.view==='build'?<StoreEditor mode="pipeline" {...shared}/>
          :route.view==='creatives'?<CreativesPage {...shared}/>
          :route.view==='checklist'?<ChecklistPage {...shared} reloadChecklists={loadLaunchChecklists}/>
          :route.view==='launch'?<LaunchPage {...shared} reloadChecklists={loadLaunchChecklists}/>
          :route.view==='improve'?<ImprovePage {...shared} tasks={planner?.tasks||[]}/>
          :route.view==='item'?<ProductPage key={route.id} id={route.id} {...shared}/>
          :route.view==='stage'&&route.stage==='product'?<CatalogPage {...shared}/>
          :route.view==='stage'&&route.stage==='prove'?<VerifyPage {...shared}/>
          :route.view==='stage'?<StagePage key={route.stage} stageId={route.stage} {...shared}/>
          :route.view==='today'?<TodayView {...shared}/>
          :route.view==='agents'?<AgentsView {...shared}/>
          :route.view==='memory'?<MemoryView {...shared}/>
          :route.view==='library'?<LibraryView {...shared} setLibraryView={setLibraryView}/>
          :route.view==='tools'?<ToolsView {...shared}/>
          :route.view==='assets'?<AssetsView {...shared}/>
          :route.view==='store'?<StoreEditor mode="hub" {...shared}/>
          :route.view==='files'?<FilesView scope={project} params={route.params} onParams={filesParams}/>
          :route.view==='issues'?<IssuesPage {...shared}/>
          :route.view==='learning'?<LearningView {...shared}/>
          :route.view==='maps'?<div className="mv-legacy"><FreeformMap {...shared}/></div>
          :route.view==='more'?<MorePage {...shared} project={project}/>
          :route.view==='connect'?<ConnectorsPage {...shared} browserState={agentBrowser} browserError={agentBrowserError} reloadBrowser={loadAgentBrowser} setBrowserState={setAgentBrowser} connectorsState={connectorList} setConnectorsState={setConnectorList} reloadConnectors={loadConnectorList}/>
          :route.view==='settings'?<SettingsView/>
          :null}
        </div>}
      </main>
      <nav className="mv-mobile-tabbar" aria-label="Mobile quick navigation">
        <button type="button" className={`mv-mobile-tab ${route.view==='home'?'is-active':''}`} onClick={()=>go('')}>
          <LayoutDashboard size={18}/>
          <span>Home</span>
        </button>
        <button type="button" className={`mv-mobile-tab ${route.view==='winners'||(route.view==='stage'&&(route.stage==='product'||route.stage==='prove'))?'is-active':''}`} onClick={()=>go('winners')}>
          <Compass size={18}/>
          <span>Winners</span>
        </button>
        <button type="button" className={`mv-mobile-tab ${['build','creatives','checklist','launch'].includes(route.view)?'is-active':''}`} onClick={()=>go('build')}>
          <StoreIcon size={18}/>
          <span>Build</span>
        </button>
        <button type="button" className={`mv-mobile-tab ${route.view==='improve'?'is-active':''}`} onClick={()=>go('manage')}>
          <TrendingUp size={18}/>
          <span>Manage</span>
          {(hub?.metaCampaigns?.length||0)>0&&<i className="mv-mobile-tab-badge">{hub.metaCampaigns.length}</i>}
        </button>
        <button type="button" className={`mv-mobile-tab ${mobile?'is-active':''}`} onClick={()=>setMobile(m=>!m)}>
          <Menu size={18}/>
          <span>Menu</span>
        </button>
      </nav>
    </div>
    {palette&&data&&<Palette onClose={()=>setPalette(false)} data={data} leads={leads} pipeline={pipeline} planner={planner} tools={tools?.tools||[]} go={go} openDoc={setDoc} projects={lr?.projects||[]} project={project}/>}
    {sourceProduct&&data?.products.find(p=>p.id===sourceProduct.id)&&<SourceManager product={data.products.find(p=>p.id===sourceProduct.id)} market={data.products.find(p=>p.id===sourceProduct.id).markets.find(m=>m.id===sourceProduct.marketId)} notify={notify} openDoc={setDoc} onClose={()=>setSourceProduct(null)}/>}
    {doc&&<DocumentViewer path={doc} onClose={()=>setDoc(null)} onNavigate={setDoc}/>}
    {/* Toasts sit inside an open drawer (a modal dialog makes the rest of the page unclickable). */}
    {(toast||undo)&&createPortal(undo?<div key={undo.key} className="mv-toast mv-toast-undoable" role="status"><CheckCheck size={17}/><span>{undo.message}</span><button type="button" className="mv-toast-undo" onClick={()=>undoDecision(undo)}><Undo2 size={15}/>Undo</button><span className="mv-toast-timer" aria-hidden="true"/></div>
      :<div className="mv-toast" role="status"><CheckCheck size={17}/>{toast}</div>,document.querySelector('dialog.mv-sheet[open]')||document.body)}
  </div></PipelineContext.Provider></ChecklistContext.Provider>;
}

