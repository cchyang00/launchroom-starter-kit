import React,{useMemo,useState} from 'react';
import {Archive,BadgeDollarSign,BookOpen,CheckCircle2,Clapperboard,Factory,FlaskConical,Gem,LayoutGrid,ListChecks,MessageSquareQuote,Skull,Target,TrendingUp,Trophy,X} from 'lucide-react';
import {Ring} from './kit.jsx';
import {CountUp,PanelTiles} from './cards.jsx';
import {STRESS_TEST_NOTE,VERIFY_CHECKS,gauntlet,shortReason} from './productGates.mjs';
import {AgentStepHead,ProductTile} from './CatalogPage.jsx';
import {stepReferenceTiles} from './StagePage.jsx';
import {SourceWork,ValidateWork} from './StageWork.jsx';
import './catalog.css';

// Step 2 · Verify (owner, Nov 5): "the tab where it does the hardest verification checks ... 90% of those
// products that are coming through probably are not going to make it past the verification ... they will be
// improved over time." One funnel from saved records: how many reached each check, how many it killed. Agents
// run it; a failed check takes the product off the line by itself, and passing them all sends it to Winners.

const PAGE = 24;
const CHECK_ICONS = {uptrend:TrendingUp,viral:Clapperboard,value:Gem,factory:Factory,profit:BadgeDollarSign,buyers:MessageSquareQuote,meta:Target};
const WORDS = {pass:'passed',fail:'failed',open:'still open'};

/** The seven checks as a row of marks: a filled dot passed, a cross failed, a ring is still open. */
function CheckDots({line}) {
  const passed = line.filter(check=>check.state==='pass').length;
  return <span className="mv-vf-dots" role="img" aria-label={`${passed} of ${line.length} checks passed. ${line.filter(check=>check.state==='fail').map(check=>`${check.name} failed.`).join(' ')}`}>
    {line.map(check=><i key={check.id} className={`is-${check.state}`} title={`${check.name}: ${WORDS[check.state]}`}>{check.state==='fail'&&<X size={9} strokeWidth={4}/>}</i>)}
    <b>{passed}/{line.length}</b>
  </span>;
}

function VerifyCard({entry,items,go,index,flag,tone,why}) {
  return <ProductTile item={entry.item} items={items} go={go} index={index} flag={flag} flagTone={tone}>
    <CheckDots line={entry.line}/>
    {why&&<p className="mv-vf-why" title={why}>{why}</p>}
  </ProductTile>;
}

function FunnelRow({icon:Icon,name,left,killed,total,testing=0,pressed,onClick,kind,title}) {
  const leftWidth = total?left/total*100:0, killedWidth = total?killed/total*100:0;
  return <button type="button" className={`mv-vf-row ${kind?`is-${kind}`:''}`} aria-pressed={pressed} onClick={onClick} title={title}>
    <span className="mv-vf-row-icon"><Icon size={15}/></span>
    <span className="mv-vf-row-name"><strong>{name}</strong>{testing>0&&<em>{testing} testing</em>}</span>
    <span className="mv-vf-bar" aria-hidden="true">{leftWidth>0&&<i className="is-left" style={{width:`${leftWidth}%`}}/>}{killedWidth>0&&<i className="is-killed" style={{width:`${killedWidth}%`}}/>}</span>
    <span className="mv-vf-left"><CountUp value={left}/></span>
    <span className={`mv-vf-killed ${killed?'has-killed':''}`}>{kind?'':killed?<><X size={12} strokeWidth={3}/>{killed}</>:'0'}</span>
  </button>;
}

function ChecksList({openDoc}) {
  return <>
    <div className="mv-vf-checks">{VERIFY_CHECKS.map((check,index)=>{const Icon=CHECK_ICONS[check.id]||ListChecks;return <article key={check.id} className="mv-vf-check">
      <header><span className={`mv-vf-check-icon is-tile-${index%6+1}`}><Icon size={16}/></span><div><small>Check {index+1}</small><strong>{check.name}</strong></div></header>
      <p>{check.rule}</p>
      <ul>{check.lines.map(line=><li key={line}><CheckCircle2 size={12}/>{line}</li>)}</ul>
    </article>;})}</div>
    <button type="button" className="mv-link mv-vf-note" onClick={()=>openDoc(STRESS_TEST_NOTE)}><BookOpen size={13}/>The 10-point stress test behind these</button>
  </>;
}

/** Long lists stay short until asked for. */
function CardGrid({title,icon:Icon,tone,entries,empty,render}) {
  const [limit,setLimit] = useState(PAGE);
  return <section className="mv-vf-section">
    <h2 className={`mv-vf-section-head ${tone?`is-${tone}`:''}`}><Icon size={15}/>{title}<b>{entries.length}</b></h2>
    {entries.length?<div className="mv-cg-grid">{entries.slice(0,limit).map(render)}</div>:<p className="mv-cg-quiet">{empty}</p>}
    {entries.length>limit&&<div className="mv-cg-more"><button className="mv-btn" onClick={()=>setLimit(limit+PAGE)}>Show {Math.min(PAGE,entries.length-limit)} more</button><small>{limit} of {entries.length}</small></div>}
  </section>;
}

export function VerifyPage(props) {
  const {current,leads,go,route,activity,data,openDoc} = props;
  const pipeline = current?.pipeline;
  const items = pipeline?.items;
  const view = useMemo(()=>gauntlet(items||[],leads||[]),[items,leads]);
  const [pick,setPick] = useState(route?.params?.check||null);
  if (!pipeline) return null;
  const toggle = id=>setPick(pick===id?null:id);
  const row = view.rows.find(entry=>entry.id===pick);
  const killedCard = (entry,index)=><VerifyCard key={entry.item.id} entry={entry} items={items} go={go} index={index} flag={entry.killed.name} tone="out" why={shortReason(entry.killed.note)}/>;
  const testingCard = (entry,index)=><VerifyCard key={entry.item.id} entry={entry} items={items} go={go} index={index} flag={`At ${entry.at.name}`} tone="live"/>;
  const asideCard = (entry,index)=><VerifyCard key={entry.item.id} entry={entry} items={items} go={go} index={index} flag={entry.item.outcome.label.replace(' · said in chat','')} why={shortReason(entry.item.outcome.reason)}/>;
  const pickIndex = row?VERIFY_CHECKS.findIndex(check=>check.id===row.id):-1;
  const PickIcon = row?CHECK_ICONS[row.id]||ListChecks:null;
  return <section className="mv-vf">
    <AgentStepHead shown="verify" pipeline={pipeline} activity={activity} team={data?.team} go={go}/>
    <div className="mv-vf-board">
      <div className="mv-vf-funnel" role="group" aria-label="How many products reach each check">
        <div className="mv-vf-labels" aria-hidden="true"><span>Check</span><span/><span>Left</span><span>Killed</span></div>
        <FunnelRow kind="start" icon={FlaskConical} name="Tested" left={view.tested} killed={0} total={view.tested} pressed={pick===null} onClick={()=>setPick(null)} title={`${view.tested} products have been through the hard test`}/>
        {view.rows.map(entry=><FunnelRow key={entry.id} icon={CHECK_ICONS[entry.id]||ListChecks} name={entry.name} left={entry.left} killed={entry.killed.length} total={view.tested} testing={entry.testing.length} pressed={pick===entry.id} onClick={()=>toggle(entry.id)} title={`${entry.rule} ${entry.entered} reached it, ${entry.killed.length} killed, ${entry.left} went on.`}/>)}
        <FunnelRow kind="end" icon={Trophy} name="Winners" left={view.winners.length} killed={0} total={view.tested} onClick={()=>go('winners')} title="See the winners"/>
      </div>
      <aside className="mv-vf-score">
        <div className="mv-vf-ring"><Ring value={view.killed.length} total={view.tested||1} size={132} stroke={11} color="var(--danger)" label={`${view.killRate}%`} sub="killed"/></div>
        <p>{view.killed.length.toLocaleString('en-US')} of {view.tested.toLocaleString('en-US')} didn't make it</p>
        <div className="mv-vf-score-tiles">
          <button type="button" className="is-tile-3" onClick={()=>setPick(null)}><b><CountUp value={view.testing.length}/></b><small>Testing</small></button>
          <button type="button" className="is-tile-6" onClick={()=>go('winners')}><b><CountUp value={view.winners.length}/></b><small>Winners</small></button>
          <button type="button" className="is-tile-4" aria-pressed={pick==='aside'} onClick={()=>toggle('aside')}><b><CountUp value={view.setAside.length}/></b><small>Set aside</small></button>
        </div>
      </aside>
    </div>
    {row&&<article className={`mv-vf-pick is-tile-${pickIndex%6+1}`}>
      <span className="mv-vf-pick-icon"><PickIcon size={20}/></span>
      <div><small>Check {pickIndex+1} of {VERIFY_CHECKS.length}</small><strong>{row.name}</strong><p>{row.rule}</p></div>
      <ul>{row.lines.map(line=><li key={line}><CheckCircle2 size={12}/>{line}</li>)}</ul>
    </article>}
    {row?<>
      {row.testing.length>0&&<CardGrid key={`${row.id}-testing`} title="Being tested here" icon={FlaskConical} tone="live" entries={row.testing} empty="" render={testingCard}/>}
      <CardGrid key={`${row.id}-killed`} title="Killed here" icon={Skull} tone="out" entries={row.killed} empty="Nothing has died at this check yet." render={killedCard}/>
    </>:pick==='aside'?<CardGrid key="aside" title="Set aside without a failed check" icon={Archive} entries={view.setAside} empty="Nothing here." render={asideCard}/>
    :<>
      <CardGrid key="testing" title="Being tested now" icon={FlaskConical} tone="live" entries={view.testing} empty="Nothing is being tested right now. Products come here from the catalog." render={testingCard}/>
      <CardGrid key="killed" title="Killed" icon={Skull} tone="out" entries={view.killed} empty="Nothing has been killed yet." render={killedCard}/>
    </>}
    <PanelTiles tiles={[
      {id:'checks',icon:ListChecks,tile:1,title:'The checks',sub:`${VERIFY_CHECKS.length} hard tests`,node:<ChecksList openDoc={openDoc}/>},
      ...stepReferenceTiles('prove',props),
      {id:'records',icon:LayoutGrid,tile:3,title:'Saved records',sub:'Funnel, source and profit',node:<><ValidateWork {...props}/><SourceWork {...props}/></>},
    ]}/>
  </section>;
}
