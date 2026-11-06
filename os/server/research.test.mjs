import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {emptyResearch,RESEARCH_GATES,SCREEN_CHECKS,validateResearch,updateResearch,researchSummary,migrateScreen,migrateResearch,checkPasses,audienceRoomMet,provenDemandMet} from './research.mjs';
import {createStore} from './store.mjs';
import {parseResearchDocument,batchAssignment,effectiveResearchGateStatus,demandNumbers} from '../src/researchView.mjs';
const STEP2_EXTRA = {dropshippable: {source: 'https://cjdropshipping.com/product/fixture-item', usShipping: true}, demand: [{metric: 'amazon-bought', value: 400, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-08-15'}, {metric: 'amazon-bought', value: 500, url: 'https://www.amazon.com/dp/FIXTURE', observedAt: '2026-09-15'}], metaGap: {source: 'https://www.facebook.com/ads/library/?q=fixture', advertisers: 5, liveAds: 12, longestActiveDays: 140, gap: 'Nobody speaks to night-shift workers'}, bigIssue: {issues: ['sleep'], ladder: {functional: 'Blocks snoring noise', emotional: 'Calm, not resentful', life: 'Rested for work'}, note: 'Related to the sleep issue'}};
const FIND_EXTRA = {dropshippable: STEP2_EXTRA.dropshippable, metaGap: STEP2_EXTRA.metaGap, bigIssue: STEP2_EXTRA.bigIssue, provenDemand: {demand: STEP2_EXTRA.demand, advertisers: 5, longestActiveDays: 140, liveAds: 12, source: 'https://www.facebook.com/ads/library/?q=fixture', observedAt: '2026-09-15'}, audienceRoom: {mainAudience: 'Seniors with knee arthritis', audiences: [{who: 'Construction workers', problem: 'Knee strain from kneeling all day', why: 'Same brace; job forums complain about it'}, {who: 'Gardeners', problem: 'Sore knees after weeding', why: 'Related routine with the same pain'}]}, buyers: {quotes: 15, avatars: [{who: 'Night-shift nurses', trigger: 'Trying to sleep at noon'}, {who: 'New parents', trigger: 'Feeds at 3 a.m.'}], angleGap: 'Nobody speaks to night-shift nurses'}};
const candidate=(id,status='pending')=>({id,name:'Temporary isolated candidate',country:'US',buyer:'Observed use case',decision:'Under review',nextAction:'Inspect remaining evidence',references:['research/evidence.md'],screen:{ownerDecision:'saved',ownerReason:'Fixture eye test',checks:Object.fromEntries(SCREEN_CHECKS.map(key=>[key,{status:'supported',note:'Fixture pre-verification evidence',source:key==='productWorks'?'https://example.com/exact-item':'research/evidence.md',observedAt:'2026-09-15',country:'US',evidenceType:'observed',...(FIND_EXTRA[key] || {}), ...(key==='sourceMatch'?{variant:'Fixture variant',destination:'US',quantity:1,listingUrl:'https://example.com/fixture-sku'}:{}),...(key==='contribution'?{costs:{currency:'USD',sellPrice:50,itemCost:10,shippingCost:5,fees:3,returnReserve:2,acquisitionAllowance:15}}:{})}]))},gates:Object.fromEntries(RESEARCH_GATES.map(key=>[key,{status,note:'Scoped evidence and counterevidence reviewed',source:'research/evidence.md',observedAt:'2026-09-15',window:'2026-08-16 through 2026-09-14'}]))});
test('screening ten products and finishing reports cannot manufacture five completed comparisons',()=>{
 const b={...emptyResearch(),candidates:Array.from({length:10},(_,i)=>candidate('L'+String(i+1).padStart(3,'0')))};
 assert.equal(researchSummary(validateResearch(b)).reviewed,0);
 assert.throws(()=>updateResearch(b,{revision:0,selectedId:'L001',selectionReason:'Numbers look good'}),/five complete comparisons/);
 b.candidates[0]=candidate('L001','supported');
 assert.equal(researchSummary(b).reviewed,1);
 assert.throws(()=>updateResearch(b,{revision:0,selectedId:'L001',selectionReason:'Early favorite'}),/five complete comparisons/);
});
test('selection requires complete comparison, no failed selected gate and recorded rationale',()=>{
 const b={...emptyResearch(),candidates:Array.from({length:5},(_,i)=>candidate('L'+String(i+1).padStart(3,'0'),'supported'))};
 assert.equal(researchSummary(b).remaining,0);
 b.candidates[0].gates.fit.status='failed';
 assert.throws(()=>updateResearch(b,{revision:0,selectedId:'L001',selectionReason:'Good sales'}),/every research gate/);
 assert.throws(()=>updateResearch(b,{revision:0,selectedId:'L002'}),/rationale/);
 const selected=updateResearch(b,{revision:0,selectedId:'L002',selectionReason:'Owner reviewed the complete alternatives and selected this offer.'});
 assert.equal(selected.selectedId,'L002');assert.equal('winner' in selected,false);
});
test('gate decisions require dated scoped source evidence and valid identities',()=>{
 const b={...emptyResearch(),candidates:[candidate('L001','supported')]};
 b.candidates[0].gates.demand.source='';assert.throws(()=>validateResearch(b),/source/);
 b.candidates[0].gates.demand.source='research/evidence.md';b.candidates[0].gates.demand.observedAt='2026-02-30';assert.throws(()=>validateResearch(b),/real non-future/);
});
test('later deep gates (community, fit) still require owner Save, fast screen and exact-source contribution preflight',()=>{
 const original={...emptyResearch(),candidates:[]};
 const lead=candidate('L101','pending');lead.screen.ownerDecision='unreviewed';
 lead.gates.community.status='supported';
 assert.throws(()=>updateResearch(original,{revision:0,candidate:lead}),/Complete the fast screen/);
 lead.screen.ownerDecision='saved';lead.screen.checks.metaGap.status='pending';
 assert.throws(()=>updateResearch(original,{revision:0,candidate:lead}),/Complete the fast screen/);
 lead.screen.checks.metaGap.status='supported';lead.screen.checks.sourceMatch.status='failed';
 assert.throws(()=>updateResearch(original,{revision:0,candidate:lead}),/exact-source and contribution/);
 lead.screen.checks.sourceMatch.status='supported';lead.screen.checks.contribution.status='pending';
 assert.throws(()=>updateResearch(original,{revision:0,candidate:lead}),/exact-source and contribution/);
 lead.screen.checks.contribution.status='supported';
 const saved=updateResearch(original,{revision:0,candidate:lead});
 assert.equal(saved.candidates[0].gates.community.status,'supported');
 assert.equal(researchSummary(saved).reviewed,0);
});
// Oct 3 (workflow/CHECKS.md Step 3): P1 (an opening) is checked first, before P2 sourceMatch and P4 contribution.
const p1Lead=()=>{const lead=candidate('L101','pending');for(const id of ['sourceMatch','contribution'])lead.screen.checks[id]={status:'pending',note:'',source:'',observedAt:'',country:'',evidenceType:''};return lead;};
const p1Gate=()=>({status:'supported',note:'Opening: stable demand, few competitors',source:'research/evidence.md',observedAt:'2026-09-15',window:'2026-08-16 through 2026-09-14'});
test('P1 (demand, competition) saves on a saved card that passed Buyers while P2 and P4 are pending',()=>{
 const original={...emptyResearch(),candidates:[]};
 const lead=p1Lead();lead.gates.demand=p1Gate();lead.gates.competition={...p1Gate(),status:'failed',note:'Crowded'};
 const saved=updateResearch(original,{revision:0,candidate:lead});
 assert.equal(saved.candidates[0].gates.demand.status,'supported');
 assert.equal(saved.candidates[0].gates.competition.status,'failed');
 assert.equal(effectiveResearchGateStatus(saved.candidates[0],'demand'),'supported');
 assert.equal(effectiveResearchGateStatus(saved.candidates[0],'community'),'pending');
 assert.equal(researchSummary(saved).reviewed,0);
 // P2 sourcing still waits for sourceMatch; community and fit for the full preflight.
 const more=structuredClone(saved.candidates[0]);more.gates.sourcing=p1Gate();
 assert.throws(()=>updateResearch(saved,{revision:saved.revision,candidate:more}),/P2 sourcing is recorded after/);
 more.gates.sourcing.status='pending';more.gates.fit=p1Gate();
 assert.throws(()=>updateResearch(saved,{revision:saved.revision,candidate:more}),/Complete the fast screen/);
 // Finishing P2 and P4 later keeps P1 (no "Reopen historical deep gates").
 const done=candidate('L101','pending');done.gates.demand=p1Gate();done.gates.competition={...p1Gate(),status:'failed',note:'Crowded'};
 const later=updateResearch(saved,{revision:saved.revision,candidate:done});
 assert.equal(later.candidates[0].gates.demand.status,'supported');
 // Changing the item or country after P1 means reopening it first.
 const moved=structuredClone(later.candidates[0]);moved.buyer='A different buyer';
 assert.throws(()=>updateResearch(later,{revision:later.revision,candidate:moved}),/Reopen resolved deep gates/);
});
test('P1 is still refused without the owner Save, without passed Buyers or without dated sourced evidence',()=>{
 const original={...emptyResearch(),candidates:[]};
 const unsaved=p1Lead();unsaved.screen.ownerDecision='unreviewed';unsaved.gates.demand=p1Gate();
 assert.throws(()=>updateResearch(original,{revision:0,candidate:unsaved}),/is recorded after the owner.s Save and a passed Buyers/);
 const noBuyers=p1Lead();noBuyers.screen.checks.buyers.status='pending';noBuyers.gates.competition=p1Gate();
 assert.throws(()=>updateResearch(original,{revision:0,candidate:noBuyers}),/passed Buyers check/);
 const thinBuyers=p1Lead();thinBuyers.screen.checks.buyers.quotes=3;thinBuyers.gates.demand=p1Gate();
 assert.throws(()=>updateResearch(original,{revision:0,candidate:thinBuyers}),/passed Buyers check/);
 const noSource=p1Lead();noSource.gates.demand={...p1Gate(),source:''};
 assert.throws(()=>updateResearch(original,{revision:0,candidate:noSource}),/source/);
 const noDate=p1Lead();noDate.gates.demand={...p1Gate(),observedAt:''};
 assert.throws(()=>updateResearch(original,{revision:0,candidate:noDate}),/observedAt|observation date/);
 // Unknown stays pending: a pending P1 always saves.
 assert.doesNotThrow(()=>updateResearch(original,{revision:0,candidate:p1Lead()}));
});
test('legacy partial gate evidence stays readable but cannot advance without a screen',()=>{
 const legacy=candidate('L102','pending');delete legacy.screen;legacy.gates.demand.status='failed';
 const existing={...emptyResearch(),candidates:[legacy]};
 assert.equal(researchSummary(validateResearch(existing)).reviewed,0);
 const changed=structuredClone(legacy);changed.gates.community.status='supported';
 assert.throws(()=>updateResearch(existing,{revision:0,candidate:changed}),/Complete the fast screen/);
 assert.equal(updateResearch(existing,{revision:0,candidate:{...legacy,nextAction:'Preserve the historical failure.'}}).candidates[0].gates.demand.status,'failed');
 assert.equal(effectiveResearchGateStatus(legacy,'demand'),'historical');
 assert.equal(effectiveResearchGateStatus(legacy,'community'),'pending');
 assert.equal(effectiveResearchGateStatus(candidate('L103','supported'),'demand'),'supported');
});
test('old deep decisions cannot become current after a new screen or changed offer scope',()=>{
 const legacy=candidate('L105','pending');delete legacy.screen;legacy.gates.demand.status='failed';
 let batch={...emptyResearch(),candidates:[legacy]};
 const screened=candidate('L105','pending');screened.gates.demand.status='failed';
 assert.throws(()=>updateResearch(batch,{revision:0,candidate:screened}),/Reopen historical deep gates/);
 screened.gates.demand.status='pending';
 batch=updateResearch(batch,{revision:0,candidate:screened});
 const reviewed=candidate('L105','supported');
 batch=updateResearch(batch,{revision:batch.revision,candidate:reviewed});
 const changed=structuredClone(reviewed);changed.country='GB';
 for(const check of Object.values(changed.screen.checks))check.country='GB';
 changed.screen.checks.sourceMatch.destination='GB';
 assert.throws(()=>updateResearch(batch,{revision:batch.revision,candidate:changed}),/Reopen resolved deep gates/);
 const changedSource=structuredClone(reviewed);changedSource.screen.checks.sourceMatch.variant='Different variant';
 assert.throws(()=>updateResearch(batch,{revision:batch.revision,candidate:changedSource}),/Reopen resolved deep gates/);
 const alias=structuredClone(reviewed);alias.country='United States';alias.screen.checks.sourceMatch.destination='USA';
 for(const check of Object.values(alias.screen.checks))check.country='United States';
 assert.doesNotThrow(()=>updateResearch(batch,{revision:batch.revision,candidate:alias}));
 for(const gate of Object.values(changed.gates))gate.status='pending';
 const reopened=updateResearch(batch,{revision:batch.revision,candidate:changed});
 assert.equal(researchSummary(reopened).reviewed,0);
});
test('source and contribution passes require exact quantity-one and positive stated headroom',()=>{
 const b={...emptyResearch(),candidates:[candidate('L103')]};
 b.candidates[0].screen.checks.sourceMatch.listingUrl='';
 assert.throws(()=>validateResearch(b),/listing URL/);
 b.candidates[0].screen.checks.sourceMatch.listingUrl='https://example.com/fixture-sku';
 b.candidates[0].screen.checks.sourceMatch.quantity=2;
 assert.throws(()=>validateResearch(b),/quantity-one/);
 b.candidates[0].screen.checks.sourceMatch.quantity=1;
 b.candidates[0].screen.checks.contribution.costs.acquisitionAllowance=0;
 assert.throws(()=>validateResearch(b),/positive acquisition allowance/);
 b.candidates[0].screen.checks.contribution.costs.acquisitionAllowance=35;
 assert.throws(()=>validateResearch(b),/positive headroom/);
 b.candidates[0].screen.checks.contribution.costs.acquisitionAllowance=15;
 b.candidates[0].screen.checks.looksWorth.evidenceType='';
 assert.throws(()=>validateResearch(b),/evidenceType/);
 b.candidates[0].screen.checks.looksWorth.evidenceType='observed';
 b.candidates[0].screen.checks.productWorks.source='research/evidence.md';
 assert.throws(()=>validateResearch(b),/exact observed listing URL/);
 b.candidates[0].screen.checks.productWorks.source='https://example.com/exact-item';
 b.candidates[0].screen.checks.sourceMatch.evidenceType='hypothesis';
 assert.throws(()=>validateResearch(b),/not a hypothesis/);
});
test('resolved screen findings and supplier route belong to the candidate selling country',()=>{
 const b={...emptyResearch(),candidates:[candidate('L104')]};
 b.candidates[0].screen.checks.looksWorth.country='GB';
 assert.throws(()=>validateResearch(b),/match the candidate selling country/);
 b.candidates[0].screen.checks.looksWorth.country='United States';
 assert.doesNotThrow(()=>validateResearch(b));
 b.candidates[0].screen.checks.sourceMatch.destination='GB';
 assert.throws(()=>validateResearch(b),/destination must match/);
 b.candidates[0].screen.checks.sourceMatch.destination='United States';
 assert.doesNotThrow(()=>validateResearch(b));
 b.candidates[0].country='';
 assert.throws(()=>validateResearch(b),/candidate selling country/);
});
test('research records persist through restart and reject stale concurrent writes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'research-handoff-'));await mkdir(path.join(root,'resources/issues/sleep'),{recursive:true});await writeFile(path.join(root,'resources/issues/sleep/ISSUE.md'),'# Issue: Fixture sleep issue\n');
 try{await mkdir(path.join(root,'research'));await writeFile(path.join(root,'research','evidence.md'),'# Test evidence\n');const store=createStore({workspaceRoot:root});const empty=await store.getResearch();assert.equal(empty.summary.reviewed,0);
 const saved=await store.patchResearch({revision:0,candidate:candidate('L011')});assert.equal(saved.revision,1);
 await assert.rejects(store.patchResearch({revision:0,candidate:candidate('L012')}),e=>e.status===409);
 const reloaded=await createStore({workspaceRoot:root}).getResearch();assert.equal(reloaded.candidates[0].id,'L011');assert.equal(reloaded.summary.reviewed,0);
 const projection=await store.readDocument('research/COMPARISON.md');const visible=parseResearchDocument(projection.content);assert.equal(visible.revision,reloaded.revision);assert.equal(visible.candidates[0].id,'L011');assert.equal(visible.summary.reviewed,0);
 assert.match(await readFile(path.join(root,'research/comparison.json'),'utf8'),/L011/);
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});
test('failed research commits preserve authoritative JSON and its generated view',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'research-commit-'));await mkdir(path.join(root,'resources/issues/sleep'),{recursive:true});await writeFile(path.join(root,'resources/issues/sleep/ISSUE.md'),'# Issue: Fixture sleep issue\n');
 try{
  await mkdir(path.join(root,'research'));
  await writeFile(path.join(root,'research','evidence.md'),'# Fixture evidence\n');
  const regular=createStore({workspaceRoot:root});
  await regular.patchResearch({revision:0,candidate:candidate('L011')});
  const jsonPath=path.join(root,'research','comparison.json');
  const viewPath=path.join(root,'research','COMPARISON.md');
  const beforeJson=await readFile(jsonPath,'utf8');
  const beforeView=await readFile(viewPath,'utf8');
  for(const blockedPath of [jsonPath,viewPath]){
   const failing=createStore({workspaceRoot:root,replaceFileImpl:async(source,target)=>{
    if(target===blockedPath)throw new Error('Simulated write failure');
    await rename(source,target);
   }});
   await assert.rejects(failing.patchResearch({revision:1,candidate:candidate('L012')}),/Simulated write failure/);
   assert.equal(await readFile(jsonPath,'utf8'),beforeJson);
   assert.equal(await readFile(viewPath,'utf8'),beforeView);
   assert.equal((await failing.getResearch()).revision,1);
  }
  const retry=await regular.patchResearch({revision:1,candidate:candidate('L012')});
  assert.equal(retry.revision,2);
  assert.equal(parseResearchDocument(await readFile(viewPath,'utf8')).revision,2);
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});
test('newly resolved research findings require existing local evidence files',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'research-evidence-'));await mkdir(path.join(root,'resources/issues/sleep'),{recursive:true});await writeFile(path.join(root,'resources/issues/sleep/ISSUE.md'),'# Issue: Fixture sleep issue\n');
 try{
  await mkdir(path.join(root,'research'));
  const store=createStore({workspaceRoot:root});const lead=candidate('L111');
  await assert.rejects(store.patchResearch({revision:0,candidate:lead}),error=>error.code==='EVIDENCE_NOT_FOUND');
  assert.equal((await store.getResearch()).revision,0);
  await writeFile(path.join(root,'research','evidence.md'),'# Observed fixture only\n');
  const saved=await store.patchResearch({revision:0,candidate:lead});assert.equal(saved.revision,1);
  const changed=structuredClone(lead);changed.gates.demand.status='supported';changed.gates.demand.source='research/missing.md';
  await assert.rejects(store.patchResearch({revision:1,candidate:changed}),error=>error.code==='EVIDENCE_NOT_FOUND');
  assert.equal((await store.getResearch()).revision,1);
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await rm(root,{recursive:true,force:true});}
});
test('batch assignment separates early owner curation from verified build comparison',()=>{
 const job=batchAssignment();assert.equal(job.role,'manager');assert.equal(job.productId,'');assert.match(job.brief,/Dispatch bounded specialists/);assert.match(job.brief,/five complete review packets/);assert.match(job.brief,/without routine permission/);assert.match(job.brief,/Read back comparison/);assert.match(job.brief,/spending budget remain separate/);
 assert.equal(job.marketId,'');assert.match(job.brief,/10–20 unique product families labeled CURATED — UNVERIFIED/);
 assert.match(job.brief,/Source unknown is allowed on early cards when honestly marked/);
 assert.match(job.brief,/Save for checks \/ Pass for now \/ Reject/);
 assert.match(job.brief,/Wait for an owner choice before deep source, Kalodata\/community or Trendtrack work/);
 assert.match(job.brief,/Do not require five complete reviews before showing early cards/);
 assert.match(job.brief,/queues source\/contribution preflight only; it is not build approval/);
 assert.ok(job.references.includes('workflow/PRE-VERIFICATION-SCREEN.md'));
 assert.match(job.brief,/Discovery runs in the Meta Ad Library \(free, no login, in the built-in browser\) with the Find filter in workflow\/CHECKS\.md/);
 assert.match(job.brief,/Only products that pass all five become cards\. Record the seeds used, rows scanned and drop counts by reason/);
 assert.match(job.brief,/Kalodata is an optional cross-check only when a session already exists; agents cannot use Luxury\/DICloak/);
 assert.ok(job.references.includes('workflow/CHECKS.md'));assert.ok(!job.references.includes('workflow/KALODATA-IMAGE-PILOT.md'));
 assert.match(job.brief,/Trendtrack authentication is required before the first saved survivor's final Meta competition check/);
 assert.match(job.brief,/not before early visual cards/);
 assert.ok(job.references.includes('workflow/PRE-DISCOVERY-CHECKLIST.md'));
 assert.ok(job.references.includes('research/CURATION-QUEUE.md'));assert.ok(job.references.includes('templates/CURATION-BATCH.md'));
});

test('batch assignment resumes the registered dated research batch',()=>{
 const path='research/2026-09-26-kalodata-image-pilot/BATCH.md';
 const job=batchAssignment(path);
 assert.match(job.brief,/Resume the registered current batch/);
 assert.ok(job.references.includes(path));
 const invalid=batchAssignment('research/../../secrets/BATCH.md');
 assert.ok(!invalid.references.includes('research/../../secrets/BATCH.md'));
});
test('Find checks before Oct 2: F1 proven demand was Meta-first: 2+ advertisers, an ad live 30+ days, 3+ live ads; Kalodata numbers still pass',()=>{
 // Owner, Oct 2: the six Step 1 checks in their order of work, the preflight, the Oct 1 checks kept on saved cards, then Step 2's buyers check.
 assert.deepEqual(SCREEN_CHECKS,['provenDemand','dropshippable','looksWorth','audienceRoom','bigIssue','metaGap','sourceMatch','contribution','productWorks','noBrand','buyers']);
 const b={...emptyResearch(),candidates:[candidate('L120')]};
 assert.doesNotThrow(()=>validateResearch(b));
 const f1=b.candidates[0].screen.checks.provenDemand;
 f1.advertisers=1;assert.throws(()=>validateResearch(b),/2\+ different advertisers/);
 f1.advertisers=2;f1.longestActiveDays=29;assert.throws(()=>validateResearch(b),/30\+ days/);
 f1.longestActiveDays=30;f1.liveAds=2;assert.throws(()=>validateResearch(b),/3\+ live ads/);
 f1.liveAds=3;assert.doesNotThrow(()=>validateResearch(b),'exactly at the minimums passes');
 f1.source='research/evidence.md';assert.throws(()=>validateResearch(b),/source link/);
 f1.source='https://www.facebook.com/ads/library/?q=fixture';
 f1.liveAds=1.5;assert.throws(()=>validateResearch(b),/whole number/);
 f1.liveAds=3;f1.line='sideways';assert.throws(()=>validateResearch(b),/line must be/);
 delete f1.line;
 // Kalodata numbers are optional extras, never required; the earlier Kalodata rule still passes on its own.
 Object.assign(f1,{units:400,creators:1});assert.doesNotThrow(()=>validateResearch(b));
 const kalodataOnly={...f1,demand:undefined,advertisers:undefined,longestActiveDays:undefined,liveAds:undefined,units:1500,creators:4,line:'rising',window:'2026-08-31 to 2026-09-29'};
 assert.equal(provenDemandMet(kalodataOnly),true,'valid evidence under the Oct 1 rule');
 // Owner, Oct 2: without its statistics (2+ dated points) a card never reaches the eye test.
 assert.equal(checkPasses('provenDemand',kalodataOnly),false);
 assert.equal(checkPasses('provenDemand',{...kalodataOnly,demand:f1.demand}),true);
 assert.equal(checkPasses('provenDemand',{...kalodataOnly,demand:[f1.demand[1],{...f1.demand[0],value:900}]}),false,'falling statistics never pass');
 // A failed F1 keeps its numbers and stays visible; it never counts as a pass.
 Object.assign(f1,{status:'failed',advertisers:1,longestActiveDays:12,liveAds:1});assert.doesNotThrow(()=>validateResearch(b));
 assert.equal(checkPasses('provenDemand',f1),false);assert.equal(researchSummary(b).fastScreened,0);
 Object.assign(f1,{status:'supported',advertisers:5,longestActiveDays:140,liveAds:12});assert.equal(researchSummary(validateResearch(b)).fastScreened,1);
 assert.equal(demandNumbers(f1),'Amazon bought in past month 500 · rising over 2 points · 5 advertisers · oldest 140 days · 12 live ads · Kalodata: 400 units, 1 creator');
});
test('Step 2 checks: F3 angles and avatars needs the main audience and two named others',()=>{
 const b={...emptyResearch(),candidates:[candidate('L121')]};
 const f4=b.candidates[0].screen.checks.audienceRoom;
 f4.audiences=f4.audiences.slice(0,1);assert.throws(()=>validateResearch(b),/at least two other audiences/);
 f4.audiences.push({who:'Tilers',problem:'Kneeling on hard floors',why:''});assert.throws(()=>validateResearch(b),/at least two other audiences/);
 f4.audiences[1].why='Trade forum threads about knee pads';assert.doesNotThrow(()=>validateResearch(b));
 f4.mainAudience='';assert.throws(()=>validateResearch(b),/main audience/);
 f4.mainAudience='Seniors with knee arthritis';f4.audiences=Array.from({length:7},()=>({who:'a',problem:'b',why:'c'}));assert.throws(()=>validateResearch(b),/at most six/);
 f4.audiences=[];f4.status='pending';assert.doesNotThrow(()=>validateResearch(b));
 assert.equal(audienceRoomMet(f4),false);
});
test('old seven-check screens map to F1-F5 without losing the owner decision',()=>{
 const blank=()=>({status:'pending',note:'',source:'',observedAt:'',country:'',evidenceType:''});
 const old={ownerDecision:'rejected',ownerReason:'Just something about it screams cheap',checks:Object.fromEntries(['identity','exclusions','buyerMoment','honestCreative','operationalRisk','sourceMatch','contribution'].map(id=>[id,blank()]))};
 const moved=migrateScreen(old);
 assert.deepEqual(Object.keys(moved.checks),SCREEN_CHECKS);
 assert.equal(moved.ownerDecision,'rejected');assert.equal(moved.ownerReason,'Just something about it screams cheap');
 const seen={...blank(),status:'supported',note:'Exact listing',source:'https://example.com/item',observedAt:'2026-09-15',country:'US',evidenceType:'observed'};
 const rich={ownerDecision:'saved',ownerReason:'Yes',checks:{...old.checks,identity:seen,honestCreative:{...seen,status:'failed',note:'Clip uses a filter',source:'research/evidence.md'},exclusions:{...seen,note:'Unbranded',source:'research/evidence.md'},operationalRisk:{...seen,note:'Battery',source:'research/evidence.md'},buyerMoment:{...seen,status:'failed',note:'No emotion',source:'research/evidence.md'}}};
 const out=migrateScreen(rich).checks;
 assert.equal(out.productWorks.status,'failed','a failed old image check can only fail the new check');
 assert.equal(out.productWorks.source,'https://example.com/item');assert.match(out.productWorks.note,/Exact listing · Image: Clip uses a filter/);
 assert.equal(out.noBrand.status,'supported');assert.match(out.noBrand.note,/Unbranded · Flags: Battery/);
 assert.equal(out.audienceRoom.status,'pending','the old buyer moment is kept as a note only');assert.match(out.audienceRoom.note,/Earlier buyer moment: No emotion/);
 assert.equal(out.provenDemand.status,'pending');assert.equal(out.looksWorth.status,'pending');
 const data={...emptyResearch(),candidates:[{...candidate('L122'),screen:old}]};
 assert.doesNotThrow(()=>validateResearch(migrateResearch(data)));
 assert.throws(()=>validateResearch(data),/Unknown pre-verification check/);
 // Updates sent with the old ids are moved too.
 const saved=updateResearch(emptyResearch(),{revision:0,candidate:{...candidate('L123'),screen:old}});
 assert.deepEqual(Object.keys(saved.candidates[0].screen.checks),SCREEN_CHECKS);
});
test('the store reads an old comparison file through the migration',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'merrivy-find-checks-'));await mkdir(path.join(root,'resources/issues/sleep'),{recursive:true});await writeFile(path.join(root,'resources/issues/sleep/ISSUE.md'),'# Issue: Fixture sleep issue\n');t.after(()=>rm(root,{recursive:true,force:true}));
 const blank=()=>({status:'pending',note:'',source:'',observedAt:'',country:'',evidenceType:''});
 const old={ownerDecision:'rejected',ownerReason:'Too basic',checks:Object.fromEntries(['identity','exclusions','buyerMoment','honestCreative','operationalRisk','sourceMatch','contribution'].map(id=>[id,blank()]))};
 await mkdir(path.join(root,'research'),{recursive:true});
 await writeFile(path.join(root,'research/comparison.json'),JSON.stringify({...emptyResearch(),revision:3,candidates:[{...candidate('L095'),screen:old}]}));
 await writeFile(path.join(root,'research/evidence.md'),'# Test evidence\n');
 const research=await createStore({workspaceRoot:root}).getResearch();
 assert.deepEqual(Object.keys(research.candidates[0].screen.checks),SCREEN_CHECKS);
 assert.equal(research.candidates[0].screen.ownerReason,'Too basic');
});
