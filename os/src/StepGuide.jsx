import React,{useState} from 'react';
import {Copy,Check,Play,CircleCheck,User,OctagonX,BookOpen,Route} from 'lucide-react';
import {LINE_PATH} from './theLine.mjs';
import {AgentAvatar,agentOf} from './kit.jsx';

// The step guide on each step page (workflow/the-line.json) and a copy button.
// The guide's prompts stay for agents' briefs; the owner just talks in chat (Nov 5).

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly',''); area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select();
    const ok = document.execCommand('copy'); area.remove(); return ok;
  } catch { return false; }
}

export function CopyButton({text,label='Copy',className='mv-btn sm'}) {
  const [state,setState] = useState('idle');
  async function copy() {
    const ok = await copyText(text);
    setState(ok?'copied':'failed');
    setTimeout(()=>setState('idle'),ok?1800:3200);
  }
  return <button type="button" className={`${className} mv-copy ${state==='copied'?'is-copied':''}`} onClick={copy} aria-live="polite">
    {state==='copied'?<Check size={13} strokeWidth={3}/>:<Copy size={13}/>}{state==='copied'?'Copied':state==='failed'?'Select and copy':label}
  </button>;
}

function Fact({icon:Icon,tone,title,children}) {
  return <div className={`mv-fact is-${tone}`}><span className="mv-fact-icon"><Icon size={15}/></span><div><b>{title}</b><p>{children}</p></div></div>;
}

function Helpers({ids,team}) {
  return <span className="mv-helpers">{ids.map(id=>{const agent=agentOf(team,id);return <span key={id} className="mv-helper"><AgentAvatar agent={agent} size={20}/>{agent?.name||id}</span>;})}</span>;
}

/**
 * The "Start this step" card on each step page: how to start the step, when it
 * is done and the owner's part. Every product has its own line, so the card
 * never says "you are here".
 */
export function StepCard({guide,team,openDoc}) {
  // A broken guide shows once, as the app-wide banner from the server's lineError.
  if (!guide) return null;
  return <section className="mv-card mv-stepcard" aria-label="Start this step">
    <div className="mv-stepcard-head">
      <div className="mv-stepcard-title"><span className="mv-eyebrow">Step {guide.number} of 7 · start it</span><h2 className="mv-h3">How to start {guide.name} and when it is done</h2></div>
      <div className="mv-stepcard-actions">
        <button className="mv-btn sm" onClick={()=>openDoc(LINE_PATH)}><Route size={13}/>The whole line</button>
        <button className="mv-btn sm" onClick={()=>openDoc(guide.playbook)}><BookOpen size={13}/>Full method</button>
      </div>
    </div>
    <div className="mv-facts">
      <Fact icon={Play} tone="start" title="Start when">{guide.startWhen}</Fact>
      <Fact icon={CircleCheck} tone="done" title="Done when">{guide.doneWhen}</Fact>
      <Fact icon={User} tone="you" title="Your part">{guide.ownerPart}</Fact>
    </div>
    <div className="mv-stepcard-foot">
      <span className="mv-stepcard-who"><small>Agents who help</small><Helpers ids={guide.agents} team={team}/></span>
      <span className="mv-stepcard-stop"><OctagonX size={14}/><span><b>Stop if:</b> {guide.stopIf}</span></span>
    </div>
  </section>;
}
