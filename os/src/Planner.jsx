import React,{useEffect,useState} from 'react';
import {Plus,ArrowUpRight,ChevronRight,Flag,BookOpen,Check,Archive,CalendarDays} from 'lucide-react';
import {api,Field,ErrorText,today,date} from './ui.jsx';
import './planner.css';

export const STUDY = 'resources/copywriting/tova/READING-NOTES.md';
const statusLabels={todo:'To do',doing:'In progress',blocked:'Waiting',done:'Done'};
function Reference({path,openDoc}) {
 return /^https?:\/\//.test(path)?<a href={path} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={13}/></a>:<button type="button" onClick={()=>openDoc(path)}><BookOpen size={13}/>{path.split('/').pop().replace(/[-_]/g,' ')}<ArrowUpRight size={13}/></button>;
}
export function Planner({data,notify,openDoc,openMemory,openLibrary,openMap}) {
 const [planner,setPlanner]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[view,setView]=useState('today'),[day,setDay]=useState(today),[title,setTitle]=useState(''),[editing,setEditing]=useState(null),[note,setNote]=useState(''),[audience,setAudience]=useState('all');
 async function load(clearError=false){try{setPlanner(await api('/api/planner'));if(clearError)setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{load();const timer=setInterval(load,5000);return()=>clearInterval(timer);},[]);
 async function save(input){setBusy(true);setError('');try{const next=await api('/api/planner/tasks',input);setPlanner(next);return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
 const tasks=planner?.tasks||[];
 const matches=t=>view==='done'?t.status==='done':view==='later'?t.status!=='done'&&!t.date:view==='upcoming'?t.status!=='done'&&t.date>day:(t.date===day||(t.date&&t.date<day&&t.status!=='done'));
 const visible=tasks.filter(t=>matches(t)&&(audience==='all'||(t.assignee||'shared')===audience||(t.assignee||'shared')==='shared')).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||Number(b.focus)-Number(a.focus)||a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt));
 const open=visible.filter(t=>t.status!=='done'),finished=visible.filter(t=>t.status==='done');
 const handoff=data.workspace?.handoff||{};
 const recentNotes=(data.workspace?.notes||[]).slice(-3).reverse();
 function edit(task){setEditing({...task,assignee:task.assignee||'shared',nextAction:task.nextAction||'',revision:planner.revision,referencesText:task.references.join('\n')});setError('');}
 async function add(e){e.preventDefault();if(await save({revision:planner.revision,title,date:view==='later'?'':day,assignee:audience==='all'?'shared':audience})){setTitle('');if(view==='upcoming'||view==='done')setView('today');}}
 return <section className="planner-page">
  <header className="planner-heading"><div><p className="planner-date">{new Date(day+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})}</p><h1>A little focus. Real progress.</h1></div><button className="quiet-button" onClick={openMap}>Project workflow <ArrowUpRight size={14}/></button></header>
  <div className="planner-layout"><div className="planner-main">
   <div className="planner-tabs" aria-label="Task views">{[['today','Today'],['upcoming','Upcoming'],['later','Someday'],['done','Completed']].map(([id,label])=><button key={id} aria-pressed={view===id} onClick={()=>{setView(id);setEditing(null);}}>{label}</button>)}</div>
   <div className="planner-list-heading"><h2>{view==='today'?'Your plan':view==='upcoming'?'Coming up':view==='later'?'Room for later':'Finished work'}</h2>{view==='today'?<label className="planner-day"><CalendarDays size={14}/><input type="date" aria-label="Plan date" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label>:<span>{visible.length} tasks</span>}</div>
   <div className="planner-audience" aria-label="Task responsibility">{[['all','Together'],['owner','For me'],['agent','For agents']].map(([id,label])=><button key={id} aria-pressed={audience===id} onClick={()=>setAudience(id)}>{label}</button>)}</div>
   <form className="task-capture" onSubmit={add}><Plus size={17}/><input aria-label="New task" placeholder="Add one thing to do…" maxLength={180} required value={title} onChange={e=>setTitle(e.target.value)}/><button disabled={!planner||busy||!title.trim()} type="submit">Add task</button></form>
   <ErrorText error={error}/>{error&&<button className="text-link" onClick={()=>load(true)}>Reload saved tasks</button>}
   {!planner&&!error&&<p className="planner-empty">Loading your plan…</p>}
   {planner&&!visible.length&&<div className="planner-empty"><h3>{view==='done'?'Good work will land here.':'A clear page to start from.'}</h3><p>{view==='today'?'Add a few things that would make today useful.':'Tasks you schedule or finish will appear here.'}</p></div>}
   {open.map(task=><TaskRow key={task.id} task={task} day={day} busy={busy} onToggle={()=>save({revision:planner.revision,id:task.id,status:'done'})} onEdit={()=>edit(task)}/>)}
   {finished.length>0&&<div className="planner-finished"><h3>{view==='done'?'Completed':'Done today'} <span>{finished.length}</span></h3>{finished.map(task=><TaskRow key={task.id} task={task} day={day} busy={busy} onToggle={()=>save({revision:planner.revision,id:task.id,status:'todo'})} onEdit={()=>edit(task)}/>)}</div>}
   {editing&&<form className="task-editor" onSubmit={async e=>{e.preventDefault();if(await save({id:editing.id,revision:editing.revision,title:editing.title,date:editing.date,status:editing.status,focus:editing.focus,assignee:editing.assignee,nextAction:editing.nextAction,notes:editing.notes,references:editing.referencesText.split('\n').map(s=>s.trim()).filter(Boolean)}))setEditing(null);}}>
    <div className="planner-list-heading"><h2>Task details</h2><button type="button" className="text-link" onClick={()=>setEditing(null)}>Close</button></div>
    <Field label="Task"><input required maxLength={180} value={editing.title} onChange={e=>setEditing({...editing,title:e.target.value})}/></Field>
    <div className="form-grid"><Field label="Scheduled for"><input type="date" value={editing.date} onChange={e=>setEditing({...editing,date:e.target.value})}/></Field><Field label="Status"><select value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{Object.entries(statusLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></Field></div>
    <Field label="Responsibility"><select value={editing.assignee} onChange={e=>setEditing({...editing,assignee:e.target.value})}><option value="shared">Together</option><option value="owner">Me</option><option value="agent">Agent</option></select></Field>
    <Field label="Next concrete action"><input maxLength={1500} value={editing.nextAction} onChange={e=>setEditing({...editing,nextAction:e.target.value})}/></Field>
    <label className="planner-focus"><input type="checkbox" checked={editing.focus} onChange={e=>setEditing({...editing,focus:e.target.checked})}/>Make this a priority</label>
    <Field label="Working notes / what finishes this task"><textarea rows={3} maxLength={6000} value={editing.notes} onChange={e=>setEditing({...editing,notes:e.target.value})}/></Field>
    <Field label="References" hint="One workspace file or web URL per line."><textarea rows={2} value={editing.referencesText} onChange={e=>setEditing({...editing,referencesText:e.target.value})}/></Field>
    <div className="planner-references">{editing.references.map(path=><Reference key={path} path={path} openDoc={openDoc}/>)}</div>
    <details className="task-linked-memory"><summary>Linked memories</summary>{(data.workspace?.notes||[]).filter(n=>n.taskId===editing.id).map(n=><p key={n.id}>{n.retired?'Outdated · ':''}{n.text}</p>)}<button type="button" className="text-link" onClick={openMemory}>Open memory to add a linked lesson</button></details>
    <div className="planner-editor-actions"><button type="button" className="quiet-button" onClick={()=>setEditing({...editing,date:''})}>Move to someday</button><button className="btn primary" disabled={busy}>Save task</button></div>
   </form>}
   <p className="planner-footnote">A completed task records work done. Product verification stays in the workflow.</p>
  </div><aside className="planner-side">
   <section className="planner-note"><div className="planner-list-heading"><h2>Keep a thought</h2><button className="icon-button" aria-label="Open memory" onClick={openMemory}><ArrowUpRight size={15}/></button></div><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await api('/api/workspace/notes',{text:note,author:'owner'});setNote('');notify('Saved in shared memory.');}catch(e){setError(e.message);}finally{setBusy(false);}}}><textarea aria-label="Memory note" placeholder="A decision, an idea, something we learned…" maxLength={4000} required rows={4} value={note} onChange={e=>setNote(e.target.value)}/><button className="quiet-button" disabled={busy||!note.trim()}>Save to memory <Plus size={13}/></button></form></section>
   <section className="planner-study"><span className="planner-section-label">ON THE READING DESK</span><h2>Write for a real person.</h2><p>Our copywriting worksheet and the Tova ad study.</p><button className="quiet-button" onClick={()=>openDoc(STUDY)}>Open the study <ArrowUpRight size={14}/></button><button className="text-link" onClick={openLibrary}>Browse library</button></section>
   <section className="planner-continuity"><button className="quiet-button" onClick={()=>openDoc('memory/START-HERE.md')}>Start here for agents <ArrowUpRight size={14}/></button><button className="text-link" onClick={openMemory}>Today's journal & important memory</button></section>
   <section className="planner-continuity"><h2>Where we left off</h2><details><summary>Read the saved handoff <ChevronRight size={14}/></summary><p>{handoff.summary||'No handoff saved yet.'}</p><button className="text-link" onClick={openMemory}>Open memory</button></details>{recentNotes.length>0&&<details><summary>Recent notes <span>{recentNotes.length}</span></summary>{recentNotes.map(n=><p key={n.id}>{n.text}</p>)}</details>}</section>
  </aside></div>
 </section>;
}
function TaskRow({task,day,busy,onToggle,onEdit}) {return <div className={`planner-task ${task.status==='done'?'is-done':''}`}><input aria-label={`${task.status==='done'?'Reopen':'Complete'} ${task.title}`} type="checkbox" checked={task.status==='done'} disabled={busy} onChange={onToggle}/><button className="task-open" onClick={onEdit}><span>{task.title}</span><small>{task.focus&&<><Flag size={11}/> Priority · </>}{task.status==='doing'?'In progress':task.status==='blocked'?'Waiting':task.date&&task.date<day&&task.status!=='done'?'Carried forward':task.date?date(task.date):'Unscheduled'}{' · '+(task.assignee==='owner'?'Me':task.assignee==='agent'?'Agent':'Together')}{task.references.length>0&&` · ${task.references.length} reference${task.references.length===1?'':'s'}`}</small>{task.nextAction&&task.status!=='done'&&<em className="task-next">Next: {task.nextAction}</em>}</button><ChevronRight size={15}/></div>;}

const shelves=[
 ['Copywriting',[['resources/copywriting/native-ads/VISUAL-BOARD.md','Native image lab: study the references','Sacred Oak · Actual ad examples · What changes'],[STUDY,'The Tova ad: what to learn','Historical reference · Read and annotated'],['templates/COPY-BRIEF.md','From buyer evidence to a first draft','Reusable worksheet · Ready to try']]],
 ['Finding a product',[['workflow/AVATAR-ANGLE-RESEARCH.md','Our current research method','Established products · Specific buyer situations'],['workflow/PRE-VERIFICATION-SCREEN.md','Before we go deeper','Seven checks · Owner eye test']]],
 ['Building & learning',[['store/HYDROGEN-POPULATION.md','Populate the accepted storefront','Product inputs → existing template'],['resources/LEARNING-NOTES.md','What we have learned','Decisions, counterexamples and next checks']]],
];
export function StudyLibrary({openDoc,onBrowse,openLearning,openLibrary}) {
 return <section className="study-library"><header className="planner-heading"><div><p className="planner-date">Keep the useful things close.</p><h1>Library</h1></div><button className="quiet-button" onClick={onBrowse}><Archive size={15}/>Browse all files</button></header><button className="study-learn-entry" onClick={()=>openLibrary('learn')}><strong>Learn Skill · Marketing, made visible</strong><span>Avatars, native ads, images, offers and pages. Open the visual learning desk →</span></button><div className="study-intro"><BookOpen size={20}/><p>Read a reference. Try one idea. Save what actually changed.</p></div>{shelves.map(([title,items])=><section className="study-shelf" key={title}><h2>{title}</h2><div>{items.map(([path,name,note])=><button key={path} className="study-row" onClick={()=>openDoc(path)}><span><strong>{name}</strong><small>{note}</small></span><ArrowUpRight size={16}/></button>)}</div></section>)}<button className="quiet-button" onClick={openLearning}>Open the learning log <ArrowUpRight size={14}/></button></section>;
}
