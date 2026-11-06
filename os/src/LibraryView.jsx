import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Archive,PenLine,BookMarked,ShieldCheck,Store,Sparkles,Search,X,Lightbulb,Wand2,Images,Image as ImageIcon,PackageSearch,Users,Truck,Target,Settings2,Wrench,BookOpen,FileText,ExternalLink,EyeOff,Check,Link2,Clock} from 'lucide-react';
import {api} from './ui.jsx';
import {LEARN_CATALOG,parseLearningCatalog} from './learnModel.mjs';
import {Library,MediaPreview} from './ResourceLibrary.jsx';
import Learn from './Learn.jsx';
import {Avatar,AgentAvatar,Chip,Sheet,agentOf,assetUrl,fileName,timeAgo} from './kit.jsx';
import {CardMedia,CountUp,SectionHead,Shelf,Stat} from './cards.jsx';
import {LIBRARY_KINDS,LIBRARY_TOPICS,KIND_LABELS,TOPIC_LABELS,TRUST_LABELS,TRUST_MEANING,browseEntries,libraryCounts,recentlyLearned,shelf,searchTerms,highlightParts,firstLink,toggleTopic,toggleTrust} from './libraryModel.mjs';
import './library.css';

export const STUDY = 'resources/copywriting/tova/READING-NOTES.md';

// The owner's input is always one plain prompt (LS-062). Titles, summaries
// and topics are derived by the server; the manager tidies details later.
const TOPIC_ICONS = {'product-research':PackageSearch,'buyer-angles':Users,copywriting:PenLine,'images-ads':ImageIcon,store:Store,sourcing:Truck,testing:Target,operations:Settings2,tools:Wrench};
const TOPIC_TILE = {'product-research':1,'buyer-angles':5,copywriting:2,'images-ads':3,store:4,sourcing:6,testing:5,operations:2,tools:1};
const tileOf = entry => TOPIC_TILE[entry.topics?.[0]]||6;
const TRUST_TONE = {tested:'done',sourced:'active',idea:'warn',outdated:'muted'};
const TRUST_SHORT = {tested:'Tested',sourced:'Sourced',idea:'Idea',outdated:'Outdated'};
const shortDay = value => value?new Date(value+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
const clip = (value,max) => value.length>max?value.slice(0,max-1).trimEnd()+'…':value;
const isLink = value => /^https?:\/\/\S+$/i.test(value);
const hostOf = value => {try{return new URL(value).hostname.replace(/^www\./,'');}catch{return value;}};
const submitOnCtrlEnter = event => {if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.currentTarget.form?.requestSubmit();}};

const TrustChip = ({trust,short=false}) => <Chip tone={TRUST_TONE[trust]} title={TRUST_MEANING[trust]}>{(short?TRUST_SHORT:TRUST_LABELS)[trust]||trust}</Chip>;
function Who({team,id,size=22}) {
  if (id==='owner'||id==='manager') return <Avatar role={id} size={size}/>;
  return <AgentAvatar agent={agentOf(team,id)} size={size} title={agentOf(team,id)?.name||id}/>;
}
const whoName = (team,id) => id==='owner'?'You':id==='manager'?'The manager':agentOf(team,id)?.name||id;
function Mark({text,terms}) {
  return highlightParts(text,terms).map((part,i)=>part.hit?<mark key={i}>{part.text}</mark>:<React.Fragment key={i}>{part.text}</React.Fragment>);
}

/* ---------- Cards ---------- */
/** Colour and topic on top, then the title and how sure we are. The words open one tap away. */
function CardBand({entry}) {
  const topic = entry.topics?.[0], waiting = entry.status==='to-learn';
  const Icon = waiting?Lightbulb:TOPIC_ICONS[topic]||BookOpen;
  return <span className="mv-lb-band"><span className="mv-lb-band-icon"><Icon size={15} strokeWidth={2.2}/></span><small>{waiting?'To learn':KIND_LABELS[entry.kind]}{topic?` · ${TOPIC_LABELS[topic]}`:''}</small></span>;
}
function KnowledgeCard({entry,team,onOpen,index}) {
  const waiting = entry.status==='to-learn';
  return <button type="button" className={`mv-lb-card is-tile-${tileOf(entry)} ${waiting?'is-waiting':''} ${entry.trust==='outdated'&&!waiting?'is-outdated':''} ${index===undefined?'':'mv-cd-rise'}`} style={index===undefined?undefined:{'--i':Math.min(index,12)}} onClick={onOpen} title={waiting?undefined:entry.learned}>
    <CardBand entry={entry}/>
    <span className="mv-lb-body"><strong>{entry.title}</strong></span>
    <span className="mv-lb-foot">
      {waiting?<small>Asked {shortDay(entry.requestedOn)}</small>:<><TrustChip trust={entry.trust} short/><small>{shortDay(entry.learnedOn)}</small></>}
      {entry.forAgents?.length>0&&<span className="mv-lb-agents" title={`For ${entry.forAgents.map(id=>whoName(team,id)).join(', ')}`}>{entry.forAgents.slice(0,3).map(id=><Who key={id} team={team} id={id} size={20}/>)}</span>}
    </span>
  </button>;
}
function LessonCard({lesson,onOpen}) {
  return <button type="button" className="mv-lb-lesson" onClick={onOpen}>
    <CardMedia image={lesson.image} alt={lesson.alt} ratio="4 / 3"/>
    <span className="mv-lb-lesson-text"><small>{lesson.topic}</small><strong>{lesson.title}</strong></span>
  </button>;
}

/* ---------- Browse: the tiles pick what the cards show ---------- */
function TrustTiles({counts,filter,onPick}) {
  const tiles = [
    {id:'to-learn',icon:Lightbulb,tile:1,label:'Asked to learn',value:counts.toLearn,sub:'On the reading list'},
    {id:'idea',icon:PenLine,tile:3,label:'Ideas',value:counts.byTrust.idea,sub:'Not checked yet'},
    {id:'sourced',icon:BookMarked,tile:5,label:'From good sources',value:counts.byTrust.sourced,sub:'Not tested by us yet'},
    {id:'tested',icon:ShieldCheck,tile:4,label:'Tested by us',value:counts.byTrust.tested,sub:'It worked for us'},
  ];
  return <div className="mv-lb-stats" role="group" aria-label="How sure we are">{tiles.map(({id,...tile})=><Stat key={id} {...tile} pressed={filter?.trust===id} onClick={()=>onPick(id)}/>)}</div>;
}
function TopicTiles({counts,filter,onPick}) {
  const tiles = [['all','Everything',BookOpen,counts.learned,6],...LIBRARY_TOPICS.map(id=>[id,TOPIC_LABELS[id],TOPIC_ICONS[id],counts.byTopic[id]||0,TOPIC_TILE[id]])];
  return <div className="mv-lb-topics" role="group" aria-label="Browse by topic">{tiles.map(([id,label,Icon,count,tile])=><button key={id} type="button" className={`mv-lb-topic is-tile-${tile}`} aria-pressed={filter?.topic===id&&(id!=='all'||!filter.trust)} onClick={()=>onPick(id)}>
    <span className="mv-lb-topic-icon"><Icon size={17} strokeWidth={2.2}/></span>
    <span className="mv-lb-topic-name">{label}</span>
    <b><CountUp value={count}/></b>
  </button>)}</div>;
}
function FilterResults({filter,entries,team,limit,onMore,onKind,onClear,onOpen}) {
  const base = browseEntries(entries,{topic:filter.topic,trust:filter.trust});
  const list = filter.kind?base.filter(entry=>entry.kind===filter.kind):base;
  const kinds = LIBRARY_KINDS.map(id=>[id,base.filter(entry=>entry.kind===id).length]).filter(([,count])=>count>0);
  const trustName = filter.trust==='to-learn'?'On the reading list':TRUST_LABELS[filter.trust];
  const topicName = filter.topic==='all'?'':TOPIC_LABELS[filter.topic];
  const kindName = filter.kind?KIND_LABELS[filter.kind]:'';
  const title = [topicName,trustName].filter(Boolean).join(' · ')||(kindName?`${kindName}s`:'Everything');
  const Icon = TOPIC_ICONS[filter.topic]||BookOpen;
  return <section className="mv-lb-section" aria-live="polite">
    <SectionHead icon={Icon} title={title} count={list.length} action={<><X size={13}/>Clear</>} onAction={onClear}/>
    {kinds.length>1&&<div className="mv-lb-pills" role="group" aria-label="Kind">
      <button type="button" aria-pressed={!filter.kind} onClick={()=>onKind('')}>All<b>{base.length}</b></button>
      {kinds.map(([id,count])=><button key={id} type="button" aria-pressed={filter.kind===id} onClick={()=>onKind(filter.kind===id?'':id)}>{KIND_LABELS[id]}<b>{count}</b></button>)}
    </div>}
    {list.length?<div className="mv-lb-grid" key={`${filter.topic}-${filter.trust}-${filter.kind}`}>{list.slice(0,limit).map((entry,index)=><KnowledgeCard key={entry.id} entry={entry} team={team} index={index} onOpen={()=>onOpen(entry)}/>)}</div>
    :<div className="mv-card mv-empty"><BookOpen size={24}/><strong>Nothing here yet.</strong></div>}
    {list.length>limit&&<div className="mv-lb-more"><button type="button" className="mv-btn" onClick={onMore}>Show more ({list.length-limit})</button></div>}
  </section>;
}

/* ---------- Search ---------- */
function SearchResults({query,results,busy,error,catalog,onOpen,onClear}) {
  // Nothing matched exactly: the server sends the closest entries, each marked closest.
  const closest = Boolean(results?.length&&results.every(hit=>hit.closest));
  const terms = closest?[...new Set(results.flatMap(hit=>hit.near||[]))]:searchTerms(query);
  const asked = clip(query.trim(),60);
  const title = busy&&!results?'Searching…':closest?`Nothing exact for “${asked}”, so here is the closest`:`Matches for “${asked}”`;
  return <section className="mv-lib-results mv-lb-section" aria-live="polite">
    <SectionHead icon={Search} title={title} count={results?.length} action={<><X size={13}/>Clear</>} onAction={onClear}/>
    {error&&<div className="mv-error" role="alert">{error}</div>}
    {results&&results.length===0&&<div className="mv-card mv-empty"><Search size={26}/><strong>Nothing in the library matches yet.</strong><span className="mv-small">{terms.length?'Ask in chat and an agent will write it down here.':'Type a few words about what you want to know.'}</span></div>}
    {results?.length>0&&<div className="mv-lb-grid">{results.map(hit=>{const entry=catalog.entries.find(item=>item.id===hit.id);return <button type="button" key={hit.id} className={`mv-lb-card is-tile-${tileOf(hit)} ${hit.trust==='outdated'?'is-outdated':''}`} onClick={()=>entry&&onOpen(entry)}>
      <CardBand entry={hit}/>
      <span className="mv-lb-body">
        <strong><Mark text={hit.title} terms={terms}/></strong>
        <p><Mark text={hit.snippet||hit.learned} terms={terms}/></p>
      </span>
      <span className="mv-lb-foot">{hit.status==='to-learn'?<small>On the reading list</small>:<TrustChip trust={hit.trust} short/>}{hit.closest&&hit.near?.length>0&&<small title={hit.near.join(', ')}>close to: {hit.near.slice(0,2).join(', ')}</small>}</span>
    </button>;})}</div>}
  </section>;
}

/* ---------- One-prompt sheets ---------- */
function WriteSheet({catalog,onClose,onSaved}) {
  const [text,setText] = useState(''),[link,setLink] = useState(''),[busy,setBusy] = useState(false),[error,setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const body = text.trim(); if (!body) return;
    setBusy(true);setError('');
    const source = link.trim()||firstLink(body);
    try {
      const saved = await api('/api/library',{revision:catalog.revision,askedBy:'owner',sources:source?[source]:[],note:{body}});
      const entry = saved.entries.at(-1);
      onSaved(entry,`Written down as ${entry.id}. Every agent can find it now.`);
    } catch (e) {setError(/changed|revision/i.test(e.message)?'The library changed while you typed. Try again.':e.message);}
    finally {setBusy(false);}
  }
  return <Sheet title="Write down something we learned" subtitle="Type it the way you'd say it. We'll file it." onClose={onClose}>
    <form className="mv-lib-form" onSubmit={submit}>
      <label className="mv-field">What did we learn?
        <textarea className="mv-textarea mv-lib-prompt" autoFocus required rows={7} maxLength={20000} value={text} onChange={e=>setText(e.target.value)} onKeyDown={submitOnCtrlEnter} placeholder="e.g. Gift buyers care more about the arrival date than the price. Three Reddit threads said so."/></label>
      <label className="mv-field mv-lib-link"><span><Link2 size={13}/>Link <small>Optional</small></span><input className="mv-input" maxLength={3000} value={link} onChange={e=>setLink(e.target.value)} placeholder="https://…"/></label>
      {error&&<div className="mv-error" role="alert">{error}</div>}
      <div className="mv-lib-form-actions"><span className="mv-small">Saved as a new note file; nothing is overwritten. The title and topic come from your words.</span><button className="mv-btn primary" disabled={busy||!text.trim()}><Check size={14}/>{busy?'Saving…':'Save to the library'}</button></div>
    </form>
  </Sheet>;
}

/* ---------- Reading an entry ---------- */
function EntrySheet({entry,team,catalog,openDoc,go,onClose,onSaved}) {
  const [busy,setBusy] = useState(false),[error,setError] = useState('');
  const waiting = entry.status==='to-learn';
  async function markOutdated() {
    setBusy(true);setError('');
    try {onSaved(await api('/api/library',{revision:catalog.revision,id:entry.id,trust:'outdated'}),`${entry.id} marked outdated. Agents stop following it.`);}
    catch (e) {setError(/changed|revision/i.test(e.message)?'The library just changed. Try again.':e.message);}
    finally {setBusy(false);}
  }
  return <Sheet wide title={`${KIND_LABELS[entry.kind]} · ${entry.id}`} onClose={onClose} actions={waiting?<Chip tone="warn" icon={Lightbulb}>Reading list</Chip>:<TrustChip trust={entry.trust}/>}>
    <div className="mv-entry">
      {waiting&&<div className="mv-entry-banner is-waiting"><Lightbulb size={16}/><div><b>On the reading list since {shortDay(entry.requestedOn)}.</b><span>An agent researches it and writes down what we learned.</span></div></div>}
      {entry.trust==='outdated'&&!waiting&&<div className="mv-entry-banner"><EyeOff size={16}/><div><b>Outdated.</b><span>Kept for history. Agents don't follow it.</span></div></div>}
      <section className={`mv-entry-learned mv-lb-learned is-tile-${tileOf(entry)}`}>
        <span className="mv-now-label">{waiting?'What we want to learn':'What we learned'}</span>
        <h3 className="mv-lb-entry-title">{entry.title}</h3>
        {entry.learned!==entry.title&&<p>{entry.learned}</p>}
        {entry.path&&<div className="mv-entry-open"><button className="mv-btn primary" title={entry.path} onClick={()=>openDoc(entry.path)}><BookOpen size={15}/>Open the full document</button></div>}
      </section>
      <dl className="mv-entry-facts mv-lb-entry-facts">
        {!waiting&&<div><dt>How sure</dt><dd><TrustChip trust={entry.trust}/><small>{TRUST_MEANING[entry.trust]}</small></dd></div>}
        <div><dt>{waiting?'Asked':'Written down'}</dt><dd><Who team={team} id={entry.askedBy} size={20}/>{whoName(team,entry.askedBy)} · {shortDay(waiting?entry.requestedOn:entry.learnedOn)}</dd></div>
        <div><dt>Topics</dt><dd className="mv-entry-topics">{entry.topics.length?entry.topics.map(topic=>{const Icon=TOPIC_ICONS[topic];return <Chip key={topic} icon={Icon}>{TOPIC_LABELS[topic]}</Chip>;}):<small>Not sorted yet</small>}</dd></div>
      </dl>
      {entry.forAgents.length>0&&<section><h3 className="mv-h3 mv-sheet-h"><Users size={16}/>Agents who read it</h3><div className="mv-entry-agents">{entry.forAgents.map(id=><span key={id}><Who team={team} id={id} size={26}/>{whoName(team,id)}</span>)}</div></section>}
      {entry.sources.length>0&&<section><h3 className="mv-h3 mv-sheet-h"><FileText size={16}/>Sources</h3><div className="mv-refs">{entry.sources.map(source=>isLink(source)?<a key={source} className="mv-ref" href={source} target="_blank" rel="noreferrer"><ExternalLink size={12}/><span>{hostOf(source)}</span></a>:<button key={source} className="mv-ref" title={source} onClick={()=>openDoc(source)}><FileText size={12}/><span>{fileName(source)}</span></button>)}</div></section>}
      {entry.lessons.length>0&&<section><h3 className="mv-h3 mv-sheet-h"><Lightbulb size={16}/>Related lessons</h3><div className="mv-refs">{entry.lessons.map(id=><button key={id} className="mv-ref" onClick={()=>{onClose();go('memory?tab=lessons');}}><Lightbulb size={12}/><span>{id}</span></button>)}</div></section>}
      {error&&<div className="mv-error" role="alert">{error}</div>}
      <footer className="mv-entry-foot"><span className="mv-small"><Clock size={12}/> Updated {timeAgo(entry.updatedAt)}</span>
        {!waiting&&entry.trust!=='outdated'&&<button className="mv-btn sm ghost" disabled={busy} onClick={markOutdated}><EyeOff size={13}/>Mark outdated</button>}</footer>
    </div>
  </Sheet>;
}

/* ---------- The page ---------- */
export function LibraryView(props) {
  const {data,hub,openDoc,notify,libraryView,setLibraryView,go,route} = props;
  const team = data.team||{agents:[]};
  const [catalog,setCatalog] = useState(null),[loadError,setLoadError] = useState('');
  const [query,setQuery] = useState(''),[results,setResults] = useState(null),[searching,setSearching] = useState(false),[searchError,setSearchError] = useState('');
  // No filter shows the shelves; a tile sets {topic, trust, kind} and shows those cards instead.
  const [filter,setFilter] = useState(()=>route?.params?.topic?{topic:route.params.topic}:null),[limit,setLimit] = useState(24),[lessonId,setLessonId] = useState('');
  const [sheet,setSheet] = useState(null);
  const [lessons,setLessons] = useState([]),[preview,setPreview] = useState(null);
  const searchSeq = useRef(0), handledEntry = useRef('');

  const load = useCallback(async()=>{try{setCatalog(await api('/api/library'));setLoadError('');}catch(e){setLoadError(/route not found/i.test(e.message)?'The library needs the updated OS server. Ask the manager to restart the OS, then reload this page.':e.message);}},[]);
  useEffect(()=>{load();const timer=setInterval(load,15000);return()=>clearInterval(timer);},[load]);
  // A project without the visual-lessons catalog (a new Launchroom project) just shows no lessons.
  useEffect(()=>{let live=true;api('/api/doc?path='+encodeURIComponent(LEARN_CATALOG)).then(doc=>{if(live)setLessons(parseLearningCatalog(doc.content).lessons);}).catch(()=>{});return()=>{live=false;};},[]);
  useEffect(()=>{
    const q = query.trim();
    if (!searchTerms(q).length) {searchSeq.current++;setResults(q?[]:null);setSearching(false);return;}
    const seq = ++searchSeq.current;setSearching(true);
    const timer = setTimeout(()=>{api('/api/library/search?q='+encodeURIComponent(q)).then(found=>{if(seq===searchSeq.current){setResults(found);setSearchError('');}}).catch(e=>{if(seq===searchSeq.current)setSearchError(e.message);}).finally(()=>{if(seq===searchSeq.current)setSearching(false);});},220);
    return()=>clearTimeout(timer);
  },[query,catalog?.revision]);
  // #/library?entry=K-012 opens that entry once.
  useEffect(()=>{const id=route?.params?.entry;if(!id||!catalog||handledEntry.current===id)return;handledEntry.current=id;if(catalog.entries.some(entry=>entry.id===id))setSheet({type:'entry',id});},[route?.params?.entry,catalog]);

  const entries = catalog?.entries||[];
  const counts = useMemo(()=>catalog?.counts||libraryCounts(entries),[catalog]);
  const recent = useMemo(()=>recentlyLearned(entries,10),[entries]);
  const methods = useMemo(()=>shelf(entries,{kind:'method'}),[entries]);
  const references = useMemo(()=>(hub.resourceMedia||[]).filter(item=>item.kind==='image').sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt))).slice(0,12),[hub.resourceMedia]);

  if (libraryView==='learn') return <div className="mv-legacy"><Learn {...props} startLesson={lessonId} onBack={()=>{setLessonId('');setLibraryView('shelf');}}/></div>;
  // The file browser can open straight on a collection (Assets links to Visual references with 'images').
  if (['guides','cases','images','videos'].includes(libraryView)) return <div><button className="mv-btn ghost sm" style={{marginBottom:12}} onClick={()=>setLibraryView('shelf')}><ArrowLeft size={14}/>Library</button><div className="mv-legacy"><Library {...props}/></div></div>;

  const open = entry => setSheet({type:'entry',id:entry.id});
  const pick = next => {setFilter(next);setLimit(24);};
  const openLesson = id => {setLessonId(id);setLibraryView('learn');};
  const sheetEntry = sheet?.type==='entry'&&entries.find(entry=>entry.id===sheet.id);
  const total = counts.learned+counts.toLearn;

  return <section className="mv-lib">
    <div className="mv-page-head"><div><span className="mv-eyebrow">Everything we know</span><h1 className="mv-h1">Library</h1><p className="mv-sub">What we've learned, written down so you and every agent can find it.</p></div>
      <div className="mv-page-actions"><button className="mv-btn" onClick={()=>setSheet({type:'write'})} disabled={!catalog}><PenLine size={15}/>Write down what we learned</button></div></div>

    <form className="mv-lib-search" role="search" onSubmit={event=>event.preventDefault()}>
      <Search size={20} aria-hidden="true"/>
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)} maxLength={200} placeholder={`Search ${total} things we know`} aria-label="Search the library"/>
      {query&&<button type="button" className="mv-icon-btn" aria-label="Clear search" onClick={()=>setQuery('')}><X size={17}/></button>}
    </form>

    {loadError&&<div className="mv-error" role="alert" style={{margin:'14px 0'}}>{loadError}</div>}

    {query.trim()?<SearchResults query={query} results={results} busy={searching} error={searchError} catalog={catalog||{entries:[]}} onOpen={open} onClear={()=>setQuery('')}/>:<>
      <TrustTiles counts={counts} filter={filter} onPick={id=>pick(toggleTrust(filter,id))}/>
      <TopicTiles counts={counts} filter={filter} onPick={id=>pick(toggleTopic(filter,id))}/>
      {!catalog&&!loadError&&<div className="mv-card mv-empty" style={{marginTop:18}}>Opening the library…</div>}
      {catalog&&!entries.length&&<div className="mv-card mv-empty mv-lib-empty" style={{marginTop:18}}><BookOpen size={28}/><strong>Nothing written down yet.</strong><span className="mv-small">Agents add what they learn as they work.</span></div>}

      {filter?<FilterResults filter={filter} entries={entries} team={team} limit={limit} onMore={()=>setLimit(limit+48)} onKind={kind=>{setFilter({...filter,kind});setLimit(24);}} onClear={()=>pick(null)} onOpen={open}/>:<>
        {recent.length>0&&<section className="mv-lb-section">
          <SectionHead icon={Clock} title="Recently learned" action={<>See everything<ArrowRight size={13}/></>} onAction={()=>pick({topic:'all',trust:'',kind:''})}/>
          <Shelf label="Recently learned">{recent.map(entry=><KnowledgeCard key={entry.id} entry={entry} team={team} onOpen={()=>open(entry)}/>)}</Shelf>
        </section>}

        {lessons.length>0&&<section className="mv-lb-section">
          <SectionHead icon={Sparkles} title="Visual lessons" count={lessons.length} action={<>Open lessons<ArrowRight size={13}/></>} onAction={()=>openLesson('')}/>
          <Shelf label="Visual lessons">{lessons.map(lesson=><LessonCard key={lesson.id} lesson={lesson} onOpen={()=>openLesson(lesson.id)}/>)}</Shelf>
        </section>}

        {methods.length>0&&<section className="mv-lb-section">
          <SectionHead icon={Wand2} title="Skills & methods" count={methods.length} action={<>See all<ArrowRight size={13}/></>} onAction={()=>pick({topic:'all',trust:'',kind:'method'})}/>
          <Shelf label="Skills and methods">{methods.slice(0,12).map(entry=><KnowledgeCard key={entry.id} entry={entry} team={team} onOpen={()=>open(entry)}/>)}</Shelf>
        </section>}

        {references.length>0&&<section className="mv-lb-section mv-lb-refs">
          <SectionHead icon={Images} title="Newest visual references" count={(hub.resourceMedia||[]).length} action={<>Browse all<ArrowRight size={13}/></>} onAction={()=>setLibraryView('guides')}/>
          <Shelf label="Newest visual references">{references.map(item=><button type="button" key={item.path} className="mv-lb-ref" onClick={()=>setPreview(item)} title={item.name}><img src={assetUrl(item.path)} alt={item.name} loading="lazy"/></button>)}</Shelf>
        </section>}
        <div className="mv-lib-foot"><button className="mv-link" onClick={()=>setLibraryView('guides')}><Archive size={13}/>Browse all files</button><button className="mv-link" onClick={()=>openDoc('resources/LIBRARY.md')}><FileText size={13}/>The catalog agents read</button><button className="mv-link" onClick={()=>go('learning')}>Open the learning log<ArrowRight size={13}/></button></div>
      </>}
    </>}

    {sheetEntry&&<EntrySheet key={sheetEntry.id} entry={sheetEntry} team={team} catalog={catalog} openDoc={openDoc} go={go} onClose={()=>setSheet(null)} onSaved={(next,message)=>{setCatalog(next);notify(message);}}/>}
    {sheet?.type==='write'&&catalog&&<WriteSheet catalog={catalog} onClose={()=>setSheet(null)} onSaved={(entry,message)=>{notify(message);load().then(()=>setSheet({type:'entry',id:entry.id}));}}/>}
    {preview&&<div className="mv-legacy"><MediaPreview item={preview} onClose={()=>setPreview(null)} notify={notify} openDoc={openDoc}/></div>}
  </section>;
}
