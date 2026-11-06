import React,{createContext,useContext,useState} from 'react';
import {Check,X,ArrowRight,ChevronDown,ChevronUp,CircleHelp,Hammer,Sparkles,User,Flag,RotateCcw,History,Compass,Package,MessageSquareQuote} from 'lucide-react';
import {pipelineGroups,roundHeader,stepStations,visibleStations,issueStationOf,itemActivity,lastTouch,moveText,whoLabel,focusLine,productLabel,liveWork} from './pipelineView.mjs';
import {STAGE_ICONS,STAGE_SLUGS,Chip,Avatar,AgentAvatar,LeadImage,agentOf,timeAgo} from './kit.jsx';
import './pipeline.css';
import {StatusChip} from './Issues.jsx';
import {StatsMini,ValidationOverview} from './StatsPanel.jsx';
import './issues.css';
import {DISPLAY_LINE,displayIdOfStep,displayStations,stationItems} from './displayLine.mjs';
import {DISPLAY_ICONS,useChecklists} from './LineNav.jsx';
import {CardMedia,Metric,Spark,StepBar,useHoverPlay} from './cards.jsx';
import {firstImageAd} from './campaignView.mjs';
import {assetUrl} from './kit.jsx';
import {compactNumber} from './statsPanel.mjs';
import {cardName,markupOf,trendInDoubt,evidenceIndex,idList} from './productView.mjs';

// The Pipeline (owner, Oct 1 and 2): every product has its own seven-step line. Rows,
// counts and steps come from pipelineState (saved cards, products, rounds and
// the owner's build pick); nothing on this page moves a product. Clicking a
// row opens that product's own page (#/product/<L###|P###>).

/** The pipeline for chips anywhere in the app (App provides it from currentStep). */
export const PipelineContext = createContext(null);

/** A task's or report's product (L### or P###) as a small tag with its name. */
export function ProductTag({value}) {
  const pipeline = useContext(PipelineContext);
  if (!value) return null;
  return <span className="mv-pl-tag" title="The product this is about"><Package size={11}/>{productLabel(pipeline,value,28)}</span>;
}

const STATE_WORDS = {done:'done',current:'here now',todo:'not yet',stopped:'stopped here',waiting:'waits for the build slot',early:'still open (launched early)'};
const shortDay = value => {const d=/^\d{4}-\d{2}-\d{2}$/.test(value||'')?new Date(value+'T12:00:00'):new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';};
export const when = value => !value?'':/^\d{4}-\d{2}-\d{2}$/.test(value)?shortDay(value):timeAgo(value);

/** Five small dots: this product's own line (Product, Create, Build, Launch, Learn). */
export function LineDots({line=[],label}) {
  const visible = line.filter(step=>step.id!=='buyers'&&step.id!=='prove');
  return <span className="mv-pl-dots" role="img" aria-label={label||visible.map(step=>`${step.name} ${STATE_WORDS[step.state]||step.state}`).join(', ')}>
    {visible.map(step=><i key={step.id} className={`is-${step.state}`} title={`${step.name} · ${STATE_WORDS[step.state]||step.state}${step.total?` · ${step.done}/${step.total}`:''}`}>{step.state==='stopped'&&<X size={7} strokeWidth={3.5}/>}</i>)}
  </span>;
}

/** Who moves next: the owner in orange, Claude, or a team agent with its avatar. */
export function WhoChip({who,team,size=18}) {
  if (!who) return null;
  if (who==='owner') return <span className="mv-pl-who is-owner"><User size={11}/>You</span>;
  const agent = who==='manager'?null:agentOf(team,who);
  return <span className="mv-pl-who">{agent?<AgentAvatar agent={agent} size={size}/>:<Avatar role="manager" size={size}/>}{who==='manager'?'Claude':agent?.name||whoLabel(who)}</span>;
}

/** An agent's avatar (Claude for the manager), for live work chips. */
function LiveAvatar({agent,team,size=20}) {
  const member = agent==='manager'?null:agentOf(team,agent);
  return member?<AgentAvatar agent={member} size={size}/>:<Avatar role="manager" size={size}/>;
}

/**
 * Who is working right now (live running reports from liveWork): the agent's
 * avatar and name, its latest event and how long ago. Opens the Agents tab.
 */
export function LiveNow({entries=[],team,go,variant='strip',limit=2}) {
  if (!entries.length) return null;
  const Tag = variant==='station'?'span':'button';
  return <span className={`mv-pl-live is-${variant}`}>{entries.slice(0,limit).map(entry=><Tag key={entry.reportId} className="mv-pl-live-item" onClick={variant==='station'?undefined:event=>{event.stopPropagation();go('agents');}} title={`${entry.name}: ${entry.title}. ${entry.latest} (open the Agents tab)`}>
    <span className="mv-pl-live-pulse" aria-hidden="true"/>
    <LiveAvatar agent={entry.agent} team={team} size={variant==='station'?16:20}/>
    <span className="mv-pl-live-text"><b>{entry.name}</b><span>{entry.latest}</span></span>
    <time className="mv-pl-live-time">{timeAgo(entry.at)}</time>
  </Tag>)}{entries.length>limit&&<span className="mv-pl-live-more">+{entries.length-limit} more</span>}</span>;
}

/** One product's row: photo, name, its own seven-dot line, step, next move with who, and the last update. */
export function PipelineRow({item,team,go,tasks,activity,action,live}) {
  const last = lastTouch(item,{tasks,activity});
  const out = Boolean(item.outcome);
  return <div className={`mv-pl-row ${item.owner&&!out?'is-owner':''} ${out?'is-out':''} ${item.building?'is-building':''}`}>
    <button className="mv-pl-row-main" onClick={()=>go(`product/${item.id}`)} aria-label={`Open ${item.id} ${item.name}: ${item.status}`}>
      <span className="mv-pl-thumb">{item.image?<LeadImage lead={item} size={44}/>:<span className="mv-pl-thumb-id">{item.id}</span>}</span>
      <span className="mv-pl-name"><strong>{item.name}</strong><small>{item.id}{item.productId?` · ${item.productId.split('-')[0]}`:''}{item.country?` · ${item.country}`:''}{item.roundId?` · ${item.roundId}`:''}{item.unlinked?' · not started from a card':''}</small>{item.leadId&&(item.stats||item.validation)&&<StatsMini summary={item.stats??null} validation={item.validation??null}/>}</span>
      <span className="mv-pl-where"><LineDots line={item.line}/><small>{out?`Stopped at ${item.stepName}`:item.readyToBuild?'Ready to build':`${item.stepName}`}</small></span>
      <span className="mv-pl-next">{out?<><Chip tone={/rejected|killed|failed/.test(item.outcome.kind)?'bad':'muted'}>{item.outcome.label}</Chip><small className="mv-pl-reason">{item.outcome.reason||'No reason saved'}</small></>
        :<><span className="mv-pl-status">{item.status}</span><span className="mv-pl-move"><WhoChip who={item.who} team={team}/><small>{moveText(item.next)}</small></span></>}</span>
      <span className="mv-pl-when">{when(last)||'—'}</span>
    </button>
    {action}
    {live?.items?.[item.id]?.length>0&&<div className="mv-pl-row-live"><LiveNow entries={live.items[item.id]} team={team} go={go}/></div>}
  </div>;
}

/** Where a product stands in one flag on its picture. */
function cardFlag(item) {
  if (item.outcome) return {text:item.outcome.label,tone:'out'};
  if (item.readyToBuild) return {text:'Ready to build',tone:'ready'};
  if (item.building) return {text:`Building · ${item.stepName}`,tone:'building'};
  if (item.owner) return {text:'Your move',tone:'owner'};
  return {text:item.stepName,tone:''};
}

/**
 * One product as a card (owner, Nov 4: "more interactive and a lot more cards"): its
 * picture (its video plays on hover), its rise, the four numbers that matter, where it
 * is on the six steps and one action. The words live on its page, one tap away.
 */
export function ProductCard({item,team,go,action,live,wide=false,index=0}) {
  const [playing,hover] = useHoverPlay();
  const pipeline = useContext(PipelineContext);
  const v = item.validation, kalo = v?.kalodata, meta = v?.meta;
  const doubt = trendInDoubt(item,pipeline?.items);
  const flag = cardFlag(item);
  const at = Math.max(0,DISPLAY_LINE.findIndex(step=>step.id===displayIdOfStep(item.stepId)));
  const metaCount = meta?.liveAds??meta?.advertisers??null;
  const metaTone = meta?.tone==='good'?'good':meta?.tone==='bad'?'bad':meta?.tone==='ok'?'ok':'';
  const markup = markupOf(v);
  const metrics = <>
    <Metric label="Sold" value={Number.isFinite(kalo?.units)?compactNumber(kalo.units):''} title={kalo?.unitsText}/>
    <Metric label="Video sales" value={kalo?.videoGmvText} title="Kalodata: sales from creator videos"/>
    <Metric label="Meta ads" value={metaCount} tone={metaTone} title={meta?.badge}/>
    <Metric label="Markup" value={markup?`${markup.toFixed(1)}x`:''} tone={markup?(markup>=3?'good':'bad'):''} title={v?.money?.sell&&v?.money?.landed?`Sell ${v.money.sell}, landed cost ${v.money.landed}`:undefined}/>
  </>;
  const entries = live?.items?.[item.id]||[];
  const where = <div className="mv-cd-pcard-where">
    <small><span>{item.readyToBuild?'Verified':item.outcome?`Stopped at ${item.stepName}`:DISPLAY_LINE[at]?.short}</span><em>{at+1} of {DISPLAY_LINE.length}</em></small>
    <StepBar at={at} stopped={Boolean(item.outcome)}/>
  </div>;
  const next = !item.readyToBuild&&!item.outcome&&item.next&&<div className="mv-cd-next"><WhoChip who={item.who} team={team}/><small title={moveText(item.next)}>{moveText(item.next)}</small></div>;
  return <article className={`mv-cd-pcard mv-cd-rise ${item.owner&&!item.outcome?'is-owner':''} ${item.building?'is-building':''} ${item.outcome?'is-out':''} ${wide?'is-wide':''}`} style={{'--i':Math.min(index,12)}} {...hover}>
    <button type="button" className="mv-cd-pcard-hit" onClick={()=>go(`product/${item.id}`)} aria-label={`Open ${item.id} ${item.name}: ${item.status}`}/>
    <CardMedia image={item.image} video={item.video} playing={playing} alt={item.name} placeholder={item.id}>
      <span className={`mv-cd-flag ${flag.tone?`is-${flag.tone}`:''}`}>{flag.text}</span>
      <span className="mv-cd-id">{item.id}</span>
      <span className="mv-cd-tags">
        {v&&Number.isFinite(v.changePercent)&&<span className={`mv-cd-trend is-${doubt?'doubt':v.direction}`} title={doubt?`Unverified: the same curve is saved on ${idList(evidenceIndex(pipeline?.items).get(item.id)?.curve||[])}`:undefined}>{doubt&&<CircleHelp size={11}/>}{v.changePercent>0?'+':''}{v.changePercent}%</span>}
        {v?.money?.sell&&<span className="mv-cd-price">{v.money.sell}</span>}
      </span>
    </CardMedia>
    <div className="mv-cd-pcard-body">
      <h3 title={item.name}>{cardName(item.name)}</h3>
      {wide?<div className="mv-cd-pcard-widerow"><div className="mv-cd-metrics is-four">{metrics}</div>{v?.series?.points?.length>=2&&<Spark points={v.series.points} tone={doubt?'doubt':v.direction} height={46}/>}</div>
        :<>{v?.series?.points?.length>=2&&<Spark points={v.series.points} tone={doubt?'doubt':v.direction} height={38}/>}<div className="mv-cd-metrics">{metrics}</div></>}
      {where}
      {next}
      {entries.length>0&&<div className="mv-cd-pcard-live"><LiveNow entries={entries} team={team} go={go} limit={1}/></div>}
      {action&&<div className="mv-cd-pcard-foot">{action}</div>}
    </div>
  </article>;
}

/** Products as cards. `rows` keeps the compact list, used for history. */
export function RowList({items,team,go,tasks,activity,actionFor,empty,live,rows=false,wide=false}) {
  if (!items.length) return empty?<p className="mv-small mv-pl-empty">{empty}</p>:null;
  if (rows) return <div className="mv-pl-rows">{items.map(item=><PipelineRow key={item.id} item={item} team={team} go={go} tasks={tasks} activity={activity} action={actionFor?.(item)} live={live}/>)}</div>;
  return <div className={wide?'mv-cd-pwide':'mv-cd-pgrid'}>{items.map((item,index)=><ProductCard key={item.id} item={item} team={team} go={go} live={live} action={actionFor?.(item)} index={index} wide={wide}/>)}</div>;
}

/**
 * The six steps as tiles: how many products are at each and their faces. Clicking a tile
 * opens that step. Counts come from displayStations; a live dot means an agent is on it.
 */
export function StepBoard({pipeline,go,live,team,campaigns=[]}) {
  const checklists = useChecklists();
  const stations = displayStations(pipeline,checklists);
  return <div className="mv-cd-board" role="list" aria-label="The products at each step">
    {stations.map(station=>{
      const Icon = DISPLAY_ICONS[station.id];
      const here = station.count+station.ready;
      const entries = station.stepIndexes.flatMap(i=>live?.steps?.[i]||[]);
      const pictures = station.id==='improve'?campaigns.map(firstImageAd):stationItems(pipeline,checklists,station.id).map(item=>item.image);
      const faces = pictures.filter(Boolean);
      return <button key={station.id} type="button" role="listitem" className={`mv-cd-station ${here?'has-items':''} ${station.owner?'is-owner':''}`} onClick={()=>go(station.target)} title={`${station.short}: ${station.label}`}>
        <span className="mv-cd-station-top"><span className="mv-cd-station-icon"><Icon size={15} strokeWidth={2.3}/></span><em>{station.number}</em></span>
        <span className="mv-cd-station-count">{here}</span>
        <span className="mv-cd-station-name">{station.short}</span>
        {faces.length?<span className="mv-cd-thumbs">{faces.slice(0,3).map((path,i)=><img key={`${path}-${i}`} src={assetUrl(path)} alt="" loading="lazy"/>)}{faces.length>3&&<span>+{faces.length-3}</span>}</span>
          :<span className="mv-cd-station-empty">{here?`${here} here`:'None yet'}</span>}
        {entries.length>0&&<span className="mv-cd-station-live"><span className="mv-pl-live-pulse" aria-hidden="true"/><span>{entries[0].name}</span></span>}
      </button>;
    })}
  </div>;
}

/**
 * Step 0 (the issue list, owner Oct 3) and the seven product stations: how
 * many issues and how many the owner is testing, then the products at each
 * step (Product, Buyers, Prove it, then the build slot's four). `hero` is the
 * Home hero; otherwise compact.
 */
export function Stations({pipeline,go,variant='compact',live,team}) {
  // The owner's six steps (Nov 4): Product, Verify, Build, Checklist, Launch, Improve (src/displayLine.mjs).
  const stations = displayStations(pipeline,useChecklists());
  const liveAt = station=>station.stepIndexes.flatMap(i=>live?.steps?.[i]||[]);
  return <div className={`mv-pl-stations is-${variant}`} role="list" aria-label="The products at each step">
    {stations.map(station=>{const Icon=DISPLAY_ICONS[station.id];const entries=liveAt(station);return <button role="listitem" key={station.id} className={`mv-pl-station ${station.count||station.ready?'has-items':''} ${station.owner?'is-owner':''} ${entries.length?'has-live':''}`} onClick={()=>go(station.target)} title={`${station.name}: ${station.label}`}>
      <span className="mv-pl-station-node"><Icon size={variant==='hero'?20:15}/>{(station.count+station.ready)>0&&<b>{station.count+station.ready}</b>}</span>
      <span className="mv-pl-station-text"><small>Step {station.number}</small><strong>{station.name}</strong><em>{station.ready?`${station.count} · ${station.ready} ready`:station.count?`${station.count} product${station.count===1?'':'s'}`:'none'}</em></span>
      {entries.length>0&&<LiveNow entries={entries} team={team} go={go} variant="station" limit={1}/>}
    </button>;})}
  </div>;
}

/** The round header: "Round N · focus · started", its state, the counts and the focus move. */
function RoundHeader({pipeline,go,live,team,campaigns}) {
  const head = roundHeader(pipeline);
  const focus = focusLine(pipeline,live);
  const searching = focus.searching;
  return <section className="mv-card mv-pl-round" aria-label="The current round">
    <div className="mv-pl-round-top">
      <div className="mv-pl-round-title">
        <span className="mv-eyebrow">{head.round?`${head.label} · started ${shortDay(head.started)}`:'No round yet'}</span>
        <h2 className="mv-h2">{head.round?head.focus:'Start the first round'}</h2>
      </div>
      <Chip tone={head.state==='review'?'owner':head.state==='reviewed'?'done':head.state==='open'?'active':'muted'}>{head.stateLabel}</Chip>
    </div>
    <StepBoard pipeline={pipeline} go={go} live={live} team={team} campaigns={campaigns}/>
    {searching?<button className="mv-pl-focus mv-pl-focus-live" onClick={()=>go('agents')} title="Open the Agents tab">
      <span className="mv-pl-live-pulse" aria-hidden="true"/><LiveAvatar agent={searching.agent} team={team} size={22}/>
      <span><b>Scout is searching for {focus.round} cards</b>{searching.latest}<small> · {timeAgo(searching.at)}</small></span>
    </button>
    :<div className={`mv-pl-focus ${focus.owner?'is-owner':''}`}><Flag size={14}/><span><b>Focus now</b>{focus.next||'Nothing on the line.'}</span></div>}
  </section>;
}

function BuildingCard({item,team,go,tasks,activity,workspace,live}) {
  const mine = itemActivity(item,{tasks,activity});
  const pick = workspace?.build;
  return <section className="mv-pl-building" aria-label="Building now">
    <div className="mv-pl-building-head"><span className="mv-pl-building-mark"><Hammer size={18}/></span><h2>Building now</h2>
      <button className="mv-btn sm" onClick={()=>go(`product/${item.id}`)}>Open its line<ArrowRight size={13}/></button></div>
    <ProductCard item={item} team={team} go={go} live={live} wide/>
    {item.validation&&<details className="mv-cd-rules"><summary><Check size={14}/>The hard rules check<ChevronDown size={14}/></summary><ValidationOverview validation={item.validation}/></details>}
    {pick?.reason&&<p className="mv-small mv-pl-pick">Your pick{pick.pickedAt?` on ${shortDay(pick.pickedAt)}`:''}{pick.override?` · launched early, ${pick.missing?.length||0} earlier checks still open`:''}: “{pick.reason}”</p>}
    {mine.events[0]&&<p className="mv-small mv-pl-pick"><History size={12}/>Latest: {mine.events[0].text} · {timeAgo(mine.events[0].at)}</p>}
  </section>;
}

function RoundReview({pipeline}) {
  const r = pipeline?.round;
  if (!r) return null;
  // Only once it is due or saved; while the round runs it would be noise.
  if (!r.review&&!r.needsReview) return null;
  return <div className="mv-card mv-pad mv-pl-review">
    <div className="mv-panel-title"><h3 className="mv-h3">Round {r.number} review</h3><Chip tone={r.review?'done':r.needsReview?'owner':'muted'}>{r.review?`Saved ${shortDay(r.review.reviewedOn)}`:r.needsReview?'Ready to review':'Not yet'}</Chip></div>
    {r.review?<dl className="mv-pl-review-list">
      <div><dt>What worked</dt><dd>{r.review.whatWorked}</dd></div>
      <div><dt>What failed</dt><dd>{r.review.whatFailed}</dd></div>
      <div><dt>Next round</dt><dd>{r.review.nextChanges}</dd></div>
    </dl>:r.needsReview?<>
      <p className="mv-small">No card of this round is left at Product or Prove it. Say “Review round {r.number}” in chat.</p>
    </>:<p className="mv-small">The review waits until none of its cards are at Product or Prove it. Still there: {r.blockerIds.slice(0,6).join(', ')||'none'}{r.blockerIds.length>6?` and ${r.blockerIds.length-6} more`:''}.</p>}
  </div>;
}

function OutOfLine({groups,team,go,tasks,activity}) {
  const [open,setOpen] = useState(false);
  const count = groups.reduce((sum,group)=>sum+group.items.length,0);
  return <section className="mv-pl-outbox">
    <button className="mv-pl-outtoggle" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}<strong>Out of the line and history</strong><span>{count} failed, passed, rejected, parked, killed or finished, with the reason</span></button>
    {open&&groups.map(group=><div key={group.key} className="mv-pl-group">
      <div className="mv-pl-group-head"><h3>{group.label}{group.round?.focus&&<small> · {group.round.focus}</small>}</h3><span>{group.items.length}</span></div>
      <RowList rows items={group.items} team={team} go={go} tasks={tasks} activity={activity}/>
    </div>)}
  </section>;
}

export function PipelinePage({data,current,go,planner,activity,hub}) {
  const pipeline = current?.pipeline;
  if (!pipeline) return null;
  const team = data.team, tasks = planner?.tasks||[];
  const groups = pipelineGroups(pipeline);
  const live = liveWork(pipeline,activity||[],Date.now());
  const shared = {team,go,tasks,activity,live};
  const active = pipeline.active.length;
  return <section className="mv-pl-page">
    <div className="mv-page-head">
      <div>
        <h1 className="mv-h1">Pipeline</h1>
        <p className="mv-sub">Every product, where it is and what's next.</p>
      </div>
      <div className="mv-page-actions">
        <button className="mv-btn ghost" onClick={()=>go('trends')}>Trends & Market Hub</button>
        <button className="mv-btn primary" onClick={()=>go('store')}>Store & Theme Hub</button>
      </div>
    </div>
    <RoundHeader pipeline={pipeline} go={go} live={live} team={team} campaigns={hub?.metaCampaigns||[]}/>
    {groups.building&&<BuildingCard item={groups.building} workspace={data.workspace} {...shared}/>}
    {groups.ready.length>0&&<section className="mv-pl-group is-ready">
      <div className="mv-pl-group-head"><h3><Sparkles size={15}/>Ready to build<small> · every check passed</small></h3><span>{groups.ready.length}</span></div>
      <RowList items={groups.ready} {...shared} actionFor={item=>pipeline.building?<span className="mv-pl-action is-off" title={`${pipeline.building.name} holds the build slot`}>Slot taken</span>:<button type="button" className="mv-btn sm accent" onClick={()=>go(`product/${item.id}?build=1`)}><Hammer size={13}/>Build this one</button>}/>
    </section>}
    {groups.rounds.map(group=><section key={group.key} className="mv-pl-group">
      <div className="mv-pl-group-head"><h3>{group.label}{group.current&&<Chip tone="active">current</Chip>}{group.round?.focus&&<small> · {group.round.focus}</small>}</h3><span>{group.items.length} on the line</span></div>
      <RowList items={group.items} {...shared}/>
    </section>)}
    {!active&&<div className="mv-card mv-empty mv-pl-noline"><Compass size={26}/><strong>{pipeline.round?.open?`No Round ${pipeline.round.number} cards yet.`:'Nothing is on the line.'}</strong><span className="mv-small">{pipeline.round?.open?'They show here as the scout finds them, ready for your eye test.':'Open Trends & Market Hub or Find to review early-wave product cards.'}</span></div>}
    <RoundReview pipeline={pipeline}/>
    {groups.outCount>0&&<OutOfLine groups={groups.out} {...shared}/>}
    <p className="mv-small mv-pl-foot"><Check size={13}/>One product builds at a time; every product runs live on its own page.</p>
  </section>;
}

/** The pipeline banner on Agents mission control: the round, products per step and the focus move. */
/** The round and its step as one small chip: the pipeline's focus, one tap from any page. */
export function RoundChip({pipeline,current,go}) {
  if (!pipeline) return null;
  const focus = focusLine(pipeline), Icon = current?STAGE_ICONS[current.id]:null;
  return <button type="button" className={`mv-td-stepchip ${focus.owner?'is-owner':''}`} onClick={()=>go(pipeline.focus?.itemId?`product/${pipeline.focus.itemId}`:'pipeline')} title={focus.next||focus.text}>
    <span className="mv-td-stepchip-icon">{Icon&&<Icon size={14}/>}</span><b>{focus.round}</b> · {current?.name}<ArrowRight size={13}/>
  </button>;
}

export function PipelineBanner({pipeline,go}) {
  if (!pipeline) return null;
  const head = roundHeader(pipeline), focus = focusLine(pipeline);
  return <section className="mv-pl-banner" aria-label="The pipeline">
    <div className="mv-pl-banner-main"><span className="mv-eyebrow">The pipeline · {head.round?`${head.label} · ${head.stateLabel}`:'No round yet'}</span>
      <div className={`mv-pl-banner-focus ${focus.owner?'is-owner':''}`}><Flag size={13}/><span>{focus.next||'Nothing on the line.'}</span></div></div>
    <Stations pipeline={pipeline} go={go}/>
    <button className="mv-btn sm" onClick={()=>go('pipeline')}>Open pipeline<ArrowRight size={13}/></button>
  </section>;
}

