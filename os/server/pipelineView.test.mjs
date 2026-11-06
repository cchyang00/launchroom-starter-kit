import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pipelineState} from '../src/pipeline.mjs';
import {validateLine} from '../src/theLine.mjs';
import {buildLeads, missionControl} from '../src/workflowView.mjs';
import {pipelineGroups, roundHeader, stepStations, stepRows, itemPrompts, itemActivity, lastTouch, needsYou, focusLine, productLabel, namesItem, moveText, STEP_STAGES} from '../src/pipelineView.mjs';
import {STAGES, CHECKS} from './domain.mjs';
import {SCREEN_CHECKS, RESEARCH_GATES} from './research.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};

// The Pipeline page, product page, sidebar and Home read these helpers. All
// fixtures are in memory; never the live records.
const here = path.dirname(fileURLToPath(import.meta.url));
const realLine = async () => validateLine(JSON.parse(await fs.readFile(path.resolve(here, '../../workflow/the-line.json'), 'utf8')));
const DAY = '2026-09-20';
const PILOT = 'research/2026-09-26-pilot/', NEXT = 'research/2026-10-01-next/', OLD = 'research/2026-09-15-old/';

function card(id, {owner = 'unreviewed', decision = 'CURATED — UNVERIFIED', screen = owner === 'unreviewed' ? 6 : 0, gates = 0, folder = PILOT, country = 'US', name = `Card ${id}`} = {}) {
  const checks = Object.fromEntries(SCREEN_CHECKS.map((key, i) => [key, i < screen
    ? {status: 'supported', note: 'Dated observation', source: ['productWorks', 'looksWorth'].includes(key) ? `https://example.com/item/${id}` : `${folder}evidence.md`, observedAt: DAY, country, evidenceType: 'observed',
      ...(FIND_EXTRA[key] || {}), ...(key === 'sourceMatch' ? {listingUrl: `https://example.com/supplier/${id}`, variant: `${id} variant`, destination: country, quantity: 1} : {}),
      ...(key === 'contribution' ? {costs: {currency: 'USD', sellPrice: 50, itemCost: 10, shippingCost: 5, fees: 3, returnReserve: 2, acquisitionAllowance: 15}} : {})}
    : {status: 'pending', note: '', source: '', observedAt: '', country: '', evidenceType: ''}]));
  const g = Object.fromEntries(RESEARCH_GATES.map((key, i) => [key, i < gates ? {status: 'supported', note: 'Gate evidence', source: `${folder}evidence.md`, observedAt: '2026-09-22', window: '30 days'} : {status: 'pending', note: '', source: '', observedAt: '', window: ''}]));
  return {id, name, country, buyer: gates ? 'Observed buyer situation' : '', decision, nextAction: '', references: [`${folder}${id}.md`],
    screen: {ownerDecision: owner, ownerReason: owner === 'unreviewed' ? '' : 'Owner reason', checks}, gates: g};
}
const leadsOf = candidates => buildLeads({candidates}, {batches: []});
const stageAt = id => STAGES.findIndex(stage => stage.id === id);
const upTo = stage => CHECKS.filter(check => stageAt(check.stage) <= stageAt(stage)).map(check => check.id);
const verified = ids => Object.fromEntries(ids.map(id => [id, {status: 'verified'}]));
const product = (id, lead, checks = {}, extra = {}) => ({id, name: `Product ${id}`, updatedAt: '2026-09-30T12:00:00.000Z', markets: [{id: `m-${id}`, country: 'US', status: 'active', researchCandidateId: lead, verificationGate: {ready: true}, checks}], ...extra});
const rounds = [
  {id: 'R01', number: 1, startedOn: '2026-09-15', focus: 'Old round', folders: [OLD], review: {reviewedOn: '2026-09-17', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'}},
  {id: 'R04', number: 4, startedOn: '2026-09-26', focus: 'Kalodata pilot', folders: [PILOT]},
  {id: 'R05', number: 5, startedOn: '2026-10-01', focus: 'Next batch', folders: [NEXT]},
];

/** The QA mix the owner asked for: 2 waiting, 1 saved, 1 reviewed with a P###, 1 ready, 1 building, 2 out, 2+ rounds. */
function mix(buildProductId = 'P004-building') {
  const reviewed = (id, folder = PILOT) => card(id, {owner: 'saved', screen: 8, gates: 5, folder});
  const leads = leadsOf([
    card('L096', {name: 'Disc story player'}), card('L900', {folder: NEXT, name: 'Pet water bottle'}),
    card('L901', {owner: 'saved', screen: 6, folder: NEXT}),
    reviewed('L902', NEXT), reviewed('L903'), reviewed('L904'),
    card('L095', {owner: 'rejected'}), card('L010', {folder: OLD, decision: 'PARK: declining trend'}),
  ]);
  const products = [product('P002-recording', 'L902', verified(['exact-product'])), product('P003-ready', 'L903', verified(upTo('sourcing'))), product('P004-building', 'L904', verified([...upTo('sourcing'), 'claims-rights']))];
  return pipelineState({leads, products, stages: STAGES, checks: CHECKS, rounds, buildProductId});
}

test('pipeline groups: building pinned, ready to build, rows by round with the current round first, out of the line by round', () => {
  const pipe = mix();
  const groups = pipelineGroups(pipe);
  assert.equal(groups.building.id, 'L904');
  assert.deepEqual(groups.ready.map(item => item.id), ['L903']);
  assert.deepEqual(groups.rounds.map(group => [group.label, group.current, group.items.map(item => item.id)]), [['Round 5', true, ['L902', 'L901', 'L900']], ['Round 4', false, ['L096']]]);
  assert.deepEqual(groups.out.map(group => [group.key, group.items.map(item => [item.id, item.outcome.kind])]), [['R4', [['L095', 'rejected']]], ['R1', [['L010', 'parked']]]]);
  assert.equal(groups.outCount, 2);
  // Every active row appears once across the groups.
  const shown = [groups.building, ...groups.ready, ...groups.rounds.flatMap(group => group.items)].map(item => item.id).sort();
  assert.deepEqual(shown, pipe.active.map(item => item.id).sort());
  // A card from no round sits under "Earlier work", last.
  const earlier = pipelineGroups(pipelineState({leads: leadsOf([card('L001', {folder: 'research/2026-08-01-x/'}), card('L002')]), stages: STAGES, checks: CHECKS, rounds}));
  assert.deepEqual(earlier.rounds.map(group => [group.label, group.items.map(item => item.id)]), [['Round 4', ['L002']], ['Earlier work', ['L001']]]);
  assert.deepEqual(pipelineGroups(null), {building: null, ready: [], rounds: [], out: [], outCount: 0});
});

test('round header and stations: open, ready to review, reviewed; counts per step from saved records', () => {
  const pipe = mix();
  const head = roundHeader(pipe);
  assert.deepEqual([head.label, head.focus, head.started, head.state, head.stateLabel], ['Round 5', 'Next batch', '2026-10-01', 'open', 'Open · 3 cards at Product to Prove it']);
  // Owner, Oct 2: product first, then its buyers; a saved card (L901) waits at Buyers.
  assert.deepEqual(head.stations.map(station => [station.name, station.count, station.owner]), [['Product', 2, true], ['Buyers', 1, false], ['Prove it', 1, false], ['Create', 1, false], ['Build', 0, false], ['Launch', 0, false], ['Learn', 0, false]]);
  assert.equal(head.stations[2].ready, 1); assert.equal(head.stations[2].label, '1 · 1 ready to build');
  assert.equal(head.stations[0].label, '2 products'); assert.equal(head.stations[1].label, '1 product'); assert.equal(head.stations[4].label, 'none');
  // The issue library is a reference, never a station.
  const withIssues = stepStations(pipelineState({stages: STAGES, checks: CHECKS, issues: [{slug: 'sleep', gatePassed: true, gate: {done: 5, total: 5}, rounds: [{id: 'R05', open: true}]}, {slug: 'dogs', gatePassed: false, gate: {done: 2, total: 5}, rounds: []}]}));
  assert.deepEqual(withIssues.map(station => [station.id, station.count, station.unit]), [['product', 0, 'product'], ['buyers', 0, 'product'], ['prove', 0, 'product'], ['create', 0, 'product'], ['build', 0, 'product'], ['launch', 0, 'product'], ['learn', 0, 'product']]);
  // Once every card left Product and Prove it the round can be reviewed; a saved review closes it.
  const done = pipelineState({leads: leadsOf([card('L050', {owner: 'rejected'})]), stages: STAGES, checks: CHECKS, rounds: [rounds[1]]});
  assert.deepEqual([roundHeader(done).state, roundHeader(done).stateLabel], ['review', 'Ready to review']);
  const closed = pipelineState({leads: leadsOf([card('L050', {owner: 'rejected'})]), stages: STAGES, checks: CHECKS, rounds: [{...rounds[1], review: {reviewedOn: '2026-10-01', whatWorked: 'w', whatFailed: 'f', nextChanges: 'n'}}]});
  assert.deepEqual([roundHeader(closed).state, roundHeader(closed).stateLabel], ['reviewed', 'Reviewed 2026-10-01']);
  const none = roundHeader(pipelineState({stages: STAGES, checks: CHECKS}));
  assert.deepEqual([none.state, none.stateLabel, none.stations.length], ['none', 'Start Round 1', 7]);
  // The build pick sits on Prove it when the slot is empty; the eye test on Product.
  const empty = stepStations(mix(null));
  assert.deepEqual(empty.map(station => station.owner), [true, false, true, false, false, false, false]);
});

test('step rows: each step page lists the products at that step; build steps name the building product', () => {
  const pipe = mix();
  assert.deepEqual(stepRows(pipe, 'product').items.map(item => item.id), ['L900', 'L096']);
  assert.deepEqual(stepRows(pipe, 'buyers').items.map(item => item.id), ['L901'], 'the saved card waits at Buyers');
  const prove = stepRows(pipe, 'prove');
  assert.deepEqual([prove.items.map(item => item.id), prove.ready.map(item => item.id)], [['L902'], ['L903']]);
  const create = stepRows(pipe, 'create');
  assert.deepEqual([create.items.map(item => item.id), create.building.id, create.buildStep], [['L904'], 'L904', true]);
  const build = stepRows(pipe, 'build');
  assert.deepEqual([build.items.length, build.building.stepName], [0, 'Create'], 'Build says where the building product is');
  assert.equal(stepRows(mix(null), 'create').building, null);
  assert.equal(stepRows(pipe, 'learn').buildStep, true);
});

test('a product page fills its step prompts with the product name, country and card; other blanks stay', async () => {
  const line = await realLine();
  const pipe = mix();
  const saved = pipe.items.find(item => item.id === 'L901');
  const prompts = itemPrompts(saved, line);
  assert.equal(prompts.length, 3);
  assert.match(prompts[0].text, /^Research the buyers of Card L901 \(L901\): /);
  assert.match(prompts[1].text, /Card L901/); assert.doesNotMatch(prompts[1].text, /\[product\]/);
  const waiting = itemPrompts(pipe.items.find(item => item.id === 'L096'), line);
  assert.match(waiting[0].text, /\[category\]/, 'blanks that are not the product stay highlighted');
  assert.match(itemPrompts(pipe.items.find(item => item.id === 'L904'), line)[0].text, /Product P004-building/, 'a building product uses its product name');
  assert.deepEqual(itemPrompts(saved, null), []);
  assert.deepEqual(STEP_STAGES[2], ['discovery', 'validation', 'sourcing']);
  assert.deepEqual(STEP_STAGES.slice(3), [['creative'], ['shopify'], ['testing'], ['learning']]);
});

test('agents and to-dos on a product: tasks and reports naming it by card or product id, newest events, last update', () => {
  const pipe = mix();
  const building = pipe.items.find(item => item.id === 'L904');
  const tasks = [
    {id: 't1', title: 'Write the copy brief', product: 'L904', status: 'done', updatedAt: '2026-09-30T10:00:00.000Z'},
    {id: 't2', title: 'Make the ad images', product: 'P004-building', status: 'doing', updatedAt: '2026-09-29T10:00:00.000Z'},
    {id: 't3', title: 'Other product', product: 'L903', status: 'todo', updatedAt: '2026-10-01T10:00:00.000Z'},
    {id: 't4', title: 'No product', status: 'todo', updatedAt: '2026-10-01T11:00:00.000Z'},
  ];
  const activity = [
    {id: 'r1', title: 'Copy', agent: 'copywriter', role: 'image-generator', product: 'L904', updatedAt: '2026-10-01T09:00:00.000Z', events: [{at: '2026-09-30T09:00:00.000Z', text: 'Started'}, {at: '2026-10-01T09:00:00.000Z', text: 'Draft saved'}]},
    {id: 'r2', title: 'Elsewhere', product: 'L903', updatedAt: '2026-10-01T12:00:00.000Z', events: [{at: '2026-10-01T12:00:00.000Z', text: 'x'}]},
  ];
  const mine = itemActivity(building, {tasks, activity});
  assert.deepEqual(mine.tasks.map(task => task.id), ['t2', 't1'], 'open work first');
  assert.deepEqual(mine.reports.map(report => report.id), ['r1']);
  assert.deepEqual(mine.events.map(event => event.text), ['Draft saved', 'Started']);
  assert.equal(mine.last, '2026-10-01T09:00:00.000Z');
  assert.equal(lastTouch(pipe.items.find(item => item.id === 'L096'), {tasks, activity}), DAY, 'a card with no task or report: its newest dated Find check');
  assert.ok(namesItem(building, 'P004-building') && namesItem(building, 'L904') && !namesItem(building, 'L903') && !namesItem(building, ''));
  assert.equal(productLabel(pipe, 'P004-building'), 'L904 Product P004-building');
  assert.equal(productLabel(pipe, 'L777'), 'L777'); assert.equal(productLabel(pipe, ''), '');
  assert.deepEqual(itemActivity(null), {tasks: [], reports: [], events: [], last: ''});
});

test('a saved card an agent parked counts as out of the line on the stage signals too (lineLeadState)', async () => {
  const {stageSignals} = await import('../src/workflowView.mjs');
  const leads = leadsOf([card('L301', {owner: 'saved', screen: 2}), card('L302', {owner: 'saved', screen: 6, decision: 'PARK: no quantity-one source'}), card('L303')]);
  const signals = stageSignals({data: {}, research: {}, leads, hub: {}});
  assert.equal(signals.product.detail, '1 saved for checks');
  assert.equal(signals.prove.detail, '1 saved · 0 exact sources');
  assert.equal(leads.find(lead => lead.id === 'L302').state, 'saved', 'the saved card itself is unchanged');
});

test('needs you and the focus line come from the pipeline\'s owner moves; mission control uses them too', () => {
  const empty = mix(null);
  const moves = needsYou(empty);
  assert.deepEqual(moves.map(move => [move.kind, move.title, move.items.map(item => item.id)]), [['build-pick', 'Pick what builds next', ['L904', 'L903']], ['eye-test', 'Eye test', ['L900', 'L096']]]);
  assert.deepEqual(focusLine(empty), {round: 'Round 5', next: 'Owner: pick which product builds next: L904, L903 ("Build this one" on its page, with a reason).', who: 'owner', owner: true, searching: null, text: 'Round 5 · Owner: pick which product builds next: L904, L903 ("Build this one" on its page, with a reason).'});
  const building = focusLine(mix());
  assert.equal(building.owner, false); assert.match(building.text, /^Round 5 · Image maker: /);
  assert.equal(focusLine(null).text, 'No round yet · nothing on the line');
  assert.equal(moveText('Owner: eye test — Save for checks.'), 'Eye test — Save for checks.');
  assert.equal(moveText('Buyer researcher: read the forums.'), 'Read the forums.');
  assert.equal(moveText('Pick one: a or b'), 'Pick one: a or b', 'only a known who prefix is taken off');
  assert.equal(moveText(''), '');
  const mc = missionControl({ownerMoves: empty.ownerMoves, now: new Date('2026-10-01T12:00:00Z')});
  assert.deepEqual(mc.needsDecision.items.map(item => [item.kind, item.count, item.go]), [['build-pick', 2, 'pipeline'], ['eye-test', 2, 'find']]);
  const launch = missionControl({ownerMoves: [{kind: 'launch', ids: ['L904'], count: 1, step: 5}], now: new Date('2026-10-01T12:00:00Z')});
  assert.deepEqual(launch.needsDecision.items.map(item => [item.kind, item.go]), [['launch', 'product/L904']]);
});
