import React,{useState} from 'react';
import {AlertTriangle,ArrowUpRight,Check,ChevronDown,Circle,CircleHelp,DollarSign,Image as ImageIcon,Megaphone,Play,ShoppingBag,Target,TrendingUp,Video,X} from 'lucide-react';
import {Ring,assetUrl,leadPhotos,leadVideos} from './kit.jsx';
import {CountUp,Spark,Stat} from './cards.jsx';
import {DISPLAY_ICONS,useChecklists} from './LineNav.jsx';
import {checklistScore,shortProductId} from './displayLine.mjs';
import {computeCampaignMetrics,firstImageAd} from './campaignView.mjs';
import {compactNumber} from './statsPanel.mjs';
import {GATES,gateLine} from './gates.mjs';
import {displaySteps,markupOf,ruleName,rulesScore,viralCounts} from './productView.mjs';
import './productPage.css';

// The pieces of one product's page (owner, Nov 4: "more interactive and a lot more
// cards"): its video, its big numbers, its six steps and the panels behind each tile.
// Everything reads saved records; the only writes on the page stay in ProductPage.

const usd = value => Number.isFinite(value)?`$${value>=1000?Math.round(value).toLocaleString('en-US'):value.toFixed(2).replace(/\.00$/,'')}`:'—';
const compactUsd = value => `$${compactNumber(Math.round(value))}`;
const whole = value => String(Math.round(value));
const day = value => {const d=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(`${value}T12:00:00`):new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';};

/** The product's video and photos: one big stage and a strip to switch. The video plays with sound on tap. */
export function MediaStage({item,lead,fallback=''}) {
  const videos = lead?leadVideos(lead):item.video?[item.video]:[];
  const photos = lead?leadPhotos(lead):[item.image].filter(Boolean);
  const cand = lead?.candidate||lead||item||{};
  const rawVideos = Array.isArray(cand?.screen?.checks?.provenDemand?.rawVideos)&&cand.screen.checks.provenDemand.rawVideos.length
    ? cand.screen.checks.provenDemand.rawVideos
    : (Array.isArray(cand?.proof?.tiktokVideos)?cand.proof.tiktokVideos:[]);
  const matchMeta = path => {
    const m = String(path||'').match(/(\d{18,20})\.mp4$/i);
    if (!m) return null;
    const vid = m[1];
    return rawVideos.find(rv=>String(rv.videoId||rv.id||'')===vid)||null;
  };
  const videoPoster = path => /\.mp4$/i.test(String(path||''))?String(path).replace(/\.mp4$/i,'.jpg'):'';
  const all = [...videos.map((path,idx)=>({kind:'video',path,poster:videoPoster(path),rank:idx+1,meta:matchMeta(path)})),...photos.map(path=>({kind:'photo',path}))];
  if (!all.length&&fallback) all.push({kind:'photo',path:fallback});
  const [pick,setPick] = useState(0);
  const shown = all[pick]||all[0]||null;
  const vm = shown?.kind==='video'?shown.meta:null;
  const vmHandle = vm?.handle?(String(vm.handle).startsWith('@')?vm.handle:`@${vm.handle}`):'';
  const vmTikTok = vm?.url||(vmHandle&&vm?.videoId?`https://www.tiktok.com/${vmHandle}/video/${vm.videoId}`:'');
  const vmKalo = vm?.videoId||vm?.id?`https://www.kalodata.com/video/detail?id=${vm.videoId||vm.id}`:'';
  return <div className="mv-pp-media">
    <div className="mv-pp-stage">
      {!shown&&<span className="mv-pp-stage-empty">{item.id}</span>}
      {shown?.kind==='video'&&<video key={shown.path} src={assetUrl(shown.path)} poster={shown.poster?assetUrl(shown.poster):undefined} controls playsInline preload="metadata"/>}
      {shown?.kind==='photo'&&<img src={assetUrl(shown.path)} alt={item.name}/>}
    </div>
    {vm&&<div className="mv-pp-video-meta">
      <div><strong>#{shown.rank} {vmHandle||'Viral video'}</strong><small>{[Number(vm.gmv30d)>0&&`${compactUsd(Number(vm.gmv30d))} sales`,Number(vm.sales30d)>0&&`${compactNumber(Number(vm.sales30d))} sold`,Number(vm.views)>0&&`${compactNumber(Number(vm.views))} views`].filter(Boolean).join(' · ')||vm.ageLabel||''}</small></div>
      <span>{vmTikTok&&<a href={vmTikTok} target="_blank" rel="noreferrer">TikTok<ArrowUpRight size={11}/></a>}{vmKalo&&<a href={vmKalo} target="_blank" rel="noreferrer">Kalodata<ArrowUpRight size={11}/></a>}</span>
    </div>}
    {all.length>1&&<div className="mv-pp-thumbs" role="group" aria-label="Videos and photos">{all.map((media,index)=><button key={media.path} type="button" aria-pressed={index===pick} title={media.kind==='video'?`#${media.rank} ${media.meta?.handle||''} (${media.meta?.ageLabel||''})`:`Photo ${index-videos.length+1}`} aria-label={media.kind==='video'?`Play #${media.rank} video ${media.meta?.handle||''}`:`Show photo ${index-videos.length+1}`} onClick={()=>setPick(index)}>
      {media.kind==='video'?<><video src={`${assetUrl(media.path)}#t=0.5`} poster={media.poster?assetUrl(media.poster):undefined} muted playsInline preload="metadata"/><i><Play size={12} fill="currentColor"/><b>#{media.rank}</b></i></>:<img src={assetUrl(media.path)} alt="" loading="lazy"/>}
    </button>)}</div>}
  </div>;
}

/** The five numbers the owner decides on, as big tiles that count up. */
export function HeroStats({validation:v}) {
  if (!v) return null;
  const kalo = v.kalodata, meta = v.meta, viral = viralCounts(kalo), markup = markupOf(v);
  const metaCount = meta.liveAds??meta.advertisers;
  return <div className="mv-pp-stats">
    {Number.isFinite(kalo.units)&&<Stat tile={6} icon={ShoppingBag} label="Sold" value={kalo.units} format={n=>compactNumber(Math.round(n))} sub={kalo.price?`${kalo.price} on TikTok`:undefined} title={kalo.unitsText}/>}
    {Number.isFinite(kalo.videoGmv)&&<Stat tile={4} icon={Video} label="Video sales" value={kalo.videoGmv} format={compactUsd} sub={kalo.gmvText?`${kalo.gmvText} product`:undefined}/>}
    {viral.videos>0&&<Stat tile={1} icon={Play} label="Viral videos" value={viral.videos} format={whole} sub={`${viral.creators} creator${viral.creators===1?'':'s'}`}/>}
    {metaCount!==null&&metaCount!==undefined&&<Stat tile={meta.tone==='bad'?5:3} icon={Target} label="Meta ads" value={metaCount} format={whole} sub={meta.broadAds!==null?`${meta.broadAds} in the category`:undefined} title={meta.badge}/>}
    {markup&&<Stat tile={markup>=3?6:5} icon={DollarSign} label="Markup" value={markup} format={n=>`${n.toFixed(1)}x`} sub={`${v.money.sell} · ${v.money.landed} cost`}/>}
  </div>;
}

/** The trend line, marked plainly when the same curve sits on another product. */
export function TrendCard({validation:v,inDoubt,trendUrl}) {
  const points = v?.series?.points||[];
  if (points.length<2) return null;
  const change = Number.isFinite(v.changePercent)?`${v.changePercent>0?'+':''}${v.changePercent}%`:v.word;
  return <section className={`mv-pp-trend ${inDoubt?'is-doubt':`is-${v.direction}`}`} aria-label="Trend">
    <header><span><TrendingUp size={14}/>{v.series.metric==='google-trends'?'Search trend':'Units trend'}</span>{inDoubt&&<em title="The same curve is saved on another product"><CircleHelp size={12}/>Unverified</em>}</header>
    <b>{change}</b>
    <Spark points={points} tone={inDoubt?'doubt':v.direction} height={58}/>
    <footer><span>{day(v.from)}</span>{trendUrl&&<a href={trendUrl} target="_blank" rel="noreferrer">Google Trends<ArrowUpRight size={11}/></a>}<span>{day(v.to)}</span></footer>
  </section>;
}

/** The owner's five hard rules as tiles, with the score. */
export function HardRules({rules}) {
  if (!Array.isArray(rules)||!rules.length) return null;
  const score = rulesScore(rules);
  return <section className="mv-pp-rules" aria-label="Hard rules">
    <header><Ring value={score.good} total={score.total} size={36} stroke={4} label={String(score.good)}/><strong>Hard rules</strong><small>{score.good} of {score.total} clear</small></header>
    <div>{rules.map(rule=><span key={rule.id} className={`mv-pp-rule is-${rule.state}`} title={rule.value}>
      <i>{rule.state==='good'?<Check size={11} strokeWidth={3}/>:rule.state==='bad'?<AlertTriangle size={11}/>:<Circle size={9}/>}</i>
      <b title={rule.label}>{ruleName(rule)}</b>
      <small>{rule.value}</small>
    </span>)}</div>
  </section>;
}

const STEP_WORDS = {done:'Done',current:'Here now',waiting:'Waits for the slot',stopped:'Stopped',early:'Still open',todo:''};
/** This product on the owner's six steps. */
export function ProductSteps({item}) {
  const checklists = useChecklists();
  const steps = displaySteps(item,checklists);
  return <ol className="mv-pp-steps" aria-label={`${item.name}: its six steps`}>
    {steps.map(step=>{
      const Icon = DISPLAY_ICONS[step.id];
      return <li key={step.id} className={`is-${step.state}`}>
        <span>{step.state==='done'?<Check size={15} strokeWidth={3}/>:step.state==='stopped'?<X size={15} strokeWidth={3}/>:<Icon size={15}/>}</span>
        <strong>{step.short}</strong>
        <em>{STEP_WORDS[step.state]}{step.state==='current'&&step.total?` · ${step.done}/${step.total}`:''}</em>
      </li>;
    })}
  </ol>;
}

/** Saved evidence that looks copied from another product: one line, the detail on a tap. */
export function EvidenceFlags({flags}) {
  const [open,setOpen] = useState(false);
  if (!flags.length) return null;
  return <section className="mv-pp-flags" role="note">
    <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <AlertTriangle size={16}/>
      <span><strong>{flags.length} piece{flags.length===1?'':'s'} of evidence look copied</strong><small>Check these before trusting the numbers</small></span>
      <ChevronDown size={15} className={open?'is-flipped':''}/>
    </button>
    {open&&<ul>{flags.map(flag=><li key={flag.id}>{flag.text}</li>)}<li className="is-next">Ask Claude to re-check this product.</li></ul>}
  </section>;
}

/** The product's ads on Meta and its Launch Checklist, one tap from Manage. */
export function OnMetaCard({campaign,go}) {
  const checklists = useChecklists();
  const m = computeCampaignMetrics(campaign);
  const id = shortProductId(campaign.productId);
  const score = checklistScore(checklists,id);
  const picture = firstImageAd(campaign);
  const live = String(campaign.status).startsWith('ACTIVE');
  const tone = m.isProfitable?'is-good':m.purchases?'is-bad':'';
  return <section className="mv-pp-onmeta" aria-label="On Meta">
    <button type="button" className="mv-pp-onmeta-main" onClick={()=>go(`manage?product=${id}`)} title="Open it on Manage">
      <span className="mv-pp-onmeta-photo">{picture?<img src={assetUrl(picture)} alt="" loading="lazy"/>:<Megaphone size={18}/>}</span>
      <span className="mv-pp-onmeta-head"><small>On Meta · {live?'Live':'Paused'}</small><strong className={tone}><CountUp value={m.roas} format={n=>`${n.toFixed(2)}x`}/> ROAS</strong></span>
      <span className="mv-pp-onmeta-fig"><small>Spend</small><b>{usd(m.spend)}</b></span>
      <span className="mv-pp-onmeta-fig"><small>Orders</small><b>{m.purchases}</b></span>
      <span className="mv-pp-onmeta-fig"><small>Cost per sale</small><b className={tone}>{usd(m.cpa)}</b></span>
      <ArrowUpRight size={15}/>
    </button>
  </section>;
}

function Links({children}) {
  const list = React.Children.toArray(children).filter(Boolean);
  return list.length?<div className="mv-pp-links">{list}</div>:null;
}
const Out = ({href,children,primary=false}) => href?<a className={`mv-pp-link ${primary?'is-primary':''}`} href={href} target="_blank" rel="noreferrer" title={href}><ArrowUpRight size={13}/>{children}</a>:null;

/** Demand numbers with their sources, the top videos and the TikTok Shop listings. */
export function NumbersPanel({validation:v,view,openDoc}) {
  const kalo = v?.kalodata||{};
  const figures = view?.figures, videos = kalo.rawVideos||[], shops = kalo.rawProducts||[];
  const viral = viralCounts(kalo);
  const figs = figures?.lead?[figures.lead,...figures.others]:[];
  return <div className="mv-pp-panel">
    <div className="mv-pp-figs">
      {figs.map(fig=><a key={fig.metric} className="mv-pp-fig" href={fig.url} target="_blank" rel="noreferrer" title={fig.url}><b>{fig.big}</b><span>{fig.label}</span><small>{fig.source} · {day(fig.observedAt)}<ArrowUpRight size={11}/></small></a>)}
      {figures?.price&&<div className="mv-pp-fig"><b>{figures.price.text}</b><span>price</span><small>{figures.price.fromNote?'from the note':figures.lead?.source}</small></div>}
      {kalo.gmvText&&<div className="mv-pp-fig"><b>{kalo.gmvText}</b><span>30-day product sales</span><small>{kalo.brandStatus||(kalo.creators?`${kalo.creators} creators`:'Kalodata')}</small></div>}
      {kalo.videoGmvText&&<div className="mv-pp-fig"><b>{kalo.videoGmvText}</b><span>sales from creator videos</span><small>Kalodata</small></div>}
    </div>
    {kalo.waveLabel&&<p className="mv-pp-wave">{kalo.waveLabel}</p>}
    {videos.length>0&&<>
      <h3 className="mv-pp-sub">Top videos<small>{viral.videos>videos.length?`${videos.length} of ${viral.videos} saved with links`:`${videos.length} saved`}</small></h3>
      <div className="mv-pp-videos">{videos.map((video,index)=><article key={`${video.handle}-${index}`} className="mv-pp-video">
        <header><i>{video.rank||index+1}</i><strong title={video.handle}>{video.handle}</strong>{video.duration&&<small>{video.duration}</small>}</header>
        <b>{usd(video.gmv30d)}</b>
        <small className="mv-pp-video-meta">{video.sales30d?`${video.sales30d.toLocaleString('en-US')} sold · `:''}{day(video.firstTime)||'—'}{video.lastTime?` to ${day(video.lastTime)}`:''}</small>
        {video.caption&&<p title={video.caption}>{video.caption}</p>}
        {video.url&&<a href={video.url} target="_blank" rel="noreferrer"><Play size={12}/>Watch</a>}
      </article>)}</div>
    </>}
    {shops.length>0&&<>
      <h3 className="mv-pp-sub">TikTok Shop listings<small>{shops.length}</small></h3>
      <div className="mv-pp-shops">{shops.map((shop,index)=><article key={`${shop.title}-${index}`} className="mv-pp-shop">
        <strong title={shop.title}>{shop.title}</strong>
        <div><span><small>Price</small><b>{usd(Number(shop.price))}</b></span><span><small>30-day sales</small><b>{usd(shop.gmv30d)}</b></span><span><small>Sold</small><b>{(shop.units30d??shop.sales30d)?.toLocaleString('en-US')||'—'}</b></span>{shop.totalGmv?<span><small>All time</small><b>{usd(shop.totalGmv)}</b></span>:null}</div>
        {shop.launchDate&&<small>Launched {shop.launchDate}</small>}
        {shop.url&&<a href={shop.url} target="_blank" rel="noreferrer">Open<ArrowUpRight size={12}/></a>}
      </article>)}</div>
    </>}
    {view?.trendShot&&<button type="button" className="mv-pp-shot" onClick={()=>openDoc?.(view.trendShot)} title="Open the saved Google Trends screenshot"><img src={assetUrl(view.trendShot)} alt="Saved Google Trends screenshot" loading="lazy"/><span><ImageIcon size={11}/>Screenshot</span></button>}
    <Links>
      <Out href={kalo.kalodataUrl} primary>Kalodata</Out>
      <Out href={kalo.tiktokUrl}>TikTok</Out>
      <Out href={kalo.amazonUrl}>Amazon</Out>
      {(kalo.links||[]).map(link=><Out key={link.url} href={link.url}>{link.label}</Out>)}
    </Links>
  </div>;
}

const META_WORDS = {good:'Low competition',ok:'Early opening',bad:'Saturated on Meta',muted:'Unchecked'};
/** Room on Meta: who else is running this, and how proven the category is. */
export function MetaPanel({validation:v}) {
  const meta = v?.meta;
  if (!meta) return <p className="mv-small">Meta has not been checked yet.</p>;
  return <div className="mv-pp-panel">
    <div className="mv-pp-meta-stats">
      <Stat tile={meta.tone==='bad'?5:3} icon={Target} label="Competitors" value={meta.advertisers??undefined} format={whole} sub={META_WORDS[meta.tone]}/>
      <Stat tile={1} icon={Megaphone} label="Exact ads" value={meta.liveAds??undefined} format={whole} sub={meta.query?`“${meta.query}”`:'US active ads'}/>
      {meta.broadAds!==null&&<Stat tile={6} icon={TrendingUp} label="Category ads" value={meta.broadAds} format={whole} sub="Category proven on Meta"/>}
    </div>
    {meta.competitors.length>0&&<div className="mv-pp-comps">{meta.competitors.map(comp=><a key={comp.name} className="mv-pp-comp" href={comp.url||meta.url||undefined} target="_blank" rel="noreferrer" title={comp.note||comp.name}>
      <strong>{comp.name}</strong>
      {comp.ads!==null&&<em>{comp.ads} ad{comp.ads===1?'':'s'}</em>}
      {comp.note&&<small>{comp.note}</small>}
    </a>)}</div>}
    {(meta.gap||meta.note)&&<p className="mv-pp-note">{meta.gap||meta.note}</p>}
    <Links><Out href={meta.url} primary>Meta Ad Library</Out></Links>
  </div>;
}

/** The money line: each pack as a card, its profit biggest, the suppliers and flags under it. */
export function MoneyPanel({validation:v,view}) {
  const tiers = v?.tiers||[], guard = v?.pricingGuardrail, drop = view?.dropship;
  return <div className="mv-pp-panel">
    {guard&&!guard.ok&&<p className="mv-pp-alert"><AlertTriangle size={14}/>{guard.alert}</p>}
    {drop&&<div className="mv-pp-flow" aria-label="Cost, price and margin">
      <span><small>Landed cost</small><b>{drop.money.landed||'—'}</b></span><i aria-hidden="true">→</i>
      <span><small>Selling price</small><b>{drop.money.sell||'—'}</b></span><i aria-hidden="true">→</i>
      <span className={drop.margin?(drop.margin.value>0?'is-good':'is-bad'):''}><small>Margin</small><b>{drop.money.margin||'—'}{drop.margin?.percent!=null&&<em> {drop.margin.percent}%</em>}</b></span>
    </div>}
    {tiers.length>0&&<div className="mv-pp-tiers">{tiers.map((tier,index)=>{
      const previous = index>0?tiers[index-1]:null;
      const trap = (previous&&tier.totalProfit<previous.totalProfit)||tier.baseProfit<18;
      return <article key={tier.label||index} className={`mv-pp-tier ${trap?'is-trap':''}`}>
        <strong title={tier.label}>{tier.label}</strong>
        <b>{usd(Number(tier.totalProfit))}</b><small>total profit · target cost per sale {usd(Number(tier.targetCpa))}</small>
        <dl>
          <div><dt>Price</dt><dd>{usd(Number(tier.price))} · {tier.markup}x</dd></div>
          <div><dt>Landed</dt><dd>{usd(Number(tier.landed))}</dd></div>
          <div><dt>Item profit</dt><dd className={tier.baseProfit>=18?'is-good':'is-bad'}>{usd(Number(tier.baseProfit))}</dd></div>
          <div><dt>Shipping and protection</dt><dd>+{usd(Number(tier.bonusNet))}</dd></div>
        </dl>
      </article>;
    })}</div>}
    {drop?.flags?.length>0&&<div className="mv-pp-chips">{drop.flags.map(flag=><span key={flag} className="is-warn">{flag}</span>)}</div>}
    <Links>{(drop?.suppliers||[]).map(supplier=><Out key={supplier.url} href={supplier.url}>{supplier.name}</Out>)}</Links>
  </div>;
}

/** Who buys it: avatars as cards, the benefit ladder, the angle nobody uses and A1-A3. */
export function BuyersPanel({view,candidate,openDoc}) {
  const buyers = candidate?.screen?.checks?.buyers;
  const avatars = Array.isArray(buyers?.avatars)&&buyers.avatars.length?buyers.avatars.map(a=>({who:a.who,text:a.trigger})):(view?.avatars||[]).map(a=>({who:a.who,text:[a.problem,a.why].filter(Boolean).join(' · '),main:a.main}));
  const lines = GATES.buyers.map(line=>gateLine(line,{candidate:candidate||null}));
  return <div className="mv-pp-panel">
    <div className="mv-pp-lines">{lines.map(line=><span key={line.id} className={`is-${line.state}`}><i>{line.state==='passed'?<Check size={11} strokeWidth={3}/>:line.state==='failed'?<X size={11} strokeWidth={3}/>:<Circle size={9}/>}</i>{line.id} · {line.label}</span>)}{Number.isFinite(buyers?.quotes)&&<em>{buyers.quotes} quotes</em>}</div>
    {avatars.length>0&&<div className="mv-pp-avatars">{avatars.map((avatar,index)=><article key={`${avatar.who}-${index}`} className={`mv-pp-avatar is-tile-${index%6+1}`}>{avatar.main&&<small>Sold to now</small>}<strong>{avatar.who}</strong>{avatar.text&&<p title={avatar.text}>{avatar.text}</p>}</article>)}</div>}
    {view?.ladder?.length>0&&<ol className="mv-pp-ladder">{view.ladder.map((step,index)=><li key={step.rung} className={step.text?'':'is-missing'}><small>{index+1} · {step.rung}</small><span>{step.text||'Not written yet'}</span></li>)}</ol>}
    {view?.issues?.length>0&&<div className="mv-pp-chips">{view.issues.map(issue=><span key={issue}>{issue}</span>)}</div>}
    {view?.gap&&<p className="mv-pp-note"><b>The angle nobody uses:</b> {view.gap}</p>}
    <Links>
      <Out href={view?.gapUrl}>Competitors checked</Out>
      {buyers?.source&&(/^https?:/.test(buyers.source)?<Out href={buyers.source} primary>Buyers write-up</Out>:<button key="write-up" type="button" className="mv-pp-link is-primary" onClick={()=>openDoc?.(buyers.source)}>Buyers write-up</button>)}
    </Links>
  </div>;
}

/** F1-F6 as tiles: green, red or open, with what each still needs. */
export function GateTiles({gates}) {
  if (!gates?.length) return null;
  return <div className="mv-pp-gates">{gates.map(gate=><article key={gate.id||gate.number} className={`mv-pp-gate is-${gate.state}`}>
    <header><i>{gate.state==='pass'?<Check size={12} strokeWidth={3}/>:gate.state==='fail'?<X size={12} strokeWidth={3}/>:<Circle size={9}/>}</i><b>{gate.number}</b><strong>{gate.label}</strong></header>
    {gate.line&&<p title={gate.line}>{gate.line}</p>}
    {gate.source&&<a href={gate.source} target="_blank" rel="noreferrer">Source<ArrowUpRight size={11}/></a>}
  </article>)}</div>;
}
