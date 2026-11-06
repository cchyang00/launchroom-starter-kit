import React,{useState} from 'react';
import {Check,ArrowLeft,ArrowRight,BookOpen,ChevronDown,ChevronRight,FolderOpen,NotebookPen,ArrowUpRight,LayoutGrid,ListChecks,Route,Hammer,Sparkles,Workflow,MessageSquareQuote,PlayCircle,ShieldCheck,Scale,Wrench} from 'lucide-react';
import {ErrorText} from './ui.jsx';
import {LINE,VISIBLE_LINE} from './workflowView.mjs';
import {effectiveCheckStatus} from './processModel.mjs';
import {PLAYBOOK_PATH,playbookStep} from './playbook.mjs';
import {usePlaybook,ProcedureText} from './ProcessProcedure.jsx';
import {StepNotes,useSearchSetup,researchRoute} from './ProcessMap.jsx';
import {STAGE_ICONS,STAGE_SLUGS,Chip,Avatar,roleOf} from './kit.jsx';
import {ProductBoard} from './ProductBoard.jsx';
import {ValidateWork,SourceWork,CreateWork,BuildWork,LaunchWork} from './StageWork.jsx';
import {StepCard} from './StepGuide.jsx';
import {IssueLibraryLink,StepGate,StatusChip} from './Issues.jsx';
import {CHECKS_PATH,BUYERS_ANCHOR} from './issues.mjs';
import {GATES,gateLine,gateLineText} from './gates.mjs';
import {StepTools} from './ToolsView.jsx';
import {stepRows,stepStations,lineStepChecks,issueStationOf,issueGroups} from './pipelineView.mjs';
import {StepRules,hasStepRules} from './StepRules.jsx';
import {PanelTiles} from './cards.jsx';
import {BUILD_FROM} from './pipeline.mjs';
import {RowList} from './Pipeline.jsx';
import {DISPLAY_LINE,displayIdOfStep,displayStations} from './displayLine.mjs';
import {LineTabs,useChecklists} from './LineNav.jsx';
import {AheadList} from './ProveAhead.jsx';

// A step page shows the products whose own line is at this step (rows from
// pipelineState), then how to start the step and its tools. There is no global
// "you are here": every product has its own line. Create, Build and Launch
// show the one product in the build slot.

/** The older A-to-Z playbook has six sections (Find, Validate, Source, Create, Build, Test); each of the seven steps opens its nearest one. */
const PLAYBOOK_INDEX = [0,1,1,3,4,5,5];

/**
 * Step 2 · Buyers (owner, Oct 2: product first, then its buyers): each saved
 * card at Buyers with its three gate lines (A1-A3) from the card's saved buyers
 * check, and the issue library as a reference. Read-only.
 */
function BuyersWork({current,leads,go,openDoc}) {
  const rows = stepRows(current?.pipeline,'buyers').items;
  const cards = new Map((leads||[]).map(lead=>[lead.id,lead.candidate]));
  return <section className="mv-card mv-pad mv-by" aria-label="Buyers research">
    <div className="mv-panel-title"><h2 className="mv-h3">What Buyers saves on each card</h2><button className="mv-link" onClick={()=>openDoc(`${CHECKS_PATH}#${BUYERS_ANCHOR}`)}><BookOpen size={13}/>How we research buyers</button></div>
    <p className="mv-small mv-by-intro">This product's own buyers: its TikTok comments and 2–4 star reviews (TikTok Shop first, Amazon as a cross-check), then forums. Saved on the card: 3+ avatars with their trigger moments, their exact words, objections, the benefit ladder and the angle nobody uses.</p>
    {rows.length?<ul className="mv-by-list">{rows.map(item=>{const lines=GATES.buyers.map(line=>gateLine(line,{candidate:cards.get(item.leadId)||null}));return <li key={item.id} className="mv-by-row">
      <button type="button" className="mv-by-name" onClick={()=>go(`product/${item.id}`)}><b>{item.id}</b><span>{item.name}</span></button>
      <span className="mv-by-lines">{lines.map(line=><span key={line.id} className={`mv-by-pill is-${line.state}`} title={gateLineText(line)}><i>{line.id}</i>{line.label}</span>)}</span>
    </li>;})}</ul>
    :<p className="mv-small">No saved product is waiting for buyers research. A card comes here when you press Save in the eye test.</p>}
    <div className="mv-by-lib"><IssueLibraryLink go={go} note="Buyers adds new quotes back"/></div>
  </section>;
}

/** Step 7 · Learn (Job 1 hook): the cycle reviews live in the Learning log until the result card and decision log arrive. */
function LearnWork({go,data}) {
  const reviews = data.workspace?.reviews||[];
  return <div className="mv-card mv-pad">
    <div className="mv-panel-title"><h2 className="mv-h3">Results and decisions</h2><Chip tone="muted">{reviews.length} cycle{reviews.length===1?'':'s'} reviewed</Chip></div>
    <p className="mv-small">After a test runs, each ad gets a result card (spend, clicks, add to cart, purchases, cost per sale against break-even) and a decision with the number behind it: kill, trim, keep or scale, by the rules above. Until those screens arrive, cycle reviews are saved in the Learning log.</p>
    <button className="mv-btn sm" onClick={()=>go('learning')}><BookOpen size={13}/>Open the Learning log</button>
  </div>;
}

/** What's inside each step's "The work" tile. */
const WORK_LABELS = {buyers:'Avatars and their words',prove:'Funnel, sourcing and profit',create:'Ads and copy',build:'Store pictures and checks',launch:'Launch gates',learn:'Results and decisions'};

/** The five product steps as tabs (Buyers & Prove it are completed upfront inside Product). */
export function StageTabs({stageId,go,stations=[]}) {
  return <nav className="mv-stage-tabs" aria-label="The five steps">
    {VISIBLE_LINE.map((stage,index)=>{
    const station = stations.find(s=>s.id===stage.id)||{count:0,ready:0,owner:false};
    const here = station.count+station.ready;
    return <button key={stage.id} className={`mv-stage-tab ${station.owner?'is-current':''}`} aria-current={stage.id===stageId?'page':undefined} onClick={()=>go(STAGE_SLUGS[stage.id])} title={`${stage.short}: ${station.label||'none'}`}>
      <i>{index+1}</i>{stage.short}{here>0&&<b className="mv-pl-tab-count">{here}</b>}
    </button>;
  })}</nav>;
}

function FindRoute({openDoc}) {
  const {items,ready} = useSearchSetup();
  const done = items.filter(item=>item.done).length;
  return <div className="mv-card mv-pad" style={{marginBottom:20}}>
    <div className="mv-panel-title"><h2 className="mv-h2"><Route size={17}/>How a product gets here</h2>
      <Chip tone={ready?'done':'owner'}>{items.length?`Search setup ${done}/${items.length}${ready?' · access verified':' · access check open'}`:'Checking access…'}</Chip></div>
    <div className="mv-route">{researchRoute.map(([label,tool,path],index)=><button key={label} className={index===0&&ready?'is-done':''} onClick={()=>openDoc(path)}>
      <b>{String(index+1).padStart(2,'0')} · {label.toUpperCase()}</b><strong>{tool}</strong><small>{index===2?'You decide here':'Open method'}</small>
    </button>)}</div>
  </div>;
}

function Method({index,stage,openDoc,hub,notify}) {
  const playbook = usePlaybook();
  const [open,setOpen] = useState(null),[notes,setNotes] = useState(false);
  const section = playbook.sections.find(item=>item.number===index+1);
  const map = hub.maps.find(item=>item.title==='Product launch process');
  const node = map?.nodes.find(item=>item.id===`stage-${stage.id}`);
  return <div className="mv-method">
    <div>
      <ErrorText error={playbook.error}/>
      {!section?<div className="mv-card mv-empty">{playbook.error?'The playbook could not be loaded.':'Loading the steps from the playbook…'}</div>
      :<ol className="mv-steps">{section.actions.map(action=><li key={action.id} className={`mv-step ${open===action.id?'is-open':''}`}>
        <button aria-expanded={open===action.id} onClick={()=>setOpen(open===action.id?null:action.id)}><span className="mv-step-num">{action.id}</span><strong>{action.title}</strong>{open===action.id?<ChevronDown size={16}/>:<ChevronRight size={16}/>}</button>
        {open===action.id&&<div className="mv-step-body">
          <div className="mv-step-actions"><button className="mv-btn sm" onClick={()=>openDoc(action.path)}><BookOpen size={13}/>Open in playbook</button></div>
          <ProcedureText openDoc={openDoc}>{action.content}</ProcedureText>
        </div>}
      </li>)}</ol>}
      {section?.intro&&<details className="mv-card mv-pad" style={{marginTop:14}}><summary style={{cursor:'pointer',fontWeight:600}}>Inputs, output and decision context</summary><div style={{marginTop:12}}><ProcedureText openDoc={openDoc}>{section.intro}</ProcedureText></div></details>}
    </div>
    <aside className="mv-stack">
      <div className="mv-aside-card"><h3 className="mv-h3">References</h3><div className="mv-aside-links">
        <button onClick={()=>openDoc(playbookStep(index))}><BookOpen size={15}/>Full method<ArrowUpRight size={13}/></button>
        {node?.reference&&node.reference!==PLAYBOOK_PATH&&(/^https?:/.test(node.reference)?<a href={node.reference} target="_blank" rel="noreferrer"><FolderOpen size={15}/>Saved findings<ArrowUpRight size={13}/></a>:<button onClick={()=>openDoc(node.reference)}><FolderOpen size={15}/>Saved findings<ArrowUpRight size={13}/></button>)}
        <button disabled={!node} onClick={()=>setNotes(true)}><NotebookPen size={15}/>Stage notes<ArrowRight size={13}/></button>
        <button onClick={()=>openDoc('workflow/PLAYBOOK.md')}><ListChecks size={15}/>A-to-Z playbook<ArrowUpRight size={13}/></button>
      </div></div>
      {node?.note&&<div className="mv-aside-card"><h3 className="mv-h3">Latest stage note</h3><p className="mv-small" style={{margin:0,whiteSpace:'pre-wrap'}}>{node.note.slice(0,600)}{node.note.length>600?'…':''}</p></div>}
    </aside>
    {notes&&node&&<StepNotes map={map} node={node} onClose={()=>setNotes(false)} onSave={()=>{setNotes(false);notify('Stage notes saved. Verification progress is unchanged.');}}/>}
  </div>;
}

/**
 * What finishes this step for a product, read-only. On Create, Build and
 * Launch the statuses are the building product's; on the other steps every
 * product records these on its own line (its page shows them).
 */
function ExitChecks({step,market,building,openDoc,go}) {
  const statusFor = check => building&&market?effectiveCheckStatus(market,check.id):null;
  return <div className="mv-grid-2">
    <div className="mv-checks">
      {step.items.map(check=>{
        const status = statusFor(check), proof = market?.checks?.[check.id];
        return <div key={check.id} className={`mv-check ${status?`is-${status}`:''}`}>
          <span className="mv-check-box">{status==='verified'&&<Check size={15} strokeWidth={3}/>}</span>
          <span><strong>{check.title}</strong><p>{check.description}</p>{proof?.note&&status==='verified'&&<p style={{color:'var(--success)'}}>{proof.note}</p>}</span>
          {status?<Chip tone={status==='verified'?'done':status==='blocked'?'bad':'muted'}>{status==='verified'?'Reviewed':status==='blocked'?'Blocked':'Open'}</Chip>:<Chip tone="muted">Per product</Chip>}
        </div>;
      })}
    </div>
    <aside className="mv-stack">
      <div className="mv-aside-card"><h3 className="mv-h3">What finishes this step</h3><p className="mv-small" style={{margin:0}}>{building?`These are ${building.name}'s checks, the product in the build slot. `:'Each product records these on its own line; open a product to see its checks. '}Each check needs a source, the date it was observed and a reviewer's note. A finished task, an agent run or viewing this page does not count.</p>
        <div className="mv-aside-links">{[...new Set(step.items.map(check=>check.sourceDoc).filter(Boolean))].map(path=><button key={path} onClick={()=>openDoc(path)}><BookOpen size={15}/>{path.split('/').pop()}<ArrowUpRight size={13}/></button>)}</div>
        {building&&<button className="mv-btn sm" onClick={()=>go(`product/${building.id}`)}><Workflow size={13}/>Open {building.id}'s line</button>}
      </div>
    </aside>
  </div>;
}

/**
 * Step 1's cards grouped by their round's issue (owner, Oct 3: rounds start
 * from the issues the owner is testing). A round without an issue groups last.
 */
function ProductIssueGroups({pipeline,items,shared,go}) {
  const groups = issueGroups(pipeline,items);
  return <>{groups.map(group=><div key={group.key} className="mv-il-pgroup">
    <h3 className="mv-il-group-head">{group.slug?<button type="button" onClick={()=>go(`issues?issue=${encodeURIComponent(group.slug)}`)} title={`Open the ${group.slug} issue`}><MessageSquareQuote size={14}/><span>Issue: {group.title}</span></button>:<span>No issue named</span>}
      {group.status&&<StatusChip status={group.status}/>}<small>{group.items.length} card{group.items.length===1?'':'s'}</small></h3>
    <RowList items={group.items} {...shared}/>
  </div>)}</>;
}

/** The products whose own line is at this step, as pipeline rows. */
function StepProducts(props) {
  const {pipeline,stageId,name,data,go,planner,activity} = props;
  const rows = stepRows(pipeline,stageId);
  const shared = {team:data.team,go,tasks:planner?.tasks||[],activity};
  const count = rows.items.length+rows.ready.length+(rows.buildStep&&!rows.items.length&&rows.building?1:0);
  return <section className="mv-card mv-pl-steprows" aria-label={`Products at ${name}`}>
    <div className="mv-panel-title"><h2 className="mv-h3">{rows.buildStep?'The product in the build slot':`Products at ${name}`} <Chip tone={count?'active':'muted'}>{count}</Chip></h2><button className="mv-link" onClick={()=>go('pipeline')}>Whole pipeline<ArrowUpRight size={13}/></button></div>
    {rows.buildStep?(rows.items.length?<RowList wide items={rows.items} {...shared}/>
      :rows.building?<RowList wide items={[rows.building]} {...shared}/>
      :<p className="mv-pl-steprows-note"><Hammer size={14}/>No product is building yet. Pick one from Ready to build on the Pipeline page.</p>)
    :stageId==='product'&&rows.items.length?<ProductIssueGroups pipeline={pipeline} items={rows.items} shared={shared} go={go}/>
    :<RowList items={rows.items} {...shared} empty={rows.ready.length?'':`No product is at ${name} right now.`}/>}
    {rows.ready.length>0&&<>
      <h3 className="mv-h3" style={{margin:rows.items.length?'16px 0 10px':'2px 0 10px',display:'flex',alignItems:'center',gap:6,color:'var(--highlight-text)'}}><Sparkles size={14}/>Ready to build</h3>
      <RowList items={rows.ready} {...shared} actionFor={item=>pipeline.building?<span className="mv-pl-action is-off" title={`${pipeline.building.name} holds the build slot`}>Slot taken</span>:<button className="mv-btn sm accent mv-pl-action" onClick={()=>go(`product/${item.id}?build=1`)}><Hammer size={13}/>Build this one</button>}/>
    </>}
  </section>;
}

/** How a step works and its rules, as tiles for the pages the agents run (Product and Verify). */
export function stepReferenceTiles(stageId,props) {
  const {data,flow,hub,notify,openDoc,go,line,tools} = props;
  const index = LINE.findIndex(stage=>stage.id===stageId);
  const step = lineStepChecks(flow,index), guide = line?.steps?.[index]||null, target = step.firstOpen||flow.steps[0];
  return [
    {id:'how',icon:PlayCircle,tile:4,title:'How it works',sub:'The method',node:<>{stageId==='product'&&<FindRoute openDoc={openDoc}/>}<StepCard guide={guide} team={data.team} openDoc={openDoc}/><div style={{marginTop:14}}><Method index={PLAYBOOK_INDEX[index]??0} stage={target||step} openDoc={openDoc} hub={hub} notify={notify}/></div></>},
    {id:'gate',icon:ShieldCheck,tile:6,title:'Gate rules',sub:'Rules and tools',node:<><StepGate index={index} openDoc={openDoc}/>{hasStepRules(stageId)&&<StepRules stepId={stageId} openDoc={openDoc}/>}<StepTools tools={tools} stepId={stageId} go={go}/><ExitChecks step={step} market={null} building={null} openDoc={openDoc} go={go}/></>},
  ];
}

export function StagePage(props) {
  const {stageId,data,flow,scope,go,openDoc,hub,notify,signals,current,line} = props;
  const index = LINE.findIndex(stage=>stage.id===stageId);
  // The product checks under this step (Prove it joins three check stages; Product and Buyers have their card gates instead).
  const stage = LINE[index], step = lineStepChecks(flow,index), Icon = STAGE_ICONS[stageId];
  const pipeline = current?.pipeline;
  const stations = stepStations(pipeline);
  const station = stations[index]||{count:0,ready:0,label:'none'};
  const buildStep = index>=BUILD_FROM;
  // Create, Build and Launch belong to the product in the build slot; earlier steps are per product.
  const product = buildStep?scope.product:null, market = buildStep?scope.market:null;
  const building = pipeline?.building||null;
  const [view,setView] = useState('work');
  const owner = step.owner;
  const guide = line?.steps?.[index]||null;
  // The older playbook has six sections (Find to Test); the method itself is workflow/CHECKS.md.
  const target = step.firstOpen||flow.steps[0];
  const signal = signals[stageId]||{};
  // Product: the cards and the eye test. Buyers: each saved card's buyers research. Prove it: the opening, source and profit work (old Validate and Source).
  const work = stageId==='buyers'?<BuyersWork {...props}/>
    :stageId==='product'?<ProductBoard {...props}/>
    :stageId==='prove'?<><ValidateWork {...props}/><SourceWork {...props}/></>
    :stageId==='create'?<CreateWork {...props}/>
    :stageId==='build'?<BuildWork {...props}/>
    :stageId==='launch'?<LaunchWork {...props}/>
    :<LearnWork go={go} data={data}/>;
  // The owner's six steps (src/displayLine.mjs): where this saved step sits, and its neighbours. #/launch is Launch itself; Checklist has its own page.
  const shown = stageId==='launch'?'launch':displayIdOfStep(stageId), shownIndex = DISPLAY_LINE.findIndex(entry=>entry.id===shown), shownEntry = DISPLAY_LINE[shownIndex];
  const prevSlug = DISPLAY_LINE[shownIndex-1]?.slug, nextSlug = DISPLAY_LINE[shownIndex+1]?.slug;
  // The count on the page matches the sidebar: Build holds Create and Build together.
  const checklists = useChecklists();
  const shownStation = displayStations(pipeline,checklists).find(entry=>entry.id===shown)||station;
  const here = shownStation.count+shownStation.ready;
  return <section>
    <LineTabs active={shown} pipeline={pipeline} go={go}/>
    <header className="mv-stage-hero mv-cd-hero">
      <div className="mv-stage-icon"><Icon size={32}/><span>{shownIndex+1}</span></div>
      <div>
        <span className="mv-eyebrow">Step {shownIndex+1} of {DISPLAY_LINE.length}</span>
        <h1>{shownEntry.title}</h1>
        <p title={guide?.purpose||stage.goal}>{shownEntry.goal}</p>
        <div className="mv-stage-meta">
          <Chip><Avatar role={owner} size={16}/>{roleOf(owner).name} leads</Chip>
          {signal.value!==undefined&&<Chip tone={signal.owner?'owner':''}>{signal.value} {signal.label}</Chip>}
          {signal.detail&&<Chip tone="muted">{signal.detail}</Chip>}
        </div>
      </div>
      <div className="mv-stage-side">
        <div className={`mv-pl-stepcount ${shownStation.owner?'is-owner':''}`}><b>{here}</b><small>{here===1?'product here':'products here'}</small></div>
        <div className="mv-stage-side-actions">
          <div style={{display:'flex',gap:6}}>
            <button className="mv-btn sm" disabled={!prevSlug} onClick={()=>go(prevSlug)} aria-label="Previous step"><ArrowLeft size={14}/></button>
            <button className="mv-btn sm" style={{flex:1}} disabled={!nextSlug} onClick={()=>go(nextSlug)}>Next step<ArrowRight size={14}/></button>
          </div>
        </div>
      </div>
    </header>
    {stageId==='product' ? (
      <>
        <div className="mv-view-tabs" role="group" aria-label="Step views" style={{marginBottom:14}}>
          <button aria-pressed={view==='work'} onClick={()=>setView('work')}><LayoutGrid size={15}/>Product Cards & Videos</button>
          <button aria-pressed={view==='method'} onClick={()=>setView('method')}><BookOpen size={15}/>How we scout & check</button>
          <button aria-pressed={view==='checks'} onClick={()=>setView('checks')}><ListChecks size={15}/>Gate rules (F1–F6)</button>
        </div>
        {view==='work'&&work}
        {view==='method'&&<><FindRoute openDoc={openDoc}/><StepCard guide={guide} team={data.team} openDoc={openDoc}/><Method index={PLAYBOOK_INDEX[index]??0} stage={target||step} openDoc={openDoc} hub={hub} notify={notify}/></>}
        {view==='checks'&&<><StepGate index={index} openDoc={openDoc}/><StepRules stepId={stageId} openDoc={openDoc}/><StepTools tools={props.tools} stepId={stageId} go={go}/><ExitChecks step={step} market={market} building={buildStep&&product?building:null} openDoc={openDoc} go={go}/></>}
      </>
    ) : (
      <>
        {stageId==='prove'&&pipeline&&<AheadList pipeline={pipeline} leads={props.leads} proveAhead={props.proveAhead} recordDecision={props.recordDecision} go={go} openDoc={openDoc}/>}
        {pipeline&&<StepProducts pipeline={pipeline} stageId={stageId} name={stage.short} {...props}/>}
        <PanelTiles start={stageId==='create'?'work':null} tiles={[
          {id:'work',icon:LayoutGrid,tile:1,title:'The work',sub:WORK_LABELS[stageId]||'Records and tools',node:<>
            <div className="mv-view-tabs" role="group" aria-label="Step views" style={{marginTop:0}}>
              <button aria-pressed={view==='work'} onClick={()=>setView('work')}><LayoutGrid size={15}/>Work</button>
              <button aria-pressed={view==='method'} onClick={()=>setView('method')}><BookOpen size={15}/>How to do it</button>
              <button aria-pressed={view==='checks'} onClick={()=>setView('checks')}><ListChecks size={15}/>Exit checks{product?<b>{step.done}/{step.total}</b>:<b>{step.total}</b>}</button>
            </div>
            {view==='work'&&work}
            {view==='method'&&<Method index={PLAYBOOK_INDEX[index]??0} stage={target||step} openDoc={openDoc} hub={hub} notify={notify}/>}
            {view==='checks'&&<ExitChecks step={step} market={market} building={buildStep&&product?building:null} openDoc={openDoc} go={go}/>}
          </>},
          {id:'start',icon:PlayCircle,tile:4,title:'How to start',sub:'Start, done, your part',node:<StepCard guide={guide} team={data.team} openDoc={openDoc}/>},
          {id:'gate',icon:ShieldCheck,tile:6,title:'The gate',sub:'True before moving on',node:<StepGate index={index} openDoc={openDoc}/>},
          hasStepRules(stageId)&&{id:'rules',icon:Scale,tile:2,title:'Starting rules',sub:'And whose number each is',node:<StepRules stepId={stageId} openDoc={openDoc}/>},
          {id:'tools',icon:Wrench,tile:3,title:'Tools',sub:'Open one in a tap',node:<StepTools tools={props.tools} stepId={stageId} go={go}/>},
        ]}/>
      </>
    )}
  </section>;
}
