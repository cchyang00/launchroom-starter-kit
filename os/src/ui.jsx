import {projectUrl,projectAsset} from './projectScope.mjs';
import React, { useEffect, useRef, useState, useId, useMemo } from 'react';
import { X, LoaderCircle, ArrowUpRight, FileText, Check, Circle, AlertCircle, ChevronDown } from 'lucide-react';
import Markdown, {defaultUrlTransform} from 'react-markdown';
import {localDocumentUrl,resolveDocumentPath,headingAnchor} from './documentPaths.mjs';
import remarkGfm from 'remark-gfm';

export async function api(url, body, method) {
  const res = await fetch(projectUrl(url), { method: method || (body ? 'POST' : 'GET'), headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined });
  let data; try { data = await res.json(); } catch { throw new Error('The local server did not return a readable response. Refresh and try again.'); }
  // The server's error code travels with the message so screens can explain a refusal by its code (LS-073).
  if (!res.ok) { const error = new Error(data.error || 'This action could not be saved.'); error.code = data.code || ''; error.status = res.status; if (data.details) error.details = data.details; throw error; }
  return data;
}
export const countries = [['US','United States'],['GB','United Kingdom'],['CA','Canada'],['AU','Australia'],['NZ','New Zealand'],['DE','Germany'],['FR','France'],['IE','Ireland'],['NL','Netherlands'],['ES','Spain'],['IT','Italy'],['SE','Sweden']];
export const countryName = code => countries.find(c=>c[0]===code)?.[1] || code;
export const roleNames = {manager:'Manager',validation:'Research & validation','image-generator':'Image studio','shopify-builder':'Shopify builder'};
export const date = value => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T12:00:00':value).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : 'Not recorded';
export const today = () => {
  const now = new Date();
  const part = value => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${part(now.getMonth()+1)}-${part(now.getDate())}`;
};
export function Badge({children,tone='',className=''}) { return <span className={`badge ${tone} ${className}`}>{children}</span>; }
export function Field({label,children,hint}) { const id=useId(); return <div className="field"><label htmlFor={id}>{label}</label>{React.isValidElement(children)?React.cloneElement(children,{id}):children}{hint && <small>{hint}</small>}</div>; }
export function CountrySelect(props) { return <select {...props}>{countries.map(([code,name])=><option value={code} key={code}>{name}</option>)}</select>; }
export function StatusIcon({status}) { return status==='verified' ? <Check size={16}/> : status==='blocked' ? <AlertCircle size={16}/> : <Circle size={16}/>; }
export function ErrorText({error}) { return error ? <div role="alert" className="error"><AlertCircle size={16}/>{error}</div> : null; }
export function Submit({busy,children,...props}) { return <button className="btn primary" disabled={busy} {...props}>{busy&&<LoaderCircle size={16} className="spin"/>}{children}</button>; }
export function Modal({title,subtitle,children,onClose,wide=false}) {
  const ref=useRef();
  useEffect(()=>{ref.current.showModal(); const el=ref.current; return()=>el.close();},[]);
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose();}} className={`modal ${wide?'wide':''}`} onClick={e=>{if(e.target===ref.current)onClose();}}>
    <div className="modal-inner"><div className="modal-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20}/></button></div>{children}</div>
  </dialog>;
}
export function DocumentViewer({path,onClose,onNavigate}) {
  if (/\.(png|jpe?g|webp|gif)$/i.test(path)) return <Modal wide title="Reference image" subtitle={path} onClose={onClose}><img style={{width:'100%',height:'auto'}} src={projectAsset(path)} alt={`Reference: ${path.split('/').pop()}`}/></Modal>;
  return <MarkdownDocumentViewer path={path} onClose={onClose} onNavigate={onNavigate}/>;
}
function MarkdownDocumentViewer({path,onClose,onNavigate}) {
  const [doc,setDoc]=useState(null),[error,setError]=useState(''),[anchorRevision,setAnchorRevision]=useState(0);
  const article=useRef(null),[filePath,anchor='']=path.split('#');
  useEffect(()=>{let current=true;setDoc(null);setError('');api('/api/doc?path='+encodeURIComponent(filePath)).then(value=>{if(current)setDoc(value);}).catch(e=>{if(current)setError(e.message);});return()=>{current=false;};},[filePath]);
  useEffect(()=>{if(!doc||!article.current)return;let target;try{target=decodeURIComponent(anchor);}catch{target=anchor;}const headings=[...article.current.querySelectorAll('h1,h2,h3,h4,h5,h6')];const seen=new Map();for(const heading of headings){const base=headingAnchor(heading.textContent);const count=seen.get(base)||0;seen.set(base,count+1);heading.id=count?`${base}-${count}`:base;}const element=headings.find(heading=>heading.id===target);if(element){element.setAttribute('tabindex','-1');element.focus({preventScroll:true});element.scrollIntoView({block:'start'});}else{article.current.closest('dialog').scrollTop=0;}},[doc,anchor,anchorRevision]);
  // Preserve rendered images and layout when polling refreshes the workspace or a contents link changes only the anchor.
  const documentContent=useMemo(()=><Markdown urlTransform={url=>defaultUrlTransform(localDocumentUrl(url))} remarkPlugins={[remarkGfm]} components={{a:({href,children})=> /^https?:/.test(href||'')?<a href={href} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={12}/></a>:<button className="text-link" onClick={()=>{onNavigate(resolveDocumentPath(filePath,href));setAnchorRevision(value=>value+1);}}>{children}</button>,img:({src,alt})=><img src={projectAsset(resolveDocumentPath(filePath,src))} alt={alt||'Guide evidence'} loading="lazy"/>}}>{doc?.content||''}</Markdown>,[doc,filePath,onNavigate]);
  return <Modal wide title={filePath.split('/').pop().replace('.md','').replaceAll('-',' ')} subtitle={filePath} onClose={onClose}>
    <ErrorText error={error}/>{!doc&&!error?<div className="loading"><LoaderCircle className="spin"/>Opening workspace file…</div>:<article ref={article} className="markdown">{documentContent}</article>}
  </Modal>;
}
export function Empty({icon:Icon=FileText,title,children,action}) { return <div className="empty-state"><div className="empty-icon"><Icon size={25}/></div><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function SectionTitle({title,subtitle,action}) { return <div className="section-heading"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{action}</div>; }
export function EvidenceFields({form,setForm}) {
  const set=(key,value)=>setForm(f=>({...f,[key]:value}));
  return <><Field label="What did you verify?"><textarea required rows={3} value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Record what you observed, including limitations."/></Field>
    <Field label="Source link or workspace file"><input required value={form.source} onChange={e=>set('source',e.target.value)} placeholder="https://… or products/P001-…/evidence.md"/></Field>
    <div className="form-grid"><Field label="Evidence type"><select value={form.evidenceType} onChange={e=>set('evidenceType',e.target.value)}><option value="observed">Observed</option><option value="third-party estimate">Third-party estimate</option><option value="supplier assertion">Supplier assertion</option><option value="our result">Our measured result</option></select></Field><Field label="Observed on"><input required type="date" value={form.observedAt} onChange={e=>set('observedAt',e.target.value)}/></Field></div>
    <Field label="Measurement window"><input required value={form.window} onChange={e=>set('window',e.target.value)} placeholder="e.g. September 1–14, or point-in-time inspection"/></Field></>;
}

