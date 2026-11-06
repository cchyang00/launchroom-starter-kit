import {projectAsset} from './projectScope.mjs';
import React, {useState} from 'react';
import {BookOpen, FileText, Image, Film, ArrowUpRight, Search, Package, Copy, FolderOpen} from 'lucide-react';
import {Modal, Empty, date} from './ui.jsx';
import {PLAYBOOK_PATH,prioritizePlaybook} from './playbook.mjs';
import './resources.css';

export const mediaUrl = item => projectAsset(item.path);
export const isCase = doc => doc.path.includes('/references/cases/');
export const isLearningDoc = doc => /^(resources|guides|research|workflow|templates)\//.test(doc.path) || (doc.path.startsWith('agents/') && !/\/memory\/STATE\.md$|FOLDER-PROPOSAL\.md$/.test(doc.path)) || doc.path==='store/PRODUCT-PAGE-BLUEPRINT.md';
const matches = (item, query) => `${item.title||item.name} ${item.path} ${item.category||''} ${item.evidenceStatus||''}`.toLowerCase().includes(query.toLowerCase());
const label = item => item.category==='Layout examples'?'Synthetic example':item.category==='Creative references'?'External layout':item.category;
const START_HERE=[
  ['workflow/PLAYBOOK.md','A-to-Z workflow'],
  ['workflow/KALODATA-IMAGE-PILOT.md','Current research route'],
  ['workflow/PRE-VERIFICATION-SCREEN.md','Product screen'],
  ['workflow/PRE-DISCOVERY-CHECKLIST.md','Search-start checklist'],
  ['resources/SEARCH-CURATION.md','Visual curation method'],
  ['resources/research/2026-09-27-a-to-z-checkpoints.md','A-to-Z checkpoints'],
  ['resources/research/2026-09-27-experiment-decisions.md','Experiment decisions'],
  ['resources/research/2026-09-27-order-operations.md','Order operations'],
  ['resources/STORE-BUILDING-REFERENCES.md','Store-building references']
];

export function MediaVisual({item, controls=false, className=''}) {
  return item.kind==='video' ? controls ? <video className={className} controls preload="metadata" src={mediaUrl(item)}/> : <div className={'resource-video-cover '+className}><Film size={30}/><span>{item.scope==='resource'?'Video reference':'Production video'}</span></div> : <img className={className} src={mediaUrl(item)} alt={item.name} loading="lazy"/>;
}
export function MediaPreview({item,onClose,notify,openDoc}) {
  return <Modal wide title={item.name} subtitle={label(item)} onClose={onClose}>
    <div className="asset-preview"><MediaVisual item={item} controls/></div>
    <div className="asset-details"><code>{item.path}</code><span>{Math.round(item.size/1024)} KB · Updated {date(item.modifiedAt)}</span></div>
    <div className="modal-actions"><button className="btn" onClick={async()=>{try {await navigator.clipboard.writeText(item.path);notify?.('Workspace path copied.');}catch{notify?.('Could not copy. The path is shown above.');}}}><Copy size={14}/>Copy path</button>{openDoc&&item.scope==='resource'&&<button className="btn" onClick={()=>openDoc('resources/INDEX.md')}>Source & learning guide<BookOpen size={14}/></button>}<a className="btn primary" href={mediaUrl(item)} target="_blank" rel="noreferrer">Open original<ArrowUpRight size={14}/></a></div>
    <p className="muted-note">{item.scope==='resource'?'Reference media informs the work. Inspect its source notes for context, outcome and reuse rights.':'A production file can still be a draft. Its product or store record holds review and usage status.'}</p>
  </Modal>;
}
function MediaGrid({items,onSelect}) {return <div className="asset-grid resource-media-grid">{items.map(item=><button className="asset-card" key={item.path} onClick={()=>onSelect(item)}><div className="asset-image"><MediaVisual item={item}/></div><div className="asset-caption"><strong>{item.name.replace(/\.[^.]+$/,'').replaceAll('-',' ')}</strong><small>{label(item)}</small></div></button>)}</div>;}

export function Library({data,hub,openDoc,notify,libraryView='guides'}) {
  const [view,setView]=useState(libraryView),[query,setQuery]=useState(''),[category,setCategory]=useState('all'),[preview,setPreview]=useState(null),[showAll,setShowAll]=useState(false);
  const docs=(data.documents||[]).filter(isLearningDoc),cases=docs.filter(isCase),guides=prioritizePlaybook(docs.filter(d=>!isCase(d)));
  const media=hub.resourceMedia||[],images=media.filter(m=>m.kind!=='video'),videos=media.filter(m=>m.kind==='video');
  const collections=[['guides','Guides & methods',BookOpen,guides.length],['cases','Product cases',Package,cases.length],['images','Visual references',Image,images.length],['videos','Videos',Film,videos.length]];
  const items=({guides,cases,images,videos})[view];
  const categories=[...new Set(items.map(i=>i.category))].filter(Boolean);
  const filtered=items.filter(i=>(category==='all'||i.category===category)&&matches(i,query));
  const featured=view==='guides'&&!query.trim()&&category==='all'&&!showAll;
  const visible=featured?START_HERE.map(([path])=>guides.find(item=>item.path===path)).filter(Boolean):filtered;
  const shortTitle=path=>START_HERE.find(([item])=>item===path)?.[1];
  const description={guides:'How we research, build and improve. Open a guide to read the same source the agents use.',cases:'See the item, the buyer situation and the reasoning. Each case keeps its evidence and outcome attached.',images:'Layouts, demonstrations and examples to study before creating our own product assets.',videos:'Playable local examples. Original course and ad links also live inside their guides and case notes.'}[view];
  return <div className="resources-page"><div className="page-heading"><div className="heading-row"><div><h1>Guidelines & references</h1><p>Start with the active method. Search the full library when you need deeper evidence.</p></div><button className="btn" onClick={()=>openDoc('resources/INDEX.md')}><BookOpen size={14}/>Library index</button></div></div>
    <div className="resource-library-layout"><aside className="resource-collections"><span className="tiny-label">COLLECTIONS</span>{collections.map(([id,title,Icon,count])=><button key={id} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>{setView(id);setCategory('all');setQuery('');}}><Icon size={16}/><span>{title}</span><small>{count}</small></button>)}<div className="resource-learning-note"><span className="tiny-label">OUR LEARNING LOOP</span><p>Read the method.<br/>Study the examples.<br/>Do the work.<br/>Save what we learn.</p><button className="text-link" onClick={()=>openDoc('agents/manager/references/IMPROVEMENT.md')}>How lessons become methods<ArrowUpRight size={13}/></button></div></aside>
    <section className="resource-collection-content"><div className="resource-collection-title"><h2>{featured?'Start here':collections.find(c=>c[0]===view)[1]}</h2><span>{featured?`${visible.length} essentials`: `${visible.length} ${visible.length===1?'item':'items'}`}</span></div><p className="resource-description">{featured?'The active workflow and the latest checked operating guidance. Every file opens its full source.':description}</p><div className="resource-filterbar"><div className="search-box"><Search size={15}/><input aria-label="Search resources" placeholder="Search names, topics or paths…" value={query} onChange={e=>setQuery(e.target.value)}/></div>{categories.length>1&&<select aria-label="Resource category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c}>{c}</option>)}</select>}</div>
      {view==='guides'&&category==='all'&&!query.trim()&&<button className="resource-browse-toggle" onClick={()=>setShowAll(value=>!value)}>{showAll?'Show essentials':`Browse all ${guides.length} guides`}<ArrowUpRight size={13}/></button>}
      {view==='guides'?<div className="document-list">{visible.map(d=><button className={`document-row ${d.path===PLAYBOOK_PATH?'playbook-guide':''}`} key={d.path} onClick={()=>openDoc(d.path)}><span className="document-icon">{d.path===PLAYBOOK_PATH?<BookOpen size={18}/>:<FileText size={18}/>}</span><div><strong>{featured?shortTitle(d.path):d.title}</strong><small>{d.path}</small></div><ArrowUpRight size={15}/></button>)}</div>:view==='cases'?<div className="resource-case-grid">{visible.map(d=><button className="resource-case" key={d.path} onClick={()=>openDoc(d.path)}><div className="resource-case-image">{d.previewPath?<img src={mediaUrl({path:d.previewPath})} alt={d.title} loading="lazy"/>:<Package size={28}/>}</div><div className="resource-case-body"><small>CASE STUDY</small><h3>{d.title}</h3><p>{d.evidenceStatus||'Read source notes for outcome and scope.'}</p><span>Read case & evidence<ArrowUpRight size={13}/></span></div></button>)}</div>:<MediaGrid items={visible} onSelect={setPreview}/>}
      {!visible.length&&<Empty icon={view==='videos'?Film:BookOpen} title={query||category!=='all'?'No matching resources':view==='videos'?'No local reference videos yet':'This collection is ready to grow'}>{view==='videos'?'Save a permitted MP4 or WebM with its source notes in Resources. Videos will appear here as the agents add them.':'Saved guides, examples and checked lessons appear here as we work.'}</Empty>}
    </section></div>{preview&&<MediaPreview item={preview} onClose={()=>setPreview(null)} notify={notify} openDoc={openDoc}/>}</div>;
}

export function Assets({data,hub,notify,openDoc,openLibrary}) {
  const [scope,setScope]=useState('all'),[query,setQuery]=useState(''),[preview,setPreview]=useState(null);
  const all=hub.assets||[],products=data?.products||[];
  const scopes=[...new Set(all.filter(a=>a.scope==='product').map(a=>a.productId))];
  const items=all.filter(a=>(scope==='all'||(scope==='store'?a.scope==='store':a.productId===scope))&&matches(a,query));
  return <><div className="page-heading"><div className="heading-row"><div><h1>Asset hub</h1><p>Production files for the store and selected products. Open a file to check its scope and original path.</p></div><button className="btn" onClick={()=>openDoc('resources/INDEX.md')}><FolderOpen size={14}/>Filing guideline</button></div></div><div className="asset-hub-quick"><div><strong>{all.length}</strong><span>Production files</span></div><button onClick={()=>openLibrary?.('images')}><Image size={17}/><span><strong>Visual references</strong><small>{hub.resourceMedia?.length||0} library files · study before creating</small></span><ArrowUpRight size={14}/></button></div><div className="resource-filterbar production-filter"><select aria-label="Asset scope" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">All production assets · {all.length}</option><option value="store">Merrivy · Store assets</option>{scopes.map(id=><option key={id} value={id}>{products.find(p=>p.id===id)?.name||id}</option>)}</select><div className="search-box"><Search size={15}/><input aria-label="Search assets" placeholder="Search production files…" value={query} onChange={e=>setQuery(e.target.value)}/></div></div><MediaGrid items={items} onSelect={setPreview}/>{!items.length&&<Empty icon={Package} title={query?'No matching production assets':'No production files in this view'}>Product-specific images and videos appear here after they are saved. Use Visual references to study examples.</Empty>}{preview&&<MediaPreview item={preview} onClose={()=>setPreview(null)} notify={notify} openDoc={openDoc}/>}</>;
}
