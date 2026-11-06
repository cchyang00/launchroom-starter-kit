import {STEP_COUNT as LINE_STEPS} from './steps.mjs';
import React,{useMemo,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Bot,Check,DollarSign,Hammer,Images,Store,Sparkles,FileText,ExternalLink,Lock,CircleCheck,ListChecks,Play,User,Users,OctagonX,History,ListTodo,ChevronDown,ChevronUp,Flag,BookOpen,Rocket,RotateCcw,MessageSquareText,Target,Undo2,Video} from 'lucide-react';
import {api,Modal} from './ui.jsx';
import {findItem,lineLeadState,primaryMarket,openBeforeBuild} from './pipeline.mjs';
import {itemActivity,moveText,liveWork,STEP_STAGES} from './pipelineView.mjs';
import {effectiveCheckStatus} from './processModel.mjs';
import {headingAnchor} from './documentPaths.mjs';
import {Chip,Sheet,FourGateSnapshot,AgentPacketBar,AgentAvatar,Avatar,agentOf,timeAgo} from './kit.jsx';
import {EyeTestDecision,ScreenChecks,DeepChecks,FindChecks} from './ProductBoard.jsx';
import {ownerReasonLine} from './eyeTest.mjs';
import {ProductWorkspace} from './ProductWorkspace.jsx';
import {statsPanel} from './statsPanel.mjs';
import {PanelTiles} from './cards.jsx';
import {BuyersPanel,EvidenceFlags,GateTiles,HardRules,HeroStats,MediaStage,MetaPanel,MoneyPanel,NumbersPanel,OnMetaCard,ProductSteps,TrendCard} from './ProductParts.jsx';
import {cardName,evidenceFlags,markupOf,trendInDoubt,viralCounts} from './productView.mjs';
import {firstImageAd} from './campaignView.mjs';
import {shortProductId} from './displayLine.mjs';
import {GATES,gateLine} from './gates.mjs';
import {WhoChip,when,LiveNow} from './Pipeline.jsx';
import {AheadStrip,WaitReasons,aheadOf,waitReasons} from './ProveAhead.jsx';

// One product's own page (#/product/<L###|P###>; owner, Nov 4: "more interactive and a lot
// more cards"): its video and the decision first, with the big numbers, then every detail
// behind a tile: numbers and videos, Meta, money, buyers, checks, the team and files.
// Everything comes from saved records (pipelineState); the eye test, Reopen and "Build this
// one" are the only writes.

/**
 * A failed check took this product out of the line on its own (CHECKS.md rule 3,
 * owner Oct 3: "you can fail the product"). One tap reopens that exact failure (Undo for 5 seconds);
 * the agent who owns the check re-checks it next.
 */
function FailedBanner({item,reopenProduct,openDoc}) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const check = item.outcome.check||{};
  async function reopen() {
    if (busy) return;
    setBusy(true);setError('');
    try {await reopenProduct(item);} catch (e) {setError(e.code==='OWNER_DECISION_ONLY'?'Only you can reopen a product, from your own browser.':e.message);} finally {setBusy(false);}
  }
  return <div className="mv-pl-outcome mv-pl-failed" role="note">
    <OctagonX size={17}/>
    <div><b>{item.outcome.label}{item.outcome.on?` · ${day(item.outcome.on)}`:''}</b>
      <p>{item.outcome.reason||'No note was saved with the failed check.'}</p>
      <p className="mv-small">A check that fails takes the product out of the line on its own; nothing waits for you. {check.source?(/^https?:/.test(check.source)?<a className="mv-link" href={check.source} target="_blank" rel="noreferrer">The evidence<ArrowUpRight size={12}/></a>:<button className="mv-link" onClick={()=>openDoc(check.source)}>The evidence</button>):null}</p>
      {error&&<div className="mv-error" role="alert">{error}</div>}
    </div>
    <button type="button" className="mv-btn sm mv-pl-reopen" disabled={busy} onClick={reopen} title={`Put ${item.id} back on the line; ${check.line||'the check'} is re-checked next`}><RotateCcw size={14}/>{busy?'Reopening…':'Reopen'}</button>
  </div>;
}

const SAID_WORDS = {saved:'Saved · Ready to build',passed:'Passed for now',rejected:'Rejected'};
/** A decision the owner said in chat (Oct 3), recorded by Claude with the owner's words; one tap undoes it. */
function SaidBanner({lead,recordDecision}) {
  const said = lead?.candidate?.screen?.said;
  const [busy,setBusy] = useState(false),[error,setError] = useState(''),[full,setFull] = useState(false);
  if (!said||said.source!=='owner-chat') return null;
  const decision = lead.candidate.screen.ownerDecision;
  async function undo() {
    if (busy) return;
    setBusy(true);setError('');
    try {await recordDecision(lead,'undo-said');} catch (e) {setError(e.message);} finally {setBusy(false);}
  }
  return <div className="mv-et-said mv-pl-said" role="note">
    <MessageSquareText size={15}/>
    <div><b>Said in chat · {SAID_WORDS[decision]||decision}</b><span className={full?'':'mv-pp-clamp'}>“{said.quote}”</span>{said.quote.length>170&&<button type="button" className="mv-link" aria-expanded={full} onClick={()=>setFull(value=>!value)}>{full?'Less':'More'}<ChevronDown size={12} style={full?{transform:'rotate(180deg)'}:undefined}/></button>}<small>Recorded by Claude from your words{said.at?` on ${day(said.at)}`:''}. Undo puts it back to {said.before?.ownerDecision&&said.before.ownerDecision!=='unreviewed'?SAID_WORDS[said.before.ownerDecision]?.toLowerCase():'waiting for your eye test'}.</small>{error&&<span className="mv-error" role="alert">{error}</span>}</div>
    <button type="button" className="mv-btn sm" disabled={busy} onClick={undo}><Undo2 size={13}/>{busy?'Undoing…':'Undo'}</button>
  </div>;
}

const CHECK_DOT = {verified:'supported',blocked:'failed'};
const day = value => {const d=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00'):new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';};

const BUILD_ERRORS = {
  BUILD_SLOT_TAKEN:(e,name)=>`Another product holds the build slot (${e.details?.productId||'one is building'}). One product builds at a time; ${name} waits until that cycle is reviewed.`,
  SOURCE_NOT_DONE:(e,name)=>`${name} has not finished Prove it: every Product and Prove it check must be reviewed first.`,
  PRODUCT_ARCHIVED:(e,name)=>`${name} is archived; its cycle was already reviewed.`,
  REVISION_CONFLICT:()=>'The workspace changed while this was open. Close this, open it again and press Build this one.',
  LEAD_NOT_SAVED:(e,name)=>`${name} has no Save from your eye test. Only a card you saved can build.`,
  NO_OWNER_SAVE:(e,name)=>`${name} has no Save from your eye test. Only a card you saved can build.`,
  LEAD_OUT_OF_LINE:(e,name)=>`${name} was parked. Reopen it with Claude before building.`,
  PRODUCT_OUT_OF_LINE:(e,name)=>`${name} was parked. Reopen it with Claude before building.`,
  LEAD_HAS_PRODUCT:(e,name)=>`${name} already has a product record. Close this and press Build this one again.`,
};

/** "Build this one": the owner's pick for the one build slot, with a reason. Refused while another product holds it. */
function BuildSheet({item,pipeline,workspace,onClose,notify,early=false,open=[]}) {
  const [revision] = useState(workspace?.revision??0);
  const [reason,setReason] = useState(early?'Launch tonight':''),[busy,setBusy] = useState(false),[error,setError] = useState('');
  const taken = pipeline.building&&pipeline.building.id!==item.id?pipeline.building:null;
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    const target = item.productId?{productId:item.productId}:{leadId:item.leadId};
    try {await api('/api/workspace/build',{revision,...target,reason,...(early?{override:true}:{})});notify(`${item.name} is building now${early?' (launched early)':''}. Its Create, Build and Launch checks can start.`);onClose();}
    catch (e) {setError((BUILD_ERRORS[e.code]||(()=>e.message))(e,item.name));}
    finally {setBusy(false);}
  }
  return <Sheet title={`Build this one: ${item.name}`} subtitle={early?'Launch early: build it before Prove it is finished. One product builds at a time.':'One product builds at a time. Your pick, with your reason, moves it on to Create.'} onClose={onClose}>
    <div className="mv-pl-sheet">
      <div className="mv-pl-sheet-facts">
        {early?<span className="mv-pl-early-fact"><Flag size={14}/>Prove it is not finished: {open.length} check{open.length===1?'':'s'} still open. They stay on its page as “still open (launched early)” until an agent records them.</span>
        :<span><Check size={14}/>Prove it is done: its Product and Prove it checks are reviewed.</span>}
        <span><Hammer size={14}/>It takes the build slot. Create, Build and Launch checks can then be recorded for it.</span>
        <span><Lock size={14}/>Nothing is published, bought or spent. Launch still needs your approval later.</span>
      </div>
      {taken?<div className="mv-pl-taken" role="note"><Lock size={16}/><div><b>The build slot is taken.</b><span>{taken.name} ({taken.id}) is building now, at {taken.stepName}. {item.name} waits until that cycle is reviewed in Learning, which frees the slot.</span></div></div>
      :<form className="mv-decide-form" onSubmit={submit}>
        <label className="mv-field">Why this one?<textarea autoFocus className="mv-textarea" rows={3} required maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)} placeholder="e.g. Best margin, a clear buyer moment and a supplier who answered fast"/></label>
        {error&&<div className="mv-error" role="alert">{error}</div>}
        <div><button type="button" className="mv-btn ghost sm" onClick={onClose}>Cancel</button><button className="mv-btn sm accent" disabled={busy||!reason.trim()}><Hammer size={13}/>{busy?'Saving…':'Build this one'}</button></div>
      </form>}
    </div>
  </Sheet>;
}

/** The owner's move on this product, when it is the owner's turn. */
/** A saved card or product still at Buyers or Prove it can launch early (owner, Oct 1); never one without your Save. */
const canLaunchEarly = (item,lead) => !item.outcome&&!item.building&&!item.readyToBuild&&item.stepIndex>=1&&item.stepIndex<3&&lead?.candidate?.screen?.ownerDecision==='saved';

/** One card for what the owner can do here: its mark, a line of words and the action. */
function MoveCard({icon:Icon,waiting=false,title,text,children}) {
  return <section className={`mv-pp-move ${waiting?'is-waiting':''}`} aria-label={title}>
    <span className="mv-pp-move-mark"><Icon size={17}/></span>
    <div className="mv-pp-move-text"><strong>{title}</strong>{text&&<small>{text}</small>}</div>
    {children}
  </section>;
}

function OwnerMove({item,lead,pipeline,recordDecision,onBuild,onEarly}) {
  if (item.outcome) return null;
  const taken = pipeline.building&&pipeline.building.id!==item.id?pipeline.building:null;
  if (item.stepIndex===0&&item.who==='owner'&&lead) return <MoveCard icon={Sparkles} title="Your eye test" text="Save sends it to Ready to build. Pass or Reject takes it off the line.">
    <EyeTestDecision lead={lead} recordDecision={recordDecision}/>
  </MoveCard>;
  if (item.readyToBuild) return <MoveCard icon={Hammer} waiting={Boolean(taken)} title={taken?'Waits for the build slot':'Ready to build'} text={taken?`${taken.id} is building. This one moves up after that cycle is reviewed.`:'Every check passed. Pick it to start its page.'}>
    <button className="mv-btn accent" disabled={Boolean(taken)} title={taken?`${taken.name} holds the build slot`:'Pick this product for the build slot'} onClick={onBuild}>{taken?<Lock size={14}/>:<Hammer size={14}/>}Build this one</button>
  </MoveCard>;
  if (canLaunchEarly(item,lead)) return <MoveCard icon={Rocket} waiting title="Optional: build it before Prove it is finished" text={taken?`${taken.id} holds the build slot.`:'The checks still open stay listed under Checks.'}>
    <button className="mv-btn" disabled={Boolean(taken)} title={taken?`${taken.name} holds the build slot`:'Put this product in the build slot now'} onClick={onEarly}>{taken?<Lock size={14}/>:<Hammer size={14}/>}Build this one now</button>
  </MoveCard>;
  if (item.building&&item.who==='owner') return <MoveCard icon={Rocket} title="Approve the test" text="Going public, the budget and the most you'll lose. Tell Claude in chat; nothing runs or spends from this page."/>;
  return null;
}

function StepPanel({item,guide,team,live,go}) {
  const [details,setDetails] = useState(false);
  if (!guide) return <section className="mv-card mv-pad"><p className="mv-small">The step guide is not loaded.</p></section>;
  const out = Boolean(item.outcome);
  return <section className="mv-card mv-pl-step" aria-label="This step">
    <div className="mv-pl-step-head">
      <div><span className="mv-eyebrow">Step {guide.number} of {LINE_STEPS} · {guide.name} · {out?'stopped here':item.readyToBuild?'done, waiting for the build slot':'this product is here'}</span><h2 className="mv-h3">{guide.purpose}</h2></div>
      <button className="mv-btn sm" aria-expanded={details} onClick={()=>setDetails(!details)}>{details?<ChevronUp size={13}/>:<ChevronDown size={13}/>}{details?'Hide':'Start, done, your part'}</button>
    </div>
    {!out&&<div className="mv-pl-now"><span className="mv-pl-now-status"><Chip tone={item.owner?'owner':'active'}>Now</Chip>{item.status}</span><span className="mv-pl-now-move"><b>Next move</b><WhoChip who={item.who} team={team}/>{moveText(item.next)}</span></div>}
    {live?.length>0&&<div className="mv-pl-step-live"><b>Working on it now</b><LiveNow entries={live} team={team} go={go} limit={3}/></div>}
    {details&&<div className="mv-pl-facts">
      <div><Play size={14}/><b>Start when</b><p>{guide.startWhen}</p></div>
      <div><CircleCheck size={14}/><b>Done when</b><p>{guide.doneWhen}</p></div>
      <div className="is-you"><User size={14}/><b>Your part</b><p>{guide.ownerPart}</p></div>
      <div className="is-stop"><OctagonX size={14}/><b>Stop if</b><p>{guide.stopIf}</p></div>
    </div>}
  </section>;
}

/** The checks still open when the owner launched early, from the saved pick; each one shows "reviewed since" once recorded. */
function EarlyChecks({pick,market,data}) {
  const ids = pick?.missing||[];
  if (!pick?.override) return null;
  const titles = new Map(data.checks.map(check=>[check.id,check]));
  const rows = ids.map(id=>({id,title:titles.get(id)?.title||id,stage:data.stages.find(stage=>stage.id===titles.get(id)?.stage)?.title||'',done:effectiveCheckStatus(market,id)==='verified'}));
  const open = rows.filter(row=>!row.done).length;
  return <section className="mv-card mv-pad mv-pl-early-checks" aria-label="Still open (launched early)">
    <div className="mv-panel-title"><h2 className="mv-h3"><Flag size={15}/>Still open (launched early)</h2><span className="mv-small">{open} of {rows.length} open · your reason: “{pick.reason}”</span></div>
    {rows.length?<div className="mv-check-list">{rows.map(row=><div key={row.id} className="mv-check-row"><span className={`mv-status-dot is-${row.done?'supported':'pending'}`}/><div><strong>{row.title} <span className="mv-small">· {row.done?'reviewed since':'still open (launched early)'}</span></strong>{row.stage&&<p>{row.stage}</p>}</div></div>)}</div>
    :<p className="mv-small">No checks were open when you picked it.</p>}
  </section>;
}

function CheckRow({check,market,openDoc}) {
  const status = effectiveCheckStatus(market,check.id), proof = market?.checks?.[check.id];
  const source = proof?.source;
  return <div className="mv-check-row">
    <span className={`mv-status-dot is-${CHECK_DOT[status]||'pending'}`}/>
    <div><strong>{check.title} <span className="mv-small">· {status==='verified'?'reviewed':status}{proof?.observedAt?` · ${proof.observedAt}`:''}</span></strong><p>{proof?.note||check.description}</p></div>
    {source?(/^https?:/.test(source)?<a className="mv-link" href={source} target="_blank" rel="noreferrer" title={source}><ArrowUpRight size={12}/>Source</a>:<button onClick={()=>openDoc(source)} title={source}>Source</button>):null}
  </div>;
}

function StepChecks({item,lead,market,data,openDoc}) {
  const i = item.stepIndex;
  // Step 1 · Product: the eye test and the six checks; Step 2 · Buyers: the card's buyers lines; from Prove it on, a started product shows its own checks.
  const fromProduct = Boolean(item.productId)&&i>=2;
  const card = lead&&<details className="mv-pl-cardchecks"><summary>The card's later checks ({lead.id}): source & profit and deep checks</summary><h4>Source & profit</h4><ScreenChecks lead={lead} openDoc={openDoc}/><h4>Deep checks</h4><DeepChecks lead={lead} openDoc={openDoc}/></details>;
  let body;
  if (i===1) {
    const lines = GATES.buyers.map(line=>gateLine(line,{candidate:lead?.candidate||null}));
    const check = lead?.candidate?.screen?.checks?.buyers;
    body = <>
      <div className="mv-check-list">{lines.map(line=><div key={line.id} className="mv-check-row"><span className={`mv-status-dot is-${line.state==='passed'?'supported':line.state==='failed'?'failed':'pending'}`}/><div><strong>{line.id} · {line.label} <span className="mv-small">· {line.state==='passed'?'passed':line.state==='failed'?'failed':'not yet'}</span></strong></div></div>)}</div>
      {check?.source?<p className="mv-small">Saved {check.observedAt||''}: {/^https?:/.test(check.source)?<a className="mv-link" href={check.source} target="_blank" rel="noreferrer">the buyers write-up<ArrowUpRight size={12}/></a>:<button className="mv-link" onClick={()=>openDoc(check.source)}>the buyers write-up</button>}{check.quotes!=null?` · ${check.quotes} quotes`:''}</p>
      :<p className="mv-small">Not researched yet. The buyer researcher reads this product's TikTok comments, 2–4 star reviews and forums, then saves the write-up here.</p>}
      {card}
    </>;
  } else if (i===0) {
    const screen = lead?.candidate?.screen;
    const decided = screen&&screen.ownerDecision!=='unreviewed';
    body = <>
      <div className="mv-check-list"><div className="mv-check-row"><span className={`mv-status-dot is-${decided?(screen.ownerDecision==='saved'?'supported':'failed'):'pending'}`}/><div><strong>Your eye test <span className="mv-small">· {decided?screen.ownerDecision:'waiting for you'}{decided&&screen.said?.source==='owner-chat'?' · said in chat':''}</span></strong><p>{decided?(ownerReasonLine(screen)?`“${ownerReasonLine(screen)}”`:'Recorded without a reason.'):'Save for checks, Pass for now or Reject: one tap. A reason is optional.'}</p></div></div></div>
      {lead&&<p className="mv-small">The six checks (F1–F6) and their statistics are in Statistics at the top of this page.</p>}
      {card}
    </>;
  } else if (!fromProduct) {
    body = lead?<><FindChecks candidate={lead.candidate} openDoc={openDoc}/><h4>Source & profit</h4><ScreenChecks lead={lead} openDoc={openDoc}/><h4>Deep checks</h4><DeepChecks lead={lead} openDoc={openDoc}/></>:<p className="mv-small">No card is linked.</p>;
  } else {
    const stages = STEP_STAGES[i];
    const checks = data.checks.filter(check=>stages.includes(check.stage));
    body = <>
      {market?.verificationGate?.ready!==true&&<p className="mv-pl-gate"><Lock size={14}/>{market?.verificationGate?.reason||'This product is not linked to an owner-saved card yet, so its checks cannot count.'}</p>}
      <div className="mv-check-list">{checks.map(check=><CheckRow key={check.id} check={check} market={market} openDoc={openDoc}/>)}</div>
      {card}
    </>;
  }
  const done = item.line[i];
  return <section className="mv-card mv-pad mv-pl-checks" aria-label="This step's checks">
    <div className="mv-panel-title"><h2 className="mv-h3">{item.stepName} checks for this product</h2><span className="mv-small">{done.total?`${done.done}/${done.total} · `:''}read-only · agents record evidence</span></div>
    {body}
  </section>;
}

function AllChecks({item,market,data,openDoc,onEditor}) {
  const [open,setOpen] = useState(false);
  if (!item.productId) return null;
  return <section className="mv-card mv-pad mv-pl-allchecks">
    <button className="mv-pl-outtoggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}<strong>All its product checks</strong><span>{data.checks.filter(check=>effectiveCheckStatus(market,check.id)==='verified').length}/{data.checks.length} reviewed, step by step</span></button>
    {open&&<>{data.stages.map((stage,i)=>{const items=data.checks.filter(check=>check.stage===stage.id);const done=items.filter(check=>effectiveCheckStatus(market,check.id)==='verified').length;return <div key={stage.id} className="mv-pl-stage">
      <div className="mv-pl-stage-head"><span className={done===items.length?'is-done':''}>{done===items.length?<Check size={12} strokeWidth={3}/>:String(i+1).padStart(2,'0')}</span><strong>{stage.title}</strong><small>{done}/{items.length}</small></div>
      <div className="mv-check-list">{items.map(check=><CheckRow key={check.id} check={check} market={market} openDoc={openDoc}/>)}</div>
    </div>;})}
    <button className="mv-link" onClick={onEditor}><BookOpen size={13}/>Open the full evidence record (the older editor agents use)</button></>}
  </section>;
}

function ProductWork({mine,team,go}) {
  const nothing = !mine.tasks.length&&!mine.reports.length;
  return <section className="mv-card mv-pad mv-pl-work" aria-label="Agents and to-dos on this product">
    <div className="mv-panel-title"><h2 className="mv-h3"><ListTodo size={15}/>Agents and to-dos on this product</h2></div>
    {nothing&&<p className="mv-small">No task or report names this product yet. Agents tag their work with its id, and it shows up here.</p>}
    {mine.tasks.length>0&&<div className="mv-pl-tasks">{mine.tasks.slice(0,8).map(task=>{const agent=agentOf(team,task.agent);return <button key={task.id} className={`mv-pl-task is-${task.status}`} onClick={()=>go(`today?task=${task.id}`)}>
      {task.agent?<AgentAvatar agent={agent} size={24}/>:<Avatar role={task.assignee==='owner'?'owner':'manager'} size={24}/>}
      <span><strong>{task.title}</strong><small>{task.agent?`${agent?.name||task.agent} · `:task.assignee==='owner'?'You · ':''}{task.status==='done'?'done':task.nextAction||task.status}</small></span>
      <Chip tone={task.status==='done'?'done':task.status==='doing'?'active':task.status==='blocked'?'owner':'muted'}>{task.status}</Chip>
    </button>;})}</div>}
    {mine.reports.length>0&&<div className="mv-pl-reports">{mine.reports.slice(0,4).map(report=><div key={report.id} className="mv-pl-report"><span>{agentOf(team,report.agent)?<AgentAvatar agent={agentOf(team,report.agent)} size={22}/>:<Avatar role={report.agent==='manager'?'manager':report.role} size={22}/>}</span><span><strong>{report.title}</strong><small>{report.status} · {timeAgo(report.updatedAt)}</small></span></div>)}</div>}
    {mine.events.length>0&&<><h3 className="mv-h3 mv-pl-sub"><History size={14}/>What happened</h3><ol className="mv-pl-timeline">{mine.events.map((event,i)=><li key={`${event.reportId}-${i}`}><time>{timeAgo(event.at)}</time><span>{event.text}<small> · {event.title}</small></span></li>)}</ol></>}
  </section>;
}

export function ProductPage(props) {
  const {id,data,current,line,leads,recordDecision,reopenProduct,proveAhead,planner,activity,go,openDoc,notify,route,hub} = props;
  const pipeline = current?.pipeline;
  const item = findItem(pipeline,id);
  const [building,setBuilding] = useState(route?.params?.build==='1');
  const [early,setEarly] = useState(false);
  const [editor,setEditor] = useState(false);
  const raw = item?leads.find(entry=>entry.id===item.leadId):null;
  const lead = useMemo(()=>raw?{...raw,state:lineLeadState(raw)}:null,[raw]);
  const view = useMemo(()=>lead?.candidate?statsPanel(lead.candidate):null,[lead?.candidate]);
  if (!item) return <section className="mv-pl-page"><button className="mv-link mv-pl-back" onClick={()=>go('pipeline')}><ArrowLeft size={14}/>Pipeline</button><div className="mv-card mv-empty"><strong>No card or product {id} on the pipeline.</strong><span className="mv-small">Open the Pipeline to see every product.</span><button className="mv-btn sm" onClick={()=>go('pipeline')}>Open the Pipeline</button></div></section>;
  const product = [...data.products,...(data.archivedProducts||[])].find(entry=>entry.id===item.productId)||null;
  const market = product?(product.markets.find(entry=>entry.id===item.marketId)||primaryMarket(product)):null;
  const guide = line?.steps?.[item.stepIndex]||null;
  const mine = itemActivity(item,{tasks:planner?.tasks||[],activity});
  const evidencePath = lead?.sourcePath?(lead.heading?`${lead.sourcePath}#${headingAnchor(lead.heading)}`:lead.sourcePath):'';
  const round = pipeline.rounds.find(entry=>entry.number===item.round);
  const pick = item.building?data.workspace?.build:null;
  const live = liveWork(pipeline,activity||[],Date.now()).items[item.id]||[];
  const openNow = openBeforeBuild(data.stages,data.checks,market);
  // Work done ahead of the Save, and why a check can't move (Oct 3): from saved records and the prove file only.
  const prove = item.leadId?proveAhead?.cards?.[item.leadId]||null:null;
  const ahead = lead?aheadOf(item,lead.candidate,prove):null;
  // Past Verify nothing waits on a prove file; saying "Prove it hasn't started" there contradicts its own checks.
  const reasons = item.readyToBuild||item.building?[]:waitReasons({item,candidate:lead?.candidate||null,prove,ahead});
  const statusTone = item.outcome?(/rejected|killed|failed/.test(item.outcome.kind)?'bad':'muted'):item.owner?'owner':item.building?'active':item.readyToBuild?'warn':'active';
  const v = item.validation||view?.validation||null;
  const viral = viralCounts(v?.kalodata);
  const flags = evidenceFlags(item,pipeline.items,lead?.candidate);
  const shortId = shortProductId(item.productId||item.id);
  const campaign = (hub?.metaCampaigns||[]).find(entry=>shortProductId(entry.productId)===shortId)||null;
  const markup = markupOf(v);
  const metaCount = v?.meta?.liveAds??v?.meta?.advertisers??null;
  const avatarCount = (lead?.candidate?.screen?.checks?.buyers?.avatars?.length)||view?.avatars?.length||0;
  const stepDone = item.line[item.stepIndex];
  const tiles = [
    (v||view)&&{id:'numbers',icon:Video,tile:1,title:'Numbers',sub:viral.videos?`${viral.videos} viral video${viral.videos===1?'':'s'}`:'Demand and sources',node:<NumbersPanel validation={v} view={view} openDoc={openDoc}/>},
    v&&{id:'meta',icon:Target,tile:3,title:'Meta',sub:metaCount===null?'Not checked yet':`${metaCount} exact ad${metaCount===1?'':'s'}`,node:<MetaPanel validation={v}/>},
    (v?.tiers?.length||view)&&{id:'money',icon:DollarSign,tile:6,title:'Money',sub:markup?`${markup.toFixed(1)}x markup`:'Cost, price and profit',node:<MoneyPanel validation={v} view={view}/>},
    view&&{id:'buyers',icon:Users,tile:5,title:'Buyers',sub:avatarCount?`${avatarCount} avatar${avatarCount===1?'':'s'}`:'Not researched yet',node:<BuyersPanel view={view} candidate={lead?.candidate} openDoc={openDoc}/>},
    {id:'checks',icon:ListChecks,tile:4,title:'Checks',sub:view?`${view.passed}/6 · ${item.stepName}`:item.stepName,node:<div className="mv-pp-stack">
      <WaitReasons reasons={reasons} team={data.team}/>
      {ahead&&<AheadStrip ahead={ahead}/>}
      {view&&<GateTiles gates={view.gates}/>}
      {pick?.override&&<EarlyChecks pick={pick} market={market} data={data}/>}
      <StepChecks item={item} lead={lead} market={market} data={data} openDoc={openDoc}/>
      <AllChecks item={item} market={market} data={data} openDoc={openDoc} onEditor={()=>setEditor(true)}/>
    </div>},
    {id:'team',icon:Bot,tile:2,title:'Team & files',sub:live.length?`${live.length} working now`:`${guide?.name||item.stepName} step`,node:<div className="mv-pp-stack">
      <StepPanel item={item} guide={guide} team={data.team} live={live} go={go}/>
      <ProductWork mine={mine} team={data.team} go={go}/>
      {lead&&<AgentPacketBar lead={lead} evidencePath={evidencePath} openDoc={openDoc}/>}
      {lead?.candidate&&<FourGateSnapshot candidate={lead.candidate}/>}
    </div>},
  ];
  return <section className="mv-pl-page mv-pl-product">
    <button className="mv-link mv-pl-back" onClick={()=>go('pipeline')}><ArrowLeft size={14}/>Pipeline</button>
    <div className="mv-pp-hero">
      <MediaStage key={item.id} item={item} lead={lead} fallback={campaign?firstImageAd(campaign):''}/>
      <div className="mv-pp-main">
        <header className="mv-pp-title">
          <span className="mv-eyebrow">{[item.leadId,item.productId.split('-')[0],round?`Round ${round.number}`:item.round===null?'Earlier work':'',item.country].filter(Boolean).join(' · ')}</span>
          <h1 title={item.name}>{cardName(item.name)}</h1>
          <div className="mv-pp-title-links">
            <Chip tone={statusTone}>{item.outcome?item.outcome.label:item.building?`Building · ${item.stepName}`:item.readyToBuild?'Ready to build':item.status}</Chip>
            {evidencePath&&<button className="mv-link" onClick={()=>openDoc(evidencePath)}><FileText size={13}/>Evidence record</button>}
            {lead?.externalUrl&&<a className="mv-link" href={lead.externalUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Original listing</a>}
            {product?.sourceUrl&&product.sourceUrl!==lead?.externalUrl&&<a className="mv-link" href={product.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Product source</a>}
            {product&&<button className="mv-link" onClick={()=>openDoc(`products/${product.id}/OS.md`)}><FileText size={13}/>Product record</button>}
            {lead&&<button className="mv-link" onClick={()=>go(`find?lead=${lead.id}`)}><Sparkles size={13}/>Its card</button>}
            {(item.building||campaign)&&<button className="mv-link" onClick={()=>go('store')}><Store size={13}/>Store hub</button>}
            {(item.building||campaign)&&<button className="mv-link" onClick={()=>go('assets')}><Images size={13}/>Creatives hub</button>}
          </div>
        </header>
        {item.outcome&&(item.outcome.kind==='failed'?<FailedBanner item={item} reopenProduct={reopenProduct} openDoc={openDoc}/>:<div className="mv-pl-outcome"><OctagonX size={17}/><div><b>Out of the line · {item.outcome.label}{item.outcome.on?` · ${day(item.outcome.on)}`:''}</b><p>{item.outcome.reason||'No reason was saved.'}</p></div></div>)}
        {item.unlinked&&<div className="mv-pl-outcome is-warn"><Lock size={17}/><div><b>Not started from a card</b><p>Its checks cannot count until it is linked to a card you saved. Ask Claude to fix it.</p></div></div>}
        <OwnerMove item={item} lead={lead} pipeline={pipeline} recordDecision={recordDecision} onBuild={()=>setBuilding(true)} onEarly={()=>setEarly(true)}/>
        <EvidenceFlags flags={flags}/>
        {campaign&&<OnMetaCard campaign={campaign} go={go}/>}
        <HeroStats validation={v}/>
        {v&&<div className="mv-pp-signal">
          <TrendCard validation={v} inDoubt={trendInDoubt(item,pipeline.items)} trendUrl={view?.trendUrl}/>
          <HardRules rules={v.fiveRules}/>
        </div>}
        <ProductSteps item={item}/>
        {!item.outcome&&!item.readyToBuild&&item.next&&<p className="mv-pp-next"><b>Next</b><WhoChip who={item.who} team={data.team}/><span>{moveText(item.next)}{stepDone?.total?` · ${stepDone.done}/${stepDone.total} checks`:''}</span></p>}
        {live.length>0&&<LiveNow entries={live} team={data.team} go={go} limit={2}/>}
        <SaidBanner lead={lead} recordDecision={recordDecision}/>
        {pick&&<div className="mv-pl-pickline"><Hammer size={15}/><span><b>In the build slot{pick.override?' · launched early':''}{pick.source==='owner-chat'?' · said in chat':''}.</b> {pick.source==='owner-chat'?'You said in chat':'Your pick'}{pick.pickedAt?` on ${day(pick.pickedAt)}`:''}: “{pick.reason}”{pick.source==='owner-chat'?' (recorded by Claude)':''}</span></div>}
      </div>
    </div>
    <PanelTiles key={item.id} start={v?.kalodata?.rawVideos?.length?'numbers':null} tiles={tiles}/>
    <p className="mv-small mv-pl-foot"><Flag size={13}/>This page reads saved records. It moves only when you record a choice here or an agent records evidence.</p>
    {building&&item.readyToBuild&&<BuildSheet item={item} pipeline={pipeline} workspace={data.workspace} onClose={()=>{setBuilding(false);if(route?.params?.build)go(`product/${item.id}`);}} notify={notify}/>}
    {early&&canLaunchEarly(item,lead)&&<BuildSheet early open={openNow} item={item} pipeline={pipeline} workspace={data.workspace} onClose={()=>setEarly(false)} notify={notify}/>}
    {editor&&product&&market&&<Modal wide title={`Evidence record · ${product.name}`} onClose={()=>setEditor(false)}><div className="mv-legacy"><ProductWorkspace key={product.id} product={product} data={data} initialMarketId={market.id} onBack={()=>setEditor(false)} onSave={notify} openDoc={openDoc}/></div></Modal>}
  </section>;
}
