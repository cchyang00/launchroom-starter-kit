import {projectUrl} from './projectScope.mjs';
import React,{useEffect,useState} from 'react';
import {HeartPulse,TriangleAlert,Check,Info,RefreshCw} from 'lucide-react';
import {Chip,Sheet} from './kit.jsx';

// The OS health check on Home: one quiet chip, "All good" or "N things to look
// at", that opens a sheet with each finding and its one-line fix. The report
// comes from GET /api/doctor (server/doctor.mjs), which only reads records;
// nothing here changes anything. Claude runs `os.mjs doctor` at the start of a
// session and does the fixes.
const REFRESH_MS = 120000;
const RESTART = 'Restart the OS server: first check GET /api/runtime for a running Codex job, then stop the node process on port 3000 and run node os/server/start.mjs from the workspace root.';

export async function readReport() {
  const res = await fetch(projectUrl('/api/doctor'));
  // A server started before the health check existed has no /api/doctor: that itself means "restart".
  if (res.status === 404) return {old: true};
  const data = await res.json().catch(()=>null);
  if (!res.ok || !data) throw new Error(data?.error||'The health check could not be read.');
  return data;
}
const clock = at => {try{return new Date(at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});}catch{return '';}};

export function DoctorBadge() {
  const [report,setReport] = useState(null),[error,setError] = useState(''),[open,setOpen] = useState(false),[busy,setBusy] = useState(false);
  async function load(){setBusy(true);try{setReport(await readReport());setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  useEffect(()=>{load();const timer=setInterval(load,REFRESH_MS);return()=>clearInterval(timer);},[]);
  if (!report&&!error) return null;
  const old = report?.old, count = old?1:report?.count||0;
  const label = error?'Health check unavailable':old?'OS server needs a restart':report.summary;
  return <>
    <button className="mv-dr-chip" onClick={()=>setOpen(true)} aria-haspopup="dialog"><Chip tone={error?'muted':count?'owner':'done'} icon={count||error?TriangleAlert:HeartPulse}>{label}</Chip></button>
    {open&&<Sheet title="OS health check" subtitle={old?'The running server is older than this check.':report?`${report.summary} · checked ${clock(report.computedAt)}`:error} onClose={()=>setOpen(false)}
      actions={<button className="mv-btn sm" onClick={load} disabled={busy}><RefreshCw size={13}/>{busy?'Checking…':'Check again'}</button>}>
      <DoctorSheet report={report} error={error}/>
    </Sheet>}
  </>;
}

/** The findings, grouped. Also used by the More page's Health check door. */
export function DoctorSheet({report,error}) {
  if (error) return <div className="mv-dr-intro"><p>{error}</p></div>;
  if (report.old) return <div className="mv-dr-list"><Finding status="look" label="OS server" text="The OS server was started before this health check existed, so it runs older code than the app you are looking at." fix={RESTART}/></div>;
  const rows = report.checks.flatMap(check=>check.findings.map((finding,index)=>({...finding,label:check.label,key:`${check.id}-${index}`})));
  const looks = rows.filter(row=>row.status==='look'), oks = rows.filter(row=>row.status==='ok'), notes = rows.filter(row=>row.status==='note');
  return <>
    <p className="mv-dr-intro">It only reads the saved records; it never changes one. Claude runs <code>os.mjs doctor</code> at the start of a session and does the fixes.</p>
    {looks.length>0&&<section className="mv-dr-group"><h3 className="mv-h3">To look at ({looks.length})</h3><div className="mv-dr-list">{looks.map(row=><Finding key={row.key} {...row}/>)}</div></section>}
    {notes.length>0&&<section className="mv-dr-group"><h3 className="mv-h3">Good to know</h3><div className="mv-dr-list">{notes.map(row=><Finding key={row.key} {...row}/>)}</div></section>}
    <section className="mv-dr-group"><h3 className="mv-h3">Fine ({oks.length})</h3><div className="mv-dr-list is-fine">{oks.map(row=><Finding key={row.key} {...row}/>)}</div></section>
  </>;
}

function Finding({status,label,text,fix}) {
  const Icon = status==='look'?TriangleAlert:status==='ok'?Check:Info;
  return <div className={`mv-dr-row is-${status}`}>
    <span className="mv-dr-icon" aria-hidden="true"><Icon size={14}/></span>
    <div className="mv-dr-body"><small>{label}</small><p>{text}</p>{fix&&status==='look'&&<p className="mv-dr-fix"><b>Fix</b>{fix}</p>}</div>
  </div>;
}
