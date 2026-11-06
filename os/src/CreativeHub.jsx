import React,{useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,Check,Film,Lightbulb,PenLine,Sparkles,ThumbsDown,Trophy,X} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,assetUrl} from './kit.jsx';
import {SectionHead} from './cards.jsx';
import {AdReferences,useLibrary} from './HubsPage.jsx';
import {HUB_DOORS,WHATS_GOOD_PATH,entryDay,parseWhatsGood} from './hubDoors.mjs';

// Assets & Creatives Hub (owner, Nov 5): "where assets and creatives live in terms of like finding new ways to
// improve. that's what i always think about the hub. a way for agents to see what's good copy, what's good assets."
// Three shelves, read from saved files: resources/copywriting/WHATS-GOOD.md, the Library and the agents' lessons.
// Nothing here changes a product.

const LEARNING_LOG = 'resources/notes/daily-1pct-improvement-log.md';

function useWhatsGood() {
  const [good,setGood] = useState(null),[error,setError] = useState('');
  useEffect(()=>{
    let alive = true;
    api(`/api/doc?path=${encodeURIComponent(WHATS_GOOD_PATH)}`).then(res=>{if(alive)setGood(parseWhatsGood(res?.content));}).catch(e=>{if(alive)setError(e.message);});
    return ()=>{alive = false;};
  },[]);
  return [good,error];
}

/** Library guides as small cards: the title, what it taught us and its file a tap away. */
function GuideCards({entries,openDoc}) {
  return <div className="mv-hb-guides">{entries.map(entry=><button key={entry.id} type="button" className="mv-hb-guide" disabled={!entry.path} onClick={()=>openDoc(entry.path)} title={entry.path||undefined}>
    <strong>{entry.title}</strong>
    {entry.learned&&<p>{entry.learned}</p>}
    {entry.path&&<ArrowUpRight size={13}/>}
  </button>)}</div>;
}

const DocLinks = ({door,openDoc,go}) => <div className="mv-hb-links">
  <button type="button" onClick={()=>openDoc(WHATS_GOOD_PATH)}><Sparkles size={13}/>The file behind this page</button>
  {door.links.filter(link=>link.doc&&link.doc!==WHATS_GOOD_PATH).map(link=><button key={link.doc} type="button" onClick={()=>openDoc(link.doc)}><BookOpen size={13}/>{link.label}</button>)}
  {door.topic&&<button type="button" onClick={()=>go(`library?topic=${door.topic}`)}><Lightbulb size={13}/>All of it in the Library</button>}
</div>;

/* ---------- Good copy ---------- */
function PairCard({pair,index}) {
  return <article className="mv-hb-pair mv-cd-rise" style={{'--i':Math.min(index,10)}}>
    <small>{pair.where}</small>
    <div className="mv-hb-say is-yes"><i><Check size={12} strokeWidth={3}/></i><p>{pair.say}</p></div>
    <div className="mv-hb-say is-no"><i><X size={12} strokeWidth={3}/></i><p>{pair.not}</p></div>
    {pair.why&&<span className="mv-hb-why">{pair.why}</span>}
  </article>;
}

function GoodCopy({good,entries,openDoc,go}) {
  const door = HUB_DOORS.find(entry=>entry.id==='copy');
  const words = good.worked.filter(ad=>ad.words);
  const guides = useMemo(()=>entries.filter(entry=>entry.status!=='to-learn'&&(entry.topics||[]).includes('copywriting')).sort((a,b)=>entryDay(b).localeCompare(entryDay(a))).slice(0,6),[entries]);
  return <>
    <DocLinks door={door} openDoc={openDoc} go={go}/>
    {good.pairs.length>0&&<section className="mv-hb-section">
      <SectionHead icon={PenLine} title="Say this, not this" count={good.pairs.length}/>
      <div className="mv-hb-pairs">{good.pairs.map((pair,index)=><PairCard key={`${pair.where}-${index}`} pair={pair} index={index}/>)}</div>
    </section>}
    {words.length>0&&<section className="mv-hb-section">
      <SectionHead icon={Trophy} title="Words that got clicks" count={words.length}/>
      <div className="mv-hb-quotes">{words.map((ad,index)=><article key={ad.ad} className={`mv-hb-quote is-tile-${index%6+1}`}>
        <p>“{ad.words}”</p>
        <small><b>{ad.result}</b></small>
        <small>{ad.ad} · {ad.product}</small>
      </article>)}</div>
    </section>}
    {guides.length>0&&<section className="mv-hb-section"><SectionHead icon={BookOpen} title="Guides" count={guides.length}/><GuideCards entries={guides} openDoc={openDoc}/></section>}
  </>;
}

/* ---------- Good ads ---------- */
function AdCard({ad,failed=false,onOpen}) {
  return <article className={`mv-hb-adcard ${failed?'is-failed':''}`}>
    {ad.picture?<button type="button" className="mv-hb-adpic" onClick={()=>onOpen(ad)} aria-label={`Open ${ad.ad}`}><img src={assetUrl(ad.picture)} alt="" loading="lazy" onError={event=>{event.currentTarget.style.display='none';}}/></button>
      :<span className="mv-hb-adpic is-video"><Film size={22}/><small>{ad.kind}</small></span>}
    <div className="mv-hb-adtext">
      <small>{ad.kind} · {ad.product}</small>
      <strong>{ad.ad}</strong>
      <b>{ad.result}</b>
      {ad.why&&<p>{ad.why}</p>}
    </div>
  </article>;
}

function GoodAds({good,hub,openDoc,openLibrary,go}) {
  const door = HUB_DOORS.find(entry=>entry.id==='creatives');
  const [open,setOpen] = useState(null);
  const statics = good.worked.filter(ad=>ad.kind==='Static'), videos = good.worked.filter(ad=>ad.kind!=='Static');
  return <>
    <DocLinks door={door} openDoc={openDoc} go={go}/>
    {statics.length>0&&<section className="mv-hb-section"><SectionHead icon={Trophy} title="Our image ads that worked" count={statics.length}/><div className="mv-hb-adcards">{statics.map(ad=><AdCard key={ad.ad} ad={ad} onOpen={setOpen}/>)}</div></section>}
    {videos.length>0&&<section className="mv-hb-section"><SectionHead icon={Film} title="Our videos that worked" count={videos.length}/><div className="mv-hb-adcards is-rows">{videos.map(ad=><AdCard key={ad.ad} ad={ad} onOpen={setOpen}/>)}</div></section>}
    {good.failed.length>0&&<section className="mv-hb-section"><SectionHead icon={ThumbsDown} title="What didn't work" count={good.failed.length}/><div className="mv-hb-adcards is-rows">{good.failed.map(ad=><AdCard key={ad.ad} ad={ad} failed onOpen={setOpen}/>)}</div></section>}
    {good.rules.length>0&&<section className="mv-hb-section"><SectionHead icon={Check} title="What makes a good ad" count={good.rules.length}/><div className="mv-hb-rules">{good.rules.map((rule,index)=><article key={rule.rule} className={`mv-hb-rule is-tile-${index%6+1}`}><strong>{rule.rule}</strong><p>{rule.why}</p></article>)}</div></section>}
    <AdReferences hub={hub} openDoc={openDoc} openLibrary={openLibrary} hideLinks/>
    {open&&<Sheet wide title={open.ad} subtitle={open.result} onClose={()=>setOpen(null)}><img className="mv-hb-picture-full" src={assetUrl(open.picture)} alt={open.ad}/>{open.why&&<p className="mv-hb-why" style={{marginTop:10}}>{open.why}</p>}</Sheet>}
  </>;
}

/* ---------- Ways to improve ---------- */
function WaysToImprove({good,entries,team,openDoc}) {
  const [lessons,setLessons] = useState([]);
  useEffect(()=>{let alive = true;api('/api/lessons').then(res=>{if(alive)setLessons(res?.lessons||[]);}).catch(()=>{});return ()=>{alive = false;};},[]);
  const ours = lessons.filter(lesson=>['copywriter','image-maker'].includes(lesson.scope)&&['proven','trying'].includes(lesson.status)).sort((a,b)=>Number(b.status==='proven')-Number(a.status==='proven'));
  const learned = useMemo(()=>entries.filter(entry=>entry.status!=='to-learn'&&entry.learned&&(entry.topics||[]).some(topic=>['images-ads','copywriting'].includes(topic))).sort((a,b)=>entryDay(b).localeCompare(entryDay(a))).slice(0,6),[entries]);
  const nameOf = scope => team?.agents?.find(agent=>agent.id===scope)?.name||scope;
  return <>
    <div className="mv-hb-links"><button type="button" onClick={()=>openDoc(LEARNING_LOG)}><BookOpen size={13}/>The daily learning log</button></div>
    {good.next.length>0&&<section className="mv-hb-section">
      <SectionHead icon={Lightbulb} title="Try next" count={good.next.length}/>
      <div className="mv-hb-rules">{good.next.map((item,index)=><article key={item.idea} className={`mv-hb-rule is-tile-${index%6+1}`}><strong>{item.idea}</strong><p>{item.why}</p></article>)}</div>
    </section>}
    {ours.length>0&&<section className="mv-hb-section">
      <SectionHead icon={Sparkles} title="What our copywriter and image maker learned" count={ours.length}/>
      <div className="mv-hb-guides">{ours.map(lesson=><article key={lesson.id} className="mv-hb-guide"><small>{nameOf(lesson.scope)}{lesson.status==='proven'?' · proven':' · trying'}</small><strong>{lesson.rule}</strong>{lesson.why&&<p>{lesson.why}</p>}</article>)}</div>
    </section>}
    {learned.length>0&&<section className="mv-hb-section"><SectionHead icon={BookOpen} title="From the Library" count={learned.length}/><GuideCards entries={learned} openDoc={openDoc}/></section>}
  </>;
}

export function CreativeLibrary({tab,hub,data,openDoc,openLibrary,go}) {
  const [good,error] = useWhatsGood();
  const [entries] = useLibrary();
  if (error) return <p className="mv-hb-quiet">{error}</p>;
  if (!good) return <p className="mv-hb-quiet">Loading…</p>;
  return <div className="mv-hb-good">
    {tab==='copy'&&<GoodCopy good={good} entries={entries} openDoc={openDoc} go={go}/>}
    {tab==='ads'&&<GoodAds good={good} hub={hub} openDoc={openDoc} openLibrary={openLibrary} go={go}/>}
    {tab==='improve'&&<WaysToImprove good={good} entries={entries} team={data?.team} openDoc={openDoc}/>}
  </div>;
}
