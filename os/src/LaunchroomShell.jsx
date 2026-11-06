import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {ChevronsUpDown,Check,LayoutGrid,Globe,Plus,LogOut,Users,UserPlus,Copy,LoaderCircle,X,ArrowRight,Lock} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,Chip} from './kit.jsx';
import {projectMark,projectHref,workProjects,accessOf,accessRows,accessChanges,authMessage,SHARED_ID} from './launchroomModel.mjs';

/**
 * Launchroom's shell pieces, shared by every project and the Launchroom home
 * (owner, Oct 1: "Make Launchroom feel like one coherent application"): the
 * project switcher at the top of the sidebar, the account menu at its foot,
 * People & access and New project as sheets. Access is decided by the server
 * on every request; these controls only show what the saved records allow.
 */
export const LaunchroomContext = createContext(null);
export const useLaunchroom = () => useContext(LaunchroomContext);

/** Launchroom API calls: the server's error code travels with the error (LS-073); a dropped connection is marked. */
export async function lrApi(url,body,method) {
  try {return await api(url,body,method);}
  catch (error) {if (error instanceof TypeError) error.network = true;throw error;}
}

export function ProjectMark({project,size=26,all=false}) {
  if (all) return <span className="mv-lr-mark is-all" style={{width:size,height:size}} aria-hidden="true"><LayoutGrid size={Math.round(size*.55)}/></span>;
  const mark = projectMark(project);
  return <span className={`mv-lr-mark ${mark.shared?'is-shared':''}`} style={{width:size,height:size,background:mark.bg,color:mark.ink,fontSize:Math.round(size*(mark.initials.length>1?.38:.5))}} aria-hidden="true">{mark.shared?<Globe size={Math.round(size*.56)}/>:mark.initials}</span>;
}

export function AccessChip({project}) {
  const access = accessOf(project);
  return <span className={`mv-lr-access is-${access.kind}`}>{access.kind==='shared'?<Globe size={12}/>:<Lock size={12}/>}{access.label}</span>;
}

// A small popover that closes on an outside click or Escape.
function usePopover() {
  const [open,setOpen] = useState(false), ref = useRef(null);
  useEffect(()=>{
    if (!open) return;
    const onDown = event => {if (ref.current&&!ref.current.contains(event.target)) setOpen(false);};
    const onKey = event => {if (event.key==='Escape') setOpen(false);};
    document.addEventListener('pointerdown',onDown);document.addEventListener('keydown',onKey);
    return ()=>{document.removeEventListener('pointerdown',onDown);document.removeEventListener('keydown',onKey);};
  },[open]);
  return {open,setOpen,ref};
}

/**
 * The project switcher: the current project's mark and name (or All projects /
 * Shared library on the Launchroom home), and a menu of every project you can open.
 * `place` is "side" (the dark sidebar) or "top" (the phone top bar).
 */
export function ProjectSwitcher({place='side'}) {
  const lr = useLaunchroom();
  const {open,setOpen,ref} = usePopover();
  if (!lr) return null;
  const here = lr.project?lr.project.id:lr.place||'all';
  const current = lr.project || (here===SHARED_ID?lr.projects.find(p=>p.id===SHARED_ID)||{id:SHARED_ID,name:'Shared library',kind:'shared'}:null);
  const projects = workProjects(lr.projects);
  return <div className={`mv-lr-switch is-${place}`} ref={ref}>
    <button className="mv-lr-switch-btn" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)} title="Switch project">
      {current?<ProjectMark project={current} size={place==='top'?24:28}/>:<ProjectMark all size={place==='top'?24:28}/>}
      <span className="mv-lr-switch-name"><strong>{current?current.name:'All projects'}</strong>{place==='side'&&<small>{current?(here===SHARED_ID?'Shared with everyone':'Project'):'Launchroom home'}</small>}</span>
      <ChevronsUpDown size={15} className="mv-lr-switch-caret"/>
    </button>
    {open&&<div className="mv-lr-menu" role="menu" aria-label="Projects">
      <div className="mv-lr-menu-label">Your projects</div>
      {projects.map(project=><a key={project.id} role="menuitem" className="mv-lr-menu-item" href={projectHref(project.id)} aria-current={here===project.id?'true':undefined}><ProjectMark project={project} size={22}/><span>{project.name}</span>{here===project.id&&<Check size={15}/>}</a>)}
      {!projects.length&&<p className="mv-lr-menu-empty">No projects yet.</p>}
      <div className="mv-lr-menu-sep"/>
      <a role="menuitem" className="mv-lr-menu-item" href="/" aria-current={here==='all'?'true':undefined}><ProjectMark all size={22}/><span>All projects</span>{here==='all'&&<Check size={15}/>}</a>
      <a role="menuitem" className="mv-lr-menu-item is-shared" href={projectHref(SHARED_ID)} aria-current={here===SHARED_ID?'true':undefined}><ProjectMark project={{id:SHARED_ID,kind:'shared'}} size={22}/><span>Shared library</span>{here===SHARED_ID&&<Check size={15}/>}</a>
      <div className="mv-lr-menu-sep"/>
      <button role="menuitem" className="mv-lr-menu-item" onClick={()=>{setOpen(false);lr.openNewProject();}}><span className="mv-lr-mark is-add" style={{width:22,height:22}}><Plus size={13}/></span><span>New project</span></button>
    </div>}
  </div>;
}

const firstName = name => String(name||'').replace(/\s*\(.*\)\s*$/,'').trim().split(/\s+/)[0]||'';
export const greetingName = firstName;
const initialsOf = name => String(name||'?').replace(/\(.*\)/,'').trim().split(/\s+/).slice(0,2).map(word=>[...word][0]||'').join('').toUpperCase()||'?';

/** The account at the foot of the sidebar: People & access (owner/admin only) and Sign out. */
export function AccountMenu() {
  const lr = useLaunchroom();
  const {open,setOpen,ref} = usePopover();
  if (!lr?.user) return null;
  const admin = lr.user.role==='admin';
  return <div className="mv-lr-account" ref={ref}>
    {open&&<div className="mv-lr-menu is-up" role="menu" aria-label="Account">
      <div className="mv-lr-menu-who"><strong>{lr.user.name}</strong><small>@{lr.user.username} · {admin?'Owner':'Member'}</small></div>
      {admin&&<button role="menuitem" className="mv-lr-menu-item" onClick={()=>{setOpen(false);lr.openPeople();}}><Users size={16}/><span>People &amp; access</span></button>}
      <button role="menuitem" className="mv-lr-menu-item" onClick={()=>{setOpen(false);lr.signOut();}}><LogOut size={16}/><span>Sign out</span></button>
    </div>}
    <button className="mv-lr-account-btn" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(!open)}>
      <span className="mv-lr-avatar">{initialsOf(lr.user.name)}</span>
      <span className="mv-lr-switch-name"><strong>{lr.user.name}</strong><small>{admin?'Owner':'Member'}</small></span>
      <ChevronsUpDown size={15} className="mv-lr-switch-caret"/>
    </button>
  </div>;
}

/** New project: a name, nothing else. The project opens straight away. */
export function NewProjectSheet({onClose}) {
  const [name,setName] = useState(''),[busy,setBusy] = useState(false),[error,setError] = useState('');
  async function create(event) {
    event.preventDefault();
    if (!name.trim()) return setError('Give the project a name.');
    setBusy(true);setError('');
    try {const project = await lrApi('/api/launchroom/projects',{name:name.trim()});location.assign(projectHref(project.id));}
    catch (e) {setError(e.code==='INVALID_INPUT'?'Use a name of 1 to 100 characters.':e.code==='QUOTA_EXCEEDED'?'Launchroom has reached its project limit.':authMessage(e));setBusy(false);}
  }
  return <Sheet title="New project" subtitle="Its own tasks, pipeline, files and memory." onClose={onClose}>
    <form className="mv-lr-form" onSubmit={create} noValidate>
      <label className="mv-field">Project name<input className="mv-input" autoFocus value={name} maxLength={100} onChange={event=>setName(event.target.value)} placeholder="e.g. Candle studio"/></label>
      {error&&<div className="mv-error" role="alert">{error}</div>}
      <p className="mv-small">You’re its first member. Share it with others in People &amp; access.</p>
      <div className="mv-lr-form-actions"><button className="mv-btn primary" disabled={busy}>{busy&&<LoaderCircle size={15} className="mv-spin"/>}Create project<ArrowRight size={15}/></button><button type="button" className="mv-btn ghost" onClick={onClose}>Cancel</button></div>
    </form>
  </Sheet>;
}

const sameSet = (a,b) => a.length===b.length&&a.every(id=>b.includes(id));

/**
 * People & access (owner/admin): who can sign in, invitations (the code is shown
 * once; the app never emails it), each person's projects as toggles with one
 * Save, and Disable with a confirm. The server enforces every rule again.
 */
export function PeopleSheet({onClose}) {
  const lr = useLaunchroom();
  const [users,setUsers] = useState(null),[error,setError] = useState(''),[message,setMessage] = useState('');
  const [draft,setDraft] = useState({}),[saving,setSaving] = useState(false),[confirm,setConfirm] = useState(null);
  const [inviting,setInviting] = useState(false),[invite,setInvite] = useState({name:'',username:''}),[invitation,setInvitation] = useState(null),[busy,setBusy] = useState(false),[copied,setCopied] = useState(false);
  async function load(){try{setUsers((await lrApi('/api/launchroom/users')).users);}catch(e){setError(authMessage(e));}}
  useEffect(()=>{load();},[]);
  const projects = workProjects(lr.projects);
  const rows = useMemo(()=>accessRows(users||[],lr.projects),[users,lr.projects]);
  const active = (users||[]).filter(user=>!user.disabled).map(user=>user.id);
  const changes = accessChanges(lr.projects,draft,active);
  const idsFor = row => draft[row.user.id]||row.projectIds;
  function toggle(row,projectId) {
    const ids = idsFor(row), next = ids.includes(projectId)?ids.filter(id=>id!==projectId):[...ids,projectId];
    setDraft(current=>{const copy={...current};if(sameSet(next,row.projectIds))delete copy[row.user.id];else copy[row.user.id]=next;return copy;});
    setMessage('');
  }
  async function save() {
    setSaving(true);setError('');
    try {for (const change of changes) await lrApi(`/api/launchroom/projects/${change.projectId}/members`,{userIds:change.userIds});await lr.reload();setDraft({});setMessage('Access saved.');}
    catch (e) {setError(authMessage(e));await lr.reload();await load();}
    finally {setSaving(false);}
  }
  async function createInvite(event) {
    event.preventDefault();setBusy(true);setError('');
    try {setInvitation({...await lrApi('/api/launchroom/invites',{name:invite.name.trim(),username:invite.username.trim()}),name:invite.name.trim(),username:invite.username.trim().toLowerCase()});setInvite({name:'',username:''});setInviting(false);setCopied(false);}
    catch (e) {setError(authMessage(e));}
    finally {setBusy(false);}
  }
  async function disable(user) {
    setError('');
    try {await lrApi('/api/launchroom/users/revoke',{userId:user.id});setConfirm(null);setMessage(`${user.name} can no longer sign in.`);await load();await lr.reload();}
    catch (e) {setError(authMessage(e));setConfirm(null);}
  }
  async function copy() {try{await navigator.clipboard.writeText(invitation.token);setCopied(true);}catch{setCopied(false);}}
  const expires = invitation?new Date(invitation.expiresAt).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}):'';
  return <Sheet wide title="People & access" subtitle="Who can sign in, and which projects each person sees." onClose={onClose}>
    <div className="mv-lr-people">
      <section className="mv-lr-invite">
        {!inviting&&!invitation&&<button className="mv-btn" onClick={()=>{setInviting(true);setMessage('');}}><UserPlus size={15}/>Invite someone</button>}
        {inviting&&<form className="mv-lr-invite-form" onSubmit={createInvite} noValidate>
          <label className="mv-field">Their name<input className="mv-input" autoFocus value={invite.name} maxLength={80} onChange={event=>setInvite({...invite,name:event.target.value})}/></label>
          <label className="mv-field">Username<input className="mv-input" value={invite.username} maxLength={64} autoCapitalize="none" spellCheck={false} onChange={event=>setInvite({...invite,username:event.target.value})}/></label>
          <div className="mv-lr-form-actions"><button className="mv-btn primary" disabled={busy||!invite.name.trim()||!invite.username.trim()}>{busy&&<LoaderCircle size={15} className="mv-spin"/>}Create invitation</button><button type="button" className="mv-btn ghost" onClick={()=>setInviting(false)}>Cancel</button></div>
        </form>}
        {invitation&&<div className="mv-lr-code" role="status">
          <div className="mv-lr-code-head"><strong>Invitation for {invitation.name}</strong><span className="mv-small">@{invitation.username}</span><button className="mv-icon-btn" aria-label="Hide invitation" onClick={()=>setInvitation(null)}><X size={16}/></button></div>
          <div className="mv-lr-code-row"><code>{invitation.token}</code><button className="mv-btn sm" onClick={copy}>{copied?<Check size={14}/>:<Copy size={14}/>}{copied?'Copied':'Copy'}</button></div>
          <p className="mv-small">Shown once. Expires in 24 hours ({expires}). Launchroom doesn’t email it: send the code and the username yourself, privately. They choose “I have an invitation” and pick their own password.</p>
        </div>}
      </section>
      {error&&<div className="mv-error" role="alert">{error}</div>}
      {message&&<p className="mv-lr-ok" role="status"><Check size={14}/>{message}</p>}
      <h3 className="mv-lr-sub">People {users&&<span>{users.length}</span>}</h3>
      {!users?<div className="mv-loading" style={{padding:30}}><LoaderCircle className="mv-spin" size={20}/></div>:<div className="mv-lr-person-list">
        {rows.map(row=>{const user=row.user,ids=idsFor(row),edited=!!draft[user.id];return <div key={user.id} className={`mv-lr-person ${user.disabled?'is-off':''} ${edited?'is-edited':''}`}>
          <div className="mv-lr-person-head">
            <span className="mv-lr-avatar is-light">{initialsOf(user.name)}</span>
            <span className="mv-lr-person-name"><strong>{user.name}{user.id===lr.user.id&&<small> · you</small>}</strong><small>@{user.username}</small></span>
            <Chip tone={row.admin?'dark':''}>{row.admin?'Owner':'Member'}</Chip>
            {user.disabled?<Chip tone="muted">Disabled</Chip>:!row.admin&&<button className="mv-btn sm ghost mv-lr-disable" onClick={()=>setConfirm(user.id)}>Disable</button>}
          </div>
          {confirm===user.id&&<div className="mv-lr-confirm" role="alert"><span>Disable {user.name}? They’re signed out and can’t sign in again. Their uploads stay.</span><button className="mv-btn sm danger" onClick={()=>disable(user)}>Disable account</button><button className="mv-btn sm ghost" onClick={()=>setConfirm(null)}>Cancel</button></div>}
          {!user.disabled&&<div className="mv-lr-person-projects" role="group" aria-label={`Projects ${user.name} can open`}>
            {row.admin?<span className="mv-small">Opens every project and the Shared library.</span>:<>
              {projects.map(project=><button key={project.id} className="mv-lr-toggle" aria-pressed={ids.includes(project.id)} onClick={()=>toggle(row,project.id)}><ProjectMark project={project} size={18}/>{project.name}{ids.includes(project.id)&&<Check size={13}/>}</button>)}
              <span className="mv-lr-toggle is-fixed" title="Everyone signed in can see the Shared library"><Globe size={13}/>Shared library</span>
            </>}
          </div>}
        </div>;})}
      </div>}
      {changes.length>0&&<div className="mv-lr-savebar"><span>{changes.length} project{changes.length===1?'':'s'} change{changes.length===1?'s':''}</span><button className="mv-btn ghost" onClick={()=>setDraft({})}>Undo</button><button className="mv-btn primary" disabled={saving} onClick={save}>{saving&&<LoaderCircle size={15} className="mv-spin"/>}Save access</button></div>}
    </div>
  </Sheet>;
}
