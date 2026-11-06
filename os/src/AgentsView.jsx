import React,{useMemo,useState,useEffect} from 'react';
import {MessageSquareText,ChevronDown,ChevronUp,FileText,ImageIcon,Activity,Users,CheckCircle2,XCircle,BookOpen,Sparkles,ArrowRight,Hourglass,Inbox,Loader,ScrollText,Wand2,ListTodo,CircleAlert,History,Gauge,Clock,Hammer,Rocket,FileClock,Plus,Pencil,Save,Search,Workflow} from 'lucide-react';
import Markdown from 'react-markdown';
import {Modal,api} from './ui.jsx';
import {jobProgress} from './jobProgress.mjs';
import {activityByDay,agentSummary,teamBoard,missionControl,reportFreshness} from './workflowView.mjs';
import {leadStatus} from './theLine.mjs';
import {Avatar,AgentAvatar,Chip,Sheet,LeadImage,roleOf,agentOf,timeAgo,isImagePath,fileName,assetUrl,localDay} from './kit.jsx';
import {ProductTag,RoundChip} from './Pipeline.jsx';
import {PIPELINE_STEP_SKILLS} from './displayLine.mjs';
import {PanelTiles,SectionHead,Stat} from './cards.jsx';
import {agentSteps,shelfCounts,shelfGroups,skillLine,skillTitle} from './skillShelf.mjs';
import {useConnectors} from './ConnectorsPage.jsx';
import {Plug,TrendingUp} from 'lucide-react';
import './agents.css';

// The Agents tab is mission control: the owner watches, Claude (the manager)
// queues work from chat with the os.mjs helper. Nothing here creates, assigns
// or runs work. Status comes only from saved planner tasks and activity reports.

const STATUS = {running:['In progress','active'],completed:['Completed','done'],blocked:['Needs input','owner'],failed:['Failed','bad']};
const AGENT_STATUS = {working:['Working','active',Loader],blocked:['Needs input','owner',Hourglass],queued:['Up next','warn',Inbox],idle:['Ready','muted',null]};
const DEPARTMENTS = [['validation','Research'],['image-generator','Creative studio'],['shopify-builder','Store'],['manager','Operations']];
const deptName = role => DEPARTMENTS.find(([id])=>id===role)?.[1]||roleOf(role).name;
const ROLE_TILE = {validation:1,'image-generator':5,'shopify-builder':4,manager:2};
const shortDate = value => new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
const dueLabel = task => task.date?shortDate(task.date+'T12:00:00'):'someday';

export function StatusChip({status}) {
  const [label,tone] = STATUS[status]||[status,'muted'];
  return <Chip tone={tone}>{label}</Chip>;
}
function AgentStatus({status}) {
  const [label,tone,Icon] = AGENT_STATUS[status]||AGENT_STATUS.idle;
  return <Chip tone={tone} icon={Icon}>{label}</Chip>;
}
function ReportAvatar({item,team,size=30}) {
  const agent = agentOf(team,item.agent);
  return agent?<AgentAvatar agent={agent} size={size}/>:<Avatar role={item.agent==='manager'?'manager':item.role} size={size}/>;
}
const reporterName = (item,team) => item.agent==='manager'?'Manager':agentOf(team,item.agent)?.name||roleOf(item.role).name;

/** One number tile per role; tapping one filters the reports to it. */
function RoleTiles({agents,activity,selected,onSelect}) {
  const roles = agentSummary(agents,activity);
  return <div className="mv-ag-stats" role="group" aria-label="Reports by role">{roles.map(agent=>{
    const role = roleOf(agent.id);
    return <Stat key={agent.id} icon={role.icon} tile={ROLE_TILE[agent.id]||6} label={role.name} value={agent.total} sub={agent.blocked?`${agent.blocked} need input`:agent.latest?`Last ${timeAgo(agent.latest.updatedAt)}`:'No reports yet'} pressed={selected===agent.id} onClick={()=>onSelect(selected===agent.id?null:agent.id)}/>;
  })}</div>;
}

export function Rhythm({activity,days=14}) {
  const series = useMemo(()=>activityByDay(activity,days),[activity,days]);
  const max = Math.max(1,...series.map(day=>day.total));
  const roles = ['manager','validation','image-generator','shopify-builder'];
  const today = series[series.length-1]?.day;
  return <div>
    <div className="mv-rhythm" role="img" aria-label={`Reported agent milestones over the last ${days} days`}>
      {series.map(day=>{
        const label = new Date(day.day+'T12:00:00');
        return <div key={day.day} className={`mv-rhythm-col ${day.day===today?'is-today':''}`}>
          <span className="mv-rhythm-tip">{label.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}: {day.total} update{day.total===1?'':'s'}</span>
          <div className="mv-rhythm-plot">{day.total>0&&<em>{day.total}</em>}<div className="mv-rhythm-bar" style={{height:`${day.total?Math.max(4,Math.sqrt(day.total/max)*82):3}%`}}>
            {roles.map(role=>day.byRole[role]?<span key={role} style={{height:`${day.byRole[role]/day.total*100}%`,background:roleOf(role).color}}/>:null)}
          </div></div>
          <small>{day.day===today?'Today':label.toLocaleDateString(undefined,{day:'numeric'})}</small>
        </div>;
      })}
    </div>
    <div className="mv-legend" style={{marginTop:12}}>{roles.map(role=><span key={role}><i className="mv-dot" style={{background:roleOf(role).color}}/>{roleOf(role).name}</span>)}</div>
  </div>;
}

/* ---------- Mission control ---------- */

function ReportRow({item,team,onOpen,meta,chip}) {
  const last = item.events?.at(-1)?.text;
  return <button className="mv-mc-row" onClick={()=>onOpen(item)}>
    <ReportAvatar item={item} team={team} size={30}/>
    <span className="mv-mc-row-main"><strong>{item.title}</strong>{item.product&&<ProductTag value={item.product}/>}<small>{meta||last||item.summary}</small></span>
    <span className="mv-ag-row-side">{chip}<time>{timeAgo(item.updatedAt)}</time></span>
  </button>;
}

function TaskRow({task,team,go,index}) {
  const agent = agentOf(team,task.agent);
  return <button className={`mv-mc-row ${index!==undefined&&task.agent?'has-agent':''}`} onClick={()=>go(`today?task=${task.id}`)}>
    {index!==undefined?<span className="mv-mc-num">{index+1}</span>:task.agent?<AgentAvatar agent={agent} size={30}/>:<Avatar role={task.assignee==='owner'?'owner':'manager'} size={30}/>}
    <span className="mv-mc-row-main"><strong>{task.title}</strong>{task.product&&<ProductTag value={task.product}/>}<small>{task.agent?`${agent?.name||task.agent} · `:''}{task.nextAction||task.status}</small></span>
    {index!==undefined&&task.agent&&<AgentAvatar agent={agent} size={22}/>}
    <time className={task.date&&task.date<localDay()?'is-late':''}>{dueLabel(task)}</time>
  </button>;
}

/** A running job's pulse, from its saved report: how long it has run, when it last
 * reported (amber after 10 quiet minutes) and its plan as step pills with a bar. */
function JobPulse({item,latest=false}) {
  const p = jobProgress(item);
  return <span className="mv-jp">
    <span className="mv-jp-times">
      <span className="mv-jp-elapsed" title={item.startedAt?`Started ${new Date(item.startedAt).toLocaleString()}`:undefined}><Clock size={12}/>Running {p.elapsed}</span>
      <span className={`mv-jp-last ${p.quiet?'is-quiet':''}`} title={p.quiet?'No update for over 10 minutes':undefined}>{p.quiet&&<Hourglass size={12}/>}last update {p.lastUpdate}</span>
    </span>
    {latest&&p.latest&&<span className="mv-jp-latest">{p.latest}</span>}
    {p.plan&&<JobPlan plan={p.plan}/>}
  </span>;
}
function JobPlan({plan}) {
  const now = plan.steps.find(step=>step.state==='current');
  return <span className="mv-jp-plan">
    <span className="mv-jp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={plan.total} aria-valuenow={plan.done} aria-label={`${plan.done} of ${plan.total} steps done`}><i style={{width:`${plan.percent}%`}}/></span>
    <span className="mv-jp-count">{now?`Step ${now.n} of ${plan.total}`:`${plan.done} of ${plan.total} done`}</span>
    <span className="mv-jp-steps">{plan.steps.map(step=><span key={step.n} className={`mv-jp-step is-${step.state}`} title={`${step.n}. ${step.label}${step.state==='done'?' · done':step.state==='current'?' · now':''}`}><b>{step.state==='done'?<CheckCircle2 size={11}/>:step.n}</b>{plan.named&&<span>{step.label}</span>}</span>)}</span>
  </span>;
}
function LiveJobRow({item,team,onOpen}) {
  return <button className="mv-jp-row" onClick={()=>onOpen(item)}>
    <ReportAvatar item={item} team={team} size={30}/>
    <span className="mv-mc-row-main"><strong>{item.title}</strong>{item.product&&<ProductTag value={item.product}/>}<small>{reporterName(item,team)}</small><JobPulse item={item} latest/></span>
  </button>;
}

/** Files saved in the work folders in the last 30 minutes (GET /api/changes), so
 * movement shows between reports. Paths and times only; nothing opens or runs. */
function LiveChanges() {
  const [state,setState] = useState({data:null,error:''});
  React.useEffect(()=>{
    let alive = true;
    const load = async()=>{try{const data=await api('/api/changes?minutes=30&limit=12');if(alive)setState({data,error:''});}catch(e){if(alive)setState(prev=>({...prev,error:e.status===404||!e.status?'restart':'failed'}));}};
    load();const timer = setInterval(load,15000);
    return()=>{alive=false;clearInterval(timer);};
  },[]);
  const {data,error} = state, changes = data?.changes||[];
  const folder = path => path.split('/').slice(0,-1).join('/');
  if (!changes.length) return <p className="mv-small mv-mc-empty">{!data&&error==='restart'?'Live changes show after the OS server restarts.':!data&&error?'Live changes could not load.':data?'No files changed in the last 30 minutes.':'Looking for changes…'}</p>;
  return <>
    <p className="mv-small mv-lc-note">{data.total} file{data.total===1?'':'s'} saved in the work folders in the last 30 minutes{data.more?' (newest shown)':''}.{error?' Not refreshing right now.':''}</p>
    <div className="mv-lc-list"><Capped limit={6} rows={changes.map(change=><div key={change.path} className="mv-lc-row" title={change.count>1?`${change.count} files in ${folder(change.path)}, newest ${change.path}`:change.path}><FileText size={13}/><span className="mv-lc-name"><strong>{change.count>1?`${fileName(change.path)} and ${change.count-1} more`:fileName(change.path)}</strong><small>{folder(change.path)}</small></span><time title={new Date(change.at).toLocaleString()}>{timeAgo(change.at)}</time></div>)}/></div>
  </>;
}

const DECISION_TEXT = {
  'eye-test':item=>[leadStatus({waiting:item.count,saved:0,reviewed:0}),'Save, pass or reject each card on the Find page.',Sparkles],
  'build-pick':item=>[`${item.count} product${item.count===1?' is':'s are'} ready to build: pick which one builds next`,'"Build this one" on its page, with your reason. One product builds at a time.',Hammer],
  launch:item=>[`Approve the test for ${item.ids?.[0]||'the building product'}`,'Going public, the budget and the max loss. Tell your agent in chat; nothing runs from here.',Rocket],
};
function DecisionItem({item,pipeline,go}) {
  const rows = (item.ids||[]).map(id=>pipeline?.items?.find(row=>row.id===id)).filter(Boolean).slice(0,4);
  const [title,hint,Icon] = (DECISION_TEXT[item.kind]||(()=>[item.text||item.kind,'',Sparkles]))(item);
  return <button className="mv-mc-decision" onClick={()=>go(item.go)}>
    {rows.some(row=>row.image)?<span className="mv-mc-thumbs">{rows.map(row=><LeadImage key={row.id} lead={row} size={40}/>)}</span>:<span className="mv-mc-icon is-owner"><Icon size={15}/></span>}
    <span className="mv-mc-row-main"><strong>{title}</strong><small>{hint}{rows.length?` ${rows.map(row=>row.id).join(', ')}`:''}</small></span>
    <ArrowRight size={15}/>
  </button>;
}
/* ---------- The team: who's on what ---------- */
function TeamCard({face,name,dept,tile,status,word,text,summary,foot,onOpen,label}) {
  return <button type="button" className={`mv-ag-card is-tile-${tile} is-${status}`} disabled={!onOpen} onClick={onOpen} aria-label={label} title={summary}>
    <span className="mv-ag-band">{face}<span className="mv-ag-name"><strong>{name}</strong><small>{dept}</small></span></span>
    <span className="mv-ag-body">
      <AgentStatus status={status}/>
      {summary&&foot!==undefined&&<span className="mv-ag-summary">{summary}</span>}
      {(foot===undefined||word!=='Last')&&<span className="mv-ag-now"><b>{word}</b>{text}</span>}
      {foot&&<span className="mv-ag-foot">{foot}</span>}
    </span>
  </button>;
}
function MemberCard({agent,detail=false,onOpen}) {
  const now = agent.current;
  const [word,text] = now?[agent.status==='working'?'Now':agent.status==='blocked'?'Waiting':'Next',now.title]:agent.latest?['Last',`${agent.latest.title} · ${timeAgo(agent.latest.updatedAt)}`]:['Ready','No work assigned yet'];
  const foot = detail?<>{agent.skills.length?`${agent.skills.length} skill${agent.skills.length===1?'':'s'}`:`${agent.guides.length} guides`}{!agent.installed&&<Chip tone="bad">Not installed</Chip>}</>:undefined;
  return <TeamCard face={<AgentAvatar agent={agent} size={32}/>} name={agent.name} dept={deptName(agent.role)} tile={ROLE_TILE[agent.role]||6} status={agent.status} word={word} text={text} summary={agent.summary} foot={foot} onOpen={onOpen} label={`Open ${agent.name}`}/>;
}
/** Manager is the chat itself: it has no subagent sheet, so its card opens its newest report. */
function ManagerCard({manager,reports,live,detail=false,onOpen}) {
  const latest = live||reports[0]||null;
  return <TeamCard face={<Avatar role="manager" size={32}/>} name="Manager" dept="Manager · your chat" tile={ROLE_TILE.manager} status={live?'working':'idle'} word={live?'Now':latest?'Last':'Ready'} text={latest?(live?latest.title:`${latest.title} · ${timeAgo(latest.updatedAt)}`):'Nothing reported yet'} summary={manager?.summary} foot={detail?'The chat you talk to':undefined} onOpen={latest?()=>onOpen(latest):undefined} label="Open Manager's newest report"/>;
}

/** Long lists stay short: the first few rows, then "Show N more". */
function Capped({rows,limit=5}) {
  const [all,setAll] = useState(false);
  return <>{(all?rows:rows.slice(0,limit))}{rows.length>limit&&<button className="mv-link mv-mc-more" onClick={()=>setAll(!all)}>{all?<><ChevronUp size={13}/>Show less</>:<><ChevronDown size={13}/>Show {rows.length-limit} more</>}</button>}</>;
}

function MissionControl({team,board,mc,activity,pipeline,go,openReport,openAgent}) {
  const [showStale,setShowStale] = useState(false);
  const [showParked,setShowParked] = useState(false);
  const decisions = mc.needsDecision.items.length+mc.needsDecision.tasks.length+mc.needsDecision.reports.length;
  const ready = mc.readyForYou.tasks.length+mc.readyForYou.results.length;
  const live = [...mc.claude,...mc.working];
  const mine = useMemo(()=>activity.filter(item=>item.agent==='manager').sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))),[activity]);
  const tiles = [
    {id:'decide',icon:CircleAlert,tile:5,title:'Needs you',sub:decisions?`${decisions} waiting`:'Nothing waiting',node:<div className="mv-ag-panel">
      {decisions>0?<div className="mv-mc-list"><Capped rows={[
        ...mc.needsDecision.items.map(item=><DecisionItem key={item.id} item={item} pipeline={pipeline} go={go}/>),
        ...mc.needsDecision.tasks.map(task=><TaskRow key={task.id} task={task} team={team} go={go}/>),
        ...mc.needsDecision.reports.map(item=><ReportRow key={item.id} item={item} team={team} onOpen={openReport} meta={`Needs input · ${reporterName(item,team)}`}/>),
      ]}/></div>:<p className="mv-small mv-mc-empty">Nothing needs your decision.</p>}
    </div>},
    {id:'ready',icon:Inbox,tile:1,title:'Ready for you',sub:ready?`${ready} to look at`:'Nothing new',node:<div className="mv-ag-panel">
      {ready>0?<div className="mv-mc-list"><Capped rows={[
        ...mc.readyForYou.tasks.map(task=><TaskRow key={task.id} task={task} team={team} go={go}/>),
        ...mc.readyForYou.results.map(item=><ReportRow key={item.id} item={item} team={team} onOpen={openReport} meta={`Finished · ${reporterName(item,team)}`}/>),
      ]}/></div>:<p className="mv-small mv-mc-empty">Nothing new for you today.</p>}
    </div>},
    {id:'next',icon:ListTodo,tile:3,title:'Up next',sub:mc.upNext.length?`${mc.upNext.length} queued`:'Nothing queued',node:<div className="mv-ag-panel">
      {mc.upNext.length>0?<div className="mv-mc-list"><Capped limit={6} rows={mc.upNext.map((task,i)=><TaskRow key={task.id} task={task} team={team} go={go} index={i}/>)}/></div>
        :<p className="mv-small mv-mc-empty">Nothing queued. Your agent adds jobs here when you ask for something in chat.</p>}
      {mc.parked.length>0&&<div className="mv-mc-parked">
        <button className="mv-link" aria-expanded={showParked} onClick={()=>setShowParked(!showParked)}>{showParked?<ChevronUp size={13}/>:<ChevronDown size={13}/>}Parked ({mc.parked.length}): someday jobs, not started</button>
        {showParked&&<div className="mv-mc-list">{mc.parked.map(task=><TaskRow key={task.id} task={task} team={team} go={go}/>)}</div>}
      </div>}
    </div>},
    {id:'done',icon:CheckCircle2,tile:6,title:'Done recently',sub:mc.doneRecently.length?`${mc.doneRecently.length} jobs`:'Nothing yet',node:<div className="mv-ag-panel">
      {mc.doneRecently.length>0?<div className="mv-mc-list">{mc.doneRecently.map(item=><ReportRow key={item.id} item={item} team={team} onOpen={openReport} meta={reporterName(item,team)}/>)}</div>:<p className="mv-small mv-mc-empty">Finished work lands here.</p>}
    </div>},
    {id:'changes',icon:FileClock,tile:4,title:'Live changes',sub:'Recent files',node:<div className="mv-ag-panel"><LiveChanges/></div>},
  ];
  return <div className="mv-ag">
    <section className="mv-ag-section">
      <SectionHead icon={Users} title="The team" count={board.agents.length+1}/>
      <div className="mv-ag-team">
        <ManagerCard manager={team.manager} reports={mine} live={mc.claude[0]} onOpen={openReport}/>
        {board.agents.map(agent=><MemberCard key={agent.id} agent={agent} onOpen={()=>openAgent(agent.id)}/>)}
      </div>
    </section>
    <section className="mv-ag-section">
      <SectionHead icon={Loader} tone="live" title="Working now" count={live.length}/>
      {live.length?<div className="mv-ag-live">{live.map(item=><LiveJobRow key={item.id} item={item} team={team} onOpen={openReport}/>)}</div>
      :<p className="mv-ag-quiet">Nobody is reporting work right now. Tell your agent what you need in chat, and it shows up here.</p>}
    </section>
    <section className="mv-ag-section"><PanelTiles start={decisions?'decide':ready?'ready':'next'} tiles={tiles}/></section>
    {mc.stale.length>0&&<section className="mv-mc-stale">
      <button className="mv-link" aria-expanded={showStale} onClick={()=>setShowStale(!showStale)}>{showStale?<ChevronUp size={13}/>:<ChevronDown size={13}/>}Stale ({mc.stale.length}): reports that stopped updating</button>
      {showStale&&<div className="mv-mc-list">{mc.stale.map(item=><ReportRow key={item.id} item={item} team={team} onOpen={openReport} meta={`No update since ${shortDate(item.updatedAt)} · ${reporterName(item,team)}`}/>)}</div>}
    </section>}
  </div>;
}

/** Reports as short rows by day; one tap opens what happened and the files. */
function ReportList({items,team,onOpen}) {
  const days = [];
  for (const item of [...items].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt))) {
    const label = new Date(item.updatedAt).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
    if (days.at(-1)?.label===label) days.at(-1).rows.push(item); else days.push({label,rows:[item]});
  }
  return <>{days.map(day=><section key={day.label}>
    <div className="mv-day-label">{day.label}</div>
    <div className="mv-mc-list">{day.rows.map(item=>{
      const stale = reportFreshness(item)==='stale';
      return <ReportRow key={item.id} item={item} team={team} onOpen={onOpen} meta={reporterName(item,team)} chip={stale?<Chip tone="muted">Stale</Chip>:item.status==='completed'?null:<StatusChip status={item.status}/>}/>;
    })}</div>
  </section>)}</>;
}

function ReportSheet({item,team,openDoc,onClose}) {
  const [preview,setPreview] = useState(null);
  const stale = reportFreshness(item)==='stale', refs = item.references||[], events = item.events||[];
  return <Sheet title={item.title} subtitle={`${reporterName(item,team)} · started ${new Date(item.startedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`} onClose={onClose} actions={stale?<Chip tone="muted">Stale</Chip>:<StatusChip status={item.status}/>}>
    <div className="mv-report-sheet">
      {stale&&<p className="mv-lock-note"><Clock size={15}/><span>No update since {new Date(item.updatedAt).toLocaleString()}. It is not counted as work in progress.</span></p>}
      {item.summary&&<p className="mv-report-summary">{item.summary}</p>}
      {events.length>0&&<section><h3 className="mv-h3 mv-sheet-h"><History size={15}/>What happened</h3><ol className="mv-events">{events.slice().reverse().map((event,i)=><li key={i}><time>{new Date(event.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time>{event.text}</li>)}</ol></section>}
      {refs.length>0&&<section><h3 className="mv-h3 mv-sheet-h"><FileText size={15}/>Files</h3><div className="mv-refs">{refs.map(path=><button key={path} className="mv-ref" title={path} onClick={()=>isImagePath(path)?setPreview(path):openDoc(path)}>{isImagePath(path)?<ImageIcon size={12}/>:<FileText size={12}/>}<span>{fileName(path)}</span></button>)}</div></section>}
      <p className="mv-small">A report records work. It never passes a product check or approves anything.</p>
    </div>
    {preview&&<Modal wide title={fileName(preview)} onClose={()=>setPreview(null)}><img style={{width:'100%',height:'auto'}} src={assetUrl(preview)} alt={fileName(preview)}/></Modal>}
  </Sheet>;
}

function AgentSheet({agent,team,skills,lessons=[],openDoc,go,activity,onClose,onEdit,onReport,onSkill}) {
  const mySkills = agent.skills.map(name=>skills.find(skill=>skill.name===name)||{name,missing:true});
  const steps = agentSteps(agent);
  const learned = lessons.filter(lesson=>lesson.scope===agent.id&&['proven','trying'].includes(lesson.status)).sort((a,b)=>Number(b.status==='proven')-Number(a.status==='proven'));
  const open = [...agent.doing,...agent.blocked,...agent.queued];
  const mine = activity.filter(item=>item.agent===agent.id).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0,5);
  return <Sheet wide title={agent.name} subtitle={`${deptName(agent.role)} · ${agent.summary}`} onClose={onClose} actions={<div style={{display:'flex',gap:8,alignItems:'center'}}>{onEdit&&<button className="mv-btn sm primary" onClick={()=>onEdit(agent)}><Pencil size={13}/>Edit Subagent &amp; Prompt</button>}<AgentStatus status={agent.status}/></div>}>
    <div className="mv-agent-sheet">
      <div className="mv-agent-links">
        <button className="mv-btn sm" onClick={()=>{onClose();go(`memory?tab=brief&agent=${agent.id}`);}}><BookOpen size={13}/>What it reads before a job</button>
        <button className="mv-btn sm" disabled={!agent.installed} onClick={()=>openDoc(agent.definition)}><ScrollText size={13}/>{agent.installed?'Read full instructions (.md)':'Instructions file not found'}</button>
      </div>
      <section>
        <h3 className="mv-h3 mv-sheet-h"><Sparkles size={16}/>Skills it carries</h3>
        <div className="mv-skill-list">
          {mySkills.map(skill=><button key={skill.name} className="mv-skill-row" disabled={skill.missing} onClick={()=>onSkill(skill)}><span className="mv-skill-mark"><Sparkles size={14}/></span><span><strong>{skillTitle(skill.name)}</strong><small>{skill.missing?'Skill file not found':skillLine(skill.description)}</small></span></button>)}
          {!mySkills.length&&<p className="mv-small">No skills yet.</p>}
        </div>
      </section>
      <section>
        <h3 className="mv-h3 mv-sheet-h"><Workflow size={16}/>The workflow it knows</h3>
        {steps.length?<div className="mv-sa-steps">{steps.map(step=><button key={step.id} type="button" onClick={()=>{onClose();go(step.slug);}}><strong>{step.name}<ArrowRight size={13}/></strong>{step.purpose&&<small>{step.purpose}</small>}{step.doneWhen&&<small><b>Done when:</b> {step.doneWhen}</small>}</button>)}</div>:<p className="mv-small">It works on Launchroom itself, not on a pipeline step.</p>}
        <div className="mv-skill-list" style={{marginTop:8}}>
          {agent.guides.map(guide=><button key={guide.path} className="mv-skill-row is-guide" disabled={!guide.exists} onClick={()=>openDoc(guide.path)}><span className="mv-skill-mark"><FileText size={14}/></span><span><strong>{fileName(guide.path)}</strong><small>{guide.exists?guide.path:`Missing: ${guide.path}`}</small></span></button>)}
        </div>
      </section>
      {learned.length>0&&<section>
        <h3 className="mv-h3 mv-sheet-h"><BookOpen size={16}/>What it has learned<small className="mv-sa-count">{learned.length}</small></h3>
        <ul className="mv-sa-lessons">{learned.slice(0,6).map(lesson=><li key={lesson.id}><strong>{lesson.rule}</strong>{lesson.status==='proven'&&<em>Proven</em>}</li>)}</ul>
      </section>}
      <section>
        <h3 className="mv-h3 mv-sheet-h"><Wand2 size={16}/>Good for</h3>
        <div className="mv-goodfor">{agent.goodFor.map(item=><div key={item} className="mv-goodfor-item"><span>{item}</span></div>)}</div>
      </section>
      <div className="mv-grid-2 mv-yesno">
        <section className="mv-yes"><h4><CheckCircle2 size={15}/>Brings back</h4><p>{agent.delivers||'A saved result and a short report.'}</p></section>
        <section className="mv-no"><h4><XCircle size={15}/>Never does</h4><ul>{agent.never.map(item=><li key={item}>{item}</li>)}</ul></section>
      </div>
      <p className="mv-small mv-all-agents">No agent can spend money, publish, deploy or message anyone. Those always come back to you through the manager.</p>
      <section>
        <h3 className="mv-h3 mv-sheet-h"><Inbox size={16}/>Its work</h3>
        {open.length?<div className="mv-mini-list">{open.map(task=><button key={task.id} onClick={()=>go(`today?task=${task.id}`)}><AgentStatus status={task.status==='doing'?'working':task.status==='blocked'?'blocked':'queued'}/><span>{task.title}</span></button>)}</div>:<p className="mv-small">No open work.</p>}
        {mine.length>0&&<div style={{marginTop:6}}><ReportList items={mine} team={team} onOpen={onReport}/></div>}
      </section>
    </div>
  </Sheet>;
}

export function SubagentBuilderSheet({initialAgent,skills=[],onClose,onSaved}) {
  const isEdit = Boolean(initialAgent?.id);
  const [id,setId] = useState(initialAgent?.id||'');
  const [name,setName] = useState(initialAgent?.name||'');
  const [role,setRole] = useState(initialAgent?.role||'validation');
  const [summary,setSummary] = useState(initialAgent?.summary||'');
  const [goodFor,setGoodFor] = useState((initialAgent?.goodFor||[]).join('\n'));
  const [delivers,setDelivers] = useState(initialAgent?.delivers||'');
  const [never,setNever] = useState((initialAgent?.never||['Never invent evidence or publish without owner approval']).join('\n'));
  const [selectedSkills,setSelectedSkills] = useState(()=>new Set(initialAgent?.skills||[]));
  const [guides,setGuides] = useState((initialAgent?.guides||[]).map(g=>typeof g==='string'?g:g.path).join('\n')||'AGENTS.md\nworkflow/CHECKS.md');
  const [prompt,setPrompt] = useState('');
  const [loadingPrompt,setLoadingPrompt] = useState(false);
  const [saving,setSaving] = useState(false);
  const [err,setErr] = useState('');

  useEffect(()=>{
    if (!initialAgent?.id) return;
    let alive = true;
    setLoadingPrompt(true);
    api(`/api/team/agent-prompt?id=${encodeURIComponent(initialAgent.id)}`)
      .then(res=>{if(alive)setPrompt(res.content||'');})
      .catch(()=>{})
      .finally(()=>{if(alive)setLoadingPrompt(false);});
    return ()=>{alive=false;};
  },[initialAgent?.id]);

  const toggleSkill = sName => {
    setSelectedSkills(prev=>{
      const next = new Set(prev);
      if (next.has(sName)) next.delete(sName); else next.add(sName);
      return next;
    });
  };

  async function handleSave(e) {
    e.preventDefault();
    setErr('');
    const cleanId = (id||name).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
    if (!cleanId) { setErr('Give the subagent an ID or name.'); return; }
    setSaving(true);
    try {
      const res = await api('/api/team/agent',{
        id: cleanId,
        name: name.trim()||cleanId,
        role,
        summary: summary.trim()||'Specialist subagent on the Launchroom team.',
        goodFor: goodFor.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        delivers: delivers.trim()||'Saved workspace records and verified outputs.',
        never: never.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        skills: [...selectedSkills],
        guides: guides.split(/\r?\n/).map(s=>s.trim()).filter(Boolean),
        prompt,
      });
      onSaved?.(res);
      onClose();
    } catch (error) {
      setErr(error.message||'Could not save subagent.');
    } finally {
      setSaving(false);
    }
  }

  return <Sheet wide title={isEdit?`Edit Subagent · ${initialAgent.name}`:'Build New Subagent'} subtitle={isEdit?`.claude/agents/${initialAgent.id}.md & agents/team.json`:'Creates the subagent in agents/team.json and writes its executable .claude/agents/<id>.md instructions'} onClose={onClose}>
    <form className="mv-stack" onSubmit={handleSave} style={{gap:14}}>
      {err&&<div className="mv-error" role="alert">{err}</div>}
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>Subagent Name</span>
          <input className="mv-input" value={name} onChange={e=>{setName(e.target.value);if(!isEdit&&!id)setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,''));}} placeholder="e.g. Hook Harvester" required/>
        </label>
        <label className="mv-field">
          <span>Subagent ID (`.claude/agents/&lt;id&gt;.md`)</span>
          <input className="mv-input" value={id} disabled={isEdit} onChange={e=>setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-'))} placeholder="e.g. hook-harvester" required/>
        </label>
      </div>
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>Department / Role</span>
          <select className="mv-input" value={role} onChange={e=>setRole(e.target.value)}>
            <option value="validation">Research (validation)</option>
            <option value="image-generator">Creative Studio (image-generator)</option>
            <option value="shopify-builder">Store &amp; Theme (shopify-builder)</option>
            <option value="os-builder">Launchroom OS (os-builder)</option>
          </select>
        </label>
        <label className="mv-field">
          <span>One-Line Summary</span>
          <input className="mv-input" value={summary} onChange={e=>setSummary(e.target.value)} placeholder="What this subagent specializes in..."/>
        </label>
      </div>
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>What it is good for (one per line)</span>
          <textarea className="mv-input" rows={3} value={goodFor} onChange={e=>setGoodFor(e.target.value)} placeholder="Mine viral TikTok hooks&#10;Write 3 reveal ad headlines"/>
        </label>
        <label className="mv-field">
          <span>What it delivers &amp; Never rules (one per line)</span>
          <input className="mv-input" style={{marginBottom:6}} value={delivers} onChange={e=>setDelivers(e.target.value)} placeholder="Delivers: Saved copy brief and verified headlines"/>
          <textarea className="mv-input" rows={2} value={never} onChange={e=>setNever(e.target.value)} placeholder="Never invent reviews or publish without approval"/>
        </label>
      </div>
      <div>
        <span className="mv-small" style={{display:'block',fontWeight:600,marginBottom:6}}>Assigned Skills ({selectedSkills.size} selected)</span>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {skills.map(s=>{
            const on = selectedSkills.has(s.name);
            return <button type="button" key={s.name} className={`mv-btn sm ${on?'primary':'ghost'}`} onClick={()=>toggleSkill(s.name)}><Sparkles size={12}/>{s.name}</button>;
          })}
        </div>
      </div>
      <label className="mv-field">
        <span>Guides it reads (one relative path per line)</span>
        <textarea className="mv-input" rows={2} value={guides} onChange={e=>setGuides(e.target.value)}/>
      </label>
      <label className="mv-field">
        <span>Executable System Prompt (`.claude/agents/{id||'subagent'}.md`) {loadingPrompt&&'(Loading...)'}</span>
        <textarea className="mv-input" style={{fontFamily:'var(--font-mono, monospace)',fontSize:12,lineHeight:1.5}} rows={14} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Leave blank to auto-generate from the fields above, or write custom Markdown instructions with YAML frontmatter..."/>
      </label>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
        <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="mv-btn primary" disabled={saving}><Save size={14}/>{saving?'Saving...':isEdit?'Save Subagent':'Create Subagent'}</button>
      </div>
    </form>
  </Sheet>;
}

export function SkillBuilderSheet({initialSkill,team,onClose,onSaved}) {
  const isEdit = Boolean(initialSkill?.name);
  const [name,setName] = useState(initialSkill?.name||'');
  const [description,setDescription] = useState(initialSkill?.description||'');
  const [content,setContent] = useState('');
  const [assigned,setAssigned] = useState(()=>new Set(initialSkill?.usedBy||[]));
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [err,setErr] = useState('');

  useEffect(()=>{
    if (!initialSkill?.name) return;
    let alive = true;
    setLoading(true);
    api(`/api/team/skill?name=${encodeURIComponent(initialSkill.name)}`)
      .then(res=>{if(alive){setContent(res.content||'');if(res.description)setDescription(res.description);}})
      .catch(()=>{})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[initialSkill?.name]);

  const toggleAgent = agentId => {
    setAssigned(prev=>{
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId); else next.add(agentId);
      return next;
    });
  };

  async function handleSave(e) {
    e.preventDefault();
    setErr('');
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
    if (!cleanName) { setErr('Provide a skill name.'); return; }
    setSaving(true);
    try {
      const res = await api('/api/team/skill',{
        name: cleanName,
        description: description.trim()||'Reusable Launchroom method.',
        content,
        assignedAgents: [...assigned],
      });
      onSaved?.(res);
      onClose();
    } catch (error) {
      setErr(error.message||'Could not save skill.');
    } finally {
      setSaving(false);
    }
  }

  return <Sheet wide title={isEdit?`Edit Skill · ${initialSkill.name}`:'Build New Skill'} subtitle={isEdit?initialSkill.path:'.claude/skills/<name>/SKILL.md'} onClose={onClose}>
    <form className="mv-stack" onSubmit={handleSave} style={{gap:14}}>
      {err&&<div className="mv-error" role="alert">{err}</div>}
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>Skill Name (lowercase-hyphenated)</span>
          <input className="mv-input" value={name} disabled={isEdit} onChange={e=>setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-'))} placeholder="e.g. viral-hook-harvesting" required/>
        </label>
        <label className="mv-field">
          <span>Description (when agents should load it)</span>
          <input className="mv-input" value={description} onChange={e=>setDescription(e.target.value)} placeholder="Harvest top TikTok creator hooks and combine with our offer..." required/>
        </label>
      </div>
      <div>
        <span className="mv-small" style={{display:'block',fontWeight:600,marginBottom:6}}>Assign to Subagents ({assigned.size} selected)</span>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          <button type="button" className={`mv-btn sm ${assigned.has('manager')?'primary':'ghost'}`} onClick={()=>toggleAgent('manager')}>Manager</button>
          {(team?.agents||[]).map(a=><button type="button" key={a.id} className={`mv-btn sm ${assigned.has(a.id)?'primary':'ghost'}`} onClick={()=>toggleAgent(a.id)}>{a.name}</button>)}
        </div>
      </div>
      <label className="mv-field">
        <span>SKILL.md Instructions {loading&&'(Loading...)'}</span>
        <textarea className="mv-input" style={{fontFamily:'var(--font-mono, monospace)',fontSize:12,lineHeight:1.5}} rows={15} value={content} onChange={e=>setContent(e.target.value)} placeholder="Write the skill method in Markdown..."/>
      </label>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
        <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="mv-btn primary" disabled={saving}><Save size={14}/>{saving?'Saving...':isEdit?'Save Skill':'Create Skill'}</button>
      </div>
    </form>
  </Sheet>;
}

/* ---------- A subagent: skills + how our workflow runs ---------- */
function SubagentCard({agent,lessonCount,skills,connectors=[],onOpen,onSkill,go}) {
  const steps = agentSteps(agent);
  const mine = agent.skills.map(name=>skills.find(skill=>skill.name===name)||{name,missing:true});
  const sites = connectors.filter(item=>item.order>0&&item.agents.includes(agent.id)).sort((a,b)=>a.order-b.order);
  return <article className={`mv-sa-card is-tile-${ROLE_TILE[agent.role]||6}`}>
    <button type="button" className="mv-sa-main" onClick={onOpen} aria-label={`Open ${agent.name}`}>
      <span className="mv-sa-top"><AgentAvatar agent={agent} size={38}/><span><strong>{agent.name}</strong><small>{deptName(agent.role)}</small></span><AgentStatus status={agent.status}/></span>
      <span className="mv-sa-summary">{skillLine(agent.summary,170)}</span>
    </button>
    <div className="mv-sa-built">
      <div><small><Sparkles size={12}/>Skills</small><span>{mine.map(skill=><button key={skill.name} type="button" disabled={skill.missing} title={skill.description||undefined} onClick={()=>onSkill(skill)}>{skillTitle(skill.name)}</button>)}{!mine.length&&<em>None yet</em>}</span></div>
      <div><small><Workflow size={12}/>Workflow</small><span>{steps.map(step=><button key={step.id} type="button" className="is-step" title={step.purpose||undefined} onClick={()=>go(step.slug)}>{step.name}</button>)}{!steps.length&&<em>Launchroom itself</em>}</span></div>
      <div><small><Plug size={12}/>Connectors</small><span>{sites.map(site=><button key={site.id} type="button" className={`is-site is-${site.status?.id||'planned'}`} title={site.status?.label} onClick={()=>go(`connect?id=${site.id}`)}>{site.status?.id==='connected'&&<CheckCircle2 size={11}/>}{site.name}</button>)}{!sites.length&&<em>None yet</em>}</span></div>
    </div>
    <footer><span>{agent.guides.length} guide{agent.guides.length===1?'':'s'}</span><span>{lessonCount} lesson{lessonCount===1?'':'s'}</span>{agent.latest&&<span>Last job {timeAgo(agent.latest.updatedAt)}</span>}{!agent.installed&&<Chip tone="bad">Not installed</Chip>}</footer>
  </article>;
}

/* ---------- The skills we curate and make, for any job ---------- */
const whereIs = skill => skill.scope==='personal'?'All your projects':'This project';
const PIPELINE_STEP_ROUTES = [
  ['product', 'find'],
  ['verify', 'verify'],
  ['winners', 'winners'],
  ['build', 'build'],
  ['creatives', 'create'],
  ['checklist', 'checklist'],
  ['launch', 'launch'],
  ['manage', 'manage'],
];

/*
 * The pipeline as one numbered line, top to bottom (owner, Nov 5: "It doesn't look like step one.
 * What is step one?"): each step's number, name, what it's for, who works it and the skills it
 * loads, grouped the way the sidebar groups them. Manage comes after launch, without a number.
 */
const STEP_LINE_GROUPS = [
  {id:'find', title:'Find & choose', steps:[
    {id:'product', n:1, line:'Find products whose sales are rising'},
    {id:'verify', n:2, line:'The hard checks. Most products stop here'},
    {id:'winners', n:3, line:'You pick the 1–2 products to build', owner:true},
  ]},
  {id:'build', title:'Build & launch', steps:[
    {id:'build', n:4, line:'Build the product page and the Shopify setup'},
    {id:'creatives', n:5, line:'Make the videos and the static ads'},
    {id:'checklist', n:6, line:'Seven checks before we spend a dollar'},
    {id:'launch', n:7, line:'Set the budget and go live', owner:true},
  ]},
  {id:'after', title:'After launch', steps:[
    {id:'manage', n:null, line:'Watch the numbers daily, then scale or cut'},
  ]},
];
const STEP_TARGETS = Object.fromEntries(PIPELINE_STEP_ROUTES);

function StepSkillsLine({skills,team,onOpen,go}) {
  const agentName = id => team?.agents?.find(agent=>agent.id===id)||{id,name:id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),role:'manager'};
  return <section className="mv-ps" aria-label="Skills by pipeline step">
    <div className="mv-ps-head">
      <div>
        <h2><Workflow size={16}/>Skills by pipeline step</h2>
        <p>Every step loads these skills before it works. Tap a skill to read it, or a step to open it.</p>
      </div>
    </div>
    {STEP_LINE_GROUPS.map((group,gi)=><div key={group.id} className={`mv-ps-group is-tile-${gi===0?1:gi===1?4:3}`}>
      <span className="mv-ps-group-title">{group.title}</span>
      <ol className="mv-ps-steps">{group.steps.map(step=>{
        const spec = PIPELINE_STEP_SKILLS[step.id];
        if (!spec) return null;
        return <li key={step.id} className="mv-ps-step">
          <span className={`mv-ps-node ${step.n?'':'is-after'}`} aria-hidden="true">{step.n||<TrendingUp size={15}/>}</span>
          <div className="mv-ps-main">
            <button type="button" className="mv-ps-name" onClick={()=>go?.(STEP_TARGETS[step.id]||spec.slug)}>
              <small>{step.n?`Step ${step.n}`:'Ongoing'}</small>
              <strong>{spec.short}<ArrowRight size={14}/></strong>
            </button>
            <p>{step.line}</p>
            <span className="mv-ps-who">
              {step.owner&&<span className="mv-ps-you">Your call</span>}
              {spec.agents.map(id=>{const agent = agentName(id);return <span key={id} className="mv-ps-agent"><AgentAvatar agent={agent} size={20}/>{agent.name}</span>;})}
            </span>
          </div>
          <div className="mv-ps-skills">{spec.skills.map(name=>{
            const found = skills.find(s=>s.name===name)||{name,path:`.claude/skills/${name}/SKILL.md`,description:spec.rule,usedBy:spec.agents,missing:true};
            return <button key={name} type="button" onClick={()=>onOpen(found)} title={found.description||undefined}><Sparkles size={11}/>{skillTitle(name)}</button>;
          })}</div>
        </li>;
      })}</ol>
    </div>)}
  </section>;
}

function SkillLibrary({team,onOpen,onAgent,onNewSkill,go}) {
  const skills = team.skills||[];
  const [query,setQuery] = useState(''),[shelf,setShelf] = useState('');
  const groups = useMemo(()=>shelfGroups(skills,{query,shelf}),[skills,query,shelf]);
  const counts = useMemo(()=>shelfCounts(skills),[skills]);
  return <section className="mv-ag-section" id="mv-skills">
    <StepSkillsLine skills={skills} team={team} onOpen={onOpen} go={go}/>

    <div className="mv-ag-head">
      <SectionHead icon={Sparkles} title="General & Reusable Skills" count={skills.length}/>
      <div className="mv-ag-head-side">
        <label className="mv-sa-search"><Search size={14}/><input type="search" aria-label="Search skills" placeholder="Search skills" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        {onNewSkill&&<button className="mv-btn sm primary" onClick={onNewSkill}><Plus size={14}/>Build Skill</button>}
      </div>
    </div>
    <div className="mv-sa-chips" role="group" aria-label="Show one shelf">
      <button type="button" aria-pressed={!shelf} onClick={()=>setShelf('')}>All<b>{skills.length}</b></button>
      {counts.map(entry=><button key={entry.id} type="button" aria-pressed={shelf===entry.id} onClick={()=>setShelf(shelf===entry.id?'':entry.id)}>{entry.title}<b>{entry.count}</b></button>)}
    </div>
    {groups.length?groups.map(group=><div key={group.id} className="mv-sa-shelf">
      <h3>{group.title}<b>{group.skills.length}</b></h3>
      <div className="mv-sa-skills">{group.skills.map(skill=><article key={skill.path} className="mv-sa-skill">
        <button type="button" className="mv-sa-skill-open" onClick={()=>onOpen(skill)} title={skill.description||undefined}>
          <strong>{skillTitle(skill.name)}</strong>
          <span>{skillLine(skill.description)||'No description yet.'}</span>
        </button>
        <footer>
          <small>{whereIs(skill)}</small>
          <span className="mv-ag-skill-faces">{(skill.usedBy||[]).map(id=>{const agent=agentOf(team,id);return id==='manager'?<span key={id} title="Manager"><Avatar role="manager" size={20}/></span>:<button type="button" key={id} title={agent?.name||id} aria-label={`Open ${agent?.name||id}`} onClick={()=>onAgent(id)}><AgentAvatar agent={agent} size={20}/></button>;})}</span>
        </footer>
      </article>)}</div>
    </div>):<div className="mv-card mv-empty"><Search size={22}/><strong>No skill matches.</strong></div>}
  </section>;
}

/** One skill: what it's for, who carries it and all of it a tap away. */
function SkillSheet({skill,team,onClose,onAgent,onEdit}) {
  const [full,setFull] = useState(null),[error,setError] = useState('');
  useEffect(()=>{
    let alive = true;
    api(`/api/team/skill?name=${encodeURIComponent(skill.name)}`).then(res=>{if(alive)setFull(res);}).catch(e=>{if(alive)setError(e.message);});
    return ()=>{alive = false;};
  },[skill.name]);
  const body = String(full?.content||'').replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/,'');
  const usedBy = skill.usedBy||[];
  return <Sheet wide title={skillTitle(skill.name)} subtitle={whereIs(skill)} onClose={onClose} actions={onEdit&&skill.scope!=='personal'?<button className="mv-btn sm" onClick={()=>onEdit(skill)}><Pencil size={13}/>Edit</button>:undefined}>
    <div className="mv-sa-skillsheet">
      {skill.description&&<p className="mv-sa-lead">{skill.description}</p>}
      <div className="mv-sa-carried"><small>Carried by</small>{usedBy.length?usedBy.map(id=>{const agent=agentOf(team,id);return id==='manager'?<span key={id} className="mv-sa-person"><Avatar role="manager" size={22}/>Manager</span>:<button type="button" key={id} className="mv-sa-person" onClick={()=>onAgent(id)}><AgentAvatar agent={agent} size={22}/>{agent?.name||id}</button>;}):<em>No subagent yet. Any chat can still load it.</em>}</div>
      <code className="mv-sa-path">{skill.path}</code>
      {error&&<div className="mv-error" role="alert">{error}</div>}
      {body?<details open className="mv-sa-full"><summary>Read the whole skill</summary><div className="mv-doc"><Markdown>{body}</Markdown></div></details>:!error&&<p className="mv-small">{full?'This skill has no instructions yet.':'Loading…'}</p>}
    </div>
  </Sheet>;
}

export function AgentsView(props) {
  const {data,activity,activityError,openDoc,route,go,planner,day,current,notify,refresh} = props;
  const asked = route?.params?.tab;
  const tab = ['now','team','skills','reports'].includes(asked)?asked:'skills';
  const team = data.team||{agents:[],skills:[]};
  const tasks = planner?.tasks||[];
  const board = useMemo(()=>teamBoard(team.agents,tasks,activity,day),[team.agents,tasks,activity,day]);
  // What waits on the owner comes from the pipeline's owner moves (pipelineState), the same as Home.
  const ownerMoves = current?.pipeline?.ownerMoves;
  const mc = useMemo(()=>missionControl({tasks,activity,ownerMoves:ownerMoves||[],day}),[tasks,activity,ownerMoves,day]);
  const [sheet,setSheet] = useState(null),[report,setReport] = useState(null);
  const [editingAgent,setEditingAgent] = useState(null),[editingSkill,setEditingSkill] = useState(null);
  const [role,setRole] = useState(null),[status,setStatus] = useState('all'),[limit,setLimit] = useState(25);
  const [openSkill,setOpenSkill] = useState(null),[lessons,setLessons] = useState([]);
  const connectors = useConnectors();
  useEffect(()=>{if(tab!=='team'&&!sheet)return undefined;let alive = true;api('/api/lessons').then(res=>{if(alive)setLessons(res?.lessons||[]);}).catch(()=>{});return ()=>{alive = false;};},[tab,sheet]);
  const lessonCount = id => lessons.filter(lesson=>lesson.scope===id&&['proven','trying'].includes(lesson.status)).length;
  const filtered = activity.filter(item=>(!role||item.role===role)&&(status==='all'||item.status===status));
  const counts = s => activity.filter(item=>(!role||item.role===role)&&(s==='all'||item.status===s)).length;
  const sheetAgent = sheet&&board.agents.find(agent=>agent.id===sheet);
  const liveReport = report&&(activity.find(item=>item.id===report.id)||report);
  const tabs = [['now','Now',Gauge],['team','Subagents',Users],['skills','Skills',Sparkles],['reports','Reports',Activity]];
  return <section>
    <div className="mv-page-head"><div><span className="mv-eyebrow">Library · Subagents &amp; General Skills</span><h1 className="mv-h1">Subagents &amp; Skills</h1><p className="mv-sub">Browse, create, and inspect subagents and general skills across the workspace.</p></div>
      <div className="mv-page-actions"><RoundChip pipeline={current?.pipeline} current={current} go={go}/></div>
    </div>
    <div className="mv-ag-tabs"><div className="mv-seg" role="group" aria-label="Agents view">{tabs.map(([id,label,Icon])=><button key={id} aria-pressed={tab===id} onClick={()=>go(`agents?tab=${id}`)}><Icon size={14}/>{label}</button>)}</div></div>
    {team.error&&<div className="mv-error" style={{margin:'14px 0'}}>{team.error}</div>}
    {activityError&&<div className="mv-error" style={{margin:'14px 0'}}>{activityError}</div>}
    {tab==='team'?<div className="mv-ag">
      <p className="mv-ag-calltip"><MessageSquareText size={15}/><span>Tell your agent in chat which subagent to call, or just ask for the job and the Manager picks the right specialist.</span></p>
      <section className="mv-ag-section">
        <div className="mv-ag-head">
          <SectionHead icon={Users} title="Subagents" count={board.agents.length}/>
          <button className="mv-btn sm primary" onClick={()=>setEditingAgent({})}><Plus size={14}/>Build Subagent</button>
        </div>
        {team.missing&&<div className="mv-card mv-empty"><strong>No team roster yet.</strong><span className="mv-small">Add agents/team.json to list the team.</span></div>}
        <div className="mv-sa-cards">{board.agents.map(agent=><SubagentCard key={agent.id} agent={agent} skills={team.skills||[]} connectors={connectors} lessonCount={lessonCount(agent.id)} go={go} onOpen={()=>setSheet(agent.id)} onSkill={setOpenSkill}/>)}</div>
      </section>
    </div>
    :tab==='skills'?<div className="mv-ag"><SkillLibrary team={team} go={go} onOpen={setOpenSkill} onAgent={id=>setSheet(id)} onNewSkill={()=>setEditingSkill({})}/></div>
    :tab==='reports'?<div className="mv-ag mv-ag-section">
      <RoleTiles agents={data.agents} activity={activity} selected={role} onSelect={next=>{setRole(next);setLimit(25);}}/>
      <div className="mv-ag-reports">
        <div className="mv-card mv-pad">
          <div className="mv-panel-title"><h2 className="mv-h3">Reports {role&&<Chip>{roleOf(role).name}</Chip>}</h2>
            <div className="mv-filter">{[['all','All'],['running','In progress'],['blocked','Needs input'],['completed','Completed']].map(([id,label])=><button key={id} aria-pressed={status===id} onClick={()=>{setStatus(id);setLimit(25);}}>{label}<b>{counts(id)}</b></button>)}</div>
          </div>
          {filtered.length?<ReportList items={filtered.slice(0,limit)} team={team} onOpen={setReport}/>:<div className="mv-empty"><strong>No reports match.</strong></div>}
          {filtered.length>limit&&<div className="mv-show-more"><button className="mv-btn" onClick={()=>setLimit(limit+50)}>Show more ({filtered.length-limit} earlier)</button></div>}
        </div>
        <div className="mv-card mv-pad mv-ag-reports-side"><div className="mv-panel-title"><h2 className="mv-h3">Reporting rhythm</h2><span className="mv-small">Last 14 days</span></div><Rhythm activity={role?activity.filter(item=>item.role===role):activity}/><p className="mv-small" style={{margin:'10px 0 0'}} title="Bar height uses a square-root scale so quiet days stay visible.">Saved milestones per day, not hours worked or verified results.</p></div>
      </div>
    </div>
    :<MissionControl team={team} board={board} mc={mc} activity={activity} pipeline={current?.pipeline} go={go} openReport={setReport} openAgent={setSheet}/>}
    {sheetAgent&&<AgentSheet key={sheetAgent.id} agent={sheetAgent} team={team} skills={team.skills||[]} lessons={lessons} openDoc={openDoc} go={go} activity={activity} onClose={()=>setSheet(null)} onEdit={agent=>{setSheet(null);setEditingAgent(agent);}} onReport={setReport} onSkill={skill=>{setSheet(null);setOpenSkill(skill);}}/>}
    {openSkill&&<SkillSheet key={openSkill.name} skill={openSkill} team={team} onClose={()=>setOpenSkill(null)} onAgent={id=>{setOpenSkill(null);setSheet(id);}} onEdit={skill=>{setOpenSkill(null);setEditingSkill(skill);}}/>}
    {editingAgent&&<SubagentBuilderSheet initialAgent={editingAgent.id?editingAgent:null} skills={team.skills||[]} onClose={()=>setEditingAgent(null)} onSaved={res=>{notify?.(`Saved subagent ${res.agentId}.`);refresh?.();}}/>}
    {editingSkill&&<SkillBuilderSheet initialSkill={editingSkill.name?editingSkill:null} team={team} onClose={()=>setEditingSkill(null)} onSaved={res=>{notify?.(`Saved skill ${res.skillName}.`);refresh?.();}}/>}
    {liveReport&&<ReportSheet item={liveReport} team={team} openDoc={openDoc} onClose={()=>setReport(null)}/>}
  </section>;
}
