import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpDown,BadgeDollarSign,Ban,Bot,CircleHelp,Clapperboard,Filter,Gem,KeyRound,Radar,Search,Sparkles,Store,TrendingDown,X} from 'lucide-react';
import {api} from './ui.jsx';
import {DISPLAY_LINE} from './displayLine.mjs';
import {STEP_IDS} from './steps.mjs';
import {liveWork} from './pipelineView.mjs';
import {compactNumber} from './statsPanel.mjs';
import {cardName,trendInDoubt,viralCounts} from './productView.mjs';
import {CATALOG_CHIPS,CATALOG_FILTERS,CATALOG_SORTS,KEYWORD_BIBLE,browseCatalog,gauntlet,normalizeRuns,parseKeywordBible,runTotals} from './productGates.mjs';
import {LineTabs,DISPLAY_ICONS} from './LineNav.jsx';
import {LiveNow} from './Pipeline.jsx';
import {CardMedia,PanelTiles,Stat,useHoverPlay} from './cards.jsx';
import {stepReferenceTiles} from './StagePage.jsx';
import './catalog.css';

// Step 1 · Product (owner, Nov 5): "mostly for the agents." The scraper's keywords and hard filters come
// back as a catalog of products worth testing. The owner looks; nothing here decides, starts or asks for work.

const PAGE = 36;
const commas = value => Math.round(value).toLocaleString('en-US');
const FILTER_ICONS = {price:BadgeDollarSign,quality:Gem,stores:Store,videos:Clapperboard,trend:TrendingDown,limits:Ban};

/** The tabs, the step's title and who is working on it, for the two pages the agents run. */
export function AgentStepHead({shown,pipeline,activity,team,go}) {
  const index = DISPLAY_LINE.findIndex(entry=>entry.id===shown), entry = DISPLAY_LINE[index], Icon = DISPLAY_ICONS[shown];
  const live = liveWork(pipeline,activity||[],Date.now());
  const entries = entry.steps.flatMap(id=>live.steps[STEP_IDS.indexOf(id)]||[]);
  return <>
    <LineTabs active={shown} pipeline={pipeline} go={go}/>
    <header className="mv-stage-hero mv-cd-hero mv-cg-hero">
      <div className="mv-stage-icon"><Icon size={32}/><span>{index+1}</span></div>
      <div>
        <span className="mv-eyebrow">Step {index+1} of {DISPLAY_LINE.length}</span>
        <h1>{entry.title}</h1>
        <p title={entry.goal}>{entry.goal}</p>
      </div>
      <div className="mv-cg-hero-side">
        <span className="mv-cg-agents"><Bot size={13}/>Agents work here</span>
        <div className="mv-cg-hero-nav">
          <button className="mv-btn sm" disabled={!DISPLAY_LINE[index-1]} onClick={()=>go(DISPLAY_LINE[index-1]?.slug)} aria-label="Previous step"><ArrowLeft size={14}/></button>
          <button className="mv-btn sm" disabled={!DISPLAY_LINE[index+1]} onClick={()=>go(DISPLAY_LINE[index+1]?.slug)}>Next step<ArrowRight size={14}/></button>
        </div>
      </div>
    </header>
    {entries.length>0&&<div className="mv-cg-live"><LiveNow entries={entries} team={team} go={go} limit={3}/></div>}
  </>;
}

/** One product's picture, price and trend. `flag` says why it left, when it did. */
export function ProductTile({item,items,go,flag,flagTone,index=0,children}) {
  const [playing,hover] = useHoverPlay();
  const v = item.validation;
  const doubt = trendInDoubt(item,items);
  return <article className={`mv-cg-card mv-cd-rise ${item.outcome?'is-out':''}`} style={{'--i':Math.min(index,12)}} {...hover}>
    <button type="button" className="mv-cg-hit" onClick={()=>go(`product/${item.id}`)} aria-label={`Open ${item.id} ${item.name}${flag?`: ${flag}`:''}`}/>
    <CardMedia image={item.image} video={item.video} playing={playing} alt={item.name} placeholder={item.id} ratio="1 / 1">
      {flag&&<span className={`mv-cg-flag ${flagTone?`is-${flagTone}`:''}`} title={flag}>{flagTone==='out'&&<X size={10} strokeWidth={3.5}/>}<span>{flag}</span></span>}
      <span className="mv-cd-id">{item.id}</span>
      <span className="mv-cd-tags">
        {v&&Number.isFinite(v.changePercent)&&<span className={`mv-cd-trend is-${doubt?'doubt':v.direction}`} title={doubt?'Unverified: the same curve is saved on another product':undefined}>{doubt&&<CircleHelp size={11}/>}{v.changePercent>0?'+':''}{v.changePercent}%</span>}
        {v?.money?.sell&&<span className="mv-cd-price">{v.money.sell}</span>}
      </span>
    </CardMedia>
    <div className="mv-cg-body">
      <h3 title={item.name}>{cardName(item.name)}</h3>
      {children}
    </div>
  </article>;
}

function CatalogCard({entry,items,go,index}) {
  const {item,candidate,killed} = entry;
  const kalo = item.validation?.kalodata, meta = item.validation?.meta;
  const viral = viralCounts(kalo);
  const metaAds = meta?.liveAds??meta?.advertisers??null;
  const nums = [
    Number.isFinite(kalo?.units)&&[compactNumber(kalo.units),'sold'],
    (kalo?.gmvText||kalo?.videoGmvText)&&[kalo.gmvText||kalo.videoGmvText,'sales'],
    viral.videos>0&&[compactNumber(viral.videos),viral.videos===1?'video':'videos'],
    viral.creators>0&&[compactNumber(viral.creators),viral.creators===1?'creator':'creators'],
    metaAds!==null&&[compactNumber(metaAds),'Meta ads'],
  ].filter(Boolean).slice(0,4);
  const flag = killed?killed.name:item.outcome?item.outcome.label.replace(' · said in chat',''):'';
  return <ProductTile item={item} items={items} go={go} index={index} flag={flag} flagTone={killed?'out':''}>
    {candidate?.keyword&&<span className="mv-cg-keyword" title={`Scraped from "${candidate.keyword}"`}>{candidate.keyword}</span>}
    {nums.length>0&&<div className="mv-cg-nums">{nums.map(([value,label])=><span key={label}><b>{value}</b>{label}</span>)}</div>}
  </ProductTile>;
}

function KeywordGroups({groups,entries,active,setActive,error}) {
  const [open,setOpen] = useState(null);
  if (error) return <p className="mv-cg-quiet">{error}</p>;
  if (!groups) return <p className="mv-cg-quiet">Loading the keywords…</p>;
  if (!groups.length) return <p className="mv-cg-quiet">No keyword list saved yet.</p>;
  return <div className="mv-cg-groups">{groups.map((group,index)=>{
    const found = entries.filter(entry=>group.keywords.includes(String(entry.candidate?.keyword||'').toLowerCase())).length;
    const shown = open===group.name?group.keywords:group.keywords.slice(0,6);
    return <article key={group.name} className={`mv-cg-group is-tile-${index%6+1}`} aria-current={active?.name===group.name?'true':undefined}>
      <header><strong>{group.name}</strong><small>{group.keywords.length} keywords</small></header>
      <div className="mv-cg-group-words">{shown.map(word=><span key={word}>{word}</span>)}{group.keywords.length>6&&<button type="button" aria-expanded={open===group.name} onClick={()=>setOpen(open===group.name?null:group.name)}>{open===group.name?'Less':`+${group.keywords.length-6}`}</button>}</div>
      {found>0&&<button type="button" className="mv-cg-group-show" aria-pressed={active?.name===group.name} onClick={()=>setActive(active?.name===group.name?null:group)}>{active?.name===group.name?'Show every product':`Show its ${found} product${found===1?'':'s'}`}</button>}
    </article>;
  })}</div>;
}

/** What each filter removed, as one bar: only drawn once a run has reported its numbers. */
function RemovedBar({removed}) {
  const parts = CATALOG_FILTERS.map(filter=>({...filter,value:removed[filter.id]||0})).filter(part=>part.value>0);
  const total = parts.reduce((sum,part)=>sum+part.value,0);
  if (!total) return null;
  return <span className="mv-cg-removed" role="img" aria-label={parts.map(part=>`${part.name}: ${part.value}`).join(', ')}>{parts.map(part=><i key={part.id} style={{flexGrow:part.value}} title={`${part.name}: ${part.value.toLocaleString('en-US')}`}/>)}</span>;
}

function FilterCards({totals}) {
  const ran = totals.count>0;
  return <>
    {ran&&<RemovedBar removed={totals.removed}/>}
    <div className="mv-cg-filters">{CATALOG_FILTERS.map(filter=>{
      const Icon = FILTER_ICONS[filter.id]||Filter;
      return <article key={filter.id} className="mv-cg-filter">
        <span className="mv-cg-filter-icon"><Icon size={16}/></span>
        <div><strong>{filter.name}</strong><p>{filter.rule}</p></div>
        {ran&&<b title="Removed so far">{(totals.removed[filter.id]||0).toLocaleString('en-US')}</b>}
      </article>;
    })}</div>
  </>;
}

const runDay = value => new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

function ScraperRuns({runs,error}) {
  if (error) return <p className="mv-cg-quiet">{error}</p>;
  if (!runs?.length) return <p className="mv-cg-quiet">No scraper run yet. Each run will show here: what it searched, what it removed and what it kept.</p>;
  return <div className="mv-cg-runs">{runs.slice(0,12).map(run=><article key={run.id} className="mv-cg-run">
    <header><strong>{runDay(run.at)}</strong><small>{run.keywords.length} keyword{run.keywords.length===1?'':'s'}</small></header>
    <div className="mv-cg-run-nums">
      <span><b>{run.scraped.toLocaleString('en-US')}</b>scraped</span>
      <span><b>{Math.max(0,run.scraped-run.kept).toLocaleString('en-US')}</b>removed</span>
      <span className="is-kept"><b>{run.kept.toLocaleString('en-US')}</b>kept</span>
    </div>
    <RemovedBar removed={run.removed}/>
    {run.note&&<p>{run.note}</p>}
  </article>)}</div>;
}

export function CatalogPage(props) {
  const {current,leads,go,route,activity,data} = props;
  const pipeline = current?.pipeline;
  // Older links opened a product over this page; its own page is the one place for it now.
  useEffect(()=>{if (route?.params?.lead) go(`product/${route.params.lead}`);},[route?.params?.lead]);
  const [runs,setRuns] = useState(null),[runsError,setRunsError] = useState('');
  const [groups,setGroups] = useState(null),[groupsError,setGroupsError] = useState('');
  useEffect(()=>{
    let alive = true;
    const load = ()=>api('/api/scrape-runs').then(record=>{if (alive) {setRuns(normalizeRuns(record));setRunsError('');}}).catch(e=>{if (alive) {setRuns([]);setRunsError(e.status===404?'The server needs a restart before scraper runs can show here.':e.message);}});
    load();
    const timer = setInterval(load,60000);
    api(`/api/doc?path=${encodeURIComponent(KEYWORD_BIBLE)}`).then(doc=>{if (alive) setGroups(parseKeywordBible(doc?.content));}).catch(e=>{if (alive) {setGroups([]);setGroupsError(e.message);}});
    return ()=>{alive = false;clearInterval(timer);};
  },[]);
  const items = pipeline?.items;
  const view = useMemo(()=>gauntlet(items||[],leads||[]),[items,leads]);
  const totals = useMemo(()=>runTotals(runs||[]),[runs]);
  const [scopeChoice,setScope] = useState(null),[query,setQuery] = useState(''),[chips,setChips] = useState([]),[sort,setSort] = useState('newest'),[group,setGroup] = useState(null),[limit,setLimit] = useState(PAGE);
  const scopes = [
    {id:'catalog',label:'In the catalog',list:view.catalog},
    {id:'killed',label:'Failed a check',list:view.killed},
    {id:'aside',label:'Set aside',list:view.setAside},
  ];
  // An empty catalog still shows products: the ones from earlier rounds, until the scraper fills it.
  const scope = scopeChoice||(view.catalog.length?'catalog':'killed');
  const list = scopes.find(entry=>entry.id===scope).list;
  const shown = useMemo(()=>browseCatalog(list,{query,chips,sort,group}),[list,query,chips,sort,group]);
  const allWithKeywords = useMemo(()=>[...view.catalog,...view.testing,...view.killed,...view.setAside,...view.winners],[view]);
  const keywordCount = groups?groups.reduce((sum,entry)=>sum+entry.keywords.length,0):null;
  const reset = fn=>value=>{fn(value);setLimit(PAGE);};
  const pipelineReady = Boolean(pipeline);
  if (!pipelineReady) return null;
  return <section className="mv-cg">
    <AgentStepHead shown="product" pipeline={pipeline} activity={activity} team={data?.team} go={go}/>
    <div className="mv-cg-flow" role="group" aria-label="From the scraper to Winners">
      <Stat label="Scraped" icon={Radar} tile={3} format={commas} value={totals.count?totals.scraped:'—'} sub={totals.latest?`Last run ${runDay(totals.latest.at)}`:'No run yet'}/>
      <Stat label="Filtered out" icon={Filter} tile={5} format={commas} value={totals.count?totals.filteredOut:'—'} sub={totals.count&&totals.scraped?`${Math.round(totals.filteredOut/totals.scraped*100)}% removed`:'By the hard filters'}/>
      <Stat label="In the catalog" icon={Sparkles} tile={1} value={view.catalog.length} sub="Ready to test"/>
      <Stat label="In Verify" icon={DISPLAY_ICONS.verify} tile={2} value={view.testing.length} sub="Being tested" onClick={()=>go('verify')}/>
      <Stat label="Winners" icon={DISPLAY_ICONS.winners} tile={6} value={view.winners.length} sub="Your call" onClick={()=>go('winners')}/>
    </div>
    <PanelTiles tiles={[
      {id:'keywords',icon:KeyRound,tile:1,title:'Keywords',sub:keywordCount?`${keywordCount} in ${groups.length} groups`:'What it searches',node:<KeywordGroups groups={groups} error={groupsError} entries={allWithKeywords} active={group} setActive={reset(setGroup)}/>},
      {id:'filters',icon:Filter,tile:5,title:'Filters',sub:`${CATALOG_FILTERS.length} hard rules`,node:<FilterCards totals={totals}/>},
      {id:'runs',icon:Radar,tile:3,title:'Scraper runs',sub:totals.count?`${totals.count} so far`:'None yet',node:<ScraperRuns runs={runs} error={runsError}/>},
      ...stepReferenceTiles('product',props),
    ]}/>
    <div className="mv-cg-bar">
      <div className="mv-seg mv-cg-scopes" role="group" aria-label="Which products">{scopes.map(entry=><button key={entry.id} type="button" aria-pressed={scope===entry.id} onClick={()=>{setScope(entry.id);setLimit(PAGE);}}>{entry.label}<b>{entry.list.length}</b></button>)}</div>
      <label className="mv-search mv-cg-search"><Search size={14}/><input className="mv-input" value={query} onChange={event=>reset(setQuery)(event.target.value)} placeholder="Find a product" aria-label="Find a product"/></label>
      <label className="mv-cg-sort"><ArrowUpDown size={14}/><span className="mv-sr">Sort by</span><select value={sort} onChange={event=>reset(setSort)(event.target.value)} aria-label="Sort by">{CATALOG_SORTS.map(entry=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
    </div>
    <div className="mv-cg-chips" role="group" aria-label="Quick filters">
      {CATALOG_CHIPS.map(chip=>{const on=chips.includes(chip.id);return <button key={chip.id} type="button" aria-pressed={on} onClick={()=>reset(setChips)(on?chips.filter(id=>id!==chip.id):[...chips,chip.id])}>{chip.label}<b>{list.filter(chip.test).length}</b></button>;})}
      {group&&<button type="button" className="is-group" aria-pressed="true" onClick={()=>reset(setGroup)(null)}>{group.name}<X size={12}/></button>}
    </div>
    {!view.catalog.length&&!scopeChoice&&<p className="mv-cg-note"><Radar size={15}/><span>The catalog is empty until the scraper runs. These are the products from earlier rounds.</span></p>}
    {shown.length?<div className="mv-cg-grid">{shown.slice(0,limit).map((entry,index)=><CatalogCard key={entry.item.id} entry={entry} items={items} go={go} index={index}/>)}</div>
      :<div className="mv-cg-empty"><Search size={22}/><strong>{scope==='catalog'&&!list.length?'The catalog is empty':'No products match'}</strong><small>{scope==='catalog'&&!list.length?'The scraper fills it.':'Try fewer filters.'}</small></div>}
    {shown.length>limit&&<div className="mv-cg-more"><button className="mv-btn" onClick={()=>setLimit(limit+PAGE)}>Show {Math.min(PAGE,shown.length-limit)} more</button><small>{limit} of {shown.length}</small></div>}
  </section>;
}
