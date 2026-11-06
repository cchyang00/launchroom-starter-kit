import React,{useState} from 'react';
import {Plus,Lightbulb,FlaskConical,CheckCircle2,Undo2,Eye} from 'lucide-react';
import {ImprovementEditor} from './Workspaces.jsx';
import {CycleReview} from './ProductCycle.jsx';
import {Avatar,Chip,timeAgo} from './kit.jsx';

const LANES = [
  ['proposed','Proposed','A change we think will help',Lightbulb],
  ['trialed','Being tried','Used on real work, result pending',FlaskConical],
  ['adopted','Adopted','Checked and now part of the method',CheckCircle2],
  ['reverted','Reverted','Tried and rolled back',Undo2],
];

// Improvements move through their lifecycle only when someone records the
// evidence in the editor; the board itself never changes a status.
export function LearningBoard({data,notify,compact=false}) {
  const [editing,setEditing] = useState(null);
  const items = data.improvements||[];
  return <>
    <div className="mv-kanban" style={compact?{gridAutoColumns:'minmax(220px,1fr)'}:undefined}>{LANES.map(([id,title,hint,Icon])=>{const lane=items.filter(item=>item.status===id).slice().reverse();return <div key={id} className="mv-col mv-learn-col">
      <div className="mv-col-head"><div><strong><Icon size={14}/>{title}</strong><small>{hint}</small></div><b>{lane.length}</b></div>
      {lane.length?lane.slice(0,compact?4:50).map(item=><button key={item.id} className="mv-mini-note" onClick={()=>setEditing(item)}>
        <span style={{display:'flex',alignItems:'center',gap:8}}><Avatar role={item.role} size={20}/><small className="mv-small">{timeAgo(item.updatedAt)}</small></span>
        <strong>{item.title}</strong><p>{item.observation}</p>
      </button>):<div className="mv-col-empty">Nothing here</div>}
      {compact&&lane.length>4&&<span className="mv-small" style={{textAlign:'center'}}>+{lane.length-4} more in the learning log</span>}
    </div>;})}</div>
    {editing&&<div className="mv-legacy"><ImprovementEditor record={editing} data={data} onClose={()=>setEditing(null)} onSave={()=>{setEditing(null);notify('Learning record saved.');}}/></div>}
  </>;
}

export function LearningView({data,notify,openDoc}) {
  const [capture,setCapture] = useState(false);
  const items = data.improvements||[];
  return <section>
    <div className="mv-page-head"><div><span className="mv-eyebrow">A system that gets better</span><h1 className="mv-h1">Learning log</h1><p className="mv-sub">Every problem we notice becomes a proposed change, gets tried on real work, and is adopted only when it helps.</p></div>
      <div className="mv-page-actions"><button className="mv-btn primary" onClick={()=>setCapture(true)}><Plus size={15}/>Capture a lesson</button></div></div>
    <div className="mv-lab-result" style={{gridTemplateColumns:'repeat(4,minmax(0,1fr))',marginTop:0,marginBottom:20}}>{LANES.map(([id,title])=><div key={id} className={`mv-stat ${id==='adopted'?'is-good':''}`}><b>{items.filter(item=>item.status===id).length}</b><small>{title}</small></div>)}</div>
    <LearningBoard data={data} notify={notify}/>
    <div className="mv-card mv-pad mv-legacy" style={{marginTop:20}}><CycleReview data={data} notify={notify} openDoc={openDoc}/></div>
    <p className="mv-small" style={{marginTop:12,display:'flex',gap:6,alignItems:'center'}}><Eye size={13}/>A saved lesson does not edit agent instructions by itself. The change is applied and checked on the next real job.</p>
    {capture&&<div className="mv-legacy"><ImprovementEditor record={{}} data={data} onClose={()=>setCapture(false)} onSave={()=>{setCapture(false);notify('Lesson captured.');}}/></div>}
  </section>;
}
