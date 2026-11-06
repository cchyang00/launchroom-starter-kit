import React,{useMemo,useState} from 'react';
import {ArrowUpRight,TrendingUp,TrendingDown,MoveRight,CircleHelp,Check,Circle,X,Truck,Layers,Users,ListChecks,Image as ImageIcon,Lock,Flag,Target,BarChart3,ShieldCheck,AlertTriangle,DollarSign,Video} from 'lucide-react';
import {statsPanel,statsSummary,validationSnapshot,sparkPoints,DIRECTION_WORDS} from './statsPanel.mjs';
import {assetUrl} from './kit.jsx';
import './statsPanel.css';

// The product card's Statistics panel (owner, Oct 2): agents collect the
// numbers, the owner verifies them in seconds. Numbers first, then the
// details as rows that open. Everything is read from the saved card.

const DIR_ICON = {rising:TrendingUp,stable:MoveRight,falling:TrendingDown,unknown:CircleHelp};
const day = value => {const d=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00'):/^\d{4}-\d{2}$/.test(value||'')?new Date(value+'-15T12:00:00'):null;return d&&Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:/^\d{4}-\d{2}$/.test(value)?undefined:'numeric',year:'numeric'}):value||'';};
const shortDay = value => {const d=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00'):null;return d&&Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):value||'';};
const monthYear = value => {const d=new Date((value.length===7?`${value}-15`:value)+'T12:00:00');return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:value.length===10?'numeric':undefined,year:value.length===7?'numeric':undefined}):value;};
const narrow = () => {try{return window.matchMedia('(max-width: 640px)').matches;}catch{return false;}};

/** Rising, Stable, Falling or No trend yet, as a chip. */
export function DirectionChip({direction,changePercent=null,small=false}) {
  const Icon = DIR_ICON[direction]||CircleHelp;
  const pct = Number.isFinite(changePercent)&&direction!=='unknown'?` ${changePercent>0?'+':''}${changePercent}%`:'';
  return <span className={`mv-sp-dir is-${direction}${small?' is-small':''}`}><Icon size={small?11:13} strokeWidth={2.4}/>{DIRECTION_WORDS[direction]||direction}{pct}</span>;
}

/** Inline mini uptrend sparkline for Pipeline rows & compact cards. */
export function MiniSparkline({pts=[],direction='rising'}) {
  if (!pts||pts.length<2) return null;
  const width = 88, height = 24, pad = 2.5;
  const scaled = sparkPoints(pts.map(p=>({date:p.date,value:p.value})),width,height,pad);
  if (scaled.length<2) return null;
  const d = scaled.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${d} L${scaled.at(-1).x.toFixed(1)} ${(height-pad).toFixed(1)} L${scaled[0].x.toFixed(1)} ${(height-pad).toFixed(1)} Z`;
  const last = scaled.at(-1);
  return <span className={`mv-sp-minispark is-${direction}`} title={`Trend: ${pts[0].value} (${shortDay(pts[0].date)}) → ${pts.at(-1).value} (${shortDay(pts.at(-1).date)})`}>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={area} className="mv-sp-miniarea"/>
      <path d={d} className="mv-sp-miniline"/>
      <circle cx={last.x} cy={last.y} r={2.6} className="mv-sp-minidot"/>
    </svg>
  </span>;
}

/**
 * The one-glance summary on Find cards and Pipeline rows across ALL steps:
 * Kalodata units & 30d GMV + mini uptrend sparkline + Meta competitor count.
 */
export function StatsMini({candidate,summary,validation}) {
  const s = summary!==undefined?summary:statsSummary(candidate);
  const v = useMemo(()=>validation!==undefined?validation:(candidate?validationSnapshot(candidate):null),[candidate,validation]);
  if (!s&&!v) return <span className="mv-sp-mini is-none" title="No statistics saved on this card yet (F1)"><CircleHelp size={11}/>No statistics yet</span>;
  if (!v) return <span className="mv-sp-mini" title={`F1 Statistics${s.source?` · ${s.source}`:''} · ${s.word}${s.passed?' · passes':' · not passed yet'}`}>{s.top&&<b>{s.top}</b>}<DirectionChip direction={s.direction} small/></span>;
  const kalo = v.kalodata, meta = v.meta;
  return <span className="mv-sp-mini is-rich" onClick={e=>e.stopPropagation()}>
    <span className="mv-sp-mini-group" title={`Kalodata / TikTok demand: ${kalo.unitsText||'—'}${kalo.gmvText?` · ${kalo.gmvText} 30d GMV`:''}${kalo.videoGmvText?` · ${kalo.videoGmvText} video GMV`:''}`}>
      <DirectionChip direction={v.direction} changePercent={v.changePercent} small/>
      {v.series?.points?.length>=2&&<MiniSparkline pts={v.series.points} direction={v.direction}/>}
      {kalo.unitsText&&<b>{kalo.unitsText}</b>}
      {kalo.gmvText&&<span className="mv-sp-mini-tag is-kalo">Kalodata {kalo.gmvText}</span>}
      {kalo.videoGmvText&&<span className="mv-sp-mini-tag is-vid">🎬 {kalo.videoGmvText} video</span>}
    </span>
    <span className={`mv-sp-mini-tag is-meta is-${meta.tone}`} title={meta.query?`Meta Ad Library (${meta.query}): ${meta.badge}${meta.competitors?.length?` · ${meta.competitors.map(c=>c.name).join(', ')}`:''}`:`Meta Ad Library: ${meta.badge}`}>
      <Target size={11}/>{meta.badge}
    </span>
    {v.money?.sell&&v.money?.landed&&<span className="mv-sp-mini-tag is-money" title={`Sell ${v.money.sell} vs Landed ${v.money.landed}`}>💰 {v.money.sell} <small>({v.money.landed} cost)</small></span>}
    {v.pricingGuardrail&&!v.pricingGuardrail.ok&&<span className="mv-sp-mini-tag is-trap" title={v.pricingGuardrail.alert}><AlertTriangle size={11}/>{v.pricingGuardrail.summary}</span>}
  </span>;
}

/** A line + shaded area of the dated points: 2px line, area fill, dots with their value on hover. */
function Sparkline({series,direction}) {
  const width = 220, height = 54, pad = 6;
  const pts = useMemo(()=>sparkPoints(series.points,width,height,pad),[series]);
  if (pts.length<2) return <div className="mv-sp-spark is-empty">{pts.length?'One dated point so far':'No dated points yet'}</div>;
  const d = pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${d} L${pts.at(-1).x.toFixed(1)} ${(height-pad).toFixed(1)} L${pts[0].x.toFixed(1)} ${(height-pad).toFixed(1)} Z`;
  const label = `${series.metric==='google-trends'?'Google Trends':'Dated points'}: ${pts.map(p=>`${day(p.date)} ${p.value}`).join(', ')}`;
  return <figure className={`mv-sp-spark is-${direction}`}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <line x1={pad} x2={width-pad} y1={height-pad} y2={height-pad} className="mv-sp-base"/>
      <path d={area} className="mv-sp-area"/>
      <path d={d} className="mv-sp-line"/>
      {pts.map((p,i)=><g key={`${p.date}-${i}`} className="mv-sp-pt"><circle cx={p.x} cy={p.y} r={8} className="mv-sp-hit"><title>{`${day(p.date)}: ${p.value}`}</title></circle><circle cx={p.x} cy={p.y} r={i===pts.length-1?3.8:2.6} className="mv-sp-dot"/></g>)}
    </svg>
    <figcaption><span>{monthYear(pts[0].date)} · <b>{pts[0].value.toLocaleString('en-US')}</b></span><span>{pts.length} dated pts</span><span>{monthYear(pts.at(-1).date)} · <b>{pts.at(-1).value.toLocaleString('en-US')}</b></span></figcaption>
  </figure>;
}

/**
 * Simple, side-by-side Kalodata + Uptrend Graph + Meta Ad Library Competition
 * + 5 Hard Rules Scorecard + Tier-by-Tier Bundle Pricing Guardrail
 * overview card for BuildingCard (#/pipeline), Find Drawer, and ProductPage (#/product/<id>).
 */
export function ValidationOverview({candidate,validation,compact=false}) {
  const v = useMemo(()=>validation!==undefined?validation:(candidate?validationSnapshot(candidate):null),[candidate,validation]);
  if (!v) return null;
  const {kalodata:kalo,meta,money,margin,tiers,pricingGuardrail,fiveRules} = v;
  const metaLabel = meta.tone==='good'?'Low competition · Wide open':meta.tone==='ok'?'Early opening (≤15 ads)':meta.tone==='bad'?'Saturated on Meta':'Unchecked';
  const fmtMoney = n => Number.isFinite(n)?`$${n>=1000?Math.round(n).toLocaleString('en-US'):n.toFixed(2).replace(/\.00$/,'')}`:'—';
  return <section className={`mv-sp-overview${compact?' is-compact':''}`} aria-label="Kalodata, Meta Ad Library & Bundle Pricing validation numbers">
    {Array.isArray(fiveRules)&&fiveRules.length>0&&<div className="mv-sp-rules-bar" aria-label="5 Hard Rules Scorecard">
      <div className="mv-sp-rules-head">
        <ShieldCheck size={14}/><strong>Owner's 5 Hard Rules Check</strong>
        <span className="mv-sp-rules-sub">Verify raw Kalodata dates, unbranded status, Meta category proof & bundle profit math</span>
      </div>
      <div className="mv-sp-rules-grid">
        {fiveRules.map(r=><div key={r.id} className={`mv-sp-rule-pill is-${r.state}`}>
          <span className="mv-sp-rule-top">
            {r.state==='good'?<Check size={11} strokeWidth={3}/>:r.state==='bad'?<AlertTriangle size={11}/>:<Circle size={10}/>}
            <b>{r.label}</b>
          </span>
          <small>{r.value}</small>
        </div>)}
      </div>
    </div>}

    <div className="mv-sp-ov-col is-kalo">
      <div className="mv-sp-ov-head">
        <span className="mv-sp-ov-title"><BarChart3 size={15}/><strong>Kalodata Raw Numbers & Wave Audit</strong></span>
        <DirectionChip direction={v.direction} changePercent={v.changePercent}/>
      </div>
      <div className="mv-sp-ov-grid">
        {kalo.unitsText&&<div className="mv-sp-ov-stat is-primary">
          <b>{kalo.unitsText}</b>
          <span>TikTok / Kalodata Volume</span>
          <small>{kalo.price?`${kalo.price} TikTok market price`:'Verified volume'}</small>
        </div>}
        {kalo.gmvText&&<div className="mv-sp-ov-stat">
          <b>{kalo.gmvText}</b>
          <span>30d Product GMV (US)</span>
          <small>{kalo.brandStatus||(kalo.creators?`${kalo.creators} creators`:'Unbranded shops')}</small>
        </div>}
        {kalo.videoGmvText&&<div className="mv-sp-ov-stat is-accent">
          <b>{kalo.videoGmvText}</b>
          <span>Creator Video GMV</span>
          <small>{kalo.waveLabel||'Breakout wave'}</small>
        </div>}
        {money?.sell&&money?.landed&&<div className="mv-sp-ov-stat">
          <b>{money.sell} <small>/ {money.landed}</small></b>
          <span>1-Pack Retail vs Landed</span>
          {margin?.value>0&&<small className="is-good">+{money.margin} ({margin.percent}% margin)</small>}
        </div>}
      </div>
      <div className="mv-sp-ov-chart">
        <div className="mv-sp-ov-chart-info">
          <strong>Uptrend Graph ({v.series.metric==='google-trends'?'Search Trend':'Units Sold Trajectory'})</strong>
          <span>{v.from&&v.to?`${shortDay(v.from)} → ${shortDay(v.to)}`:'Recent window'}</span>
        </div>
        <Sparkline series={v.series} direction={v.direction}/>
      </div>

      {kalo.rawVideos?.length>0&&<div className="mv-sp-raw-box">
        <div className="mv-sp-raw-head">
          <span><Video size={13}/><strong>Raw Kalodata Top Videos (Exact Post Dates & GMV)</strong></span>
          {kalo.waveLabel&&<span className={`mv-sp-wave-badge is-${kalo.waveType||'fresh'}`}>{kalo.waveLabel}</span>}
        </div>
        <div className="mv-sp-raw-table-wrap">
          <table className="mv-sp-raw-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Posted → Last Active</th>
                <th>30d GMV</th>
                <th>Sales</th>
                <th>Viral Hook / Caption</th>
              </tr>
            </thead>
            <tbody>
              {kalo.rawVideos.map((rv,idx)=><tr key={`${rv.handle}-${idx}`}>
                <td>
                  <strong>#{rv.rank||idx+1} {rv.handle}</strong>
                  {rv.duration&&<small className="mv-sp-raw-dur">{rv.duration}</small>}
                </td>
                <td>
                  <span className="mv-sp-raw-dates">{rv.firstTime||'—'}{rv.lastTime?` → ${rv.lastTime}`:''}</span>
                </td>
                <td><b className="mv-sp-raw-gmv">{fmtMoney(rv.gmv30d)}</b></td>
                <td>{rv.sales30d?rv.sales30d.toLocaleString('en-US'):'—'}</td>
                <td className="mv-sp-raw-cap">
                  <span>{rv.caption||'—'}</span>
                  {rv.url&&<a href={rv.url} target="_blank" rel="noreferrer" className="mv-sp-raw-link"><ArrowUpRight size={11}/>Watch</a>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>}

      {kalo.rawProducts?.length>0&&<div className="mv-sp-raw-shops">
        <strong className="mv-sp-ov-sub">Raw Kalodata TikTok Shop Listings ({kalo.rawProducts.length}):</strong>
        <div className="mv-sp-raw-shop-list">
          {kalo.rawProducts.map((rp,idx)=><div key={`${rp.title}-${idx}`} className="mv-sp-raw-shop">
            <strong>{rp.title}</strong>
            <span>TikTok Price: <b>${Number(rp.price||0).toFixed(2)}</b> · 30d GMV: <b>{fmtMoney(rp.gmv30d)}</b> ({rp.sales30d?.toLocaleString('en-US')||'—'} sold){rp.totalGmv?` · All-Time: ${fmtMoney(rp.totalGmv)}`:''}{rp.launchDate?` · Launched ${rp.launchDate}`:''}</span>
          </div>)}
        </div>
      </div>}

      <div className="mv-sp-ov-links">
        {kalo.kalodataUrl&&<a className="mv-sp-ov-link is-primary" href={kalo.kalodataUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>Kalodata Listing</a>}
        {kalo.tiktokUrl&&<a className="mv-sp-ov-link" href={kalo.tiktokUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>TikTok Shop / Video</a>}
        {kalo.amazonUrl&&<a className="mv-sp-ov-link" href={kalo.amazonUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>Amazon Check</a>}
        {kalo.links.map(link=><a key={link.url} className="mv-sp-ov-link" href={link.url} target="_blank" rel="noreferrer"><ArrowUpRight size={12}/>{link.label}</a>)}
      </div>
    </div>

    <div className="mv-sp-ov-col is-meta">
      <div className="mv-sp-ov-head">
        <span className="mv-sp-ov-title"><Target size={15}/><strong>Meta Ad Library & Bundle Pricing Guardrail</strong></span>
        <span className={`mv-sp-ov-badge is-${meta.tone}`}>{meta.tone==='good'&&<Check size={12} strokeWidth={3}/>}{metaLabel}</span>
      </div>
      <div className="mv-sp-ov-grid">
        <div className={`mv-sp-ov-stat is-primary is-${meta.tone}`}>
          <b>{meta.advertisers!==null?meta.advertisers:'—'}</b>
          <span>Active Competitors</span>
          <small>Selling this item on Meta</small>
        </div>
        <div className="mv-sp-ov-stat">
          <b>{meta.liveAds!==null?`~${meta.liveAds}`:'—'}</b>
          <span>Exact-Match Ads</span>
          <small>{meta.query?`"${meta.query}"`:'US active ads'}</small>
        </div>
        {meta.broadAds!==null&&<div className="mv-sp-ov-stat">
          <b>~{meta.broadAds}</b>
          <span>Broad Category Ads</span>
          <small>Category proven on Meta</small>
        </div>}
      </div>
      {meta.competitors.length>0 ? (
        <div className="mv-sp-ov-comps">
          <strong className="mv-sp-ov-sub">Active Meta Competitors ({meta.competitors.length}):</strong>
          <div className="mv-sp-ov-comp-list">
            {meta.competitors.map(comp=><a key={comp.name} className="mv-sp-ov-comp" href={comp.url||meta.url||'#'} target="_blank" rel="noreferrer" title={comp.note||`View ${comp.name} in Meta Ad Library`}>
              <strong>{comp.name}</strong>
              {comp.ads!==null&&<span className="mv-sp-ov-comp-ads">{comp.ads} ad{comp.ads===1?'':'s'}</span>}
              {comp.note&&<small>{comp.note}</small>}
              <ArrowUpRight size={12}/>
            </a>)}
          </div>
        </div>
      ) : (
        <p className="mv-sp-ov-gap">{meta.gap||meta.note||'Zero saturated competitors on this exact product angle.'}</p>
      )}

      {Array.isArray(tiers)&&tiers.length>0&&<div className="mv-sp-tiers-box">
        <div className="mv-sp-raw-head">
          <span><DollarSign size={13}/><strong>Market-Fit Pricing + Shipping & Protection Profit Stack</strong></span>
          <span className={`mv-sp-wave-badge is-${pricingGuardrail?.ok?'fresh':'warn'}`}>
            {pricingGuardrail?.ok?'Base + Bonus Stack Healthy':'⚠️ Bundle Profit Alert'}
          </span>
        </div>
        {pricingGuardrail&&!pricingGuardrail.ok&&<div className="mv-sp-tier-alert">
          <AlertTriangle size={14}/>
          <span>{pricingGuardrail.alert}</span>
        </div>}
        <div className="mv-sp-raw-table-wrap">
          <table className="mv-sp-raw-table is-tiers">
            <thead>
              <tr>
                <th>Bundle Tier</th>
                <th>Item Price</th>
                <th>Landed DDP</th>
                <th>Base Item Profit</th>
                <th>+ Ship & Prot Bonus</th>
                <th>Total Profit (BE CPA)</th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t,idx)=>{
                const prev = idx>0?tiers[idx-1]:null;
                const isTrap = (prev && t.totalProfit < prev.totalProfit) || t.baseProfit < 18;
                return <tr key={t.label||idx} className={isTrap?'is-trap-row':'is-ok-row'}>
                  <td><strong>{t.label}</strong></td>
                  <td>
                    <b>${Number(t.price).toFixed(2)}</b>
                    <small className="mv-sp-tier-ship">{t.markup}× landed</small>
                  </td>
                  <td>${Number(t.landed).toFixed(2)}</td>
                  <td>
                    <b className={t.baseProfit>=18?'is-good-num':'is-bad-num'}>+${Number(t.baseProfit).toFixed(2)}</b>
                    <small className="mv-sp-tier-ship">Item alone</small>
                  </td>
                  <td>
                    <span className="mv-sp-markup-pill is-good">+${Number(t.bonusNet).toFixed(2)}</span>
                    <small className="mv-sp-tier-ship">{t.custShip>0?`$${t.custShip} ship + $${t.protFee} prot`:`Free ship + $${t.protFee} prot`}</small>
                  </td>
                  <td>
                    <b className={isTrap?'is-bad-num':'is-good-num'}>${Number(t.totalProfit).toFixed(2)}</b>
                    <small className="mv-sp-tier-ship">Target CPA ${Number(t.targetCpa).toFixed(2)}</small>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="mv-sp-ov-links">
        {meta.url&&<a className="mv-sp-ov-link is-primary" href={meta.url} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>Open Meta Ad Library{meta.query?` ("${meta.query}")`:''}</a>}
      </div>
    </div>
  </section>;
}

function Row({icon:Icon,title,summary,state,children,open}) {
  return <details className={`mv-sp-row${state?` is-${state}`:''}`} open={open}>
    <summary><Icon size={14}/><strong>{title}</strong><span className="mv-sp-row-sum">{summary}</span></summary>
    <div className="mv-sp-row-body">{children}</div>
  </details>;
}

const ext = (url,label) => url?<a className="mv-link" href={url} target="_blank" rel="noreferrer" title={url}><ArrowUpRight size={12}/>{label}</a>:null;

/**
 * The Statistics block at the top of a card (the Find drawer and the product
 * page): demand figures, trend, dropshipping, the benefit ladder, avatars and
 * the angle gap, then the F1-F6 checklist with what each still needs.
 */
export function StatsPanel({candidate,openDoc,evidencePath}) {
  const view = useMemo(()=>statsPanel(candidate),[candidate]);
  const [wide] = useState(()=>!narrow());
  if (!candidate) return null;
  const {figures,direction,series,dropship,gates} = view;
  const lead = figures.lead;
  const f1 = gates[0];
  const openShot = () => openDoc?openDoc(view.trendShot):window.open(assetUrl(view.trendShot),'_blank','noopener');
  const avatarCount = view.avatars.length;
  return <section className="mv-sp" aria-label="Statistics">
    <div className="mv-sp-head">
      <h3 className="mv-h3">Statistics</h3>
      <span className={`mv-sp-f1 is-${f1.state}`}>{f1.state==='pass'?<Check size={12} strokeWidth={3}/>:<Circle size={10}/>}F1 {f1.state==='pass'?'passes':'not passed'}</span>
      <span className="mv-sp-count">{view.passed}/6 checks pass</span>
    </div>

    {lead?<div className="mv-sp-figs">
      <a className="mv-sp-fig is-lead" href={lead.url} target="_blank" rel="noreferrer" title={`Open the exact listing: ${lead.url}`}>
        <b>{lead.big}</b><span>{lead.label}</span>
        <small>{lead.source} · {day(lead.observedAt)} <ArrowUpRight size={11}/></small>
      </a>
      {figures.others.map(fig=><a key={fig.metric} className="mv-sp-fig" href={fig.url} target="_blank" rel="noreferrer" title={fig.url}><b>{fig.big}</b><span>{fig.label}</span><small>{fig.source} · {day(fig.observedAt)}</small></a>)}
      {figures.price&&<div className="mv-sp-fig" title={figures.price.fromNote?'Read from the saved note on the leading number':'Saved price'}><b>{figures.price.text}</b><span>price</span><small>{figures.price.fromNote?'from the note':lead.source}</small></div>}
    </div>
    :<div className="mv-sp-empty"><Lock size={15}/><div><b>No numbers saved on this card yet.</b><span>{f1.line}</span>{evidencePath&&openDoc&&<button type="button" className="mv-link" onClick={()=>openDoc(evidencePath)}>Open the card file</button>}</div></div>}

    <div className="mv-sp-trend">
      <div className="mv-sp-trend-main">
        <DirectionChip direction={direction.direction}/>
        <span className="mv-small">{direction.direction==='unknown'?(direction.points===1?'Only one dated point.':'Needs 2+ dated points.'):`${direction.changePercent>0?'+':''}${direction.changePercent}% · ${day(direction.from)} to ${day(direction.to)}`}</span>
        {ext(view.trendUrl,'Google Trends')}
      </div>
      <Sparkline series={series} direction={direction.direction}/>
      {view.trendShot&&<button type="button" className="mv-sp-shot" onClick={openShot} title="Open the saved Google Trends screenshot full size"><img src={assetUrl(view.trendShot)} alt="Saved Google Trends screenshot" loading="lazy"/><span><ImageIcon size={11}/>Screenshot</span></button>}
    </div>

    <div className="mv-sp-rows">
      <Row icon={Truck} title="Dropshippable" open={wide} state={gates[1].state} summary={dropship.suppliers.length?`${dropship.suppliers.map(s=>s.name).filter((n,i,a)=>a.indexOf(n)===i).join(', ')}${dropship.flags.length?` · ${dropship.flags.length} flag${dropship.flags.length===1?'':'s'}`:''}`:'No supplier link yet'}>
        {dropship.suppliers.length>0&&<div className="mv-sp-links">{dropship.suppliers.map(s=><a key={s.url} className="mv-sp-link" href={s.url} target="_blank" rel="noreferrer" title={s.url}><ArrowUpRight size={12}/>{s.name}</a>)}</div>}
        <div className="mv-sp-money" aria-label="Rough cost, price and margin">
          <span><small>Landed cost</small><b>{dropship.money.landed||'—'}</b></span><i aria-hidden="true">→</i>
          <span><small>Selling price</small><b>{dropship.money.sell||'—'}</b></span><i aria-hidden="true">→</i>
          <span className={dropship.margin?(dropship.margin.value>0?'is-good':'is-bad'):''}><small>Margin</small><b>{dropship.money.margin||'—'}{dropship.margin?.percent!=null&&<em> {dropship.margin.percent}%</em>}</b></span>
        </div>
        {!dropship.margin&&<p className="mv-small">Cost, price and margin aren't saved on the card yet; the checker works them out after your Save.</p>}
        {dropship.flags.length>0&&<div className="mv-sp-flags">{dropship.flags.map(flag=><span key={flag} className="mv-sp-flag"><Flag size={11}/>{flag}</span>)}</div>}
      </Row>
      <Row icon={Layers} title="Benefit ladder" open={wide} state={gates[4].state} summary={view.issues.length?`Ties to ${view.issues.join(', ')}`:'No issue linked yet'}>
        <ol className="mv-sp-ladder">{view.ladder.map((step,i)=><li key={step.rung} className={step.text?'':'is-missing'}><small>{i+1} · {step.rung}</small><span>{step.text||'Not written yet'}</span></li>)}</ol>
      </Row>
      <Row icon={Users} title="Avatars and angles" open={wide} state={gates[3].state} summary={`${avatarCount} to target${view.gap?' · angle gap':''}`}>
        {avatarCount>0?<div className="mv-sp-chips">{view.avatars.map((a,i)=><span key={`${a.who}-${i}`} className={`mv-sp-chip${a.main?' is-main':''}`} title={[a.problem,a.why].filter(Boolean).join(' — ')}>{a.main&&<small>Sold to now</small>}{a.who}</span>)}</div>:<p className="mv-small">No avatars saved yet.</p>}
        <p className="mv-sp-gap"><b>Angle gap:</b> {view.gap?view.gap.split(/(?<=\.)\s/).find(s=>/opening|ignored|nobody|gap/i.test(s))||view.gap.split(/(?<=\.)\s/)[0]:'not written yet.'} {ext(view.gapUrl,'Competitors checked')}</p>
      </Row>
      <Row icon={ListChecks} title="Gate checklist F1–F6" open={view.passed<6} state={view.passed===6?'pass':'open'} summary={`${view.passed}/6 pass`}>
        <ul className="mv-sp-gates">{gates.map(g=><li key={g.id} className={`mv-sp-gate is-${g.state}`}>
          <span className="mv-sp-gate-mark" aria-hidden="true">{g.state==='pass'?<Check size={11} strokeWidth={3}/>:g.state==='fail'?<X size={11} strokeWidth={3}/>:null}</span>
          <span><b>{g.number} {g.label}</b><span className="mv-sp-gate-line">{g.line}</span></span>
          {g.source&&ext(g.source,'Link')}
        </li>)}</ul>
      </Row>
    </div>
  </section>;
}
