import React,{useEffect,useState} from 'react';
import {BookOpen,ArrowUpRight,ShieldCheck,Lock,MessageSquareQuote,ScanSearch,BadgeCheck,FlaskConical,CirclePause} from 'lucide-react';
import {api} from './ui.jsx';
import {Chip} from './kit.jsx';
import {CHECKS_PATH,gatesForStep,parseMethodGates} from './issues.mjs';
import {STATUS_LABELS,issueStation} from './issueList.mjs';
import {ISSUE_LIBRARY_SLUG} from './steps.mjs';
import './issues.css';

// The method on screen: the issue list's shared pieces (step 0, owner Oct 3)
// and "The gate for this step" on every step page. Everything here is
// read-only: the issue files, the owner's picks and workflow/CHECKS.md are
// the records. The Issues page itself is src/IssuesPage.jsx.

let issuesRoute = 'unknown';
/** GET /api/issues, refreshed every 30 seconds; an older server without it shows a restart line. */
export function useIssues() {
  const [state,setState] = useState({data:null,error:'',missing:false});
  useEffect(()=>{
    let live = true;
    async function load() {
      if (issuesRoute==='missing') { if (live) setState({data:null,error:'',missing:true}); return; }
      try { const data = await api('/api/issues'); issuesRoute = 'ok'; if (live) setState({data,error:'',missing:false}); }
      catch (error) { if (error.status===404||error.status===405) issuesRoute = 'missing'; if (live) setState(previous=>({data:previous.data,error:issuesRoute==='missing'?'':error.message,missing:issuesRoute==='missing'})); }
    }
    load(); const timer = setInterval(load,30000);
    return ()=>{live = false; clearInterval(timer);};
  },[]);
  return state;
}

export const STATUS_ICONS = {candidate:ScanSearch,verified:BadgeCheck,testing:FlaskConical,parked:CirclePause};
const STATE_WORDS = {passed:'passed',partly:'checked under the older gate, which asked less',open:'open'};

/** The seven I-checks as numbered dots: filled passed, half for an older gate's partial pass, hollow open. */
export function IssueDots({checks=[],size='sm'}) {
  const label = checks.map(check=>`${check.id} ${check.name}: ${STATE_WORDS[check.state]||check.state}`).join('; ');
  return <span className={`mv-il-dots is-${size}`} role="img" aria-label={label||'No checks read'} title={label}>
    {checks.map(check=><i key={check.id} className={`is-${check.state}`}>{check.id.slice(1)}</i>)}
  </span>;
}

/** Candidate, Verified, Testing or Parked, with its icon. */
export function StatusChip({status}) {
  const Icon = STATUS_ICONS[status]||ScanSearch;
  return <span className={`mv-il-status is-${status}`}><Icon size={12}/>{STATUS_LABELS[status]||status}</span>;
}

/**
 * Step 0 as one link (the Pipeline page head, the Buyers step): how many
 * issues, how many the owner is testing. Buyers adds new quotes back to them.
 */
export function IssueLibraryLink({go,note=''}) {
  const {data,missing} = useIssues();
  const station = issueStation(data?.issues||[]);
  return <button type="button" className={`mv-is-lib ${station.owner?'is-owner':''}`} onClick={()=>go?.(ISSUE_LIBRARY_SLUG)} aria-label="Step 0: the issue list">
    <span className="mv-is-lib-mark" aria-hidden="true"><MessageSquareQuote size={15}/></span>
    <span className="mv-is-lib-text"><b>Step 0 · Issues{data?` · ${station.count}`:''}</b><small>{missing||!data?'The issue list: deep, real problems for many avatars':`${station.testing?`Testing ${station.testingSlugs.slice(0,3).join(', ')}`:station.label}${note?` · ${note}`:''}`}</small></span>
    <ArrowUpRight size={14} className="mv-is-lib-go" aria-hidden="true"/>
  </button>;
}

let checksText = null;
/** workflow/CHECKS.md through the document reader, parsed into each step's gate. */
export function useMethodGates() {
  const [state,setState] = useState(()=>({method:checksText?parseMethodGates(checksText):null,error:''}));
  useEffect(()=>{
    let live = true;
    async function load() {
      try { const doc = await api('/api/doc?path='+encodeURIComponent(CHECKS_PATH)); checksText = doc.content; if (live) setState({method:parseMethodGates(doc.content),error:''}); }
      catch (error) { if (live) setState(previous=>({method:previous.method,error:error.message})); }
    }
    load(); const timer = setInterval(load,60000);
    return ()=>{live = false; clearInterval(timer);};
  },[]);
  return state;
}

function GateSection({section,openDoc,showName}) {
  return <div className="mv-is-gsec">
    <div className="mv-is-ghead">
      {showName?<h3 className="mv-is-gname"><i>{section.id}</i>{section.name}</h3>:<span/>}
      <button type="button" className="mv-link" onClick={()=>openDoc(`${CHECKS_PATH}#${section.anchor}`)}><BookOpen size={13}/>How we research it<ArrowUpRight size={12}/></button>
    </div>
    {section.intro&&<p className="mv-small mv-is-gintro">{section.intro}</p>}
    <ol className="mv-is-glist">{section.items.map((item,index)=><li key={index}>
      <span className="mv-is-gid">{item.id||index+1}</span>
      <span className="mv-is-gtext">{item.label&&<b>{item.label}</b>}{item.label&&item.text?' ':''}{item.text}
        {item.children.length>0&&<ul>{item.children.map((child,i)=><li key={i}>{child}</li>)}</ul>}</span>
    </li>)}</ol>
  </div>;
}

/**
 * "The gate for this step" under the step guide card: the gate lines from
 * workflow/CHECKS.md, as plain text. There are no boxes to tick here: gates
 * pass only from saved evidence on each product.
 */
export function StepGate({index,openDoc}) {
  const {method,error} = useMethodGates();
  const sections = gatesForStep(method,index);
  if (!method&&!error) return null;
  if (!sections.length) return error?<p className="mv-small mv-is-note" role="alert">The method could not be read: {error}</p>:null;
  const lines = sections.reduce((sum,section)=>sum+section.items.length,0);
  return <section className="mv-card mv-is-gate-card" aria-label="The gate for this step">
    <div className="mv-is-head">
      <div><span className="mv-eyebrow"><ShieldCheck size={12}/>Step {index+1} · from {CHECKS_PATH}</span><h2 className="mv-h3">The gate for this step</h2>
        <p className="mv-small">All true before the next step starts.</p></div>
      <div className="mv-is-head-side"><Chip tone="muted" icon={Lock}>{lines} line{lines===1?'':'s'} · read-only</Chip></div>
    </div>
    <div className={sections.length>1?'mv-is-gsecs is-two':'mv-is-gsecs'}>{sections.map(section=><GateSection key={section.id} section={section} openDoc={openDoc} showName={sections.length>1}/>)}</div>
    <p className="mv-small mv-is-gfoot">Nothing here can be ticked. A gate passes only from saved, dated evidence; “unknown” never passes.</p>
  </section>;
}
