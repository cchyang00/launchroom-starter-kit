import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';
import {localDay,memoryContext} from './memory.mjs';
import {emptyWorkspace} from './workspace.mjs';

async function setup(t,options={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'merrivy-memory-'));
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('merrivy-memory-'));await fs.rm(root,{recursive:true,force:true});});
 return {root,store:createStore({workspaceRoot:root,...options})};
}
test('daily memory uses local date, keeps legacy notes, and excludes retired important entries from retrieval',async t=>{
 assert.equal(localDay('2026-09-30T04:00:00.000Z'),'2026-09-29');
 const {store,root}=await setup(t);
 let ws=await store.addWorkspaceNote({author:'owner',text:'Keep the accepted template.',kind:'decision',important:true,day:'2026-09-29',topic:'Store'});
 const id=ws.notes[0].id;
 assert.match(await fs.readFile(path.join(root,'memory/IMPORTANT.md'),'utf8'),/accepted template/);
 ws=await store.patchWorkspaceNote(id,{revision:ws.revision,retired:true});
 assert.doesNotMatch((await store.getMemoryContext()).markdown,/Keep the accepted template/);
 assert.match(await fs.readFile(path.join(root,'memory/days/2026-09-29.md'),'utf8'),/OUTDATED[\s\S]*accepted template/);
 await assert.rejects(store.patchWorkspaceNote(id,{revision:1,important:false}),e=>e.code==='REVISION_CONFLICT');
 const legacy={...emptyWorkspace(),notes:[{id:'legacy',date:'2026-09-30T04:00:00.000Z',text:'Older note',author:'agent',status:'open',response:''}]};
 assert.match(memoryContext(legacy,{revision:0,tasks:[]},'2026-09-30T04:00:00.000Z').markdown,/Older note/);
});
test('tasks and linked memories produce a usable cross-harness brief that refreshes on both writes',async t=>{
 const {store,root}=await setup(t);
 const plan=await store.savePlannerTask({revision:0,title:'Write copy',assignee:'agent',nextAction:'Read buyer evidence first'});
 let ws=await store.addWorkspaceNote({author:'owner',text:'Use evidence, not invented claims.',important:true,kind:'preference',taskId:plan.tasks[0].id});
 let brief=await fs.readFile(path.join(root,'memory/START-HERE.md'),'utf8');
 assert.match(brief,/Read buyer evidence first/);assert.match(brief,/Use evidence/);assert.match(brief,/AGENTS.md/);
 await store.savePlannerTask({revision:1,id:plan.tasks[0].id,nextAction:'Review three drafts',status:'doing'});
 brief=await fs.readFile(path.join(root,'memory/START-HERE.md'),'utf8');assert.match(brief,/Review three drafts/);assert.match(brief,/planner revision 2/);
 await assert.rejects(store.addWorkspaceNote({author:'owner',text:'Bad link',taskId:'missing'}));
 await assert.rejects(store.addWorkspaceNote({author:'owner',text:'Bad source',references:['resources/missing.md']}));
 await assert.rejects(store.addWorkspaceNote({author:'owner',text:'Bad day',day:'2026-02-30'}));
 assert.equal((await store.getWorkspace()).revision,ws.revision);
});
test('failed portable projection preserves authoritative notes and plan',async t=>{
 let failWrite=false;
 const {store,root}=await setup(t,{replaceFileImpl:async(from,to)=>{if(failWrite&&to.endsWith('START-HERE.md'))throw new Error('Disk failure');await fs.rename(from,to);}});
 await store.savePlannerTask({revision:0,title:'Original'});
 const before=await fs.readFile(path.join(root,'memory/START-HERE.md'),'utf8');
 failWrite=true;
 await assert.rejects(store.savePlannerTask({revision:1,title:'Not committed'}));
 assert.equal((await store.getPlanner()).revision,1);
 assert.equal(await fs.readFile(path.join(root,'memory/START-HERE.md'),'utf8'),before);
});
