// Pure derivations for the visual workflow. Progress and product status come
// from canonical records only; viewing, dragging or opening a stage never
// advances evidence.
import {RESEARCH_GATE_IDS,SCREEN_CHECK_IDS,screenReady,effectiveResearchGateStatus} from './researchView.mjs';
import {splitCurationBatches} from './curationView.mjs';
import {eyeTestCandidate} from './eyeTest.mjs';
import {leadSummary} from './theLine.mjs';
import {lineLeadState} from './pipeline.mjs';
import {FOCUS_LIMIT,focusRoom,hasAgent,stepId,stepName,isDispatchable,isParkedAgentTask} from './plannerRules.mjs';

// The seven steps (owner, Oct 2: Product first, then Buyers; ids and names from src/steps.mjs).
export const LINE = [
  {id:'product',short:'Product',title:'Upfront Product & 4-Gate Audit',goal:'Early-wave breakout products (100–2,500 sold, RISING velocity, <50% creator concentration, 3x+ Alibaba margin, 15+ buyer quotes & Meta audit done upfront).'},
  {id:'buyers',short:'Buyers',title:'Know its buyers',goal:'This product\'s buyers in their own words: avatars, trigger moments and the angle nobody uses.'},
  {id:'prove',short:'Verify',title:'Verify',goal:'Room on Meta, the exact item, the money line and claims we can back. A product that passes is ready to build.'},
  {id:'create',short:'Create',title:'Viral Reveal Hooks & Ad Creative Pack (Track A / Track B)',goal:'Harvest top viral video hooks & reveal captions ("You have to get this...") + our offer · Track A: 15–20+ creator .mp4 videos · Track B: 4:5 testimonial native ads + videos.'},
  {id:'build',short:'Build',title:'Build /products/<handle> & Cart AOV Stack',goal:'Grimoire template on merrivy.com/products/<handle> with viral reveal hero headline + Slide-Out Cart Drawer ($2.99 Transit Protection, 1-Tap Bundle Upgrade & 3–4 Niche Add-Ons).'},
  {id:'launch',short:'Launch',title:'Launch $50/day Broad CBO Test',goal:'Shaunn\'s KPI sheet, 1 clean Purchase pixel event, and $50/day Broad CBO across US, CA, GB, NZ, AU.'},
  {id:'learn',short:'Improve',title:'Improve',goal:'Live products: full-day CBO runs, surf-scaling winners ($50 → $100 → $150/day+) and what we improve on the page and the ads.'},
];

// The 5 visible pipeline steps (Buyers and Prove it are completed upfront inside Step 1 · Product).
export const VISIBLE_LINE = LINE.filter(s => s.id !== 'buyers' && s.id !== 'prove');

export const LEAD_STATES = {
  waiting:{label:'Waiting for you',column:'waiting'},
  // Find page only: a waiting card whose five Find checks don't all pass yet (findReady).
  checking:{label:'Being checked',column:'checking'},
  saved:{label:'Saved · screen open',column:'saved'},
  ready:{label:'Ready for deep checks',column:'ready'},
  reviewed:{label:'Review complete',column:'reviewed'},
  passed:{label:'Passed for now',column:'aside'},
  rejected:{label:'Rejected',column:'aside'},
  parked:{label:'Parked',column:'aside'},
  killed:{label:'Killed',column:'aside'},
  // A failed gate check took it out of the line (CHECKS.md rule 3); the owner can reopen it on its page.
  failed:{label:'Failed a check',column:'aside'},
};

export const BOARD_COLUMNS = [
  {id:'waiting',title:'Your eye test',hint:'Save, pass or reject'},
  {id:'saved',title:'Saved for checks',hint:'Source & profit checks open'},
  {id:'ready',title:'Deep checks',hint:'Demand, community, competition'},
  {id:'reviewed',title:'Review complete',hint:'Counts toward 5 reviews'},
  {id:'aside',title:'Set aside',hint:'Parked, passed or killed'},
];

export const emptyScreen = () => ({ownerDecision:'unreviewed',ownerReason:'',checks:Object.fromEntries(SCREEN_CHECK_IDS.map(id=>[id,{status:'pending',note:'',source:'',observedAt:'',country:'',evidenceType:''}]))});

// Mirrors server/research.mjs reviewComplete so the board never shows a
// review as complete before the server would count it.
export function reviewComplete(candidate) {
  return Boolean(candidate&&screenReady(candidate)&&!candidate.missingEvidence?.gates?.length&&candidate.country&&candidate.buyer&&RESEARCH_GATE_IDS.every(id=>['supported','failed'].includes(candidate.gates?.[id]?.status)));
}

export function leadState(candidate, card) {
  const decision = candidate?.screen?.ownerDecision;
  if (decision==='rejected') return 'rejected';
  if (decision==='passed') return 'passed';
  if (decision==='saved') return reviewComplete(candidate)?'reviewed':screenReady(candidate)?'ready':'saved';
  const text = candidate?.decision || '';
  if (/^\s*KILL\b/i.test(text) || (!text && card?.disposition==='KILL')) return 'killed';
  if (/^\s*PARK\b/i.test(text) || (!text && card?.disposition==='PARK')) return 'parked';
  if (/CURATED/i.test(text) || (!text && card?.disposition==='CURATED')) return 'waiting';
  return 'parked';
}

export function buildLeads(research, curation) {
  const batches = curation?.batches || [];
  const currentPaths = new Set(splitCurationBatches(batches).current.map(batch=>batch.path));
  const cards = new Map();
  for (const batch of batches) for (const card of batch.cards || []) {
    if (!cards.has(card.id)) cards.set(card.id,{...card,batchLabel:batch.label,batchPath:batch.path,current:currentPaths.has(batch.path)});
  }
  const candidates = new Map((research?.candidates || []).map(candidate=>[candidate.id,candidate]));
  const ids = new Set([...candidates.keys(),...cards.keys()]);
  return [...ids].map(id=>{
    const candidate = candidates.get(id) || null, card = cards.get(id) || null;
    return {
      id, name:card?.name || candidate?.name || id, candidate, card,
      state:leadState(candidate,card), current:Boolean(card?.current),
      image:card?.imagePath || '', imageAlt:card?.imageAlt || '',
      externalUrl:card?.externalUrl || '', sourcePath:card?.sourcePath || candidate?.references?.find(ref=>!/^https?:/.test(ref)) || '',
      heading:card?.heading || '', batchLabel:card?.batchLabel || '',
      gates:RESEARCH_GATE_IDS.map(gate=>[gate,candidate?effectiveResearchGateStatus(candidate,gate):'pending']),
      screen:SCREEN_CHECK_IDS.map(check=>[check,candidate?.screen?.checks?.[check]?.status || 'pending']),
    };
  }).sort((a,b)=>Number(b.current)-Number(a.current)||Number(b.id.slice(1))-Number(a.id.slice(1)));
}

// The owner's eye-test choice is the only research write the board makes.
// One tap decides (owner, Oct 3): the note and the 0-2 quick-reason chips are optional.
const emptyCard = lead => ({
  id:lead.id,name:lead.name,country:'',buyer:'',decision:'CURATED — UNVERIFIED',
  nextAction:'Complete the pre-verification screen.',references:[lead.sourcePath].filter(Boolean),
  gates:Object.fromEntries(RESEARCH_GATE_IDS.map(id=>[id,{status:'pending',note:'',source:'',observedAt:'',window:''}])),
  screen:emptyScreen(),
});
export function ownerDecisionCandidate(lead, decision, reason = '', tags = []) {
  const next = eyeTestCandidate(lead, decision, {tags, note: reason}, emptyCard);
  next.screen = {...emptyScreen(), ...next.screen};
  return next;
}

export function stageSignals({data, research, leads: saved = [], hub}) {
  // A saved card an agent parked (PARK or KILL) is out of the line, as on the Pipeline (lineLeadState).
  const leads = saved.map(lead=>({...lead,state:lineLeadState(lead)}));
  const candidates = research?.candidates || [];
  const count = state => leads.filter(lead=>lead.state===state).length;
  const supported = check => candidates.filter(c=>c.screen?.checks?.[check]?.status==='supported').length;
  const summary = research?.summary || {};
  const store = data?.storeChecklist || {done:0,total:0};
  const improvements = data?.improvements || [];
  const cards = leadSummary(leads), waiting = cards.waiting;
  const issues = Array.isArray(data?.issues) ? data.issues : [];
  return {
    // Same counts as currentStep/leadSummary, so Home, the sidebar and the briefs agree.
    issue:{value:issues.filter(issue=>issue.gatePassed).length,label:'issues passed their gate',detail:issues.length?`${issues.length} researched`:''},
    product:{value:waiting||cards.checking||leads.filter(lead=>lead.card).length,label:waiting?(waiting===1?'waits for your eye test':'wait for your eye test'):cards.checking?'being checked':'product cards',detail:cards.saved?`${cards.saved} saved for checks`:'',owner:waiting>0},
    prove:{value:`${summary.reviewed||0}/${research?.minimumReviews||5}`,label:'complete reviews',detail:`${count('saved')+count('ready')} saved · ${supported('sourceMatch')} exact sources`},
    create:{value:(hub?.assets||[]).length,label:'production files'},
    build:{value:`${store.done}/${store.total}`,label:'store checks'},
    launch:{},
    learn:{value:improvements.filter(item=>item.status==='adopted').length,label:'lessons adopted',detail:`${(data?.workspace?.reviews||[]).length} cycle reviewed`},
  };
}

const dayKey = value => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

// Reported milestones per local day. It shows reporting rhythm, not effort
// or verified progress.
export function activityByDay(activity = [], days = 14, now = new Date()) {
  const out = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(now); d.setHours(12,0,0,0); d.setDate(d.getDate()-i);
    out.push({day:dayKey(d),total:0,byRole:{}});
  }
  const index = new Map(out.map((item,i)=>[item.day,i]));
  for (const record of activity) {
    const moments = record.events?.length ? record.events.map(event=>event.at) : [record.updatedAt];
    for (const at of moments) {
      const slot = index.get(dayKey(at));
      if (slot === undefined) continue;
      out[slot].total++;
      out[slot].byRole[record.role] = (out[slot].byRole[record.role]||0)+1;
    }
  }
  return out;
}

/**
 * A report is live only while it keeps reporting. A "running" report with no
 * update for more than a day, or a "blocked" one quiet for more than a week,
 * is stale: it shows with its last date, never as work in progress. The saved
 * report itself is unchanged.
 */
export const STALE_AFTER = {running:24*3600*1000,blocked:7*24*3600*1000};
const ms = value => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
export function reportFreshness(report, now = Date.now()) {
  if (!STALE_AFTER[report?.status]) return 'closed';
  const at = ms(report.updatedAt);
  return !Number.isFinite(at) || ms(now)-at > STALE_AFTER[report.status] ? 'stale' : 'live';
}
export const liveRunning = (activity = [], now = Date.now()) => activity.filter(item=>item.status==='running'&&reportFreshness(item,now)==='live');

export function agentSummary(agents = [], activity = [], now = Date.now()) {
  return agents.map(agent=>{
    const mine = activity.filter(item=>item.role===agent.id).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const live = item => reportFreshness(item,now)==='live';
    return {...agent,total:mine.length,running:mine.filter(item=>item.status==='running'&&live(item)).length,blocked:mine.filter(item=>item.status==='blocked'&&live(item)).length,latest:mine[0]||null};
  });
}

/**
 * Team board for the Agents tab. Status comes only from saved planner tasks
 * (owner/manager hand-offs) and saved activity reports, never from UI position.
 * A queued task waits for the manager to dispatch it; nothing runs by itself.
 */
export function teamBoard(agents = [], tasks = [], activity = [], day = '', recentDays = 7, now = Date.now()) {
  const since = day ? new Date(new Date(day+'T12:00:00').getTime()-recentDays*86400000).toISOString() : '';
  const known = new Set(agents.map(agent=>agent.id));
  const board = agents.map(agent=>{
    const mine = tasks.filter(task=>hasAgent(task,agent.id));
    const reports = activity.filter(item=>item.agent===agent.id).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const queued = mine.filter(isDispatchable), parked = mine.filter(isParkedAgentTask), doing = mine.filter(task=>task.status==='doing'), blocked = mine.filter(task=>task.status==='blocked');
    const done = mine.filter(task=>task.status==='done'&&(!since||String(task.completedAt)>=since));
    const running = reports.filter(item=>item.status==='running'&&reportFreshness(item,now)==='live');
    const needsInput = blocked.length+reports.filter(item=>item.status==='blocked'&&reportFreshness(item,now)==='live').length;
    const status = running.length||doing.length?'working':needsInput?'blocked':queued.length?'queued':'idle';
    const current = doing[0]||running[0]||blocked[0]||queued[0]||null;
    return {...agent,status,queued,parked,doing,blocked,done,running,needsInput,reports,latest:reports[0]||null,current};
  });
  const open = tasks.filter(task=>task.agent&&task.status!=='done');
  return {
    agents:board,
    waiting:open.filter(isDispatchable),
    parked:open.filter(isParkedAgentTask),
    working:open.filter(task=>task.status==='doing'),
    needsInput:open.filter(task=>task.status==='blocked'),
    doneRecently:tasks.filter(task=>task.agent&&task.status==='done'&&(!since||String(task.completedAt)>=since)),
    unknownAgents:[...new Set(tasks.filter(task=>task.agent&&!known.has(task.agent)).map(task=>task.agent))],
  };
}

const newest = (a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt));
const byDate = (a,b)=>(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99')||Number(Boolean(b.focus))-Number(Boolean(a.focus));

/**
 * Mission control for the Agents tab: the owner watches, Claude (the manager)
 * queues. Everything comes from saved planner tasks, activity reports and the
 * pipeline's owner moves (pipelineState); nothing here writes or dispatches.
 * - claude: the manager's own live reports (agent "manager").
 * - working: other live running reports.
 * - upNext: dated agent tasks still to do, by date then priority, else planner
 *   order. Someday agent tasks are `parked`: never up next, only a count.
 * - readyForYou: the owner's open tasks due by today, plus results finished in
 *   the last day (newest first, at most `newLimit`).
 * - needsDecision: the pipeline's owner moves (eye tests, the build pick,
 *   launch approval; pipelineState.ownerMoves), blocked tasks and live blocked
 *   reports.
 * - doneRecently: the next `doneLimit` finished reports not already shown.
 * - stale: running or blocked reports that stopped reporting (reportFreshness).
 */
const MOVE_GO = {'eye-test':()=>'find','build-pick':()=>'pipeline',launch:move=>`product/${move.ids?.[0]||''}`};
export function missionControl({tasks = [], activity = [], ownerMoves = [], day = '', now = Date.now(), newLimit = 4, doneLimit = 5} = {}) {
  const reports = [...activity].sort(newest);
  const live = item => reportFreshness(item,now)==='live';
  const running = reports.filter(item=>item.status==='running'&&live(item));
  const open = tasks.filter(task=>task.status!=='done');
  const dueBy = task => !day || (task.date && task.date<=day);
  const completed = reports.filter(item=>item.status==='completed');
  const results = completed.filter(item=>ms(now)-ms(item.updatedAt)<=STALE_AFTER.running).slice(0,newLimit);
  const shown = new Set(results.map(item=>item.id));
  const decisions = ownerMoves.map(move=>({kind:move.kind,id:move.kind,count:move.count,ids:move.ids||[],text:move.text||'',go:(MOVE_GO[move.kind]||(()=>'pipeline'))(move)}));
  return {
    claude:running.filter(item=>item.agent==='manager'),
    working:running.filter(item=>item.agent!=='manager'),
    upNext:open.filter(isDispatchable).sort(byDate),
    parked:open.filter(isParkedAgentTask),
    readyForYou:{tasks:open.filter(task=>task.assignee==='owner'&&task.status!=='blocked'&&dueBy(task)).sort(byDate),results},
    needsDecision:{items:decisions,tasks:open.filter(task=>task.status==='blocked').sort(byDate),reports:reports.filter(item=>item.status==='blocked'&&live(item))},
    doneRecently:completed.filter(item=>!shown.has(item.id)).slice(0,doneLimit),
    stale:reports.filter(item=>STALE_AFTER[item.status]&&!live(item)),
  };
}

/** The sidebar number for Agents: live running reports (manager included), else agent tasks up next. */
export function agentsNavCount({tasks = [], activity = [], now = Date.now()} = {}) {
  const running = liveRunning(activity,now).length;
  if (running) return {value:running,kind:'live',label:`${running} report${running===1?'':'s'} in progress`};
  const next = tasks.filter(isDispatchable).length;
  return next ? {value:next,kind:'next',label:`${next} agent job${next===1?'':'s'} up next`} : {value:0,kind:'none',label:'No agent work right now'};
}

/**
 * The planner split by day. `today` holds only tasks dated `day` (open and
 * done); `carried` holds open tasks from earlier days, shown in their own
 * "From earlier" box instead of being merged into today. Callers that want
 * everything due by `day` use [...carried, ...today].
 */
export function taskBuckets(tasks = [], day) {
  const open = task => task.status!=='done';
  return {
    carried:tasks.filter(task=>open(task)&&task.date&&task.date<day),
    today:tasks.filter(task=>task.date===day),
    upcoming:tasks.filter(task=>open(task)&&task.date>day),
    someday:tasks.filter(task=>open(task)&&!task.date),
    done:tasks.filter(task=>!open(task)),
  };
}

/* ---------- Today planner ---------- */
const pad2 = n => String(n).padStart(2,'0');
const localDayOf = value => {const d = new Date(value);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;};
/** Calendar arithmetic on YYYY-MM-DD strings (no time-zone or daylight-saving drift). */
export function shiftDay(day, n) {const d = new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const STATUS_ORDER = {doing:0,todo:1,blocked:2,done:3};
const planOrder = (a,b) => (STATUS_ORDER[a.status]??1)-(STATUS_ORDER[b.status]??1)||String(a.createdAt).localeCompare(String(b.createdAt));
/** Which lane a task sits in: the owner's, Claude and the team's, or together (shared or unset). */
export const laneOf = task => task.assignee==='owner'?'you':task.assignee==='agent'?'team':'together';
/** Who does an agent task: its team agent, or the manager (Claude) when none is named. */
export const doerOf = task => task.assignee==='agent'?(task.agent||'manager'):'';

/**
 * Everything the Today screen shows for one day, from saved tasks and reports.
 * - focus: open flagged tasks on that day (the strip); focusDone: flagged and done.
 * - lanes: the other tasks on that day, each shown once: you (owner), team
 *   (agent, any agent) and together (shared). Counts match the cards shown.
 * - carried: only when `day` is today, open tasks dated earlier ("From earlier").
 * - working: agent ids with a live running report (reportFreshness), so a
 *   stale report never shows as "working now". The manager is "manager".
 * - wrap: only for today; done = finished today (completedAt), open = still
 *   open and due by today (these are what Wrap up moves to tomorrow).
 */
export function todayPlan({tasks = [], day, today = day, activity = [], now = Date.now(), dayOf = localDayOf} = {}) {
  const onDay = tasks.filter(task=>task.date===day);
  const isToday = day===today;
  const carried = isToday?tasks.filter(task=>task.status!=='done'&&task.date&&task.date<day).sort((a,b)=>a.date.localeCompare(b.date)||planOrder(a,b)):[];
  const lanes = {you:[],team:[],together:[]};
  for (const task of onDay.filter(task=>!task.focus).sort(planOrder)) lanes[laneOf(task)].push(task);
  const openOnDay = onDay.filter(task=>task.status!=='done');
  return {
    day, isToday, past:day<today, future:day>today,
    focus:openOnDay.filter(task=>task.focus).sort(planOrder),
    focusDone:onDay.filter(task=>task.focus&&task.status==='done'),
    focusRoom:focusRoom(tasks,day), focusLimit:FOCUS_LIMIT,
    lanes, carried,
    working:[...new Set(liveRunning(activity,now).map(item=>item.agent).filter(Boolean))],
    total:onDay.length+carried.length, done:onDay.length-openOnDay.length,
    wrap:isToday?{done:tasks.filter(task=>task.status==='done'&&task.completedAt&&dayOf(task.completedAt)===today).sort((a,b)=>String(a.completedAt).localeCompare(String(b.completedAt))),open:[...carried,...openOnDay.sort(planOrder)]}:null,
  };
}

/** What happened on one day, from saved records only: tasks finished, tasks still open, agent reports and notes. */
export function dayLog({tasks = [], notes = [], reports = [], day, dayOf = localDayOf} = {}) {
  return {
    done:tasks.filter(task=>task.status==='done'&&(task.date===day||(task.completedAt&&dayOf(task.completedAt)===day))),
    open:tasks.filter(task=>task.status!=='done'&&task.date===day),
    notes:notes.filter(note=>(note.day||(note.date?dayOf(note.date):''))===day),
    jobs:reports.filter(report=>{const stamp = report.updatedAt||report.startedAt||'';return Boolean(stamp)&&dayOf(stamp)===day;}),
  };
}

/** "This week" in the side column: open tasks for the `days` days after `day`, grouped by day. */
export function weekAhead(tasks = [], day, days = 7) {
  const open = tasks.filter(task=>task.status!=='done');
  const end = shiftDay(day,days), groups = [];
  for (let i = 1; i <= days; i++) {
    const date = shiftDay(day,i);
    const items = open.filter(task=>task.date===date).sort((a,b)=>Number(Boolean(b.focus))-Number(Boolean(a.focus))||planOrder(a,b));
    if (items.length) groups.push({date,tasks:items});
  }
  return {groups,later:open.filter(task=>task.date&&task.date>end).length,someday:open.filter(task=>!task.date).length};
}

const WHO_WORDS = {me:'owner',owner:'owner',claude:'claude',manager:'claude',us:'shared',together:'shared'};
const capital = word => word.charAt(0).toUpperCase()+word.slice(1);
/**
 * One-line quick add. Simple words in the text set the details and are taken
 * out of the title:
 *   today, tomorrow, someday or a weekday name (the next one after today) set the date;
 *   ! sets focus; @me = the owner, @claude = Claude (the manager), @us = together,
 *   @<agent id> (e.g. @scout) = that team agent, and several share the task; #product … #learn tag the step (old words like #find, #issue and #source still work).
 * When a kind of word appears twice, the last one counts and earlier ones stay
 * in the title ("Plan Monday call tomorrow" is due tomorrow). `ignore` lists
 * token keys the owner clicked off, which then stay as plain words.
 * Defaults: `day` (the day being viewed; '' for someday) and Together.
 */
export function parseQuickAdd(text = '', {today, day = today, agents = [], ignore = []} = {}) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const skip = new Set(ignore), team = new Map(agents.map(agent=>[String(agent.id).toLowerCase(),agent]));
  const found = {};
  words.forEach((raw,index)=>{
    const key = `${index}:${raw.toLowerCase()}`;
    if (skip.has(key)) return;
    const word = raw.toLowerCase().replace(/[.,;:]+$/,'');
    let token = null;
    if (/^!+$/.test(raw)) token = {kind:'focus',label:'Focus'};
    else if (word==='today') token = {kind:'date',value:today,label:'Today'};
    else if (word==='tomorrow') token = {kind:'date',value:shiftDay(today,1),label:'Tomorrow'};
    else if (word==='someday') token = {kind:'date',value:'',label:'Someday'};
    else if (WEEKDAYS.includes(word)) {
      const ahead = (WEEKDAYS.indexOf(word)-new Date(`${today}T12:00:00Z`).getUTCDay()+7)%7||7;
      token = {kind:'date',value:shiftDay(today,ahead),label:capital(word)};
    } else if (/^@[a-z][a-z0-9-]*$/.test(word)) {
      const name = word.slice(1), who = WHO_WORDS[name];
      if (who==='owner') token = {kind:'who',assignee:'owner',agent:'',label:'You'};
      else if (who==='claude') token = {kind:'who',assignee:'agent',agent:'',label:'Claude'};
      else if (who==='shared') token = {kind:'who',assignee:'shared',agent:'',label:'Together'};
      else if (team.has(name)) token = {kind:`agent:${team.get(name).id}`,agent:team.get(name).id,label:team.get(name).name||name};
    } else if (/^#[a-z]+$/.test(word)) {
      const id = stepId(word.slice(1));
      if (id) token = {kind:'step',value:id,label:stepName(id)};
    }
    if (token) found[token.kind] = {...token,key,raw,index};
  });
  const tokens = Object.values(found).sort((a,b)=>a.index-b.index);
  const used = new Set(tokens.map(token=>token.index));
  // Name several agents and they share the task; with @me or @us it is between you and them.
  const named = tokens.filter(token=>token.agent).map(token=>token.agent);
  const said = found.who?.assignee;
  return {
    title:words.filter((_,index)=>!used.has(index)).join(' ').trim(),
    date:found.date?found.date.value:day,
    focus:Boolean(found.focus),
    assignee:named.length?(said==='owner'||said==='shared'?'shared':'agent'):said||'shared',
    agent:named[0]||'',
    agents:named,
    step:found.step?.value||'',
    tokens,
  };
}

// Unit economics for one order. Pure arithmetic on the numbers entered; it
// is a thinking tool, not a supported contribution preflight.
export function unitEconomics({price=0,itemCost=0,shipping=0,feePercent=0,feeFixed=0,returnPercent=0,adCost=0}) {
  const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const sale = n(price);
  const fees = sale*n(feePercent)/100+n(feeFixed);
  const returns = sale*n(returnPercent)/100;
  const beforeAds = sale-n(itemCost)-n(shipping)-fees-returns;
  const profit = beforeAds-n(adCost);
  return {
    price:sale,itemCost:n(itemCost),shipping:n(shipping),fees,returns,adCost:n(adCost),beforeAds,profit,
    margin:sale>0?profit/sale:0,
    breakEvenAdCost:Math.max(0,beforeAds),
    breakEvenRoas:beforeAds>0?sale/beforeAds:null,
  };
}
