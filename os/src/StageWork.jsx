import React,{useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,Lock,Sparkles,Calculator,Store,Smartphone,ExternalLink,Check,Circle,FileText,Images,PenLine,Megaphone,LayoutTemplate,ShieldCheck,Mail,Bell,CreditCard,Users,Palette as PaletteIcon,Package,Target,Wallet,Radar,UserCheck,ClipboardList} from 'lucide-react';
import {unitEconomics} from './workflowView.mjs';
import {PRE_PRODUCT_LABEL,PRE_PRODUCT_NEXT,storePreflight} from './storeReadiness.mjs';
import {MediaPreview} from './ResourceLibrary.jsx';
import {StoreLaunch} from './StoreBuilder.jsx';
import {BuildPacket} from './BuildPacket.jsx';
import {playbookStep} from './playbook.mjs';
import {Ring,Chip,Meter,Sheet,LeadImage,assetUrl} from './kit.jsx';
import {lineLeadState} from './pipeline.mjs';
import {LearningBoard} from './LearningView.jsx';
import {StorePicturesPanel} from './AssetsView.jsx';
import {storePictures} from './assetsModel.mjs';
import {MetaAdBoard} from './MetaAdBoard.jsx';
// Merrivy's store previews ship inside the build (/assets/); other projects show no store until they have one.
import storeProduct from './media/store-product.webp';
import storeMobile from './media/store-mobile.webp';

function DocCards({items,data,openDoc}) {
  const known = new Set(data.documents.map(item=>item.path));
  return <div className="mv-doc-cards">{items.filter(([path])=>known.has(path.split('#')[0])).map(([path,title,text,Icon,tone])=><button key={path} className="mv-doc-card" onClick={()=>openDoc(path)}>
    <span className="mv-tile-icon" style={tone?{background:tone[0],color:tone[1]}:undefined}><Icon size={19}/></span>
    <strong>{title}</strong><p>{text}</p><small>{path.split('#')[0].split('/').pop()}</small>
  </button>)}</div>;
}

/* ---------- 2. Validate ---------- */
export function ValidateWork({research,leads,data,openDoc}) {
  const summary = research?.summary||{};
  // A saved card an agent parked is out of the line (lineLeadState), so it does not count as saved here.
  const saved = leads.filter(lead=>['saved','ready','reviewed'].includes(lineLeadState(lead)));
  const rows = [
    ['Products screened',summary.screened??leads.length],
    ['Saved in your eye test',saved.length,true],
    ['Find checks + source & profit passed',summary.readyForVerification||0],
    ['Complete reviews',summary.reviewed||0],
    ['Supported on every gate',summary.eligible||0],
  ];
  const max = Math.max(1,rows[0][1]);
  const reviewed = summary.reviewed||0;
  return <div className="mv-stack">
    <div className="mv-grid-2">
      <section className="mv-card mv-pad">
        <div className="mv-panel-title"><h2 className="mv-h2">From many products to one</h2><span className="mv-small">Live from the research record</span></div>
        <div className="mv-funnel">{rows.map(([label,value,owner])=><div key={label} className={`mv-funnel-row ${owner?'is-owner':''}`}><span>{label}</span><div className="mv-funnel-bar"><i style={{width:`${value/max*100}%`}}/></div><b>{value}</b></div>)}</div>
        <p className="mv-small" style={{marginTop:12}}>Most products stop early on purpose: cheap, generic, declining or crowded offers are parked before deep research.</p>
      </section>
      <section className="mv-card mv-pad">
        <div className="mv-panel-title"><h2 className="mv-h2">Reviews before we choose</h2><Chip tone={reviewed>=5?'done':'muted'}>{reviewed}/5 minimum</Chip></div>
        <div className="mv-slots">{Array.from({length:10},(_,i)=><span key={i} className={`mv-slot ${i<5?'is-min':''} ${i<reviewed?'is-filled':''}`}>{i<reviewed?<Check size={16}/>:i+1}</span>)}</div>
        <p className="mv-small" style={{marginTop:12}}>We compare at least five fully reviewed products (aiming for ten) before picking one to build. {summary.canCompare?'The comparison is ready for your choice.':`${summary.remaining??5} more complete reviews needed.`}</p>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}><button className="mv-link" onClick={()=>openDoc('research/COMPARISON.md')}>Comparison record<ArrowUpRight size={13}/></button><button className="mv-link" onClick={()=>openDoc('workflow/PRE-VERIFICATION-SCREEN.md')}>The seven checks<ArrowUpRight size={13}/></button></div>
      </section>
    </div>
    <DocCards data={data} openDoc={openDoc} items={[
      ['workflow/AVATAR-ANGLE-RESEARCH.md','Avatar-angle method','Find a specific underserved buyer inside an established category.',Target],
      ['workflow/CHECKS.md','What we check','The five Find checks, then source and profit after your Save.',ShieldCheck],
      [playbookStep(1),'Playbook step 2','Demand, community and the destination opening.',BookOpen],
    ]}/>
  </div>;
}

/* ---------- 3. Source & price ---------- */
const LAB_FIELDS = [
  ['price','Selling price',1,150,0.5,'$'],['itemCost','Product cost',0,80,0.5,'$'],['shipping','Shipping to customer',0,40,0.5,'$'],
  ['feePercent','Payment fees',0,10,0.1,'%'],['returnPercent','Refund & return reserve',0,25,0.5,'%'],['adCost','Ad cost per order',0,80,0.5,'$'],
];
export function ProfitLab({research}) {
  const [v,setV] = useState({price:49.99,itemCost:12,shipping:7,feePercent:2.9,feeFixed:0.3,returnPercent:5,adCost:18});
  const saved = (research?.candidates||[]).filter(c=>c.screen?.checks?.contribution?.costs);
  const r = unitEconomics(v);
  const money = n => `${n<0?'−':''}$${Math.abs(n).toFixed(2)}`;
  const scale = x => `${Math.max(0,Math.min(100,x/Math.max(1,r.price)*100))}%`;
  let remaining = r.price;
  const deduct = [['Product cost',r.itemCost],['Shipping',r.shipping],['Payment fees',r.fees],['Return reserve',r.returns],['Ad cost',r.adCost,'ad']].map(([label,amount,kind])=>{const row={label,amount,kind,left:remaining-amount};remaining-=amount;return row;});
  function load(id){const c=saved.find(item=>item.id===id)?.screen.checks.contribution.costs;if(!c)return;const pct=(a)=>c.sellPrice?a/c.sellPrice*100:0;setV({price:c.sellPrice,itemCost:c.itemCost,shipping:c.shippingCost,feePercent:+pct(c.fees).toFixed(2),feeFixed:0,returnPercent:+pct(c.returnReserve).toFixed(2),adCost:c.acquisitionAllowance});}
  return <section className="mv-card mv-pad">
    <div className="mv-panel-title"><h2 className="mv-h2"><Calculator size={17}/>Profit per order</h2>
      {saved.length>0?<select className="mv-input" style={{width:'auto',height:32}} defaultValue="" onChange={event=>load(event.target.value)}><option value="" disabled>Load a saved preflight…</option>{saved.map(c=><option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}</select>:<span className="mv-small">Try numbers · nothing is saved</span>}
    </div>
    <div className="mv-lab">
      <div className="mv-lab-inputs">{LAB_FIELDS.map(([key,label,min,max,step,unit])=><label key={key} className="mv-slider">
        <span className="mv-slider-head">{label} ({unit})<input type="number" min={min} step={step} value={v[key]} onChange={event=>setV({...v,[key]:event.target.value===''?'':Number(event.target.value)})} aria-label={`${label} ${unit}`}/></span>
        <input type="range" min={min} max={max} step={step} value={Number(v[key])||0} onChange={event=>setV({...v,[key]:Number(event.target.value)})} aria-label={label}/>
      </label>)}<p className="mv-small">Payment fees include a fixed ${v.feeFixed.toFixed(2)} per order. Use one currency throughout.</p></div>
      <div>
        <div className="mv-waterfall" aria-label="Where each order's money goes">
          <div className="mv-wf-row is-price"><span>Customer pays</span><div className="mv-wf-track"><i style={{left:0,width:'100%'}}/></div><b>{money(r.price)}</b></div>
          {deduct.map(row=><div key={row.label} className={`mv-wf-row ${row.kind==='ad'?'is-ad':'is-cost'}`}><span>{row.label}</span><div className="mv-wf-track"><i style={{left:scale(row.left),width:scale(row.amount)}}/></div><b>−{money(row.amount).replace('−','')}</b></div>)}
          <div className={`mv-wf-row ${r.profit>=0?'is-profit':'is-loss'}`}><span><strong>{r.profit>=0?'You keep':'You lose'}</strong></span><div className="mv-wf-track"><i style={{left:0,width:scale(Math.abs(r.profit))}}/></div><b style={{color:r.profit>=0?'var(--success)':'var(--danger)'}}>{money(r.profit)}</b></div>
        </div>
        <div className="mv-lab-result">
          <div className={`mv-stat ${r.profit>=0?'is-good':'is-bad'}`}><b>{(r.margin*100).toFixed(0)}%</b><small>profit margin after ads</small></div>
          <div className="mv-stat"><b>{money(r.breakEvenAdCost)}</b><small>most you can pay per sale in ads</small></div>
          <div className="mv-stat"><b>{r.breakEvenRoas?`${r.breakEvenRoas.toFixed(2)}×`:'—'}</b><small>break-even ROAS</small></div>
        </div>
      </div>
    </div>
    <p className="mv-small" style={{marginTop:14}}>A thinking tool. A product's official margin check needs a real supplier quote, destination shipping and a recorded source in its source and profit checks.</p>
  </section>;
}

export function SourceWork(props) {
  const {research,leads,go,data,openDoc} = props;
  const saved = leads.filter(lead=>['saved','ready','reviewed'].includes(lineLeadState(lead)));
  const status = (lead,id) => lead.candidate?.screen?.checks?.[id]?.status||'pending';
  return <div className="mv-stack">
    <ProfitLab research={research}/>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2"><Package size={17}/>Supplier and margin preflight on saved cards</h2><span className="mv-small">After the owner's Save, before deep checks</span></div>
      {!saved.length?<div className="mv-lock-note"><Lock size={16}/><span>Sourcing starts after you save a product in the eye test. Research then finds the exact item, a quantity-one supplier listing and delivery to your country.</span></div>
      :<div className="mv-checks">{saved.map(lead=><button key={lead.id} className="mv-check" onClick={()=>go(`product/${lead.id}`)}>
        <span style={{width:28}}><LeadImage lead={lead} size={28}/></span>
        <span><strong>{lead.name}</strong><p>{lead.id}</p></span>
        <span style={{display:'flex',gap:6}}>{['sourceMatch','contribution'].map(id=><Chip key={id} tone={status(lead,id)==='supported'?'done':status(lead,id)==='failed'?'bad':'muted'}>{id==='sourceMatch'?'Exact source':'Margin'}: {status(lead,id)}</Chip>)}</span>
      </button>)}</div>}
    </section>
    <DocCards data={data} openDoc={openDoc} items={[
      [playbookStep(2),'Sourcing & economics method','Exact variant, safety, delivery route and delivered contribution.',BookOpen],
      ['workflow/PRE-VERIFICATION-SCREEN.md','Source & margin preflight','What counts as an exact quantity-one source and a conservative margin.',ShieldCheck],
    ]}/>
  </div>;
}

/* ---------- 4. Create ---------- */
export function CreateWork(props) {
  const {hub,data,openDoc,notify,scope,openLibrary} = props;
  const [preview,setPreview] = useState(null);
  const production = (hub.assets||[]).filter(item=>item.kind!=='video');
  const needs = storePictures(props.assetMap)?.needs.length||0;
  const references = useMemo(()=>(hub.resourceMedia||[]).filter(item=>item.kind==='image').sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt))).slice(0,11),[hub.resourceMedia]);
  return <div className="mv-stack">
    <MetaAdBoard hub={hub} defaultProductId={scope?.product?.id}/>
    {scope.product&&scope.market?<section className="mv-card mv-pad mv-legacy"><BuildPacket product={scope.product} market={scope.market} notify={notify} openDoc={openDoc}/></section>
    :<div className="mv-lock-note"><Lock size={16}/><span>The build packet (buyer, offer, copy, ad concepts and image plan) opens for the product in the build slot. Nothing is building yet: you pick one with “Build this one” once its Source is done. Meanwhile, study the references and keep the copy formula ready.</span></div>}
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2"><Images size={17}/>Production files</h2><span className="mv-as-panel-links">{needs>0&&<button className="mv-bare" onClick={()=>props.go('assets?sort=needs')}><Chip tone="warn">{needs} empty {needs===1?'slot':'slots'} on the store page</Chip></button>}<button className="mv-link" onClick={()=>props.go('assets')}>Assets<ArrowUpRight size={13}/></button></span></div>
      {production.length?<div className="mv-gallery">{production.map(item=><button key={item.path} onClick={()=>setPreview(item)}><img className={/wordmark|logo|favicon/i.test(item.name)?'is-contain':''} src={assetUrl(item.path)} alt={item.name} loading="lazy"/><span>{item.name.replace(/\.[^.]+$/,'').replaceAll('-',' ')}</span></button>)}</div>:<div className="mv-empty"><strong>No production files yet.</strong></div>}
    </section>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Visual references</h2><button className="mv-link" onClick={()=>openLibrary('guides')}>All {(hub.resourceMedia||[]).length} references<ArrowUpRight size={13}/></button></div>
      <div className="mv-mosaic">{references.map(item=><button key={item.path} onClick={()=>setPreview(item)} title={item.name}><img src={assetUrl(item.path)} alt={item.name} loading="lazy"/></button>)}</div>
      <p className="mv-small" style={{marginTop:10}}>References inform the work. They are not our product photos and their claims are not our facts.</p>
    </section>
    <DocCards data={data} openDoc={openDoc} items={[
      ['templates/PRODUCT-PAGE-COPY.md','Product page copy formula','One buyer moment, 16 slots, claims only from real data.',PenLine,['var(--highlight-soft)','var(--highlight-text)']],
      ['templates/COPY-BRIEF.md','Copy brief','From buyer evidence to a first draft.',ClipboardList],
      ['resources/copywriting/native-ads/VISUAL-BOARD.md','Native image ad lab','Study real ad examples and what changes.',Megaphone,['var(--special-soft)','var(--special)']],
      ['workflow/ATLAS-HANDOFF.md','Build packet procedure','Inputs the builder needs before assets and pages.',LayoutTemplate],
      ['resources/STORE-BUILDING-REFERENCES.md','Store & image references','Layouts and image batches to reproduce.',PaletteIcon],
    ]}/>
    <button className="mv-btn" style={{justifySelf:'start'}} onClick={()=>openLibrary('learn')}><Sparkles size={15}/>Open the visual lessons</button>
    {preview&&<div className="mv-legacy"><MediaPreview item={preview} onClose={()=>setPreview(null)} notify={notify} openDoc={openDoc}/></div>}
  </div>;
}

/* ---------- 5. Build ---------- */
const TILE_ICONS = {D02:PaletteIcon,D03:Store,D06:ShieldCheck,E04:Mail,E07:Bell,E06:UserCheck,C05:CreditCard,E08:Users};
export function BuildWork(props) {
  const {data,planner,openDoc,go,isMerrivy=true} = props;
  const [open,setOpen] = useState(null),[full,setFull] = useState(false);
  const groups = data.storeChecklist.groups;
  const pre = storePreflight(groups);
  const release = (planner?.tasks||[]).find(task=>/approve release/i.test(task.title)&&task.status!=='done');
  return <div className="mv-stack">
    {isMerrivy?<section className="mv-card mv-pad mv-site-card">
      <div className="mv-shots">
        <div className="mv-browser"><div className="mv-browser-bar"><i/><i/><i/><span>Product page · local build · Sep 30</span></div><img src={storeProduct} alt="Merrivy product page, local build"/></div>
        <div className="mv-phone"><img src={storeMobile} alt="Merrivy product page on a phone"/></div>
      </div>
      <div style={{display:'grid',gap:12}}>
        <span className="mv-eyebrow">The storefront</span>
        <h2 className="mv-h2" style={{fontSize:22}}>Merrivy on Shopify Hydrogen</h2>
        <p className="mv-sub">A single-product store built around one great product page. It runs locally with a fictional demo hoodie until a real product is chosen.</p>
        <div className="mv-hello-chips">{release?<button className="mv-bare" onClick={()=>go(`today?task=${release.id}`)}><Chip tone="owner">Waiting for your release approval</Chip></button>:<Chip tone="done">No release waiting</Chip>}<Chip tone="muted">Demo product · no real checkout</Chip></div>
        <div className="mv-page-actions">
          <a className="mv-btn primary" href="http://localhost:3001/products/hoodie" target="_blank" rel="noreferrer"><Smartphone size={15}/>Open local site</a>
          <a className="mv-btn" href="https://merrivy.com" target="_blank" rel="noreferrer"><ExternalLink size={15}/>merrivy.com</a>
          <button className="mv-btn ghost" onClick={()=>openDoc('store/2026-09-30-PRODUCT-PAGE-REBUILD.md')}><FileText size={15}/>Build report</button>
        </div>
        <p className="mv-small">Screens captured Sep 30 from the local build. The local site needs its dev server running.</p>
      </div>
    </section>:<section className="mv-card mv-pad"><div className="mv-empty"><Store size={26}/><strong>No store is connected to this project.</strong><span className="mv-small">When a product reaches Build, its store and launch checks show here.</span></div></section>}
    <StorePicturesPanel assetMap={props.assetMap} go={go}/>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Launch readiness</h2><span className="mv-small">{data.storeChecklist.done}/{data.storeChecklist.total} reviewed · click a group</span></div>
      <div className="mv-rings">{groups.map((group,i)=>{const done=group.items.filter(item=>item.done).length;const title=group.title.replace(/^\d+\.\s*/,'').replace(/ — .*/,'');return <React.Fragment key={group.title}>
        <button className="mv-ring-card" aria-expanded={open===i} onClick={()=>setOpen(open===i?null:i)}><Ring value={done} total={group.items.length} size={54} stroke={6} label={`${done}/${group.items.length}`} color={done===group.items.length?'var(--success)':'var(--accent-text)'}/><span><strong>{title}</strong><small>{done===group.items.length?'All reviewed':`${group.items.length-done} open`}</small></span></button>
        {open===i&&<div className="mv-group-items">{group.items.map(item=><div key={item.id} className={`mv-group-item ${item.done?'is-done':''}`}>{item.done?<Check size={16} color="var(--success)"/>:<Circle size={14} color="var(--faint)"/>}<code>{item.id}</code><span>{item.title}</span></div>)}<button className="mv-link" style={{marginTop:6}} onClick={()=>setFull(true)}>Review items with evidence<ArrowUpRight size={13}/></button></div>}
      </React.Fragment>;})}</div>
    </section>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Can be done before a product</h2><button className="mv-link" onClick={()=>setFull(true)}>Full checklist<ArrowUpRight size={13}/></button></div>
      <div className="mv-tiles">
        {pre.now.map(item=>{const Icon=TILE_ICONS[item.id]||ClipboardList;return <div key={item.id} className="mv-tile"><span className="mv-tile-icon"><Icon size={17}/></span><strong>{PRE_PRODUCT_LABEL[item.id]||item.title}</strong><p>{PRE_PRODUCT_NEXT[item.id]||item.title}</p><Chip tone="muted">{item.id}</Chip></div>;})}
        {pre.owner.map(item=><div key={item.id} className="mv-tile is-owner"><span className="mv-tile-icon"><UserCheck size={17}/></span><strong>Needs you</strong><p>{item.title}</p><Chip tone="owner">{item.id}</Chip></div>)}
      </div>
    </section>
    {full&&<Sheet wide title="Store launch checklist" subtitle="Review items with their source and date." onClose={()=>setFull(false)}><div className="mv-legacy"><StoreLaunch {...props}/></div></Sheet>}
  </div>;
}

/* ---------- 6. Launch & learn ---------- */
export function LaunchWork(props) {
  const {data,hub,scope,flow,openDoc} = props;
  const groups = data.storeChecklist.groups;
  const tracking = groups.find(group=>/meta|measurement/i.test(group.title));
  const trackingDone = tracking?tracking.items.filter(item=>item.done).length:0;
  const gates = [
    [Target,'A verified product',scope.product?`${scope.product.name} · ${flow.verified}/${flow.total} checks`:'No product is building yet',Boolean(scope.product&&flow.currentIndex>=5)],
    [Store,'Store ready to sell',`${data.storeChecklist.done}/${data.storeChecklist.total} launch items reviewed`,data.storeChecklist.done===data.storeChecklist.total],
    [Radar,'Tracking works',tracking?`${trackingDone}/${tracking.items.length} measurement items`:'Measurement checklist missing',tracking&&trackingDone===tracking.items.length],
    [Wallet,'Budget & your go-ahead','Ad spend always needs your explicit approval and a loss limit',false],
  ];
  const reviews = data.workspace?.reviews||[];
  return <div className="mv-stack">
    <MetaAdBoard hub={hub} defaultProductId={scope?.product?.id}/>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Before any ad test</h2><span className="mv-small">All four must be true</span></div>
      <div className="mv-gatelist">{gates.map(([Icon,title,text,ok])=><div key={title} className={ok?'':'is-open'}><span className="mv-tile-icon" style={ok?{background:'var(--success-soft)',color:'var(--success)'}:undefined}>{ok?<Check size={17}/>:<Icon size={17}/>}</span><strong>{title}</strong><p>{text}</p><Chip tone={ok?'done':'muted'}>{ok?'Ready':'Not yet'}</Chip></div>)}</div>
    </section>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Lessons from every cycle</h2><button className="mv-link" onClick={()=>props.go('learning')}>Learning log<ArrowUpRight size={13}/></button></div>
      <LearningBoard data={data} notify={props.notify} compact/>
    </section>
    <section className="mv-card mv-pad">
      <div className="mv-panel-title"><h2 className="mv-h2">Past cycles</h2></div>
      {reviews.length?<div className="mv-checks">{reviews.map(review=><div key={review.id} className="mv-check"><span className="mv-check-box" style={{background:'var(--bg-2)',borderColor:'var(--line-2)'}}/><span><strong>{review.productName}</strong><p><b>Worked:</b> {review.whatWorked}</p><p><b>Failed:</b> {review.whatFailed}</p></span><Chip tone={review.outcome==='winner'?'done':'muted'}>{review.outcome}</Chip></div>)}</div>:<div className="mv-empty"><strong>No cycle reviewed yet.</strong></div>}
      <button className="mv-link" style={{marginTop:12}} onClick={()=>openDoc(playbookStep(5))}>How tests and reviews work<ArrowUpRight size={13}/></button>
    </section>
  </div>;
}
