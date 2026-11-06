import React,{useState} from 'react';
import {Link,Plus,ExternalLink,Trash2,ChevronRight,Package} from 'lucide-react';
import {api,Modal,Field,ErrorText,Submit,Badge,countryName} from './ui.jsx';
import {effectiveVerifiedCount} from './processModel.mjs';

export function productSources(product,market){
 if(product?.id==='EXAMPLE-01')return [];
 const found=new Map();
 const add=(url,label,note,id)=>{if(!url)return;const previous=found.get(url);found.set(url,{...previous,url,label:previous?.label||label,note:previous?.note||note,id:id||previous?.id});};
 for(const link of product?.links||[])add(link.url,link.label,link.note,link.id);
 add(product?.sourceUrl,'Original listing','Product discovery link');
 for(const m of market?[market]:product?.markets||[])for(const [id,proof] of Object.entries(m.checks||{}))add(proof.source,sourceName(proof.source),`${m.country} · ${id} · ${proof.status}`);
 return [...found.values()];
}
function sourceName(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url?.split('/').pop()||'Evidence file';}}
export function SourceLink({source,openDoc}){return /^https?:\/\//i.test(source.url)?<a href={source.url} target="_blank" rel="noreferrer" title={source.url}>{source.label||sourceName(source.url)}<ExternalLink size={11}/></a>:<button onClick={()=>openDoc(source.url)} title={source.url}>{source.label||sourceName(source.url)}<ChevronRight size={11}/></button>;}
export function SourceManager({product,market,openDoc,notify,onClose}){
 const [editing,setEditing]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(product.revision);
 const sources=productSources(product,market);
 async function save(e){e.preventDefault();setBusy(true);try{const updated=await api('/api/products/'+product.id,{revision,link:editing},'PATCH');setRevision(updated.revision);setEditing(null);notify('Source link saved to this product.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <Modal wide title={`${product.name} · source links`} subtitle="Exact source URLs stay with the product. Saving a link does not verify its claims." onClose={onClose}><ErrorText error={error}/><div className="source-manager-list">{sources.map(s=><div className="source-record" key={s.url}><div><SourceLink source={s} openDoc={openDoc}/><small>{s.url}</small><p>{s.note}</p></div>{s.id&&<button className="btn small" onClick={()=>setEditing({id:s.id,label:s.label,url:s.url,note:s.note||''})}>Edit</button>}</div>)}{!sources.length&&<p className="context-empty">No links yet. Add the exact product, ad or supplier page.</p>}</div>{editing?<form className="source-edit" onSubmit={save}><Field label="Source label"><input required value={editing.label} onChange={e=>setEditing({...editing,label:e.target.value})} placeholder="Pipiads · original ad"/></Field><Field label="Exact URL"><input type="url" required value={editing.url} onChange={e=>setEditing({...editing,url:e.target.value})} placeholder="https://…"/></Field><Field label="What does this source show?"><textarea rows={2} value={editing.note} onChange={e=>setEditing({...editing,note:e.target.value})}/></Field><div className="modal-actions"><button type="button" className="btn" onClick={()=>setEditing(null)}>Cancel</button><Submit busy={busy}>Save source</Submit></div></form>:<button className="btn" onClick={()=>{setError('');setEditing({label:'',url:'',note:''});}}><Plus size={14}/>Add source link</button>}</Modal>;
}
export function ProductRows({rows,stages,checks,onOpen,onSources,openDoc,readOnly=false}){
 return rows.map(({p,m})=>{const sources=productSources(p,m),count=effectiveVerifiedCount(m);return <div className="product-row register-row" key={p.id+m.id}><button className="product-identity" onClick={()=>onOpen(p,m)}><span className="product-symbol"><Package size={18}/></span><div><strong>{p.name}</strong><small>{p.id} · {countryName(m.country)}</small></div></button><div><Badge tone={m.verificationGate?.ready!==true?'amber':m.status==='winner'?'green':m.status==='parked'?'amber':'blue'}>{m.verificationGate?.ready!==true?'Screen open':m.status==='active'?(stages.find(s=>s.id===m.effectiveStageId)?.title||'Review'):m.status}</Badge><small className="row-angle">{m.angle||'Angle to verify'}</small></div><div className="table-progress"><span>{count}<small> / {checks.length}</small></span><div className="progress-track"><i style={{width:`${count/checks.length*100}%`}}/></div></div><div className="register-sources">{sources.slice(0,3).map(s=><SourceLink key={s.url} source={s} openDoc={openDoc}/>)}<button disabled={readOnly} onClick={()=>onSources(p,m)}>{sources.length?`All ${sources.length} links`:'Add links'}<Plus size={11}/></button></div><button className="icon-button" aria-label={`Open ${p.name} ${m.country} checks`} onClick={()=>onOpen(p,m)}><ChevronRight size={16}/></button></div>;});
}

