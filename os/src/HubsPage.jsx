import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Compass,Images,Lightbulb,PenLine,Sparkles,Store,Telescope,Trophy,Users} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,assetUrl} from './kit.jsx';
import {CountUp,SectionHead} from './cards.jsx';
import {TOPIC_LABELS} from './libraryModel.mjs';
import {HUB_DOORS,adLayouts,entryDay,fileTitle,isGemini,isResearch,researchShelf,studiedAds} from './hubDoors.mjs';
import './hubs.css';

// The Hub home (owner, Nov 5): "one of the most important tabs because this tab is like the pre-research stuff
// before we even start finding products." The same doors serve the owner and the agents (`os.mjs hub`).

const DOOR_ICONS = {copy:PenLine,creatives:Images,winners:Trophy,research:Telescope,store:Store,team:Users};

/** The saved Library, kept fresh while a Hub is open. */
export function useLibrary() {
  const [catalog,setCatalog] = useState(null),[error,setError] = useState('');
  useEffect(()=>{
    let alive = true;
    const load = ()=>api('/api/library').then(data=>{if (alive) {setCatalog(data);setError('');}}).catch(e=>{if (alive) setError(e.message);});
    load();
    const timer = setInterval(load,30000);
    return ()=>{alive = false;clearInterval(timer);};
  },[]);
  return [catalog?.entries||[],error,Boolean(catalog)];
}

const shortDay = value => {const day = new Date(`${value}T12:00:00`);return Number.isFinite(day.getTime())?day.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';};

/** One report: where it came from, what it found, and its file a tap away. */
export function ResearchCard({entry,openDoc,index=0}) {
  const day = entryDay(entry), topic = TOPIC_LABELS[entry.topics?.[0]];
  return <button type="button" className="mv-hb-report mv-cd-rise" style={{'--i':Math.min(index,12)}} onClick={()=>openDoc(entry.path)} disabled={!entry.path} title={entry.path||'No file saved'}>
    <span className="mv-hb-report-top">{isGemini(entry)?<em className="is-gemini"><Sparkles size={11}/>Gemini</em>:<em>Research</em>}{topic&&<small>{topic}</small>}</span>
    <strong>{entry.title}</strong>
    {entry.learned&&<p>{entry.learned}</p>}
    <span className="mv-hb-report-foot">{day&&<time>{shortDay(day)}</time>}{entry.path&&<ArrowUpRight size={13}/>}</span>
  </button>;
}

/** A wall of pictures: small tiles, one tap for the full picture. */
export function PictureWall({files,limit:start=24,title=fileTitle}) {
  const [open,setOpen] = useState(null),[limit,setLimit] = useState(start);
  return <>
    <div className="mv-hb-wall">{files.slice(0,limit).map(file=><button key={file.path} type="button" className="mv-hb-picture" onClick={()=>setOpen(file)} aria-label={`Open ${title(file.path)}`}>
      <img src={assetUrl(file.path)} alt="" loading="lazy"/>
      <span>{title(file.path)}</span>
    </button>)}</div>
    {files.length>limit&&<div className="mv-hb-more"><button className="mv-btn" onClick={()=>setLimit(limit+start)}>Show {Math.min(start,files.length-limit)} more</button><small>{limit} of {files.length}</small></div>}
    {open&&<Sheet wide title={title(open.path)} subtitle={open.path} onClose={()=>setOpen(null)}><img className="mv-hb-picture-full" src={assetUrl(open.path)} alt={title(open.path)}/></Sheet>}
  </>;
}

/** Assets & Creatives · References: what agents study before making an ad. */
export function AdReferences({hub,openDoc,openLibrary,hideLinks=false}) {
  const media = hub?.resourceMedia||[];
  const layouts = useMemo(()=>adLayouts(media),[media]), studied = useMemo(()=>studiedAds(media),[media]);
  const door = HUB_DOORS.find(entry=>entry.id==='creatives');
  return <div className="mv-hb-refs">
    {!hideLinks&&<div className="mv-hb-links">
      {door.links.filter(link=>link.doc).map(link=><button key={link.doc} type="button" onClick={()=>openDoc(link.doc)}><BookOpen size={13}/>{link.label}</button>)}
      {openLibrary&&<button type="button" onClick={()=>openLibrary('images')}><Lightbulb size={13}/>Visual lessons</button>}
    </div>}
    <section className="mv-hb-section">
      <SectionHead icon={Images} title="Ad layouts" count={layouts.length}/>
      {layouts.length?<PictureWall files={layouts} title={path=>`Layout ${Number(path.match(/(\d+)\.\w+$/)?.[1])||fileTitle(path)}`}/>:<p className="mv-hb-quiet">No ad layouts saved yet.</p>}
    </section>
    {studied.length>0&&<section className="mv-hb-section">
      <SectionHead icon={PenLine} title="Ads we studied" count={studied.length}/>
      <PictureWall files={studied}/>
    </section>}
  </div>;
}

function Door({door,count,unit,team,go,openDoc}) {
  const Icon = DOOR_ICONS[door.id]||Compass;
  const index = HUB_DOORS.indexOf(door);
  return <article className={`mv-hb-door is-tile-${index%6+1}`}>
    <button type="button" className="mv-hb-door-main" onClick={()=>go(door.go)} aria-label={`${door.title}: open`}>
      <span className="mv-hb-door-top">
        <span className="mv-hb-door-icon"><Icon size={20}/></span>
        {count>0&&<span className="mv-hb-door-count"><b><CountUp value={count}/></b><small>{unit}</small></span>}
      </span>
      <strong>{door.title}</strong>
      <p>{door.line}</p>
    </button>
    {door.id==='team'?<div className="mv-hb-door-links">{(team?.agents||[]).map(agent=><button key={agent.id} type="button" title={agent.summary} onClick={()=>go(door.go)}>{agent.name}</button>)}</div>
      :<div className="mv-hb-door-links">{door.links.map(link=><button key={link.label} type="button" onClick={()=>link.go?go(link.go):openDoc(link.doc)}>{link.label}</button>)}</div>}
  </article>;
}

export function HubsPage({data,hub,go,openDoc}) {
  const [entries,error,loaded] = useLibrary();
  const team = data?.team;
  const media = hub?.resourceMedia||[];
  const onTopic = topic => entries.filter(entry=>entry.status!=='to-learn'&&(entry.topics||[]).includes(topic)).length;
  const counts = {copy:[onTopic('copywriting'),'guides'],creatives:[adLayouts(media).length,'ad layouts'],winners:[onTopic('product-research'),'guides'],research:[entries.filter(isResearch).length,'reports'],store:[onTopic('store'),'guides'],team:[(team?.agents||[]).length,'subagents']};
  const latest = useMemo(()=>researchShelf(entries).slice(0,3),[entries]);
  return <section className="mv-hb">
    <header className="mv-hb-hero">
      <div>
        <span className="mv-eyebrow">Library</span>
        <h1>Everything before you find a product</h1>
        <p>Everything our agents read before they work: playbooks, winning references, themes, and deep research.</p>
      </div>
      <button type="button" className="mv-btn" onClick={()=>go('library')}><BookOpen size={15}/>Search All Saved Docs</button>
    </header>
    <div className="mv-hb-doors">{HUB_DOORS.map(door=><Door key={door.id} door={door} count={counts[door.id][0]} unit={counts[door.id][1]} team={team} go={go} openDoc={openDoc}/>)}</div>
    <section className="mv-hb-section">
      <div className="mv-hb-head">
        <SectionHead icon={Telescope} title="Latest research"/>
        <button type="button" className="mv-link" onClick={()=>go('trends?tab=research')}>All research<ArrowRight size={13}/></button>
      </div>
      {error?<p className="mv-hb-quiet">{error}</p>:latest.length?<div className="mv-hb-reports">{latest.map((entry,index)=><ResearchCard key={entry.id} entry={entry} openDoc={openDoc} index={index}/>)}</div>:<p className="mv-hb-quiet">{loaded?'No research saved yet.':'Loading…'}</p>}
    </section>
  </section>;
}
