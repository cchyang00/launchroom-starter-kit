import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import Markdown,{defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {MessageSquareQuote,ScanSearch,BadgeCheck,FlaskConical,CirclePause,Search,BookOpen,ArrowUpRight,ArrowRight,FileText,Sparkles,CheckCheck,Undo2,Users,Quote,Package,Workflow,LoaderCircle,Info,ChevronRight} from 'lucide-react';
import {api} from './ui.jsx';
import {Chip,Sheet} from './kit.jsx';
import {CHECKS_PATH,ISSUE_LIST_ANCHOR,ISSUES_ROOT} from './issues.mjs';
import {STATUS_LABELS,STATUS_HINTS,issueCounts,filterIssues,testingHint,openChecks,pickProblem,PICK_WORDS,NEW_CHECKS} from './issueList.mjs';
import {UNDO_MS} from './eyeTest.mjs';
import {localDocumentUrl,resolveDocumentPath} from './documentPaths.mjs';
import {StageTabs} from './StagePage.jsx';
import {IssueDots,StatusChip,STATUS_ICONS} from './Issues.jsx';
import {stepStations,issueStationOf} from './pipelineView.mjs';
import './issueList.css';

// Step 0 · the issue list (owner, Oct 3): "we want a list of deep real issues
// in life for many different avatars and angle ... it's all about choosing a
// couple from the list of what we're testing and finding products to match."
// Every status comes from saved records (the issue files' I1-I7 lines and the
// owner's picks in os/data/issue-picks.json), never from where a row sits.
// The owner's only actions are "Test this issue" and "Not now", one tap each,
// with a 5-second Undo; agents' writes are refused by the server.

const FILTERS = ['all','candidate','verified','testing','parked'];

/** GET /api/issues with a reload after a pick; refreshed every 15 seconds. */
function useIssueList() {
  const [state,setState] = useState({data:null,error:'',missing:false});
  const load = useCallback(async()=>{
    try { const data = await api('/api/issues'); setState({data,error:'',missing:false}); return data; }
    catch (error) { setState(previous=>({data:previous.data,error:error.status===404?'':error.message,missing:error.status===404})); return null; }
  },[]);
  useEffect(()=>{load();const timer = setInterval(load,15000);return()=>clearInterval(timer);},[load]);
  return {...state,load,setData:data=>setState({data,error:'',missing:false})};
}

/** The refusal in plain words, read by the server's code (LS-073). */
function pickError(error) {
  if (error?.code==='REVISION_CONFLICT') return 'The list just changed. It is refreshed now; tap again.';
  if (error?.code==='OWNER_DECISION_ONLY') return 'Only the owner picks which issues to test.';
  return error?.message||'The pick did not save.';
}

/** "Test this issue" and "Not now": one tap each; nothing typed. */
function PickButtons({entry,onPick,busy,compact=false}) {
  const status = entry.status;
  const test = !pickProblem(entry,'testing')&&status!=='testing';
  const park = !pickProblem(entry,'parked')&&status!=='parked';
  if (!test&&!park) return null;
  return <div className={`mv-il-pick ${compact?'is-compact':''}`}>
    {test&&<button type="button" className="mv-btn sm primary" disabled={busy} onClick={event=>{event.stopPropagation();onPick(entry,'testing');}}><FlaskConical size={14}/>Test this issue</button>}
    {park&&<button type="button" className="mv-btn sm" disabled={busy} onClick={event=>{event.stopPropagation();onPick(entry,'parked');}}><CirclePause size={14}/>{status==='testing'?'Stop testing':'Not now'}</button>}
  </div>;
}

function IssueRow({entry,onOpen,onPick,busy}) {
  const types = entry.productTypes||[];
  const openRounds = (entry.rounds||[]).filter(round=>round.open);
  return <li className={`mv-il-row is-${entry.status}`}>
    <button type="button" className="mv-il-open" onClick={()=>onOpen(entry.slug)} aria-label={`Open ${entry.title}`}>
      <span className="mv-il-text">
        <b className="mv-il-title">{entry.title}</b>
        {entry.group&&<span className="mv-il-group"><Users size={12}/>{entry.group}</span>}
        <span className="mv-il-meta">
          <span className="mv-il-evidence"><Quote size={11}/>{entry.quotes??0} quotes · {entry.sites??0} sites</span>
          {types.slice(0,3).map(type=><span key={type} className="mv-il-type">{type}</span>)}
          {types.length>3&&<span className="mv-il-type is-more">+{types.length-3}</span>}
          {entry.missingFile&&<span className="mv-il-type is-stub">Gemini report only</span>}
        </span>
      </span>
      <span className="mv-il-side">
        <StatusChip status={entry.status}/>
        <IssueDots checks={entry.checks}/>
        {entry.status==='testing'&&<span className={`mv-il-round ${openRounds.length?'':'is-none'}`}>{openRounds.length?openRounds.map(round=>`Round ${round.number}`).join(', '):'No round yet'}</span>}
      </span>
      <ChevronRight size={16} className="mv-il-chev" aria-hidden="true"/>
    </button>
    {entry.status==='verified'&&<PickButtons entry={entry} onPick={onPick} busy={busy} compact/>}
  </li>;
}

/** The issue file, rendered; relative links open in the reader, web links in a new tab. */
function IssueFile({path,openDoc}) {
  const [doc,setDoc] = useState(null),[error,setError] = useState('');
  useEffect(()=>{let live = true;setDoc(null);setError('');api('/api/doc?path='+encodeURIComponent(path)).then(value=>{if(live)setDoc(value);}).catch(e=>{if(live)setError(e.message);});return()=>{live = false;};},[path]);
  const body = useMemo(()=>doc?<Markdown urlTransform={url=>defaultUrlTransform(localDocumentUrl(url))} remarkPlugins={[remarkGfm]} components={{a:({href,children})=>/^https?:/.test(href||'')?<a href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={11}/></a>:<button type="button" className="mv-il-doclink" onClick={()=>openDoc(resolveDocumentPath(path,href))}>{children}</button>}}>{doc.content}</Markdown>:null,[doc,path,openDoc]);
  if (error) return <p className="mv-small" role="alert">The file could not be read: {error}</p>;
  if (!doc) return <p className="mv-small mv-il-loading"><LoaderCircle size={14} className="mv-spin"/>Opening {path}…</p>;
  return <article className="markdown mv-il-doc">{body}</article>;
}

function IssueSheet({entry,onClose,onPick,busy,openDoc,go,pipeline,error}) {
  const products = (pipeline?.items||[]).filter(item=>String(item.issue||'').split(/,\s*/).includes(entry.slug));
  const open = openChecks(entry);
  const Icon = STATUS_ICONS[entry.status]||ScanSearch;
  const lead = entry.status==='candidate'?`Still being checked: ${open.map(check=>`${check.id} ${check.name}`).join(', ')} ${open.length===1?'is':'are'} open. It can be picked once all seven pass.`
    :entry.status==='verified'?'All seven checks pass. Test it, or set it aside for now.'
    :entry.status==='testing'?`You are testing this issue${entry.pick?.at?` since ${new Date(entry.pick.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}. Rounds start from it, and the scout searches for its product types.`
    :`You set this aside${entry.pick?.at?` on ${new Date(entry.pick.at).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}.`;
  // Said in chat (Oct 3): the manager recorded this pick with the owner's words.
  const said = entry.pick?.source==='owner-chat'&&entry.pick?.quote?` Said in chat: “${entry.pick.quote}”`:'';
  return <Sheet wide title={entry.title} subtitle={`${entry.slug}${entry.researched?` · researched ${entry.researched}${entry.researchedBy?` by ${entry.researchedBy}`:''}`:''}`} onClose={onClose}>
    <div className="mv-il-sheet">
      <section className={`mv-il-state is-${entry.status}`} aria-label="Status">
        <span className="mv-il-state-mark"><Icon size={20}/></span>
        <div className="mv-il-state-text"><StatusChip status={entry.status}/><p>{lead}{said}</p>
          {entry.reopened&&<p className="mv-il-warn"><Info size={13}/>The gate reopened after your pick ({open.map(check=>check.id).join(', ')} open). Your pick stays.</p>}</div>
        <PickButtons entry={entry} onPick={onPick} busy={busy}/>
      </section>
      {error&&<p className="mv-il-error" role="alert">{error}</p>}

      <section className="mv-il-block" aria-label="The seven checks">
        <div className="mv-il-block-head"><h3>The seven checks <small>I1–I7, from the file</small></h3><button type="button" className="mv-link" onClick={()=>openDoc(`${CHECKS_PATH}#${ISSUE_LIST_ANCHOR}`)}><BookOpen size={13}/>How we research it<ArrowUpRight size={12}/></button></div>
        <ol className="mv-il-checks">{(entry.checks||[]).map(check=><li key={check.id} className={`is-${check.state}`}>
          <span className="mv-il-checkdot">{check.id.slice(1)}</span>
          <span><b>{check.id} · {check.name}</b><small>{check.rule}</small>{check.note&&<em>{check.note}</em>}</span>
          <span className="mv-il-checkstate">{check.state==='passed'?'Passed':check.state==='partly'?'Older gate':'Open'}</span>
        </li>)}</ol>
        {(entry.gate?.format==='older'||entry.gate?.format==='mixed')&&<p className="mv-small mv-il-note">This file still has {entry.gate.format==='mixed'?'some lines from ':''}the older five-line gate. A half dot means the older line asked less than I1–I5 ask now, and the older gate never asked I6 or I7; the researcher rewrites it as “I1 · Real: …” lines from templates/ISSUE.md.</p>}
        {['i1-i7','mixed'].includes(entry.gate?.format)&&entry.checks?.some(check=>NEW_CHECKS.includes(check.id)&&check.from==='none')&&<p className="mv-small mv-il-note">I6 and I7 are new (October 3): do people say they want to buy something, not just complain, and is Meta not already crowded for this moment? Until the file has those two lines, the issue stays a Candidate.</p>}
      </section>

      <section className="mv-il-facts" aria-label="What we know">
        <div><h4><Users size={13}/>Avatars</h4><p>{entry.group||'Not written yet.'}</p></div>
        <div><h4><Quote size={13}/>Evidence</h4><p>{entry.quotes??0} quotes from {entry.sites??0} sites{entry.siteNames?.length?`: ${entry.siteNames.slice(0,6).join(', ')}`:''}.</p></div>
        <div className="is-wide"><h4><Package size={13}/>Product types to search</h4>{entry.productTypes?.length?<div className="mv-il-chips">{entry.productTypes.map(type=><span key={type} className="mv-il-type">{type}</span>)}</div>:<p>None listed yet.</p>}</div>
        {entry.searchTerms?.length>0&&<div className="is-wide"><h4><Search size={13}/>TikTok Shop search</h4><div className="mv-il-chips">{entry.searchTerms.map(term=><code key={term} className="mv-il-term">{term}</code>)}</div></div>}
        {(entry.failing?.length>0||entry.tried?.length>0)&&<div className="is-wide"><h4><Sparkles size={13}/>What fails them today</h4>
          <ul className="mv-il-tried">{entry.failing?.length?entry.failing.map(line=><li key={line}>{line}</li>):entry.tried.slice(0,5).map(item=><li key={item.fix}><b>{item.fix}</b>{item.says?` · ${item.says}`:''}</li>)}</ul></div>}
      </section>

      <section className="mv-il-block" aria-label="Rounds and products">
        <div className="mv-il-block-head"><h3>Rounds and products</h3></div>
        <div className="mv-il-links">
          {(entry.rounds||[]).map(round=><button key={round.id} type="button" className="mv-il-linkchip" onClick={()=>{onClose();go('pipeline');}}><Workflow size={13}/>Round {round.number}{round.open?' · open':' · reviewed'}</button>)}
          {products.map(item=><button key={item.id} type="button" className="mv-il-linkchip" onClick={()=>{onClose();go(`product/${item.id}`);}}><Package size={13}/>{item.id} · {item.name}<ArrowRight size={12}/></button>)}
          {!(entry.rounds||[]).length&&!products.length&&<p className="mv-small">{entry.status==='testing'?'No round yet. Ask Claude: “Start a round for this issue.”':'No round or product uses it yet.'}</p>}
        </div>
      </section>

      <section className="mv-il-block" aria-label="Files">
        <div className="mv-il-block-head"><h3>Files</h3></div>
        <div className="mv-il-links">
          {!entry.missingFile&&<button type="button" className="mv-il-linkchip" onClick={()=>openDoc(entry.path)}><FileText size={13}/>ISSUE.md<ArrowUpRight size={12}/></button>}
          {(entry.gemini||[]).map(path=><button key={path} type="button" className="mv-il-linkchip is-gemini" onClick={()=>openDoc(path)}><Sparkles size={13}/>Gemini report · {path.split('/').pop()}<ArrowUpRight size={12}/></button>)}
          {!(entry.gemini||[]).length&&<span className="mv-small">No Gemini report saved in {ISSUES_ROOT}/{entry.slug}/.</span>}
        </div>
      </section>

      {!entry.missingFile&&<section className="mv-il-block" aria-label="The issue file"><div className="mv-il-block-head"><h3>The issue file</h3><small className="mv-small">{entry.path}</small></div><IssueFile path={entry.path} openDoc={openDoc}/></section>}
    </div>
  </Sheet>;
}

/**
 * The Issues page (#/issues; #/issue redirects): step 0, a clean list. One row
 * per issue folder with its words, avatars, evidence, I1-I7 dots, product types
 * and status; filters by status and a search; a row opens the issue.
 */
export function IssuesPage({openDoc,go,route,current,refresh}) {
  const {data,error,missing,load,setData} = useIssueList();
  const [status,setStatus] = useState(()=>FILTERS.includes(route?.params?.status)?route.params.status:'all'),[query,setQuery] = useState('');
  const [busy,setBusy] = useState(false),[undo,setUndo] = useState(null),[toast,setToast] = useState(''),[pickErr,setPickErr] = useState('');
  const entries = data?.issues||[];
  const counts = issueCounts(entries);
  const shown = filterIssues(entries,{status,query});
  const hint = data?.hint||testingHint(entries);
  const openSlug = route?.params?.issue||'';
  const opened = openSlug?entries.find(entry=>entry.slug===openSlug):null;
  const pipeline = current?.pipeline;
  const stations = stepStations(pipeline);
  useEffect(()=>{if(!undo)return;const timer = setTimeout(()=>setUndo(null),UNDO_MS);return()=>clearTimeout(timer);},[undo]);
  useEffect(()=>{if(!toast)return;const timer = setTimeout(()=>setToast(''),4200);return()=>clearTimeout(timer);},[toast]);
  const openIssue = slug=>{setPickErr('');go(`issues?issue=${encodeURIComponent(slug)}`);};
  const close = ()=>{setPickErr('');go('issues');};

  async function pick(entry,choice) {
    setBusy(true);setPickErr('');setToast('');
    try {
      const saved = await api('/api/issues/pick',{revision:data.picks?.revision??0,slug:entry.slug,pick:choice});
      setData(saved); refresh?.();
      setUndo({key:Date.now(),slug:entry.slug,before:entry.pick?.pick||null,message:`${entry.slug} ${PICK_WORDS[choice]}.`});
    } catch (e) { setPickErr(pickError(e)); if (e.code==='REVISION_CONFLICT') await load(); }
    finally { setBusy(false); }
  }
  async function undoPick(item) {
    setUndo(null);
    try {
      const fresh = await api('/api/issues');
      const saved = await api('/api/issues/pick',{revision:fresh.picks?.revision??0,slug:item.slug,pick:item.before,undo:true});
      setData(saved); refresh?.();
      setToast(`${item.slug} ${PICK_WORDS[item.before||'none']}.`);
    } catch (e) { setToast(`Undo did not save: ${pickError(e)}`); load(); }
  }

  return <section className="mv-il">
    <StageTabs stageId="issues" go={go} stations={stations} issueStation={issueStationOf(pipeline)}/>
    <header className="mv-il-head">
      <div className="mv-il-head-text">
        <span className="mv-eyebrow"><MessageSquareQuote size={12}/>Step 0 · the issue list · always growing</span>
        <h1 className="mv-h1">Issues</h1>
        <p className="mv-sub">Deep, real problems for many avatars, in their own words. Gemini finds them, every claim is cross-referenced, we check that people want to buy something and Meta isn't crowded for it (I1–I7), and you pick a couple to test. Each tested issue starts a round of product search.</p>
      </div>
      <button type="button" className="mv-link" onClick={()=>openDoc(`${CHECKS_PATH}#${ISSUE_LIST_ANCHOR}`)}><BookOpen size={13}/>How we research issues<ArrowUpRight size={12}/></button>
    </header>

    <div className="mv-il-flow" role="group" aria-label="Show issues by status">
      {FILTERS.map(id=>{const Icon = id==='all'?MessageSquareQuote:STATUS_ICONS[id];const n = id==='all'?counts.total:counts[id];
        return <button key={id} type="button" className={`mv-il-step is-${id}`} aria-pressed={status===id} onClick={()=>setStatus(id)} title={id==='all'?'Every issue':STATUS_HINTS[id]}>
          <Icon size={15}/><span>{id==='all'?'All':STATUS_LABELS[id]}</span><b>{n}</b>
        </button>;})}
    </div>

    {counts.verified>0&&!counts.testing&&<p className="mv-il-callout is-owner"><BadgeCheck size={15}/><span><b>{counts.verified} Verified {counts.verified===1?'issue waits':'issues wait'} for your pick.</b> Test a couple; each starts a round of product search.</span></p>}
    {hint&&<p className="mv-il-callout is-hint"><Info size={15}/><span>{hint}</span></p>}
    {!counts.verified&&!counts.testing&&counts.candidate>0&&<p className="mv-il-callout"><ScanSearch size={15}/><span><b>Nothing to pick yet.</b> {counts.candidate} {counts.candidate===1?'issue is':'issues are'} still being cross-referenced. Open one to see which checks are open.</span></p>}

    <label className="mv-il-search"><Search size={15}/><input className="mv-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search issues, avatars or products" aria-label="Search issues, avatars or products"/></label>
    {pickErr&&!opened&&<p className="mv-il-error" role="alert">{pickErr}</p>}

    {missing?<p className="mv-small mv-il-note">The OS server needs a restart to list issues. The files are in {ISSUES_ROOT}/.</p>
    :error&&!data?<p className="mv-il-error" role="alert">{error}</p>
    :!data?<p className="mv-small mv-il-loading"><LoaderCircle size={14} className="mv-spin"/>Reading the issue files…</p>
    :!entries.length?<div className="mv-card mv-empty"><MessageSquareQuote size={26}/><strong>No issues yet.</strong><span className="mv-small">The buyer researcher starts one in {ISSUES_ROOT}/&lt;issue&gt;/ from a Gemini report and templates/ISSUE.md.</span></div>
    :!shown.length?<div className="mv-card mv-empty"><Search size={24}/><strong>No issues match.</strong><span className="mv-small">Try another status or search.</span>{status!=='all'&&<button type="button" className="mv-btn sm" onClick={()=>setStatus('all')}>Show all issues</button>}</div>
    :<ul className="mv-il-list">{shown.map(entry=><IssueRow key={entry.slug} entry={entry} onOpen={openIssue} onPick={pick} busy={busy}/>)}</ul>}
    {(data?.problems||[]).map(problem=><p key={problem.path} className="mv-small mv-il-note is-warn">{problem.text}</p>)}
    {data?.picks?.error&&<p className="mv-il-error" role="alert">Your saved picks need repair: {data.picks.error}</p>}
    <p className="mv-small mv-il-foot"><CheckCheck size={13}/>Statuses come from the issue files and your picks only. Nothing here is dragged or ticked by hand.</p>

    {opened&&<IssueSheet entry={opened} onClose={close} onPick={pick} busy={busy} openDoc={openDoc} go={go} pipeline={pipeline} error={pickErr}/>}
    {openSlug&&data&&!opened&&<p className="mv-il-error" role="alert">No issue “{openSlug}”. <button type="button" className="mv-link" onClick={close}>Back to the list</button></p>}
    {(undo||toast)&&createPortal(undo?<div key={undo.key} className="mv-toast mv-toast-undoable" role="status"><CheckCheck size={17}/><span>{undo.message}</span><button type="button" className="mv-toast-undo" onClick={()=>undoPick(undo)}><Undo2 size={15}/>Undo</button><span className="mv-toast-timer" aria-hidden="true"/></div>
      :<div className="mv-toast" role="status"><CheckCheck size={17}/>{toast}</div>,document.querySelector('dialog.mv-sheet[open]')||document.body)}
  </section>;
}

