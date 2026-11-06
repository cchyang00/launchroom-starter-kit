import {PLAYBOOK_PATH,PLAYBOOK_STEPS,stepReferences} from './playbook.mjs';

const activeMarket = market => ['active','winner'].includes(market.status);
export const effectiveCheckStatus = (market, id) => market?.verificationGate?.ready === true ? market?.checks?.[id]?.status || 'pending' : 'pending';
export const effectiveVerifiedCount = market => market?.verificationGate?.ready === true ? market?.verifiedCount || 0 : 0;
export function processScope(products, activeProductId, preferredMarketId = '') {
 const record=products.find(product=>product.id===activeProductId);
 if(!record)return {product:null,market:null,parkedProduct:null};
 const markets=record.markets.filter(activeMarket);
 if(!markets.length)return {product:null,market:null,parkedProduct:record};
 return {product:record,market:markets.find(market=>market.id===preferredMarketId)||markets[0],parkedProduct:null};
}

export function processAssignment({stageIndex,stage,product,market,action,check,currentIndex,next}){
 const researchBatch=!product&&stageIndex<3;
 const screenOpen=Boolean(product&&market?.verificationGate?.ready!==true);
 const scope=product?`Product ${product.id}: ${product.name}; market ${market?.id||'unselected'} (${market?.country||'unknown'}).`:
  researchBatch?'No active build product. Screen and qualify actual leads in research/CANDIDATES.md; place complete packets in research/REVIEW-QUEUE.md for owner approval. Do not create a build product just to record batch research.':'No active build product. Prepare only what current workspace authority and available inputs support; product-specific execution waits for a selected item.';
 return {role:stage.owner,productId:product?.id||'',marketId:market?.id||'',
  brief:`Work on ${PLAYBOOK_STEPS[stageIndex]}. ${scope}\nRead current AGENTS.md, memory/START-HERE.md (Now, lessons and the step we are on), the step guide in workflow/the-line.json and the matching section of ${PLAYBOOK_PATH}. Honor the current access hold and latest owner decisions.\n${screenOpen?'The linked pre-verification screen is open or stale. Read workflow/PRE-VERIFICATION-SCREEN.md and resolve the seven checks, owner Save, exact listing and selling-country binding before recording any product verification. Treat earlier checked proof as historical; do not claim current progress.\n':''}${action?.id?`Selected action ${action.id}: ${action.title}. Read ${action.path} and follow its procedure in order.`:`Focus on ${check.title}: ${check.description}`}\n${researchBatch?'Use candidate evidence and dispositions; active-product progress stays unchanged.':`Current evidence gate: ${next?.title||'All checks reviewed; verify cycle closeout'}.`}${product&&stageIndex>currentIndex?' This is preparation for a later stage; preserve unresolved earlier gates.':''}\nExplain findings and evidence for owner review. Update the scoped canonical records, shared handoff and Product launch process notes at meaningful milestones. Keep unknowns pending. A prepared assignment is not execution; preserve publication and spending authorization boundaries.`,
  references:[...stepReferences(check.sourceDoc),'memory/START-HERE.md','memory/NOW.md','workflow/the-line.json','os/AGENT-BRIDGE.md',...(screenOpen?['workflow/PRE-VERIFICATION-SCREEN.md','research/COMPARISON.md']:[]),...(researchBatch?['research/CANDIDATES.md','research/REVIEW-QUEUE.md','research/COMPARISON.md']:[])]};
}

export function processState(stages,checks,market){
 const verified=checks.filter(c=>effectiveCheckStatus(market,c.id)==='verified').length;
 const next=checks.find(c=>effectiveCheckStatus(market,c.id)!=='verified');
 const currentIndex=next?stages.findIndex(s=>s.id===next.stage):stages.length;
 return {verified,total:checks.length,percent:checks.length?Math.round(verified/checks.length*100):0,next,currentIndex,complete:checks.length>0&&verified===checks.length,
  steps:stages.map((stage,index)=>{const items=checks.filter(c=>c.stage===stage.id),done=items.filter(c=>effectiveCheckStatus(market,c.id)==='verified').length;return {...stage,index,items,done,total:items.length,state:done===items.length?'complete':index===currentIndex?'current':'upcoming'};})};
}
