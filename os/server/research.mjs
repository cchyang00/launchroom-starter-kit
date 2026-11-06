import {assertRevision,evidenceSource,fail,object,text} from './domain.mjs';
import {countryKey} from './country.mjs';
import {reasonTagsProblem,sameDecision,decisionOf,OWNER_NOTE_MAX,saidProblem} from '../src/eyeTest.mjs';
export const RESEARCH_GATES=['demand','community','competition','sourcing','fit'];
// The six Step 1 checks (workflow/CHECKS.md F1-F6, owner Oct 2) come before
// the owner's eye test: statistics, a good product, 3+ avatars or angles, a Meta
// gap and a big enough issue. sourceMatch and contribution are the Prove it
// preflight after the owner’s Save; productWorks and noBrand are the Oct 1
// checks kept on saved cards. The pure rules live in src/researchView.mjs.
import {FIND_CHECK_IDS,PREFLIGHT_CHECK_IDS,SCREEN_CHECK_IDS,READY_CHECK_IDS,PROVEN_DEMAND_MINIMUM,KALODATA_MINIMUM,DEMAND_RULE,DEMAND_COUNTS,DEMAND_LINES,DEMAND_METRICS,AUDIENCE_MINIMUM,STATS_RULE,provenDemandMet,metaDemandMet,kalodataDemandMet,step2RuleApplies,metaGapMet,dropshippableMet,bigIssueMet,ISSUE_SLUG_RULE,cardIdentity,namedAudiences,audienceRoomMet,checkPasses,buyersMet,BUYERS_RULE,gateOpen,P1_GATE_IDS} from '../src/researchView.mjs';
export {gateOpen,P1_GATE_IDS,PROVEN_DEMAND_MINIMUM,KALODATA_MINIMUM,DEMAND_RULE,DEMAND_LINES,AUDIENCE_MINIMUM,provenDemandMet,metaDemandMet,kalodataDemandMet,namedAudiences,audienceRoomMet,checkPasses};
export const FIND_CHECKS=FIND_CHECK_IDS;
export const PREFLIGHT_CHECKS=PREFLIGHT_CHECK_IDS;
export const SCREEN_CHECKS=SCREEN_CHECK_IDS;
export const FAST_SCREEN_CHECKS=FIND_CHECKS;
const blankCheck=()=>({status:'pending',note:'',source:'',observedAt:'',country:'',evidenceType:''});
export const emptyScreen=()=>({ownerDecision:'unreviewed',ownerReason:'',checks:Object.fromEntries(SCREEN_CHECKS.map(id=>[id,blankCheck()]))});
export function screenReady(candidate){const screen=candidate?.screen;return Boolean(screen&&!candidate.missingEvidence?.screen?.length&&READY_CHECK_IDS.every(id=>checkPasses(id,screen.checks?.[id])));}
export function fastScreenReady(candidate){return Boolean(!candidate.missingEvidence?.screen?.some(id=>FAST_SCREEN_CHECKS.includes(id))&&FAST_SCREEN_CHECKS.every(id=>checkPasses(id,candidate.screen?.checks?.[id])));}
// Old seven-check ids (before Oct 1) and where they live now. A primary id
// moves whole; a secondary id adds its note and can only fail the new check;
// a note-only id (the old buyer moment) never changes the new check's status.
export const LEGACY_SCREEN_CHECKS={identity:'productWorks',exclusions:'noBrand',honestCreative:'productWorks',operationalRisk:'noBrand',buyerMoment:'audienceRoom'};
const LEGACY_PRIMARY=new Set(['identity','exclusions']);
const LEGACY_NOTE_ONLY=new Set(['buyerMoment']);
const LEGACY_PREFIX={honestCreative:'Image: ',operationalRisk:'Flags: ',buyerMoment:'Earlier buyer moment: '};
/** Maps old screen ids to F1-F5; the owner's decision and reason are untouched. */
export function migrateScreen(screen){
 if(!screen||typeof screen!=='object'||!screen.checks||typeof screen.checks!=='object'||Array.isArray(screen.checks))return screen;
 const legacy=Object.keys(screen.checks).filter(id=>Object.hasOwn(LEGACY_SCREEN_CHECKS,id));
 // Checks added later (metaGap and bigIssue, Oct 2) start as pending on a saved card; nothing is passed for it.
 if(!legacy.length)return SCREEN_CHECKS.every(id=>Object.hasOwn(screen.checks,id))?screen:{...screen,checks:{...Object.fromEntries(SCREEN_CHECKS.map(id=>[id,screen.checks[id]||blankCheck()])),...screen.checks}};
 const checks={};for(const [id,check] of Object.entries(screen.checks))if(!Object.hasOwn(LEGACY_SCREEN_CHECKS,id))checks[id]=check;
 const order=['identity','exclusions','honestCreative','operationalRisk','buyerMoment'].filter(id=>legacy.includes(id));
 for(const old of order){
  const from=screen.checks[old],target=LEGACY_SCREEN_CHECKS[old];if(!from||typeof from!=='object')continue;
  const current=checks[target]||blankCheck();
  if(LEGACY_PRIMARY.has(old)&&current.status==='pending'&&!current.note&&!current.source){checks[target]={...blankCheck(),...from};continue;}
  const note=[current.note,from.note?`${LEGACY_PREFIX[old]||''}${from.note}`:''].filter(Boolean).join(' · ').slice(0,3000);
  const merged={...current,note};
  if(!LEGACY_NOTE_ONLY.has(old)&&from.status==='failed'&&current.status!=='failed'){Object.assign(merged,current.status==='pending'?{...from,note}:{},{status:'failed'});}
  checks[target]=merged;
 }
 const ordered=Object.fromEntries(SCREEN_CHECKS.map(id=>[id,checks[id]||blankCheck()]));
 for(const [id,check] of Object.entries(checks))if(!Object.hasOwn(ordered,id))ordered[id]=check;
 return {...screen,checks:ordered};
}
export function migrateResearch(value){if(!value||!Array.isArray(value.candidates))return value;return {...value,candidates:value.candidates.map(c=>c&&c.screen?{...c,screen:migrateScreen(c.screen)}:c)};}
function verificationScope(candidate){
 const source=candidate.screen?.checks?.sourceMatch,contribution=candidate.screen?.checks?.contribution,identity=cardIdentity(candidate);
 return JSON.stringify({country:countryKey(candidate.country),buyer:candidate.buyer,identity,sourceListing:source?.listingUrl||'',sourceVariant:source?.variant||'',sourceQuantity:source?.quantity??null,sourceDestination:countryKey(source?.destination),costs:contribution?.costs||null});
}
// What an opened gate's evidence is about: changing it after P1 is recorded reopens the gates first.
function openScope(candidate){return JSON.stringify({country:countryKey(candidate.country),buyer:candidate.buyer,identity:cardIdentity(candidate)});}
const resolvedGate=gate=>['supported','failed'].includes(gate?.status);
function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value&&value<=new Date().toISOString().slice(0,10);}
export const emptyResearch=()=>({revision:0,minimumReviews:5,targetReviews:10,candidates:[],selectedId:null,selectionReason:''});
export function reviewComplete(candidate){return Boolean(screenReady(candidate)&&!candidate.missingEvidence?.gates?.length&&candidate.country&&candidate.buyer&&RESEARCH_GATES.every(id=>['supported','failed'].includes(candidate.gates[id]?.status)));}
export function researchSummary(batch){const reviewed=batch.candidates.filter(reviewComplete),eligible=reviewed.filter(c=>RESEARCH_GATES.every(id=>c.gates[id].status==='supported'));return {screened:batch.candidates.length,fastScreened:batch.candidates.filter(fastScreenReady).length,readyForVerification:batch.candidates.filter(screenReady).length,reviewed:reviewed.length,eligible:eligible.length,remaining:Math.max(0,batch.minimumReviews-reviewed.length),canCompare:reviewed.length>=batch.minimumReviews};}
export function validateResearch(value){
 object(value,'Research comparison');
 if(!Number.isInteger(value.revision)||value.revision<0||value.minimumReviews!==5||value.targetReviews!==10||!Array.isArray(value.candidates)||value.candidates.length>2500)fail('Research comparison requires five complete reviews, target ten, and at most 2500 candidates.');
 const ids=new Set();
 for(const c of value.candidates){
  object(c);if(!/^L\d{3,}$/.test(c.id)||ids.has(c.id))fail('Use unique candidate IDs such as L011.');ids.add(c.id);
  text(c.name,'Candidate name',{required:true,max:500});text(c.country,'Country',{max:100});text(c.buyer,'Buyer situation',{max:2000});text(c.decision,'Decision',{required:true,max:2000});text(c.nextAction,'Next action',{max:2000});
  if(c.screen!==undefined){
   object(c.screen,'Pre-verification screen');if(!['unreviewed','saved','passed','rejected'].includes(c.screen.ownerDecision))fail('Owner decision must be unreviewed, saved, passed or rejected.');text(c.screen.ownerReason,'Owner reason',{max:OWNER_NOTE_MAX});
   // One tap decides (owner, Oct 3): the reason is optional; 0-2 quick-reason chips and decidedAt (stamped by the server) may ride along.
   {const problem=reasonTagsProblem(c.screen.reasonTags);if(problem)fail(problem,'REASON_TAGS');}
   if(c.screen.decidedAt!==undefined&&(typeof c.screen.decidedAt!=='string'||!Number.isFinite(Date.parse(c.screen.decidedAt))))fail('decidedAt is a date and time.');
   // A decision the owner said in chat (Oct 3), recorded by the manager with the owner's words (os.mjs owner-said).
   {const problem=saidProblem(c.screen.said);if(problem)fail(problem,'OWNER_SAID');if(c.screen.said&&String(c.screen.ownerReason||'').trim()!==c.screen.said.quote)fail('A decision said in chat keeps the owner\u2019s words as its reason.','OWNER_SAID');}
   // The owner's Reopen (Oct 3, CHECKS.md rule 3): which exact failures the owner sent back to the line.
   if(c.screen.reopened!==undefined){if(!Array.isArray(c.screen.reopened)||c.screen.reopened.length>20)fail('Reopened lists at most 20 checks.','REOPENED');for(const r of c.screen.reopened){object(r,'Reopened check');if(Object.keys(r).some(key=>!['id','observedAt','note','at'].includes(key)))fail('A reopened check keeps only its id, date, note and when.','REOPENED');if(!SCREEN_CHECKS.includes(r.id)&&!RESEARCH_GATES.includes(r.id))fail('A reopened check names one of the card’s checks.','REOPENED');if(typeof r.observedAt!=='string'||r.observedAt.length>40||typeof r.note!=='string'||r.note.length>200)fail('A reopened check keeps its date and the start of its note.','REOPENED');if(r.at!==undefined&&(typeof r.at!=='string'||!Number.isFinite(Date.parse(r.at))))fail('Reopened at is a date and time.','REOPENED');}}
   object(c.screen.checks,'Screen checks');if(Object.keys(c.screen.checks).some(id=>!SCREEN_CHECKS.includes(id)))fail('Unknown pre-verification check.');
   for(const id of SCREEN_CHECKS){const check=c.screen.checks[id];if(id==='buyers'&&check===undefined)continue;object(check,`Screen check ${id}`);if(!['pending','supported','failed'].includes(check.status))fail('Screen check status must be pending, supported or failed.');text(check.note,'Screen note',{max:3000});text(check.country,'Screen country',{max:100});if(check.source)evidenceSource(check.source);
    if(check.status!=='pending'){for(const field of ['note','source','observedAt','country','evidenceType'])text(check[field],field,{required:true,max:3000});if(!c.country||countryKey(check.country)!==countryKey(c.country))fail('Resolved screen evidence must match the candidate selling country.');if(!validDate(check.observedAt))fail('Use a real non-future screen observation date.');if(!['observed','third-party estimate','supplier assertion','inference','hypothesis','our result'].includes(check.evidenceType))fail('Use a known screen evidence type.');}
    if(id==='productWorks'&&check.status==='supported'&&!/^https?:\/\//i.test(check.source))fail('"Product does the work" needs the exact observed listing URL as its source.');
    if(id==='provenDemand'){
     for(const field of DEMAND_COUNTS)if(check[field]!==undefined&&(!Number.isInteger(check[field])||check[field]<0||check[field]>100000000))fail(`Proven demand ${field} must be a whole number.`);
     if(check.line!==undefined&&!DEMAND_LINES.includes(check.line))fail(`Proven demand line must be ${DEMAND_LINES.join(', ')}.`);
     if(check.window!==undefined)text(check.window,'Proven demand window',{max:200});
     if(check.demand!==undefined){if(!Array.isArray(check.demand)||check.demand.length>60)fail('Statistics: list at most 60 demand points.');for(const p of check.demand){object(p,'Demand point');if(!Object.hasOwn(DEMAND_METRICS,p.metric))fail(`Statistics: a demand point's metric must be one of ${Object.keys(DEMAND_METRICS).join(', ')}.`);if(typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<0||p.value>1e10)fail('Statistics: a demand point needs a number value.');if(!/^https?:\/\//i.test(p.url||''))fail('Statistics: every demand point needs its link.');evidenceSource(p.url);if(!validDate(p.observedAt))fail('Statistics: every demand point needs a real, non-future date.');if(p.note!==undefined)text(p.note,'Demand point note',{max:300});}}
     if(check.trend!==undefined){if(!Array.isArray(check.trend)||check.trend.length>60)fail('Statistics: list at most 60 trend points.');for(const p of check.trend){object(p,'Trend point');if(typeof p.date!=='string'||!/^\d{4}-\d{2}(-\d{2})?$/.test(p.date))fail('Statistics: a trend point needs its date (YYYY-MM or YYYY-MM-DD).');if(typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<0||p.value>1e10)fail('Statistics: a trend point needs a number value.');}}
     if(check.trendUrl!==undefined&&check.trendUrl!==''){if(!/^https?:\/\//i.test(check.trendUrl))fail('Statistics: the trend curve needs its link.');evidenceSource(check.trendUrl);}
     // Optional for the Statistics panel (Oct 2): the saved Google Trends screenshot and a price beside the leading number.
     if(check.trendShot!==undefined&&check.trendShot!==''){if(typeof check.trendShot!=='string'||!/\.(png|jpe?g|webp|gif|avif)$/i.test(check.trendShot)||/^https?:/i.test(check.trendShot))fail('Statistics: trendShot is the saved screenshot\'s workspace path, such as resources/research-previews/<batch>/trends-x.jpg.');evidenceSource(check.trendShot);}
     if(Array.isArray(check.demand))for(const p of check.demand)if(p.price!==undefined&&(typeof p.price!=='number'||!Number.isFinite(p.price)||p.price<0||p.price>100000))fail('Statistics: a demand point\'s price is a number in dollars.');
     if(check.status==='supported'&&!provenDemandMet(check))fail(step2RuleApplies(check)?`"Statistics" passes only with a source link and date and ${STATS_RULE} (workflow/CHECKS.md, Step 1, F1).`:`"Proven demand" passes only with a source link and date and ${DEMAND_RULE} (Meta Ad Library; workflow/CHECKS.md F1).`);
    }
    if(id==='audienceRoom'){
     if(check.mainAudience!==undefined)text(check.mainAudience,'Main audience',{max:300});
     if(check.audiences!==undefined){if(!Array.isArray(check.audiences)||check.audiences.length>6)fail('List at most six other audiences.');for(const a of check.audiences){object(a,'Audience');for(const field of ['who','problem','why'])text(a[field],`Audience ${field}`,{max:300});if(a.angle!==undefined)text(a.angle,'Audience angle',{max:300});}}
     if(check.status==='supported'&&!audienceRoomMet(check))fail('"Several angles and avatars" passes only with the main audience and at least two other audiences or angles, each with who, their problem and why (workflow/CHECKS.md, Step 1, F4).');
    }
    if(id==='dropshippable'){
     if(check.usShipping!==undefined&&typeof check.usShipping!=='boolean')fail('Dropshippable: usShipping is true or false.');
     // Optional for the Statistics panel (Oct 2): more supplier links, the rough money line and flags.
     if(check.suppliers!==undefined){if(!Array.isArray(check.suppliers)||check.suppliers.length>10)fail('Dropshippable: list at most 10 supplier links.');for(const url of check.suppliers){if(typeof url!=='string'||!/^https?:\/\//i.test(url))fail('Dropshippable: each supplier is a link.');evidenceSource(url);}}
     for(const field of ['landedCost','sellPrice'])if(check[field]!==undefined&&(typeof check[field]!=='number'||!Number.isFinite(check[field])||check[field]<0||check[field]>100000))fail(`Dropshippable: ${field} is a number in dollars.`);
     if(check.flags!==undefined){if(!Array.isArray(check.flags)||check.flags.length>8)fail('Dropshippable: list at most 8 flags.');for(const flag of check.flags)text(flag,'Dropshippable flag',{required:true,max:120});}
     if(check.status==='supported'&&!dropshippableMet(check))fail('"Dropshippable" passes only with the supplier listing link on CJdropshipping, or on Alibaba or AliExpress with US dropship shipping (usShipping: true) (workflow/CHECKS.md, Step 1, F2).');
    }
    if(id==='metaGap'){
     for(const field of ['advertisers','liveAds','longestActiveDays'])if(check[field]!==undefined&&(!Number.isInteger(check[field])||check[field]<0||check[field]>100000000))fail(`Meta gap ${field} must be a whole number.`);
     if(check.gap!==undefined)text(check.gap,'Meta gap',{max:1000});
     if(check.status==='supported'&&!metaGapMet(check))fail('"An angle gap" passes only with a link to the competitors checked and the angles or avatars they don\'t speak to (workflow/CHECKS.md, Step 1, F6).');
    }
    if(id==='bigIssue'){
     if(check.issue!==undefined&&(typeof check.issue!=='string'||(check.issue&&!ISSUE_SLUG_RULE.test(check.issue))))fail('"Ties to our issues" names each issue by its folder in resources/issues/, such as sleep.');
     if(check.issues!==undefined&&(!Array.isArray(check.issues)||check.issues.length>10||check.issues.some(slug=>typeof slug!=='string'||!ISSUE_SLUG_RULE.test(slug))))fail('"Ties to our issues" lists at most 10 issue folder names, such as sleep.');
     if(check.ladder!==undefined){object(check.ladder,'Benefit ladder');for(const rung of Object.keys(check.ladder))if(!['functional','emotional','life'].includes(rung))fail('The benefit ladder has three rungs: functional, emotional and life.');for(const rung of ['functional','emotional','life'])if(check.ladder[rung]!==undefined)text(check.ladder[rung],`Benefit ladder ${rung}`,{max:300});}
     if(check.status==='supported'&&!bigIssueMet(check))fail('"Ties to our issues" passes only with a benefit ladder (functional, emotional, life) and one or more of our issue files (workflow/CHECKS.md, Step 1, F5).');
    }
    if(id==='buyers'){
     // Step 2 · Buyers (Oct 2): this product's buyers; the write-up is the source.
     if(check.quotes!==undefined&&(!Number.isInteger(check.quotes)||check.quotes<0||check.quotes>100000))fail('Buyers: quotes is how many verified quotes, a whole number.');
     if(check.avatars!==undefined){if(!Array.isArray(check.avatars)||check.avatars.length>8)fail('Buyers: list at most 8 avatars.');for(const a of check.avatars){object(a,'Buyer avatar');for(const field of ['who','trigger'])text(a[field],`Buyer avatar ${field}`,{max:300});for(const field of ['words','want','failed'])if(a[field]!==undefined)text(a[field],`Buyer avatar ${field}`,{max:600});}}
     if(check.angleGap!==undefined)text(check.angleGap,'Buyers angle gap',{max:1000});
     if(check.status==='supported'&&!buyersMet(check))fail(`"Buyers" passes only with ${BUYERS_RULE} (workflow/CHECKS.md, Step 2, A1-A3).`);
    }
    if(id==='looksWorth'&&check.status==='supported'&&step2RuleApplies(check)&&!/^https?:\/\//i.test(check.source))fail('"A good product" is judged on the real photos: its source is the exact listing URL (workflow/CHECKS.md, Step 1, F3).');
    if(['sourceMatch','contribution'].includes(id)&&check.status==='supported'&&['hypothesis','inference'].includes(check.evidenceType))fail('Source and contribution preflight need observed, estimated or supplier evidence, not a hypothesis.');
    if(id==='sourceMatch'&&check.status==='supported'){
     text(check.variant,'Exact source variant',{required:true,max:500});text(check.destination,'Source destination',{required:true,max:100});if(!/^https?:\/\//i.test(check.listingUrl||''))fail('Source preflight requires the exact supplier listing URL.');evidenceSource(check.listingUrl);if(countryKey(check.destination)!==countryKey(c.country))fail('Exact source destination must match the candidate country.');if(!Number.isInteger(check.quantity)||check.quantity!==1)fail('Source preflight requires a matching quantity-one offer.');
    }
    if(id==='contribution'&&check.status==='supported'){
     object(check.costs,'Contribution costs');text(check.costs.currency,'Currency',{required:true,max:10});const fields=['sellPrice','itemCost','shippingCost','fees','returnReserve','acquisitionAllowance'];
     for(const field of fields)if(typeof check.costs[field]!=='number'||!Number.isFinite(check.costs[field])||check.costs[field]<0)fail(`Contribution requires a nonnegative ${field} estimate.`);
     if(check.costs.acquisitionAllowance===0)fail('Paid Meta preflight requires a positive acquisition allowance.');
     if(check.costs.sellPrice===0||check.costs.sellPrice-fields.slice(1).reduce((sum,field)=>sum+check.costs[field],0)<=0)fail('Supported contribution requires positive headroom after all stated costs and acquisition allowance.');
    }
   }
  }
  if(!Array.isArray(c.references)||c.references.length>30)fail('Use at most 30 candidate references.');c.references.forEach(evidenceSource);object(c.gates,'Research gates');
  for(const key of Object.keys(c.gates))if(!RESEARCH_GATES.includes(key))fail('Unknown research gate.');
  for(const id of RESEARCH_GATES){const gate=c.gates[id];object(gate);if(!['pending','supported','failed'].includes(gate.status))fail('Research gate status must be pending, supported or failed.');text(gate.note,'Gate note',{max:3000});if(gate.source)evidenceSource(gate.source);
   if(gate.status!=='pending'){
    for(const field of ['note','source','observedAt','window'])text(gate[field],field,{required:true,max:3000});
    if(!validDate(gate.observedAt))fail('Use a real non-future observation date.');
   }
  }
 }
 if(value.selectedId){const c=value.candidates.find(c=>c.id===value.selectedId);if(!c||!researchSummary(value).canCompare||!reviewComplete(c)||RESEARCH_GATES.some(id=>c.gates[id].status!=='supported'))fail('Selection requires five complete comparisons and a candidate supported on every research gate.');text(value.selectionReason,'Owner selection and comparison rationale',{required:true,max:3000});}
 return value;
}
// `agent`: the write came from an agent (the helper's local-agent header). Only the owner's screen records the eye test.
export function updateResearch(current,input,{agent=false,at=new Date(),ownerSaid=false}={}){
 object(input);assertRevision(current.revision,input.revision);const next=structuredClone(current);
 if(input.candidate){const candidate=structuredClone(input.candidate);delete candidate.missingEvidence;if(candidate.screen)candidate.screen=migrateScreen(candidate.screen);const index=next.candidates.findIndex(c=>c.id===candidate.id);const previous=index<0?null:next.candidates[index];
  if(agent&&candidate.screen&&previous?.screen&&candidate.screen.ownerDecision===previous.screen.ownerDecision){for(const field of ['ownerReason','reasonTags','decidedAt'])if(candidate.screen[field]===undefined&&previous.screen[field]!==undefined)candidate.screen[field]=structuredClone(previous.screen[field]);}
  // A chat decision is recorded only through os.mjs owner-said (ownerSaid), with the owner's words; agents keep it as saved.
  if(agent&&candidate.screen&&previous?.screen&&candidate.screen.said===undefined&&previous.screen.said!==undefined)candidate.screen.said=structuredClone(previous.screen.said);
  const saidChanged=JSON.stringify(candidate.screen?.said??null)!==JSON.stringify(previous?.screen?.said??null);
  if(agent&&saidChanged)fail('Only the owner decides. The manager records a decision the owner said in chat with os.mjs owner-said and the owner\u2019s words.','OWNER_DECISION_ONLY',403);
  if(!ownerSaid&&saidChanged&&candidate.screen?.said)fail('A decision said in chat is recorded only with os.mjs owner-said and the owner\u2019s words.','OWNER_SAID_ONLY',403);
  if(ownerSaid&&(!candidate.screen?.said||!saidChanged))fail('A chat decision needs the owner\u2019s words (--quote).','QUOTE_REQUIRED',400);
  if(ownerSaid&&sameDecision(candidate.screen,previous?.screen))fail(`${candidate.id} is already ${decisionOf(previous?.screen).ownerDecision}. Nothing to record.`,'SAME_DECISION',409);
  // The owner's own tap replaces a decision said in chat.
  if(!ownerSaid&&!agent&&candidate.screen?.said&&!sameDecision(candidate.screen,previous?.screen))delete candidate.screen.said;
  // Reopen is the owner's too: an agent's write keeps the saved list and may not change it.
  if(agent&&candidate.screen&&previous?.screen&&candidate.screen.reopened===undefined&&previous.screen.reopened!==undefined)candidate.screen.reopened=structuredClone(previous.screen.reopened);
  if(agent&&JSON.stringify(candidate.screen?.reopened||[])!==JSON.stringify(previous?.screen?.reopened||[]))fail('Only the owner reopens a failed product, on its page.','OWNER_DECISION_ONLY',403);
  if(!sameDecision(candidate.screen,previous?.screen)){
   if(agent)fail('Only the owner records the eye test (Save, Pass or Reject), on the Find page or the product page.','OWNER_DECISION_ONLY',403);
   if(candidate.screen){if(decisionOf(candidate.screen).ownerDecision==='unreviewed')delete candidate.screen.decidedAt;else candidate.screen.decidedAt=new Date(at).toISOString();}
  }else if(candidate.screen&&previous?.screen){if(previous.screen.decidedAt)candidate.screen.decidedAt=previous.screen.decidedAt;else delete candidate.screen.decidedAt;}
  if(previous&&RESEARCH_GATES.some(id=>['supported','failed'].includes(candidate.gates?.[id]?.status))){
   // A gate resolved before it could be recorded (legacy) never becomes current by opening it later.
   if(RESEARCH_GATES.some(id=>resolvedGate(previous.gates?.[id])&&!gateOpen(previous,id)&&gateOpen(candidate,id)))fail('Reopen historical deep gates before activating this candidate’s Find checks and source-and-profit preflight.');
   if(screenReady(previous)&&verificationScope(previous)!==verificationScope(candidate))fail('Reopen resolved deep gates before changing the candidate country, buyer situation, exact item, supplier route or offer costs.');
   if(!screenReady(previous)&&RESEARCH_GATES.some(id=>resolvedGate(previous.gates?.[id])&&gateOpen(previous,id))&&openScope(previous)!==openScope(candidate))fail('Reopen resolved deep gates before changing the candidate country, buyer situation, exact item, supplier route or offer costs.');
  }
  // Order (workflow/CHECKS.md Step 3, Oct 3): P1 after the owner’s Save and Buyers; P2 sourcing also after sourceMatch; the rest after the full preflight.
  const changedGates=RESEARCH_GATES.filter(id=>candidate.gates?.[id]?.status!=='pending'&&JSON.stringify(candidate.gates?.[id])!==JSON.stringify(previous?.gates?.[id])&&!gateOpen(candidate,id));
  if(changedGates.length){const id=changedGates[0];fail(P1_GATE_IDS.includes(id)?'P1 (an opening: demand, competition) is recorded after the owner’s Save and a passed Buyers check (A1-A3).':id==='sourcing'?'P2 sourcing is recorded after the owner’s Save, a passed Buyers check and the exact source (sourceMatch).':'Complete the fast screen, owner Save, exact-source and contribution preflight before recording deep verification gates.');}
  // The owner's rule (Oct 2): without statistics a card "can't go to the 2nd stage". A new Save needs F1 passed; Pass and Reject always work, and earlier Saves stay.
  if(candidate.screen?.ownerDecision==='saved'&&previous?.screen?.ownerDecision!=='saved'&&!checkPasses('provenDemand',candidate.screen?.checks?.provenDemand))fail('Save opens when F1 Statistics passes: real numbers with links and dates at 2+ points in time, rising or stable. Pass and Reject still work.','STATS_MISSING',409);
  if(index<0)next.candidates.push(candidate);else next.candidates[index]=candidate;}
 if(input.selectedId!==undefined){next.selectedId=input.selectedId;next.selectionReason=input.selectionReason||'';}
 next.revision++;return validateResearch(next);
}
