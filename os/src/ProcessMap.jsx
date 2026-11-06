import React,{useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Check,ChevronLeft,ChevronRight,Clock,Command,Flag,FolderOpen,GitBranch,Image,LockKeyhole} from 'lucide-react';
import {api,Badge,ErrorText,Field,Modal,Submit,countryName} from './ui.jsx';
import {WorkflowMap as FreeformMap} from './MindMap.jsx';
import {ProductWorkspace} from './ProductWorkspace.jsx';
import {effectiveCheckStatus,processAssignment,processScope,processState} from './processModel.mjs';
import {ProcessProcedure,SessionStart,usePlaybook} from './ProcessProcedure.jsx';
import {ResearchBatch} from './ResearchBatch.jsx';
import {PreDiscovery} from './PreDiscovery.jsx';
import {parsePreDiscovery} from './preDiscovery.mjs';
import {PLAYBOOK_PATH,playbookStep} from './playbook.mjs';
import './processmap.css';
import './focused-process.css';

const titles=['Find the exact product','Prove demand','Verify source & costs','Prepare creative','Build & check store','Run, measure & learn'];
const outputs=['An exact item and a supported buyer situation.','Current demand and a specific market opportunity.','An exact, safe item with feasible delivery and contribution.','Accurate assets and a supported offer.','A tested page, checkout, tracking and delivery promise.','An authorized test and a recorded outcome.'];
export const researchRoute=[
 ['Access','Kalodata profile','workflow/PRE-DISCOVERY-CHECKLIST.md'],
 ['Scan','Kalodata visuals','workflow/KALODATA-IMAGE-PILOT.md'],
 ['Choose','Owner eye test','research/CURATION-QUEUE.md'],
 ['Source','AliExpress exact SKU','workflow/KALODATA-IMAGE-PILOT.md'],
 ['Prove','Kalodata + buyers','workflow/KALODATA-IMAGE-PILOT.md'],
 ['Compete','Trendtrack / Meta','workflow/KALODATA-IMAGE-PILOT.md'],
 ['Handoff','Builder packet','workflow/ATLAS-HANDOFF.md'],
];

export function useSearchSetup(){
 const [items,setItems]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;async function refresh(){try{const doc=await api('/api/doc?path=workflow%2FPRE-DISCOVERY-CHECKLIST.md');if(live){setItems(parsePreDiscovery(doc.content));setError('');}}catch(e){if(live)setError(e.message);}}refresh();const timer=setInterval(refresh,15000);return()=>{live=false;clearInterval(timer);};},[]);
 return {items,error,ready:items.find(item=>item.id==='B10')?.done===true};
}

export function WorkflowMap(props){
 const {data,hub,activity=[],openDoc,notify,openAgentDesk,openStore,openAssets,openLibrary}=props;
 const [marketId,setMarketId]=useState(''),[viewed,setViewed]=useState(null),[checkId,setCheckId]=useState(null),[actionId,setActionId]=useState(null),[screen,setScreen]=useState('work'),[editing,setEditing]=useState(false),[notes,setNotes]=useState(false),[freeform,setFreeform]=useState(false);
 const {items:setupItems,error:setupError,ready:searchReady}=useSearchSetup();
 const playbook=usePlaybook();
 const {product,market,parkedProduct}=processScope(data.products,data.workspace?.activeProductId,marketId);
 const researchMode=!product;
 const flow=processState(data.stages,data.checks,market);
 const currentIndex=Math.min(flow.currentIndex,flow.steps.length-1);
 const selectedIndex=viewed??currentIndex;
 const step=flow.steps[selectedIndex];
 const selectedCheck=step.items.find(c=>c.id===checkId)||step.items.find(c=>effectiveCheckStatus(market,c.id)!=='verified')||step.items[0];
 const proof=market?.checks[selectedCheck?.id];
 const map=hub.maps.find(m=>m.title==='Product launch process');
 const mapNode=map?.nodes.find(n=>n.id===`stage-${step.id}`);
 const handoff=data.workspace?.handoff;
 const setupDone=setupItems.filter(item=>item.done).length;
 const blocker=researchMode&&!searchReady;
 const focusTitle=researchMode?(blocker?'Verify Kalodata access':'Curate products for the eye test'):flow.complete?'Review this cycle':titles[flow.currentIndex];
 const focusDescription=researchMode?(blocker?'Confirm the authorized Product view, country, dates and filters.':'Inspect real products, filter weak fits, then show source-linked cards for your eye test.'):flow.next?.title||'Review the saved result and record the next improvement.';
 function selectStep(index){setViewed(index);setCheckId(null);setActionId(null);setScreen('work');}
 function assignStage(index=selectedIndex,action){if(researchMode&&index>=3)return;const targetIndex=product&&market?.verificationGate?.ready!==true?0:index;const assigned=flow.steps[targetIndex];const check=assigned.items.find(c=>effectiveCheckStatus(market,c.id)!=='verified')||assigned.items[0];openAgentDesk?.(processAssignment({stageIndex:targetIndex,stage:assigned,product,market,action:targetIndex===index?action:null,check,currentIndex:flow.currentIndex,next:flow.next}));}
 function assignStartup(){openAgentDesk?.({role:'manager',productId:product?.id||'',marketId:market?.id||'',brief:`Resume this workspace using section 0 of ${PLAYBOOK_PATH}. Read current AGENTS.md, memory/START-HERE.md (Now, lessons and the step we are on) and open owner notes. Confirm current tool access and the next authorized decision. Report observed work in shared memory and Agent desk; do not mark product checks complete from startup work.`,references:[PLAYBOOK_PATH,'memory/START-HERE.md','memory/NOW.md','workflow/the-line.json','resources/LIBRARY.md']});}
 if(freeform)return <><button className="text-link flow-back" onClick={()=>setFreeform(false)}><ChevronLeft size={14}/>Back to workflow</button><FreeformMap {...props}/></>;
 return <section className="flow-page">
  <header className="flow-page-header"><div><h1>Workflow</h1><span>{product?product.name:'Discovery batch'}</span>{product&&<select className="flow-market" aria-label="Process market" value={market?.id||''} onChange={event=>{setMarketId(event.target.value);setViewed(null);setCheckId(null);}}>{product.markets.filter(item=>['active','winner'].includes(item.status)).map(item=><option key={item.id} value={item.id}>{countryName(item.country)}</option>)}</select>}</div><div><button className="flow-header-link" onClick={()=>openLibrary?.('guides')}><BookOpen size={14}/>Guidelines</button><button className="flow-header-link" onClick={openAssets}><Image size={14}/>Assets</button><button className="flow-header-link" onClick={()=>setFreeform(true)}><GitBranch size={14}/>Maps</button></div></header>

  <section className="flow-focus" aria-label="Next decision"><div className="flow-focus-main"><div className="flow-focus-kicker"><span className="flow-pulse"/>{researchMode?'NEXT DECISION · DISCOVERY':flow.complete?'CYCLE REVIEW':`CURRENT · STEP ${flow.currentIndex+1} OF ${flow.steps.length}`}</div><h2>{focusTitle}</h2><p>{focusDescription}</p><div className="flow-focus-actions">{blocker?<button className="flow-primary" onClick={()=>openDoc('workflow/PRE-DISCOVERY-CHECKLIST.md')}>Open access check<ArrowRight size={14}/></button>:<button className="flow-primary" onClick={()=>selectStep(currentIndex)}>{researchMode?'Open discovery step':'Open current step'}<ArrowRight size={14}/></button>}<button className="flow-quiet" onClick={()=>assignStage(currentIndex)}>Open Agent desk<Command size={14}/></button></div></div><div className="flow-focus-fact"><span>{researchMode?'SEARCH SETUP':'PRODUCT CHECKS'}</span><strong>{researchMode?(setupItems.length?`${setupDone}/${setupItems.length}`:'—'):`${flow.verified}/${flow.total}`}</strong><small>{researchMode?(blocker?'B10 access is open':'Setup reviewed'):'Evidence reviewed'}</small></div></section>

  <nav className="flow-track" aria-label="Product workflow stages">{flow.steps.map((item,index)=><button key={item.id} className={`${selectedIndex===index?'selected ':''}${item.state==='complete'?'complete ':''}${index===flow.currentIndex?'current':''}`} aria-current={selectedIndex===index?'step':undefined} onClick={()=>selectStep(index)}><span className="flow-track-number">{item.state==='complete'?<Check size={13}/>:String(index+1).padStart(2,'0')}</span><span className="flow-track-label">{titles[index]}</span></button>)}</nav>

  <div className="flow-view-switch" aria-label="Workflow views"><button aria-pressed={screen==='work'} onClick={()=>setScreen('work')}>Current step</button><button aria-pressed={screen==='shortlist'} onClick={()=>setScreen('shortlist')}>Product cards</button><button aria-pressed={screen==='records'} onClick={()=>setScreen('records')}>Records & setup</button></div>

  {screen==='work'&&<section className="flow-work" aria-label="Selected workflow step"><div className="flow-work-main"><header className="flow-work-header"><div><span>STEP {String(selectedIndex+1).padStart(2,'0')} / {flow.steps.length}</span><h2>{titles[selectedIndex]}</h2></div><Badge tone={step.state==='complete'?'green':selectedIndex===flow.currentIndex?'blue':''}>{researchMode?selectedIndex<3?'Research': 'After selection':step.state==='complete'?'Reviewed':selectedIndex===flow.currentIndex?'Current':'Upcoming'}</Badge></header><div className="flow-outcome"><Flag size={15}/><p>{outputs[selectedIndex]}</p></div>
   {researchMode&&selectedIndex===0&&<div className="flow-access"><div><LockKeyhole size={18}/><span><strong>{searchReady?'Ready for visual curation':'Access check open'}</strong><small>{searchReady?'Start a bounded Kalodata scan.':'Capture the account, currency, latest complete day and visible filters.'}</small></span></div><button onClick={()=>openDoc('workflow/PRE-DISCOVERY-CHECKLIST.md')}>B10 evidence<ArrowUpRight size={13}/></button></div>}
   {researchMode&&selectedIndex>0&&<div className="flow-access muted"><span><strong>{selectedIndex<3?'Save a product from the eye test first.':'Select a verified build product first.'}</strong><small>Viewing this step does not pass its checks.</small></span></div>}
   {product&&<div className="flow-checks"><div className="flow-checks-head"><h3>Evidence checks</h3><span>{step.done}/{step.total} reviewed</span></div>{market?.verificationGate?.ready!==true&&<div className="info-note">Pre-verification screen open. {market?.verificationGate?.reason||'Reload the app to check the linked research card.'} Earlier evidence is retained but does not count as current progress.</div>}{step.items.map(c=>{const status=effectiveCheckStatus(market,c.id),historical=market?.checks[c.id]?.status==='verified'&&status!=='verified';return <button key={c.id} className={selectedCheck?.id===c.id?'selected':''} onClick={()=>setCheckId(c.id)}><span className={`flow-check-status ${status}`}>{status==='verified'?<Check size={13}/>:''}</span><strong>{c.title}</strong><small>{historical?'Historical · screen open':status==='verified'?'Reviewed':status==='blocked'?'Blocked':'Open'}</small><ChevronRight size={13}/></button>})}{selectedCheck&&<div className="flow-check-detail"><strong>{selectedCheck.title}</strong><p>{selectedCheck.description}</p>{proof?.note&&<blockquote>{proof.note}</blockquote>}<div><button onClick={()=>setEditing(true)}>Review evidence<ArrowRight size={13}/></button>{proof?.source&&(/^https?:/.test(proof.source)?<a href={proof.source} target="_blank" rel="noreferrer">Source<ArrowUpRight size={13}/></a>:<button onClick={()=>openDoc(proof.source)}>Source<ArrowUpRight size={13}/></button>)}</div></div>}</div>}
   <details className="flow-method"><summary>Step instructions <ChevronRight size={15}/></summary><ProcessProcedure section={playbook.sections.find(s=>s.number===selectedIndex+1)} error={playbook.error} actionId={actionId} onAction={setActionId} openDoc={openDoc} onAssign={researchMode&&selectedIndex>=3?null:action=>assignStage(selectedIndex,action)}/></details>
  </div><aside className="flow-work-side"><div className="flow-side-links"><h3>Step references</h3><button onClick={()=>openDoc(playbookStep(selectedIndex))}><BookOpen size={15}/>Method<ArrowUpRight size={12}/></button>{researchMode&&selectedIndex<2&&<button onClick={()=>setScreen('shortlist')}><Image size={15}/>Product cards<ArrowRight size={12}/></button>}{mapNode?.reference&&mapNode.reference!==PLAYBOOK_PATH&&(/^https?:/.test(mapNode.reference)?<a href={mapNode.reference} target="_blank" rel="noreferrer"><FolderOpen size={15}/>Saved findings<ArrowUpRight size={12}/></a>:<button onClick={()=>openDoc(mapNode.reference)}><FolderOpen size={15}/>Saved findings<ArrowUpRight size={12}/></button>)}<button onClick={()=>setNotes(true)} disabled={!mapNode}><FolderOpen size={15}/>Stage notes<ArrowRight size={12}/></button></div>{researchMode&&selectedIndex===0&&<details className="flow-route"><summary>Research tool order<ChevronRight size={14}/></summary><ol>{researchRoute.map(([label,tool,path],index)=><li key={label}><button onClick={()=>openDoc(path)}><span>{String(index).padStart(2,'0')}</span><strong>{tool}</strong><ArrowUpRight size={12}/></button></li>)}</ol><p>Exact source/margin preflight precedes deep demand. Pipiads resolves a named question; Trendtrack is the final market check.</p></details>}</aside></section>}

  {screen==='shortlist'&&<div className="flow-panel"><ResearchBatch openDoc={openDoc} openAgentDesk={openAgentDesk} accessReady={searchReady}/></div>}
  {screen==='records'&&<div className="flow-records"><PreDiscovery openDoc={openDoc} openStore={openStore} storeChecklist={data.storeChecklist} parkedProduct={parkedProduct}/><details className="flow-records-extra"><summary>Session handoff, notes & blockers<ChevronRight size={15}/></summary><SessionStart section={playbook.sections.find(s=>s.number===0)} error={playbook.error} openDoc={openDoc} onAssign={assignStartup}/><div className="flow-record-row"><strong>Next action</strong><p>{handoff?.nextAction||'Review the current evidence and choose the next check.'}</p><button onClick={()=>openDoc('memory/WORKSPACE.md')}>Shared memory<ArrowUpRight size={12}/></button></div>{handoff?.blockers&&<div className="flow-record-row"><strong>Blockers</strong><p>{handoff.blockers}</p></div>}{parkedProduct&&<div className="flow-record-row"><strong>Preserved PARK product</strong><button onClick={()=>openDoc(`products/${parkedProduct.id}/OS.md`)}>{parkedProduct.name}<ArrowUpRight size={12}/></button></div>}{!data.checks.some(c=>c.id==='product-safety')&&<div className="flow-record-row"><strong>App service needs a reload</strong><p>Two newer product checks remain in the playbook and Store launch but are not in the live backend checklist.</p><button onClick={openStore}>Store launch<ArrowUpRight size={12}/></button></div>}</details><ErrorText error={setupError}/></div>}

  {activity[0]&&<div className="flow-activity"><Clock size={13}/><span>Latest report</span><strong>{activity[0].title}</strong><small>{activity[0].status}</small></div>}
  {editing&&product&&selectedCheck&&<Modal wide title="Review product evidence" onClose={()=>setEditing(false)}><ProductWorkspace key={selectedCheck.id} product={product} data={data} initialMarketId={market.id} initialCheckId={selectedCheck.id} onBack={()=>setEditing(false)} onSave={notify} openDoc={openDoc} onAgent={()=>assignStage()}/></Modal>}
  {notes&&mapNode&&<StepNotes map={map} node={mapNode} onClose={()=>setNotes(false)} onSave={()=>{setNotes(false);notify('Stage notes saved. Verification progress is unchanged.');}}/>}
 </section>;
}

export function StepNotes({map,node,onClose,onSave}){const [note,setNote]=useState(node.note),[revision]=useState(map.revision),[error,setError]=useState(''),[busy,setBusy]=useState(false);return <Modal title="Stage notes" subtitle={node.title} onClose={onClose}><form onSubmit={async event=>{event.preventDefault();setBusy(true);try{await api('/api/maps/'+map.id,{revision,node:{id:node.id,note}},'PATCH');onSave();}catch(e){setError(e.message);}finally{setBusy(false);}}}><Field label="Working notes"><textarea rows={9} maxLength={10000} value={note} onChange={event=>setNote(event.target.value)}/></Field><ErrorText error={error}/><Submit busy={busy}>Save notes</Submit></form></Modal>}
