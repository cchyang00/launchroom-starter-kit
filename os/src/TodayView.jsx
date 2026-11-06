import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Plus,Flag,Check,ChevronLeft,ChevronRight,FileText,ExternalLink,ArrowUpRight,ArrowRight,ArchiveRestore,CalendarClock,Brain,Hourglass,X,History,Sunset,Trophy,Bot,StickyNote,Trash2,Users} from 'lucide-react';
import {api} from './ui.jsx';
import {dayLog,taskBuckets,todayPlan,weekAhead,parseQuickAdd,doerOf,shiftDay} from './workflowView.mjs';
import {TASK_STEPS,FOCUS_LIMIT,MANAGER,OWNER,focusRoom,involves,peopleFields,stepName,taskAgents,taskPeople,togglePerson} from './plannerRules.mjs';
import {Sheet,Ring,Chip,Avatar,AgentAvatar,agentOf,localDay,fileName,STAGE_ICONS} from './kit.jsx';
import {CountUp,ReadMore} from './cards.jsx';
import {ProductTag,RoundChip} from './Pipeline.jsx';
import './todo.css';

// To-do: the shared planner between the owner, Claude and the agents (owner, Nov 5: "easily delete things. and
// checkmark things, and make it like an actual to-do and planner between me, and the agents, and maybe even
// multiple agents"). Everything shown comes from saved planner tasks and activity reports (todayPlan in
// workflowView.mjs); nothing here changes a product check. A row ticks off in one tap, deletes with Undo, moves
// to another day and changes who is on it right where it sits.
const STATUSES = [['todo','To do'],['doing','In progress'],['blocked','Waiting'],['done','Done']];
const who = task => task.assignee||'shared';
const weekOf = day => {const d=new Date(day+'T12:00:00');const monday=(d.getDay()+6)%7;return Array.from({length:7},(_,i)=>shiftDay(day,i-monday));};
const dayName = (d,options={weekday:'short',month:'short',day:'numeric'}) => new Date(d+'T12:00:00').toLocaleDateString(undefined,options);
const whenLabel = (date,today) => !date?'Someday':date===today?'Today':date===shiftDay(today,1)?'Tomorrow':dayName(date);
const personName = (id,team) => id==='all'?'Everyone':id===OWNER?'You':id===MANAGER?'Claude':agentOf(team,id)?.name||id;
const doerName = (task,team) => taskPeople(task).map(id=>personName(id,team)).join(' + ');
const Face = ({id,team,size=24}) => id===OWNER?<Avatar role="owner" size={size} title="You"/>:id===MANAGER?<Avatar role="manager" size={size} title="Claude"/>:<AgentAvatar agent={agentOf(team,id)||{id,name:id}} size={size}/>;

function StepTag({id}) {
  const Icon = STAGE_ICONS[id];
  return <span className="mv-td-step" title={`Step: ${stepName(id)}`}>{Icon&&<Icon size={11}/>}{stepName(id)}</span>;
}

function WhoAvatar({task,team,size=24,working=false}) {
  const people = taskPeople(task);
  return <span className="mv-td-who"><span className="mv-tk-faces">{people.slice(0,4).map(id=><Face key={id} id={id} team={team} size={size}/>)}{people.length>4&&<em>+{people.length-4}</em>}</span>{working&&<i className="mv-td-live" title={`${doerName(task,team)} is working now (a live report)`}/>}</span>;
}

/** A small panel beside what opened it. Tap outside or press Escape to close. */
function Pop({onClose,children,className=''}) {
  const ref = useRef(null);
  useEffect(()=>{
    const down = event=>{if(ref.current&&!ref.current.contains(event.target)&&!event.target.closest?.('[data-pop-anchor]'))onClose();};
    const key = event=>{if(event.key==='Escape')onClose();};
    document.addEventListener('pointerdown',down);document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('pointerdown',down);document.removeEventListener('keydown',key);};
  },[onClose]);
  return <div ref={ref} className={`mv-tk-pop ${className}`}>{children}</div>;
}

/** Who is on a task: you, Claude or any mix of the team. */
function PeoplePicker({team,people,onChange,disabled}) {
  const everyone = [OWNER,MANAGER,...(team?.agents||[]).map(agent=>agent.id)];
  return <div className="mv-tk-people" role="group" aria-label="Who is on this task">{everyone.map(id=><button key={id} type="button" disabled={disabled} aria-pressed={people.includes(id)} onClick={()=>onChange(togglePerson(people,id))}><Face id={id} team={team} size={22}/><span>{personName(id,team)}</span>{people.includes(id)&&<Check size={13} strokeWidth={3}/>}</button>)}</div>;
}

/** The row's own tools: which day, and delete. */
function RowTools({task,today,busy,done,actions}) {
  const [open,setOpen] = useState(false);
  const close = useCallback(()=>setOpen(false),[]);
  const pick = date=>{setOpen(false);actions.moveTo(task,date);};
  return <span className="mv-tk-tools">
    {!done&&<span className="mv-tk-anchor">
      <button type="button" data-pop-anchor className="mv-tk-tool" title="Change the day" aria-label={`Change the day of ${task.title}`} aria-expanded={open} onClick={()=>setOpen(!open)}><CalendarClock size={14}/></button>
      {open&&<Pop onClose={close} className="is-day">
        <button type="button" disabled={busy} onClick={()=>pick(today)}>Today</button>
        <button type="button" disabled={busy} onClick={()=>pick(shiftDay(today,1))}>Tomorrow</button>
        <button type="button" disabled={busy} onClick={()=>pick(shiftDay(today,7))}>Next week</button>
        <button type="button" disabled={busy} onClick={()=>pick('')}>Someday</button>
        <label><span>Pick a day</span><input className="mv-input" type="date" defaultValue={task.date||''} onChange={event=>{if(event.target.value)pick(event.target.value);}}/></label>
      </Pop>}
    </span>}
    <button type="button" className="mv-tk-tool is-danger" disabled={busy} title="Delete" aria-label={`Delete ${task.title}`} onClick={()=>actions.remove(task)}><Trash2 size={14}/></button>
  </span>;
}

/** The faces on a row, one tap from changing who is on it. */
function WhoButton({task,team,size,working,busy,actions}) {
  const [open,setOpen] = useState(false);
  const close = useCallback(()=>setOpen(false),[]);
  return <span className="mv-tk-anchor mv-tk-whobtn">
    <button type="button" data-pop-anchor title={`${doerName(task,team)}. Tap to change`} aria-label={`Change who is on ${task.title}. Now: ${doerName(task,team)}`} aria-expanded={open} onClick={()=>setOpen(!open)}><WhoAvatar task={task} team={team} size={size} working={working}/></button>
    {open&&<Pop onClose={close} className="is-who"><PeoplePicker team={team} people={taskPeople(task)} disabled={busy} onChange={people=>actions.setPeople(task,people)}/></Pop>}
  </span>;
}

function TaskCard({task,team,today,working,busy,onToggle,onOpen,actions,variant='',showDate=false}) {
  const done = task.status==='done', compact = variant==='compact'||variant==='mini';
  const live = working&&!done;
  return <article className={`mv-task mv-td-task ${done?'is-done':''} ${task.focus&&!compact?'is-focus':''} ${variant?`is-${variant}`:''}`}>
    <button className={`mv-checkbox ${done?'is-checked':''}`} disabled={busy} aria-label={`${done?'Reopen':'Complete'} ${task.title}`} onClick={onToggle}><Check size={14} strokeWidth={3}/></button>
    <button className="mv-task-main" onClick={onOpen} title={variant==='focus'?undefined:task.nextAction||undefined}>
      <span className="mv-task-title">{task.title}</span>
      {!compact&&<span className="mv-task-meta">
        {task.status==='doing'&&(live?<span className="mv-td-working"><i/>Working now</span>:<Chip tone="active">In progress</Chip>)}
        {task.status==='blocked'&&<Chip tone="owner" icon={Hourglass}>Waiting</Chip>}
        {task.step&&<StepTag id={task.step}/>}
        {task.product&&<ProductTag value={task.product}/>}
        {showDate&&task.date&&task.date!==today&&<Chip tone="muted" icon={CalendarClock}>{dayName(task.date)}</Chip>}
        {showDate&&!task.date&&<Chip tone="muted">Someday</Chip>}
        {task.focus&&variant!=='focus'&&<Chip tone="warn" icon={Flag}>Focus</Chip>}
        {task.references?.length>0&&<Chip tone="muted" icon={FileText}>{task.references.length}</Chip>}
      </span>}
      {task.nextAction&&!done&&variant==='focus'&&<span className="mv-task-next"><b>Next · </b>{task.nextAction}</span>}
    </button>
    <span className="mv-tk-side">
      <RowTools task={task} today={today} busy={busy} done={done} actions={actions}/>
      <WhoButton task={task} team={team} size={compact?20:24} working={live} busy={busy} actions={actions}/>
    </span>
  </article>;
}

function TaskSheet({task,revision,data,onClose,onSave,onDelete,openDoc,go}) {
  const [form,setForm] = useState(()=>({...task,people:taskPeople(task),step:task.step||'',nextAction:task.nextAction||'',notes:task.notes||'',referencesText:(task.references||[]).join('\n')}));
  const [baseRevision] = useState(revision);
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const set = (key,value) => setForm(f=>({...f,[key]:value}));
  const linked = (data.workspace?.notes||[]).filter(note=>note.taskId===task.id);
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    try {await onSave({id:task.id,revision:baseRevision,title:form.title,date:form.date,status:form.status,focus:form.focus,...peopleFields(form.people),step:form.step,nextAction:form.nextAction,notes:form.notes,references:form.referencesText.split('\n').map(s=>s.trim()).filter(Boolean)});onClose();}
    catch (e) {setError(/revision|record changed/i.test(e.message)?'Someone else updated the planner while you edited. Close, reopen the task and apply your change again.':e.message);}
    finally {setBusy(false);}
  }
  return <Sheet title="Task" subtitle={`Created ${new Date(task.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}${task.completedAt?` · done ${new Date(task.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}`:''}`} onClose={onClose}>
    <form onSubmit={submit} style={{display:'grid',gap:16}}>
      <label className="mv-field">Task<input className="mv-input" required maxLength={180} value={form.title} onChange={e=>set('title',e.target.value)}/></label>
      <div className="mv-field">Status<div className="mv-seg mv-td-wrapseg" role="group">{STATUSES.map(([id,label])=><button type="button" key={id} aria-pressed={form.status===id} onClick={()=>set('status',id)}>{label}</button>)}</div></div>
      <div className="mv-field">Who<small>You, Claude or any mix of agents. Claude hands the work to the agents you name.</small><PeoplePicker team={data.team} people={form.people} onChange={people=>set('people',people)}/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:12,alignItems:'end'}}>
        <label className="mv-field">Scheduled for<input className="mv-input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/></label>
        <button type="button" className="mv-toggle" style={{height:38}} aria-pressed={form.focus} onClick={()=>set('focus',!form.focus)} title={`At most ${FOCUS_LIMIT} focus tasks a day`}><Flag size={13}/>Focus</button>
      </div>
      <div className="mv-field">Step<small>Optional: which of the seven steps this moves forward.</small><div className="mv-td-steps" role="group" aria-label="Step">{['',...TASK_STEPS].map(id=>{const Icon=STAGE_ICONS[id];return <button type="button" key={id||'none'} aria-pressed={form.step===id} onClick={()=>set('step',id)}>{Icon&&<Icon size={12}/>}{id?stepName(id):'None'}</button>;})}</div></div>
      {task.product&&<div className="mv-field">Product<small>The product this moves along. Agents set it (--product); open its line from the Pipeline.</small><span><ProductTag value={task.product}/></span></div>}
      <label className="mv-field">Next concrete action<input className="mv-input" maxLength={1500} value={form.nextAction} onChange={e=>set('nextAction',e.target.value)} placeholder="The very next thing to do"/></label>
      <label className="mv-field">Notes · what finishes this task<textarea className="mv-textarea" rows={4} maxLength={6000} value={form.notes} onChange={e=>set('notes',e.target.value)}/></label>
      <label className="mv-field">References<small>One workspace file or web link per line.</small><textarea className="mv-textarea" rows={3} value={form.referencesText} onChange={e=>set('referencesText',e.target.value)}/></label>
      {task.references?.length>0&&<div className="mv-refs">{task.references.map(ref=>/^https?:/.test(ref)?<a key={ref} className="mv-ref" href={ref} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{ref}</span></a>:<button type="button" key={ref} className="mv-ref" onClick={()=>openDoc(ref)}><FileText size={12}/><span>{fileName(ref)}</span></button>)}</div>}
      {linked.length>0&&<div><span className="mv-eyebrow">Linked memories</span>{linked.map(note=><p key={note.id} className="mv-quote">{note.text}</p>)}</div>}
      {error&&<div className="mv-error" role="alert">{error}</div>}
      <div style={{display:'flex',gap:8,justifyContent:'space-between',flexWrap:'wrap'}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" className="mv-btn ghost" onClick={()=>set('date','')}>Move to someday</button><button type="button" className="mv-btn danger" onClick={()=>onDelete(task)}><Trash2 size={14}/>Delete</button></div>
        <div style={{display:'flex',gap:8}}><button type="button" className="mv-btn" onClick={()=>go('memory')}><Brain size={14}/>Add a memory</button><button className="mv-btn primary" disabled={busy}>{busy?'Saving…':'Save task'}</button></div>
      </div>
      <p className="mv-small">Finishing a task records work done. Product checks stay in the workflow and need their own evidence.</p>
    </form>
  </Sheet>;
}

// One line: the words set the details, the chips show what will be saved.
function QuickAdd({tasks,team,today,day,busy,onAdd,inputRef,seed}) {
  const [text,setText] = useState(''),[ignore,setIgnore] = useState([]),[error,setError] = useState('');
  const parsed = useMemo(()=>parseQuickAdd(text,{today,day,agents:team?.agents||[],ignore}),[text,today,day,team,ignore]);
  const token = kind => parsed.tokens.find(item=>item.kind===kind);
  // A lane's + starts a task for that person.
  useEffect(()=>{if(seed?.text){setText(seed.text);setIgnore([]);inputRef?.current?.focus();}},[seed?.nonce]);// eslint-disable-line react-hooks/exhaustive-deps
  const full = parsed.focus&&focusRoom(tasks,parsed.date)===0;
  const named = parsed.agents||[];
  const whoLabel = parsed.assignee==='owner'||named.length?'You':parsed.assignee==='agent'?'Claude':'You + Claude';
  const whoFace = parsed.assignee==='shared'&&!named.length?<span className="mv-td-pair is-tiny"><Avatar role="owner" size={16}/><Avatar role="manager" size={16}/></span>:<Avatar role={parsed.assignee==='agent'?'manager':'owner'} size={16}/>;
  const chip = (kind,label,face,extra='') => {
    const t = token(kind);
    return t?<button type="button" key={kind} className={`mv-td-chip is-token ${extra}`} onClick={()=>setIgnore(list=>[...list,t.key])} title={`Keep “${t.raw}” as a word in the title`} aria-label={`${label}: remove and keep “${t.raw}” as a word`}>{face}{label}<X size={11}/></button>
      :<span key={kind} className={`mv-td-chip ${extra}`}>{face}{label}</span>;
  };
  async function submit(event) {
    event.preventDefault();
    if (!parsed.title) return;
    setError('');
    try {await onAdd(parsed);setText('');setIgnore([]);}
    catch (e) {setError(e.message);}
  }
  return <form className="mv-td-add" onSubmit={submit}>
    <div className="mv-td-add-row">
      <Plus size={18}/>
      <input ref={inputRef} aria-label="New task" placeholder="Add a task, e.g. Check prices tomorrow @scout @checker" maxLength={240} value={text} onChange={e=>{setText(e.target.value);if(!e.target.value)setIgnore([]);setError('');}}/>
      <button className="mv-btn primary sm" disabled={busy||!parsed.title}>Add</button>
    </div>
    {text.trim()?<div className="mv-td-preview" aria-live="polite">
      <span className="mv-td-preview-label">Saves as</span>
      {chip('date',whenLabel(parsed.date,today),<CalendarClock size={12}/>)}
      {(!named.length||parsed.assignee==='shared')&&chip('who',whoLabel,whoFace)}
      {named.map(id=>chip(`agent:${id}`,agentOf(team,id)?.name||id,<AgentAvatar agent={agentOf(team,id)} size={16}/>))}
      {parsed.focus&&chip('focus',full?'Focus is full that day':'Focus',<Flag size={12}/>,full?'is-full':'is-focus')}
      {parsed.step&&chip('step',stepName(parsed.step),React.createElement(STAGE_ICONS[parsed.step],{size:12}),'is-step')}
      {!parsed.title&&<span className="mv-small">Add a few words for the task itself.</span>}
    </div>
    :<p className="mv-td-hint">Words set the details: <code>tomorrow</code> <code>friday</code> <code>someday</code> · <code>!</code> focus · <code>@me</code> <code>@claude</code> <code>@scout @checker</code> · <code>#find</code> to <code>#launch</code></p>}
    {error&&<div className="mv-error" role="alert">{error}</div>}
  </form>;
}

/** Team work by who it's with: Claude, each agent, and agents working together. */
function byDoers(tasks) {
  const groups = new Map();
  for (const task of tasks) {const key = taskPeople(task).filter(id=>id!==OWNER).join('+');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);}
  return [...groups];
}

function Lane({title,face,tasks,empty,render,className='',onAdd,team,grouped=false}) {
  const [all,setAll] = useState(false);
  const open = tasks.filter(task=>task.status!=='done'), done = tasks.filter(task=>task.status==='done');
  return <section className={`mv-td-lane ${className}`} aria-label={title}>
    <header className="mv-td-lane-head">{face}<h2>{title}</h2><b aria-label={`${open.length} open`}>{open.length}</b>{onAdd&&<button type="button" className="mv-tk-laneadd" aria-label={`Add a task to ${title}`} title={`Add a task to ${title}`} onClick={onAdd}><Plus size={14}/></button>}</header>
    {!open.length?<p className="mv-td-lane-empty">{empty}</p>
      :grouped?byDoers(open).map(([key,items])=><div key={key} className="mv-tk-doers">
        <h3><span className="mv-tk-faces">{key.split('+').map(id=><Face key={id} id={id} team={team} size={18}/>)}</span>{key.split('+').map(id=>personName(id,team)).join(' + ')}<b>{items.length}</b></h3>
        <div className="mv-tasks">{items.map(task=>render(task))}</div>
      </div>)
      :<div className="mv-tasks">{open.map(task=>render(task))}</div>}
    {done.length>0&&<div className="mv-td-done">
      {(all?done:done.slice(0,3)).map(task=>render(task,'compact'))}
      {done.length>3&&<button className="mv-link" onClick={()=>setAll(!all)}>{all?'Show less':`${done.length-3} more done`}</button>}
    </div>}
  </section>;
}

function WrapSheet({wrap,team,today,busy,onMove,onClose,onOpen}) {
  const tomorrow = shiftDay(today,1);
  return <Sheet title="Wrap up the day" subtitle={dayName(today,{weekday:'long',month:'long',day:'numeric'})} onClose={onClose}>
    <div className="mv-td-wrapup">
      <div className="mv-td-wrap-ring"><Ring value={wrap.done.length} total={Math.max(1,wrap.done.length+wrap.open.length)} size={84} stroke={8} label={String(wrap.done.length)} sub="done"/><p>{wrap.done.length?`${wrap.done.length} thing${wrap.done.length===1?'':'s'} got done today.`:'Nothing was ticked off today. That happens.'}{wrap.open.length?` ${wrap.open.length} still open.`:' Nothing is left open.'}</p></div>
      <section><h3><Trophy size={14}/>Done today<b>{wrap.done.length}</b></h3>
        {wrap.done.length?<ul className="mv-td-wraplist">{wrap.done.map(task=><li key={task.id}><Check size={13}/><button onClick={()=>onOpen(task)}>{task.title}</button><WhoAvatar task={task} team={team} size={18}/></li>)}</ul>:<p className="mv-small">Finished tasks show here.</p>}
      </section>
      <section><h3><History size={14}/>Still open<b>{wrap.open.length}</b></h3>
        {wrap.open.length?<ul className="mv-td-wraplist">{wrap.open.map(task=><li key={task.id}><span className="mv-td-dot"/><button onClick={()=>onOpen(task)}>{task.title}{task.date<today&&<small> · from {dayName(task.date)}</small>}</button><WhoAvatar task={task} team={team} size={18}/></li>)}</ul>:<p className="mv-small">A clean finish.</p>}
      </section>
      {wrap.open.length>0&&<button className="mv-btn primary" disabled={busy} onClick={()=>onMove(wrap.open.map(task=>task.id),tomorrow)}><ArrowRight size={14}/>Move {wrap.open.length} open task{wrap.open.length===1?'':'s'} to tomorrow</button>}
      <p className="mv-small">Moving only changes the day. Nothing is marked done, and a task keeps its focus flag while tomorrow has room for {FOCUS_LIMIT}.</p>
    </div>
  </Sheet>;
}

/* ---------- One strip for the days ---------- */
function DayStrip({day,today,view,tasks,onPick,onWeek}) {
  const yesterday = shiftDay(today,-1), tomorrow = shiftDay(today,1);
  return <div className="mv-tk-days" role="group" aria-label="Choose a day">
    <button className="mv-icon-btn" aria-label="Previous week" onClick={()=>onWeek(-7)}><ChevronLeft size={17}/></button>
    {weekOf(day).map(d=>{
      const log = dayLog({tasks,day:d}), date = new Date(d+'T12:00:00');
      const weekday = date.toLocaleDateString(undefined,{weekday:'short'});
      const name = d===today?'Today':d===yesterday?'Yesterday':d===tomorrow?'Tomorrow':weekday;
      const done = log.done.length?`${log.done.length} done`:'', open = log.open.length?`${log.open.length} ${d<today?'left':'to do'}`:'';
      const line = (d<today?[done,open]:[open,d===today?done:'']).filter(Boolean).join(' · ');
      const items = tasks.filter(task=>task.date===d);
      return <button key={d} className={`mv-tk-day ${d===today?'is-today':''}`} aria-pressed={view==='day'&&d===day} aria-label={`${name}, ${dayName(d,{month:'long',day:'numeric'})}${line?`: ${line}`:''}`} onClick={()=>onPick(d)}>
        <small className="is-long">{name}</small><small className="is-short">{d===today?'Today':d===yesterday?'Yest.':d===tomorrow?'Tmrw':weekday}</small>
        <b>{date.getDate()}</b>
        <span className="mv-tk-day-line">{line}</span>
        <span className="mv-day-dots">{items.slice(0,5).map(task=><i key={task.id} className={task.status==='done'?'is-done':who(task)==='owner'?'is-owner':''}/>)}</span>
      </button>;
    })}
    <button className="mv-icon-btn" aria-label="Next week" onClick={()=>onWeek(7)}><ChevronRight size={17}/></button>
  </div>;
}

/* ---------- From earlier: a short list that opens up ---------- */
const EARLIER_SHOWN = 4;
function Earlier({tasks,team,busy,today,tomorrow,isWorking,onToggle,onOpen,onMove,onDelete}) {
  const [all,setAll] = useState(false);
  return <section className="mv-td-earlier">
    <header><History size={15}/><h2>From earlier</h2><b>{tasks.length}</b><span>Give each one a day.</span></header>
    <ul>{(all?tasks:tasks.slice(0,EARLIER_SHOWN)).map(task=><li key={task.id} className="mv-td-carried">
      <button className="mv-checkbox" disabled={busy} aria-label={`Complete ${task.title}`} onClick={()=>onToggle(task)}><Check size={14} strokeWidth={3}/></button>
      <button className="mv-td-carried-main" onClick={()=>onOpen(task)} title={task.nextAction||undefined}><strong>{task.title}</strong><small>from {dayName(task.date)}{task.focus?' · focus':''}{task.assignee!=='owner'?` · ${doerName(task,team)}`:''}</small></button>
      <WhoAvatar task={task} team={team} size={22} working={isWorking(task)}/>
      <div className="mv-td-move" role="group" aria-label={`Move ${task.title}`}>
        <button disabled={busy} onClick={()=>onMove([task.id],today)}>Today</button>
        <button disabled={busy} onClick={()=>onMove([task.id],tomorrow)}>Tomorrow</button>
        <button disabled={busy} onClick={()=>onMove([task.id],'')}>Someday</button>
      </div>
      <button type="button" className="mv-tk-tool is-danger" disabled={busy} title="Delete" aria-label={`Delete ${task.title}`} onClick={()=>onDelete(task)}><Trash2 size={14}/></button>
    </li>)}</ul>
    {tasks.length>EARLIER_SHOWN&&<button className="mv-link mv-tk-more" onClick={()=>setAll(!all)}>{all?'Show less':`${tasks.length-EARLIER_SHOWN} more`}</button>}
  </section>;
}

/* ---------- Everyone on the planner, each with what's open; tap one to see only theirs ---------- */
function PeopleStrip({team,tasks,person,onPick}) {
  const everyone = ['all',OWNER,MANAGER,...(team?.agents||[]).map(agent=>agent.id)];
  return <div className="mv-tk-strip" role="group" aria-label="Show one person's tasks">{everyone.map(id=>{
    const count = tasks.filter(task=>involves(task,id)).length;
    return <button key={id} type="button" aria-pressed={person===id} className={count?'':'is-empty'} onClick={()=>onPick(id)}>
      {id==='all'?<span className="mv-tk-allface"><Users size={13}/></span>:<Face id={id} team={team} size={22}/>}
      <span>{personName(id,team)}</span><b>{count}</b>
    </button>;
  })}</div>;
}

/* ---------- The week, a column a day ---------- */
function WeekBoard({day,today,tasks,card,onPick,onAdd}) {
  return <div className="mv-tk-week" aria-label="This week">{weekOf(day).map(d=>{
    const items = tasks.filter(task=>task.date===d).sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||Number(Boolean(b.focus))-Number(Boolean(a.focus)));
    const open = items.filter(task=>task.status!=='done').length;
    return <section key={d} className={`mv-tk-col ${d===today?'is-today':''}`} aria-label={dayName(d,{weekday:'long',month:'long',day:'numeric'})}>
      <header>
        <button type="button" onClick={()=>onPick(d)} title="Open this day"><small>{dayName(d,{weekday:'short'})}</small><b>{Number(d.slice(8))}</b></button>
        {open>0&&<em>{open}</em>}
        <button type="button" className="mv-tk-laneadd" aria-label={`Add a task on ${dayName(d)}`} title={`Add a task on ${dayName(d)}`} onClick={()=>onAdd(d)}><Plus size={14}/></button>
      </header>
      {items.length?<div className="mv-tasks">{items.map(task=>card(task,'mini'))}</div>:<p>Nothing yet</p>}
    </section>;
  })}</div>;
}

/* ---------- Deleted tasks wait here ---------- */
function RecentlyDeleted({tasks,team,busy,onRestore}) {
  if (!tasks.length) return null;
  return <details className="mv-card mv-tk-deleted">
    <summary><Trash2 size={14}/>Recently deleted<b>{tasks.length}</b></summary>
    <ul>{tasks.slice(0,40).map(task=><li key={task.id}><span><strong>{task.title}</strong><small>{doerName(task,team)} · deleted {dayName(localDay(new Date(task.deletedAt)))}{task.deletedBy==='agent'?' by an agent':''}</small></span><button type="button" className="mv-btn sm" disabled={busy} onClick={()=>onRestore(task)}><ArchiveRestore size={13}/>Restore</button></li>)}</ul>
  </details>;
}

/* ---------- What we made: three small tiles; the lists open one tap away ---------- */
function DayLog({log,day,today,team,openTask,openDoc,go,onSaveNote}) {
  const [panel,setPanel] = useState(''),[note,setNote] = useState(''),[saving,setSaving] = useState(false),[error,setError] = useState('');
  const label = dayName(day);
  async function submit(event) {
    event.preventDefault();
    if (!note.trim()) return;
    setSaving(true);setError('');
    try {await onSaveNote(note.trim());setNote('');}
    catch (e) {setError(e.message);}
    finally {setSaving(false);}
  }
  const tiles = [['done',Check,'Done',log.done.length,4],['jobs',Bot,'Agent jobs',log.jobs.length,5],['notes',StickyNote,'Notes',log.notes.length,1]];
  const jobFace = id => id==='manager'||!agentOf(team,id)?<Avatar role="manager" size={22} title="Claude"/>:<AgentAvatar agent={agentOf(team,id)} size={22}/>;
  return <section className="mv-card mv-tk-log" aria-label="What we made">
    <h2 className="mv-h3">What we made<small>{label}</small></h2>
    <div className="mv-tk-logtiles">{tiles.map(([id,Icon,name,count,tile])=><button key={id} type="button" className={`mv-tk-logtile is-tile-${tile}`} disabled={!count} onClick={()=>setPanel(id)}>
      <Icon size={14} strokeWidth={2.4}/><b><CountUp value={count}/></b><small>{name}</small>
    </button>)}</div>
    <form className="mv-tk-note" onSubmit={submit}>
      <input className="mv-input" maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Keep a note for this day…" aria-label="A note for this day"/>
      <button className="mv-btn sm" disabled={saving||!note.trim()}>{saving?'Saving…':'Save'}</button>
    </form>
    {error&&<div className="mv-error" role="alert">{error}</div>}
    <div className="mv-tk-loglinks"><button type="button" className="mv-link" onClick={()=>go('memory')}><Brain size={12}/>Memory & lessons</button><button type="button" className="mv-link" onClick={()=>openDoc('MEMORY.md')}><FileText size={12}/>MEMORY.md</button></div>

    {panel==='done'&&<Sheet title={`Done · ${label}`} subtitle={`${log.done.length} finished`} onClose={()=>setPanel('')}>
      <div className="mv-tk-rows">{log.done.map(task=><button key={task.id} type="button" className="mv-tk-row" onClick={()=>{setPanel('');openTask(task);}}>
        <Check size={15} strokeWidth={2.6}/>
        <span className="mv-tk-row-text"><strong>{task.title}</strong>{task.notes&&<small>{task.notes}</small>}</span>
        <span className="mv-tk-row-side">{task.product&&<ProductTag value={task.product}/>}<WhoAvatar task={task} team={team} size={20}/></span>
      </button>)}</div>
    </Sheet>}
    {panel==='jobs'&&<Sheet title={`Agent jobs · ${label}`} subtitle={`${log.jobs.length} reported`} onClose={()=>setPanel('')}>
      <div className="mv-tk-rows">{log.jobs.map(job=><div key={job.id} className="mv-tk-row">
        {jobFace(job.agent)}
        <span className="mv-tk-row-text"><strong>{job.title||job.id}</strong><small>{job.agent==='manager'?'Claude':agentOf(team,job.agent)?.name||job.agent||'Agent'}</small></span>
        <span className="mv-tk-row-side"><Chip tone={job.status==='completed'?'done':job.status==='running'?'active':job.status==='blocked'?'owner':'muted'}>{job.status==='completed'?'Done':job.status==='running'?'Working':job.status==='blocked'?'Needs input':job.status}</Chip></span>
      </div>)}</div>
      <div className="mv-tk-loglinks" style={{marginTop:12}}><button type="button" className="mv-link" onClick={()=>go('agents?tab=reports')}>All reports<ArrowRight size={12}/></button></div>
    </Sheet>}
    {panel==='notes'&&<Sheet title={`Notes · ${label}`} subtitle={`${log.notes.length} saved`} onClose={()=>setPanel('')}>
      <div className="mv-tk-rows">{log.notes.map(item=><div key={item.id} className="mv-tk-row mv-tk-noterow" style={{gridTemplateColumns:'auto minmax(0,1fr)'}}>
        <Chip tone="muted">{item.kind||'note'}</Chip>
        <ReadMore text={item.text} lines={3}/>
      </div>)}</div>
    </Sheet>}
  </section>;
}

export function TodayView(props) {
  const {data,planner,plannerError,activity,saveTask,moveTasks,deleteTasks,restoreTasks,notify,openDoc,route,go,current,day:realToday} = props;
  const [day,setDay] = useState(realToday),[view,setView] = useState('day');
  const [person,setPerson] = useState('all'),[seed,setSeed] = useState(null),[weekAdd,setWeekAdd] = useState(''),[undo,setUndo] = useState(null);
  const undoTimer = useRef(null);
  useEffect(()=>()=>clearTimeout(undoTimer.current),[]);
  const [busy,setBusy] = useState(false),[error,setError] = useState(''),[wrapOpen,setWrapOpen] = useState(false);
  const capture = useRef(null);
  const tasks = planner?.tasks||[], team = data.team;
  const openTask = tasks.find(task=>task.id===route?.params?.task);
  useEffect(()=>{if(route?.params?.add)capture.current?.focus();},[route?.params?.add]);
  const buckets = useMemo(()=>taskBuckets(tasks,realToday),[tasks,realToday]);
  const plan = useMemo(()=>todayPlan({tasks,day,today:realToday,activity}),[tasks,day,realToday,activity]);
  const week = useMemo(()=>weekAhead(tasks,realToday),[tasks,realToday]);
  const working = new Set(plan.working);
  const isWorking = task => task.assignee==='agent'&&(taskAgents(task).some(id=>working.has(id))||working.has(doerOf(task)));
  const yesterday = shiftDay(realToday,-1);
  const tomorrow = shiftDay(realToday,1);

  const notes = data?.workspace?.notes;
  const log = useMemo(()=>dayLog({tasks,notes:notes||[],reports:activity||[],day}),[tasks,notes,activity,day]);

  async function run(work,message) {
    setBusy(true);setError('');
    try {const result = await work();if(message)notify(typeof message==='function'?message(result):message);return true;}
    catch (e) {setError(e.message);return false;}
    finally {setBusy(false);}
  }
  const toggle = task => run(()=>saveTask({revision:planner.revision,id:task.id,status:task.status==='done'?'todo':'done'}),task.status==='done'?'Task reopened.':'Done. Nice work.');
  const where = date => !date?'someday':date===realToday?'today':date===tomorrow?'tomorrow':dayName(date);
  const move = (ids,date) => run(()=>moveTasks({revision:planner.revision,ids,date}),({moved,unflagged})=>{
    const base = `Moved ${moved.length===1?'it':`${moved.length} tasks`} to ${where(date)}.`;
    return unflagged.length?`${base} ${unflagged.length===1?'One task':`${unflagged.length} tasks`} moved without the focus flag: that day already has ${FOCUS_LIMIT}.`:base;
  });
  const add = parsed => saveTask({revision:planner.revision,title:parsed.title,date:parsed.date,assignee:parsed.assignee,agents:parsed.agents,focus:parsed.focus,step:parsed.step})
    .then(()=>notify(view==='day'&&parsed.date===day?'Added.':`Added for ${where(parsed.date)}.`));
  const open = task => go(`today?task=${task.id}`);
  const setPeople = (task,people) => run(()=>saveTask({revision:planner.revision,id:task.id,...peopleFields(people)}));
  const moveTo = (task,date) => move([task.id],date);
  async function remove(task) {
    const gone = await run(()=>deleteTasks({revision:planner.revision,ids:[task.id]}));
    if (!gone) return;
    if (route?.params?.task===task.id) go('today');
    clearTimeout(undoTimer.current);
    setUndo({id:task.id,title:task.title});
    undoTimer.current = setTimeout(()=>setUndo(null),7000);
  }
  const restore = id => run(()=>restoreTasks({revision:planner.revision,ids:[id]}),'Task restored.');
  const undoDelete = async ()=>{clearTimeout(undoTimer.current);const id = undo.id;setUndo(null);await restore(id);};
  const actions = {setPeople,moveTo,remove};
  const startFor = id => setSeed({text:id===OWNER?'@me ':id===MANAGER?'@claude ':id==='shared'?'@us ':`@${id} `,nonce:Date.now()});
  const startOnDay = date => {setWeekAdd(date);capture.current?.focus();};
  const pickDay = date => {setDay(date);setView('day');};
  const saveNote = async text => {await api('/api/workspace/notes',{text,author:'owner',day});props.refresh?.();notify('Note saved.');};
  const card = (task,variant='',extra={}) => <TaskCard key={task.id} task={task} team={team} today={realToday} working={isWorking(task)} busy={busy} variant={variant} onToggle={()=>toggle(task)} onOpen={()=>open(task)} actions={actions} {...extra}/>;

  // One person's view: the same page, showing only the tasks they are on.
  const seen = task => involves(task,person);
  const shown = person==='all'?plan:{...plan,focus:plan.focus.filter(seen),focusDone:plan.focusDone.filter(seen),carried:plan.carried.filter(seen),lanes:{you:plan.lanes.you.filter(seen),team:plan.lanes.team.filter(seen),together:plan.lanes.together.filter(seen)}};
  const shownBuckets = person==='all'?buckets:{...buckets,upcoming:buckets.upcoming.filter(seen),someday:buckets.someday.filter(seen),done:buckets.done.filter(seen)};
  const onThisDay = tasks.filter(task=>task.date===day&&seen(task));
  const ringDone = onThisDay.filter(task=>task.status==='done').length, ringTotal = onThisDay.length+shown.carried.length;
  const thisWeek = weekOf(day);
  const scope = view==='day'?[...plan.carried,...tasks.filter(task=>task.date===day&&task.status!=='done')]:view==='week'?tasks.filter(task=>thisWeek.includes(task.date)&&task.status!=='done'):view==='upcoming'?buckets.upcoming:view==='someday'?buckets.someday:buckets.done;

  const dayOpen = plan.total-plan.done;
  const views = [['day',day===realToday?'Today':day===yesterday?'Yesterday':day===tomorrow?'Tomorrow':`${dayName(day,{weekday:'short'})} ${Number(day.slice(8))}`,dayOpen],['week','Week',tasks.filter(task=>thisWeek.includes(task.date)&&task.status!=='done').length],['upcoming','Upcoming',buckets.upcoming.length],['someday','Someday',buckets.someday.length],['done','Done',buckets.done.length]];
  const canAdd = !!planner&&view!=='done';
  const addDay = view==='someday'?'':view==='upcoming'?tomorrow:view==='week'?(weekAdd||realToday):plan.past?realToday:day;
  // The header chip is the pipeline's round and focus move (pipelineState); each product has its own line.
  const pipeline = current?.pipeline;
  const hasDay = shown.focus.length+shown.focusDone.length+shown.carried.length+shown.lanes.you.length+shown.lanes.team.length+shown.lanes.together.length>0;

  return <section className="mv-td mv-tk">
    <div className="mv-today-head">
      <div>
        <span className="mv-eyebrow">{day===realToday?'Today':day===yesterday?'Yesterday · what we did':day<realToday?'Looking back':day===tomorrow?'Tomorrow · what we plan next':'Planning ahead'}</span>
        <h1 className="mv-h1">To-do</h1>
        <div className="mv-tk-sub">
          <span>{dayName(day,{weekday:'long',month:'long',day:'numeric'})}</span>
          <RoundChip pipeline={pipeline} current={current} go={go}/>
        </div>
      </div>
      <Ring value={ringDone} total={Math.max(1,ringTotal)} size={76} stroke={8} label={`${ringDone}/${ringTotal}`} sub="done"/>
    </div>

    <DayStrip day={day} today={realToday} view={view} tasks={tasks} onPick={pickDay} onWeek={n=>setDay(shiftDay(day,n))}/>

    <div className="mv-tk-bar">
      <div className="mv-td-views">
        <div className="mv-seg" role="group" aria-label="Task views">{views.map(([id,label,count])=><button key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}<span className="mv-small">{count}</span></button>)}</div>
        {view==='day'&&day!==realToday&&<button className="mv-link" onClick={()=>setDay(realToday)}>Back to today<ArrowUpRight size={12}/></button>}
      </div>
      {canAdd&&<QuickAdd tasks={tasks} team={team} today={realToday} day={addDay} busy={busy} inputRef={capture} onAdd={add} seed={seed}/>}
    </div>
    <PeopleStrip team={team} tasks={scope} person={person} onPick={setPerson}/>
    {(error||plannerError)&&<div className="mv-error mv-tk-error" role="alert">{error||plannerError}</div>}

    {view==='day'&&planner&&plan.past&&<div className="mv-td-past"><History size={15}/>Looking back at what was planned. New tasks go on today.</div>}
    {view==='day'&&planner&&(shown.focus.length>0||shown.focusDone.length>0||(!plan.past&&person==='all'))&&<section className="mv-td-focus" aria-label={`${plan.isToday?'Today':'This day'}'s focus`}>
      <header><Flag size={16}/><h2>{plan.isToday?'Today\'s focus':'Focus for this day'}</h2><span>{shown.focus.length?`If only these get done, ${plan.past?'it':'today'} was a win.`:shown.focusDone.length?'Focus done. That was a win.':`Pick up to ${FOCUS_LIMIT}: type ! when you add one.`}</span><b>{shown.focus.length}/{FOCUS_LIMIT}</b></header>
      {shown.focus.length>0&&<div className="mv-td-focus-grid">{shown.focus.map(task=>card(task,'focus'))}
        {!plan.past&&person==='all'&&plan.focusRoom>0&&plan.focus.length<FOCUS_LIMIT&&<div className="mv-td-slot"><span>Room for {plan.focusRoom} more. Add <code>!</code> to a task.</span></div>}
      </div>}
      {shown.focusDone.length>0&&<div className="mv-td-wins"><Trophy size={13}/><span>Done:</span>{shown.focusDone.map(task=><button key={task.id} onClick={()=>open(task)} title={task.title}><Check size={11} strokeWidth={3}/><span>{task.title}</span></button>)}</div>}
    </section>}

    {view==='week'&&planner&&<WeekBoard day={day} today={realToday} tasks={tasks.filter(seen)} card={card} onPick={pickDay} onAdd={startOnDay}/>}

    {view!=='week'&&<div className="mv-today-layout">
      <div className="mv-td-main">
        {!planner?<div className="mv-card mv-empty">Loading your plan…</div>
        :view==='day'?<div className="mv-td-day">
          {shown.carried.length>0&&<Earlier tasks={shown.carried} team={team} busy={busy} today={realToday} tomorrow={tomorrow} isWorking={isWorking} onToggle={toggle} onOpen={open} onMove={move} onDelete={remove}/>}

          {!hasDay&&!plan.isToday?<div className="mv-card mv-empty"><Check size={26}/><strong>A clear page.</strong><span className="mv-small">{plan.past?'Nothing was planned for this day.':'Nothing planned yet. Add something above.'}</span></div>
          :<>
            <div className="mv-td-lanes">
              <Lane title="You" face={<Avatar role="owner" size={26} title="You"/>} tasks={shown.lanes.you} empty={plan.isToday?'Nothing just for you today.':'Nothing just for you.'} render={card} className="is-you" onAdd={()=>startFor(OWNER)}/>
              <Lane title="Claude and the team" face={<Avatar role="manager" size={26} title="Claude"/>} tasks={shown.lanes.team} empty="No agent work planned." render={card} className="is-team" team={team} grouped onAdd={()=>startFor(MANAGER)}/>
            </div>
            {shown.lanes.together.length>0&&<Lane title="Together" face={<span className="mv-td-pair"><Avatar role="owner" size={24}/><Avatar role="manager" size={24}/></span>} tasks={shown.lanes.together} empty="" render={card} className="is-together" onAdd={()=>startFor('shared')}/>}
          </>}

          {plan.wrap&&<div className="mv-td-wrap"><button className="mv-btn ghost" onClick={()=>setWrapOpen(true)}><Sunset size={15}/>Wrap up the day</button><span className="mv-small">See what got done and move what is left to tomorrow.</span></div>}
        </div>
        :<><PlainList view={view} buckets={shownBuckets} card={card}/>{view==='done'&&<RecentlyDeleted tasks={planner.deleted||[]} team={team} busy={busy} onRestore={task=>restore(task.id)}/>}</>}
      </div>

      <aside className="mv-today-side">
        <DayLog key={day} log={log} day={day} today={realToday} team={team} openTask={open} openDoc={openDoc} go={go} onSaveNote={saveNote}/>
        <section className="mv-card mv-pad mv-td-week">
          <div className="mv-panel-title" style={{marginBottom:8}}><h2 className="mv-h3">This week</h2><button className="mv-link" onClick={()=>setView('upcoming')}>All<ArrowUpRight size={12}/></button></div>
          {week.groups.length?week.groups.map(group=><div key={group.date} className="mv-td-weekday">
            <button className="mv-td-weekday-label" onClick={()=>pickDay(group.date)}><b>{dayName(group.date,{weekday:'short'})}</b>{dayName(group.date,{month:'short',day:'numeric'})}<span>{group.tasks.length}</span></button>
            <div className="mv-mini-list">{group.tasks.slice(0,3).map(task=><button key={task.id} onClick={()=>open(task)}><WhoAvatar task={task} team={team} size={18}/><span>{task.title}</span>{task.focus?<Flag size={11}/>:<i/>}</button>)}
              {group.tasks.length>3&&<button className="mv-td-more" onClick={()=>pickDay(group.date)}>+{group.tasks.length-3} more</button>}</div>
          </div>):<p className="mv-small" style={{margin:0}}>Nothing planned for the next 7 days.</p>}
          {(week.later>0||week.someday>0)&&<p className="mv-td-weekfoot">{week.later>0&&<button className="mv-link" onClick={()=>setView('upcoming')}>{week.later} later</button>}{week.someday>0&&<button className="mv-link" onClick={()=>setView('someday')}>{week.someday} someday</button>}</p>}
        </section>
        <section className="mv-handoff"><span className="mv-eyebrow" style={{color:'var(--highlight-text)'}}>Where we left off</span><p>{data.workspace?.handoff?.summary||data.workspace?.handoff?.nextAction||'No handoff saved yet.'}</p><button className="mv-link" style={{marginTop:10}} onClick={()=>go('memory')}>Open the Now page<ArrowUpRight size={12}/></button></section>
      </aside>
    </div>}
    {undo&&<div className="mv-tk-undo" role="status"><Trash2 size={14}/><span>Deleted “{undo.title}”</span><button type="button" onClick={undoDelete}>Undo</button></div>}
    {openTask&&<TaskSheet key={openTask.id} task={openTask} revision={planner.revision} data={data} onClose={()=>go('today')} onSave={input=>saveTask(input).then(()=>notify('Task saved.'))} onDelete={remove} openDoc={openDoc} go={go}/>}
    {wrapOpen&&plan.wrap&&<WrapSheet wrap={plan.wrap} team={team} today={realToday} busy={busy} onClose={()=>setWrapOpen(false)} onOpen={task=>{setWrapOpen(false);open(task);}} onMove={async(ids,date)=>{if(await move(ids,date))setWrapOpen(false);}}/>}
  </section>;
}

function PlainList({view,buckets,card}) {
  const groups = useMemo(()=>{
    if (view==='upcoming') {
      const byDate = new Map();
      for (const task of [...buckets.upcoming].sort((a,b)=>a.date.localeCompare(b.date)||Number(Boolean(b.focus))-Number(Boolean(a.focus)))) {if(!byDate.has(task.date))byDate.set(task.date,[]);byDate.get(task.date).push(task);}
      return [...byDate].map(([date,items])=>[dayName(date,{weekday:'long',month:'short',day:'numeric'}),items]);
    }
    if (view==='done') {
      const byDay = new Map();
      for (const task of [...buckets.done].sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))) {const d=task.completedAt?localDay(new Date(task.completedAt)):'';if(!byDay.has(d))byDay.set(d,[]);byDay.get(d).push(task);}
      return [...byDay].map(([d,items])=>[d?`Finished ${dayName(d,{weekday:'long',month:'short',day:'numeric'})}`:'Finished',items]);
    }
    return [[null,[...buckets.someday].sort((a,b)=>Number(Boolean(b.focus))-Number(Boolean(a.focus))||String(a.createdAt).localeCompare(String(b.createdAt)))]];
  },[view,buckets]);
  if (!groups.some(([,items])=>items.length)) return <div className="mv-card mv-empty"><Check size={26}/><strong>{view==='done'?'Finished work will land here.':'Nothing here yet.'}</strong><span className="mv-small">{view==='someday'?'Ideas without a day wait here. Type someday when you add one.':view==='upcoming'?'Tasks for later days show here.':''}</span></div>;
  return <div className="mv-task-groups">{groups.map(([label,items])=><div key={label||'all'} className="mv-task-group">{label&&<h3>{label}<b>{items.length}</b></h3>}<div className="mv-tasks">{items.map(task=>card(task,'',{showDate:view==='someday'}))}</div></div>)}</div>;
}
