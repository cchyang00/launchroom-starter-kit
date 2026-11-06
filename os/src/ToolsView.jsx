import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Wrench,Telescope,Truck,Store,Megaphone,Clapperboard,Mail,Laptop,Globe,AppWindow,ArrowUpRight,ArrowRight,LogIn,Info,Lock,Plus,Check,Circle,FileText,Archive,ChevronDown,ChevronUp,MapPin} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,STAGE_ICONS,STAGE_SLUGS,SLUG_STAGES} from './kit.jsx';
import {STEP_IDS,STEP_NAMES} from './theLine.mjs';
import {GROUP_LABELS,OPENS_LABELS,SECRET_MESSAGE,secretProblem,urlProblem,toolsForStep,toolsByGroup,needsSignIn,isThisApp,hostOf,stepFrom} from './toolsModel.mjs';

// Tools: every outside tool we use, one click to open. The owner and Claude open
// the same links in the same signed-in browser. Nothing here stores or asks for
// a password (LS-064); the "Signed in?" tick stores only the date it was noted.

const GROUP_ICONS = {research:Telescope,sourcing:Truck,store:Store,ads:Megaphone,creative:Clapperboard,email:Mail,local:Laptop};
const OPENS_ICONS = {chrome:Globe,'luxury-desktop':AppWindow,local:Laptop};
const shortDay = value => value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const LONG = 120;

export function ToolIcon({group,size=34}) {
  const Icon = GROUP_ICONS[group]||Wrench;
  return <span className={`mv-tl-icon mv-tl-g-${group}`} style={{width:size,height:size}} aria-hidden="true"><Icon size={Math.round(size*.5)}/></span>;
}

function OpensChip({tool}) {
  if (isThisApp(tool)) return <span className="mv-tl-opens is-here"><MapPin size={11}/>You're in it</span>;
  const Icon = OPENS_ICONS[tool.opensIn]||Globe;
  return <span className={`mv-tl-opens is-${tool.opensIn}`} title={tool.opensIn==='chrome'?'Opens in the browser (the shared browser pane or your Chrome)':tool.opensIn==='local'?'Runs on this computer':'Opens only in the Luxury desktop app'}><Icon size={11}/>{OPENS_LABELS[tool.opensIn]}</span>;
}

/** Name, then where it opens and its site on one line, so long names keep the card's full width. */
function ToolName({tool}) {
  return <span className="mv-tl-name"><strong>{tool.name}</strong><span className="mv-tl-meta"><OpensChip tool={tool}/>{tool.optional&&<span className="mv-tl-optional" title="An optional cross-check: the method's own tools come first (workflow/CHECKS.md)">Optional</span>}<small>{hostOf(tool.url)}</small></span></span>;
}

/** The Open action: a link for web and local tools; guidance for tools that live in the Luxury app. */
function OpenAction({tool,big}) {
  if (isThisApp(tool)) return null;
  if (tool.opensIn==='luxury-desktop'&&!big) return <span className="mv-tl-app-hint" title={`${tool.name} opens in the Luxury desktop app on this computer. The link is only the vendor page.`}><AppWindow size={13}/>Open in the Luxury app</span>;
  if (tool.opensIn==='luxury-desktop') return <div className="mv-tl-luxury">
    <span className="mv-tl-luxury-text"><AppWindow size={15}/><span><b>Open the Luxury app</b><small>{/luxury/i.test(tool.name)?'It runs on this computer; sign in there if it asks.':`Start Luxury on this computer, then choose ${tool.name}.`}</small></span></span>
    <a className="mv-link mv-tl-vendor" href={tool.url} target="_blank" rel="noreferrer" title={`${hostOf(tool.url)}: only the public vendor page`}>Vendor page<ArrowUpRight size={12}/></a>
  </div>;
  return <a className={`mv-btn ${big?'primary':'sm'} mv-tl-open`} href={tool.url} target="_blank" rel="noreferrer" aria-label={`Open ${tool.name} (${hostOf(tool.url)})`}>Open<ArrowUpRight size={big?15:13}/></a>;
}

function SignedIn({tool,onToggle,busy}) {
  if (!needsSignIn(tool)||!onToggle) return null;
  const noted = Boolean(tool.signedInNoted);
  return <button type="button" className={`mv-tl-signed ${noted?'is-on':''}`} aria-pressed={noted} disabled={busy} onClick={()=>onToggle(tool)}
    title={noted?`You noted you were signed in on ${shortDay(tool.signedInNoted)}. Sessions can expire. Click to clear.`:'Tick once you are signed in to this tool in the shared browser, so agents expect no sign-in wall. Only the date is saved.'}>
    {noted?<Check size={12} strokeWidth={3}/>:<Circle size={12}/>}{noted?`Signed in · ${shortDay(tool.signedInNoted)}`:'Signed in?'}
  </button>;
}

function StepTags({steps}) {
  if (steps.length===STEP_IDS.length) return <span className="mv-tl-steps"><i>Every step</i></span>;
  return <span className="mv-tl-steps">{steps.map(id=><i key={id}>{STEP_NAMES[STEP_IDS.indexOf(id)]}</i>)}</span>;
}

/** Big Open card for the tools of the step we are looking at. */
function BigCard({tool,onToggle,busy,flash}) {
  return <article id={`step-tool-${tool.id}`} className={`mv-tl-big ${flash?'is-flash':''}`}>
    <header className="mv-tl-big-head"><ToolIcon group={tool.group} size={42}/><ToolName tool={tool}/></header>
    <p className="mv-tl-purpose">{tool.purpose}</p>
    <p className="mv-tl-note"><LogIn size={13}/><span>{tool.signIn||'Sign-in not noted yet.'}</span></p>
    <footer className="mv-tl-big-foot"><OpenAction tool={tool} big/><SignedIn tool={tool} onToggle={onToggle} busy={busy}/></footer>
  </article>;
}

/** Compact card in the grouped list. Long notes fold behind More. */
function ToolCard({tool,onToggle,busy,flash}) {
  const [open,setOpen] = useState(false);
  const long = (tool.signIn||'').length>LONG||(tool.limits||'').length>LONG||tool.purpose.length>LONG;
  return <article id={`tool-${tool.id}`} className={`mv-tl-card ${open?'is-open':''} ${flash?'is-flash':''}`}>
    <div className="mv-tl-card-top"><ToolIcon group={tool.group} size={32}/><ToolName tool={tool}/></div>
    <p className="mv-tl-purpose">{tool.purpose}</p>
    <div className="mv-tl-notes">
      <p className="mv-tl-note"><LogIn size={13}/><span>{tool.signIn||'Sign-in not noted yet.'}</span></p>
      {tool.limits&&<p className="mv-tl-note is-limit"><Info size={13}/><span>{tool.limits}</span></p>}
    </div>
    {long&&<button type="button" className="mv-link mv-tl-more" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={13}/>:<ChevronDown size={13}/>}{open?'Less':'More'}</button>}
    <div className="mv-tl-card-foot"><StepTags steps={tool.steps}/><span className="mv-tl-card-actions"><SignedIn tool={tool} onToggle={onToggle} busy={busy}/><OpenAction tool={tool}/></span></div>
  </article>;
}

/* ---------- Add a tool: four inputs, no secret fields ---------- */
function AddToolSheet({tools,stepId,onClose,onSaved}) {
  const [name,setName] = useState(''),[link,setLink] = useState(''),[purpose,setPurpose] = useState(''),[step,setStep] = useState(stepId||'product');
  const [touched,setTouched] = useState(false),[busy,setBusy] = useState(false),[error,setError] = useState('');
  // The same guard the server uses: the owner sees it while typing; the server refuses it anyway.
  const secret = [name,purpose,link].map(secretProblem).find(Boolean)||'';
  const linkIssue = link.trim()?urlProblem(link.trim()):'Add the link the tool opens at.';
  const showLink = !secret&&linkIssue&&linkIssue!==SECRET_MESSAGE&&(touched||link.trim().length>=10);
  async function submit(event) {
    event.preventDefault();setTouched(true);
    if (secret||linkIssue||!name.trim()||!purpose.trim()) return;
    setBusy(true);setError('');
    try {
      const saved = await api('/api/tools',{revision:tools.revision,name:name.trim(),url:link.trim(),purpose:purpose.trim(),steps:[step]});
      onSaved(saved);
    } catch (e) {setError(/changed|revision/i.test(e.message)?'The tool list just changed. Try again.':e.message);}
    finally {setBusy(false);}
  }
  return <Sheet title="Add a tool" subtitle="Four things. If it needs a login, sign in once in the browser, never here." onClose={onClose}>
    <form className="mv-tl-form" onSubmit={submit} noValidate>
      <label className="mv-field">Name<input className="mv-input" autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Canva"/></label>
      <label className="mv-field">Link<small>The page it opens at: https://… (or http://localhost:… on this computer)</small>
        <input className="mv-input" inputMode="url" autoComplete="off" spellCheck={false} maxLength={2000} value={link} onChange={e=>setLink(e.target.value)} onBlur={()=>link&&setTouched(true)} placeholder="https://…" aria-invalid={showLink?true:undefined}/></label>
      {showLink&&<p className="mv-tl-field-issue" role="alert">{linkIssue}</p>}
      <label className="mv-field">What it's for<small>One line</small><input className="mv-input" required maxLength={240} value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="e.g. Quick ad image layouts"/></label>
      <div className="mv-field" role="group" aria-label="Which step uses it">Which step uses it?
        <div className="mv-step-pick">{STEP_IDS.map((id,i)=><button type="button" key={id} aria-pressed={step===id} onClick={()=>setStep(id)}><i>{i+1}</i>{STEP_NAMES[i]}</button>)}</div>
      </div>
      {secret&&<div className="mv-tl-guard" role="alert"><Lock size={16}/><div><b>{secret}</b><span>Agents read every record here, so the tool keeps only its link and notes. You sign in once in the browser; agents work in that session.</span></div></div>}
      {error&&!secret&&<div className="mv-error" role="alert">{error}</div>}
      <div className="mv-tl-form-actions"><span className="mv-small">Claude sorts it into a group and adds sign-in notes and limits later.</span><button className="mv-btn primary" disabled={busy||Boolean(secret)||!name.trim()||!purpose.trim()||!link.trim()}><Plus size={14}/>{busy?'Adding…':'Add the tool'}</button></div>
    </form>
  </Sheet>;
}

/* ---------- The page ---------- */
export function ToolsView({tools,setTools,loadTools,toolsError,current,route,notify,openDoc,day}) {
  const fromRoute = SLUG_STAGES[route?.params?.step]||stepFrom(route?.params?.step);
  const [pick,setPick] = useState(fromRoute||current?.id||'product');
  const [adding,setAdding] = useState(false),[busy,setBusy] = useState(''),[flash,setFlash] = useState('');
  const handled = useRef('');
  const list = tools?.tools||[];
  const stepTools = useMemo(()=>toolsForStep(list,pick),[list,pick]);
  const groups = useMemo(()=>toolsByGroup(list),[list]);
  const retired = list.filter(tool=>tool.retired);
  const hereIndex = current?.index??0;
  const pickIndex = STEP_IDS.indexOf(pick);
  const StepIcon = STAGE_ICONS[pick];

  // Follow the pipeline's focus step (currentStep: the building product, else the owner's move, else the earliest product) until the owner picks another one.
  const [followed,setFollowed] = useState(!fromRoute);
  useEffect(()=>{if(followed&&current?.id)setPick(current.id);},[current?.id,followed]);
  // #/tools?tool=kalodata scrolls to that card once and lights it up.
  useEffect(()=>{const id=route?.params?.tool;if(id&&tools&&handled.current!==id){handled.current=id;setFlash(id);}},[route?.params?.tool,tools]);
  useEffect(()=>{
    if (!flash) return;
    const timer = setTimeout(()=>(document.getElementById(`step-tool-${flash}`)||document.getElementById(`tool-${flash}`))?.scrollIntoView({behavior:'smooth',block:'center'}),60);
    const clear = setTimeout(()=>setFlash(''),2600);
    return()=>{clearTimeout(timer);clearTimeout(clear);};
  },[flash]);

  async function toggleSignedIn(tool) {
    setBusy(tool.id);
    try {
      const saved = await api('/api/tools',{revision:tools.revision,id:tool.id,signedInNoted:tool.signedInNoted?'':day});
      setTools(saved);
      notify(tool.signedInNoted?`${tool.name}: sign-in note cleared.`:`${tool.name}: noted you're signed in. Agents expect no sign-in wall.`);
    } catch (e) {notify(/changed|revision/i.test(e.message)?'The tool list just changed. Try again.':e.message);loadTools();}
    finally {setBusy('');}
  }

  const notReady = toolsError?(/route not found/i.test(toolsError)?'The Tools page needs the updated OS server. Ask the manager to restart the OS, then reload.':toolsError):'';
  return <section className="mv-tl">
    <div className="mv-page-head"><div><span className="mv-eyebrow">One click to open</span><h1 className="mv-h1">Tools</h1><p className="mv-sub">Every outside tool we use. You and your agents open the same links in the same signed-in browser.</p></div>
      <div className="mv-page-actions"><button className="mv-btn" disabled={!tools} onClick={()=>setAdding(true)}><Plus size={15}/>Add a tool</button></div></div>

    {notReady&&<div className="mv-error" role="alert" style={{marginBottom:14}}>{notReady}</div>}
    {!tools&&!notReady&&<div className="mv-card mv-empty">Opening the tool list…</div>}
    {tools&&!list.length&&<div className="mv-card mv-empty"><Wrench size={26}/><strong>No tools listed yet.</strong><span className="mv-small">Agents add them with <code>os.mjs tools import</code>, or add one yourself.</span></div>}

    {tools&&list.length>0&&<>
      <section className="mv-card mv-tl-step" aria-label="Tools for a step">
        <div className="mv-tl-step-head">
          <div className="mv-tl-step-title"><span className="mv-eyebrow">{pickIndex===hereIndex?`The pipeline's focus · Step ${pickIndex+1} of ${STEP_IDS.length}`:`Step ${pickIndex+1} of ${STEP_IDS.length}`}</span><h2 className="mv-h2">{StepIcon&&<StepIcon size={18}/>}Tools for Step {pickIndex+1} · {STEP_NAMES[pickIndex]}</h2></div>
          <div className="mv-step-pick mv-tl-pick" role="group" aria-label="Show the tools for a step">{STEP_IDS.map((id,i)=><button key={id} aria-pressed={pick===id} onClick={()=>{setFollowed(false);setPick(id);}}><i>{i+1}</i>{STEP_NAMES[i]}{i===hereIndex&&<span className="mv-here-dot" title="The pipeline's focus step"/>}</button>)}</div>
        </div>
        {stepTools.length?<div className="mv-tl-big-grid">{stepTools.map(tool=><BigCard key={tool.id} tool={tool} onToggle={toggleSignedIn} busy={busy===tool.id} flash={flash===tool.id}/>)}</div>
        :<p className="mv-tl-none">No tools are tagged for {STEP_NAMES[pickIndex]} yet. Add one, or ask your agent to tag the right ones.</p>}
      </section>

      <div className="mv-section-head mv-tl-all-head"><div><h2 className="mv-h2">All tools</h2><span className="mv-small">{tools.counts?.active??list.length} tools by group · Open goes to the same page your agents open</span></div></div>
      <nav className="mv-scope-strip mv-tl-jump" aria-label="Jump to a group">{groups.map(group=><button key={group.group} onClick={()=>document.getElementById(`tools-${group.group}`)?.scrollIntoView({behavior:'smooth',block:'start'})}><ToolIcon group={group.group} size={22}/>{group.label}<small>{group.tools.length}</small></button>)}</nav>
      {groups.map(group=><section key={group.group} id={`tools-${group.group}`} className="mv-tl-group">
        <h3 className="mv-tl-group-head"><ToolIcon group={group.group} size={26}/>{GROUP_LABELS[group.group]}<b>{group.tools.length}</b></h3>
        <div className="mv-tl-grid">{group.tools.map(tool=><ToolCard key={tool.id} tool={tool} onToggle={toggleSignedIn} busy={busy===tool.id} flash={flash===tool.id}/>)}</div>
      </section>)}
      {retired.length>0&&<details className="mv-tl-retired"><summary><Archive size={13}/>Retired tools ({retired.length})</summary><ul>{retired.map(tool=><li key={tool.id}>{tool.name}<small>{hostOf(tool.url)}</small></li>)}</ul></details>}
    </>}

    <footer className="mv-tl-rule"><Lock size={16}/><div><b>No passwords here. Sign in once in the browser; agents work in your signed-in session.</b>
      <span>Agents open the same links with <code>os.mjs tool &lt;id&gt;</code>. <button className="mv-link" onClick={()=>openDoc('resources/TOOLS.md')}><FileText size={12}/>The list agents read</button></span></div></footer>

    {adding&&tools&&<AddToolSheet tools={tools} stepId={pick} onClose={()=>setAdding(false)} onSaved={saved=>{setTools(saved);setAdding(false);setFlash(saved.saved);const tool=saved.tools.find(item=>item.id===saved.saved);if(tool&&!tool.steps.includes(pick)){setFollowed(false);setPick(tool.steps[0]);}notify(`${tool?.name||'Tool'} added. Claude can open it with os.mjs tool ${saved.saved}.`);}}/>}
  </section>;
}

/** The slim "Tools for this step" row on each step page, under the Start card. */
export function StepTools({tools,stepId,go}) {
  if (!tools?.tools) return null;
  const list = toolsForStep(tools.tools,stepId);
  return <section className="mv-tl-row" aria-label="Tools for this step">
    <span className="mv-tl-row-label"><Wrench size={14}/>Tools for this step</span>
    <div className="mv-tl-row-chips">{list.length?list.map(tool=>tool.opensIn==='luxury-desktop'
      ?<button type="button" key={tool.id} className="mv-tl-chip is-app" onClick={()=>go(`tools?tool=${tool.id}`)} title={`${tool.name} opens in the Luxury desktop app on this computer`}><ToolIcon group={tool.group} size={20}/><span>{tool.name}</span><small>Luxury app</small></button>
      :<a key={tool.id} className="mv-tl-chip" href={tool.url} target="_blank" rel="noreferrer" title={`Open ${tool.name} (${hostOf(tool.url)})`}><ToolIcon group={tool.group} size={20}/><span>{tool.name}</span><ArrowUpRight size={12}/></a>)
      :<span className="mv-small">No tools tagged for this step yet.</span>}</div>
    <button type="button" className="mv-link mv-tl-row-all" onClick={()=>go(`tools?step=${STAGE_SLUGS[stepId]}`)}>All tools<ArrowRight size={13}/></button>
  </section>;
}
