import {projectAsset} from './projectScope.mjs';
import React,{useState} from 'react';
import {Activity,FileText,ArrowUpRight} from 'lucide-react';
import {Badge,ErrorText,Modal,roleNames} from './ui.jsx';

const label={running:'In progress',completed:'Completed',blocked:'Needs input',failed:'Failed'};
const stamp=value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});

export function LiveWork({activity=[],error,data,openDoc,openMap}){
 const [preview,setPreview]=useState(null);
 const openReference=path=>/\.(png|jpe?g|webp|gif|avif)$/i.test(path)?setPreview(path):openDoc(path);
 const ordered=[...activity].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
 const recent=ordered.slice(0,3);
 const earlier=ordered.slice(3);
 const report=(item,showPreview=false)=><article className="live-work-item" key={item.id}>
   <div className="live-item-meta"><span>{roleNames[item.role]||item.role} · {stamp(item.updatedAt)}</span><Badge tone={item.status==='blocked'?'amber':item.status==='failed'?'red':item.status==='running'?'blue':''}>{label[item.status]||item.status}</Badge></div>
   <h3>{item.title}</h3>{showPreview&&<p>{item.summary}</p>}
   <details className="live-timeline"><summary>Full report · {(item.references||[]).length} sources · {(item.events||[]).length} updates</summary><p className="live-full-summary">{item.summary}</p><div className="live-references">{(item.references||[]).map(path=><button key={path} title={path} onClick={()=>openReference(path)}><FileText size={13}/>{path.split('/').pop()}<ArrowUpRight size={12}/></button>)}</div><ol>{(item.events||[]).slice().reverse().map((event,i)=><li key={i}><time>{stamp(event.at)}</time><span>{event.text}</span></li>)}</ol></details>
  </article>;
 return <section className="live-work">
  <div className="desk-panel-title"><strong><Activity size={14}/>Recent work</strong><span>Reported from Codex</span></div>
  <div className="live-intro"><h2>Direct the work in Codex.</h2><p>Open a report to inspect its evidence and updates.</p></div>
  <div className="live-work-summary"><button onClick={openMap}>Open the process map<ArrowUpRight size={12}/></button><span>{data.products.length} products</span><span>{data.storeChecklist.done}/{data.storeChecklist.total} store checks</span><button onClick={()=>openDoc('memory/NOW.md')}>Current handoff<ArrowUpRight size={12}/></button></div>
  <ErrorText error={error}/>
  {!ordered.length?<div className="live-empty"><h3>Ready for the next piece of work</h3><p>Ask Codex to start a task. The manager reports milestones here as agents work through it.</p></div>:recent.map((item,index)=>report(item,index===0))}
  {!!earlier.length&&<details className="live-archive"><summary>Earlier reports <span>{earlier.length}</span></summary>{earlier.map(item=>report(item))}</details>}
  <p className="live-status-note">Activity shows saved progress reports. The manager updates it at milestones; it does not mirror every chat message or browser action.</p>
  {preview&&<Modal wide title={preview.split('/').pop()} onClose={()=>setPreview(null)}><img className="desk-asset-preview" src={projectAsset(preview)} alt={preview.split('/').pop()}/></Modal>}
 </section>;
}
