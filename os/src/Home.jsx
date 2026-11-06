import React from 'react';
import { Check, Plus, Sparkles, Flag, Coffee, Hammer, Megaphone, DollarSign, TrendingUp, ShoppingBag, MousePointerClick, Wallet, Bot, Workflow, ListChecks, Rocket } from 'lucide-react';
import { taskBuckets, liveRunning } from './workflowView.mjs';
import { roundHeader, needsYou, focusLine, liveWork } from './pipelineView.mjs';
import { Chip, Avatar, AgentAvatar, Ring, agentOf, timeAgo } from './kit.jsx';
import { DoctorBadge } from './DoctorBadge.jsx';
import { StepBoard, ProductCard } from './Pipeline.jsx';
import { LaunchTonight, useLaunchTonight } from './LaunchTonight.jsx';
import { useChecklists } from './LineNav.jsx';
import { checklistScore, shortProductId } from './displayLine.mjs';
import { computeCampaignMetrics, firstImageAd, portfolioTotals, cpaGauge } from './campaignView.mjs';
import { CardMedia, CountUp, Metric, ReadMore, SectionHead, Shelf, Stat } from './cards.jsx';

// Home is the owner's cockpit (owner, Nov 4: "Launchroom is really where I get all my
// work done, 100%"). Money first, then what needs them, then the line and the team:
// pictures and big numbers, with the words one tap away. Everything is read from saved
// records; nothing on this page decides for the owner.

function greeting(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

const usd = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const times = value => `${Number(value || 0).toFixed(2)}x`;
const whole = value => String(Math.round(value));
const percent = value => `${Number(value || 0).toFixed(2)}%`;
const savedWhen = value => {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};

/** The money across every campaign, as five big tiles. Each one opens Manage. */
function MoneyRow({ campaigns, savedAt, go }) {
  const totals = portfolioTotals(campaigns);
  const open = () => go('manage');
  return (
    <section className="mv-cd-rise" aria-label="Meta ads, every product">
      <div className="mv-cd-stats">
        <Stat tile={6} icon={DollarSign} label="Revenue" value={totals.revenue} format={usd} sub={`${totals.purchases} order${totals.purchases === 1 ? '' : 's'}`} onClick={open} />
        <Stat tile={1} icon={Wallet} label="Ad spend" value={totals.spend} format={usd} sub={`${campaigns.length} product${campaigns.length === 1 ? '' : 's'}`} onClick={open} />
        <Stat tile={4} icon={TrendingUp} label="ROAS" value={totals.roas} format={times} sub={totals.profitable ? `${totals.profitable} below break-even` : 'None below break-even yet'} onClick={open} />
        <Stat tile={2} icon={ShoppingBag} label="Orders" value={totals.purchases} format={whole} sub={savedAt ? `Saved ${savedWhen(savedAt)}` : 'Last saved numbers'} onClick={open} />
        <Stat tile={3} icon={MousePointerClick} label="Click rate" value={totals.ctr} format={percent} sub={`${totals.clicks.toLocaleString()} clicks`} onClick={open} />
      </div>
    </section>
  );
}

/** One product running on Meta: its ad, its return and its cost per sale against break-even. */
function CampaignCard({ campaign, go, index }) {
  const checklists = useChecklists();
  const m = computeCampaignMetrics(campaign);
  const id = shortProductId(campaign.productId);
  const name = String(campaign.shortName || id).replace(/^[PL]\d{3,}\s*·\s*/, '');
  const score = checklistScore(checklists, id);
  const live = String(campaign.status).startsWith('ACTIVE');
  const tone = m.isProfitable ? 'good' : m.purchases ? 'bad' : '';
  return (
    <article className="mv-cd-camp mv-cd-rise" style={{ '--i': index }}>
      <button type="button" className="mv-cd-pcard-hit" aria-label={`Open ${id} ${name} on Manage`} onClick={() => go(`manage?product=${id}`)} />
      <CardMedia image={firstImageAd(campaign)} alt="" placeholder={id}><span className="mv-cd-id">{id}</span></CardMedia>
      <div className="mv-cd-camp-body">
        <div className="mv-cd-camp-top">
          <h3>{name}</h3>
          <span className={`mv-cd-camp-state ${live ? 'is-live' : ''}`}>{live && <i className="mv-cd-live-dot" />}{live ? 'Live' : 'Paused'}</span>
        </div>
        <div className={`mv-cd-camp-roas ${tone ? `is-${tone}` : ''}`}><CountUp value={m.roas} format={times} /><small>ROAS</small></div>
        <div className="mv-cd-metrics is-four">
          <Metric label="Spend" value={usd(m.spend)} />
          <Metric label="Revenue" value={usd(m.revenue)} tone={m.revenue ? 'good' : ''} />
          <Metric label="Orders" value={m.purchases} />
          <Metric label="Click rate" value={percent(m.ctr)} />
        </div>
        <div className={`mv-cd-gauge ${tone === 'bad' ? 'is-bad' : ''}`}>
          <small><span>Cost per sale <b>{usd(m.cpa)}</b></span><span>Break-even {usd(m.breakEvenCpa)}</span></small>
          <i><span style={{ width: `${cpaGauge(m)}%` }} /></i>
        </div>
        <div className="mv-cd-camp-foot">
          <span>${Number(campaign.dailyBudget || 0).toFixed(0)}/day · {m.totalAds} ads</span>
          <button type="button" className="mv-link" onClick={() => go(`manage?product=${id}`)}>Manage</button>
        </div>
      </div>
    </article>
  );
}

/** What waits on the owner, as product cards with their one action. */
function YourMove({ pipeline, go, team }) {
  const moves = needsYou(pipeline);
  if (!moves.length) return null;
  const ACTIONS = { 'eye-test': ['Eye test', Sparkles, ''], 'build-pick': ['Build this one', Hammer, '?build=1'], launch: ['Approve', Rocket, ''] };
  return moves.map(move => {
    const [label, Icon, query] = ACTIONS[move.kind] || ['Open', Flag, ''];
    return (
      <section key={move.kind} className="mv-cd-section">
        <SectionHead icon={Icon} tone="owner" title={move.title} count={move.count} action={move.items.length > 12 ? `All ${move.items.length}` : ''} onAction={() => go(move.kind === 'eye-test' ? 'find' : 'pipeline')} />
        <Shelf label={move.title}>
          {move.items.slice(0, 12).map((item, index) => (
            <ProductCard key={item.id} item={item} team={team} go={go} index={index}
              action={<button type="button" className="mv-btn sm accent" onClick={() => go(`product/${item.id}${query}`)}><Icon size={13} />{label}</button>} />
          ))}
        </Shelf>
      </section>
    );
  });
}

/** Build this one, or plainly why not yet: the product page refuses a build while the slot is taken. */
function BuildAction({ item, pipeline, go }) {
  if (pipeline.building) return <span className="mv-pl-action is-off" title={`${pipeline.building.name} holds the build slot`}>Slot taken</span>;
  return <button type="button" className="mv-btn sm accent" onClick={() => go(`product/${item.id}?build=1`)}><Hammer size={13} />Build this one</button>;
}

/** Every product on the line that isn't already shown under a move of the owner's: building first, then ready to build. */
function OnTheLine({ pipeline, go, team, live }) {
  const shown = new Set(needsYou(pipeline).flatMap(move => move.items.map(item => item.id)));
  const items = (pipeline.active || []).filter(item => !shown.has(item.id));
  if (!items.length) return null;
  return (
    <section className="mv-cd-section">
      <SectionHead icon={Hammer} title="On the line" count={items.length} action="Every product" onAction={() => go('pipeline')} />
      <Shelf label="Products on the line">
        {items.slice(0, 12).map((item, index) => (
          <ProductCard key={item.id} item={item} team={team} go={go} live={live} index={index} action={item.readyToBuild ? <BuildAction item={item} pipeline={pipeline} go={go} /> : null} />
        ))}
      </Shelf>
    </section>
  );
}

function TasksCard({ tasks, go, onToggle }) {
  return (
    <section className="mv-cd-card" aria-label="Your tasks">
      <SectionHead icon={Flag} tone="owner" title="Your tasks" action="All tasks" onAction={() => go('today')} />
      {tasks.length ? <>
        <div className="mv-cd-big"><CountUp value={tasks.length} format={whole} /><small>open for you</small></div>
        <div className="mv-cd-tasks">
          {tasks.slice(0, 4).map(task => (
            <div key={task.id} className="mv-cd-task">
              <button type="button" className={`mv-checkbox ${task.status === 'done' ? 'is-checked' : ''}`} aria-label={`Complete ${task.title}`} onClick={() => onToggle(task)}>{task.status === 'done' && <Check size={14} strokeWidth={3} />}</button>
              <button type="button" title={task.nextAction || task.title} onClick={() => go(`today?task=${task.id}`)}>{task.title}</button>
            </div>
          ))}
        </div>
      </> : <div className="mv-empty"><Coffee size={26} /><strong>Nothing is waiting on you.</strong></div>}
    </section>
  );
}

function TeamCard({ activity, team, go, now }) {
  const running = liveRunning(activity || [], now);
  return (
    <section className="mv-cd-card" aria-label="The team">
      <SectionHead icon={Bot} tone="live" title="The team" action="Open" onAction={() => go('agents')} />
      <div className="mv-cd-big"><CountUp value={running.length} format={whole} /><small>working now</small></div>
      {!running.length && <div className="mv-cd-roster">{(team?.agents || []).map(agent => <AgentAvatar key={agent.id} agent={agent} size={32} title={agent.name} />)}</div>}
      {running.slice(0, 3).map(report => {
        const member = report.agent === 'manager' ? null : agentOf(team, report.agent);
        return (
          <div key={report.id} className="mv-cd-agent" title={report.title}>
            {member ? <AgentAvatar agent={member} size={30} /> : <Avatar role="manager" size={30} />}
            <span style={{ minWidth: 0 }}><strong>{member?.name || 'Claude'}</strong><small>{report.title}</small></span>
            <time>{timeAgo(report.updatedAt)}</time>
          </div>
        );
      })}
    </section>
  );
}

function LeftOffCard({ handoff }) {
  return (
    <section className="mv-cd-card mv-cd-note" aria-label="Where we left off">
      <div className="mv-panel-title" style={{ marginBottom: 0 }}><span className="mv-eyebrow" style={{ color: 'var(--highlight-text)' }}>Where we left off</span><span className="mv-small">{handoff.updatedAt ? timeAgo(handoff.updatedAt) : ''}</span></div>
      <ReadMore text={handoff.summary || 'No handoff saved yet.'} lines={3} />
      {handoff.nextAction && <div className="mv-cd-note-next"><b>Next</b><span>{handoff.nextAction}</span></div>}
    </section>
  );
}

export function Home(props) {
  const { data, activity, planner, go, saveTask, notify, day, openDoc, current, hub, isMerrivy = true } = props;
  const pipeline = current?.pipeline;
  const tasks = planner?.tasks || [];
  const buckets = taskBuckets(tasks, day);
  const mine = [...buckets.carried, ...buckets.today].filter(task => task.status !== 'done' && task.assignee !== 'agent').sort((a, b) => Number(b.focus) - Number(a.focus));
  const nowMs = Date.now();
  const running = liveRunning(activity, nowMs).length;
  const handoff = data.workspace?.handoff || {};
  const eye = pipeline?.ownerMoves.find(move => move.kind === 'eye-test');
  const campaigns = hub?.metaCampaigns || [];
  const live = pipeline ? liveWork(pipeline, activity || [], nowMs) : null;
  const head = pipeline ? roundHeader(pipeline) : null;
  const focus = pipeline ? focusLine(pipeline) : null;
  const launch = useLaunchTonight({ buildProductId: pipeline?.buildProductId || null, products: data.products });
  async function toggle(task) { try { await saveTask({ revision: planner.revision, id: task.id, status: task.status === 'done' ? 'todo' : 'done' }); notify(task.status === 'done' ? 'Task reopened.' : 'Nice. Task done.'); } catch (e) { notify(e.message); } }
  const now = new Date();
  return <div>
    <div className="mv-hello">
      <div><span className="mv-eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span><h1>{greeting(now)}.</h1>
        <div className="mv-hello-chips">
          {eye && <button onClick={() => go('find')}><Chip tone="owner" icon={Sparkles}>{eye.count} product{eye.count === 1 ? ' needs' : 's need'} your eye test</Chip></button>}
          <button onClick={() => go('today')}><Chip tone={mine.length ? 'owner' : 'done'} icon={Flag}>{mine.length ? `${mine.length} task${mine.length === 1 ? '' : 's'} for you today` : 'Your tasks are clear'}</Chip></button>
          <button onClick={() => go('agents')}><Chip tone={running ? 'active' : ''}>{running ? `${running} agent${running === 1 ? '' : 's'} working` : 'No agent working right now'}</Chip></button>
          <DoctorBadge />
        </div>
      </div>
      <div className="mv-page-actions"><button className="mv-btn" onClick={() => go('today?add=1')}><Plus size={15} />Add a task</button></div>
    </div>

    {hub?.metaCampaigns === undefined && <div className="mv-cd-stats" aria-hidden="true">{[1, 2, 3, 4, 5].map(n => <div key={n} className="mv-cd-stat mv-cd-skeleton" />)}</div>}
    {campaigns.length > 0 && <MoneyRow campaigns={campaigns} savedAt={hub?.metaSavedAt} go={go} />}

    {campaigns.length > 0 && <section className="mv-cd-section">
      <SectionHead icon={Megaphone} tone="good" title="On Meta" count={campaigns.length} action="See everything" onAction={() => go('improve')} />
      <div className="mv-cd-camps">{campaigns.map((campaign, index) => <CampaignCard key={campaign.productId} campaign={campaign} go={go} index={index} />)}</div>
    </section>}

    {pipeline && <YourMove pipeline={pipeline} go={go} team={data.team} />}
    {pipeline && <OnTheLine pipeline={pipeline} go={go} team={data.team} live={live} />}

    {pipeline && <section className="mv-cd-section">
      <SectionHead icon={Workflow} title={`The line${head?.round ? ` · ${head.label}` : ''}`} count={pipeline.counts.active} action="Every product" onAction={() => go('pipeline')} />
      <StepBoard pipeline={pipeline} go={go} live={live} team={data.team} campaigns={campaigns} />
      {focus?.next && <p className="mv-cd-focus"><ListChecks size={14} /><b>Next</b><span>{focus.next}</span></p>}
    </section>}

    <div className="mv-cd-trio mv-cd-section">
      <TasksCard tasks={mine} go={go} onToggle={toggle} />
      <TeamCard activity={activity} team={data.team} go={go} now={nowMs} />
      <LeftOffCard handoff={handoff} />
    </div>

    <LaunchTonight collapsible launch={launch} openDoc={openDoc} activity={activity} isMerrivy={isMerrivy} buildProductId={pipeline?.buildProductId || null} buildingName={pipeline?.building?.name || ''} />
  </div>;
}
