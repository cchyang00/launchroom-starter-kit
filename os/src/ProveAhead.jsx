import React,{useRef,useState} from 'react';
import {Check,X,Lock,FileText,ArrowUpRight,Sparkles,Hourglass,CircleAlert,Bookmark,Ban} from 'lucide-react';
import {LeadImage} from './kit.jsx';
import {WhoChip} from './Pipeline.jsx';
import {EyeTestDecision} from './ProductBoard.jsx';
import {aheadOf,waitReasons,LINE_WORDS} from './proveAhead.mjs';
import {saveBlockReason} from './statsPanel.mjs';
import {lineLeadState} from './pipeline.mjs';
import './proveAhead.css';

// Researched ahead (owner, Oct 3: "im on prove it and i literally dont see a
// spot to run those checks"). Cards still waiting for the owner's Save can
// already carry a passed Buyers check and a Prove it file. They show on Prove
// it and on their own page with what is ready and one-tap Save, Pass and Reject
// (the same owner-only write and 5-second Undo as the eye test). Nothing here
// records a check: the prove file is a write-up the manager records after Save.

const LINE_NAMES = {P1:'Room on Meta',P2:'Same item',P3:'Delivery',P4:'Money line',P5:'Claims backed'};
const lineTone = state => state==='passed'?'is-passed':state==='failed'?'is-failed':['written','drafted'].includes(state)?'is-written':'is-open';

/** The ready strip: Product checks, Buyers, then P1-P5 from the prove file. */
export function AheadStrip({ahead,compact=false}) {
  const b = ahead.buyers;
  return <ul className={`mv-pa-strip ${compact?'is-compact':''}`} aria-label="What is ready">
    <li className={ahead.find===ahead.findTotal?'is-passed':'is-open'} title="Product checks F1-F6"><i>F1–F6</i>{ahead.find===ahead.findTotal?<Check size={12} strokeWidth={3}/>:null}{ahead.find}/{ahead.findTotal}</li>
    <li className={b.state==='passed'?'is-passed':b.state==='failed'?'is-failed':'is-open'} title="Buyers A1-A3: quotes, avatars, the angle gap"><i>Buyers</i>{b.state==='passed'?<Check size={12} strokeWidth={3}/>:null}{b.passed}/{b.total}{!compact&&b.quotes!=null?` · ${b.quotes} quotes`:''}{!compact&&b.avatars!=null?` · ${b.avatars} avatars`:''}</li>
    {ahead.lines.map(line=><li key={line.id} className={lineTone(line.state)} title={`${line.id} ${LINE_NAMES[line.id]}: ${line.result||LINE_WORDS[line.state]}${line.why?` — ${line.why}`:''}`}>
      <i>{line.id}</i>{compact?LINE_WORDS[line.state]:<>{LINE_NAMES[line.id]}: <b>{line.id==='P1'&&line.result?line.result:LINE_WORDS[line.state]}</b></>}
    </li>)}
  </ul>;
}

/** One tap each (S, P, R words); Save stays closed until F1 Statistics passes, as on the eye test. */
function QuickDecide({lead,recordDecision}) {
  const [busy,setBusy] = useState(null),[error,setError] = useState('');
  const busyRef = useRef(false);
  const block = saveBlockReason(lead.candidate);
  async function decide(made) {
    if (busyRef.current||(made==='saved'&&block)) return;
    busyRef.current = true;setBusy(made);setError('');
    try {await recordDecision(lead,made,{});}
    catch (e) {setError(e.code==='OWNER_DECISION_ONLY'?'Only you can decide this, from your own browser.':e.code==='STATS_MISSING'?block||e.message:e.message);}
    finally {busyRef.current = false;setBusy(null);}
  }
  return <div className="mv-pa-decide">
    <div className="mv-pa-buttons" role="group" aria-label={`Your eye test for ${lead.id}: one tap records it`}>
      <button type="button" className="mv-btn sm accent" disabled={Boolean(block)||Boolean(busy)} title={block||'Save: Prove it starts and the work done ahead is recorded'} onClick={()=>decide('saved')}>{block?<Lock size={13}/>:<Bookmark size={13}/>}{busy==='saved'?'Saving…':'Save'}</button>
      <button type="button" className="mv-btn sm" disabled={Boolean(busy)} onClick={()=>decide('passed')}><X size={13}/>{busy==='passed'?'Saving…':'Pass'}</button>
      <button type="button" className="mv-btn sm ghost" disabled={Boolean(busy)} onClick={()=>decide('rejected')}><Ban size={13}/>{busy==='rejected'?'Saving…':'Reject'}</button>
    </div>
    {block&&<p className="mv-pa-block"><Lock size={12}/>{block}</p>}
    {error&&<div className="mv-error" role="alert">{error}</div>}
  </div>;
}

/** Prove it page: every unsaved card with work done ahead, each with Save right there. */
export function AheadList({pipeline,leads,proveAhead,recordDecision,go,openDoc}) {
  const cards = proveAhead?.cards||{};
  const byId = new Map((leads||[]).map(lead=>[lead.id,lead]));
  const rows = (pipeline?.active||[]).map(item=>{const lead=byId.get(item.leadId);const prove=cards[item.leadId]||null;return {item,lead,prove,ahead:lead?aheadOf(item,lead.candidate,prove):null};}).filter(row=>row.ahead);
  if (!rows.length) return null;
  return <section className="mv-card mv-pa" aria-label="Researched ahead, waiting for your Save">
    <div className="mv-panel-title"><h2 className="mv-h3"><Sparkles size={15}/>Researched ahead · waiting for your Save <span className="mv-pa-count">{rows.length}</span></h2></div>
    <p className="mv-small mv-pa-intro">Buyers and Prove it were done ahead for these. Save starts Prove it here, and the manager records the work already written on its next pass. Pass or Reject takes it off the line. Each tap has a 5-second Undo.</p>
    <ul className="mv-pa-list">{rows.map(({item,lead,prove,ahead})=><li key={item.id} className="mv-pa-row">
      <button type="button" className="mv-pa-name" onClick={()=>go(`product/${item.id}`)} title={`Open ${item.id}'s page`}>
        <span className="mv-pa-thumb">{item.image?<LeadImage lead={item} size={52}/>:<span className="mv-pl-thumb-id">{item.id}</span>}</span>
        <span><strong>{item.name}</strong><small>{item.id}{item.roundId?` · ${item.roundId}`:''} · {ahead.p1?`P1 ${ahead.p1.state==='passed'?'passes':ahead.p1.state==='failed'?'fails':'open'}`:'no prove file yet'}</small></span>
      </button>
      <AheadStrip ahead={ahead} compact/>
      <div className="mv-pa-side">
        {lead&&lineLeadState(lead)!=='failed'&&<QuickDecide lead={{...lead,state:lineLeadState(lead)}} recordDecision={recordDecision}/>}
        {prove?.path&&<button type="button" className="mv-link" onClick={()=>openDoc(prove.path)}><FileText size={12}/>The prove file</button>}
      </div>
    </li>)}</ul>
  </section>;
}

/** Product page: what was done ahead, the eye test right there, and what goes in after the Save. */
export function AheadPanel({ahead,lead,recordDecision,openDoc}) {
  return <section className="mv-pl-yours mv-pa-panel" aria-label="Researched ahead, waiting for your Save">
    <div className="mv-pl-yours-head"><span className="mv-pl-yours-mark"><Sparkles size={17}/></span><div><span className="mv-eyebrow">Your move · researched ahead</span><h2>Waiting for your Save</h2>
      <p>Buyers{ahead.lines.some(line=>line.state!=='none')?' and Prove it were':' was'} done ahead. Save starts Prove it; the work already written goes in on the manager's next pass. Pass or Reject takes it off the line.</p></div></div>
    <AheadStrip ahead={ahead}/>
    {ahead.pendingWrites.length>0&&<p className="mv-pa-after"><Hourglass size={13}/>After your Save: {ahead.pendingWrites.join(', ')} {ahead.pendingWrites.length===1?'is':'are'} recorded from the prove file{ahead.observed?` (written ${ahead.observed})`:''}. {ahead.file&&<button type="button" className="mv-link" onClick={()=>openDoc(ahead.file)}><FileText size={12}/>Read it<ArrowUpRight size={11}/></button>}</p>}
    <EyeTestDecision lead={lead} recordDecision={recordDecision}/>
  </section>;
}

/** Why a check can't move, in plain words, with the action and whose it is. Never a silent empty state. */
export function WaitReasons({reasons,team}) {
  if (!reasons.length) return null;
  return <section className="mv-card mv-pad mv-pa-why" aria-label="Why it waits">
    <div className="mv-panel-title"><h2 className="mv-h3"><CircleAlert size={15}/>Why it waits</h2><span className="mv-small">from the saved records and the prove file</span></div>
    <ul>{reasons.map(reason=><li key={reason.id}>
      <span className="mv-pa-check">{reason.check}</span>
      <span className="mv-pa-text"><strong>{reason.text}</strong><small><WhoChip who={reason.who} team={team} size={16}/>{reason.action}</small></span>
    </li>)}</ul>
  </section>;
}

export {aheadOf,waitReasons};
