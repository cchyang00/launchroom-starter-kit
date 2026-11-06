import test from 'node:test';
import assert from 'node:assert/strict';
import {PLAYBOOK_PATH,PLAYBOOK_STEPS,playbookStep,stepReferences,prioritizePlaybook} from '../src/playbook.mjs';
import {headingAnchor,resolveDocumentPath} from '../src/documentPaths.mjs';
import {parsePlaybook} from '../src/playbook.mjs';
import {readFile} from 'node:fs/promises';
import {processAssignment,processScope,processState} from '../src/processModel.mjs';

test('parked draft remains accessible without becoming the active process or an assignment scope',()=>{
 const products=[{id:'P001',name:'Preserved draft',markets:[{id:'M1',country:'US',status:'parked',checks:{}}]}];
 const parked=processScope(products,'P001');
 assert.equal(parked.product,null);
 assert.equal(parked.parkedProduct,products[0]);
 const flow=processState([{id:'discovery',owner:'validation'}],[{id:'exact-product',stage:'discovery',title:'Exact product'}],parked.market);
 assert.equal(flow.verified,0);
 assert.equal(flow.percent,0);
 const restored=processScope([{...products[0],markets:[...products[0].markets,{id:'M2',country:'GB',status:'active',checks:{}}]}],'P001','M1');
 assert.equal(restored.market.id,'M2','a parked market cannot be selected as the active workflow');
});

test('batch validation assignment preserves owner review without demanding a premature build product',()=>{
 const job=processAssignment({stageIndex:1,stage:{owner:'validation'},action:{id:'2.5',title:'Make the research decision',path:PLAYBOOK_PATH+'#25-make-the-research-decision'},check:{title:'Community',description:'Original evidence',sourceDoc:'agents/validation/WORKFLOW.md'},currentIndex:0});
 assert.equal(job.productId,'');
 assert.match(job.brief,/Screen and qualify actual leads/);
 assert.match(job.brief,/Selected action 2.5/);
 assert.match(job.brief,/owner approval/);
 assert.match(job.brief,/current access hold/);
 assert.doesNotMatch(job.brief,/This is preparation for a later stage/);
 assert.ok(job.references.includes('research/REVIEW-QUEUE.md'));
 assert.ok(job.references.includes('memory/START-HERE.md')&&job.references.includes('workflow/the-line.json'));
 assert.doesNotMatch(`${job.brief} ${job.references.join(' ')}`,/STATE\.md|WORKSPACE\.md/,'archived memory files are not part of a new assignment');
});

test('later product assignment retains exact scope and unresolved earlier gates',()=>{
 const job=processAssignment({stageIndex:5,stage:{owner:'manager'},product:{id:'P-test',name:'Fixture'},market:{id:'M-test',country:'GB'},check:{title:'Plan',description:'Record budget'},currentIndex:2,next:{title:'Physical sample'}});
 assert.equal(job.productId,'P-test');assert.equal(job.marketId,'M-test');
 assert.match(job.brief,/M-test \(GB\)/);
 assert.match(job.brief,/Physical sample/);
 assert.match(job.brief,/preparation for a later stage/);
 assert.match(job.brief,/publication and spending authorization/);
});

test('live procedure covers startup and every ordered canonical action through cycle review',async()=>{
 const content=await readFile(new URL('../../workflow/PLAYBOOK.md',import.meta.url),'utf8');
 const sections=parsePlaybook(content);
 assert.deepEqual(sections.map(s=>s.number),[0,1,2,3,4,5,6]);
 const headings=[...content.matchAll(/^### (\d+\.\d+) (.+)$/gm)];
 const actions=sections.flatMap(s=>s.actions);
 assert.deepEqual(actions.map(a=>a.id),headings.map(h=>h[1]));
 assert.equal(actions.at(-1).id,'6.5');
 for(const section of sections){
  assert.ok(content.includes(`# ${section.number}. ${section.title}`));
  for(const action of section.actions){
   assert.equal(action.path,`${PLAYBOOK_PATH}#${headingAnchor(`${action.id} ${action.title}`)}`);
   assert.ok(action.content.trim().length>0);
   assert.equal('status' in action,false,'procedure must not manufacture proof status');
  }
 }
 assert.match(sections[0].intro,/STATE.md/);
 assert.match(actions.find(a=>a.id==='4.3').content,/quality/i);
 assert.match(actions.find(a=>a.id==='6.5').content,/archiv/i);
});

test('procedure parsing preserves nested instructions and ignores headings in code or appendices',()=>{
 const content='## 1. Discover\r\nInputs\r\n### 1.1 Search\r\nDo this\r\n#### Details\r\nKeep these\r\n```md\r\n## 2. Example only\r\n### 2.1 Not an action\r\n```\r\n### 1.2 Review\r\nReview evidence\r\n## Evidence contract\r\nNot part of review';
 const sections=parsePlaybook(content);
 assert.equal(sections.length,1);
 assert.equal(sections[0].actions.length,2);
 assert.match(sections[0].actions[0].content,/#### Details/);
 assert.match(sections[0].actions[0].content,/## 2. Example only/);
 assert.doesNotMatch(sections[0].actions[1].content,/Not part of review/);
 assert.equal(sections[0].intro.trim(),'Inputs');
});

test('every process stage opens the canonical playbook at its exact heading',()=>{
  assert.equal(PLAYBOOK_STEPS.length,6);
  PLAYBOOK_STEPS.forEach((title,index)=>assert.equal(playbookStep(index),`${PLAYBOOK_PATH}#${headingAnchor(title)}`));
  assert.equal(playbookStep(2),'workflow/PLAYBOOK.md#3-verify-sourcing-and-economics');
  assert.deepEqual(stepReferences('agents/validation/WORKFLOW.md'),[PLAYBOOK_PATH,'agents/validation/WORKFLOW.md']);
  assert.deepEqual(stepReferences(PLAYBOOK_PATH),[PLAYBOOK_PATH]);
});
test('playbook is promoted without mutating catalog or hiding other guides',()=>{
  const docs=[{path:'resources/INDEX.md'},{path:PLAYBOOK_PATH},{path:'research/notes.md'}];
  assert.deepEqual(prioritizePlaybook(docs).map(d=>d.path),[PLAYBOOK_PATH,'resources/INDEX.md','research/notes.md']);
  assert.equal(docs[0].path,'resources/INDEX.md');
});
test('same-file and relative heading links retain file scope and anchor',()=>{
  assert.equal(resolveDocumentPath(`${PLAYBOOK_PATH}#old`,'#2-validate-demand-and-the-market'),`${PLAYBOOK_PATH}#2-validate-demand-and-the-market`);
  assert.equal(resolveDocumentPath(PLAYBOOK_PATH,'../resources/INDEX.md#source-map'),'resources/INDEX.md#source-map');
  assert.equal(headingAnchor('0. Resume and scope the work'),'0-resume-and-scope-the-work');
});
