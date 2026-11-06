import test from 'node:test';
import assert from 'node:assert/strict';
import {leadState,buildLeads,ownerDecisionCandidate,reviewComplete,stageSignals,activityByDay,taskBuckets,todayPlan,dayLog,weekAhead,parseQuickAdd,shiftDay,laneOf,doerOf,unitEconomics,emptyScreen} from '../src/workflowView.mjs';
import {SCREEN_CHECK_IDS,RESEARCH_GATE_IDS} from '../src/researchView.mjs';
const FIND_PASS = (country = 'US') => Object.fromEntries([['dropshippable', {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}], ['metaGap', {advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}], ['bigIssue', {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}], ['provenDemand', {advertisers: 5, longestActiveDays: 140, liveAds: 12, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}]}], ['looksWorth', {}], ['productWorks', {}], ['audienceRoom', {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain', why: 'Job forums complain'}, {who: 'Gardeners', problem: 'Sore knees', why: 'Related routine'}]}], ['noBrand', {}]].map(([id, extra]) => [id, {status: 'supported', note: 'Fixture Find check', source: 'https://example.com/fixture-find', observedAt: '2026-09-15', country, evidenceType: 'observed', ...extra}]));
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

const gates = status => Object.fromEntries(RESEARCH_GATE_IDS.map(id=>[id,{status,note:'',source:'',observedAt:'',window:''}]));
const supportedScreen = () => ({ownerDecision:'saved',ownerReason:'Looks distinct',checks:Object.fromEntries(SCREEN_CHECK_IDS.map(id=>[id,{status:'supported',...(FIND_EXTRA[id]||{})}]))});

test('owner decisions outrank research dispositions', () => {
  const parked = {decision:'PARK: concentrated sales',gates:gates('pending')};
  assert.equal(leadState(parked), 'parked');
  assert.equal(leadState({...parked,screen:{...emptyScreen(),ownerDecision:'rejected',ownerReason:'Cheap'}}), 'rejected');
  assert.equal(leadState({...parked,screen:{...emptyScreen(),ownerDecision:'passed',ownerReason:'Later'}}), 'passed');
  assert.equal(leadState({decision:'KILL for this batch',gates:gates('pending')}), 'killed');
  assert.equal(leadState({decision:'CURATED - UNVERIFIED; owner unreviewed',gates:gates('pending')}), 'waiting');
  assert.equal(leadState(null,{disposition:'CURATED'}), 'waiting');
  assert.equal(leadState(null,{disposition:'PARK'}), 'parked');
});

test('saved leads advance only with a complete screen and resolved gates', () => {
  const saved = {decision:'CURATED',gates:gates('pending'),screen:{...emptyScreen(),ownerDecision:'saved',ownerReason:'Yes'}};
  assert.equal(leadState(saved), 'saved');
  const screened = {...saved,screen:supportedScreen()};
  assert.equal(leadState(screened), 'ready');
  const reviewed = {...screened,country:'US',buyer:'New parents',gates:gates('supported')};
  assert.equal(reviewComplete(reviewed), true);
  assert.equal(leadState(reviewed), 'reviewed');
  assert.equal(leadState({...reviewed,missingEvidence:{gates:['demand']}}), 'ready');
});

test('leads merge cards with candidates and keep the current batch first', () => {
  const research = {candidates:[{id:'L001',name:'Old set',decision:'PARK',references:['research/a/SCREEN.md'],gates:gates('pending')},{id:'L096',name:'Story player',decision:'CURATED - UNVERIFIED',references:[],gates:gates('pending')}]};
  const curation = {batches:[
    {label:'Now',path:'research/2026-09-26-pilot/BATCH.md',cards:[{id:'L096',name:'Story player',imagePath:'resources/x.png',disposition:'CURATED',sourcePath:'research/2026-09-26-pilot/L096.md'}]},
    {label:'Earlier',path:'research/2026-09-17-live/BATCH.md',cards:[{id:'L094',name:'Cat post',imagePath:'resources/y.png',disposition:'PARK',sourcePath:'research/2026-09-17-live/L094.md'}]},
  ]};
  const leads = buildLeads(research, curation);
  assert.deepEqual(leads.map(lead=>lead.id), ['L096','L094','L001']);
  assert.equal(leads[0].current, true);
  assert.equal(leads[0].state, 'waiting');
  assert.equal(leads[1].state, 'parked');
  assert.equal(leads[2].image, '');
  assert.equal(leads[2].sourcePath, 'research/a/SCREEN.md');
});

test('owner decision payload takes an optional reason and preserves existing evidence', () => {
  const lead = {id:'L095',name:'Lamp',sourcePath:'research/b/L095.md',candidate:null};
  assert.equal(ownerDecisionCandidate(lead,'saved','  ').screen.ownerReason, ''); // one tap (Oct 3): the reason is optional
  assert.throws(() => ownerDecisionCandidate(lead,'verified','ok'), /save, pass or reject/);
  const fresh = ownerDecisionCandidate(lead,'saved',' Distinct visual ');
  assert.equal(fresh.screen.ownerDecision, 'saved');
  assert.equal(fresh.screen.ownerReason, 'Distinct visual');
  assert.deepEqual(fresh.references, ['research/b/L095.md']);
  assert.equal(Object.keys(fresh.screen.checks).length, SCREEN_CHECK_IDS.length);
  const existing = {id:'L010',name:'Bag',decision:'PARK',references:[],gates:gates('pending'),missingEvidence:{paths:[]},screen:{...emptyScreen(),checks:{...emptyScreen().checks,productWorks:{status:'supported',note:'n'}}}};
  const updated = ownerDecisionCandidate({...lead,candidate:existing},'rejected','Generic');
  assert.equal(updated.screen.checks.productWorks.status, 'supported');
  assert.equal('missingEvidence' in updated, false);
  assert.equal(existing.screen.ownerDecision, 'unreviewed');
});

test('stage signals count only recorded evidence', () => {
  const leads = [{state:'waiting',card:{},candidate:{screen:{checks:FIND_PASS()}}},{state:'waiting',card:{},candidate:{screen:{checks:{}}}},{state:'parked',card:{}},{state:'saved'}];
  const research = {minimumReviews:5,summary:{reviewed:1},candidates:[{screen:{checks:{sourceMatch:{status:'supported'},contribution:{status:'pending'}}}}]};
  const data = {storeChecklist:{done:14,total:56},improvements:[{status:'adopted'},{status:'trialed'}],workspace:{reviews:[{}]}};
  const signals = stageSignals({data,research,leads,hub:{assets:[1,2,3]}});
  assert.equal(signals.product.value, 1);
  assert.equal(signals.product.owner, true);
  assert.equal(signals.prove.value, '1/5'); assert.match(signals.prove.detail, /1 exact sources$/);
  assert.equal(signals.create.value, 3);
  assert.equal(signals.build.value, '14/56');
  assert.equal(signals.learn.value, 1);
  assert.equal(signals.issue.value, 0, 'no issue files in this fixture');
  assert.equal(stageSignals({data:{issues:[{gatePassed:true},{gatePassed:false}]},research:{},leads:[],hub:{}}).issue.value, 1);
});

test('activity rhythm buckets reported events by local day', () => {
  const now = new Date(2026,8,30,15);
  const at = (d,h) => new Date(2026,8,d,h).toISOString();
  const days = activityByDay([
    {role:'manager',events:[{at:at(30,9)},{at:at(29,9)}]},
    {role:'validation',updatedAt:at(30,10),events:[]},
    {role:'validation',events:[{at:at(1,9)}]},
  ],3,now);
  assert.deepEqual(days.map(d=>d.total), [0,1,2]);
  assert.deepEqual(days[2].byRole, {manager:1,validation:1});
});

test('task buckets keep unfinished earlier work in its own carried group', () => {
  const tasks = [{date:'2026-09-29',status:'todo'},{date:'2026-09-29',status:'done'},{date:'2026-09-30',status:'done'},{date:'2026-10-02',status:'todo'},{date:'',status:'blocked'}];
  const b = taskBuckets(tasks,'2026-09-30');
  assert.deepEqual(b.carried, [tasks[0]], 'the open Sep 29 task is carried, not merged into today');
  assert.deepEqual(b.today, [tasks[2]], 'today holds only tasks dated today');
  assert.equal(b.upcoming.length, 1);
  assert.equal(b.someday.length, 1);
  assert.equal(b.done.length, 2);
  // Callers that want everything due by today (Home) still see the same set as before.
  assert.equal([...b.carried,...b.today].length, 2);
});

const T = (id, extra) => ({id, title:id, status:'todo', assignee:'shared', agent:'', focus:false, date:'2026-10-01', createdAt:`2026-09-30T0${id.length%9}:00:00Z`, ...extra});

test('today plan: focus strip, three lanes shown once, carried box, live working dots and wrap-up', () => {
  const now = Date.parse('2026-10-01T15:00:00Z');
  const tasks = [
    T('f1',{focus:true,assignee:'owner'}),
    T('f2',{focus:true,assignee:'agent',agent:'scout',status:'done',completedAt:'2026-10-01T14:00:00Z'}),
    T('mine',{assignee:'owner'}),
    T('claude',{assignee:'agent'}),
    T('scout',{assignee:'agent',agent:'scout',status:'doing'}),
    T('ours',{}),
    T('legacy',{assignee:undefined}),
    T('old',{date:'2026-09-29',assignee:'owner'}),
    T('oldDone',{date:'2026-09-29',status:'done',completedAt:'2026-10-01T09:00:00Z'}),
    T('next',{date:'2026-10-02'}),
  ];
  const activity = [
    {id:'r1',agent:'scout',status:'running',updatedAt:'2026-10-01T14:30:00Z'},
    {id:'r2',agent:'checker',status:'running',updatedAt:'2026-09-28T10:00:00Z'},
    {id:'r3',agent:'manager',status:'completed',updatedAt:'2026-10-01T14:50:00Z'},
  ];
  const plan = todayPlan({tasks,day:'2026-10-01',today:'2026-10-01',activity,now,dayOf:iso=>iso.slice(0,10)});
  assert.deepEqual(plan.focus.map(t=>t.id), ['f1']);
  assert.deepEqual(plan.focusDone.map(t=>t.id), ['f2']);
  assert.equal(plan.focusRoom, 2);
  assert.deepEqual(plan.lanes.you.map(t=>t.id), ['mine']);
  assert.deepEqual(plan.lanes.team.map(t=>t.id), ['scout','claude'], 'in progress first, any agent');
  assert.deepEqual(plan.lanes.together.map(t=>t.id).sort(), ['legacy','ours'], 'shared or unset renders once, together');
  const shown = [...plan.focus,...plan.focusDone,...plan.lanes.you,...plan.lanes.team,...plan.lanes.together].map(t=>t.id);
  assert.equal(new Set(shown).size, shown.length, 'no task renders twice');
  assert.deepEqual(plan.carried.map(t=>t.id), ['old']);
  assert.deepEqual(plan.working, ['scout'], 'stale and closed reports are not working now');
  assert.equal(plan.total, 8); assert.equal(plan.done, 1);
  assert.deepEqual(plan.wrap.done.map(t=>t.id), ['oldDone','f2'], 'finished today, by completion time');
  assert.deepEqual(plan.wrap.open.map(t=>t.id), ['old','scout','f1','mine','ours','claude','legacy'], 'carried first, then today in progress first');
  assert.ok(plan.wrap.open.every(t=>t.status!=='done'), 'wrap-up never touches finished tasks');
  assert.equal(doerOf(tasks[3]), 'manager'); assert.equal(doerOf(tasks[4]), 'scout'); assert.equal(doerOf(tasks[2]), '');
  assert.equal(laneOf({assignee:'agent'}), 'team');
  // Looking back or planning ahead: no carried box and no wrap-up.
  const past = todayPlan({tasks,day:'2026-09-29',today:'2026-10-01',activity,now});
  assert.equal(past.past, true); assert.deepEqual(past.carried, []); assert.equal(past.wrap, null);
  assert.equal(todayPlan({tasks,day:'2026-10-02',today:'2026-10-01'}).future, true);
});

test('this week groups open tasks by day and counts later and someday', () => {
  const tasks = [T('a',{date:'2026-10-02'}),T('b',{date:'2026-10-02',focus:true}),T('c',{date:'2026-10-05',status:'done'}),T('d',{date:'2026-10-08'}),T('e',{date:'2026-10-09'}),T('f',{date:''}),T('g',{date:'2026-10-01'})];
  const week = weekAhead(tasks,'2026-10-01');
  assert.deepEqual(week.groups.map(g=>[g.date,g.tasks.map(t=>t.id)]), [['2026-10-02',['b','a']],['2026-10-08',['d']]]);
  assert.equal(week.later, 1); assert.equal(week.someday, 1);
  assert.equal(shiftDay('2026-10-31',1), '2026-11-01');
  assert.equal(shiftDay('2026-03-08',1), '2026-03-09', 'no daylight-saving drift');
});

test('quick add reads simple words, strips them from the title and keeps defaults', () => {
  const agents = [{id:'scout',name:'Product scout'},{id:'buyer-researcher',name:'Buyer researcher'}];
  const today = '2026-10-01'; // a Thursday
  const plain = parseQuickAdd('Review the store palettes',{today,agents});
  assert.deepEqual({...plain,tokens:plain.tokens.length}, {title:'Review the store palettes',date:today,focus:false,assignee:'shared',agent:'',agents:[],step:'',tokens:0});
  const full = parseQuickAdd('Find 15 pet products tomorrow @scout ! #find',{today,agents});
  assert.equal(full.title, 'Find 15 pet products');
  assert.equal(full.date, '2026-10-02'); assert.equal(full.focus, true);
  assert.equal(full.assignee, 'agent'); assert.equal(full.agent, 'scout'); assert.equal(full.step, 'product', 'the old #find word is Step 1 · Product');
  assert.deepEqual(full.tokens.map(t=>t.label), ['Tomorrow','Product scout','Focus','Product']);
  assert.equal(parseQuickAdd('Words bank #issue',{today,agents}).step, 'buyers', 'the old #issue word is Step 2 · Buyers'); assert.equal(parseQuickAdd('Quotes #buyers',{today,agents}).step, 'buyers'); assert.equal(parseQuickAdd('Read results #learn',{today,agents}).step, 'learn');
  assert.deepEqual(parseQuickAdd('Call supplier @me someday',{today,agents}), {title:'Call supplier',date:'',focus:false,assignee:'owner',agent:'',agents:[],step:'',tokens:parseQuickAdd('Call supplier @me someday',{today,agents}).tokens});
  const claude = parseQuickAdd('Check CJ listings @claude #source',{today,agents});
  assert.deepEqual([claude.assignee,claude.agent,claude.step], ['agent','','prove']);
  assert.equal(parseQuickAdd('Angles @buyer-researcher',{today,agents}).agent, 'buyer-researcher');
  // Several agents share a task; with @me it is between the owner and them.
  const crew = parseQuickAdd('Launch pack @scout @buyer-researcher',{today,agents});
  assert.deepEqual([crew.title,crew.assignee,crew.agent,crew.agents], ['Launch pack','agent','scout',['scout','buyer-researcher']]);
  const withMe = parseQuickAdd('Pick the hook @me @scout',{today,agents});
  assert.deepEqual([withMe.title,withMe.assignee,withMe.agents], ['Pick the hook','shared',['scout']]);
  // Weekdays mean the next one after today; the same weekday is next week.
  assert.equal(parseQuickAdd('Plan friday',{today}).date, '2026-10-02');
  assert.equal(parseQuickAdd('Plan Thursday',{today}).date, '2026-10-08');
  assert.equal(parseQuickAdd('Plan monday.',{today}).date, '2026-10-05');
  // The last date word counts; the earlier one stays in the title.
  const two = parseQuickAdd('Plan Monday call tomorrow',{today});
  assert.equal(two.title, 'Plan Monday call'); assert.equal(two.date, '2026-10-02');
  // Unknown handles and tags, punctuation and numbers stay as words.
  const kept = parseQuickAdd('Email @nobody about #1 sun hats!',{today,agents});
  assert.equal(kept.title, 'Email @nobody about #1 sun hats!');
  assert.equal(kept.focus, false); assert.equal(kept.tokens.length, 0);
  // The default date follows the day being viewed ('' in Someday).
  assert.equal(parseQuickAdd('Draft copy',{today,day:'2026-10-03'}).date, '2026-10-03');
  assert.equal(parseQuickAdd('Draft copy',{today,day:''}).date, '');
  // Clicking a preview chip off keeps that word in the title.
  const monday = parseQuickAdd('Ask about the Monday shipment',{today});
  assert.equal(monday.title, 'Ask about the shipment');
  const off = parseQuickAdd('Ask about the Monday shipment',{today,ignore:[monday.tokens[0].key]});
  assert.equal(off.title, 'Ask about the Monday shipment'); assert.equal(off.date, today);
  assert.equal(parseQuickAdd('tomorrow !',{today}).title, '', 'only tokens leaves an empty title');
});

test('unit economics shows profit and break-even ad cost', () => {
  const r = unitEconomics({price:50,itemCost:12,shipping:6,feePercent:3,feeFixed:0.3,returnPercent:4,adCost:18});
  assert.equal(r.fees.toFixed(2), '1.80');
  assert.equal(r.returns, 2);
  assert.equal(r.beforeAds.toFixed(2), '28.20');
  assert.equal(r.profit.toFixed(2), '10.20');
  assert.equal(r.breakEvenAdCost.toFixed(2), '28.20');
  assert.equal(r.breakEvenRoas.toFixed(2), '1.77');
  assert.equal(unitEconomics({price:10,itemCost:12}).breakEvenRoas, null);
});

test('team board derives agent status from saved tasks and reports only', async () => {
  const {teamBoard} = await import('../src/workflowView.mjs');
  const agents = [{id:'scout'},{id:'copywriter'},{id:'store-builder'},{id:'os-builder'}];
  const tasks = [
    {id:'a',agent:'scout',status:'todo',date:'2026-09-30'},
    {id:'p',agent:'scout',status:'todo',date:''},
    {id:'b',agent:'copywriter',status:'blocked'},
    {id:'c',agent:'store-builder',status:'done',completedAt:'2026-09-29T10:00:00Z'},
    {id:'d',agent:'store-builder',status:'done',completedAt:'2026-08-01T10:00:00Z'},
    {id:'e',agent:'ghost',status:'todo',date:'2026-09-29'},
    {id:'f',status:'todo',assignee:'agent'},
  ];
  const activity = [{id:'r1',agent:'os-builder',status:'running',updatedAt:'2026-09-30T10:00:00Z'},{id:'r2',agent:'scout',status:'completed',updatedAt:'2026-09-28T10:00:00Z'}];
  const board = teamBoard(agents,tasks,activity,'2026-09-30',7,new Date('2026-09-30T12:00:00Z'));
  const of = id => board.agents.find(agent=>agent.id===id);
  assert.equal(of('scout').status,'queued'); assert.equal(of('scout').latest.id,'r2');
  assert.equal(of('copywriter').status,'blocked'); assert.equal(of('copywriter').needsInput,1);
  assert.equal(of('store-builder').status,'idle'); assert.equal(of('store-builder').done.length,1);
  assert.equal(of('os-builder').status,'working');
  assert.deepEqual(board.waiting.map(task=>task.id),['a','e']);
  assert.deepEqual([board.parked.map(task=>task.id),of('scout').parked.map(task=>task.id),of('scout').queued.map(task=>task.id)],[['p'],['p'],['a']],'a someday job is parked, not queued');
  assert.deepEqual(board.unknownAgents,['ghost']);
  assert.deepEqual(board.doneRecently.map(task=>task.id),['c']);
  assert.deepEqual(teamBoard([],[],[],'2026-09-30').agents,[]);
});

test('a running report that stopped reporting is stale, not work in progress', async () => {
  const {reportFreshness,liveRunning,teamBoard,agentSummary,agentsNavCount} = await import('../src/workflowView.mjs');
  const now = new Date('2026-10-01T06:30:00Z');
  const fresh = {id:'manager-os-build',agent:'manager',role:'manager',status:'running',updatedAt:'2026-10-01T06:27:54.219Z'};
  const old = {id:'p117-resume-triage',role:'validation',status:'running',updatedAt:'2026-09-17T23:39:52.622Z'};
  const oldScout = {id:'scout-old',agent:'scout',role:'validation',status:'running',updatedAt:'2026-09-29T06:00:00Z'};
  assert.equal(reportFreshness(fresh,now),'live');
  assert.equal(reportFreshness(old,now),'stale');
  assert.equal(reportFreshness({...fresh,updatedAt:'2026-09-30T06:29:00Z'},now),'stale');
  assert.equal(reportFreshness({...fresh,status:'blocked',updatedAt:'2026-09-25T06:30:00Z'},now),'live');
  assert.equal(reportFreshness({...fresh,status:'blocked',updatedAt:'2026-09-20T06:30:00Z'},now),'stale');
  assert.equal(reportFreshness({...fresh,status:'completed',updatedAt:'2020-01-01T00:00:00Z'},now),'closed');
  assert.equal(reportFreshness({...fresh,updatedAt:'not a date'},now),'stale');
  assert.deepEqual(liveRunning([fresh,old,oldScout],now).map(r=>r.id),['manager-os-build']);
  assert.equal(teamBoard([{id:'scout'}],[],[oldScout],'2026-10-01',7,now).agents[0].status,'idle');
  assert.equal(agentSummary([{id:'validation'}],[old],now)[0].running,0);
  assert.deepEqual(agentsNavCount({tasks:[],activity:[fresh,old],now}),{value:1,kind:'live',label:'1 report in progress'});
  assert.equal(agentsNavCount({tasks:[{agent:'scout',status:'todo',date:'2026-10-01'},{agent:'copywriter',status:'todo',date:'2026-10-02'},{agent:'scout',status:'done',date:'2026-10-01'},{agent:'scout',status:'todo',date:''}],activity:[old],now}).label,'2 agent jobs up next');
  // A someday agent task is parked: never counted as up next.
  assert.equal(agentsNavCount({tasks:[{agent:'scout',status:'todo',date:''}],activity:[],now}).value,0);
  assert.equal(agentsNavCount({tasks:[],activity:[old],now}).value,0);
  // The saved report is untouched.
  assert.equal(old.status,'running');
});

test('mission control sorts saved work into what Claude does, what runs, what is next and what needs the owner', async () => {
  const {missionControl} = await import('../src/workflowView.mjs');
  const now = new Date('2026-10-01T06:30:00Z');
  const at = hoursAgo => new Date(now.getTime()-hoursAgo*3600000).toISOString();
  const activity = [
    {id:'manager-os-build',agent:'manager',role:'manager',status:'running',updatedAt:at(0.1),events:[{at:at(1),text:'Started'}]},
    {id:'step-aware',agent:'os-builder',role:'manager',status:'running',updatedAt:at(0.2)},
    {id:'store-records',agent:'store-builder',role:'shopify-builder',status:'running',updatedAt:at(0.5)},
    {id:'p117-resume-triage',role:'validation',status:'running',updatedAt:at(24*13)},
    {id:'curation-live',role:'validation',status:'running',updatedAt:at(24*13+1)},
    {id:'sellable-site',role:'shopify-builder',status:'blocked',updatedAt:at(56)},
    {id:'method-reset',role:'manager',status:'blocked',updatedAt:at(24*14)},
    ...Array.from({length:8},(_,i)=>({id:`done-${i}`,agent:'os-builder',role:'manager',status:'completed',updatedAt:at(i*6+1)})),
  ];
  const tasks = [
    {id:'t-later',agent:'os-builder',status:'todo',date:'2026-10-02'},
    {id:'t-someday',agent:'scout',status:'todo',date:''},
    {id:'t-overdue',agent:'scout',status:'todo',date:'2026-09-30',focus:true},
    {id:'t-today-a',agent:'store-builder',status:'todo',date:'2026-10-01'},
    {id:'t-today-b',agent:'copywriter',status:'todo',date:'2026-10-01',focus:true},
    {id:'t-doing',agent:'os-builder',status:'doing',date:'2026-10-01'},
    {id:'t-noagent',assignee:'agent',status:'todo',date:'2026-10-01'},
    {id:'o-today',assignee:'owner',status:'todo',date:'2026-10-01'},
    {id:'o-old',assignee:'owner',status:'doing',date:'2026-09-29',focus:true},
    {id:'o-future',assignee:'owner',status:'todo',date:'2026-10-05'},
    {id:'o-someday',assignee:'owner',status:'todo',date:''},
    {id:'o-done',assignee:'owner',status:'done',date:'2026-10-01'},
    {id:'blocked-video',agent:'image-maker',assignee:'agent',status:'blocked',date:''},
  ];
  const mc = missionControl({tasks,activity,ownerMoves:[{kind:'eye-test',ids:['L096','L095'],count:2,step:0,text:'Eye test on 2 cards'}],day:'2026-10-01',now});
  assert.deepEqual(mc.claude.map(r=>r.id),['manager-os-build']);
  assert.deepEqual(mc.working.map(r=>r.id),['step-aware','store-records']);
  assert.deepEqual(mc.stale.map(r=>r.id),['p117-resume-triage','curation-live','method-reset']);
  assert.deepEqual(mc.upNext.map(t=>t.id),['t-overdue','t-today-b','t-today-a','t-later']);
  assert.deepEqual(mc.parked.map(t=>t.id),['t-someday'],'someday agent jobs are parked, not up next');
  assert.deepEqual(mc.readyForYou.tasks.map(t=>t.id),['o-old','o-today']);
  assert.deepEqual(mc.readyForYou.results.map(r=>r.id),['done-0','done-1','done-2','done-3']);
  assert.deepEqual(mc.doneRecently.map(r=>r.id),['done-4','done-5','done-6','done-7']);
  assert.deepEqual(mc.needsDecision.items,[{kind:'eye-test',id:'eye-test',count:2,ids:['L096','L095'],text:'Eye test on 2 cards',go:'find'}]);
  assert.deepEqual(mc.needsDecision.tasks.map(t=>t.id),['blocked-video']);
  assert.deepEqual(mc.needsDecision.reports.map(r=>r.id),['sellable-site']);
  const picked = missionControl({ownerMoves:[{kind:'build-pick',ids:['L903'],count:1,step:2}],now});
  assert.deepEqual(picked.needsDecision.items.map(i=>[i.kind,i.go]),[['build-pick','pipeline']]);
  assert.deepEqual(missionControl().claude,[]);
});

test('one day\'s log counts what was finished, what is left, agent reports and notes from saved records', () => {
  const dayOf = iso => iso.slice(0, 10);
  const tasks = [
    {id: 'a', status: 'done', date: '2026-11-04', completedAt: '2026-11-04T10:00:00Z'},
    {id: 'b', status: 'done', date: '2026-11-03', completedAt: '2026-11-04T11:00:00Z'},
    {id: 'c', status: 'todo', date: '2026-11-04'},
    {id: 'd', status: 'done', date: '2026-11-05', completedAt: '2026-11-05T09:00:00Z'},
    {id: 'e', status: 'todo', date: ''},
  ];
  const reports = [{id: 'r1', updatedAt: '2026-11-04T08:00:00Z'}, {id: 'r2', startedAt: '2026-11-05T08:00:00Z'}, {id: 'r3'}];
  const notes = [{id: 'n1', day: '2026-11-04'}, {id: 'n2', date: '2026-11-04T07:00:00Z'}, {id: 'n3', day: '2026-11-05'}, {id: 'n4'}];
  const log = dayLog({tasks, notes, reports, day: '2026-11-04', dayOf});
  assert.deepEqual(log.done.map(item => item.id), ['a', 'b'], 'a task finished that day counts, whatever day it was planned for');
  assert.deepEqual(log.open.map(item => item.id), ['c']);
  assert.deepEqual(log.jobs.map(item => item.id), ['r1'], 'a report with no time counts on no day');
  assert.deepEqual(log.notes.map(item => item.id), ['n1', 'n2']);
  assert.deepEqual(dayLog({day: '2026-11-04'}), {done: [], open: [], notes: [], jobs: []});
});
