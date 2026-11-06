import {projectAsset} from './projectScope.mjs';
import React,{useEffect,useState} from 'react';
import Markdown,{defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {BookOpen,ArrowRight,ChevronRight} from 'lucide-react';
import {api,ErrorText} from './ui.jsx';
import {PLAYBOOK_PATH,parsePlaybook} from './playbook.mjs';
import {localDocumentUrl,resolveDocumentPath} from './documentPaths.mjs';

export function usePlaybook(){
 const [content,setContent]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;
  async function refresh(){try{const doc=await api('/api/doc?path='+encodeURIComponent(PLAYBOOK_PATH));if(active){setContent(doc.content);setError('');}}catch(e){if(active)setError(e.message);}}
  refresh();const timer=setInterval(refresh,5000);return()=>{active=false;clearInterval(timer);};
 },[]);
 return {sections:parsePlaybook(content),error};
}

export function ProcedureText({children,openDoc}){
 return <div className="markdown process-method"><Markdown remarkPlugins={[remarkGfm]} urlTransform={url=>defaultUrlTransform(localDocumentUrl(url))} components={{
  a:({href,children})=>/^https?:/i.test(href||'')?<a href={href} target="_blank" rel="noreferrer">{children}</a>:<button className="text-link" onClick={()=>openDoc(resolveDocumentPath(PLAYBOOK_PATH,href))}>{children}</button>,
  img:({src,alt})=><img src={projectAsset(resolveDocumentPath(PLAYBOOK_PATH,src))} alt={alt||'Playbook reference'} loading="lazy"/>
 }}>{children}</Markdown></div>;
}

export function SessionStart({section,error,openDoc,onAssign}){
 return <details className="process-startup"><summary><span className="process-startup-number">00</span><span><strong>Resume & scope this session</strong><small>Memory → resources → assignment → access check</small></span><span className="process-startup-label">Before discovery</span><ChevronRight size={14}/></summary>
  <div className="process-startup-body"><p>Check current access and owner decisions at the start of every session. This does not count toward product readiness.</p><ErrorText error={error}/>{section?<ProcedureText openDoc={openDoc}>{section.intro}</ProcedureText>:<p>Loading the canonical startup procedure…</p>}
  <div className="process-evidence-actions"><button className="text-link" onClick={()=>openDoc('memory/NOW.md')}>Now</button><button className="text-link" onClick={()=>openDoc('memory/WORKSPACE.md')}>Shared memory</button><button className="text-link" onClick={()=>openDoc('resources/INDEX.md')}>Learning library</button><button className="btn" onClick={onAssign}>Prepare manager assignment<ArrowRight size={13}/></button></div></div>
 </details>;
}

export function ProcessProcedure({section,error,actionId,onAction,openDoc,onAssign}){
 const action=section?.actions.find(a=>a.id===actionId);
 return <div className="process-procedure"><div className="process-section-label"><strong>Work through this stage</strong><span>Live from PLAYBOOK.md</span></div><ErrorText error={error}/>
 {!section?<p className="process-procedure-hint">{error?'The procedure could not be loaded. Open the playbook to continue.':'Loading the ordered procedure…'}</p>:<>
  <ol className="process-actions">{section.actions.map(a=><li key={a.id}><button aria-expanded={action?.id===a.id} className={action?.id===a.id?'selected':''} onClick={()=>onAction(action?.id===a.id?null:a.id)}><span>{a.id}</span><strong>{a.title}</strong><ChevronRight size={14}/></button></li>)}</ol>
  <p className="process-procedure-hint">Open an action to read its instructions or prepare its agent assignment. Evidence is reviewed separately below.</p>
  {action&&<section className="process-action-detail" key={action.id}><div className="process-section-label"><strong>{action.id} · {action.title}</strong><button onClick={()=>onAction(null)}>Close</button></div><div className="process-action-controls"><button className="btn primary" disabled={!onAssign} onClick={()=>onAssign?.(action)}>Prepare this action<ArrowRight size={13}/></button><button className="text-link" onClick={()=>openDoc(action.path)}><BookOpen size={13}/>Open source section</button></div><ProcedureText openDoc={openDoc}>{action.content}</ProcedureText></section>}
  <details className="process-stage-context"><summary>Stage inputs, output & decision context</summary><ProcedureText openDoc={openDoc}>{section.intro}</ProcedureText></details>
 </>}
 </div>;
}
