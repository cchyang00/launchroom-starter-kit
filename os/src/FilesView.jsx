import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Folder,FolderPlus,Upload,Search,LayoutGrid,List,Trash2,RotateCcw,Download,FileText,FileImage,FileVideo,FileSpreadsheet,File as FileIcon,Play,X,Check,LoaderCircle,ChevronRight,CircleAlert,ArrowLeft,Inbox,Globe,Lock} from 'lucide-react';
import {Sheet,timeAgo} from './kit.jsx';
import {lrApi,AccessChip,ProjectMark} from './LaunchroomShell.jsx';
import {fileKind,formatSize,sortFiles,filterFiles,folderCrumbs,parentFolder,destinationText,uploadProblem,filesMessage,accessOf,KIND_LABELS,ACCEPTED,LIMITS_TEXT,UPLOAD_NOTE,extOf} from './launchroomModel.mjs';

/**
 * Files (a project's own uploads) and the Shared library (everyone's), one
 * browser for both (owner, Oct 1: pleasant to browse). Folders first, real
 * picture thumbnails, a preview sheet, drag-and-drop uploads with a progress
 * list, and a Removed view with Restore. Removal is always recoverable; the
 * app has no permanent delete. Uploads are references, never evidence.
 */
const read = (key,fallback) => {try{return localStorage.getItem(key)||fallback;}catch{return fallback;}};
const keep = (key,value) => {try{localStorage.setItem(key,value);}catch{}};
const day = value => value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const KIND_ICONS = {folder:Folder,image:FileImage,video:FileVideo,pdf:FileText,doc:FileText,text:FileSpreadsheet,file:FileIcon};

function urls(scope) {
  const base = `/p/${scope.id}/api/files`;
  return {
    list:(folder,removed)=>removed?`${base}?removed=1`:`${base}?folder=${encodeURIComponent(folder||'')}`,
    preview:item=>item.removedAt?`${base}/preview?removed=${encodeURIComponent(item.id)}`:`${base}/preview?path=${encodeURIComponent(item.path)}`,
    download:item=>`${base}/download?path=${encodeURIComponent(item.path)}`,
    upload:(folder,name)=>`${base}/upload?folder=${encodeURIComponent(folder||'')}&name=${encodeURIComponent(name)}`,
    base,
  };
}

/** A tile's picture: the real thumbnail for pictures, a still frame for videos, an icon otherwise. */
function Thumb({item,scope,size='tile'}) {
  const kind = fileKind(item), [failed,setFailed] = useState(false);
  const Icon = KIND_ICONS[kind]||FileIcon;
  const src = urls(scope).preview(item);
  if (kind==='image'&&!failed) return <span className="mv-lr-thumb is-image"><img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/></span>;
  if (kind==='video'&&!failed&&size==='tile') return <span className="mv-lr-thumb is-video"><video src={`${src}#t=0.5`} preload="metadata" muted playsInline onError={()=>setFailed(true)}/><span className="mv-lr-play"><Play size={14}/></span></span>;
  return <span className={`mv-lr-thumb is-icon is-${kind}`}><Icon size={size==='tile'?30:18} strokeWidth={1.6}/>{kind!=='folder'&&<em>{extOf(item.name).slice(1).toUpperCase()||'FILE'}</em>}</span>;
}

function Meta({item,removed}) {
  const kind = fileKind(item);
  if (removed) return <small>Removed {day(item.removedAt)}{item.itemCount>1?` · ${item.itemCount} items`:''} · was in {parentFolder(item.path)||'the top folder'}</small>;
  return <small>{kind==='folder'?'Folder':formatSize(item.size)}{item.uploaderName?` · ${item.uploaderName}`:''}{item.createdAt?` · ${day(item.createdAt)}`:''}</small>;
}

export function FilesView({scope,params={},onParams,embedded=true}) {
  const folder = params.folder||'', removed = params.view==='removed';
  const u = useMemo(()=>urls(scope),[scope]);
  const shared = accessOf(scope).kind==='shared';
  const [items,setItems] = useState(null),[error,setError] = useState(''),[query,setQuery] = useState('');
  const [sort,setSort] = useState(()=>read('mv.files.sort','name')),[layout,setLayout] = useState(()=>read('mv.files.layout','grid'));
  const [preview,setPreview] = useState(null),[naming,setNaming] = useState(false),[folderName,setFolderName] = useState(''),[folderError,setFolderError] = useState('');
  const [uploads,setUploads] = useState([]),[dragging,setDragging] = useState(false),[notice,setNotice] = useState(null);
  const input = useRef(null), depth = useRef(0), alive = useRef(true);
  useEffect(()=>()=>{alive.current=false;},[]);

  const load = useCallback(async()=>{
    try {const data = await lrApi(u.list(folder,removed));if(alive.current){setItems(data.files||[]);setError('');}}
    catch (e) {if(!alive.current)return;if(e.code==='NOT_FOUND'&&folder){setError('That folder is gone. Showing its parent.');onParams({folder:parentFolder(folder)});}else setError(filesMessage(e));setItems(current=>current||[]);}
  },[u,folder,removed,onParams]);
  useEffect(()=>{setItems(null);setQuery('');load();const timer=setInterval(load,20000);return()=>clearInterval(timer);},[load]);
  useEffect(()=>{keep('mv.files.sort',sort);},[sort]);
  useEffect(()=>{keep('mv.files.layout',layout);},[layout]);

  // Uploads run one at a time (the server serializes them anyway); each row keeps its own progress.
  useEffect(()=>{
    if (uploads.some(up=>up.state==='uploading')) return;
    const next = uploads.find(up=>up.state==='queued');
    if (!next) return;
    setUploads(list=>list.map(up=>up.key===next.key?{...up,state:'uploading',pct:0}:up));
    const xhr = new XMLHttpRequest();
    xhr.open('POST',u.upload(next.folder,next.name));
    xhr.setRequestHeader('Content-Type','application/octet-stream');
    xhr.upload.onprogress = event => {if(event.lengthComputable)setUploads(list=>list.map(up=>up.key===next.key?{...up,pct:Math.round(event.loaded/event.total*100)}:up));};
    xhr.onload = () => {
      let body = null;try{body=JSON.parse(xhr.responseText);}catch{}
      if (xhr.status>=200&&xhr.status<300) {setUploads(list=>list.map(up=>up.key===next.key?{...up,state:'done',pct:100}:up));load();}
      else setUploads(list=>list.map(up=>up.key===next.key?{...up,state:'failed',error:filesMessage({code:body?.code,status:xhr.status},'upload'),retry:!['UNSUPPORTED_FILE_TYPE','INVALID_FILE_TYPE','FILE_TOO_LARGE','QUOTA_EXCEEDED'].includes(body?.code)}:up));
    };
    xhr.onerror = () => setUploads(list=>list.map(up=>up.key===next.key?{...up,state:'failed',error:filesMessage({network:true}),retry:true}:up));
    xhr.send(next.file);
  },[uploads,u,load]);

  function addFiles(list) {
    const files = Array.from(list||[]);
    if (!files.length) return;
    setUploads(current=>[...(current.every(up=>up.state==='done'||up.state==='failed')?[]:current),...files.map((file,i)=>{
      const problem = uploadProblem(file);
      return {key:`${Date.now()}-${i}-${file.name}`,file,name:file.name,size:file.size,folder,pct:0,state:problem?'failed':'queued',error:problem?.text||'',retry:problem?problem.retry:true};
    })]);
  }
  const retry = key => setUploads(list=>list.map(up=>up.key===key?{...up,state:'queued',pct:0,error:''}:up));
  const finished = uploads.length>0&&uploads.every(up=>up.state==='done'||up.state==='failed');

  // Drag-and-drop anywhere on the page; stray drops never navigate away.
  useEffect(()=>{
    if (removed) return;
    const stop = event => {if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();};
    window.addEventListener('dragover',stop);window.addEventListener('drop',stop);
    return ()=>{window.removeEventListener('dragover',stop);window.removeEventListener('drop',stop);};
  },[removed]);
  const dragProps = removed?{}:{
    onDragEnter:event=>{if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();depth.current+=1;setDragging(true);},
    onDragOver:event=>{if(event.dataTransfer.types.includes('Files'))event.preventDefault();},
    onDragLeave:()=>{depth.current=Math.max(0,depth.current-1);if(!depth.current)setDragging(false);},
    onDrop:event=>{event.preventDefault();depth.current=0;setDragging(false);addFiles(event.dataTransfer.files);},
  };

  async function makeFolder(event) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return setFolderError('Give the folder a name.');
    try {await lrApi(`${u.base}/folders`,{folder,name});setFolderName('');setNaming(false);setFolderError('');load();}
    catch (e) {setFolderError(filesMessage(e,'folder'));}
  }
  async function remove(item) {
    try {await lrApi(`${u.base}/remove`,{path:item.path});setPreview(null);setNotice({text:`“${item.name}” moved to Removed.`,item});load();}
    catch (e) {setNotice({text:filesMessage(e,'remove'),bad:true});load();}
  }
  async function restore(item) {
    try {await lrApi(`${u.base}/restore`,{id:item.id});setPreview(null);setNotice({text:`“${item.name}” is back in ${parentFolder(item.path)||'the top folder'}.`});load();}
    catch (e) {setNotice({text:filesMessage(e,'restore'),bad:true});load();}
  }
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(null),8000);return()=>clearTimeout(t);},[notice]);

  const shown = useMemo(()=>sortFiles(filterFiles(items||[],query),removed&&sort==='name'?'newest':sort),[items,query,sort,removed]);
  const open = item => fileKind(item)==='folder'&&!removed?onParams({folder:item.path}):setPreview(item);
  const crumbs = folderCrumbs(folder);
  const title = shared?'Shared library':'Files';
  const placeName = shared?'Shared library':`${scope.name} › Files`;

  return <div className={`mv-lr-files ${shared?'is-shared':''} ${dragging?'is-dragging':''}`} {...dragProps}>
    <header className="mv-lr-files-head">
      <div className="mv-lr-files-title">
        <span className={`mv-lr-files-icon ${shared?'is-shared':''}`}>{shared?<Globe size={20}/>:<Folder size={20}/>}</span>
        <div>
          <h1 className="mv-h1">{removed?<>{title} <span className="mv-lr-muted">› Removed</span></>:title}</h1>
          <p className="mv-sub">{shared?'Guides, templates and references every signed-in member can see and add to.':`${scope.name}’s own uploads: pictures, videos and documents people add for this project.`}</p>
          <div className="mv-lr-files-meta"><AccessChip project={scope}/><span className="mv-small">{LIMITS_TEXT}</span></div>
        </div>
      </div>
      <div className="mv-page-actions">
        {removed?<button className="mv-btn" onClick={()=>onParams({folder:''})}><ArrowLeft size={15}/>Back to {title.toLowerCase()==='files'?'files':'the library'}</button>:<>
          <button className="mv-btn" onClick={()=>{setNaming(!naming);setFolderError('');}}><FolderPlus size={15}/>New folder</button>
          <button className="mv-btn primary" onClick={()=>input.current?.click()}><Upload size={15}/>Upload</button>
          <input ref={input} className="mv-lr-hidden" type="file" multiple accept={ACCEPTED.join(',')} onChange={event=>{addFiles(event.target.files);event.target.value='';}} aria-label={`Choose files to upload to ${placeName}`}/>
        </>}
      </div>
    </header>

    {!removed&&<div className={`mv-lr-dest ${shared?'is-shared':''}`}>{shared?<Globe size={14}/>:<Lock size={14}/>}<span>{destinationText(scope,folder)}</span><span className="mv-lr-dest-hint">Drop files anywhere on this page</span></div>}

    {naming&&!removed&&<form className="mv-lr-newfolder" onSubmit={makeFolder} noValidate>
      <FolderPlus size={16}/><input className="mv-input" autoFocus value={folderName} maxLength={80} onChange={event=>setFolderName(event.target.value)} placeholder={`New folder in ${crumbs.at(-1)?.name||title}`} aria-label="Folder name"/>
      <button className="mv-btn sm primary">Create</button><button type="button" className="mv-btn sm ghost" onClick={()=>{setNaming(false);setFolderError('');}}>Cancel</button>
      {folderError&&<span className="mv-lr-field-error" role="alert">{folderError}</span>}
    </form>}

    <div className="mv-lr-files-bar">
      {!removed?<nav className="mv-lr-crumbs" aria-label="Folders">
        <button onClick={()=>onParams({folder:''})} aria-current={!folder?'page':undefined}>{shared?<Globe size={13}/>:<ProjectMark project={scope} size={16}/>}{title}</button>
        {crumbs.map(part=><React.Fragment key={part.path}><ChevronRight size={13}/><button onClick={()=>onParams({folder:part.path})} aria-current={part.path===folder?'page':undefined}>{part.name}</button></React.Fragment>)}
      </nav>:<span className="mv-small">Removed files and folders stay here until someone restores them. Nothing is deleted.</span>}
      <div className="mv-lr-tools">
        <label className="mv-lr-search"><Search size={14}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={removed?'Search removed':'Search this folder'} aria-label="Search this folder"/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={13}/></button>}</label>
        {!removed&&<div className="mv-seg" role="group" aria-label="Sort"><button aria-pressed={sort==='name'} onClick={()=>setSort('name')}>Name</button><button aria-pressed={sort==='newest'} onClick={()=>setSort('newest')}>Newest</button></div>}
        <div className="mv-seg" role="group" aria-label="Layout"><button aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')} aria-label="Grid"><LayoutGrid size={14}/></button><button aria-pressed={layout==='list'} onClick={()=>setLayout('list')} aria-label="List"><List size={14}/></button></div>
        {!removed&&<button className="mv-btn sm ghost" onClick={()=>onParams({folder:'',view:'removed'})}><Trash2 size={14}/>Removed</button>}
      </div>
    </div>

    {error&&<div className="mv-error" role="alert"><CircleAlert size={16}/>{error}</div>}
    {notice&&<div className={`mv-lr-notice ${notice.bad?'is-bad':''}`} role="status">{notice.bad?<CircleAlert size={15}/>:<Check size={15}/>}<span>{notice.text}</span>{notice.item&&<button className="mv-link" onClick={async()=>{const listed=(await lrApi(u.list('',true)).catch(()=>({files:[]}))).files.find(entry=>entry.id===notice.item.id);if(listed)restore(listed);}}>Undo</button>}<button className="mv-icon-btn" aria-label="Dismiss" onClick={()=>setNotice(null)}><X size={14}/></button></div>}

    {items===null?<div className="mv-loading" style={{padding:'70px 0'}}><LoaderCircle className="mv-spin" size={20}/>Opening {title.toLowerCase()}…</div>
    :!shown.length?<div className="mv-lr-files-empty">
      {removed?<><Inbox size={28}/><strong>Nothing removed.</strong><span className="mv-small">Removed files wait here so they can be restored.</span></>
      :query?<><Search size={26}/><strong>Nothing here matches “{query}”.</strong><button className="mv-link" onClick={()=>setQuery('')}>Clear the search</button></>
      :<><Upload size={28}/><strong>{folder?'This folder is empty.':shared?'The Shared library is empty.':'No files yet.'}</strong><span className="mv-small">{shared?'Add a guide, template or reference everyone may use.':'Drop pictures, videos or documents here, or use Upload.'}</span><button className="mv-btn primary" onClick={()=>input.current?.click()}><Upload size={15}/>Upload files</button></>}
    </div>
    :<div className={layout==='grid'?'mv-lr-grid':'mv-lr-rows'} role="list">
      {shown.map(item=>{const kind=fileKind(item);return <div key={item.binId||item.id||item.path} className={`mv-lr-tile is-${kind}`} role="listitem">
        <button className="mv-lr-tile-main" onClick={()=>open(item)} aria-label={`${kind==='folder'&&!removed?'Open folder':'Preview'} ${item.name}`}>
          <Thumb item={item} scope={scope} size={layout==='grid'?'tile':'row'}/>
          <span className="mv-lr-tile-text"><strong title={item.name}>{item.name}</strong><Meta item={item} removed={removed}/></span>
        </button>
        {removed?<button className="mv-btn sm mv-lr-tile-act" onClick={()=>restore(item)}><RotateCcw size={13}/>Restore</button>
        :<button className="mv-icon-btn mv-lr-tile-remove" aria-label={`Remove ${item.name}`} title="Move to Removed" onClick={()=>remove(item)}><Trash2 size={14}/></button>}
      </div>;})}
    </div>}

    {/* Portals: the page wrapper animates with a transform, which would pin fixed panels to it instead of the window. */}
    {dragging&&createPortal(<div className={`mv-lr-drop ${shared?'is-shared':''}`} aria-hidden="true"><div><Upload size={30}/><strong>Drop to upload</strong><span>{destinationText(scope,folder)}</span></div></div>,document.body)}

    {uploads.length>0&&createPortal(<section className="mv-lr-uploads" aria-label="Uploads" aria-live="polite">
      <div className="mv-lr-uploads-head"><strong>{finished?`Uploads finished · ${uploads.filter(up=>up.state==='done').length} of ${uploads.length} saved`:`Uploading ${uploads.filter(up=>up.state==='done').length+1} of ${uploads.length}`}</strong>{finished&&<button className="mv-icon-btn" aria-label="Close uploads" onClick={()=>setUploads([])}><X size={15}/></button>}</div>
      <p className="mv-lr-uploads-dest">{shared?<Globe size={12}/>:<Lock size={12}/>}{destinationText(scope,uploads.at(-1).folder)}</p>
      <ul>{uploads.map(up=><li key={up.key} className={`is-${up.state}`}>
        <span className="mv-lr-up-name"><strong title={up.name}>{up.name}</strong><small>{up.state==='failed'?up.error:up.state==='done'?`Saved · ${formatSize(up.size)}`:up.state==='queued'?`Waiting · ${formatSize(up.size)}`:`${up.pct}% · ${formatSize(up.size)}`}</small></span>
        {up.state==='done'?<Check size={16} className="mv-lr-up-ok"/>:up.state==='failed'?(up.retry?<button className="mv-btn sm" onClick={()=>retry(up.key)}><RotateCcw size={13}/>Retry</button>:<CircleAlert size={16} className="mv-lr-up-bad"/>):<LoaderCircle size={16} className="mv-spin"/>}
        {(up.state==='uploading'||up.state==='queued')&&<span className="mv-lr-up-bar"><i style={{width:`${up.pct}%`}}/></span>}
      </li>)}</ul>
    </section>,document.body)}

    {preview&&<PreviewSheet item={preview} scope={scope} removed={removed} onClose={()=>setPreview(null)} onRemove={remove} onRestore={restore} onFolder={path=>{setPreview(null);onParams({folder:path});}}/>}
  </div>;
}

/** One file, large: picture, video player or the text itself; facts; Download and Remove (or Restore). */
function PreviewSheet({item,scope,removed,onClose,onRemove,onRestore,onFolder}) {
  const kind = fileKind(item), u = urls(scope);
  const [text,setText] = useState(null),[error,setError] = useState(''),[broken,setBroken] = useState(false);
  useEffect(()=>{
    if (kind!=='text') return;
    let live = true;
    lrApi(u.preview(item)).then(value=>{if(live)setText(value);}).catch(e=>{if(live)setError(filesMessage(e,'preview'));});
    return ()=>{live=false;};
  },[item,kind,u]);
  const where = parentFolder(item.path);
  return <Sheet wide title={item.name} subtitle={kind==='folder'?'Folder':`${KIND_LABELS[kind]} · ${formatSize(item.size)}`} onClose={onClose}>
    <div className="mv-lr-preview">
      <div className={`mv-lr-stage is-${kind}`}>
        {kind==='image'&&!broken?<img src={u.preview(item)} alt={item.name} onError={()=>setBroken(true)}/>
        :kind==='video'&&!broken?<video src={u.preview(item)} controls playsInline preload="metadata" onError={()=>setBroken(true)}/>
        :kind==='text'?(error?<div className="mv-error" role="alert">{error}</div>:!text?<div className="mv-loading" style={{padding:40}}><LoaderCircle className="mv-spin" size={18}/></div>
          :<div className="mv-lr-text"><pre>{text.text}</pre>{text.truncated&&<p className="mv-small">Showing the first 64 KB. Download it for the rest.</p>}</div>)
        :kind==='folder'?<div className="mv-lr-stage-icon"><Thumb item={item} scope={scope} size="row"/><strong>A folder{item.itemCount>1?` with ${item.itemCount-1} item${item.itemCount===2?'':'s'} inside`:''}.</strong><span className="mv-small">Restore brings the folder and everything in it back.</span></div>
        :<div className="mv-lr-stage-icon"><Thumb item={item} scope={scope} size="row"/><strong>{broken?'This preview couldn’t load.':kind==='pdf'?'PDFs download to open.':kind==='doc'?'Word documents download to open.':'This type downloads to open.'}</strong>{!removed&&<a className="mv-btn primary" href={u.download(item)} download={item.name}><Download size={15}/>Download</a>}</div>}
      </div>
      <dl className="mv-lr-facts">
        <dt>Uploaded by</dt><dd>{item.uploaderName||'Team member'}</dd>
        <dt>{removed?'Removed':'Added'}</dt><dd>{removed?`${day(item.removedAt)} · ${timeAgo(item.removedAt)}`:`${day(item.createdAt)} · ${timeAgo(item.createdAt)}`}</dd>
        <dt>Folder</dt><dd>{removed?(where||'Top folder'):<button className="mv-link" onClick={()=>onFolder(where)}>{where?where.split('/').join(' › '):'Top folder'}</button>}</dd>
        <dt>Size</dt><dd>{formatSize(item.size)} · {KIND_LABELS[kind]}</dd>
        <dt>Who can see it</dt><dd><AccessChip project={scope}/></dd>
      </dl>
      <p className="mv-lr-note"><CircleAlert size={14}/>{UPLOAD_NOTE}</p>
      <div className="mv-lr-form-actions">
        {removed?<button className="mv-btn primary" onClick={()=>onRestore(item)}><RotateCcw size={15}/>Restore</button>:<>
          <a className="mv-btn primary" href={u.download(item)} download={item.name}><Download size={15}/>Download</a>
          <button className="mv-btn" onClick={()=>onRemove(item)}><Trash2 size={15}/>Remove</button>
          <span className="mv-small">Remove moves it to Removed, where it can be restored.</span>
        </>}
      </div>
    </div>
  </Sheet>;
}
