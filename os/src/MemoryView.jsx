import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Scale,Lightbulb,SlidersHorizontal,StickyNote,Pin,PinOff,Archive,Reply,Download,ChevronLeft,ChevronRight,ChevronDown,ChevronUp,Link2,ListTodo,EyeOff,Eye,Search,FileText,ExternalLink,Plus,Route,CircleHelp,ArrowRight,Edit3,History,BookOpen,Check,Users,Sparkle} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {api,Modal,Field} from './ui.jsx';
import {HandoffEditor,NoteResponse} from './SharedMemory.jsx';
import {Avatar,AgentAvatar,agentOf,Chip,Sheet,timeAgo,fileName,isImagePath,assetUrl} from './kit.jsx';

export const KINDS = {
  decision:{label:'Decision',plural:'Decisions',icon:Scale,color:'var(--info)',soft:'var(--info-soft)'},
  lesson:{label:'Lesson',plural:'Lessons',icon:Lightbulb,color:'var(--highlight-text)',soft:'var(--highlight-soft)'},
  preference:{label:'Preference',plural:'Preferences',icon:SlidersHorizontal,color:'var(--special)',soft:'var(--special-soft)'},
  note:{label:'Note',plural:'Notes',icon:StickyNote,color:'var(--muted)',soft:'var(--bg-2)'},
};
const KIND_IDS = Object.keys(KINDS);
const kindOf = note => KINDS[note.kind]?note.kind:'note';
// Journal days use the same timezone as server/memory.mjs.
const dayOf = value => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const noteDay = note => note.day||dayOf(note.date);
const shiftDay = (day,n) => {const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const pretty = (day,opts={weekday:'long',month:'long',day:'numeric'}) => new Date(day+'T12:00:00').toLocaleDateString(undefined,opts);
const imageRoots = /^(products|store\/assets|resources|agents\/image-generator|agents\/validation\/references|agents\/validation\/cases|guides\/rippy-club)\//;

function KindBadge({kind}) {
  const k = KINDS[kind], Icon = k.icon;
  return <span className="mv-kind" style={{background:k.soft,color:k.color}}><Icon size={12}/>{k.label}</span>;
}

/* Memories per journal day, stacked by kind. Click a day to open it. */
function MemoryRiver({notes,day,today,onPick}) {
  const days = useMemo(()=>{
    const first = notes.reduce((min,n)=>noteDay(n)<min?noteDay(n):min,shiftDay(today,-13));
    const out = [];for (let d=first; d<=today; d=shiftDay(d,1)) out.push(d);
    return out.slice(-21);
  },[notes,today]);
  const byDay = useMemo(()=>{const map={};for(const n of notes){const d=noteDay(n);(map[d]=map[d]||{total:0});map[d].total++;map[d][kindOf(n)]=(map[d][kindOf(n)]||0)+1;}return map;},[notes]);
  const max = Math.max(1,...days.map(d=>byDay[d]?.total||0));
  return <div className="mv-river" style={{gridTemplateColumns:`repeat(${days.length},minmax(0,1fr))`}} role="group" aria-label="Memories per day">
    {days.map(d=>{const counts=byDay[d]||{total:0};return <button key={d} className={`mv-river-day ${d===day?'is-selected':''} ${d===today?'is-today':''}`} onClick={()=>onPick(d)} title={`${pretty(d,{weekday:'short',month:'short',day:'numeric'})}: ${counts.total} memor${counts.total===1?'y':'ies'}`}>
      <span className="mv-river-plot">{counts.total>0&&<em>{counts.total}</em>}<span className="mv-river-bar" style={{height:counts.total?`${Math.max(8,Math.sqrt(counts.total/max)*84)}%`:'3px'}}>{KIND_IDS.map(k=>counts[k]?<i key={k} style={{flex:counts[k],background:KINDS[k].color}}/>:null)}</span></span>
      <small>{d===today?'Today':new Date(d+'T12:00:00').getDate()}</small>
    </button>;})}
  </div>;
}

function RefList({refs=[],openDoc,onPreview}) {
  const images = refs.filter(ref=>isImagePath(ref)&&imageRoots.test(ref)), docs = refs.filter(ref=>!images.includes(ref));
  if (!refs.length) return null;
  return <>{images.length>0&&<div className="mv-mem-images">{images.map(ref=><button key={ref} onClick={()=>onPreview(ref)} title={ref}><img src={assetUrl(ref)} alt={fileName(ref)} loading="lazy"/></button>)}</div>}
    {docs.length>0&&<div className="mv-refs">{docs.map(ref=>/^https?:/.test(ref)?<a key={ref} className="mv-ref" href={ref} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{(()=>{try{return new URL(ref).hostname;}catch{return ref;}})()}</span></a>:<button key={ref} className="mv-ref" title={ref} onClick={()=>openDoc(ref)}><FileText size={12}/><span>{fileName(ref)}</span></button>)}</div>}</>;
}

function MemoryCard({note,taskTitle,busy,onChange,onReply,openDoc,onPreview,onTask,clamp=true}) {
  const [open,setOpen] = useState(!clamp);
  const kind = kindOf(note), long = note.text.length>320;
  const waiting = note.author==='owner'&&note.status==='open';
  return <article className={`mv-mem ${note.retired?'is-outdated':''} ${waiting?'is-waiting':''}`} style={{'--kind':KINDS[kind].color}}>
    <header className="mv-mem-head">
      <KindBadge kind={kind}/>
      <span className="mv-mem-topic" title={note.topic}>{note.topic}</span>
      <span className="mv-mem-flags">{note.important&&!note.retired&&<Pin size={13} color="var(--warning)" aria-label="Important"/>}{note.retired&&<Chip tone="muted">Outdated</Chip>}{waiting&&<Chip tone="owner">Waiting for a response</Chip>}</span>
    </header>
    <p className={`mv-mem-text ${!open&&long?'is-clamped':''}`}>{note.text}</p>
    {long&&<button className="mv-link" onClick={()=>setOpen(!open)}>{open?<><ChevronUp size={13}/>Less</>:<><ChevronDown size={13}/>Read all</>}</button>}
    {note.response&&<div className="mv-mem-reply"><Reply size={13}/><div><b>Response</b><p>{note.response}</p></div></div>}
    <RefList refs={note.references} openDoc={openDoc} onPreview={onPreview}/>
    <footer className="mv-mem-foot">
      <span className="mv-mem-who"><Avatar role={note.author==='owner'?'owner':'manager'} size={22}/>{note.author==='owner'?'You':'Agent'} · {timeAgo(note.createdAt||note.date)}</span>
      {note.taskId&&<button className="mv-mem-task" onClick={()=>onTask(note.taskId)} title="Open the linked task"><ListTodo size={12}/>{taskTitle||'Linked task'}</button>}
      <span className="mv-mem-actions">
        <button className="mv-icon-btn" disabled={busy} title={note.important?'Unpin':'Keep as important'} aria-label={note.important?'Unpin':'Keep as important'} onClick={()=>onChange(note,{important:!note.important})}>{note.important?<PinOff size={15}/>:<Pin size={15}/>}</button>
        <button className="mv-icon-btn" disabled={busy} title={note.retired?'Restore relevance':'Mark outdated'} aria-label={note.retired?'Restore relevance':'Mark outdated'} onClick={()=>onChange(note,{retired:!note.retired})}>{note.retired?<Eye size={15}/>:<EyeOff size={15}/>}</button>
        {note.status==='open'&&<button className="mv-btn sm ghost" onClick={()=>onReply(note)}><Reply size={13}/>Respond</button>}
      </span>
    </footer>
  </article>;
}

function Composer({day,tasks,onSave,busy,focusRef}) {
  const [text,setText] = useState(''),[kind,setKind] = useState('note'),[important,setImportant] = useState(false),[more,setMore] = useState(false),[topic,setTopic] = useState(''),[taskId,setTaskId] = useState(''),[refs,setRefs] = useState('');
  async function submit(event){
    event.preventDefault();
    if (await onSave({text,kind,important,topic,taskId,references:refs.split('\n').map(x=>x.trim()).filter(Boolean)})) {setText('');setTopic('');setTaskId('');setRefs('');setImportant(false);setMore(false);}
  }
  return <form className="mv-card mv-composer" onSubmit={submit}>
    <textarea ref={focusRef} className="mv-textarea" rows={3} required maxLength={4000} value={text} onChange={e=>setText(e.target.value)} placeholder={`What should we remember from ${pretty(day,{month:'long',day:'numeric'})}? A decision, a lesson, something you prefer…`} aria-label="New memory"/>
    <div className="mv-composer-row">
      <div className="mv-kind-picker" role="group" aria-label="Memory type">{KIND_IDS.map(id=>{const k=KINDS[id],Icon=k.icon;return <button type="button" key={id} aria-pressed={kind===id} onClick={()=>setKind(id)} style={kind===id?{background:k.soft,color:k.color,borderColor:k.color}:undefined}><Icon size={13}/>{k.label}</button>;})}</div>
      <button type="button" className="mv-toggle" aria-pressed={important} onClick={()=>setImportant(!important)}><Pin size={13}/>Keep important</button>
      <button type="button" className="mv-btn ghost sm" onClick={()=>setMore(!more)}><Link2 size={13}/>Context</button>
      <button className="mv-btn primary sm" disabled={busy||!text.trim()}><Plus size={14}/>Save memory</button>
    </div>
    {more&&<div className="mv-composer-more">
      <label className="mv-field">Topic<input className="mv-input" maxLength={100} value={topic} onChange={e=>setTopic(e.target.value)} placeholder="e.g. Storefront, Research method"/></label>
      <label className="mv-field">Linked task<select className="mv-input" value={taskId} onChange={e=>setTaskId(e.target.value)}><option value="">No linked task</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label>
      <label className="mv-field" style={{gridColumn:'1/-1'}}>Sources<small>Workspace file or web link, one per line.</small><textarea className="mv-textarea" rows={2} value={refs} onChange={e=>setRefs(e.target.value)}/></label>
    </div>}
  </form>;
}

/* ---------- Now: the one short page every agent reads first ---------- */
const NOW_TARGET = 250;
const countWords = value => String(value||'').trim().split(/\s+/).filter(Boolean).length;

function NowCard({workspace,onEdit}) {
  const h = workspace.handoff||{};
  const words = countWords(`${h.summary||''} ${h.nextAction||''} ${h.blockers||''}`);
  const tone = words<=NOW_TARGET?'ok':words<=NOW_TARGET*1.6?'warn':'over';
  const blockers = String(h.blockers||'').split(/(?<=\.)\s+(?=[A-Z])/).map(s=>s.trim()).filter(Boolean);
  return <section className="mv-now">
    <header className="mv-now-head">
      <div><span className="mv-eyebrow">Now · what's true today</span><h2 className="mv-h2">The page every agent reads first</h2></div>
      <div className={`mv-now-meter is-${tone}`} title={`Aim for about ${NOW_TARGET} words`}><span><b>{words}</b> / {NOW_TARGET} words</span><i><em style={{width:`${Math.min(100,words/NOW_TARGET*100)}%`}}/></i></div>
    </header>
    <div className="mv-now-grid">
      <section><span className="mv-now-label"><History size={15}/>Where we are</span><p>{h.summary||'Nothing saved yet.'}</p></section>
      <section className="is-next"><span className="mv-now-label"><ArrowRight size={15}/>Next</span><p>{h.nextAction||'Choose the next useful task in To-do.'}</p></section>
      <section className="is-open"><span className="mv-now-label"><CircleHelp size={15}/>Blocked or waiting</span>{blockers.length?<ul>{blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>:<p>Nothing recorded.</p>}</section>
    </div>
    <footer className="mv-now-foot"><span className="mv-small">{h.updatedAt?`Updated ${timeAgo(h.updatedAt)}`:'Not saved yet'}{tone!=='ok'&&' · Shorten it: rewrite, don\'t add on'}</span><button className="mv-btn" onClick={onEdit}><Edit3 size={14}/>Rewrite Now</button></footer>
  </section>;
}

/* ---------- Lessons: short rules, trying → proven → retired ---------- */
const LESSON_STATUS = {proposed:['Proposed','warn'],trying:['Trying','active'],proven:['Proven','done'],retired:['Retired','muted']};
const scopeLabel = (team,scope) => scope==='everyone'?'Everyone':scope==='manager'?'Manager':agentOf(team,scope)?.name||scope;
const capOf = scope => scope==='everyone'?15:10;

function ScopeAvatar({team,scope,size=26}) {
  if (scope==='everyone') return <span className="mv-avatar mv-scope-all" style={{width:size,height:size}}><Users size={Math.round(size*.5)}/></span>;
  if (scope==='manager') return <Avatar role="manager" size={size}/>;
  return <AgentAvatar agent={agentOf(team,scope)} size={size}/>;
}

function LessonCard({lesson,team,busy,onAct,openDoc}) {
  const [ending,setEnding] = useState(false),[reason,setReason] = useState('');
  const [label,tone] = LESSON_STATUS[lesson.status]||[lesson.status,'muted'];
  const canProve = lesson.status==='trying'&&(lesson.helped>0||['owner','seed'].includes(lesson.source));
  return <article className={`mv-lesson is-${lesson.status}`}>
    <div className="mv-lesson-top"><span className="mv-lesson-id">{lesson.id}</span><Chip tone={tone}>{label}</Chip>{lesson.source==='owner'&&<Chip tone="owner">From you</Chip>}</div>
    <p className="mv-lesson-rule">{lesson.rule}</p>
    <p className="mv-lesson-why">{lesson.why}</p>
    {lesson.learnedFrom&&<p className="mv-lesson-from"><History size={12}/>{lesson.learnedFrom}</p>}
    <div className="mv-lesson-foot">
      <span className="mv-small">{new Date(lesson.learnedOn+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}{lesson.proposedBy&&lesson.proposedBy!=='manager'&&lesson.proposedBy!=='owner'?` · by ${scopeLabel(team,lesson.proposedBy)}`:''}</span>
      {lesson.uses>0?<span className="mv-lesson-uses" title={`Used ${lesson.uses} times; helped ${lesson.helped}`}><i style={{width:`${lesson.helped/lesson.uses*100}%`}}/><b>helped {lesson.helped}/{lesson.uses}</b></span>:lesson.status!=='retired'&&lesson.status!=='proposed'?<span className="mv-small">Not used yet</span>:null}
    </div>
    {lesson.status==='retired'&&lesson.statusNote&&<p className="mv-lesson-note">Retired: {lesson.statusNote}</p>}
    {lesson.references?.length>0&&<div className="mv-refs">{lesson.references.map(ref=>/^https?:/.test(ref)?<a key={ref} className="mv-ref" href={ref} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{(()=>{try{return new URL(ref).hostname;}catch{return ref;}})()}</span></a>:<button key={ref} className="mv-ref" onClick={()=>openDoc(ref)}><FileText size={12}/><span>{fileName(ref)}</span></button>)}</div>}
    {lesson.status!=='retired'&&<div className="mv-lesson-actions">
      {lesson.status==='proposed'&&<button className="mv-btn sm save" disabled={busy} onClick={()=>onAct(lesson,'accept')}><Check size={13}/>Start trying it</button>}
      {canProve&&<button className="mv-btn sm" disabled={busy} onClick={()=>onAct(lesson,'prove')}><Sparkle size={13}/>Mark proven</button>}
      {!ending&&<button className="mv-btn sm ghost" disabled={busy} onClick={()=>setEnding(true)}><Archive size={13}/>{lesson.status==='proposed'?'Decline':'Retire'}</button>}
    </div>}
    {ending&&<form className="mv-lesson-end" onSubmit={e=>{e.preventDefault();onAct(lesson,lesson.status==='proposed'?'decline':'retire',reason.trim());}}>
      <input className="mv-input" autoFocus required maxLength={300} value={reason} onChange={e=>setReason(e.target.value)} placeholder={lesson.status==='proposed'?'Why not? e.g. already covered by LS-004':'Why? e.g. wrong, outdated, merged into another'} aria-label="Reason"/>
      <button className="mv-btn sm" disabled={busy||!reason.trim()}>{lesson.status==='proposed'?'Decline':'Retire'}</button><button type="button" className="mv-btn sm ghost" onClick={()=>{setEnding(false);setReason('');}}>Cancel</button>
    </form>}
  </article>;
}

function LessonSheet({team,lessons,onClose,onSaved}) {
  const scopes = ['everyone','manager',...(team.agents||[]).map(a=>a.id)];
  const [form,setForm] = useState({rule:'',why:'',scope:'everyone',learnedFrom:'',status:'trying'});
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const active = lessons.lessons.filter(l=>l.scope===form.scope&&['trying','proven'].includes(l.status)).length;
  const full = active>=capOf(form.scope);
  async function submit(e){
    e.preventDefault();setBusy(true);setError('');
    try{await api('/api/lessons',{revision:lessons.revision,rule:form.rule.trim(),why:form.why.trim(),scope:form.scope,learnedFrom:form.learnedFrom.trim(),status:full?'proposed':form.status,source:'owner',proposedBy:'owner'});onSaved(full?'Saved as proposed: that list is full, so I\'ll merge or retire one to make room.':'Lesson added. Agents read it before their next job.');}
    catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <Sheet title="Add a lesson" subtitle="One short rule an agent should follow next time, and why." onClose={onClose}>
    <form className="mv-lesson-form" onSubmit={submit}>
      <label className="mv-field">The rule<small>Start with a verb. One sentence.</small><input className="mv-input" required maxLength={200} value={form.rule} onChange={e=>set('rule',e.target.value)} placeholder="e.g. Show me product cards before doing deep checks"/></label>
      <label className="mv-field">Why<input className="mv-input" required maxLength={240} value={form.why} onChange={e=>set('why',e.target.value)} placeholder="What went wrong, or what you prefer"/></label>
      <div className="mv-field">Who it's for<div className="mv-scope-pick">{scopes.map(scope=>{const n=lessons.lessons.filter(l=>l.scope===scope&&['trying','proven'].includes(l.status)).length;return <button type="button" key={scope} aria-pressed={form.scope===scope} onClick={()=>set('scope',scope)}><ScopeAvatar team={team} scope={scope} size={20}/>{scopeLabel(team,scope)}<small>{n}/{capOf(scope)}</small></button>;})}</div></div>
      <label className="mv-field">What happened <small>Optional</small><textarea className="mv-textarea" rows={2} maxLength={300} value={form.learnedFrom} onChange={e=>set('learnedFrom',e.target.value)}/></label>
      <div className="mv-field">Start as<div className="mv-seg" role="group"><button type="button" aria-pressed={form.status==='trying'} onClick={()=>set('status','trying')}>Trying</button><button type="button" aria-pressed={form.status==='proven'} onClick={()=>set('status','proven')}>Proven (I'm sure)</button></div></div>
      {full&&<p className="mv-small" style={{color:'var(--highlight-text)'}}>{scopeLabel(team,form.scope)} already has {capOf(form.scope)} lessons. Yours will be saved as proposed and I'll make room by merging or retiring one.</p>}
      {error&&<div className="mv-error" role="alert">{error}</div>}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}><button type="button" className="mv-btn ghost" onClick={onClose}>Cancel</button><button className="mv-btn primary" disabled={busy}><Plus size={14}/>{busy?'Saving…':'Save lesson'}</button></div>
    </form>
  </Sheet>;
}

function LessonsBoard({team,lessons,busy,onAct,openDoc,onAdd}) {
  const [show,setShow] = useState('active'),[scope,setScope] = useState('all');
  const list = lessons.lessons.filter(l=>(show==='active'?['trying','proven'].includes(l.status):l.status===show)&&(scope==='all'||l.scope===scope));
  const scopes = [...new Set(['everyone','manager',...(team.agents||[]).map(a=>a.id),...lessons.lessons.map(l=>l.scope)])];
  const proposed = lessons.lessons.filter(l=>l.status==='proposed');
  const activeCount = s => lessons.lessons.filter(l=>l.scope===s&&['trying','proven'].includes(l.status)).length;
  return <div>
    <div className="mv-board-bar">
      <div className="mv-filter" role="group" aria-label="Lesson status">{[['active','In use'],['proposed','Proposed'],['retired','Retired']].map(([id,label])=><button key={id} aria-pressed={show===id} onClick={()=>setShow(id)}>{label}<b>{lessons.lessons.filter(l=>id==='active'?['trying','proven'].includes(l.status):l.status===id).length}</b></button>)}</div>
      <button className="mv-btn primary sm" onClick={onAdd}><Plus size={14}/>Add a lesson</button>
    </div>
    {show==='active'&&proposed.length>0&&<button className="mv-proposed-banner" onClick={()=>setShow('proposed')}><Lightbulb size={16}/><span><b>{proposed.length} new lesson{proposed.length===1?'':'s'} proposed by agents.</b> I check them after each job; you can decline any.</span><ArrowRight size={14}/></button>}
    <div className="mv-scope-strip" role="group" aria-label="Who the lessons are for">
      <button aria-pressed={scope==='all'} onClick={()=>setScope('all')}><Users size={14}/>All</button>
      {scopes.map(s=>{const n=activeCount(s),cap=capOf(s);return <button key={s} aria-pressed={scope===s} onClick={()=>setScope(s)}><ScopeAvatar team={team} scope={s} size={20}/>{scopeLabel(team,s)}<span className="mv-cap"><i style={{width:`${Math.min(100,n/cap*100)}%`}}/></span><small>{n}/{cap}</small></button>;})}
    </div>
    {!list.length?<div className="mv-card mv-empty"><Lightbulb size={26}/><strong>{show==='active'?'No lessons here yet.':show==='proposed'?'No proposals waiting.':'Nothing retired.'}</strong><span className="mv-small">{show==='active'?'Lessons come from your corrections and from what agents learn on real jobs.':'Agents propose lessons when they finish a job.'}</span></div>
    :<div className="mv-lesson-groups">{scopes.filter(s=>list.some(l=>l.scope===s)).map(s=>{const items=list.filter(l=>l.scope===s).sort((a,b)=>Number(b.status==='proven')-Number(a.status==='proven')||b.helped-a.helped||b.learnedOn.localeCompare(a.learnedOn));return <section key={s} className="mv-lesson-group">
      <header><ScopeAvatar team={team} scope={s} size={28}/><h3 className="mv-h3">{scopeLabel(team,s)}</h3>{show==='active'&&<span className="mv-small">{items.length} of {capOf(s)}</span>}</header>
      <div className="mv-lesson-grid">{items.map(l=><LessonCard key={l.id} lesson={l} team={team} busy={busy} onAct={onAct} openDoc={openDoc}/>)}</div>
    </section>;})}</div>}
  </div>;
}

/* ---------- What each agent reads ---------- */
function BriefPreview({team,initial}) {
  const [agent,setAgent] = useState(initial||'manager'),[brief,setBrief] = useState(null),[error,setError] = useState('');
  useEffect(()=>{let live=true;setError('');api(`/api/memory/brief?agent=${encodeURIComponent(agent)}`).then(b=>live&&setBrief(b)).catch(e=>live&&setError(e.message));return()=>{live=false;};},[agent]);
  return <div className="mv-brief-wrap">
    <div className="mv-scope-strip" role="group" aria-label="Choose an agent">
      <button aria-pressed={agent==='manager'} onClick={()=>setAgent('manager')}><Avatar role="manager" size={20}/>Manager</button>
      {(team.agents||[]).map(a=><button key={a.id} aria-pressed={agent===a.id} onClick={()=>setAgent(a.id)}><AgentAvatar agent={a} size={20}/>{a.name}</button>)}
    </div>
    {error&&<div className="mv-error">{error}</div>}
    {brief&&<div className="mv-brief">
      <div className="mv-brief-stats">
        <span><b>{brief.words}</b>words · about {Math.max(1,Math.round(brief.words/250))} min to read</span>
        <span><b>{brief.lessons.mine.length}</b>its own lessons</span>
        <span><b>{brief.lessons.everyone.length}</b>lessons for everyone</span>
        <span><b>{brief.tasks.length}</b>open to-dos</span>
      </div>
      <article className="markdown mv-brief-doc"><Markdown remarkPlugins={[remarkGfm]}>{brief.markdown}</Markdown></article>
    </div>}
  </div>;
}

function MemoryLoop({lessons,review,notes,today,tasks,onJump}) {
  const diaryToday = notes.filter(n=>noteDay(n)===today).length;
  const agentJobs = tasks.filter(t=>t.agent&&t.status!=='done').length;
  const steps = [
    {icon:BookOpen,title:'Read first',text:'Now + its lessons',value:review?review.active:'–',unit:'lessons in use',tab:'brief'},
    {icon:Route,title:'Do the work',text:'Using its skills',value:agentJobs,unit:'agent jobs open',tab:null},
    {icon:StickyNote,title:'Write back',text:'Diary line + new lesson?',value:diaryToday,unit:'diary lines today',tab:'diary'},
    {icon:Lightbulb,title:'Review',text:'Keep lessons short and true',value:review?review.proposed:'–',unit:'proposals to check',tab:'lessons',tone:review?.proposed?'warn':''},
  ];
  return <div className="mv-flow" role="list" aria-label="The memory loop">
    {steps.map((step,i)=>{const Icon=step.icon;return <React.Fragment key={step.title}>
      <button role="listitem" className={`mv-flow-step ${step.tone?`is-${step.tone}`:''}`} onClick={()=>step.tab&&onJump(step.tab)}>
        <span className="mv-flow-icon"><Icon size={18}/></span>
        <span className="mv-flow-text"><strong>{step.title}</strong><small>{step.text}</small></span>
        <span className="mv-flow-count"><b>{step.value}</b><small>{step.unit}</small></span>
      </button>
      {i<steps.length-1&&<ArrowRight className="mv-flow-arrow" size={16} aria-hidden="true"/>}
    </React.Fragment>;})}
  </div>;
}

export function MemoryView({data,notify,openDoc,planner,go,route}) {
  const workspace = data.workspace||{revision:0,notes:[],handoff:{},reviews:[]};
  const team = data.team||{agents:[]};
  const notes = workspace.notes||[];
  const today = dayOf(new Date());
  const initialTab = ['now','lessons','diary','brief'].includes(route?.params?.tab)?route.params.tab:'now';
  const [tab,setTab] = useState(initialTab),[day,setDay] = useState(today),[query,setQuery] = useState(''),[kind,setKind] = useState('all'),[diaryView,setDiaryView] = useState('day');
  const [busy,setBusy] = useState(false),[error,setError] = useState(''),[reply,setReply] = useState(null),[editing,setEditing] = useState(false),[portable,setPortable] = useState(null),[preview,setPreview] = useState(null),[adding,setAdding] = useState(false);
  const [lessons,setLessons] = useState(null);
  const composer = useRef(null);
  const tasks = planner?.tasks||[];
  const loadLessons = React.useCallback(async()=>{try{setLessons(await api('/api/lessons'));}catch(e){setError(e.message);}},[]);
  useEffect(()=>{loadLessons();const timer=setInterval(loadLessons,10000);return()=>clearInterval(timer);},[loadLessons]);
  useEffect(()=>{if(route?.params?.tab&&['now','lessons','diary','brief'].includes(route.params.tab))setTab(route.params.tab);},[route?.params?.tab]);
  const taskTitle = id => tasks.find(t=>t.id===id)?.title;
  const matches = n => (kind==='all'||(kind==='pinned'?n.important&&!n.retired:kindOf(n)===kind))&&(!query||[n.text,n.response,n.topic,n.kind,...(n.references||[])].join(' ').toLowerCase().includes(query.toLowerCase()));
  const waiting = notes.filter(n=>n.author==='owner'&&n.status==='open');
  async function change(note,changes){setBusy(true);setError('');try{await api('/api/workspace/notes/'+note.id,{revision:workspace.revision,...changes},'PATCH');notify('Memory updated.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function save(input){setBusy(true);setError('');try{await api('/api/workspace/notes',{...input,author:'owner',day});notify('Saved to the diary.');return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
  async function download(){setError('');try{setPortable((await api('/api/memory/context')).markdown);}catch(e){setError(e.message);}}
  async function act(lesson,action,reason=''){
    let input = {revision:lessons.revision,id:lesson.id};
    if (action==='accept') input.status='trying';
    else if (action==='prove') input.status='proven';
    else {if(!reason)return;input={...input,status:'retired',statusNote:reason.slice(0,300)};}
    setBusy(true);setError('');
    try{setLessons(await api('/api/lessons',input));notify(action==='accept'?'Lesson accepted. Agents start trying it on their next job.':action==='prove'?'Marked proven.':'Lesson retired. Agents stop reading it.');}
    catch(e){setError(e.message);await loadLessons();}
    finally{setBusy(false);}
  }
  const cardProps = {busy,onChange:change,onReply:setReply,openDoc,onPreview:setPreview,onTask:id=>go(`today?task=${id}`)};
  const dayNotes = notes.filter(n=>noteDay(n)===day&&matches(n)).slice().sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)));
  const dayTasks = tasks.filter(t=>dayOf(t.createdAt)===day||(t.completedAt&&dayOf(t.completedAt)===day));
  const dayLessons = (lessons?.lessons||[]).filter(l=>l.learnedOn===day);
  const archive = useMemo(()=>{const groups=new Map();for(const n of notes.filter(matches).slice().reverse()){const d=noteDay(n);if(!groups.has(d))groups.set(d,[]);groups.get(d).push(n);}return [...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0]));},[notes,query,kind]);
  const review = lessons?.review;
  const tabs = [['now','Now',History,null],['lessons','Lessons',Lightbulb,review?review.active:null],['diary','Diary',StickyNote,notes.length],['brief','What agents read',BookOpen,null]];

  return <section>
    <div className="mv-page-head"><div><span className="mv-eyebrow">What we know · what we learned</span><h1 className="mv-h1">Memory</h1><p className="mv-sub">Every agent reads this before it works. It's short on purpose: what's true now, the lessons we've learned, and a diary of what happened.</p></div>
      <div className="mv-page-actions"><button className="mv-btn" onClick={download}><Download size={15}/>Take context with you</button><button className="mv-btn primary" onClick={()=>setAdding(true)} disabled={!lessons}><Plus size={15}/>Add a lesson</button></div></div>

    {/* The three root files every agent reads first (owner, Oct 1 evening). */}
    <nav className="mv-readfirst" aria-label="Read first"><span>Read first</span>{[['AGENTS.md','How we work'],['USER.md','Who you are'],['MEMORY.md','Day by day']].map(([path,hint])=><button key={path} type="button" onClick={()=>openDoc(path)} title={hint}><FileText size={13}/>{path}</button>)}</nav>

    <MemoryLoop lessons={lessons} review={review} notes={notes} today={today} tasks={tasks} onJump={setTab}/>

    <div className="mv-view-tabs" role="group" aria-label="Memory views">
      {tabs.map(([id,label,Icon,count])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}><Icon size={15}/>{label}{count!==null&&<b>{count}</b>}</button>)}
    </div>
    {error&&<div className="mv-error" role="alert" style={{marginBottom:14}}>{error}</div>}

    {tab==='now'&&<div className="mv-now-layout">
      <NowCard workspace={workspace} onEdit={()=>setEditing(true)}/>
      <aside className="mv-stack">
        <section className="mv-card mv-pad"><h3 className="mv-h3" style={{marginBottom:10}}>Needs a look</h3>
          <div className="mv-mini-list">
            <button onClick={()=>setTab('lessons')}><Lightbulb size={15}/><span>Lessons proposed by agents</span><small>{review?.proposed??'–'}</small></button>
            <button onClick={()=>setTab('lessons')}><Sparkle size={15}/><span>Ready to mark proven</span><small>{review?.readyToProve?.length??'–'}</small></button>
            <button onClick={()=>{setTab('diary');setDiaryView('all');setQuery('');setKind('all');}}><Reply size={15}/><span>Your notes waiting for a reply</span><small>{waiting.length}</small></button>
          </div>
        </section>
        <section className="mv-card mv-pad"><h3 className="mv-h3" style={{marginBottom:10}}>Files any agent can read</h3>
          <div className="mv-mini-list">{[['memory/NOW.md','Now'],['memory/LESSONS.md','All lessons'],['memory/START-HERE.md','Manager start page'],['memory/days/INDEX.md','Diary by day']].map(([path,label])=><button key={path} onClick={()=>openDoc(path)}><FileText size={15}/><span>{label}</span><small>{fileName(path)}</small></button>)}</div>
          <p className="mv-small" style={{marginTop:10}}>The old state log and journal are kept as history and no longer grow.</p>
        </section>
      </aside>
    </div>}

    {tab==='lessons'&&(lessons?<LessonsBoard team={team} lessons={lessons} busy={busy} onAct={act} openDoc={openDoc} onAdd={()=>setAdding(true)}/>:<div className="mv-card mv-empty">Loading lessons…</div>)}

    {tab==='brief'&&<BriefPreview key={route?.params?.agent||'manager'} team={team} initial={route?.params?.agent}/>}

    {tab==='diary'&&<>
      <div className="mv-board-bar">
        <div className="mv-seg" role="group" aria-label="Diary view"><button aria-pressed={diaryView==='day'} onClick={()=>setDiaryView('day')}>One day</button><button aria-pressed={diaryView==='all'} onClick={()=>setDiaryView('all')}>Everything</button></div>
        <div className="mv-filter" role="group" aria-label="Filter"><button aria-pressed={kind==='all'} onClick={()=>setKind('all')}>All</button>{KIND_IDS.map(id=><button key={id} aria-pressed={kind===id} onClick={()=>setKind(id)}>{KINDS[id].plural}</button>)}<button aria-pressed={kind==='pinned'} onClick={()=>setKind('pinned')}><Pin size={12}/>Pinned</button></div>
        <label className="mv-search"><Search size={14}/><input className="mv-input" type="search" value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value)setDiaryView('all');}} placeholder="Search the diary" aria-label="Search the diary"/></label>
      </div>
      {diaryView==='day'?<div className="mv-journal">
        <section className="mv-card mv-pad" style={{marginBottom:14}}><MemoryRiver notes={notes} day={day} today={today} onPick={setDay}/></section>
        <div className="mv-journal-day">
          <button className="mv-icon-btn" aria-label="Previous day" onClick={()=>setDay(shiftDay(day,-1))}><ChevronLeft size={17}/></button>
          <div><span className="mv-eyebrow">{day===today?'Today':day<today?'Looking back':'Ahead'}</span><h2 className="mv-h2">{pretty(day)}</h2></div>
          <button className="mv-icon-btn" aria-label="Next day" disabled={day>=today} onClick={()=>setDay(shiftDay(day,1))}><ChevronRight size={17}/></button>
          {day!==today&&<button className="mv-btn sm" onClick={()=>setDay(today)}>Today</button>}
          <input className="mv-input" style={{width:'auto',marginLeft:'auto'}} type="date" value={day} max={today} onChange={e=>e.target.value&&setDay(e.target.value)} aria-label="Diary day"/>
        </div>
        <Composer day={day} tasks={tasks} onSave={save} busy={busy} focusRef={composer}/>
        {(dayTasks.length>0||dayLessons.length>0)&&<div className="mv-day-tasks"><span className="mv-small"><ListTodo size={13}/> Also this day</span>{dayLessons.map(l=><button key={l.id} className="mv-ref" onClick={()=>setTab('lessons')}><Lightbulb size={12} color="var(--highlight-text)"/><span>{l.id} {l.rule}</span></button>)}{dayTasks.slice(0,8).map(t=><button key={t.id} className="mv-ref" onClick={()=>go(`today?task=${t.id}`)}>{t.status==='done'?<Check size={12} color="var(--success)"/>:<Plus size={12}/>}<span>{t.title}</span></button>)}{dayTasks.length>8&&<span className="mv-small">+{dayTasks.length-8} more</span>}</div>}
        {dayNotes.length?<ol className="mv-timeline">{dayNotes.map(n=><li key={n.id} style={{'--kind':KINDS[kindOf(n)].color}}><time>{new Date(n.createdAt||n.date).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}</time><MemoryCard note={n} taskTitle={taskTitle(n.taskId)} {...cardProps}/></li>)}</ol>
        :<div className="mv-card mv-empty"><StickyNote size={26}/><strong>{query||kind!=='all'?'Nothing matches on this day.':'Nothing written this day.'}</strong><span className="mv-small">Pick another day above, or write the first line here.</span></div>}
      </div>
      :<div className="mv-archive">
        {archive.length?archive.map(([d,items])=><ArchiveDay key={d} day={d} items={items} today={today} cardProps={cardProps} taskTitle={taskTitle} onOpenDay={()=>{setDay(d);setDiaryView('day');}}/>)
        :<div className="mv-card mv-empty"><Search size={26}/><strong>Nothing matches.</strong><span className="mv-small">Try another word or filter.</span></div>}
      </div>}
    </>}

    <p className="mv-small" style={{marginTop:18}}>Saved in your workspace. Agents read their brief before each job; memory is not automatic model recall.</p>
    {portable&&<Modal title="Take your context to another agent" onClose={()=>setPortable(null)}><p>Open the same workspace in your other harness and read AGENTS.md plus this page. Sources still need access to the linked files.</p><Field label="Portable context"><textarea readOnly rows={14} value={portable}/></Field><a className="btn primary" download="Merrivy-START-HERE.md" href={'data:text/markdown;charset=utf-8,'+encodeURIComponent(portable)}>Download Markdown</a></Modal>}
    {editing&&<div className="mv-legacy"><HandoffEditor workspace={workspace} onClose={()=>setEditing(false)} onSave={()=>{setEditing(false);notify('Now page saved. Every agent reads it next.');}}/></div>}
    {reply&&<div className="mv-legacy"><NoteResponse workspace={workspace} note={reply} onClose={()=>setReply(null)} onSave={()=>{setReply(null);notify('Response saved with the original note.');}}/></div>}
    {preview&&<Modal wide title={fileName(preview)} onClose={()=>setPreview(null)}><img style={{width:'100%',height:'auto'}} src={assetUrl(preview)} alt={fileName(preview)}/></Modal>}
    {adding&&lessons&&<LessonSheet team={team} lessons={lessons} onClose={()=>setAdding(false)} onSaved={message=>{setAdding(false);notify(message);loadLessons();}}/>}
  </section>;
}

function ArchiveDay({day,items,today,cardProps,taskTitle,onOpenDay}) {
  const [open,setOpen] = useState(null);
  return <section className="mv-archive-day">
    <header><button className="mv-link" style={{textDecoration:'none'}} onClick={onOpenDay}><h3 className="mv-h3">{day===today?'Today':pretty(day)}</h3></button><span className="mv-archive-dots">{items.map(n=><i key={n.id} style={{background:KINDS[kindOf(n)].color,opacity:n.retired?.35:1}} title={KINDS[kindOf(n)].label}/>)}</span><span className="mv-small">{items.length} memor{items.length===1?'y':'ies'}</span></header>
    <div className="mv-archive-rows">{items.map(n=>open===n.id?<MemoryCard key={n.id} note={n} taskTitle={taskTitle(n.taskId)} clamp={false} {...cardProps}/>:<button key={n.id} className={`mv-archive-row ${n.retired?'is-outdated':''}`} onClick={()=>setOpen(n.id)}>
      <KindBadge kind={kindOf(n)}/><span>{n.text}</span>{n.important&&!n.retired&&<Pin size={13} color="var(--warning)"/>}<Avatar role={n.author==='owner'?'owner':'manager'} size={20}/>
    </button>)}</div>
  </section>;
}
