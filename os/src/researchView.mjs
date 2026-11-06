export const RESEARCH_GATE_IDS=['demand','community','competition','sourcing','fit'];
// Step 1 · Product (owner, Oct 2): product first, from sales numbers. Six checks
// with linked, dated evidence the owner can check, in this order, before the
// eye test (workflow/CHECKS.md F1-F6):
//   provenDemand  F1 Statistics: rising or stable demand, shown by 2+ dated points
//   dropshippable F2 Dropshippable: the item (or a close unbranded version) on CJ, or on Alibaba/AliExpress with US dropship shipping
//   looksWorth    F3 A good product in its real photos (not cheap, not a big-box commodity)
//   audienceRoom  F4 Several angles and avatars: 3+ to target
//   bigIssue      F5 Ties to our issues: a benefit ladder (functional, emotional, life) to one or more issue files
//   metaGap       F6 An angle gap: angles and avatars competitors on any channel don't speak to (the id is kept from the Meta gap)
// "Product does the work" and "No brand" (the Oct 1 checks) stay on saved cards
// as earlier checks; brands and hard limits are dropped before a card exists.
// Then the source-and-profit preflight after the owner's Save. server/research.mjs
// imports these rules, so the server and the screens cannot disagree.
export const FIND_CHECK_IDS=['provenDemand','dropshippable','looksWorth','audienceRoom','bigIssue','metaGap'];
export const PREFLIGHT_CHECK_IDS=['sourceMatch','contribution'];
export const EARLIER_CHECK_IDS=['productWorks','noBrand'];
// Step 2 · Buyers (owner, Oct 2: product first, then its buyers): after the
// owner's Save, the buyer researcher reads THIS product's buyers (TikTok
// comments, 2-4 star reviews, forums) and saves one `buyers` check on the card:
// quotes (how many verified quotes), avatars [{who, trigger}], angleGap, with
// the write-up as its source. Gate A1-A3: 15+ quotes, 2+ avatars, an angle gap.
export const BUYERS_CHECK_IDS=['buyers'];
export const READY_CHECK_IDS=[...FIND_CHECK_IDS,...PREFLIGHT_CHECK_IDS];
export const UPFRONT_CHECK_IDS=[...FIND_CHECK_IDS,...PREFLIGHT_CHECK_IDS,...BUYERS_CHECK_IDS];
export const SCREEN_CHECK_IDS=[...READY_CHECK_IDS,...EARLIER_CHECK_IDS,...BUYERS_CHECK_IDS];
export const BUYERS_QUOTES_MINIMUM=15;
export const BUYERS_AVATARS_MINIMUM=2;
/** The day the five checks took effect; evidence observed earlier keeps the rule it was recorded under when it is validated. */
export const STEP2_RULE_FROM='2026-10-02';
/** The day the strict Early-Breakout Wave & Upfront Product Verification rule took effect (Nov 3, 2026). */
export const EARLY_WAVE_RULE_FROM='2026-11-03';
/** The day the Exact-Link / Zero-Search-URL rule took effect (Nov 5, 2026): no ?keyword=, ?SearchText= or /trade/search links on sourcing or Kalodata. */
export const EXACT_LINK_RULE_FROM='2026-11-05';
export const EARLY_WAVE_MIN_UNITS=100;
export const EARLY_WAVE_MAX_UNITS=2500;
// The Oct 1 demand rule (Meta Ad Library numbers, or Kalodata), kept to validate evidence saved before Oct 2.
export const PROVEN_DEMAND_MINIMUM={advertisers:2,longestActiveDays:30,liveAds:3};
export const KALODATA_MINIMUM={units:1000,creators:3,lines:['steady','rising']};
export const DEMAND_RULE='2+ different advertisers, one ad still active after 30+ days (stable or rising), 3+ live ads';
export const DEMAND_COUNTS=['advertisers','longestActiveDays','liveAds','units','creators'];
export const DEMAND_LINES=['rising','steady','falling','unclear'];
/** F0: a supplier listing that can dropship to the US (CJdropshipping, HyperSKU, Alibaba, AliExpress or 1688 with US dropship shipping). */
export const DROPSHIP_HOSTS=/(^|\.)(cjdropshipping\.com|hypersku\.com|alibaba\.com|aliexpress\.(com|us)|1688\.com)$/i;
const hostOf=value=>{try{return new URL(value).hostname;}catch{return '';}};
export const isSearchUrl=value=>{try{const u=new URL(value);if(/\/(trade\/search|search|s)\b/i.test(u.pathname))return true;for(const k of ['q','k','keyword','SearchText','searchText','keywords'])if(u.searchParams.get(k))return true;return false;}catch{return false;}};
export const exactLinkRuleApplies=k=>typeof k?.observedAt==='string'&&k.observedAt>=EXACT_LINK_RULE_FROM;
export const dropshippableMet=k=>Boolean(k&&isLink(k.source)&&DROPSHIP_HOSTS.test(hostOf(k.source))&&(!exactLinkRuleApplies(k)||!isSearchUrl(k.source))&&(/(^|\.)(cjdropshipping|hypersku)\.com$/i.test(hostOf(k.source))||k.usShipping===true));
/** F1's statistics: where a number comes from (Amazon and Google Trends first; Kalodata and TikTok Shop cross-check). */
export const DEMAND_METRICS={'amazon-bought':'Amazon bought in past month','amazon-reviews':'Amazon reviews','google-trends':'Google Trends','kalodata-units':'Kalodata units','tiktok-shop-units':'TikTok Shop units',other:'Other'};
/** Two dated points at least, so the trend is shown, not claimed (owner). */
export const STATS_MIN_POINTS=2;
/** Rising when the newest point is this much above the oldest, falling when this much below, else stable (Launchroom's rule; also in os/data/rules.json). */
export const TREND_BAND_PERCENT=15;
/** F3: at least this many avatars or angles to target (owner): the main audience plus two others. */
export const AUDIENCE_MINIMUM=2;
export const AVATARS_MINIMUM=AUDIENCE_MINIMUM+1;
export const STATS_RULE='statistics with links: 2+ dated points of one number showing an early-breakout RISING uptrend wave (100–2,500 TikTok Shop/Kalodata units, <50% creator concentration, not a flat/steady post-peak commodity)';
const filled=value=>typeof value==='string'&&value.trim()!=='';
const isLink=value=>/^https?:\/\//i.test(String(value||''));
const isDay=value=>typeof value==='string'&&/^\d{4}-\d{2}(-\d{2})?$/.test(value);
const atLeast=(value,min)=>Number.isInteger(value)&&value>=min;
export const metaDemandMet=k=>Boolean(k&&Object.entries(PROVEN_DEMAND_MINIMUM).every(([field,min])=>atLeast(k[field],min)));
export const kalodataDemandMet=k=>Boolean(k&&atLeast(k.units,KALODATA_MINIMUM.units)&&atLeast(k.creators,KALODATA_MINIMUM.creators)&&KALODATA_MINIMUM.lines.includes(k.line)&&filled(k.window));
/** Whether a saved check was observed under the six Step 1 checks (Oct 2 on). */
export const step2RuleApplies=k=>typeof k?.observedAt==='string'&&k.observedAt>=STEP2_RULE_FROM;
/** Whether a saved check was observed under the strict Early-Breakout Wave & Upfront Verification rule (Nov 3 on). */
export const earlyWaveRuleApplies=k=>typeof k?.observedAt==='string'&&k.observedAt>=EARLY_WAVE_RULE_FROM;

/**
 * F1's trend from saved points only: the longest series (Google Trends curve, or
 * the dated points of one demand number), oldest against newest. "unknown"
 * with fewer than two dated points: a trend is shown, never claimed.
 */
export function statsTrend(k){
 const series=[];
 const curve=(Array.isArray(k?.trend)?k.trend:[]).filter(p=>p&&isDay(p.date)&&Number.isFinite(p.value)).sort((a,b)=>a.date.localeCompare(b.date));
 if(curve.length)series.push({metric:'google-trends',points:curve.map(p=>({date:p.date,value:p.value}))});
 const byMetric={};
 for(const p of Array.isArray(k?.demand)?k.demand:[])if(p&&isDay(p.observedAt)&&Number.isFinite(p.value)&&isLink(p.url))(byMetric[p.metric]||=[]).push({date:p.observedAt,value:p.value});
 for(const [metric,points] of Object.entries(byMetric))series.push({metric,points:[...new Map(points.sort((a,b)=>a.date.localeCompare(b.date)).map(p=>[p.date,p])).values()]});
 const best=series.filter(s=>s.points.length>=STATS_MIN_POINTS).sort((a,b)=>b.points.length-a.points.length)[0];
 if(!best)return {direction:'unknown',metric:'',points:Math.max(0,...series.map(s=>s.points.length)),from:'',to:'',changePercent:null};
 const first=best.points[0],last=best.points.at(-1);
 const change=first.value===0?(last.value>0?100:0):Math.round((last.value-first.value)/Math.abs(first.value)*100);
 const direction=change>=TREND_BAND_PERCENT?'rising':change<=-TREND_BAND_PERCENT?'falling':'stable';
 return {direction,metric:best.metric,points:best.points.length,from:first.date,to:last.date,changePercent:change};
}
/**
 * Strict Two-Track Demand Filter (Nov 3 on):
 *  - Option A (Early-Breakout "Sleeper Winner" Wave): strictly RISING velocity, 100–2,500 TikTok Shop/Kalodata units, <= 1,000 Amazon/mo, 0–10 Meta advertisers.
 *  - Option B (Crazy-Volume "Meta Blind-Spot" Arbitrage): massive proven volume (> 2,500 TikTok Shop units or > 1,000 Amazon/mo, rising or high-plateau stable) WITH 0–5 active Meta advertisers (untapped on Meta).
 *  - Both require observed marketplace price >= $24 and target retail >= $45 (no cheap trinkets).
 */
export const MIN_MARKET_PRICE=24;
export const MIN_SELL_PRICE=45;
export const META_BLINDSPOT_MAX_ADS=15;
export function earlyWaveMet(k){
 if(!k)return false;
 const dir=statsTrend(k).direction;
 if(!['rising','stable'].includes(dir))return false;
 const points=Array.isArray(k.demand)?k.demand:[];
 const tooCheap=points.some(p=>p&&Number.isFinite(p.price)&&p.price>0&&p.price<MIN_MARKET_PRICE);
 if(tooCheap)return false;
 const highVolume=(Number.isInteger(k.units)&&k.units>EARLY_WAVE_MAX_UNITS)||points.some(p=>p&&Number.isFinite(p.value)&&((['tiktok-shop-units','kalodata-units'].includes(p.metric)&&p.value>EARLY_WAVE_MAX_UNITS)||(p.metric==='amazon-bought'&&p.value>1000)));
 if(highVolume){
  // Option B: Crazy TikTok/Amazon numbers are allowed ONLY when Meta Ad Library has 0–5 active advertisers (untapped Meta blind spot).
  return Number.isInteger(k.advertisers)&&k.advertisers>=0&&k.advertisers<=META_BLINDSPOT_MAX_ADS;
 }
 // Option A: Early-Breakout Sleeper Wave must be strictly RISING and >= 100 units.
 if(dir!=='rising')return false;
 if(Number.isInteger(k.units)&&k.units<EARLY_WAVE_MIN_UNITS)return false;
 return true;
}
/** F1 passes with a linked, dated number and a trend shown by 2+ points: strictly rising + early-wave volume from Nov 3 on; rising or stable for Oct 2 – Nov 2 historical records. From Nov 5 on, also requires >= 3 real TikTok video links in rawVideos. */
export const hasVerifiedVideos=k=>!exactLinkRuleApplies(k)||(Array.isArray(k?.rawVideos)&&k.rawVideos.filter(v=>v&&isLink(v.url)&&/tiktok\.com\/@[^/]+\/video\/\d+/i.test(v.url)&&Number(v.gmv30d)>0).length>=3);
export const statsMet=k=>Boolean(k&&(Array.isArray(k.demand)?k.demand:[]).some(p=>p&&isLink(p.url)&&isDay(p.observedAt)&&Number.isFinite(p.value))&&(earlyWaveRuleApplies(k)?earlyWaveMet(k):['rising','stable'].includes(statsTrend(k).direction))&&hasVerifiedVideos(k));
/** The saved demand check is valid with the rule in force when it was observed: statistics from Oct 2, the Meta or Kalodata numbers before. */
export const provenDemandMet=k=>Boolean(k&&isLink(k.source)&&(!exactLinkRuleApplies(k)||(!isSearchUrl(k.source)&&/kalodata\.com\/product\/detail/i.test(k.source)))&&filled(k.observedAt)&&(step2RuleApplies(k)?statsMet(k):metaDemandMet(k)||kalodataDemandMet(k)));
export const sourceMatchMet=k=>Boolean(k&&(!exactLinkRuleApplies(k)||(isLink(k.listingUrl||k.source)&&!isSearchUrl(k.listingUrl||k.source))));
/** F3 audiences that count: each names who, their related problem and why it is worth forum research. */
export const namedAudiences=k=>Array.isArray(k?.audiences)?k.audiences.filter(a=>a&&filled(a.who)&&filled(a.problem)&&filled(a.why)):[];
/** F3 counts only with the main audience and at least two other named audiences or angles: three to target. */
export const audienceRoomMet=k=>Boolean(k&&filled(k.mainAudience)&&namedAudiences(k).length>=AUDIENCE_MINIMUM);
/** F6: competitors checked on any channel, with a link, and the angles or avatars they don't speak to. From Nov 5 on, also requires categoryCompetitors (what similar category products sell & how our mechanism wins). */
export const metaGapMet=k=>Boolean(k&&isLink(k.source)&&filled(k.gap)&&(!exactLinkRuleApplies(k)||(Array.isArray(k.categoryCompetitors)&&k.categoryCompetitors.length>=2)));
/**
 * F5: the benefit ladder ties the product to one or more of our issue files
 * (related, not necessarily exact; owner): functional (walk without knee pain),
 * emotional (confidence, not a burden to others) and life (can exercise).
 */
export const ISSUE_SLUG_RULE=/^[a-z0-9][a-z0-9-]{0,79}$/;
export const LADDER_RUNGS=['functional','emotional','life'];
export const cardIssues=k=>[...new Set([...(Array.isArray(k?.issues)?k.issues:[]),...(typeof k?.issue==='string'&&k.issue?[k.issue]:[])].filter(slug=>typeof slug==='string'&&ISSUE_SLUG_RULE.test(slug)))];
/** Step 2 · Buyers: the avatars with a trigger moment, the quote count and the angle gap, each a gate line (A1-A3). */
export const buyerAvatars=k=>Array.isArray(k?.avatars)?k.avatars.filter(a=>a&&filled(a.who)&&filled(a.trigger)):[];
export const buyersQuotesMet=k=>Boolean(k&&filled(k.source)&&Number.isInteger(k.quotes)&&k.quotes>=BUYERS_QUOTES_MINIMUM);
export const buyersAvatarsMet=k=>Boolean(k&&filled(k.source)&&buyerAvatars(k).length>=BUYERS_AVATARS_MINIMUM);
export const buyersGapMet=k=>Boolean(k&&filled(k.source)&&filled(k.angleGap));
export const buyersMet=k=>buyersQuotesMet(k)&&buyersAvatarsMet(k)&&buyersGapMet(k);
export const BUYERS_RULE=`${BUYERS_QUOTES_MINIMUM}+ verified quotes tied to this product or its category, ${BUYERS_AVATARS_MINIMUM}+ avatars each with a trigger moment, and the angle nobody uses, with the write-up as the source`;
export const bigIssueMet=k=>Boolean(k&&cardIssues(k).length>=1&&LADDER_RUNGS.every(rung=>filled(k.ladder?.[rung])));
/**
 * The card's statistics in one shape (for the product card's statistics panel):
 * demand[] dated numbers with links, trend[] the curve points, the trend worked
 * out from them, competition{} from Meta Ad Library with its gap, avatars[] and
 * the issue. Read from the saved checks only; nothing here is a pass.
 */
export function cardStats(candidate){
 const checks=candidate?.screen?.checks||{},d=checks.provenDemand||{},room=checks.audienceRoom||{},gap=checks.metaGap||{},issue=checks.bigIssue||{};
 return {
  demand:(Array.isArray(d.demand)?d.demand:[]).map(p=>({metric:p.metric,label:DEMAND_METRICS[p.metric]||p.metric,value:p.value,url:p.url,observedAt:p.observedAt,note:p.note||'',price:Number.isFinite(p.price)?p.price:null})),
  trend:(Array.isArray(d.trend)?d.trend:[]).map(p=>({date:p.date,value:p.value})),trendUrl:d.trendUrl||'',
  direction:statsTrend(d),
  competition:{advertisers:gap.advertisers??d.advertisers??null,liveAds:gap.liveAds??d.liveAds??null,longestActiveDays:gap.longestActiveDays??d.longestActiveDays??null,url:gap.source||'',observedAt:gap.observedAt||'',gap:gap.gap||''},
  ladder:{functional:issue.ladder?.functional||'',emotional:issue.ladder?.emotional||'',life:issue.ladder?.life||''},
  avatars:[...(filled(room.mainAudience)?[{who:room.mainAudience,problem:'',why:'The audience it is sold to now',main:true}]:[]),...namedAudiences(room).map(a=>({who:a.who,problem:a.problem,why:a.why,angle:a.angle||'',main:false}))],
  issues:cardIssues(issue),
 };
}
/** The exact listing a card is about: F2's source (Oct 2 on), or the Oct 1 "Product does the work" source. */
export const cardIdentity=candidate=>{const checks=candidate?.screen?.checks||{};return [checks.productWorks?.source,checks.looksWorth?.source].find(isLink)||'';};
/** Plain names (workflow/CHECKS.md) and the short words the narrow Find cards use. */
export const CHECK_LABELS={dropshippable:'Dropshippable',provenDemand:'Statistics: rising or stable demand',looksWorth:'A good product',audienceRoom:'Several angles and avatars',metaGap:'An angle gap',bigIssue:'Ties to our issues',productWorks:'Product does the work (Oct 1)',noBrand:'No brand, flags noted (Oct 1)',sourceMatch:'Same item from a supplier',contribution:'Profit per order',buyers:'Buyers: quotes, avatars and the angle gap'};
export const CHECK_SHORT={dropshippable:'Dropship',provenDemand:'Early wave',looksWorth:'Good product',audienceRoom:'3+ avatars',metaGap:'Angle gap',bigIssue:'Our issues',productWorks:'Does the work',noBrand:'No brand',sourceMatch:'Exact factory',contribution:'3x+ margin',buyers:'Buyers (15+)'};
export const CHECKS_DOC='workflow/CHECKS.md';
const PASS_RULES={dropshippable:'the exact item or a close unbranded version on CJdropshipping, or on Alibaba or AliExpress with US dropship shipping (usShipping), with its link',provenDemand:STATS_RULE,audienceRoom:'the main audience plus 2+ other avatars or angles, each with who, their problem and why',metaGap:'a link to the competitors checked (Amazon listings, TikTok, store pages; Meta Ad Library optional) and the angles or avatars they don\'t speak to',bigIssue:'a benefit ladder (functional, emotional, life) to one or more of our issue files',buyers:BUYERS_RULE};
/** A check as the owner sees it, from the saved record only: pass, fail or unknown, with its one-line reason. */
export function checkView(id,k){
 const state=checkPasses(id,k)?'pass':k?.status==='failed'?'fail':'unknown';
 const note=typeof k?.note==='string'?k.note.replace(/\s+/g,' ').trim():'';
 const missing=k?.status==='supported'&&state==='unknown'?`Marked as a pass, but it needs ${PASS_RULES[id]||'its evidence'}.`:'';
 return {id,state,label:CHECK_LABELS[id]||id,short:CHECK_SHORT[id]||CHECK_LABELS[id]||id,reason:missing||note||(state==='unknown'?'Not checked yet.':''),rule:PASS_RULES[id]?`Passes with ${PASS_RULES[id]}.`:'',observedAt:k?.observedAt||'',source:k?.source||''};
}
const plural=(n,word)=>`${n.toLocaleString('en-US')} ${word}${n===1?'':'s'}`;
/** F1's statistics in plain words: "Amazon bought in past month 600 → 900 (Aug 1 to Oct 2) · rising"; '' when none are saved. Older Meta numbers follow. */
export function demandNumbers(k){
 if(!k)return '';const parts=[];
 const trend=statsTrend(k);
 const latest=(Array.isArray(k.demand)?k.demand:[]).filter(p=>p&&Number.isFinite(p.value)).sort((a,b)=>String(b.observedAt).localeCompare(String(a.observedAt)))[0];
 if(latest)parts.push(`${DEMAND_METRICS[latest.metric]||latest.metric} ${latest.value.toLocaleString('en-US')}`);
 if(trend.direction!=='unknown')parts.push(`${trend.direction} over ${trend.points} points`);
 const meta=[];
 if(Number.isInteger(k.advertisers))meta.push(plural(k.advertisers,'advertiser'));
 if(Number.isInteger(k.longestActiveDays))meta.push(`oldest ${plural(k.longestActiveDays,'day')}`);
 if(Number.isInteger(k.liveAds))meta.push(plural(k.liveAds,'live ad'));
 if(meta.length)parts.push(meta.join(' · '));
 const extra=[];
 if(Number.isInteger(k.units))extra.push(`${k.units.toLocaleString('en-US')} units`);
 if(Number.isInteger(k.creators))extra.push(plural(k.creators,'creator'));
 if(DEMAND_LINES.includes(k.line))extra.push(k.line);
 if(extra.length)parts.push(`Kalodata: ${extra.join(', ')}`);
 return parts.join(' · ');
}
/**
 * Whether a saved check passes now. The six Step 1 checks are judged by the
 * Oct 2 rules (F1 needs its statistics): a card without them never reaches the
 * eye test, whatever passed on Oct 1 (owner). The earlier checks keep theirs.
 */
export const checkPasses=(id,k)=>Boolean(k?.status==='supported'&&(id==='dropshippable'?dropshippableMet(k):id==='provenDemand'?provenDemandMet(k):id==='sourceMatch'?sourceMatchMet(k):id==='audienceRoom'?audienceRoomMet(k):id==='metaGap'?metaGapMet(k):id==='bigIssue'?bigIssueMet(k):id==='buyers'?buyersMet(k):true));
export const screenReady=c=>Boolean(c&&!c.missingEvidence?.screen?.length&&READY_CHECK_IDS.every(id=>checkPasses(id,c.screen?.checks?.[id])));
export const fastScreenReady=c=>!c.missingEvidence?.screen?.some(id=>FIND_CHECK_IDS.includes(id))&&FIND_CHECK_IDS.every(id=>checkPasses(id,c.screen?.checks?.[id]));
export const hasSavedVideoAndSupplierImg=c=>!exactLinkRuleApplies(c?.screen?.checks?.provenDemand)||(Array.isArray(c?.references)&&c.references.some(r=>/\.mp4$/i.test(String(r||'')))&&c.references.some(r=>/resources\/sourcing\//i.test(String(r||''))));
/** Strict upfront verification (Nov 3 on): all 9 screen checks (F1-F6 + buyers + sourceMatch + contribution with sellPrice >= $45) AND all 5 deep gates must be supported upfront at Step 1 · Product before the owner's eye test. */
export const upfrontReady=c=>Boolean(c&&!c.missingEvidence?.screen?.some(id=>UPFRONT_CHECK_IDS.includes(id))&&UPFRONT_CHECK_IDS.every(id=>checkPasses(id,c.screen?.checks?.[id]))&&(c.screen?.checks?.contribution?.costs?.sellPrice??0)>=MIN_SELL_PRICE&&!c.missingEvidence?.gates?.length&&RESEARCH_GATE_IDS.every(id=>c.gates?.[id]?.status==='supported')&&hasSavedVideoAndSupplierImg(c));
/** A card reaches the eye test only when all upfront checks pass (from Nov 3 on: all 9 screen checks + 5 deep gates; historical cards: F1-F6). */
export const findReady=c=>Boolean(c)&&(earlyWaveRuleApplies(c.screen?.checks?.provenDemand)?upfrontReady(c):fastScreenReady(c));
export const P1_GATE_IDS=['demand','competition'];
export const gateOpen=(c,id)=>{
 if(!c)return false;if(screenReady(c))return true;
 const checks=c.screen?.checks,buyers=!c.missingEvidence?.screen?.includes('buyers')&&checkPasses('buyers',checks?.buyers);
 if(P1_GATE_IDS.includes(id))return Boolean(buyers);
 if(id==='sourcing')return Boolean(buyers&&!c.missingEvidence?.screen?.includes('sourceMatch')&&checkPasses('sourceMatch',checks?.sourceMatch));
 return false;
};
export const effectiveResearchGateStatus=(candidate,id)=>candidate.missingEvidence?.gates?.includes(id)?'unavailable':gateOpen(candidate,id)?candidate.gates?.[id]?.status||'pending':candidate.gates?.[id]?.status==='pending'?'pending':'historical';
export function comparisonSummary(batch){
 const complete=c=>Boolean(screenReady(c)&&!c.missingEvidence?.gates?.length&&c.country&&c.buyer&&RESEARCH_GATE_IDS.every(id=>{const g=c.gates?.[id];return g&&['supported','failed'].includes(g.status)&&g.note&&g.source&&g.observedAt&&g.window;}));
 const reviewed=batch.candidates.filter(complete),eligible=reviewed.filter(c=>RESEARCH_GATE_IDS.every(id=>c.gates[id].status==='supported'));
 return {screened:batch.candidates.length,fastScreened:batch.candidates.filter(fastScreenReady).length,readyForVerification:batch.candidates.filter(screenReady).length,reviewed:reviewed.length,eligible:eligible.length,remaining:Math.max(0,5-reviewed.length),canCompare:reviewed.length>=5};
}
export function researchDocument(batch){
 const s=comparisonSummary(batch),escape=v=>String(v).replaceAll('|','\\|').replaceAll('\n',' ');
 return `# Research comparison\n\nGenerated from research/comparison.json · revision ${batch.revision}. Update the canonical record through the research API or file workflow in os/AGENT-BRIDGE.md.\n\n${s.screened} candidates · ${s.fastScreened} fast-screened · ${s.readyForVerification} ready for detailed checks · ${s.reviewed}/5 complete reviews · target 10 viable candidates. ${batch.selectedId?'Selected '+batch.selectedId:'Final selection pending.'}\n\n| Candidate | Screen | Decision | Next action |\n| --- | --- | --- | --- |\n${batch.candidates.map(c=>`| ${c.id} · ${escape(c.name)} | ${screenReady(c)?'Ready for detailed checks':c.screen?.ownerDecision||'Unscreened legacy'} | ${escape(c.decision)} | ${escape(c.nextAction)} |`).join('\n')}\n\nComplete review means the owner saved an item, all five Find checks and the source-and-profit preflight passed with dated evidence and all five deep evidence gates have dated decisions. A research opportunity is not a measured winner or spending authorization.\n\n<!-- RESEARCH-DATA\n${JSON.stringify(batch)}\nEND-RESEARCH-DATA -->\n`;
}
export function parseResearchDocument(content){const match=content.match(/<!-- RESEARCH-DATA\n([\s\S]*?)\nEND-RESEARCH-DATA -->/);if(!match)throw Error('Research comparison projection is missing. Regenerate it from the canonical record.');const batch=JSON.parse(match[1]);if(!Array.isArray(batch.candidates)||batch.minimumReviews!==5||batch.targetReviews!==10)throw Error('Invalid research comparison projection.');return {...batch,summary:comparisonSummary(batch)};}
export function batchAssignment(currentBatchPath=''){
 const batchPath=/^research\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\/BATCH\.md$/.test(currentBatchPath)?currentBatchPath:'';
 return {
 role:'manager',productId:'',marketId:'',
 brief:[
  `Curate a visual product batch for the owner, then verify the products the owner saves for checks. Discovery runs in the Meta Ad Library (free, no login, in the built-in browser) with the Find filter in workflow/CHECKS.md: fixed settings, search seeds from the round focus, quick drops, open the survivor, then the five Find checks (F1–F5). Only products that pass all five become cards. Record the seeds used, rows scanned and drop counts by reason. ${batchPath?`Resume the registered current batch at ${batchPath}; preserve its access log and add observed passes there. `:''}Kalodata is an optional cross-check only when a session already exists; agents cannot use Luxury/DICloak. Trendtrack authentication is required before the first saved survivor's final Meta competition check under PLAYBOOK 2.4, not before early visual cards. Read workflow/CHECKS.md, AGENTS.md, memory/START-HERE.md, workflow/the-line.json, os/AGENT-BRIDGE.md, research/CURATION-QUEUE.md and templates/CURATION-BATCH.md. Load research/comparison.json and preserve existing evidence. Workflow owns verification and the completed template; Builder owns later assets and Shopify.`,
  'Target 10–20 unique product families labeled CURATED — UNVERIFIED, without padding the batch. Record each card’s five Find checks with source links and dates (F1: advertisers, longestActiveDays, liveAds). Supplier price is not retail price. Change low-yield seeds when the same bad fits keep coming back. Do not invent controls, a measured removal rate or exhaustive coverage.',
  'Inspect actual product visuals and demonstrations where the selling feature depends on use. Curate plausible distinct products for the owner’s eye test. Capture a real visual/demo, exact ad, listing and merchant links, defining features and variant, retail price context when observed, dated raw signals, concise buyer hypotheses and known risks. Leave subjective emotional appeal to the owner; do not invent buyer reasons or premium prices to rescue a weak product. Source unknown is allowed on early cards when honestly marked; it is not sourcing approval. Deduplicate aliases and repeated listings without concealing meaningful alternatives. Preserve current owner rejections and contrary evidence.',
  'Present early cards in research/CURATION-QUEUE.md for the owner’s Save for checks / Pass for now / Reject decisions, using templates/CURATION-BATCH.md. Apply the five Find checks in workflow/CHECKS.md (provenDemand, looksWorth, productWorks, audienceRoom, noBrand) as supported, failed or pending with dated evidence; show a card only when all five pass. Save for checks queues source/contribution preflight only; it is not build approval and does not pass evidence gates. Do not require five complete reviews before showing early cards. Wait for an owner choice before deep source, Kalodata/community or Trendtrack work on that item; continue independent curation and record unresolved owner choices without repeatedly asking about each step.',
  'For owner-saved items, perform PLAYBOOK 1.4 source-and-price preflight and save the sourceMatch and contribution screen checks through localhost:3000: matching source URL, exact variant/quantity, normal quantity-one price, destination shipping cost or bound, defensible selling price and positive headroom after stated acquisition allowance, fees and reserves. A similar photo or temporary retail promotion is not a repeatable source. Save unsupported or uneconomic findings briefly and continue the other saved items. Only survivors with all five Find checks and the source-and-profit preflight supported earn new detailed Kalodata trajectory, independent original/community review and final Trendtrack competition decisions. Use Pipiads only for a named unresolved identity, ad-history, creative or conflicting-signal question; record when it was not used. Dispatch bounded specialists for independent checks after the owner choice and preliminary feasibility decision are saved. One operator owns native desktop input.',
  'Complete templates/RESEARCH-HANDOFF.md for reviewed candidates with dated source IDs, countries/windows, evidence and counterevidence, buyer reasons, timing, fit/return risk and unresolved dependencies. Resolve all five research gates only from recorded evidence, leaving unknowns pending and incomplete verification packets PARK. Source availability, supplier quote, sample, delivered economics and later finance gates remain separate; none passes automatically.',
  'Compare at least five complete review packets, aiming for ten viable candidates, for the final build comparison only. Early cards remain visible regardless of that minimum; screened IDs and early rejects do not fill it. Continue authorized next steps without routine permission questions or stopping after a tool/report; move on from decisive failures. Return the curated board for the initial eye test, then the completed comparison for final build selection when supported, or a specific scoped blocked/exhausted handoff.',
  'Only after full research verification and explicit final owner build selection, prepare the verified handoff for the existing Builder task, which owns original exact-product images, distinct evidence-backed emotional image-ad concepts and Shopify execution in this first iteration. Do not auto-send, create a new execution route or treat this prepared brief as dispatch. Preserve the parked boots draft and assets; earlier private-build permission remains superseded by the owner stop. A curated card, draft or estimate is not a winner. Read back comparison, curation queue, active-product links/checks, activity, map and shared handoff in localhost:3000 before completion. Supplier confirmation, conservative contribution, launch readiness, publication and an explicit spending budget remain separate downstream requirements.'
 ].join('\n\n'),
 references:['workflow/CHECKS.md','workflow/PRE-DISCOVERY-CHECKLIST.md','workflow/PRE-VERIFICATION-SCREEN.md','research/CURATION-QUEUE.md',...(batchPath?[batchPath]:[]),'templates/CURATION-BATCH.md','templates/RESEARCH-HANDOFF.md','workflow/PLAYBOOK.md','os/AGENT-BRIDGE.md','research/COMPARISON.md','research/CANDIDATES.md','memory/START-HERE.md']
};}
