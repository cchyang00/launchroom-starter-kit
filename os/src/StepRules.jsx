import React,{useEffect,useState} from 'react';
import {Scale,ArrowUpRight} from 'lucide-react';
import {api} from './ui.jsx';
import {Chip} from './kit.jsx';

// The starting rules a step decides by (os/data/rules.json, GET /api/rules;
// owner, Oct 2). Read-only here: each number says whose it is. The owner
// changes a number in Settings later; the money line, the test sheet and the
// result card (later jobs) read the same rules. Nothing here decides anything.
const STEP_GROUPS = {prove:['prove'],create:['create'],launch:['launch'],learn:['learn']};
const TITLES = {prove:'The money line rules',create:'How many concepts',launch:'The test sheet rules',learn:'Kill, trim, keep or scale'};

export const hasStepRules = stepId => Boolean(STEP_GROUPS[stepId]);

let cache = null;
export function useRules() {
  const [state,setState] = useState(()=>({rules:cache,error:''}));
  useEffect(()=>{
    let live = true;
    api('/api/rules').then(rules=>{cache = rules; if (live) setState({rules,error:''});}).catch(error=>{if (live) setState(previous=>({rules:previous.rules,error:error.message}));});
    return ()=>{live = false;};
  },[]);
  return state;
}

const amount = rule => `${rule.unit==='usd'?'$':''}${rule.value}${rule.max!==undefined?`–${rule.max}`:''}${rule.unit==='usd'?'':` ${rule.unit}`}`;

/** The rules for one step (Prove it, Create, Launch or Learn), or nothing for the other steps. */
export function StepRules({stepId,openDoc}) {
  const {rules,error} = useRules();
  const groups = STEP_GROUPS[stepId];
  if (!groups) return null;
  if (!rules) return error?<p className="mv-small mv-is-note" role="alert">The starting rules could not be read: {error}</p>:null;
  const list = rules.rules.filter(rule=>groups.includes(rule.group));
  if (!list.length) return null;
  return <section className="mv-card mv-is-gate-card" aria-label={TITLES[stepId]}>
    <div className="mv-is-head">
      <div><span className="mv-eyebrow"><Scale size={12}/>Starting rules · {rules.path}</span><h2 className="mv-h3">{TITLES[stepId]}</h2>
        <p className="mv-small">Each number says whose it is. A starting rule is a rule of thumb from the research, never a promise; yours are marked.</p></div>
      <div className="mv-is-head-side"><button type="button" className="mv-link" onClick={()=>openDoc?.('workflow/CHECKS.md')}>Where they come from<ArrowUpRight size={12}/></button></div>
    </div>
    <ol className="mv-is-glist">{list.map(rule=><li key={rule.id}>
      <span className="mv-is-gid">{rule.by==='owner'?'You':'Rule'}</span>
      <span className="mv-is-gtext"><b>{rule.label}: {amount(rule)}</b> <Chip tone={rule.by==='owner'?'owner':'muted'}>{rule.by==='owner'?'your choice':'starting rule'}</Chip>
        <ul><li>{rule.whose}{rule.note?` · ${rule.note}`:''}</li></ul></span>
    </li>)}</ol>
  </section>;
}
