import {projectAsset} from './projectScope.mjs';
import React,{useEffect,useRef} from 'react';
import {X,Compass,TrendingUp,PackageSearch,Palette,Store,Rocket,Bot,Search as SearchIcon,Images,Hammer,User,ShieldCheck,MessagesSquare,PenLine,Image as ImageIcon,Wrench,MessageSquareQuote,GraduationCap} from 'lucide-react';
import {STEP_SLUGS,OLD_SLUGS,LEGACY_STEPS} from './steps.mjs';

// The seven steps (src/steps.mjs, owner Oct 2; Product first, then Buyers). Old six-step ids still find an
// icon, so a task tagged before Oct 2 renders until its tag is updated.
const STEP_ICONS = {product:Compass,buyers:MessageSquareQuote,prove:ShieldCheck,create:Palette,build:Store,launch:Rocket,learn:GraduationCap};
export const STAGE_ICONS = {...STEP_ICONS,...Object.fromEntries(Object.entries(LEGACY_STEPS).map(([old,id])=>[old,STEP_ICONS[id]]))};
export const STAGE_SLUGS = STEP_SLUGS;
/** Page address → step id; #/validate and #/source (merged into Prove it) are listed in OLD_SLUGS and redirect. */
export const SLUG_STAGES = Object.fromEntries(Object.entries(STAGE_SLUGS).map(([id,slug])=>[slug,id]));
export const OLD_STEP_SLUGS = OLD_SLUGS;

export const ROLES = {
  manager:{name:'Manager',short:'MG',color:'var(--role-manager)',icon:Bot,blurb:'Coordinates, verifies and keeps the records honest.'},
  validation:{name:'Research',short:'RS',color:'var(--role-research)',icon:SearchIcon,blurb:'Finds products, checks demand, buyers and sources.'},
  'image-generator':{name:'Creative studio',short:'CS',color:'var(--role-creative)',icon:Images,blurb:'Copy, product images, ad statics and asset manifests.'},
  'shopify-builder':{name:'Store builder',short:'SB',color:'var(--role-store)',icon:Hammer,blurb:'Builds and verifies the storefront.'},
  owner:{name:'You',short:'You',color:'var(--role-owner)',icon:User,blurb:'Direction, eye test and approvals.'},
};
export const roleOf = id => ROLES[id] || {name:id||'Agent',short:(id||'AG').slice(0,2).toUpperCase(),color:'var(--role-other)',icon:Bot};

// Team agents (agents/team.json) wear their department's colour and their own icon.
export const AGENT_ICONS = {compass:Compass,shield:ShieldCheck,messages:MessagesSquare,pen:PenLine,image:ImageIcon,store:Store,wrench:Wrench};
export const agentOf = (team,id) => team?.agents?.find(agent=>agent.id===id)||null;
export function AgentAvatar({agent,size=30,title}) {
  if (!agent) return <Avatar role="manager" size={size} title={title}/>;
  const Icon = AGENT_ICONS[agent.icon]||roleOf(agent.role).icon||Bot;
  return <span className="mv-avatar" title={title||agent.name} style={{width:size,height:size,background:roleOf(agent.role).color}}><Icon size={Math.max(9,Math.round(size*.5))} strokeWidth={2.2}/></span>;
}

export function Avatar({role,size=30,title}) {
  const r = roleOf(role), Icon = r.icon;
  return <span className="mv-avatar" title={title||r.name} style={{width:size,height:size,background:r.color}}>{Icon?<Icon size={Math.max(9,Math.round(size*.5))} strokeWidth={2.2}/>:r.short}</span>;
}

export function Ring({value=0,total=1,size=64,stroke=7,color='var(--success)',track='var(--bg-2)',label,sub,ink='var(--text)'}) {
  const radius = (size-stroke)/2, circumference = 2*Math.PI*radius;
  const ratio = total>0?Math.min(1,Math.max(0,value/total)):0;
  return <svg className="mv-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${total}${sub?` ${sub}`:''}`}>
    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={track} strokeWidth={stroke}/>
    {ratio>0&&<circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${circumference*ratio} ${circumference}`} transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:'stroke-dasharray .8s cubic-bezier(.2,.8,.2,1)'}}/>}
    <text x="50%" y={sub?'47%':'52%'} textAnchor="middle" dominantBaseline="middle" fontSize={size*.24} fontWeight="600" fill={ink}>{label??`${Math.round(ratio*100)}%`}</text>
    {sub&&<text x="50%" y="68%" textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(8,size*.12)} fill="var(--muted)" fontFamily="DM Sans, sans-serif">{sub}</text>}
  </svg>;
}

export function Meter({value=0,total=1,color}) {
  const pct = total>0?Math.min(100,value/total*100):0;
  return <div className="mv-meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={total}><span style={{width:`${pct}%`,...(color?{background:color}:{})}}/></div>;
}

export function Chip({tone='',icon:Icon,children,title}) {
  return <span className={`mv-chip ${tone?`is-${tone}`:''}`} title={title}>{Icon&&<Icon size={12}/>}{children}</span>;
}

// Right-hand drawer on a native dialog: focus trapping and Escape come free.
export function Sheet({title,subtitle,onClose,children,wide=false,actions}) {
  const ref = useRef(null);
  useEffect(()=>{const el=ref.current;el.showModal();return()=>el.close();},[]);
  return <dialog ref={ref} className={`mv-sheet ${wide?'is-wide':''}`} onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}}>
    <div className="mv-sheet-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{actions}<button className="mv-icon-btn" aria-label="Close" onClick={onClose}><X size={18}/></button></div>
    <div className="mv-sheet-body">{children}</div>
  </dialog>;
}

export const assetUrl = path => projectAsset(path);

export function LeadImage({lead,size}) {
  if (lead.image) return <img src={assetUrl(lead.image)} alt={lead.imageAlt||lead.name} loading="lazy" style={size?{width:size,height:size,objectFit:'cover',borderRadius:Math.round(size/5)}:undefined}/>;
  return <span className="mv-lead-ph" style={size?{width:size,height:size}:undefined}>{lead.id}{!size&&<small>No saved image</small>}</span>;
}

export function timeAgo(value, now = Date.now()) {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.round((now-then)/60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes/60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours/24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'});
}

export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const fileName = path => String(path).split('#')[0].split('/').pop();
export const isImagePath = path => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);
export const isVideoPath = path => /\.(mp4|webm|mov)$/i.test(path);
export const leadVideos = lead => [...new Set((lead?.candidate?.references||lead?.references||[]).filter(isVideoPath))];
// research/ is not served as media (server/hub.mjs), and its frames repeat the ones in resources/.
export const leadPhotos = lead => [...new Set([lead?.image,...((lead?.candidate?.references||lead?.references||[]).filter(isImagePath))].filter(path=>path&&!path.startsWith('research/')))];

export function LeadMediaShowcase({lead}) {
  const videos = leadVideos(lead);
  const photos = leadPhotos(lead);
  const [tab,setTab] = React.useState(videos.length>0?'video':'photo');
  const [vIdx,setVIdx] = React.useState(0);
  const [pIdx,setPIdx] = React.useState(0);
  useEffect(()=>{
    setTab(videos.length>0?'video':'photo');
    setVIdx(0);
    setPIdx(0);
  },[lead?.id,videos.length]);

  const activeVideo = videos[vIdx]||videos[0]||null;
  const activePhoto = photos[pIdx]||photos[0]||lead?.image||null;

  return <div className="mv-lead-showcase-full" style={{display:'grid',gridTemplateColumns:videos.length>0&&photos.length>0?'minmax(240px, 320px) 1fr':'1fr',gap:16,marginBottom:16,padding:14,borderRadius:14,background:'var(--surface-2)',border:'1px solid var(--line)'}}>
    {videos.length>0&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <strong style={{fontSize:12.5,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--text-2)'}}>🎬 TikTok Video ({vIdx+1}/{videos.length})</strong>
        {videos.length>1&&<div style={{display:'flex',gap:4}}>
          {videos.map((v,i)=><button key={v} type="button" onClick={()=>setVIdx(i)} style={{padding:'3px 8px',fontSize:11.5,fontWeight:600,borderRadius:99,border:'1px solid var(--line-2)',background:i===vIdx?'var(--accent)':'var(--surface)',color:i===vIdx?'var(--on-accent)':'var(--text-2)',cursor:'pointer'}}>Clip {i+1}</button>)}
        </div>}
      </div>
      <video
        key={activeVideo}
        src={assetUrl(activeVideo)}
        poster={activePhoto?assetUrl(activePhoto):undefined}
        controls
        playsInline
        preload="metadata"
        style={{width:'100%',maxHeight:420,borderRadius:10,background:'var(--media-scrim)',objectFit:'contain',display:'block'}}
      />
      <small style={{fontSize:11.5,color:'var(--muted)',wordBreak:'break-all'}}>{fileName(activeVideo)}</small>
    </div>}
    {photos.length>0&&<div style={{display:'flex',flexDirection:'column',gap:8}}>
      <strong style={{fontSize:12.5,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--text-2)'}}>📷 Product Photos ({pIdx+1}/{photos.length})</strong>
      <div style={{borderRadius:10,overflow:'hidden',background:'var(--surface)',border:'1px solid var(--line)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:220,maxHeight:340}}>
        <img src={assetUrl(activePhoto)} alt={lead?.name||lead?.id} style={{maxWidth:'100%',maxHeight:340,objectFit:'contain',display:'block'}}/>
      </div>
      {photos.length>1&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {photos.map((p,i)=><button key={p} type="button" onClick={()=>setPIdx(i)} style={{width:56,height:56,padding:0,borderRadius:8,overflow:'hidden',border:i===pIdx?'2.5px solid var(--accent)':'1px solid var(--line-2)',cursor:'pointer',background:'var(--surface)'}}>
          <img src={assetUrl(p)} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
        </button>)}
      </div>}
    </div>}
  </div>;
}

export function FourGateSnapshot({candidate,compact=false}) {
  const checks = candidate?.screen?.checks||{};
  const demand = checks.provenDemand?.note||'';
  const margin = checks.unitEconomics?.note||checks.dropshippable?.note||'';
  const meta = checks.angleWhitespace?.note||checks.metaGap?.note||checks.audienceRoom?.note||'';
  if (!demand&&!margin&&!meta) return null;
  const trim = (s,n) => s.length>n?s.slice(0,n).trim()+'…':s;
  return <div className="mv-4gate-snap" style={{display:'grid',gap:6,padding:compact?'8px 10px':'10px 12px',margin:compact?'8px 0':'0 0 14px',borderRadius:10,background:'var(--surface-2)',border:'1px solid var(--line)',fontSize:compact?11.5:12.5,lineHeight:1.4}}>
    {demand&&<div><strong style={{color:'var(--accent-text)'}}>📈 Demand: </strong><span>{compact?trim(demand,115):demand}</span></div>}
    {margin&&<div><strong style={{color:'var(--success-text)'}}>💰 Landed Margin: </strong><span>{compact?trim(margin,115):margin}</span></div>}
    {meta&&<div><strong style={{color:'var(--info-text)'}}>🎯 Meta & Angle: </strong><span>{compact?trim(meta,115):meta}</span></div>}
  </div>;
}

export function AgentPacketBar({lead,evidencePath,openDoc}) {
  const [copied,setCopied] = React.useState('');
  if (!lead) return null;
  const videos = leadVideos(lead);
  const photos = leadPhotos(lead);
  const copyText = (txt,label) => {
    try {navigator.clipboard.writeText(txt);setCopied(label);setTimeout(()=>setCopied(''),2000);} catch {}
  };
  return <div className="mv-agent-packet" style={{display:'grid',gap:8,padding:'12px 14px',marginBottom:16,borderRadius:12,background:'var(--surface)',border:'1px solid var(--line-2)'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
      <strong style={{fontSize:12.5,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--text-2)'}}>⚡ Quick Files & Agent Handoff ({lead.id})</strong>
      {copied&&<Chip tone="done">Copied {copied}</Chip>}
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      {evidencePath&&openDoc&&<button type="button" className="mv-btn sm" onClick={()=>openDoc(evidencePath)}>📄 Open {fileName(evidencePath)}</button>}
      {lead.externalUrl&&<a className="mv-btn sm" href={lead.externalUrl} target="_blank" rel="noreferrer">🔗 Original Listing ↗</a>}
      {videos.map((v,i)=><button key={v} type="button" className="mv-btn sm ghost" onClick={()=>copyText(v,`MP4 #${i+1} path`)} title={`Click to copy path: ${v}`}>📋 Copy MP4 #{i+1} path ({fileName(v)})</button>)}
      {photos.length>0&&<button type="button" className="mv-btn sm ghost" onClick={()=>copyText(photos.join('\n'),`${photos.length} photo paths`)} title={photos.join('\n')}>📋 Copy {photos.length} Photo paths</button>}
    </div>
  </div>;
}
