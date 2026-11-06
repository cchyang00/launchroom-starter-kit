import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Images,ImagePlus,Film,Trash2,ArchiveRestore,Search,ArrowUpRight,ArrowRight,Copy,House,ShoppingBag,FileCode,Megaphone,Package,FolderOpen,Globe,TriangleAlert,Layers,CircleDashed,Repeat,Lightbulb,PenLine,Trophy} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,assetUrl,isVideoPath} from './kit.jsx';
import {CreativeLibrary} from './CreativeHub.jsx';
import {Assets as LegacyAssets} from './ResourceLibrary.jsx';
import {MetaAdBoard} from './MetaAdBoard.jsx';
import {SORTS,SORT_IDS,STATUS,statusLabel,countsLine,filterSections,filterFiles,flatTiles,usedWhere,binFolder,isStoreFile,storePictures,fileSize} from './assetsModel.mjs';

// Assets: the store page, picture by picture (owner, Oct 1). Places come in the
// order a shopper meets them, from the saved product packet, site.json (Merrivy's
// own pictures) and, as a fallback, literal page-code pictures (server/assets.mjs). Remove moves a production file to a restorable bin; the
// app never deletes anything and never moves a store page file: changing one is
// something the owner says in chat (owner, Nov 4).

// The hub opens on what's good (owner, Nov 5: "a way for agents to see what's good copy, what's good assets").
// The two tabs for working on one product stay here, after the library, and every old link still lands right.
const LIBRARY_TABS = [['copy','Good copy',PenLine],['ads','Good ads',Trophy],['improve','Ways to improve',Lightbulb]];
const WORK_TABS = [['studio','Ad studio',Megaphone],['store','Store pictures',ShoppingBag]];
const tabFrom = params => {
  if (params.file||params.section||params.sort) return 'store';
  if (params.tab==='references') return 'ads';
  if ([...LIBRARY_TABS,...WORK_TABS].some(([id])=>id===params.tab)) return params.tab;
  return params.product?'studio':'copy';
};
const pad = n => String(n).padStart(2,'0');
const PAGE_ICONS = {home:House,product:ShoppingBag,other:FileCode};
const PAGE_SHORT = {home:'Home',product:'Product',other:'Other'};
const STORE = 'http://localhost:3001';
const shortDate = value => value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const fileTone = item => item.group==='brand'?'brand':item.group==='ad'?'ad':'not-placed';
const isLogo = item => /logo|wordmark|favicon|icon/i.test(item?.name||'');
// A light logo (white on clear) needs a dark backdrop to be seen.
const onDark = item => isLogo(item)&&/light|white/i.test(item?.name||'');

function Thumb({slot,item,removed}) {
  if (removed) return removed.exists&&removed.kind==='image'?<img src={assetUrl(removed.removedPath)} alt="" loading="lazy"/>:<span className="mv-as-ph"><Trash2 size={20}/>{removed.exists?'Video':'Gone from the bin'}</span>;
  if (item) return item.kind==='image'?<img src={assetUrl(item.path)} alt="" loading="lazy"/>:<span className="mv-as-ph"><Film size={20}/>Video</span>;
  if (slot.status==='empty') return <span className="mv-as-ph">{slot.kind==='video'?<Film size={22}/>:<ImagePlus size={22}/>}{statusLabel(slot)}</span>;
  if (slot.status==='optional') return <span className="mv-as-ph"><CircleDashed size={20}/>Real photos only</span>;
  if (slot.status==='missing') return <span className="mv-as-ph"><TriangleAlert size={20}/>File missing<small>{(slot.file||slot.src).split('/').pop()}</small></span>;
  if (slot.status==='online') return <span className="mv-as-ph"><Globe size={20}/>Online picture</span>;
  if (slot.kind==='video') return <span className="mv-as-ph"><Film size={20}/>Video</span>;
  return slot.previewable?<img src={assetUrl(slot.file)} alt="" loading="lazy"/>:<span className="mv-as-ph"><Images size={20}/>Picture</span>;
}

function SlotTile({slot,section,chip,idPrefix,onOpen}) {
  return <button type="button" id={`as-${idPrefix}-${slot.id}`} className={`mv-as-tile is-${slot.status} ${slot.derived?'is-derived':''}`} onClick={()=>onOpen({type:'slot',id:slot.id})} aria-label={`${section.label}: ${slot.label}. ${statusLabel(slot)}.`}>
    <span className="mv-as-thumb"><Thumb slot={slot}/>{slot.derived&&<span className="mv-as-repeat"><Repeat size={11}/>Repeats picture 1</span>}</span>
    <span className="mv-as-tile-foot"><strong title={slot.label}>{slot.label}</strong><span className={`mv-as-pill is-${STATUS[slot.status]?.tone}`}>{statusLabel(slot)}</span></span>
    {chip&&<span className="mv-as-chip-sec">{pad(section.number)} {section.label}</span>}
  </button>;
}

function FileTile({item,chip,idPrefix,onOpen}) {
  const tone = fileTone(item);
  return <button type="button" id={`as-${idPrefix}-${item.path}`} className={`mv-as-tile is-file ${isLogo(item)?'is-logo':''}`} onClick={()=>onOpen({type:'file',id:item.path})} aria-label={`${item.name}. ${STATUS[tone].label}.`}>
    <span className={`mv-as-thumb ${isLogo(item)?'is-contain':''} ${onDark(item)?'is-dark':''}`}><Thumb item={item}/></span>
    <span className="mv-as-tile-foot"><strong title={item.name}>{item.name}</strong><span className={`mv-as-pill is-${STATUS[tone].tone}`}>{item.owner==='store'?'Store folder':STATUS[tone].label}</span></span>
    {chip&&<span className="mv-as-chip-sec">{item.owner==='store'?'Store folder':'Not placed'}</span>}
  </button>;
}

function RemovedTile({item,busy,onOpen,onRestore}) {
  return <article className="mv-as-removed" id={`as-bin-${item.id}`}>
    <button type="button" className="mv-as-thumb" onClick={()=>onOpen({type:'removed',id:item.id})} aria-label={`${item.name}, in the bin. Open details.`}><Thumb removed={item}/></button>
    <div className="mv-as-removed-foot">
      <strong title={item.originalPath}>{item.name}</strong>
      <small>Removed {shortDate(item.removedAt)} · by {item.by==='owner'?'you':item.by}</small>
      {item.exists?<button type="button" className="mv-btn sm" disabled={busy} onClick={()=>onRestore(item)}><ArchiveRestore size={13}/>{busy?'Restoring…':'Restore'}</button>:<span className="mv-as-pill is-muted">Emptied by hand</span>}
    </div>
  </article>;
}

function SectionBlock({section,onOpen}) {
  const counted = section.slots.filter(slot=>!slot.derived&&!slot.optional);
  const filled = counted.filter(slot=>['in-store','draft','online'].includes(slot.status)).length;
  const needs = counted.length-filled;
  const n = Math.min(6,Math.max(1,section.slots.length));
  return <section className={`mv-card mv-as-sec ${needs?'is-need':''}`} data-n={n} style={{'--n':n}} id={`as-sec-${section.id}`} aria-labelledby={`as-sec-h-${section.id}`}>
    <header className="mv-as-sec-head">
      <span className="mv-as-num" aria-hidden="true">{pad(section.number)}</span>
      <div className="mv-as-sec-title"><h3 id={`as-sec-h-${section.id}`}>{section.label}{section.source==='code'&&<span className="mv-as-tag" title={`${section.note} (${section.codeFile})`}><FileCode size={11}/>Page code</span>}{section.source==='site'&&<span className="mv-as-tag" title={`${section.note} (${section.siteFile})`}><Globe size={11}/>Site picture</span>}</h3><p>{section.help}</p></div>
      <span className="mv-as-sec-count">{section.slots.every(slot=>slot.derived)?'Repeat':counted.length?`${filled} of ${counted.length}`:'Optional'}</span>
    </header>
    <div className="mv-as-grid">{section.slots.map(slot=><SlotTile key={slot.id} slot={slot} section={section} idPrefix="page" onOpen={onOpen}/>)}</div>
  </section>;
}

/* ---------- The preview sheet ---------- */
function AssetSheet({entry,map,busy,error,onClose,onRemove,onRestore,onJump,notify,go}) {
  const [confirm,setConfirm] = useState(false);
  const {type,slot,section,item} = entry;
  const packet = map.packets.find(p=>p.id===map.packet);
  const file = slot?.file||item?.path||item?.originalPath||'';
  const showFile = slot?slot.file:type==='removed'?item.removedPath:item.path;
  const status = slot?slot.status:type==='removed'?'removed':fileTone(item);
  const label = slot?statusLabel(slot):type==='file'&&item.owner==='store'?'Store folder':STATUS[status].label;
  const preview = slot?(slot.previewable&&slot.exists?slot.file:''):type==='removed'?(item.exists?item.removedPath:''):item.path;
  const kind = slot?.kind||item?.kind;
  const places = slot?usedWhere(map,slot.file):[];
  const removable = type==='file'&&item.removable&&!isStoreFile(item.path);
  const title = slot?`${section.label} · ${slot.label}`:item.name;
  const subtitle = slot?`${pad(section.number)} · ${map.pages.find(p=>p.id===section.page)?.label||''}`:type==='removed'?'In the bin':item.group==='brand'?'Brand file':item.group==='ad'?'Ad picture':item.owner==='store'?'In the store folder, not on the page':'Not placed on the store page';
  async function copy(text) {try {await navigator.clipboard.writeText(text);notify('Path copied.');} catch {notify('Could not copy. The path is shown on the page.');}}
  return <Sheet wide title={title} subtitle={subtitle} onClose={onClose}>
    <div className="mv-as-sheet">
      <div className={`mv-as-big ${preview?'':'is-empty'} ${isLogo(item)?'is-logo':''} ${onDark(item)?'is-dark':''}`}>
        {preview?(kind==='video'?<video src={assetUrl(preview)} controls preload="metadata"/>:<img src={assetUrl(preview)} alt={slot?.alt||item?.name||''}/>)
        :<span className="mv-as-ph is-big">{slot&&slot.status!=='missing'&&slot.status!=='online'?(slot.kind==='video'?<Film size={34}/>:<ImagePlus size={34}/>):slot?.status==='online'?<Globe size={30}/>:<TriangleAlert size={30}/>}
          {slot?.status==='online'?'Loaded from another website. The app does not open it.':slot?.status==='missing'?'The file this place points to is not there.':slot?statusLabel(slot):'The file is no longer in the bin folder.'}</span>}
      </div>
      <div className="mv-as-facts">
        <div className="mv-as-status"><span className={`mv-as-pill is-${STATUS[status]?.tone||'muted'}`}>{label}</span><p>{STATUS[status]?.help}</p></div>
        <dl>
          {slot&&<><dt>Place</dt><dd>{pad(section.number)} {section.label}{section.slots.length>1?` · ${slot.label}`:''}<small>{section.help}</small></dd></>}
          {places.length>0&&<><dt>Used in</dt><dd><div className="mv-as-used">{places.map(({section:s,slot:x})=><button key={x.id} type="button" className="mv-link" onClick={()=>onJump(s.id)}>{pad(s.number)} {s.label}{s.slots.length>1?` · ${x.label}`:''}</button>)}</div></dd></>}
          {slot&&<><dt>Set in</dt><dd>{slot.source==='code'?<><code>{section.codeFile}</code><small>Written into the page code.</small></>:slot.source==='site'?<><code>{slot.key}</code><small>in {section.siteFile} (Merrivy's own pictures, live whatever product is shown)</small></>:<><code>{slot.key}</code><small>in {packet?.file}</small></>}</dd></>}
          {type==='removed'&&<><dt>Was at</dt><dd><code>{item.originalPath}</code></dd><dt>Removed</dt><dd>{shortDate(item.removedAt)} by {item.by==='owner'?'you':item.by}{item.reason?` · ${item.reason}`:''}</dd></>}
          {showFile&&<><dt>File</dt><dd><code>{showFile}</code><button type="button" className="mv-link mv-as-copy" onClick={()=>copy(showFile)}><Copy size={12}/>Copy path</button></dd></>}
          {(slot?.exists||item?.exists||type==='file')&&<><dt>Size</dt><dd>{[fileSize(slot?.size??item?.size),(slot?.width||item?.width)&&`${slot?.width||item.width} × ${slot?.height||item.height} px`,(slot?.modifiedAt||item?.modifiedAt)&&`updated ${shortDate(slot?.modifiedAt||item.modifiedAt)}`].filter(Boolean).join(' · ')}</dd></>}
          {slot?.alt&&<><dt>Alt text</dt><dd>{slot.alt}</dd></>}
          {slot?.status==='online'&&<><dt>Link</dt><dd><code>{slot.src}</code></dd></>}
        </dl>
        {error&&<div className="mv-error" role="alert">{error}</div>}
        <div className="mv-as-actions">
          {preview&&<a className="mv-btn sm" href={assetUrl(preview)} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>Open file</a>}
          {removable&&!confirm&&<button type="button" className="mv-btn sm danger" onClick={()=>setConfirm(true)}><Trash2 size={13}/>Remove to the bin</button>}
          {type==='removed'&&item.exists&&<button type="button" className="mv-btn sm primary" disabled={busy} onClick={()=>onRestore(item)}><ArchiveRestore size={13}/>{busy?'Restoring…':'Restore'}</button>}
        </div>
        {removable&&confirm&&<div className="mv-as-confirm" role="group" aria-label="Confirm remove">
          <p><b>Move it to the bin?</b> It goes to <code>{binFolder(item.path)}</code> beside where it is now. Restore puts it back any time.{item.group==='brand'?' This is a brand file: check the logo is not needed first.':''}</p>
          <div><button type="button" className="mv-btn sm danger" disabled={busy} onClick={()=>onRemove(item)}><Trash2 size={13}/>{busy?'Moving…':'Yes, move it to the bin'}</button><button type="button" className="mv-btn sm ghost" onClick={()=>setConfirm(false)}>Keep it</button></div>
        </div>}
        <p className="mv-as-rule">{slot&&['empty','optional'].includes(slot.status)?'To change this, say so in chat. Nothing changes on the page until an agent does it.':slot||item?.owner==='store'?'The app never moves store page files. To change one, say so in chat.':type==='removed'?'The app never deletes anything. To get rid of it for good, empty the _removed folder yourself.':'Remove never deletes: the file waits in the bin until you restore it or empty the _removed folder yourself.'}</p>
      </div>
    </div>
  </Sheet>;
}

/* ---------- The page ---------- */
export function AssetsView(props) {
  const {assetMap,loadAssets,assetsError,notify,openDoc,openLibrary,go,route,refresh,hub} = props;
  const params = route?.params||{};
  const hubTab = tabFrom(params);
  const setHubTab = id => go(`assets?tab=${id}`);

  const [packetId,setPacketId] = useState('');
  const [own,setOwn] = useState(null),[ownError,setOwnError] = useState('');
  const [sort,setSort] = useState(SORT_IDS.includes(params.sort)?params.sort:'page');
  const [query,setQuery] = useState('');
  const [open,setOpen] = useState(null),[busy,setBusy] = useState(''),[error,setError] = useState('');
  const handled = useRef('');
  const viewingOther = Boolean(packetId&&assetMap&&packetId!==assetMap.packet);
  const map = viewingOther?own:assetMap;

  useEffect(()=>{if(SORT_IDS.includes(params.sort))setSort(params.sort);},[params.sort]);
  async function loadOwn(id=packetId) {
    try {setOwn(await api(`/api/assets?packet=${encodeURIComponent(id)}`));setOwnError('');} catch (e) {setOwnError(e.message);}
  }
  useEffect(()=>{if(viewingOther){setOwn(null);loadOwn(packetId);const timer=setInterval(()=>loadOwn(packetId),20000);return()=>clearInterval(timer);}},[packetId,viewingOther]);
  async function reload() {await (viewingOther?loadOwn():loadAssets?.());refresh?.();}

  // #/assets?file=<path> opens that picture once; ?section=<id> scrolls to it.
  useEffect(()=>{
    if (!map) return;
    const key = `${params.file||''}|${params.section||''}`;
    if (handled.current===key) return;
    handled.current = key;
    if (params.file) {
      const slot = map.sections.flatMap(s=>s.slots).find(x=>x.file===params.file);
      if (slot) setOpen({type:'slot',id:slot.id});
      else if ([...map.brand,...map.ads,...map.notPlaced].some(x=>x.path===params.file)) setOpen({type:'file',id:params.file});
    }
    if (params.section) setTimeout(()=>jump(params.section),80);
  },[map,params.file,params.section]);

  const sections = useMemo(()=>map?filterSections(map.sections,query):[],[map,query]);
  const tiles = useMemo(()=>map&&sort!=='page'?flatTiles(map,sort,query):[],[map,sort,query]);
  const notPlaced = useMemo(()=>map?filterFiles(map.notPlaced,query):[],[map,query]);
  const brand = useMemo(()=>map?filterFiles(map.brand,query):[],[map,query]);
  const ads = useMemo(()=>map?filterFiles(map.ads,query):[],[map,query]);
  const binned = map?.removed.filter(item=>item.exists)||[], gone = map?.removed.filter(item=>!item.exists)||[];

  function jump(id) {
    if (sort!=='page') setSort('page');
    setTimeout(()=>{const el=document.getElementById(`as-sec-${id}`)||document.getElementById(`as-group-${id}`);if(!el)return;el.scrollIntoView({behavior:'smooth',block:'start'});el.classList.add('is-flash');setTimeout(()=>el.classList.remove('is-flash'),1600);},40);
  }

  // The open sheet is looked up again on every refresh, so it always shows saved state.
  const entry = useMemo(()=>{
    if (!open||!map) return null;
    if (open.type==='slot') {for (const section of map.sections) {const slot=section.slots.find(x=>x.id===open.id);if(slot)return {type:'slot',slot,section};}return null;}
    if (open.type==='file') {const item=[...map.brand,...map.ads,...map.notPlaced].find(x=>x.path===open.id);return item?{type:'file',item}:null;}
    const item = map.removed.find(x=>x.id===open.id);return item?{type:'removed',item}:null;
  },[open,map]);

  async function remove(item) {
    setBusy('remove');setError('');
    try {await api('/api/assets/remove',{revision:map.revision,path:item.path});setOpen(null);notify(`${item.name} is in the bin. Restore it from Removed any time.`);await reload();}
    catch (e) {setError(/bin list changed/i.test(e.message)?'The bin list just changed. Try again.':e.message);reload();}
    finally {setBusy('');}
  }
  async function restore(item) {
    setBusy(`restore-${item.id}`);setError('');
    try {await api('/api/assets/restore',{revision:map.revision,id:item.id});setOpen(null);notify(`${item.name} is back in ${item.originalPath.split('/').slice(0,-1).join('/')}.`);await reload();}
    catch (e) {const message=/bin list changed/i.test(e.message)?'The bin list just changed. Try again.':e.message;setError(message);if(!open)notify(message);reload();}
    finally {setBusy('');}
  }

  const failed = !map&&(viewingOther?ownError:assetsError);
  const oldServer = failed&&/route not found|not found|hub operation/i.test(failed);
  const packet = map?.packets.find(p=>p.id===map.packet);
  const pages = map?.pages||[];

  return <section className="mv-as">
    <div className="mv-page-head">
      <div>
        <span className="mv-eyebrow">Hub · for you and the agents</span>
        <h1 className="mv-h1">Assets &amp; Creatives Hub</h1>
        <p className="mv-sub">What good looks like, and how we get better.</p>
      </div>
      <div className="mv-page-actions">
        <button className="mv-btn ghost" onClick={()=>openDoc('resources/INDEX.md')}><FolderOpen size={15}/>Filing guide</button>
      </div>
    </div>

    <div className="mv-hb-tabbar">
      <div className="mv-seg" role="group" aria-label="What's good">{LIBRARY_TABS.map(([id,label,Icon])=><button key={id} type="button" aria-pressed={hubTab===id} onClick={()=>setHubTab(id)}><Icon size={14}/>{label}</button>)}</div>
      <div className="mv-seg is-work" role="group" aria-label="Work on one product">{WORK_TABS.map(([id,label,Icon])=><button key={id} type="button" aria-pressed={hubTab===id} onClick={()=>setHubTab(id)}><Icon size={14}/>{label}</button>)}</div>
    </div>

    {LIBRARY_TABS.some(([id])=>id===hubTab) && <CreativeLibrary tab={hubTab} hub={hub} data={props.data} openDoc={openDoc} openLibrary={openLibrary} go={go}/>}

    {hubTab==='studio' && (
      <div style={{marginBottom:20}}>
        <MetaAdBoard hub={hub} defaultProductId={params.product||''} hideChecklist go={go} notify={notify}/>
      </div>
    )}

    {hubTab==='store' && <>
    {oldServer&&<><div className="mv-error" role="alert" style={{marginBottom:14}}>The store map needs the updated OS server. Ask the manager to restart the OS, then reload. Meanwhile, here are the saved files.</div><div className="mv-legacy"><LegacyAssets {...props}/></div></>}
    {failed&&!oldServer&&<div className="mv-error" role="alert" style={{marginBottom:14}}>{failed}</div>}
    {!map&&!failed&&<div className="mv-card mv-empty">Reading the store page…</div>}

    {map&&<>
      <div className="mv-card mv-as-bar">
        <label className="mv-as-field"><span>Page</span><select value={map.packet} onChange={e=>setPacketId(e.target.value===assetMap?.packet?'':e.target.value)} aria-label="Which product page">
          {map.packets.length?map.packets.map(p=><option key={p.id} value={p.id}>{p.label}{p.status==='sample'?' · demo':p.status==='draft'?' · draft':''}{p.active?' · live':''}</option>):<option value="">No product packet yet</option>}
        </select></label>
        <div className="mv-as-sort" role="group" aria-label="Sort the pictures">{SORTS.map(([id,label])=><button key={id} type="button" aria-pressed={sort===id} onClick={()=>setSort(id)}>{label}</button>)}</div>
        <label className="mv-as-search"><Search size={15}/><input type="search" aria-label="Search pictures" placeholder="Search pictures, places or files" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      </div>
      <div className="mv-as-counts" aria-label="Counts">
        {countsLine(map.counts).map(c=><span key={c.id} className={`mv-as-count is-${c.id}`}><i aria-hidden="true"/>{c.value} {c.label}</span>)}
        <span className="mv-as-counts-note">{packet?`${packet.label}${packet.status==='sample'?' is the demo product (fictional)':''}${map.active?', live on the local store':', a draft not in the store yet'}.`:''}</span>
      </div>
      {map.problems.map(problem=><div key={problem} className="mv-as-problem" role="status"><TriangleAlert size={14}/>{problem}</div>)}

      {sort==='page'&&!query&&<nav className="mv-as-map" aria-label="Jump to a place on the page">{pages.map(page=>{const list=map.sections.filter(s=>s.page===page.id);if(!list.length)return null;return <div key={page.id} className="mv-as-map-page"><small>{PAGE_SHORT[page.id]||page.label}</small>
        {list.map(s=>{const counted=s.slots.filter(x=>!x.derived);const need=counted.some(x=>!x.optional&&['empty','missing'].includes(x.status));return <button key={s.id} type="button" className={`mv-as-map-item ${need?'is-need':''}`} onClick={()=>jump(s.id)} title={s.help}><b>{s.number}</b><span>{s.label}</span><span className="mv-as-dots" aria-hidden="true">{counted.map(x=><i key={x.id} className={`is-${x.status}`}/>)}{!counted.length&&<i className="is-repeat"/>}</span></button>;})}
      </div>;})}</nav>}

      {sort==='page'?<>
        {pages.map(page=>{const list=sections.filter(s=>s.page===page.id);if(!list.length)return null;const Icon=PAGE_ICONS[page.id]||FileCode;return <div key={page.id} className="mv-as-pagegroup">
          <header className="mv-as-pagehead"><span className="mv-as-pageicon"><Icon size={15}/></span><h2>{page.label}</h2>{page.id!=='other'&&(page.url||page.id==='home')&&<a className="mv-link" href={`${STORE}${page.url||'/'}`} target="_blank" rel="noreferrer">See it on the local store<ArrowUpRight size={12}/></a>}{page.id==='other'&&<span className="mv-small">Site pictures (site.json) stay whatever product is shown; the About and Help product blocks change with the product.</span>}</header>
          <div className="mv-as-secs">{list.map(section=><SectionBlock key={section.id} section={section} onOpen={setOpen}/>)}</div>
        </div>;})}
        {query&&!sections.length&&<div className="mv-card mv-empty"><Search size={22}/><strong>No place on the page matches "{query}".</strong></div>}
      </>:<section className="mv-card mv-as-flat" aria-label={`All pictures, ${SORTS.find(([id])=>id===sort)[1].toLowerCase()}`}>
        <div className="mv-as-flat-head"><h2 className="mv-h2">{SORTS.find(([id])=>id===sort)[1]}</h2><span className="mv-small">{tiles.length} pictures and places · each shows where it sits</span></div>
        {tiles.length?<div className="mv-as-grid">{tiles.map(t=>t.type==='slot'?<SlotTile key={t.id} slot={t.slot} section={t.section} chip idPrefix="flat" onOpen={setOpen}/>:<FileTile key={t.id} item={t.item} chip idPrefix="flat" onOpen={setOpen}/>)}</div>:<p className="mv-as-none">Nothing matches "{query}".</p>}
      </section>}

      <div className="mv-as-pagehead mv-as-afterhead"><span className="mv-as-pageicon is-soft"><Layers size={15}/></span><h2>Not on the page</h2><span className="mv-small">Brand files, ads, saved files the page does not use, and the bin.</span></div>
      <div className="mv-as-after">
        <section className="mv-card mv-as-group" id="as-group-brand"><header className="mv-as-group-head"><Package size={16}/><h3>Brand</h3><b>{brand.length}</b><p>Logo and icon files for the store and ads.</p></header>
          {brand.length?<div className="mv-as-grid">{brand.map(item=><FileTile key={item.path} item={item} idPrefix="brand" onOpen={setOpen}/>)}</div>:<p className="mv-as-none">No brand files{query?' match':' yet'}.</p>}</section>
        <section className="mv-card mv-as-group" id="as-group-ads"><header className="mv-as-group-head"><Megaphone size={16}/><h3>Ads</h3><b>{ads.length}</b><p>Meta ad pictures. They run in ads, not on the store page.</p></header>
          {ads.length?<div className="mv-as-grid">{ads.map(item=><FileTile key={item.path} item={item} idPrefix="ads" onOpen={setOpen}/>)}</div>:<p className="mv-as-none">{query?'No ad pictures match.':'No ad pictures yet. The image maker saves them in products/P###/assets/ads/.'}</p>}</section>
        {sort==='page'&&<section className="mv-card mv-as-group" id="as-group-notPlaced"><header className="mv-as-group-head"><Layers size={16}/><h3>Not placed</h3><b>{notPlaced.length}</b><p>Saved files the store page does not use: drafts, older versions and store-folder originals.</p></header>
          {notPlaced.length?<div className="mv-as-grid">{notPlaced.map(item=><FileTile key={item.path} item={item} idPrefix="loose" onOpen={setOpen}/>)}</div>:<p className="mv-as-none">Every saved file is on the page{query?' or does not match':''}.</p>}</section>}
        <section className="mv-card mv-as-group mv-as-bin" id="as-group-removed"><header className="mv-as-group-head"><Trash2 size={16}/><h3>Removed</h3><b>{binned.length}</b></header>
          <p className="mv-as-bin-note"><ArchiveRestore size={15}/><span>Removed files wait in a <code>_removed</code> folder beside where they were, and <b>Restore</b> puts them back. The app never deletes anything. If you want them gone for good, empty the <code>_removed</code> folder yourself.</span></p>
          {binned.length?<div className="mv-as-grid">{binned.map(item=><RemovedTile key={item.id} item={item} busy={busy===`restore-${item.id}`} onOpen={setOpen} onRestore={restore}/>)}</div>:<p className="mv-as-none">Nothing in the bin.</p>}
          {gone.length>0&&<p className="mv-as-none" style={{marginTop:8}}>{gone.length} {gone.length===1?'file was':'files were'} emptied from the bin folder by hand.</p>}
          {error&&!entry&&<div className="mv-error" role="alert" style={{marginTop:10}}>{error}</div>}</section>
      </div>
    </>}
    </>}

    {entry&&map&&<AssetSheet key={`${entry.type}-${open.id}`} entry={entry} map={map} busy={Boolean(busy)} error={error} notify={notify} go={go}
      onClose={()=>{setOpen(null);setError('');}} onRemove={remove} onRestore={restore} onJump={id=>{setOpen(null);jump(id);}}/>}
  </section>;
}

/** Build and Create pages: the store's pictures at a glance, with the empty places one click away. */
export function StorePicturesPanel({assetMap,go,title='Store page pictures'}) {
  const pictures = storePictures(assetMap);
  const needs = pictures?.needs.length||0;
  return <section className="mv-card mv-pad mv-as-panel">
    <div className="mv-panel-title"><h2 className="mv-h2"><Images size={17}/>{title}</h2><span className="mv-as-panel-links"><button className="mv-link" onClick={()=>go('store')}>Store editor<ArrowUpRight size={13}/></button><button className="mv-link" onClick={()=>go('assets')}>Assets<ArrowUpRight size={13}/></button></span></div>
    {!pictures?<p className="mv-small">Reading the store page…</p>:<div className="mv-as-panel-row">
      <div className="mv-as-strip">{pictures.thumbs.filter(t=>!isVideoPath(t.file)).map(t=><button key={t.file} type="button" title={t.label} onClick={()=>go(`assets?file=${encodeURIComponent(t.file)}`)}><img src={assetUrl(t.file)} alt={t.label} loading="lazy"/></button>)}
        {pictures.needs.slice(0,3).map(({section,slot})=><button key={slot.id} type="button" className="is-need" title={`${section.label}: ${statusLabel(slot)}`} onClick={()=>go(`assets?section=${section.id}`)}>{slot.kind==='video'?<Film size={16}/>:<ImagePlus size={16}/>}</button>)}</div>
      <div className="mv-as-panel-side">
        <span><b>{pictures.counts.filled}</b> filled · <b>{pictures.counts.empty}</b> empty{pictures.counts.missing?<> · <b>{pictures.counts.missing}</b> missing</>:null}</span>
        {needs?<button type="button" className="mv-btn sm" onClick={()=>go('assets?sort=needs')}><ImagePlus size={13}/>{pictures.counts.missing?`${needs} need a picture`:`${needs} empty ${needs===1?'slot':'slots'}`}<ArrowRight size={13}/></button>:<span className="mv-as-pill is-live">Every place has a picture</span>}
      </div>
    </div>}
  </section>;
}
