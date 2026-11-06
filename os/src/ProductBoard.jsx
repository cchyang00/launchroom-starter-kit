import React,{useContext,useEffect,useMemo,useRef,useState} from 'react';
import {Heart,Clock3,ThumbsDown,ChevronLeft,ChevronRight,ArrowUpRight,Search,LayoutGrid,KanbanSquare,FileText,ExternalLink,Sparkles,Check,X,Route,CircleHelp,BookOpen,Lock,MessageSquareText,Undo2} from 'lucide-react';
import {LEAD_STATES,BOARD_COLUMNS} from './workflowView.mjs';
import {FIND_CHECK_IDS,PREFLIGHT_CHECK_IDS,UPFRONT_CHECK_IDS,CHECK_LABELS,CHECKS_DOC,checkView,demandNumbers,namedAudiences,findReady} from './researchView.mjs';
import {lineLeadState} from './pipeline.mjs';
import {headingAnchor} from './documentPaths.mjs';
import {ScreenCheckEditor} from './ResearchBatch.jsx';
import {Sheet,Chip,LeadImage,LeadMediaShowcase,FourGateSnapshot,AgentPacketBar,leadVideos,leadPhotos} from './kit.jsx';
import {CardMedia,Metric,useHoverPlay} from './cards.jsx';
import {PipelineContext} from './Pipeline.jsx';
import {trendInDoubt} from './productView.mjs';
import {StatsPanel,StatsMini,ValidationOverview} from './StatsPanel.jsx';
import {saveBlockReason,validationSnapshot,compactNumber} from './statsPanel.mjs';
import './eyeTest.css';
import {REASON_TAGS,REASON_TAG_LIMIT,OWNER_NOTE_MAX,toggleReasonTag,decisionOf,ownerReasonLine,saidOf} from './eyeTest.mjs';

const POSITIVE_TAGS = new Set(['Love it','Great angle']);

export const GATE_LABELS = {demand:'Demand',community:'Creators & buyers',competition:'Room on Meta',sourcing:'Exact source',fit:'Fit & buyer reasons'};
export const SCREEN_LABELS = CHECK_LABELS;
const PILL_WORD = {pass:'Pass',fail:'Fail',unknown:'Unknown'};
const PILL_ICON = {pass:Check,fail:X,unknown:CircleHelp};

/**
 * The five Find checks (workflow/CHECKS.md F1-F5) as small labelled pills,
 * read from the saved card only. Hover shows the one-line reason; a tap shows
 * it under the pills. `compact` is the Find board card; the full version adds
 * F1's numbers, F4's audiences and the "How we check" link.
 */
export function FindChecks({candidate,openDoc,compact=false,withStats=true}) {
  const [open,setOpen] = useState(null);
  const [pills,setPills] = useState(!compact);
  const checks = candidate?.screen?.checks||{};
  const checkIds = UPFRONT_CHECK_IDS||FIND_CHECK_IDS;
  const views = checkIds.map(id=>checkView(id,checks[id]));
  const passed = views.filter(view=>view.state==='pass').length;
  const numbers = demandNumbers(checks.provenDemand);
  const room = checks.audienceRoom, audiences = namedAudiences(room);
  const shown = open&&views.find(view=>view.id===open);
  return <div className={`mv-fc${compact?' is-compact':''}`}>
    {!compact&&<div className="mv-fc-head"><strong>Upfront Product, Buyers & Prove-It Checks <span className="mv-small">{passed}/{checkIds.length} pass</span></strong>{openDoc&&<button type="button" className="mv-link" onClick={()=>openDoc(CHECKS_DOC)}><BookOpen size={13}/>How we check</button>}</div>}
    {compact&&<button type="button" className="mv-cd-checkbar" aria-expanded={pills} title="Tap to see each check" onClick={()=>{setPills(value=>!value);setOpen(null);}}>
      <small>Checks</small>
      <span>{views.map(view=><i key={view.id} className={`is-${view.state}`} title={`${view.label}: ${PILL_WORD[view.state]}`}/>)}</span>
      <b>{passed}/{checkIds.length}</b>
    </button>}
    {pills&&<div className="mv-fc-pills" role="group" aria-label={`Upfront checks: ${passed} of ${checkIds.length} pass`}>
      {views.map(view=>{const Icon=PILL_ICON[view.state];return <button type="button" key={view.id} className={`mv-fc-pill is-${view.state}`} aria-pressed={open===view.id} title={`${view.label}: ${PILL_WORD[view.state]}${view.reason?` — ${view.reason}`:''}${view.rule?` ${view.rule}`:''}`} aria-label={`${view.label}: ${PILL_WORD[view.state]}`} onClick={()=>setOpen(open===view.id?null:view.id)}><Icon size={11} strokeWidth={2.6}/><span>{compact?view.short:view.label}</span></button>;})}
    </div>}
    {compact&&withStats&&<StatsMini candidate={candidate}/>}
    {!compact&&numbers&&<p className="mv-fc-nums" title={`Meta Ad Library${checks.provenDemand?.country?` · ${checks.provenDemand.country}`:''}${checks.provenDemand?.observedAt?` · ${checks.provenDemand.observedAt}`:''}. ${views[0].rule}`}><b>{compact?'':'Demand: '}</b>{numbers}</p>}
    {!compact&&<p className="mv-fc-rule">Proven demand {views[0].rule.charAt(0).toLowerCase()+views[0].rule.slice(1)}</p>}
    {shown&&<p className="mv-fc-reason" role="status"><b>{shown.label} · {PILL_WORD[shown.state]}</b>{shown.reason?` — ${shown.reason}`:''}{shown.observedAt&&!compact?<span className="mv-small"> ({shown.observedAt})</span>:null}{shown.rule&&compact?<span className="mv-fc-rule"> {shown.rule}</span>:null}</p>}
    {!compact&&(room?.mainAudience||audiences.length>0)&&<div className="mv-fc-aud">
      {room?.mainAudience&&<p><span className="mv-fc-tag">Sold to now</span>{room.mainAudience}</p>}
      {audiences.length>0&&<ul>{audiences.map((a,i)=><li key={`${a.who}-${i}`}><strong>{a.who}</strong> · {a.problem}<span className="mv-small"> — {a.why}</span></li>)}</ul>}
      <p className="mv-small">Guesses to test with forum research in Prove it.</p>
    </div>}
  </div>;
}
const DECISIONS = [
  ['saved','Save to build','Ready to build',Heart],
  ['passed','Pass for now','Maybe later',Clock3],
  ['rejected','Reject','Not a fit',ThumbsDown],
];
const stateTone = state => state==='checking'?'':state==='waiting'?'owner':['saved','ready'].includes(state)?'active':state==='reviewed'?'done':state==='rejected'||state==='killed'||state==='failed'?'bad':'muted';

export function StateChip({state}) {
  return <Chip tone={stateTone(state)}>{LEAD_STATES[state]?.label||state}</Chip>;
}

export function GateBars({gates}) {
  return <div className="mv-gates" title="Deep verification: demand · creators & buyers · Room on Meta · exact source · fit">
    {gates.map(([id,status])=><span key={id} className={`mv-gate is-${status}`} title={`${GATE_LABELS[id]}: ${status}`}/>)}
  </div>;
}

export function LeadCard({lead,onOpen,onDecide}) {
  const quick = lead.state==='waiting'||lead.state==='parked'||lead.state==='passed';
  const videos = leadVideos(lead), photos = leadPhotos(lead);
  const [playing,hover] = useHoverPlay();
  const v = useMemo(()=>validationSnapshot(lead.candidate),[lead.candidate]);
  const metaCount = v?.meta?.liveAds??v?.meta?.advertisers??null;
  const pipeline = useContext(PipelineContext);
  const doubt = trendInDoubt(lead,pipeline?.items);
  return <article className={`mv-lead ${lead.state==='waiting'?'is-waiting':''}`} {...hover}>
    <div className="mv-lead-top">
      <CardMedia image={photos[0]} video={videos[0]} playing={playing} alt={lead.imageAlt||lead.name} placeholder={lead.id} ratio="4 / 5">
        <button type="button" className="mv-cd-lead-hit" onClick={()=>onOpen(lead)} aria-label={`Open ${lead.id} ${lead.name}`}/>
        <span className="mv-lead-state" style={{zIndex:2,pointerEvents:'none'}}><StateChip state={lead.state}/></span>
        <span className="mv-lead-id" style={{zIndex:2,pointerEvents:'none'}}>{lead.id}</span>
      </CardMedia>
    {quick&&onDecide&&<div className="mv-lead-quick">
      <button className="is-save" disabled={Boolean(saveBlockReason(lead.candidate))} title={saveBlockReason(lead.candidate)||'Save to Ready to Build (one tap; Undo for 5 seconds)'} onClick={()=>onDecide(lead,'saved')}><Heart size={13}/><span>Save</span></button>
      <button onClick={()=>onDecide(lead,'passed')}><Clock3 size={13}/><span>Pass</span></button>
      <button onClick={()=>onDecide(lead,'rejected')}><X size={13}/><span>Reject</span></button>
    </div>}</div>
    <div className="mv-lead-body">
      <h3 onClick={()=>onOpen(lead)} style={{cursor:'pointer'}}>{lead.name}</h3>
      {v&&<div className="mv-cd-metrics">
        <Metric label="Sold" value={Number.isFinite(v.kalodata?.units)?compactNumber(v.kalodata.units):''} title={v.kalodata?.unitsText}/>
        <Metric label={doubt?'Trend (unverified)':'Trend'} value={Number.isFinite(v.changePercent)?`${v.changePercent>0?'+':''}${v.changePercent}%`:''} tone={doubt?'':v.direction==='rising'?'good':v.direction==='falling'?'bad':''} title={doubt?'The same curve is saved on another product':undefined}/>
        <Metric label="Meta ads" value={metaCount} tone={v.meta?.tone==='good'?'good':v.meta?.tone==='bad'?'bad':v.meta?.tone==='ok'?'ok':''} title={v.meta?.badge}/>
        <Metric label="Sell" value={v.money?.sell} title={v.money?.landed?`Landed cost ${v.money.landed}`:undefined}/>
      </div>}
      <FindChecks candidate={lead.candidate} compact withStats={false}/>
      <div className="mv-cd-gaterow"><small>Deep checks</small><GateBars gates={lead.gates}/></div>
      <div className="mv-lead-foot"><span>{lead.batchLabel?lead.batchLabel.replace(/^Current /,''):'Research record'}</span><span style={{display:'flex',gap:4,alignItems:'center'}}>{videos.length>0&&<Chip tone="active">🎬 {videos.length} MP4</Chip>}{lead.current&&<Chip tone="warn">New</Chip>}</span></div>
    </div>
  </article>;
}

function MiniLead({lead,onOpen}) {
  return <button className="mv-mini-lead" onClick={()=>onOpen(lead)}>
    <LeadImage lead={lead} size={52}/>
    <span><strong>{lead.name}</strong><small>{lead.id} · {LEAD_STATES[lead.state].label}</small></span>
  </button>;
}

/**
 * The owner's eye test (Oct 3: one tap decides). Save for checks, Pass for now
 * or Reject record at once; 0-2 quick-reason chips and a note (collapsed) are
 * optional and ride along with the tap. The LeadSheet and the product page both
 * use it; it is the only research write the screens make. `shortcuts` turns on
 * S, P and R. Undo lives in the app's toast for 5 seconds.
 */
export function EyeTestDecision({lead,recordDecision,shortcuts=false,onSaved}) {
  // The owner's rule (Oct 2): Save stays closed, with the plain reason, until F1 Statistics passes. Pass and Reject always work.
  const saveBlock = saveBlockReason(lead.candidate);
  const screen = lead.candidate?.screen;
  const recorded = screen&&screen.ownerDecision&&screen.ownerDecision!=='unreviewed'?screen.ownerDecision:null;
  const [tags,setTags] = useState([]),[note,setNote] = useState(''),[busy,setBusy] = useState(null),[error,setError] = useState('');
  useEffect(()=>{const was=decisionOf(screen);setTags(was.reasonTags.filter(tag=>REASON_TAGS.includes(tag)));setNote(was.ownerReason);setError('');},[lead.id]);
  const busyRef = useRef(false);
  async function decide(made) {
    if (busyRef.current||(made==='saved'&&saveBlock)) return;
    busyRef.current = true;setBusy(made);setError('');
    const wasWaiting = lead.state==='waiting';
    try {await recordDecision(lead,made,{tags,note});onSaved?.(made,wasWaiting);}
    catch (e) {setError(e.message);}
    finally {busyRef.current = false;setBusy(null);}
  }
  const decideRef = useRef(decide); decideRef.current = decide;
  useEffect(()=>{
    if (!shortcuts) return undefined;
    const onKey = event => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey) return;
      const made = {s:'saved',p:'passed',r:'rejected'}[event.key];
      if (made) {event.preventDefault();decideRef.current(made);}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[shortcuts]);
  const said = ownerReasonLine(screen);
  const chat = saidOf(screen);
  return <div className="mv-et">
    {recorded&&chat?<div className="mv-et-said" role="note"><MessageSquareText size={15}/><div><b>Said in chat</b><span>“{chat.quote}”</span><small>Recorded by Claude from your words{chat.at?` on ${new Date(chat.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}. Tap a choice below to change it.</small></div><button type="button" className="mv-btn sm" disabled={Boolean(busy)} onClick={async()=>{setBusy('undo');setError('');try{await recordDecision(lead,'undo-said');}catch(e){setError(e.message);}finally{setBusy(null);}}}><Undo2 size={13}/>{busy==='undo'?'Undoing…':'Undo'}</button></div>
    :recorded&&(said?<p className="mv-quote">“{said}”</p>:<p className="mv-small mv-et-noreason">Recorded without a reason.</p>)}
    <div className="mv-decide" role="group" aria-label="Your eye test: one tap records it">
      {DECISIONS.map(([id,label,hint,Icon])=>{const off=id==='saved'&&Boolean(saveBlock);return <button key={id} type="button" className={`is-${id}`} disabled={off||Boolean(busy)} title={off?saveBlock:undefined} aria-describedby={off?`mv-decide-why-${lead.id}`:undefined} aria-pressed={recorded===id} onClick={()=>decide(id)}>{off?<Lock size={18}/>:<Icon size={18}/>}{busy===id?'Saving…':label}<small>{off?'Needs statistics':hint}</small></button>;})}
    </div>
    {saveBlock&&recorded!=='saved'&&<p className="mv-decide-blocked" id={`mv-decide-why-${lead.id}`} role="note"><Lock size={13}/><span>{saveBlock} Pass and Reject still work.</span></p>}
    {error&&<div className="mv-error" role="alert">{error}</div>}
    <div className="mv-et-why">
      <p className="mv-et-label">Why? <span>Optional · up to {REASON_TAG_LIMIT}, then tap a choice above</span></p>
      <div className="mv-et-chips" role="group" aria-label="Quick reasons, optional">
        {REASON_TAGS.map(tag=><button key={tag} type="button" className={`mv-et-chip${POSITIVE_TAGS.has(tag)?' is-plus':''}`} aria-pressed={tags.includes(tag)} onClick={()=>setTags(toggleReasonTag(tags,tag))}>{tags.includes(tag)&&<Check size={13}/>}{tag}</button>)}
      </div>
      <details className="mv-et-note" open={Boolean(decisionOf(screen).ownerReason)}><summary>{decisionOf(screen).ownerReason?'Your note':'Add a note'}</summary>
        <textarea className="mv-textarea" rows={2} maxLength={OWNER_NOTE_MAX} value={note} onChange={event=>setNote(event.target.value)} aria-label="A note about your choice, optional" placeholder="Anything else you noticed (optional)"/>
      </details>
    </div>
  </div>;
}

const sourceLink = (source,openDoc,label='Source') => !source?null:/^https?:/.test(source)?<a className="mv-link" href={source} target="_blank" rel="noreferrer" title={source}><ArrowUpRight size={12}/>{label}</a>:<button onClick={()=>openDoc(source)} title={source}>{label}</button>;

/** A card's check rows with their evidence (default: source & profit). Read-only unless `editable` (the LeadSheet's Record buttons). */
export function ScreenChecks({lead,research,setResearch,openDoc,editable=false,ids=PREFLIGHT_CHECK_IDS}) {
  const [editing,setEditing] = useState(null);
  const candidate = lead.candidate, screen = candidate?.screen;
  return <>
    <div className="mv-segbar">{lead.screen.filter(([id])=>ids.includes(id)).map(([id,status])=><span key={id} className={`is-${status}`} title={`${SCREEN_LABELS[id]}: ${status}`}/>)}</div>
    <div className="mv-check-list">{ids.map(id=>{const check=screen?.checks?.[id];const status=check?.status||'pending';return <div className="mv-check-row" key={id}>
      <span className={`mv-status-dot is-${status}`}/>
      <div><strong>{SCREEN_LABELS[id]}{!editable&&<span className="mv-small"> · {status}{check?.observedAt?` · ${check.observedAt}`:''}</span>}</strong>{check?.note&&<p>{check.note}</p>}</div>
      {editable&&candidate?<button onClick={()=>setEditing(editing===id?null:id)}>{editing===id?'Close':'Record'}</button>:sourceLink(check?.source,openDoc)}
    </div>;})}</div>
    {editable&&editing&&candidate&&research&&<div className="mv-legacy" style={{marginTop:10}}><ScreenCheckEditor key={`${lead.id}-${editing}`} candidate={candidate} checkId={editing} batch={research} onChanged={setResearch} onClose={()=>setEditing(null)}/></div>}
  </>;
}

/** The card's five deep checks, read-only with their sources. */
export function DeepChecks({lead,openDoc}) {
  const candidate = lead.candidate;
  return <div className="mv-check-list">{lead.gates.map(([id,status])=>{const gate=candidate?.gates?.[id];return <div className="mv-check-row" key={id}>
    <span className={`mv-status-dot is-${status}`}/>
    <div><strong>{GATE_LABELS[id]} <span className="mv-small">· {status==='historical'?'historical, screen open':status}{gate?.observedAt?` · ${gate.observedAt}`:''}</span></strong>{gate?.note&&<p>{gate.note}</p>}</div>
    {sourceLink(gate?.source,openDoc)}
  </div>;})}</div>;
}

export function LeadSheet({lead,list=[],onNavigate,onClose,recordDecision,research,setResearch,openDoc,go}) {
  const index = list.findIndex(item=>item.id===lead.id);
  const prev = index>0?list[index-1]:null, next = index>=0&&index<list.length-1?list[index+1]:null;
  const candidate = lead.candidate, screen = candidate?.screen;
  const evidencePath = lead.sourcePath?(lead.heading?`${lead.sourcePath}#${headingAnchor(lead.heading)}`:lead.sourcePath):'';
  useEffect(()=>{
    const onKey = event => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      if (event.key==='ArrowRight'&&next) onNavigate(next);
      else if (event.key==='ArrowLeft'&&prev) onNavigate(prev);
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[next,prev,onNavigate]);
  const recorded = screen&&screen.ownerDecision!=='unreviewed'?screen.ownerDecision:null;
  const supportedPreflight = lead.screen.filter(([id,status])=>PREFLIGHT_CHECK_IDS.includes(id)&&status==='supported').length;
  return <Sheet wide title={`${lead.id} · ${lead.name}`} subtitle={index>=0?`${index+1} of ${list.length} · use ← → to move`:lead.batchLabel} onClose={onClose}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
      <div className="mv-lead-title" style={{margin:0}}><h2>{lead.name}</h2><StateChip state={lead.state}/></div>
      <div style={{display:'flex',gap:6}}>
        {prev&&<button className="mv-btn sm" aria-label="Previous product" onClick={()=>onNavigate(prev)}><ChevronLeft size={16}/>Prev</button>}
        {next&&<button className="mv-btn sm" aria-label="Next product" onClick={()=>onNavigate(next)}>Next<ChevronRight size={16}/></button>}
      </div>
    </div>
    <LeadMediaShowcase lead={lead}/>
    <AgentPacketBar lead={lead} evidencePath={evidencePath} openDoc={openDoc}/>
    <FourGateSnapshot candidate={candidate}/>
    <div className="mv-hello-chips">
      {candidate?.country&&<Chip>{candidate.country}</Chip>}
      {lead.batchLabel&&<Chip tone="muted">{lead.batchLabel}</Chip>}
      {go&&<button className="mv-link" onClick={()=>go(`product/${lead.id}`)}><Route size={13}/>Its line</button>}
      {evidencePath&&<button className="mv-link" onClick={()=>openDoc(evidencePath)}><FileText size={13}/>Evidence record</button>}
      {lead.externalUrl&&<a className="mv-link" href={lead.externalUrl} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Original listing</a>}
    </div>

    <ValidationOverview key={`vo-${lead.id}`} candidate={candidate}/>
    <StatsPanel key={`sp-${lead.id}`} candidate={candidate} openDoc={openDoc} evidencePath={evidencePath}/>

    <section className="mv-block">
      <h3 className="mv-h3">Your eye test {recorded&&<Chip tone={recorded==='saved'?'done':recorded==='rejected'?'bad':'muted'}>Recorded: {recorded}</Chip>}</h3>
      <EyeTestDecision lead={lead} recordDecision={recordDecision} shortcuts onSaved={(made,wasWaiting)=>{if(next&&wasWaiting)onNavigate(next);}}/>
      <div className="mv-kbd-hint"><span><kbd className="mv-kbd">S</kbd>save</span><span><kbd className="mv-kbd">P</kbd>pass</span><span><kbd className="mv-kbd">R</kbd>reject</span><span><kbd className="mv-kbd">←</kbd><kbd className="mv-kbd">→</kbd>next product</span></div>
      {lead.state==='checking'&&<p className="mv-small"><b>Still being checked:</b> this card reaches your eye test when all upfront checks pass.</p>}
      <p className="mv-small">All 9 upfront checks & 5 deep gates are verified. Saving sends this product straight to Ready to Build on the Pipeline.</p>
    </section>

    {candidate&&<section className="mv-block">
      <h3 className="mv-h3">Research notes</h3>
      <p className="mv-quote">{candidate.decision}</p>
      {candidate.nextAction&&candidate.nextAction!==candidate.decision&&<p className="mv-small" style={{marginTop:8}}><b>Next:</b> {candidate.nextAction}</p>}
      {candidate.buyer&&<p className="mv-small"><b>Buyer:</b> {candidate.buyer}</p>}
    </section>}

    <section className="mv-block">
      <details className="mv-fc-more"><summary>Evidence for each check (F1–F6), with the full notes</summary>
        <ScreenChecks key={`find-${lead.id}`} lead={lead} research={research} setResearch={setResearch} openDoc={openDoc} editable ids={FIND_CHECK_IDS}/>
      </details>
    </section>

    <section className="mv-block">
      <h3 className="mv-h3">Upfront Source & Margin Verification <span className="mv-small">{supportedPreflight}/{PREFLIGHT_CHECK_IDS.length} supported</span></h3>
      <ScreenChecks key={lead.id} lead={lead} research={research} setResearch={setResearch} openDoc={openDoc} editable/>
    </section>

    <section className="mv-block">
      <h3 className="mv-h3">Deep verification</h3>
      <DeepChecks lead={lead} openDoc={openDoc}/>
    </section>
    {candidate?.references?.length>0&&<section className="mv-block"><h3 className="mv-h3">Sources</h3><div className="mv-refs">{candidate.references.map(ref=>/^https?:/.test(ref)?<a key={ref} className="mv-ref" href={ref} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{new URL(ref).hostname}</span></a>:<button key={ref} className="mv-ref" onClick={()=>openDoc(ref)}><FileText size={12}/><span>{ref.split('/').pop()}</span></button>)}</div></section>}
  </Sheet>;
}

const FILTERS = [
  ['all','All',()=>true],
  ['waiting','Waiting for you',lead=>lead.state==='waiting'],
  ['videos','🎬 With video',lead=>leadVideos(lead).length>0],
  ['saved','Saved',lead=>['saved','ready','reviewed'].includes(lead.state)],
  ['aside','Set aside',lead=>['parked','passed','rejected','killed','failed'].includes(lead.state)],
  ['images','With photos',lead=>Boolean(lead.image)],
];

export function ProductBoard({leads:saved,research,setResearch,recordDecision,openDoc,route,go}) {
  // A saved card an agent parked (decision PARK or KILL) shows as parked, the same as its line (lineLeadState).
  // The owner's rule: a card reaches the eye test only when all five Find checks pass; the rest wait in "Still being checked".
  const leads = useMemo(()=>saved.map(lead=>{const state=lineLeadState(lead);return {...lead,state:state==='waiting'&&!findReady(lead.candidate)?'checking':state};}),[saved]);
  const matches = lead => `${lead.id} ${lead.name}`.toLowerCase().includes(query.trim().toLowerCase());
  const [filterChoice,setFilter] = useState(null);
  const filter = filterChoice ?? (leads.some(lead=>lead.state==='waiting')?'waiting':'images');
  const [mode,setMode] = useState('grid'),[query,setQuery] = useState(''),[limit,setLimit] = useState(24);
  const test = FILTERS.find(item=>item[0]===filter)[2];
  const visible = useMemo(()=>leads.filter(lead=>lead.state!=='checking'&&test(lead)&&matches(lead)),[leads,filter,query]);
  const checking = useMemo(()=>leads.filter(lead=>lead.state==='checking'&&matches(lead)),[leads,query]);
  const openId = route?.params?.lead;
  const open = openId?leads.find(lead=>lead.id===openId):null;
  const sheetList = open&&visible.some(lead=>lead.id===open.id)?visible:leads;
  const openLead = (lead,decision=null) => go(`find?lead=${lead.id}${decision?`&decide=${decision}`:''}`);
  const close = () => go('find');
  // One tap on a card's Save, Pass or Reject records it (owner, Oct 3); the app's toast offers Undo.
  const [cardError,setCardError] = useState('');
  const quickDecide = (lead,decision) => {setCardError('');recordDecision(lead,decision).catch(e=>setCardError(`${lead.id}: ${e.message}`));};
  return <section>
    <div className="mv-board-bar">
      <div className="mv-filter" role="group" aria-label="Filter products">{FILTERS.map(([id,label,fn])=><button key={id} className={id==='waiting'?'is-owner':''} aria-pressed={filter===id} onClick={()=>{setFilter(id);setLimit(24);}}>{label}<b>{leads.filter(lead=>lead.state!=='checking'&&fn(lead)).length}</b></button>)}</div>
      <label className="mv-search"><Search size={14}/><input className="mv-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find product or ID" aria-label="Find product or ID"/></label>
      <div className="mv-seg" role="group" aria-label="Board layout"><button aria-pressed={mode==='grid'} onClick={()=>setMode('grid')}><LayoutGrid size={14}/>Cards</button><button aria-pressed={mode==='columns'} onClick={()=>setMode('columns')}><KanbanSquare size={14}/>Columns</button></div>
    </div>
    {cardError&&<div className="mv-error" role="alert">{cardError}</div>}
    {mode==='grid'?<>
      {!visible.length?<div className="mv-card mv-empty"><Sparkles size={26}/><strong>{filter==='waiting'?'Nothing is waiting for your eye test.':'No products match.'}</strong><span className="mv-small">{filter==='waiting'?'New cards appear here when research curates the next batch.':'Try another filter or search.'}</span>{filter!=='all'&&<button className="mv-btn sm" onClick={()=>setFilter('all')}>Show all products</button>}</div>
      :<div className="mv-lead-grid">{visible.slice(0,limit).map(lead=><LeadCard key={lead.id} lead={lead} onOpen={openLead} onDecide={quickDecide}/>)}</div>}
      {visible.length>limit&&<div className="mv-show-more"><button className="mv-btn" onClick={()=>setLimit(visible.length)}>Show all {visible.length}</button></div>}
    </>:<div className="mv-kanban">{BOARD_COLUMNS.map(column=>{const items=visible.filter(lead=>LEAD_STATES[lead.state].column===column.id);return <div key={column.id} className="mv-col">
      <div className="mv-col-head"><div><strong>{column.id==='waiting'&&<span className="mv-owner-dot"/>}{column.title}</strong><small>{column.hint}</small></div><b>{items.length}</b></div>
      {items.length?items.slice(0,column.id==='aside'?limit:60).map(lead=><MiniLead key={lead.id} lead={lead} onOpen={openLead}/>):<div className="mv-col-empty">{column.id==='reviewed'?'0 of 5 reviews complete':'Empty'}</div>}
      {column.id==='aside'&&items.length>limit&&<button className="mv-btn sm ghost" onClick={()=>setLimit(items.length)}>Show {items.length-limit} more</button>}
    </div>;})}</div>}
    {checking.length>0&&<details className="mv-fc-checking"><summary>Still being checked <b>{checking.length}</b><span className="mv-small">These reach your eye test when all six checks (F1–F6) pass.</span></summary>
      <div className="mv-lead-grid">{checking.map(lead=><LeadCard key={lead.id} lead={lead} onOpen={openLead}/>)}</div>
    </details>}
    <p className="mv-small" style={{marginTop:14,display:'flex',gap:8,alignItems:'center'}}><Check size={13}/>Cards move only when you record a choice or research records evidence. Each card shows its top number and trend, and pills for the six checks (tap one for its reason); bars show the five deep checks.</p>
    {open&&<LeadSheet lead={open} list={sheetList} onNavigate={lead=>go(`find?lead=${lead.id}`)} onClose={close} recordDecision={recordDecision} research={research} setResearch={setResearch} openDoc={openDoc} go={go}/>}
  </section>;
}
