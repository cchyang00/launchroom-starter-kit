import React,{useState} from 'react';
import {ArrowUpRight,BarChart3,ChevronDown,DollarSign,Image as ImageIcon,Layers,MousePointerClick,Play,ShoppingBag,ThumbsDown,ThumbsUp,TrendingUp,Trophy} from 'lucide-react';
import {Chip,assetUrl} from './kit.jsx';
import {CountUp,ReadMore,Stat} from './cards.jsx';
import {adMetricsForWindow,firstImageAd,computeCampaignMetrics,cpaGauge} from './campaignView.mjs';
import {shortProductId} from './displayLine.mjs';
import './manage.css';

// The pieces of Manage (owner, Nov 4: "My goal is simply to look, view, and maybe click
// approve or disapprove for some things"). Pictures and big numbers first; an ad's words,
// each day's detail and the improvement ideas stay one tap away. Keep and Cut are the only
// decisions here; creating happens in the hubs.

export const money = value => `$${Number(value||0).toFixed(2)}`;
export const pct = value => `${Number(value||0).toFixed(2)}%`;
const whole = value => Number(value||0).toLocaleString();
const productName = campaign => String(campaign?.shortName||shortProductId(campaign?.productId)).replace(/^[PL]\d{3,}\s*·\s*/,'');
/** "Day 1 · Tue, Nov 3" reads "Tue, Nov 3". */
const dayName = label => String(label||'').split('·').pop().trim();

const Bar = ({percent}) => <i className="mv-mg-bar"><span style={{width:`${Math.max(0,Math.min(100,percent))}%`}}/></i>;

/** One product running on Meta: tap to see everything about it. */
export function ProductPick({campaign,selected,onPick}) {
  const m = computeCampaignMetrics(campaign,'lifetime');
  const id = shortProductId(campaign.productId);
  const picture = firstImageAd(campaign);
  const live = String(campaign.status).startsWith('ACTIVE');
  return <button type="button" className="mv-mg-pick" aria-pressed={selected} onClick={onPick}>
    <span className="mv-mg-pick-photo">{picture?<img src={assetUrl(picture)} alt="" loading="lazy"/>:id}</span>
    <span className="mv-mg-pick-main">
      <small>{id} · {m.productAgeDays} {m.productAgeDays===1?'day':'days'} · {live?'Live':'Paused'} · ${campaign.dailyBudget}/day</small>
      <strong title={campaign.shortName}>{productName(campaign)}</strong>
      <span className="mv-mg-pick-figs">
        <span><small>Spend</small><b>{money(m.spend)}</b></span>
        <span><small>Revenue</small><b className={m.revenue?'is-good':''}>{money(m.revenue)}</b></span>
        <span><small>Orders</small><b>{m.purchases}</b></span>
        <span><small>Cost per sale</small><b className={m.isProfitable?'is-good':m.purchases?'is-warn':''}>{money(m.cpa)}</b></span>
      </span>
    </span>
    <span className={`mv-mg-pick-roas ${m.roas>=1?'is-good':'is-warn'}`}><CountUp value={m.roas} format={n=>`${n.toFixed(2)}x`}/><small>ROAS</small></span>
  </button>;
}

/** The six numbers for the selected product and window, as big tiles. */
export function KpiTiles({metrics:m,campaign,lifetime,isLifetime,daily}) {
  const budget = campaign.dailyBudget*(isLifetime?Math.max(1,lifetime.productAgeDays):1);
  const net = m.revenue-m.spend;
  const split = m.spend>0?(m.videoStats.spend/m.spend)*100:50;
  return <div className="mv-mg-kpis">
    <Stat tile={6} icon={TrendingUp} label="Revenue" value={m.revenue} format={money} sub={`${m.roas.toFixed(2)}x ROAS · ${net>=0?'+':'−'}${money(Math.abs(net))} after ads`}><Bar percent={(m.roas/3)*100}/></Stat>
    <Stat tile={1} icon={DollarSign} label="Ad spend" value={m.spend} format={money} sub={isLifetime&&daily.length>1?daily.map(day=>`${dayName(day.label)}: ${money(day.spend)}`).join(' · '):`of $${campaign.dailyBudget}/day · ${money(m.cpm)} CPM`}><Bar percent={budget>0?(m.spend/budget)*100:0}/></Stat>
    <Stat tile={m.isProfitable?6:5} icon={ShoppingBag} label="Cost per sale" value={m.cpa} format={money} sub={`Break-even ${money(m.breakEvenCpa)} · ${m.cpaDelta>=0?`${money(m.cpaDelta)} under`:`${money(Math.abs(m.cpaDelta))} over`}`}><Bar percent={cpaGauge(m)}/></Stat>
    <Stat tile={3} icon={MousePointerClick} label="Click rate" value={m.ctr} format={pct} sub={`${whole(m.clicks)} clicks · ${money(m.cpc)} each`}><Bar percent={(m.ctr/5)*100}/></Stat>
    <Stat tile={4} icon={BarChart3} label="Site conversion" value={m.cvr} format={pct} sub={`${money(m.aov)} average order`}><Bar percent={(m.cvr/10)*100}/></Stat>
    <Stat tile={2} icon={Layers} label="Videos vs images" value={`${split.toFixed(0)}% / ${(100-split).toFixed(0)}%`} sub={`${m.videoAds} videos ${money(m.videoStats.spend)} · ${m.staticAds} images ${money(m.staticStats.spend)}`}><Bar percent={split}/></Stat>
  </div>;
}

/** From shown to bought, in four steps, with the rate between each. */
export function Funnel({metrics:m}) {
  const cartRate = m.clicks>0?(m.addToCart/m.clicks)*100:0;
  const steps = [
    {label:'Shown',big:whole(m.impressions),small:`${money(m.cpm)} CPM`},
    {rate:`${pct(m.ctr)} clicked`},
    {label:'Clicked',big:whole(m.clicks),small:`${whole(m.viewContent)} page views`},
    {rate:`${pct(cartRate)} added to cart`},
    {label:'Added to cart',big:whole(m.addToCart),small:`${whole(m.initiateCheckout)} started checkout`},
    {rate:`${pct(m.cvr)} of clicks bought`},
    {label:'Bought',big:whole(m.purchases),small:money(m.revenue),good:m.purchases>0},
  ];
  return <section className="mv-mg-funnel" aria-label="From shown to bought">
    {steps.map((step,index)=>step.rate
      ?<span key={index} className="mv-mg-funnel-rate"><i/>{step.rate}</span>
      :<div key={index} className={`mv-mg-funnel-step ${step.good?'is-good':''}`}><small>{step.label}</small><b>{step.big}</b><span>{step.small}</span></div>)}
  </section>;
}

/** One ad: ranked Best -> Worst, showing Sales, ATC, Clicks, CTR, and 1-tap Keep or Cut. */
export function ManageAdCard({ad,rank,dateWindow,totalSpend,daily,showDays,onVerdict,onInspect,onHub}) {
  const [open,setOpen] = useState(false);
  const m = adMetricsForWindow(ad,dateWindow);
  const isVideo = ad.format==='video';
  const verdict = ad.ownerVerdict||'';
  const salesCount = Number(ad.purchasesLifetime ?? (/(\d+)\s*Purchase/i.exec(ad.note||'')||[])[1] ?? 0);
  const atcCount = Number(ad.atcLifetime ?? (/(\d+)\s*AddToCart/i.exec(ad.note||'')||[])[1] ?? 0);
  const winner = salesCount>0||/Purchase/i.test(ad.note||'')||/Purchase/i.test(ad.angle||'');
  const hot = !winner&&m.ctr>=3.5&&m.clicks>0;
  const bleeder = !winner&&m.spend>=0.25&&m.clicks===0;
  const cpc = m.clicks>0?m.spend/m.clicks:0;
  const cpa = salesCount>0&&m.spend>0?m.spend/salesCount:0;
  return <article className={`mv-cd-ad ${verdict==='approved'||winner?'is-kept':verdict==='cut'||bleeder?'is-cut':''}`}>
    <div className="mv-cd-ad-media">
      <span className="mv-mg-ad-tags">
        <b>#{rank}</b>
        {winner&&<em className="is-win"><Trophy size={11}/>{salesCount>0?`${salesCount} ${salesCount===1?'Sale':'Sales'}${cpa>0?` · ${money(cpa)} CPA`:''}`:'Made a sale'}</em>}
        {hot&&<em className="is-hot">🔥 {Number(m.ctr).toFixed(1)}% CTR</em>}
        {!winner&&atcCount>0&&<em className="is-hot">{atcCount} ATC</em>}
        {bleeder&&<em className="is-cut">0 Clicks · Cut</em>}
        {verdict==='approved'&&!winner&&<em className="is-win">Kept</em>}
        {verdict==='cut'&&<em className="is-cut">Cut</em>}
      </span>
      {isVideo
        ?<video src={assetUrl(ad.mediaPath)} controls preload="metadata" style={{objectFit:'contain'}}/>
        :<button type="button" onClick={()=>onInspect(ad)} title="See it full size"><img src={assetUrl(ad.mediaPath)} alt={ad.name} loading="lazy"/></button>}
    </div>
    <div className="mv-cd-ad-verdict">
      <button type="button" className={`mv-btn sm ${verdict==='approved'?'primary':''}`} onClick={()=>onVerdict(ad.id,verdict==='approved'?'':'approved')}><ThumbsUp size={13}/>Keep</button>
      <button type="button" className={`mv-btn sm ${verdict==='cut'?'danger':'ghost'}`} onClick={()=>onVerdict(ad.id,verdict==='cut'?'':'cut')}><ThumbsDown size={13}/>Cut</button>
    </div>
    <div className="mv-cd-ad-body">
      {ad.personaPage&&<small style={{display:'block',fontSize:11,fontWeight:600,color:'var(--accent)',marginBottom:2}}>👤 {ad.personaPage}</small>}
      <p className="mv-cd-ad-headline" title={ad.headline}>{ad.headline}</p>
      {ad.hook&&<p className="mv-small" style={{margin:'2px 0 6px',lineHeight:1.35,fontStyle:'italic'}}>“{ad.hook}”</p>}
      <div className="mv-cd-ad-stats">
        <span><small>Sales</small><b className={salesCount>0?'is-good':''}>{salesCount}{atcCount>0?` (${atcCount} ATC)`:''}</b></span>
        <span><small>CTR</small><b className={m.ctr>=3.5?'is-good':''}>{Number(m.ctr).toFixed(2)}%</b></span>
        <span><small>Clicks</small><b>{m.clicks}{m.clicks>0?` (${money(cpc)})`:''}</b></span>
        <span><small>Spend</small><b>{money(m.spend)}</b></span>
      </div>
      <Bar percent={(m.ctr/8)*100}/>
      <div className="mv-cd-ad-tools">
        <button type="button" className="mv-link" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>Details<ChevronDown size={12} style={open?{transform:'rotate(180deg)'}:undefined}/></button>
        <button type="button" className="mv-link" onClick={onHub} title="Edit it in the Assets & Creatives Hub"><ArrowUpRight size={12}/>Assets hub</button>
      </div>
      {open&&<div className="mv-cd-ad-copy">
        <span className="mv-mg-ad-facts">
          <span>{isVideo?<Play size={11}/>:<ImageIcon size={11}/>}{isVideo?'9:16 video':'4:5 image'}</span>
          <span>{ad.status}</span>
          <span>{whole(m.impressions)} shown</span>
          {totalSpend>0&&<span>{((m.spend/totalSpend)*100).toFixed(0)}% of spend</span>}
        </span>
        {showDays&&daily.length>1&&(ad.spendYesterday!==undefined||ad.spendDayToday!==undefined)&&<span className="mv-mg-ad-days">
          <span>{dayName(daily[0].label)}: <b>{money(ad.spendYesterday)}</b> · {ad.clicksYesterday||0} clicks</span>
          <span>{dayName(daily[1].label)}: <b>{money(ad.spendDayToday)}</b> · {ad.clicksDayToday||0} clicks</span>
        </span>}
        <code>{ad.name}</code>
        {ad.angle&&<b>{ad.angle}</b>}
        {ad.primaryText&&<p>{ad.primaryText}</p>}
        {ad.note&&<span>{ad.note}</span>}
      </div>}
    </div>
  </article>;
}

/** Each day as a card; tapping one shows that day everywhere on the page. */
export function DayCards({daily,lifetime,dateWindow,onPick}) {
  const rows = [
    {id:'lifetime',label:`All ${lifetime.productAgeDays} ${lifetime.productAgeDays===1?'day':'days'}`,spend:lifetime.spend,impressions:lifetime.impressions,clicks:lifetime.clicks,ctr:lifetime.ctr,cpc:lifetime.cpc,viewContent:lifetime.viewContent,addToCart:lifetime.addToCart,initiateCheckout:lifetime.initiateCheckout,purchases:lifetime.purchases,revenue:lifetime.revenue,cpa:lifetime.cpa,roas:lifetime.roas},
    ...daily.map(day=>({...day,id:day.date})),
  ];
  return <div className="mv-mg-days">{rows.map(row=><button key={row.id} type="button" className="mv-mg-day" aria-pressed={dateWindow===row.id} onClick={()=>onPick(row.id)}>
    <header><strong>{row.label}</strong><Chip tone={row.roas>=1.5?'done':row.roas>0?'active':'muted'}>{Number(row.roas||0).toFixed(2)}x</Chip></header>
    <b className="mv-mg-day-big">{money(row.spend)}</b><small className="mv-mg-day-sub">spent · {row.purchases} {row.purchases===1?'order':'orders'} · <span className={row.revenue>0?'is-good':''}>{money(row.revenue)}</span></small>
    <dl>
      <div><dt>Shown</dt><dd>{whole(row.impressions)}</dd></div>
      <div><dt>Clicks</dt><dd>{whole(row.clicks)}</dd></div>
      <div><dt>CTR</dt><dd>{pct(row.ctr)}</dd></div>
      <div><dt>CPC</dt><dd>{money(row.cpc)}</dd></div>
      <div><dt>Page views</dt><dd>{whole(row.viewContent||row.clicks)}</dd></div>
      <div><dt>Add to cart</dt><dd>{whole(row.addToCart)}</dd></div>
      <div><dt>Checkout</dt><dd>{whole(row.initiateCheckout)}</dd></div>
      <div><dt>Cost per sale</dt><dd>{row.purchases>0?money(row.cpa):'No sales'}</dd></div>
    </dl>
  </button>)}</div>;
}

/** The orders as cards, and the pricing under them. */
export function OrdersPanel({orders,total,pricing,storeUrl,go}) {
  return <div className="mv-pp-panel">
    <div className="mv-mg-orders">{orders.map((order,index)=><article key={order.id||index} className="mv-mg-order">
      <i>✓</i>
      <span><strong title={order.label}>{order.label}</strong><small title={order.detail}>{order.detail}</small></span>
      {order.isBundle&&<Chip tone="done">Bundle</Chip>}
    </article>)}</div>
    {!orders.length&&<p className="mv-small">No orders yet.</p>}
    <div className="mv-mg-pricing">
      <header><strong>Pricing</strong><Chip tone="done">{money(total)} total</Chip></header>
      <ReadMore text={pricing} lines={2}/>
      <div className="mv-pp-links">
        <button type="button" className="mv-pp-link" onClick={()=>go('store')}>Edit page and bundles</button>
        {storeUrl&&<a className="mv-pp-link" href={storeUrl} target="_blank" rel="noreferrer"><ArrowUpRight size={13}/>View live page</a>}
      </div>
    </div>
  </div>;
}

/** Ideas worked out from the numbers, to read. Telling an agent to do one happens in chat (owner, Nov 4). */
export function ImprovePanel({diagnostics,go}) {
  return <div className="mv-pp-panel">
    <div className="mv-mg-ideas">{diagnostics.map(idea=><article key={idea.id} className="mv-mg-idea">
      <header><small>{idea.area}</small><Chip tone={idea.tone}>{idea.metricBadge}</Chip></header>
      <strong>{idea.title}</strong>
      <ReadMore text={idea.detail} lines={2}/>
      {idea.hubTarget&&<div className="mv-mg-idea-actions">
        <button type="button" className="mv-btn sm ghost" onClick={()=>go(idea.hubTarget)}><ArrowUpRight size={13}/>{idea.hubLabel}</button>
      </div>}
    </article>)}</div>
  </div>;
}
