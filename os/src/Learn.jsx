import {projectAsset} from './projectScope.mjs';
import React, {useEffect, useState} from 'react';
import {ArrowLeft,ArrowUpRight,BookOpen,RefreshCw,ZoomIn} from 'lucide-react';
import {api,Modal,today} from './ui.jsx';
import {LEARN_CATALOG,parseLearningCatalog,contribution} from './learnModel.mjs';
import './learn.css';

export default function Learn({openDoc,onBack,notify,openMemory,startLesson=''}) {
  const [catalog,setCatalog]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[active,setActive]=useState(startLesson),[reload,setReload]=useState(0),[drafts,setDrafts]=useState({});
  useEffect(()=>{let live=true;setLoading(true);setError('');api('/api/doc?path='+encodeURIComponent(LEARN_CATALOG)).then(doc=>{const next=parseLearningCatalog(doc.content);if(live){setCatalog(next);setActive(id=>next.lessons.some(l=>l.id===id)?id:next.lessons[0].id);}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[reload]);
  const lesson=catalog?.lessons.find(l=>l.id===active);
  return <section className="learn-page">
    <header className="learn-header"><div><button className="quiet-button" onClick={onBack}><ArrowLeft size={14}/>Library</button><h1>Learn by looking closer.</h1><p>Five connected decisions. Real references. Something to try.</p></div><button className="quiet-button" disabled={loading} onClick={()=>setReload(x=>x+1)}><RefreshCw size={14}/>Reload lessons</button></header>
    {error&&<div role="alert" className="learn-error">{error} <button onClick={()=>openDoc(LEARN_CATALOG)}>Open catalog</button></div>}
    {loading&&!catalog&&<p role="status">Opening the learning desk…</p>}
    {catalog&&<><nav className="learn-topics" aria-label="Learning topics">{catalog.lessons.map((l,i)=><button key={l.id} aria-current={active===l.id?'page':undefined} onClick={()=>setActive(l.id)}><span>{String(i+1).padStart(2,'0')}</span>{l.topic}</button>)}</nav>{lesson&&<Lesson key={lesson.id} lesson={lesson} openDoc={openDoc} notify={notify} openMemory={openMemory} draft={drafts[lesson.id]||''} saveDraft={text=>setDrafts(d=>({...d,[lesson.id]:text}))}/>}</>}
  </section>;
}

function Lesson({lesson,openDoc,notify,openMemory,draft,saveDraft}) {
  const [zoom,setZoom]=useState(false),[showAnswer,setShowAnswer]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[imageError,setImageError]=useState(false),[author,setAuthor]=useState('owner');
  const reflection=draft,setReflection=saveDraft;
  const image=projectAsset(lesson.image);
  async function save(e) {e.preventDefault();setBusy(true);setError('');try {
    const current=await api('/api/workspace');
    const text=`Learning application — ${lesson.topic}\n${reflection.trim()}\nNext check: ${lesson.next}`;
    await api('/api/workspace/notes',{revision:current.revision,author,day:today(),kind:'lesson',topic:`Learn: ${lesson.topic}`,important:false,text,references:[lesson.document,LEARN_CATALOG]});
    const check=await api('/api/workspace');
    if (!check.notes.some(n=>n.text===text&&!n.retired)) throw new Error('The save returned, but the note could not be verified. Check Memory before retrying.');
    setSaved(true);notify('Learning saved in today’s memory.');
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <article className="learn-lesson">
    <div className="learn-title"><h2>{lesson.title}</h2><p>{lesson.takeaway}</p></div>
    <div className="learn-layout"><div className="learn-main">
      <figure className="learn-figure"><button className={`learn-image-button ${lesson.secondaryImage?'learn-image-pair':''}`} onClick={()=>setZoom(true)} aria-label={`Enlarge ${lesson.topic} illustration`}><img src={image} alt={lesson.alt} onError={()=>setImageError(true)}/>{lesson.secondaryImage&&<img src={projectAsset(lesson.secondaryImage)} alt={lesson.secondaryAlt} onError={()=>setImageError(true)}/>}<span><ZoomIn size={14}/>Look closer</span></button><figcaption>{lesson.caption}</figcaption></figure>
      {imageError&&<p role="alert">This image could not load. Open the full lesson for its text explanation.</p>}
      {lesson.id==='offers'&&<OfferLab/>}
      <section className="learn-observations"><h3>What changes in our work</h3><ol>{lesson.points.map(p=><li key={p}>{p}</li>)}</ol></section>
      <details className="learn-sources"><summary>Read the evidence · {lesson.sources.length} starting sources</summary><p>Sources inform the lesson; examples do not establish our results. Full coverage and limits are in the research notes.</p>{lesson.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer"><strong>{s.title}<ArrowUpRight size={13}/></strong><span>{s.scope}</span></a>)}</details>
      <button className="quiet-button" onClick={()=>openDoc(lesson.document)}><BookOpen size={15}/>Full lesson & research</button>
    </div><aside className="learn-practice">
      <span className="learn-kicker">TRY THE DECISION</span><h3>{lesson.question}</h3><button className="quiet-button" aria-expanded={showAnswer} onClick={()=>setShowAnswer(v=>!v)}>{showAnswer?'Hide reasoning':'Show the reasoning'}</button>{showAnswer&&<p className="learn-answer">{lesson.answer}</p>}
      <form onSubmit={save}><label htmlFor={`reflection-${lesson.id}`}>What would you change?</label><textarea id={`reflection-${lesson.id}`} rows={4} maxLength={2500} value={reflection} onChange={e=>{setReflection(e.target.value);setSaved(false);}} placeholder="Your decision, why, and what we should check next." required/><div className="learn-author"><label htmlFor={`author-${lesson.id}`}>Saved by</label><select id={`author-${lesson.id}`} value={author} onChange={e=>setAuthor(e.target.value)}><option value="owner">Me</option><option value="agent">Agent</option></select></div>{error&&<p role="alert">{error}</p>}<button className="learn-save" disabled={busy||saved||!reflection.trim()}>{busy?'Saving…':saved?'Saved in memory':'Save my learning'}</button></form>
      <p className="learn-next"><strong>Next application</strong>{lesson.next}</p><button className="quiet-button" onClick={openMemory}>Open memory <ArrowUpRight size={14}/></button>
    </aside></div>
    {zoom&&<Modal wide title={lesson.topic} onClose={()=>setZoom(false)}><p>Scroll across the image to inspect details.</p><div className="learn-zoom-canvas"><img className="learn-full-image" src={image} alt={lesson.alt}/>{lesson.secondaryImage&&<img className="learn-full-image" src={projectAsset(lesson.secondaryImage)} alt={lesson.secondaryAlt}/>}</div><p>{lesson.caption}</p></Modal>}
  </article>;
}

function OfferLab() {
  const [units,setUnits]=useState(1),[price,setPrice]=useState(39),[rate,setRate]=useState(3);
  const v=contribution({price,units,unitCost:9,shipping:6,feePercent:3,refundReserve:2});
  const bands=[['Product cost',v.goods,'var(--chart-1)'],['Shipping',v.shipping,'var(--chart-2)'],['Fees + reserve',v.fees+v.refundReserve,'var(--chart-3)'],['Available before ads',Math.max(0,v.available),'var(--chart-4)']];
  return <section className="offer-lab"><h3>Change the offer. Watch the room for ads.</h3><p>Hypothetical USD example. Cost assumptions: $9/unit, $6 shipping, 3% fees, $2 refund reserve.</p><div className="offer-inputs"><label>Units<select value={units} onChange={e=>setUnits(Number(e.target.value))}><option value={1}>One</option><option value={2}>Two</option><option value={3}>Three</option></select></label><label>Order price<input type="number" min="1" max="500" value={price} onChange={e=>setPrice(Math.max(1,Math.min(500,Number(e.target.value))))}/></label><label>Orders per 100 visits<input type="number" min="0" max="100" step="0.1" value={rate} onChange={e=>setRate(Math.max(0,Math.min(100,Number(e.target.value))))}/></label></div><div className="offer-bar" aria-label={`Available before ads: $${v.available.toFixed(2)}`}>{bands.map(([label,amount,color])=><span key={label} title={`${label}: $${amount.toFixed(2)}`} style={{flex:amount,background:color}}/>)}</div><div className="offer-legend">{bands.map(([label,amount,color])=><span key={label}><i style={{background:color}}/>{label}: ${amount.toFixed(2)}</span>)}</div><p className="offer-result">${v.available.toFixed(2)} per order before ads · ${(v.available*rate).toFixed(2)} per 100 visits before acquisition costs</p>{v.available<0&&<p role="status">This offer loses money before ad costs in this scenario.</p>}</section>;
}
