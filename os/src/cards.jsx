import React,{useEffect,useId,useRef,useState} from 'react';
import {ChevronDown,ChevronLeft,ChevronRight,Play} from 'lucide-react';
import {assetUrl} from './kit.jsx';
import {sparkPoints} from './statsPanel.mjs';
import {DISPLAY_LINE} from './displayLine.mjs';
import './cards.css';

// The card kit (owner, Nov 4: "Instead of just having text everywhere, make it more
// interactive and have a lot more cards. It's tiring sometimes to just read a bunch of
// text on the screen."). Numbers count up, products show their picture and play their
// video on hover, and long text stays one tap away. Classes start with mv-cd-; colours
// come only from tokens.css.

const calm = () => {try {return window.matchMedia('(prefers-reduced-motion: reduce)').matches;} catch {return true;}};

const wholeNumber = value => String(Math.round(value));

/** A number that counts up to its value (only when the value changes), then stays put through the polling. */
export function CountUp({value,format=wholeNumber,duration=850}) {
  const [shown,setShown] = useState(()=>calm()?value:0);
  const from = useRef(calm()?value:0);
  useEffect(()=>{
    if (!Number.isFinite(value)) return undefined;
    if (calm()||from.current===value) {from.current = value;setShown(value);return undefined;}
    const begin = from.current;
    let frame = 0, start = null;
    const tick = now => {
      if (start===null) start = now;
      const t = Math.min(1,(now-start)/duration);
      setShown(begin+(value-begin)*(1-Math.pow(1-t,3)));
      if (t<1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // A hidden tab never runs animation frames: the real number still lands on time.
    const landing = setTimeout(()=>{cancelAnimationFrame(frame);setShown(value);},duration+80);
    from.current = value;
    return ()=>{cancelAnimationFrame(frame);clearTimeout(landing);};
  },[value,duration]);
  if (!Number.isFinite(value)) return <span className="mv-cd-num">—</span>;
  return <span className="mv-cd-num" aria-label={format(value)}><span aria-hidden="true">{format(shown)}</span></span>;
}

/** A trend line with a soft area under it, drawn in when the card appears. */
export function Spark({points=[],tone='up',width=220,height=52,label}) {
  const raw = useId();
  const id = `mv-cd-spark-${raw.replace(/[^a-zA-Z0-9]/g,'')}`;
  const scaled = sparkPoints(points,width,height,4);
  if (scaled.length<2) return null;
  const line = scaled.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ');
  const area = `${line} L${scaled.at(-1).x} ${height} L${scaled[0].x} ${height} Z`;
  const last = scaled.at(-1);
  return <svg className={`mv-cd-spark is-${tone}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label||`Trend from ${points[0].value} to ${points.at(-1).value}`}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".3"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
    <path d={area} fill={`url(#${id})`}/>
    <path d={line} pathLength="1" className="mv-cd-spark-line"/>
    <circle cx={last.x} cy={last.y} r="3.5" className="mv-cd-spark-dot"/>
  </svg>;
}

/** A big-number tile. `tile` picks its pastel (1-6); with onClick it is a button. */
export function Stat({label,value,format,icon:Icon,tile=1,sub,onClick,children,title,pressed}) {
  const Tag = onClick?'button':'div';
  return <Tag className={`mv-cd-stat is-tile-${tile}`} onClick={onClick} title={title} type={onClick?'button':undefined} aria-pressed={onClick&&pressed!==undefined?pressed:undefined}>
    <span className="mv-cd-stat-top">{Icon&&<Icon size={14} strokeWidth={2.4}/>}{label}</span>
    <strong className="mv-cd-stat-value">{typeof value==='number'?<CountUp value={value} format={format}/>:value}</strong>
    {sub&&<small className="mv-cd-stat-sub">{sub}</small>}
    {children}
  </Tag>;
}

/** One small figure in a card's grid: its label on top, the number under it. */
export function Metric({label,value,tone,title}) {
  if (value===null||value===undefined||value==='') return null;
  return <span className={`mv-cd-metric ${tone?`is-${tone}`:''}`} title={title}><small>{label}</small><b>{value}</b></span>;
}

/** Hover or keyboard focus on a card starts its video. */
export function useHoverPlay() {
  const [playing,setPlaying] = useState(false);
  return [playing,{onMouseEnter:()=>setPlaying(true),onMouseLeave:()=>setPlaying(false),onFocus:()=>setPlaying(true),onBlur:()=>setPlaying(false)}];
}

/**
 * A product's picture; its video plays over it (muted) while `playing`. The video
 * only starts loading on hover, so a page full of cards stays light.
 */
export function CardMedia({image,video,playing=false,alt='',placeholder,ratio='4 / 5',className='',children}) {
  const moving = playing&&video&&!calm();
  return <div className={`mv-cd-media ${className}`} style={{aspectRatio:ratio}}>
    {image?<img src={assetUrl(image)} alt={alt} loading="lazy"/>:<span className="mv-cd-media-empty">{placeholder}</span>}
    {moving&&<video className="mv-cd-media-video" src={assetUrl(video)} muted loop playsInline autoPlay preload="none" aria-hidden="true"/>}
    {video&&!moving&&<span className="mv-cd-media-play" aria-hidden="true"><Play size={12} fill="currentColor"/></span>}
    {children}
  </div>;
}

/** The owner's six steps as a small bar: done, here, still to come (from the product's saved step). */
export function StepBar({at=0,stopped=false,label}) {
  return <span className={`mv-cd-stepbar ${stopped?'is-stopped':''}`} role="img" aria-label={label||`Step ${at+1} of ${DISPLAY_LINE.length}: ${DISPLAY_LINE[at]?.short}`}>
    {DISPLAY_LINE.map((step,index)=><i key={step.id} className={index<at?'is-done':index===at?'is-here':''} title={step.short}/>)}
  </span>;
}

/** One row of cards: swipe or use the arrows, and the next card peeks in so it's clear there's more. */
export function Shelf({children,label}) {
  const row = useRef(null);
  const [ends,setEnds] = useState({left:false,right:false});
  const measure = () => {
    const el = row.current;
    if (el) setEnds({left:el.scrollLeft>4,right:el.scrollLeft+el.clientWidth<el.scrollWidth-4});
  };
  useEffect(()=>{
    measure();
    window.addEventListener('resize',measure);
    return ()=>window.removeEventListener('resize',measure);
  },[children]);
  const move = direction => row.current?.scrollBy({left:direction*Math.max(240,row.current.clientWidth*.7),behavior:calm()?'auto':'smooth'});
  return <div className="mv-cd-shelf-wrap">
    <div className="mv-cd-shelf" ref={row} onScroll={measure} role="list" aria-label={label}>{children}</div>
    {ends.left&&<button type="button" className="mv-cd-shelf-arrow is-left" aria-label="Show earlier cards" onClick={()=>move(-1)}><ChevronLeft size={18}/></button>}
    {ends.right&&<button type="button" className="mv-cd-shelf-arrow is-right" aria-label="Show more cards" onClick={()=>move(1)}><ChevronRight size={18}/></button>}
  </div>;
}

/** A section's title row: icon, name, count and one link. */
export function SectionHead({icon:Icon,title,count,tone,action,onAction}) {
  return <div className="mv-cd-head">
    <h2>{Icon&&<span className={`mv-cd-head-icon ${tone?`is-${tone}`:''}`}><Icon size={15} strokeWidth={2.4}/></span>}{title}{count!==undefined&&<b>{count}</b>}</h2>
    {action&&<button type="button" className="mv-link" onClick={onAction}>{action}</button>}
  </div>;
}

/** Long text as two lines; one tap opens the rest. */
export function ReadMore({text,lines=2}) {
  const [open,setOpen] = useState(false);
  const long = String(text||'').length>lines*70;
  return <div className="mv-cd-more">
    <p style={open?undefined:{WebkitLineClamp:lines}} className={open?'':'is-clamped'}>{text}</p>
    {long&&<button type="button" className="mv-link" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{open?'Less':'More'}<ChevronDown size={13} className={open?'is-flipped':''}/></button>}
  </div>;
}

/**
 * Tiles that each open one panel under the row: everything a page used to stack as
 * paragraphs is one tap away, and only one is open at a time. `start` opens one at first.
 */
export function PanelTiles({tiles,start=null}) {
  const list = tiles.filter(Boolean);
  const [open,setOpen] = useState(start);
  const shown = list.find(tile=>tile.id===open);
  return <section className="mv-cd-panels">
    <div className="mv-cd-panel-row" role="group" style={{'--count':list.length}}>
      {list.map((tile,index)=>{const Icon=tile.icon;return <button key={tile.id} type="button" className={`mv-cd-panel-tile is-tile-${tile.tile||index%6+1}`} aria-expanded={open===tile.id} onClick={()=>setOpen(open===tile.id?null:tile.id)}>
        <span className="mv-cd-panel-icon"><Icon size={17} strokeWidth={2.2}/></span>
        <span className="mv-cd-panel-text"><strong>{tile.title}</strong>{tile.sub&&<small>{tile.sub}</small>}</span>
        <ChevronDown size={15} className="mv-cd-panel-chev"/>
      </button>;})}
    </div>
    {shown&&<div className="mv-cd-panel-body" key={shown.id}>{shown.node}</div>}
  </section>;
}
