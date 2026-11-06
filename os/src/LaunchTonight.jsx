import React,{useEffect,useMemo,useState} from 'react';
import {Megaphone,MonitorSmartphone,Gift,Hand,Rocket,Check,ArrowUpRight,FileText,FolderOpen,ChevronDown,CircleCheck} from 'lucide-react';
import {api} from './ui.jsx';
import {Meter,Ring,timeAgo} from './kit.jsx';
import {headingAnchor} from './documentPaths.mjs';
import {LAUNCH_PLAN_PATH,NATIVE_AD_KIT_PATH,POPULATION_PATH,LAUNCH_SITE_URL,parseLaunchPlan,launchBlocks,launchPanel,splitLead,inlineParts,linkTarget,launchProduct,launchFolders,folderLine,launchWork} from './launchTonight.mjs';
import {liveRunning} from './workflowView.mjs';
import './launch.css';

const ICONS = {ads:Megaphone,website:MonitorSmartphone,offer:Gift,actions:Hand};
const SHOWN = 5;
const agentName = id => id?id.charAt(0).toUpperCase()+id.slice(1).replace(/-/g,' '):'An agent';

// An older server has no /api/launch: after its first 404 this page reads the plan
// through the document reader instead, so the console shows one 404 per load at most.
let launchRoute = 'unknown';

/**
 * The saved plan for tonight and its folder counts. Reads GET /api/launch; an
 * older server without it still shows the plan through the document reader
 * (no folder counts). Nothing here writes a record.
 */
export function useLaunchTonight({buildProductId,products}) {
  const [state,setState] = useState(null);
  const productKey = (products||[]).map(product=>product.id).join('|');
  useEffect(()=>{
    let live = true, folderQuery = '';
    const list = productKey?productKey.split('|').map(id=>({id})):[];
    async function viaDoc() {
      const read = async path=>{try{return await api('/api/doc?path='+encodeURIComponent(path));}catch{return null;}};
      const plan = await read(LAUNCH_PLAN_PATH);
      // The kit and the guide are read only when there is a plan, so a project without one asks nothing more.
      const [kit,population] = plan?await Promise.all([read(NATIVE_AD_KIT_PATH),read(POPULATION_PATH)]):[null,null];
      return {plan:plan?{path:LAUNCH_PLAN_PATH,exists:true,content:plan.content}:{path:LAUNCH_PLAN_PATH,exists:false},kit:{path:NATIVE_AD_KIT_PATH,exists:!!kit},population:{path:POPULATION_PATH,exists:!!population},folders:[],older:true};
    }
    async function launchRead(query) {
      if (launchRoute==='missing') return viaDoc();
      try {const value = await api('/api/launch'+(query?`?${query}`:''));launchRoute = 'ok';return value;}
      catch (error) {if (error.status===404||error.status===405) launchRoute = 'missing';return viaDoc();}
    }
    async function load() {
      let value = await launchRead(folderQuery);
      const parsed = value.plan?.exists?parseLaunchPlan(value.plan.content):null;
      const productId = parsed?launchProduct({buildProductId,planText:value.plan.content,products:list}):null;
      const ads = parsed?launchBlocks(parsed).blocks.find(block=>block.id==='ads').groups:[];
      const folders = parsed?launchFolders({productId,adsSections:ads}):[];
      const query = new URLSearchParams(folders.map(folder=>['folder',folder])).toString();
      if (!value.older&&query!==folderQuery) {folderQuery = query;if (query) value = await launchRead(query);}
      if (live) setState({...value,parsed,productId});
    }
    load();
    const timer = setInterval(load,15000);
    return ()=>{live = false;clearInterval(timer);};
  },[buildProductId,productKey]);
  return state;
}

/** One line of the plan with its links: documents open in the reader, web pages in a new tab, folders and files as names. */
function Inline({text,openDoc,folders=[]}) {
  return inlineParts(text).map((part,index)=>{
    if (!part.href) return <React.Fragment key={index}>{part.text}</React.Fragment>;
    const target = linkTarget(part.href);
    if (target?.kind==='web') return <a key={index} className="mv-ln-inline" href={target.href} target="_blank" rel="noreferrer">{part.label}<ArrowUpRight size={11}/></a>;
    if (target?.kind==='doc'||target?.kind==='file'&&/\.(png|jpe?g|webp|gif)$/i.test(target.path)) return <button key={index} type="button" className="mv-ln-inline" onClick={()=>openDoc(target.path)}>{part.label}</button>;
    // A folder the route counted opens its newest note; any other folder or file is just its name.
    const counted = target?.kind==='folder'&&folders.find(folder=>folder.path===target.path&&folder.docs?.length);
    if (counted) return <button key={index} type="button" className="mv-ln-inline" title={`${target.path} · ${folderLine(counted)}`} onClick={()=>openDoc(counted.docs[0])}>{part.label}</button>;
    return <span key={index} className="mv-ln-path" title={target?.path||part.href}>{part.label}</span>;
  });
}

/** Who is on this block right now, from live running reports (the saved activity feed). */
function LiveWork({work}) {
  if (!work?.length) return null;
  return <ul className="mv-ln-live" aria-label="Working on it now">{work.slice(0,2).map(report=><li key={report.id}>
    <span className="mv-ln-pulse" aria-hidden="true"/>
    <span><strong>{agentName(report.agent)}</strong> {report.latest||report.title}</span>
    <small>{timeAgo(report.updatedAt)}</small>
  </li>)}</ul>;
}

/**
 * One step as one short line (its bold lead or first clause) with its saved
 * tick, who and how long; the rest of the line, its table columns and its
 * sub-points fold open underneath.
 */
function Item({item,openDoc,owner,folders}) {
  const [open,setOpen] = useState(false);
  const {lead,detail} = splitLead(item.text);
  const ownerStep = owner||/^owner\b/i.test(item.who);
  const details = [detail,item.more].filter(Boolean);
  const has = details.length>0||item.children.length>0;
  const who = item.who?(/^owner\b/i.test(item.who)?'You':item.who.split(/[,;(]/)[0].trim()):'';
  const time = item.time?item.time.split(/[(;.]/)[0].trim():'';
  return <li className={`mv-ln-item ${item.task?(item.done?'is-done':'is-open'):'is-note'} ${ownerStep&&item.task&&!item.done?'is-owner':''}`}>
    <span className="mv-ln-tick" aria-hidden="true">{item.task&&item.done&&<Check size={11} strokeWidth={3}/>}</span>
    <div className="mv-ln-body">
      <div className="mv-ln-line">
        {has?<button type="button" className="mv-ln-lead" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><span className="mv-ln-sr">{item.task?(item.done?'Done: ':'To do: '):''}</span><Inline text={lead} openDoc={openDoc} folders={folders}/>{'⁠'}<ChevronDown size={12} className="mv-ln-chev"/></button>
          :<span className="mv-ln-lead"><span className="mv-ln-sr">{item.task?(item.done?'Done: ':'To do: '):''}</span><Inline text={lead} openDoc={openDoc} folders={folders}/></span>}
        {(who||time)&&<span className="mv-ln-meta">{who&&<em className={who==='You'?'is-you':''}>{who}</em>}{time&&<small>{time}</small>}</span>}
      </div>
      {open&&<div className="mv-ln-detail">
        {details.map((text,index)=><p key={index}><Inline text={text} openDoc={openDoc} folders={folders}/></p>)}
        {item.children.length>0&&<ul>{item.children.map((child,index)=><li key={index} className={child.done?'is-done':''}><Inline text={child.text} openDoc={openDoc} folders={folders}/>{child.children.length>0&&<ul>{child.children.map((grand,i)=><li key={i}><Inline text={grand.text} openDoc={openDoc} folders={folders}/></li>)}</ul>}</li>)}</ul>}
      </div>}
    </div>
  </li>;
}

function FolderLink({folder,label,openDoc}) {
  const doc = folder.docs?.[0];
  const body = <><FolderOpen size={14}/><span><strong>{label}</strong><small>{folderLine(folder)}{folder.modifiedAt?` · updated ${timeAgo(folder.modifiedAt)}`:''}</small></span>{doc&&<ArrowUpRight size={12}/>}</>;
  return doc?<button type="button" className="mv-ln-res" onClick={()=>openDoc(doc)} title={`Open ${doc}`}>{body}</button>:<span className="mv-ln-res is-static" title={folder.path}>{body}</span>;
}

// "P001 creative", "P001 ad images", or a batch folder's own name.
function folderLabel(path) {
  const product = /^products\/(P\d{3,})[^/]*\/(.+)$/.exec(path);
  if (product) return `${product[1]} ${product[2].replace('assets/ads','ad images').replaceAll('/',' / ')}`;
  return path.split('/').slice(1).join(' / ');
}

function Block({block,openDoc,links,folders,work}) {
  const [all,setAll] = useState(false);
  const Icon = ICONS[block.id];
  const itemCount = block.groups.reduce((sum,group)=>sum+group.items.length,0);
  // Collapsed: the first five lines in file order; a group shows its heading only when one of its lines shows.
  let budget = all?Infinity:SHOWN;
  const parts = block.groups.map((group,index)=>{const items = group.items.slice(0,Math.max(0,budget));budget -= items.length;return {group,items,index};})
    .filter(part=>part.items.length||(part.group.callout||part.group.lead)&&(all||part.index===0));
  const several = block.groups.length>1;
  return <article className={`mv-ln-block is-${block.id}`} aria-labelledby={`mv-ln-title-${block.id}`}>
    <header className="mv-ln-bhead">
      <span className="mv-ln-n">{block.n}</span>
      <span className="mv-ln-icon"><Icon size={16}/></span>
      <h3 id={`mv-ln-title-${block.id}`}>{block.title}</h3>
      {block.total>0&&<span className={`mv-ln-count ${block.done===block.total?'is-all':''}`}>{block.done?`${block.done}/${block.total}`:`${block.total} step${block.total===1?'':'s'}`}</span>}
    </header>
    {block.done>0&&<Meter value={block.done} total={block.total} color={block.done===block.total?'var(--success)':undefined}/>}
    <LiveWork work={work}/>
    {!block.written?<p className="mv-ln-empty">Not in the plan yet.</p>:<>
      {parts.map(part=><div key={part.index} className="mv-ln-group">
        {several&&part.group.heading&&<strong className="mv-ln-gh">{part.group.heading}</strong>}
        {part.group.callout&&<p className="mv-ln-callout"><span><Inline text={part.group.callout} openDoc={openDoc} folders={folders}/></span></p>}
        {part.items.length>0&&<ul className="mv-ln-items">{part.items.map((item,index)=><Item key={index} item={item} openDoc={openDoc} owner={block.id==='actions'} folders={folders}/>)}</ul>}
      </div>)}
      {itemCount>SHOWN&&<button type="button" className="mv-ln-more" aria-expanded={all} onClick={()=>setAll(open=>!open)}>{all?'Show less':`Show all ${itemCount}`}<ChevronDown size={13}/></button>}
    </>}
    {links.length>0&&<div className="mv-ln-links">{links}</div>}
  </article>;
}

/**
 * The Launch plan (owner, Oct 1 evening; shown only while a product holds the
 * build slot since the owner paused tonight's launch): native ads and copy first, then the
 * website, then the offer and upsell, then the owner's own actions. What is
 * happening now comes from live agent reports; every step comes from the saved
 * plan. Hidden when store/LAUNCH-TONIGHT.md does not exist.
 */
export function LaunchTonight({launch,openDoc,activity,isMerrivy=true,buildProductId=null,buildingName='',collapsible=false}) {
  const [folded,setFolded] = useState(collapsible);
  const view = useMemo(()=>launch?.parsed?launchBlocks(launch.parsed):null,[launch]);
  const work = useMemo(()=>launchWork(liveRunning(activity||[])),[activity]);
  const panel = launchPanel({buildProductId,buildingName,planExists:Boolean(launch?.plan?.exists)});
  if (!panel.show||!view) return null;
  const plan = launch.parsed, productId = launch.productId;
  const working = new Set([...work.ads,...work.website,...work.offer].map(report=>report.agent)).size;
  const folders = launch.folders||[];
  const productFolders = folders.filter(folder=>productId&&folder.path.startsWith(`products/${productId}/`));
  const linkedFolders = folders.filter(folder=>!productFolders.includes(folder)&&folder.exists);
  const links = {
    ads:[
      launch.kit?.exists&&<button key="kit" type="button" className="mv-ln-res" onClick={()=>openDoc(NATIVE_AD_KIT_PATH)}><FileText size={14}/><span><strong>Native ad kit</strong><small>Formats, angle formula, rules</small></span><ArrowUpRight size={12}/></button>,
      ...productFolders.filter((folder,index)=>index===0||folder.exists).map(folder=><FolderLink key={folder.path} folder={folder} label={folderLabel(folder.path)} openDoc={openDoc}/>),
      ...linkedFolders.map(folder=><FolderLink key={folder.path} folder={folder} label={folderLabel(folder.path)} openDoc={openDoc}/>),
    ].filter(Boolean),
    website:[
      isMerrivy&&<a key="site" className="mv-ln-res" href={LAUNCH_SITE_URL} target="_blank" rel="noreferrer"><MonitorSmartphone size={14}/><span><strong>Open the site</strong><small>localhost:3001</small></span><ArrowUpRight size={12}/></a>,
      launch.population?.exists!==false&&<button key="pop" type="button" className="mv-ln-res" onClick={()=>openDoc(POPULATION_PATH)}><FileText size={14}/><span><strong>Fill the product page</strong><small>Hydrogen population guide</small></span><ArrowUpRight size={12}/></button>,
    ].filter(Boolean),
    offer:[],actions:[],
  };
  const saved = launch.plan.modifiedAt?timeAgo(launch.plan.modifiedAt):'';
  const steps = view.blocks.reduce((sum,block)=>sum+block.total,0), stepsDone = view.blocks.reduce((sum,block)=>sum+block.done,0);
  const summary = plan.callout||plan.intro;
  // Home keeps the plan folded: one bar with its progress; the whole plan is one tap away.
  if (folded) return <button type="button" className="mv-cd-launchbar" aria-expanded="false" onClick={()=>setFolded(false)}>
    <Ring value={stepsDone+view.alreadyDone} total={steps+view.alreadyDone} size={44} stroke={5} label={String(stepsDone+view.alreadyDone)}/>
    <span><strong>{panel.title}</strong><small>{stepsDone+view.alreadyDone} of {steps+view.alreadyDone} steps done{saved?` · saved ${saved}`:''}{working>0?` · ${working} agent${working===1?'':'s'} on it`:''}</small></span>
    <span>Open plan<ChevronDown size={14}/></span>
  </button>;
  return <section className="mv-ln" aria-label="Launch plan">
    <div className="mv-ln-head">
      <span className="mv-ln-rocket"><Rocket size={18}/></span>
      <div className="mv-ln-head-text">
        <span className="mv-eyebrow">{panel.eyebrow}{saved?` · plan saved ${saved}`:''}</span>
        <h2>{panel.title}</h2>
        {summary&&<p><Inline text={summary} openDoc={openDoc}/></p>}
        <div className="mv-ln-chips">
          {working>0&&<span className="mv-ln-chip is-live"><span className="mv-ln-pulse" aria-hidden="true"/>{working} agent{working===1?'':'s'} on it now</span>}
          {steps>0&&<span className="mv-ln-chip">{stepsDone?`${stepsDone} of ${steps} steps ticked`:`${steps} steps`}</span>}
          {view.alreadyDone>0&&<span className="mv-ln-chip is-done"><CircleCheck size={12}/>{view.alreadyDone} already done</span>}
        </div>
      </div>
      {collapsible&&<button type="button" className="mv-ln-link" onClick={()=>setFolded(true)}>Fold<ChevronDown size={13} style={{transform:'rotate(180deg)'}}/></button>}
      <button type="button" className="mv-ln-link" onClick={()=>openDoc(LAUNCH_PLAN_PATH)}>Open the plan<ArrowUpRight size={13}/></button>
    </div>
    <div className="mv-ln-flow">{view.blocks.map(block=><Block key={block.id} block={block} openDoc={openDoc} links={links[block.id]} folders={folders} work={work[block.id]}/>)}</div>
    {view.other.length>0&&<p className="mv-ln-also">Also in the plan: {view.other.map((section,index)=><React.Fragment key={index}>{index?' · ':''}<button type="button" className="mv-ln-inline" onClick={()=>openDoc(`${LAUNCH_PLAN_PATH}#${headingAnchor(section.heading)}`)}>{section.heading.replace(/^\d+[.)]\s*/,'').replace(/\s*\([^)]*\)\s*$/,'')||'notes'}</button></React.Fragment>)}</p>}
    {launch.plan.tooLarge&&<p className="mv-ln-also">The plan is too long to show here; open it to read it.</p>}
  </section>;
}
