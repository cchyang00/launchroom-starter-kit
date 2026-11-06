import React,{useEffect,useMemo,useState} from 'react';
import {Calendar,Check,ChevronDown,Filter,Flame,GitBranch,Image as ImageIcon,KeyRound,Radar,Search,ShieldCheck,Sparkles,Telescope,Trophy,TrendingUp,X,Film} from 'lucide-react';
import {api} from './ui.jsx';
import {Chip,LeadImage} from './kit.jsx';
import {ReadMore,SectionHead,Shelf,Stat} from './cards.jsx';
import {TOPIC_LABELS} from './libraryModel.mjs';
import {compactNumber} from './statsPanel.mjs';
import {KEYWORD_BIBLE_PATH,diagramFiles,isGemini,isResearch,parseBibleMap,researchShelf} from './hubDoors.mjs';
import {gauntlet,normalizeRuns,runTotals} from './productGates.mjs';
import {PictureWall,ResearchCard,useLibrary} from './HubsPage.jsx';
import './hubs.css';

// Trends & Research Hub (owner, Nov 5): "When we run deep research with Gemini Chat, we're going to store our
// research inside of there. There, we're going to filter, come up with the keywords, and we're really going to
// see the diagrams." It reads saved reports and files only; agents add to them, and the chat gives them the work.

const SEASONAL_WINDOWS = [
  {
    id: 'blackout-water-grid-security',
    window: 'Nov 1 – Feb 28 · US Grid Anxiety, Storm Blackouts & Water Scarcity',
    title: 'Off-Grid Solar Lighting, Emergency Power, Water Storage & Evacuation Lockdown',
    status: 'Surge Now',
    tone: 'active',
    track: '1–3 Viral Creator Videos + 4–5 Domino-Chain DR Static Ads',
    whyNow:
      'Election/grid anxiety, early 5 PM darkness, winter storm blackouts, and bottled-water shortages drive urgent household preparedness purchases with 2-Kit multi-room take rates.',
    signals: [
      {source: 'Kalodata US (30d)', text: 'Multi-video viral clusters: Split-Panel Solar Ceiling Kit (P007/L314), Emergency Weather Radio ($90K 30d GMV, L362), Fireproof Document Bag ($65K, L356), Water Storage Bladder ($46.7K, L360)'},
      {source: 'US Viral Density', text: '5–15+ independent US creator videos per keyword proving video-driven conversion rather than passive search'},
      {source: 'Meta Ad Library (US)', text: '0–2 active US Meta ads on specific mechanism keywords ("split solar ceiling light", "water storage bladder", "faraday box car keys")'},
      {source: '2-Kit Economics', text: 'Natural multi-room / multi-car bundle logic (1-Kit + $7.99 shipping vs. 2-Kit SAVE 15% + Free Tracked Shipping + $4.99 Shipping Protection)'},
    ],
    leadIds: ['L314', 'L356', 'L358', 'L360', 'L362', 'L364', 'L365'],
  },
  {
    id: 'winter-cold-snap-pain-recovery',
    window: 'Nov 1 – Mar 15 · Cold-Snap Joint Flare-Ups, Sciatica & Circulation Recovery',
    title: 'Infrared Red-Light Joint Therapy, Air Compression & Neuropathy Relief',
    status: 'Surge Now',
    tone: 'active',
    track: '1–3 Viral Creator Videos + 4–5 Domino-Chain DR Static Ads',
    whyNow:
      'Barometric pressure drops and freezing temperatures trigger immediate knee, sciatic nerve, and foot neuropathy flare-ups among 45–75+ US homeowners on Facebook & Instagram.',
    signals: [
      {source: 'Kalodata US (30d)', text: 'Infrared Knee Massager ($538K top-3 30d GMV, L343), Red Light Therapy Belt ($152K, L344), Compression Leg Massager ($94.7K, L345), Foot Neuropathy Massager ($63.2K, L347)'},
      {source: 'US Viral Density', text: '6–12+ active US viral videos across distinct creators showing instant 3-second wearable relief demos'},
      {source: 'Meta Ad Library (US)', text: '0–2 active US Meta ads on exact hardware phrases while Older Meta buyers convert at $48–$68 AOV'},
      {source: 'HyperSKU / CJ Margin', text: '<35% air-shipped landed cost ($12–$19 landed vs. $49–$68 retail -> $32–$45 break-even CPA room)'},
    ],
    leadIds: ['L343', 'L344', 'L345', 'L346', 'L347', 'L348', 'L379', 'L385'],
  },
  {
    id: 'winter-thermal-roadside-hosting',
    window: 'Nov 1 – Feb 20 · Freezing Commutes, Frost mornings & Holiday Hosting Prep',
    title: 'Graphene Personal Heating, Frost/Roadside Survival & Holiday Kitchen Upgrades',
    status: 'Surge Now',
    tone: 'active',
    track: '1–3 Viral Creator Videos + 4–5 Domino-Chain DR Static Ads',
    whyNow:
      'First frost mornings, freezing office desks, winter highway travel, and Thanksgiving/Christmas kitchen prep create immediate problem-solving hardware demand.',
    signals: [
      {source: 'Kalodata US (30d)', text: 'Car Windshield Snow Cover ($173.9K 30d GMV, L349), Heated Shawl Wrap ($129K, L361), Rechargeable Heated Gloves ($82.2K, L350), Stainless Cutting Board ($62.2K, L363)'},
      {source: '7-Day Breakouts', text: 'Graphene Cordless Heating Pad ($37.3K 7d surge, L352) and Under-Desk Foot Warmer ($11.2K 7d surge, L353) accelerating into peak winter'},
      {source: 'Meta Ad Library (US)', text: '0 active US Meta ads on "graphene heating pad", "car windshield cover", "electric ice scraper", and "stainless cutting board"'},
      {source: 'Gift + 2-Kit Fit', text: 'High 2-Kit His-&-Hers / 2-Car family take rate at $48–$64 retail'},
    ],
    leadIds: ['L315', 'L349', 'L350', 'L351', 'L352', 'L353', 'L361', 'L363'],
  },
];

const UNIQUENESS_RULES = [
  {
    badge: 'Concrete Rule · Numbers-First Reverse Engineering',
    tone: 'ok',
    title: 'Multi-Video US Viral Density + Meta Whitespace (Never Scroll TikTok Organically)',
    bullets: [
      'Numbers First (Kalodata US `country: "US"`, `pageSize: 100`): Start from macro-trend/crisis keywords and filter for 30d US GMV (`$20K–$500K+`) on a clear recent uptrend (`2026-09` to `2026-11`). Never waste hours scrolling the organic TikTok feed.',
      'Multi-Video / Multi-Ad US Viral Density (`>= 5` active US viral videos across `>= 3` distinct US creators): Proves the product is going viral off video ads/hooks, not passive TikTok Shop search.',
      'Meta US Arbitrage (`< 10` active US Meta ads, ideally `0–5`): Proven video-driven demand on TikTok with wide-open auction whitespace on Facebook & Instagram.',
      'HyperSKU / CJ `< 35%` Landed Cost (`>= $22–$30` Break-Even CPA): `$45–$75` perceived value, `< 1 kg`, and natural 2-Kit (`SAVE 15%` + Free Shipping) + `$4.99` Shipping Protection economics.',
    ],
  },
  {
    badge: 'Hard Auto-Fail · Kill Immediately',
    tone: 'bad',
    title: 'Single-Video Flukes, Passive Search Commodities & Margin Traps',
    bullets: [
      'Passive TikTok Shop Search Commodity (`< 5` active viral videos or `< 3` creators): Sells only because it is cheap in TikTok Shop search like Amazon, with no viral video engine we can port to Meta.',
      'Single-Creator Dependency (`> 70%` GMV from 1 video/creator): If only 1 creator could sell it, the hook is personality-dependent rather than product-driven.',
      'Saturated on Meta (`>= 10–15` active US advertisers scaling the same hook) or Landed Cost `> 35%` of retail on HyperSKU / CJ Dropshipping.',
    ],
  },
];

const PAGE = 18;
const commas = value => Math.round(value).toLocaleString('en-US');
const money = value => `$${compactNumber(value)}`;

/* ---------- Deep research ---------- */
function ResearchTab({entries,error,loaded,openDoc}) {
  const [query,setQuery] = useState(''),[topic,setTopic] = useState(''),[gemini,setGemini] = useState(false),[limit,setLimit] = useState(PAGE);
  const shown = useMemo(()=>researchShelf(entries,{query,topic,gemini}),[entries,query,topic,gemini]);
  const all = useMemo(()=>entries.filter(isResearch),[entries]);
  const topics = useMemo(()=>Object.keys(TOPIC_LABELS).map(id=>[id,all.filter(entry=>(entry.topics||[]).includes(id)).length]).filter(([,count])=>count>0),[all]);
  const geminiCount = all.filter(isGemini).length;
  const reset = fn=>value=>{fn(value);setLimit(PAGE);};
  if (error) return <p className="mv-hb-quiet">{error}</p>;
  if (!loaded) return <p className="mv-hb-quiet">Loading the research…</p>;
  return <>
    <div className="mv-hb-tools">
      <label className="mv-search mv-hb-search"><Search size={14}/><input className="mv-input" value={query} onChange={event=>reset(setQuery)(event.target.value)} placeholder="Search the research" aria-label="Search the research"/></label>
    </div>
    <div className="mv-hb-chips" role="group" aria-label="Filter the research">
      <button type="button" className="is-gemini" aria-pressed={gemini} onClick={()=>reset(setGemini)(!gemini)}><Sparkles size={12}/>Gemini<b>{geminiCount}</b></button>
      {topics.map(([id,count])=><button key={id} type="button" aria-pressed={topic===id} onClick={()=>reset(setTopic)(topic===id?'':id)}>{TOPIC_LABELS[id]}<b>{count}</b></button>)}
    </div>
    {shown.length?<div className="mv-hb-reports">{shown.slice(0,limit).map((entry,index)=><ResearchCard key={entry.id} entry={entry} openDoc={openDoc} index={index}/>)}</div>:<p className="mv-hb-quiet">No research matches. Try fewer filters.</p>}
    {shown.length>limit&&<div className="mv-hb-more"><button className="mv-btn" onClick={()=>setLimit(limit+PAGE)}>Show {Math.min(PAGE,shown.length-limit)} more</button><small>{limit} of {shown.length}</small></div>}
  </>;
}

/* ---------- Keywords: what to search, what's worth selling, what never is ---------- */
function CategoryCard({category,query,index}) {
  const [open,setOpen] = useState(false);
  const words = query.trim().toLowerCase();
  const hits = words?category.keywords.filter(word=>word.includes(words)):category.keywords;
  const shown = open||words?hits:hits.slice(0,8);
  return <article className="mv-hb-cat">
    <header className={`is-tile-${index%6+1}`}><b>{category.number}</b><strong>{category.name}</strong><small>{category.keywords.length} keywords</small></header>
    <div className="mv-hb-cat-body">
      {(category.winners.length>0||category.slop.length>0)&&<div className="mv-hb-cat-split">
        <div className="is-win"><span><Check size={12} strokeWidth={3}/>Worth selling</span><ul>{category.winners.map(item=><li key={item}>{item}</li>)}</ul></div>
        <div className="is-slop"><span><X size={12} strokeWidth={3}/>Slop, never</span><ul>{category.slop.map(item=><li key={item}>{item}</li>)}</ul></div>
      </div>}
      {category.hook&&<blockquote>{category.hook}</blockquote>}
      <div className="mv-hb-words">{shown.map(word=><span key={word}>{word}</span>)}{!words&&hits.length>8&&<button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Less':`+${hits.length-8}`}</button>}</div>
    </div>
  </article>;
}

function KeywordsTab({bible,error,openDoc}) {
  const [query,setQuery] = useState('');
  if (error) return <p className="mv-hb-quiet">{error}</p>;
  if (!bible) return <p className="mv-hb-quiet">Loading the keywords…</p>;
  const words = query.trim().toLowerCase();
  const shown = words?bible.categories.filter(category=>category.keywords.some(word=>word.includes(words))||category.name.toLowerCase().includes(words)):bible.categories;
  const total = bible.categories.reduce((sum,category)=>sum+category.keywords.length,0);
  return <>
    {bible.hot.length>0&&<section className="mv-hb-section is-first">
      <div className="mv-hb-head"><SectionHead icon={Flame} title="Hitting now" count={bible.hot.length} tone="warm"/><button type="button" className="mv-link" onClick={()=>openDoc(KEYWORD_BIBLE_PATH)}>The whole keyword list</button></div>
      <Shelf label="Keywords with sales in the last saved run">{bible.hot.map(row=><article key={row.keyword} className="mv-hb-hot" role="listitem" title={row.why}>
        <strong>{row.keyword}</strong>
        <b>{money(row.revenue)}</b>
        <small>{row.days?`in ${row.days} days`:'in 30 days'}{row.to?` · to ${row.to.slice(5).replace('-','/')}`:''}</small>
        <em>{row.category}</em>
      </article>)}</Shelf>
    </section>}
    <section className="mv-hb-section">
      <div className="mv-hb-head">
        <SectionHead icon={KeyRound} title="What we search" count={total}/>
        <label className="mv-search mv-hb-search"><Search size={14}/><input className="mv-input" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a keyword" aria-label="Find a keyword"/></label>
      </div>
      {shown.length?<div className="mv-hb-cats">{shown.map((category,index)=><CategoryCard key={category.number} category={category} query={query} index={category.number-1}/>)}</div>:<p className="mv-hb-quiet">No keyword matches "{query}". It's a good one to add.</p>}
    </section>
  </>;
}

/* ---------- Diagrams ---------- */
function KeywordBars({hot}) {
  const top = hot[0]?.revenue||1;
  return <figure className="mv-hb-chart">
    <div className="mv-hb-bars">{hot.map(row=><div key={row.keyword} className="mv-hb-bar" title={`${row.keyword}: $${commas(row.revenue)}${row.days?` in ${row.days} days`:' in 30 days'}. ${row.why}`}>
      <span>{row.keyword}</span>
      <i aria-hidden="true"><u style={{width:`${Math.max(1,row.revenue/top*100)}%`}}/></i>
      <b>{money(row.revenue)}{row.days&&<small> {row.days}d</small>}</b>
    </div>)}</div>
    <figcaption>Kalodata US video sales from the saved keyword run. 30 days unless marked.</figcaption>
  </figure>;
}

function DiagramsTab({bible,reportCount,keywordCount,totals,view,hub,go}) {
  const files = useMemo(()=>diagramFiles(hub?.resourceMedia||[]),[hub?.resourceMedia]);
  const maps = hub?.maps||[];
  return <>
    <section className="mv-hb-section is-first">
      <SectionHead icon={GitBranch} title="From research to winners"/>
      <div className="mv-hb-flow" role="group" aria-label="From research to winners">
        <Stat label="Deep research" icon={Telescope} tile={1} value={reportCount} sub="Reports saved" onClick={()=>go('trends?tab=research')}/>
        <Stat label="Keywords" icon={KeyRound} tile={4} value={keywordCount} format={commas} sub="To search" onClick={()=>go('trends?tab=keywords')}/>
        <Stat label="Scraped" icon={Radar} tile={3} value={totals.count?totals.scraped:'—'} format={commas} sub={totals.count?'By the scraper':'No run yet'}/>
        <Stat label="Catalog" icon={Filter} tile={5} value={view.catalog.length} sub="After the filters" onClick={()=>go('find')}/>
        <Stat label="Verify" icon={ShieldCheck} tile={2} value={view.tested} sub={`${view.killRate}% killed`} onClick={()=>go('verify')}/>
        <Stat label="Winners" icon={Trophy} tile={6} value={view.winners.length} sub="Your call" onClick={()=>go('winners')}/>
      </div>
    </section>
    {bible?.hot?.length>0&&<section className="mv-hb-section">
      <SectionHead icon={TrendingUp} title="Sales by keyword"/>
      <KeywordBars hot={bible.hot}/>
    </section>}
    <section className="mv-hb-section">
      <SectionHead icon={ImageIcon} title="Saved diagrams" count={files.length}/>
      {files.length?<PictureWall files={files} limit={12}/>:<p className="mv-hb-quiet">No diagrams saved yet.</p>}
    </section>
    {maps.length>0&&<section className="mv-hb-section">
      <SectionHead icon={GitBranch} title="Maps" count={maps.length}/>
      <div className="mv-hb-maps">{maps.map(map=><button key={map.id||map.title} type="button" className="mv-hb-map" onClick={()=>go('maps')}><GitBranch size={16}/><span><strong>{map.title}</strong><small>{map.nodes?.length||0} points</small></span></button>)}</div>
    </section>}
  </>;
}

/* ---------- Seasons: the Nov 3 windows, kept short ---------- */
function SeasonCard({cluster,leadMap,go}) {
  const [open,setOpen] = useState(false);
  const matched = cluster.leadIds.map(id=>leadMap.get(id)).filter(Boolean);
  return <article className="mv-hb-season">
    <span className="mv-hb-season-top"><Calendar size={12}/>{cluster.window}</span>
    <h3>{cluster.title}</h3>
    <div className="mv-hb-season-tags"><Chip tone={cluster.tone}>{cluster.status}</Chip><Chip tone="muted">{cluster.track.split(' · ')[0]}</Chip></div>
    <ReadMore text={cluster.whyNow} lines={2}/>
    {matched.length>0&&<div className="mv-hb-season-leads">{matched.map(lead=><button key={lead.id} type="button" onClick={()=>go(`product/${lead.id}`)} title={`${lead.id}: ${lead.name}`}><LeadImage lead={lead} size={38}/></button>)}</div>}
    <button type="button" className="mv-hb-season-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{cluster.signals.length} signals<ChevronDown size={13} className={open?'is-flipped':''}/></button>
    {open&&<div className="mv-hb-signals">{cluster.signals.map(signal=><div key={signal.source}><strong>{signal.source}</strong><span>{signal.text}</span></div>)}</div>}
  </article>;
}

function SeasonsTab({leads,go}) {
  const [track,setTrack] = useState('all');
  const leadMap = useMemo(()=>new Map(leads.map(lead=>[lead.id,lead])),[leads]);
  const shown = track==='all'?SEASONAL_WINDOWS:SEASONAL_WINDOWS.filter(cluster=>cluster.track.includes(track==='track-a'?'Track A':'Track B'));
  return <>
    <div className="mv-hb-head is-first">
      <p className="mv-hb-note"><Calendar size={14}/>Saved on Nov 3. Not updated live.</p>
      <div className="mv-seg" role="group" aria-label="Filter by creative track">
        <button aria-pressed={track==='all'} onClick={()=>setTrack('all')}>All<b>{SEASONAL_WINDOWS.length}</b></button>
        <button aria-pressed={track==='track-a'} onClick={()=>setTrack('track-a')}><Film size={13}/>Track A</button>
        <button aria-pressed={track==='track-b'} onClick={()=>setTrack('track-b')}><ImageIcon size={13}/>Track B</button>
      </div>
    </div>
    <div className="mv-hb-seasons">{shown.map(cluster=><SeasonCard key={cluster.id} cluster={cluster} leadMap={leadMap} go={go}/>)}</div>
    <details className="mv-hb-older">
      <summary><ShieldCheck size={14}/>The early-wave filter from Nov 3</summary>
      <div className="mv-hb-rules">{UNIQUENESS_RULES.map(rule=><div key={rule.title} className={`is-${rule.tone}`}><strong>{rule.title}</strong><small>{rule.badge}</small><ul>{rule.bullets.map(bullet=><li key={bullet}>{bullet}</li>)}</ul></div>)}</div>
    </details>
  </>;
}

const TABS = [['research','Deep research',Telescope],['keywords','Keywords',KeyRound],['diagrams','Diagrams',GitBranch],['seasons','Seasons',Calendar]];

export function TrendsView({leads=[],go,route,openDoc,hub,current}) {
  const asked = route?.params?.tab;
  const tab = TABS.some(([id])=>id===asked)?asked:'research';
  const [entries,error,loaded] = useLibrary();
  const [bible,setBible] = useState(null),[bibleError,setBibleError] = useState('');
  const [runs,setRuns] = useState([]);
  useEffect(()=>{
    let alive = true;
    api(`/api/doc?path=${encodeURIComponent(KEYWORD_BIBLE_PATH)}`).then(doc=>{if (alive) setBible(parseBibleMap(doc?.content));}).catch(e=>{if (alive) setBibleError(e.message);});
    api('/api/scrape-runs').then(record=>{if (alive) setRuns(normalizeRuns(record));}).catch(()=>{});
    return ()=>{alive = false;};
  },[]);
  const items = current?.pipeline?.items;
  const view = useMemo(()=>gauntlet(items||[],leads),[items,leads]);
  const totals = useMemo(()=>runTotals(runs),[runs]);
  const reportCount = entries.filter(isResearch).length;
  const keywordCount = bible?bible.categories.reduce((sum,category)=>sum+category.keywords.length,0):0;
  const counts = {research:reportCount,keywords:keywordCount,seasons:SEASONAL_WINDOWS.length};
  return <section className="mv-hb">
    <div className="mv-page-head">
      <div>
        <span className="mv-eyebrow">Hub · before you find products</span>
        <h1 className="mv-h1">Trends &amp; Research Hub</h1>
        <p className="mv-sub">Deep research, keywords and diagrams. For you and the agents.</p>
      </div>
    </div>
    <div className="mv-seg mv-hb-tabs" role="group" aria-label="What to look at">{TABS.map(([id,label,Icon])=><button key={id} type="button" aria-pressed={tab===id} onClick={()=>go(id==='research'?'trends':`trends?tab=${id}`)}><Icon size={14}/>{label}{counts[id]>0&&<b>{counts[id]}</b>}</button>)}</div>
    {tab==='research'&&<ResearchTab entries={entries} error={error} loaded={loaded} openDoc={openDoc}/>}
    {tab==='keywords'&&<KeywordsTab bible={bible} error={bibleError} openDoc={openDoc}/>}
    {tab==='diagrams'&&<DiagramsTab bible={bible} reportCount={reportCount} keywordCount={keywordCount} totals={totals} view={view} hub={hub} go={go}/>}
    {tab==='seasons'&&<SeasonsTab leads={leads} go={go}/>}
  </section>;
}
