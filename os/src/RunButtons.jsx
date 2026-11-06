import React,{useState} from 'react';
import {Play,Square,MessageSquareText,Lock,Loader,ChevronDown,ChevronUp,ShieldCheck,TerminalSquare,CircleCheck,CircleAlert,Clock3} from 'lucide-react';
import {Chip,timeAgo} from './kit.jsx';
import {runButtons,runStatusText,runTone,latestEvent,runsFor,isLiveRun} from './runsModel.mjs';
import './runs.css';

// Run buttons (owner, Oct 3: "are we able to set up headless claude in here?
// because talking to you directly and you spawning agents relies on you and
// your context"). Each button names one reviewed job template and its target;
// the server fills it from saved records and runs Claude Code headless. Live
// runs show here and on the Agents tab with Stop. A run never passes a check.

const RUN_ERRORS = {
  RUN_LIMIT:e=>e.message, RUN_BUSY:e=>e.message, NEEDS_CHAT:e=>e.message, RUN_NOT_HERE:e=>e.message, CLAUDE_MISSING:e=>e.message,
  OWNER_ONLY:()=>'Only the owner starts runs. You can watch them on the Agents tab.',
  REMOTE_RUN_REFUSED:()=>'Runs start only from the browser on the home computer, not over a remote connection.',
  AGENT_RUN_REFUSED:()=>'Agents can\'t start runs.', RUN_NOT_ALLOWED:()=>'Runs start only from the owner\'s browser on this computer.',
  TEMPLATES_BROKEN:e=>e.message,
};
export const runError = e => (RUN_ERRORS[e?.code]||(()=>e?.message||'The run could not start.'))(e);

/** One run as a compact line: status chip, the latest step, time and Stop while it is going. */
export function RunLine({run,onStop,showTarget=false}) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const live = isLiveRun(run);
  // A finished run shows what it said at the end (its result); a live one, its latest step.
  const latest = !live&&run.result?{text:run.result}:latestEvent(run);
  async function stop() {
    if (busy) return;
    setBusy(true);setError('');
    try {await onStop(run.id);} catch (e) {setError(runError(e));} finally {setBusy(false);}
  }
  return <div className={`mv-rn-line is-${run.status}`}>
    <span className="mv-rn-icon">{live?<Loader size={15} className="mv-rn-spin"/>:run.status==='finished'?<CircleCheck size={15}/>:<CircleAlert size={15}/>}</span>
    <span className="mv-rn-text">
      <strong>{run.label}{showTarget&&run.target?.id?` · ${run.target.id}`:''}</strong>
      <small>{latest?latest.text:'Starting…'}</small>
      {error&&<small className="mv-rn-error" role="alert">{error}</small>}
    </span>
    <Chip tone={runTone(run)}>{runStatusText(run)}</Chip>
    <time className="mv-rn-time">{timeAgo(run.updatedAt||run.startedAt)}</time>
    {live&&onStop&&<button type="button" className="mv-btn sm" disabled={busy} onClick={stop} title="Stop this run (its own processes only)"><Square size={12}/>{busy?'Stopping…':'Stop'}</button>}
  </div>;
}

/** The Run buttons for one product, one issue, or the Agents tab (no target), with this target's runs underneath. */
export function RunPanel({claude,runs=[],item=null,issue=null,startRun,stopRun,title='Run it here',compact=false}) {
  const [busy,setBusy] = useState(''),[error,setError] = useState(''),[open,setOpen] = useState(false);
  if (!claude) return null;
  const buttons = runButtons({claude,runs,item,issue});
  const targetId = item?.id||issue?.slug||'';
  const mine = targetId?runsFor(runs,targetId).slice(0,4):[];
  if (!buttons.length&&!mine.length) return null;
  async function start(template) {
    if (busy) return;
    setBusy(template.id);setError('');
    try {await startRun(template.id,targetId);} catch (e) {setError(runError(e));} finally {setBusy('');}
  }
  return <section className={`mv-card mv-pad mv-rn ${compact?'is-compact':''}`} aria-label={title}>
    <div className="mv-panel-title"><h2 className="mv-h3"><Play size={15}/>{title}</h2>{!compact&&<span className="mv-small mv-rn-plan">Runs use your Claude plan</span>}</div>
    {buttons.length>0&&<div className="mv-rn-buttons">{buttons.map(({template,state,reason,run})=><div key={template.id} className={`mv-rn-button is-${state}`}>
      <button type="button" className={`mv-btn ${state==='ready'?'accent':''}`} disabled={state!=='ready'||Boolean(busy)} title={reason} onClick={()=>start(template)}>
        {state==='chat'?<MessageSquareText size={14}/>:state==='running'?<Loader size={14} className="mv-rn-spin"/>:state==='ready'?<Play size={14}/>:<Lock size={14}/>}
        {busy===template.id?'Starting…':template.label}
      </button>
      <small>{state==='chat'?'Needs the manager chat: a real browser':state==='running'?runStatusText(run):state==='ready'?`${template.agent?template.agent.replace('-',' '):'Claude'} · ${template.model} · up to ${template.maxMinutes} min`:reason}</small>
    </div>)}</div>}
    {error&&<div className="mv-error" role="alert">{error}</div>}
    {mine.length>0&&<div className="mv-rn-list">{mine.map(run=><RunLine key={run.id} run={run} onStop={stopRun}/>)}</div>}
    {!compact&&<button type="button" className="mv-rn-more" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={13}/>:<ChevronDown size={13}/>}What a run may do</button>}
    {open&&<RunRules claude={claude}/>}
  </section>;
}

/** The allowlist in plain words, from the server's own lists. */
export function RunRules({claude}) {
  return <div className="mv-rn-rules">
    <p><ShieldCheck size={14}/>Each run is a fixed job with the standing rules: read-only on shopping sites, no buying or sign-in, never a CAPTCHA, never your decisions, a timeout on every network call, and a report on the Agents tab. It can't publish, deploy, push or spend.</p>
    <p><TerminalSquare size={14}/><b>Tools:</b> {claude.tools?.join(', ')}</p>
    <p><b>Allowed without asking:</b> <code>{(claude.allow||[]).join(' · ')}</code></p>
    <p><b>Always refused:</b> <code>{(claude.deny||[]).slice(0,14).join(' · ')}{(claude.deny||[]).length>14?` · and ${(claude.deny||[]).length-14} more`:''}</code></p>
    <p><Clock3 size={14}/>At most {claude.limit||2} runs at once, one per product and step. Anything else is denied, and the run writes the gap down as unknown.</p>
  </div>;
}

/** The Agents tab: every run, live first, with Stop, and the no-target jobs (the health check). */
export function RunsBoard({claude,runs=[],startRun,stopRun}) {
  const [showAll,setShowAll] = useState(false);
  if (!claude) return null;
  const live = runs.filter(isLiveRun), done = runs.filter(run=>!isLiveRun(run));
  const shown = showAll?done:done.slice(0,4);
  return <section className="mv-card mv-pad mv-rn mv-rn-board" aria-label="Runs">
    <div className="mv-panel-title"><h2 className="mv-h3"><Play size={15}/>Runs from the Run buttons <Chip tone={live.length?'active':'muted'}>{live.length} going</Chip></h2><span className="mv-small mv-rn-plan">Headless Claude · runs use your Claude plan · {claude.available?'ready':claude.reason}</span></div>
    {live.length>0?<div className="mv-rn-list">{live.map(run=><RunLine key={run.id} run={run} onStop={stopRun} showTarget/>)}</div>
    :<p className="mv-small mv-rn-empty">No run is going. Press Run on a product's page, a Prove it row or an issue; it shows here live, with Stop.</p>}
    {done.length>0&&<><h3 className="mv-rn-sub">Recent</h3><div className="mv-rn-list">{shown.map(run=><RunLine key={run.id} run={run} showTarget/>)}</div>
      {done.length>4&&<button type="button" className="mv-rn-more" onClick={()=>setShowAll(!showAll)}>{showAll?'Show fewer':`Show ${done.length-4} more`}</button>}</>}
    <RunPanel claude={claude} runs={runs} startRun={startRun} stopRun={stopRun} title="Anytime jobs" compact/>
    <details className="mv-rn-details"><summary>What a run may do</summary><RunRules claude={claude}/></details>
  </section>;
}

/** A compact Run button for a pipeline row (Prove it rows): the step's main job. */
export function RowRunButton({claude,runs=[],item,startRun,templateId}) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  if (!claude) return null;
  const button = runButtons({claude,runs,item}).find(entry=>entry.template.id===templateId);
  if (!button) return null;
  async function start() {
    if (busy||button.state!=='ready') return;
    setBusy(true);setError('');
    try {await startRun(templateId,item.id);} catch (e) {setError(runError(e));} finally {setBusy(false);}
  }
  return <span className="mv-rn-row">
    <button type="button" className={`mv-btn sm ${button.state==='ready'?'':'ghost'}`} disabled={button.state!=='ready'||busy} title={error||button.reason} onClick={start}>
      {button.state==='running'?<Loader size={13} className="mv-rn-spin"/>:<Play size={13}/>}{button.state==='running'?'Running':busy?'Starting…':'Run P2–P5'}
    </button>
    {error&&<small className="mv-rn-error" role="alert">{error}</small>}
  </span>;
}
