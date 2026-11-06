import React,{useEffect,useState} from 'react';
import {Check,ArrowUpRight} from 'lucide-react';
import {api} from './ui.jsx';
import {parsePreDiscovery} from './preDiscovery.mjs';
import {storePreflight,PRE_PRODUCT_NEXT,PRE_PRODUCT_LABEL} from './storeReadiness.mjs';
import './preDiscovery.css';

const PATH='workflow/PRE-DISCOVERY-CHECKLIST.md';

export function PreDiscovery({openDoc,openStore,storeChecklist,parkedProduct}){
  const [items,setItems]=useState([]),[error,setError]=useState('');
  useEffect(()=>{let live=true;async function refresh(){try{const doc=await api(`/api/doc?path=${encodeURIComponent(PATH)}`);if(live){setItems(parsePreDiscovery(doc.content));setError('');}}catch(e){if(live)setError(e.message);}}refresh();const timer=setInterval(refresh,15000);return()=>{live=false;clearInterval(timer);};},[]);
  const done=items.filter(item=>item.done).length;
  const open=items.filter(item=>!item.done),closed=items.filter(item=>item.done);
  const preflight=storePreflight(storeChecklist?.groups);
  const rows=list=>list.map(item=><div key={item.id} className={item.done?'done':''}><span>{item.done?<Check size={11}/>:item.id}</span><p>{item.title}</p></div>);
  return <section className="pre-discovery" aria-label="Product search setup"><div className="pre-discovery-head"><div><span>SEARCH START</span><h2>{items.length>0&&done===items.length?'Ready to search':'Preparing to search'}</h2><p>{open.length?`${open.length} setup check${open.length===1?'':'s'} still open before the next visual batch.`:'Search setup is reviewed. Recheck evidence before the next batch.'}</p></div><div className="pre-discovery-count"><strong>{items.length?`${done}/${items.length}`:'—'}</strong><small>reviewed</small></div></div>{error?<p className="pre-discovery-error">Checklist unavailable: {error}</p>:<><div className="pre-discovery-list">{open.length?rows(open):<p>All search-start setup checks are reviewed.</p>}</div>{closed.length>0&&<details className="pre-discovery-completed"><summary>{closed.length} setup checks completed</summary><div className="pre-discovery-list">{rows(closed)}</div></details>}<button className="text-link" onClick={()=>openDoc(PATH)}>Open search checklist and evidence<ArrowUpRight size={12}/></button></>}
    <details className="pre-discovery-work"><summary>Store preparation · {preflight.now.length} open</summary><div className="pre-discovery-work-head"><p>Store setup is tracked separately from product verification and launch readiness.</p><button className="text-link" onClick={openStore}>Open Store launch<ArrowUpRight size={12}/></button></div><div className="pre-discovery-work-list">{preflight.now.map(item=><div key={item.id} className="pre-discovery-work-item"><span aria-label="Open check">□</span><div><strong>{item.id} · {PRE_PRODUCT_LABEL[item.id]}</strong><p>{PRE_PRODUCT_NEXT[item.id]}</p></div></div>)}{!preflight.now.length&&<p>No agent-owned store setup checks are open in the short queue.</p>}</div>{preflight.owner.length>0&&<details className="pre-discovery-completed pre-discovery-owner"><summary>{preflight.owner.length} owner-dependent store checks</summary><div className="pre-discovery-work-list">{preflight.owner.map(item=><div key={item.id}><span>{item.id}</span><p>{item.title}</p></div>)}</div></details>}</details>
    {parkedProduct&&<div className="pre-discovery-slot"><strong>Before the next selected build</strong><p>{parkedProduct.name} is PARK and still occupies the app's single active-product slot. Review and archive that stopped cycle before creating another build product; keep its original files and draft. This does not block research cards.</p><button className="text-link" onClick={()=>openDoc('workflow/SINGLE-PRODUCT.md')}>Cycle procedure<ArrowUpRight size={12}/></button></div>}
  </section>;
}
