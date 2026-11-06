import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createStore} from './store.mjs';

async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'merrivy-planner-'));
 t.after(async()=>{assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('merrivy-planner-'));await fs.rm(root,{recursive:true,force:true});});
 await fs.mkdir(path.join(root,'resources'),{recursive:true});
 await fs.writeFile(path.join(root,'resources/study.md'),'# A source\n');
 return {root,store:createStore({workspaceRoot:root})};
}
test('planner is empty without writes, persists completion and can reopen without passing product checks',async t=>{
 const {root,store}=await fixture(t);
 assert.deepEqual(await store.getPlanner(),{revision:0,tasks:[]});
 await assert.rejects(fs.stat(path.join(root,'os/data/planner.json')),{code:'ENOENT'});
 const initial=await store.savePlannerTask({revision:0,title:'Study a reference',date:'2026-09-29',references:['resources/study.md']});
 const task=initial.tasks[0];
 const done=await store.savePlannerTask({revision:1,id:task.id,status:'done',notes:'Read and saved a lesson.'});
 assert.ok(done.tasks[0].completedAt);
 assert.deepEqual(await createStore({workspaceRoot:root}).getPlanner(),done);
 const reopened=await store.savePlannerTask({revision:2,id:task.id,status:'todo',date:''});
 assert.equal(reopened.tasks[0].completedAt,null);
 assert.equal(reopened.tasks[0].notes,'Read and saved a lesson.');
 await assert.rejects(fs.stat(path.join(root,'products')),{code:'ENOENT'});
 await assert.rejects(fs.stat(path.join(root,'store')),{code:'ENOENT'});
});
test('stale edits and concurrent writers cannot silently overwrite tasks',async t=>{
 const {root,store}=await fixture(t);
 const result=await Promise.allSettled([store.savePlannerTask({revision:0,title:'First'}),createStore({workspaceRoot:root}).savePlannerTask({revision:0,title:'Second'})]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(result.find(r=>r.status==='rejected').reason.code,'REVISION_CONFLICT');
 const saved=await store.getPlanner();
 await assert.rejects(store.savePlannerTask({revision:0,id:saved.tasks[0].id,title:'Stale'}),e=>e.code==='REVISION_CONFLICT');
 assert.deepEqual(await store.getPlanner(),saved);
});
test('invalid or missing source, invalid date and absent revision are rejected without a write',async t=>{
 const {store}=await fixture(t);
 for(const input of [{revision:0,title:'Missing',references:['resources/missing.md']},{revision:0,title:'Traversal',references:['../secret.md']},{revision:0,title:'Wrong date',date:'2026-02-30'},{title:'No revision'},{revision:0,title:'Wrong status',status:'verified'}]) {
  await assert.rejects(store.savePlannerTask(input));
  assert.equal((await store.getPlanner()).revision,0);
 }
});
test('corrupt persisted planner is not replaced with an empty list',async t=>{
 const {root,store}=await fixture(t);
 await fs.mkdir(path.join(root,'os/data'),{recursive:true});
 const target=path.join(root,'os/data/planner.json');await fs.writeFile(target,'{broken');
 await assert.rejects(store.getPlanner(),e=>e.code==='MALFORMED_DATA');
 await assert.rejects(store.savePlannerTask({revision:0,title:'Overwrite'}));
 assert.equal(await fs.readFile(target,'utf8'),'{broken');
});
test('step tag accepts the seven step ids or empty, reads old six-step ids as their new step and keeps it on later edits',async t=>{
 const {store}=await fixture(t);
 const saved=await store.savePlannerTask({revision:0,title:'Inspect CJ listings',step:'sourcing'});
 assert.equal(saved.tasks[0].step,'prove','the old Source tag is Prove it now');
 const edited=await store.savePlannerTask({revision:1,id:saved.tasks[0].id,title:'Inspect two CJ listings'});
 assert.equal(edited.tasks[0].step,'prove','an edit without step keeps the tag');
 const cleared=await store.savePlannerTask({revision:2,id:saved.tasks[0].id,step:''});
 assert.equal(cleared.tasks[0].step,'');
 for(const step of ['Find it',3,'shipping','8']) await assert.rejects(store.savePlannerTask({revision:3,title:'Bad step',step}),/seven steps/);
 assert.equal((await store.getPlanner()).revision,3);
 const legacy=await store.savePlannerTask({revision:3,title:'No step given'});
 assert.equal(legacy.tasks.at(-1).step,'');
});
test('focus is capped at three open tasks per day, with a friendly refusal',async t=>{
 const {store}=await fixture(t);
 let p=await store.getPlanner();
 for(const title of ['One','Two','Three']) p=await store.savePlannerTask({revision:p.revision,title,date:'2026-10-01',focus:true});
 await assert.rejects(store.savePlannerTask({revision:p.revision,title:'Four',date:'2026-10-01',focus:true}),e=>e.code==='FOCUS_FULL'&&/Oct 1 already has 3 focus tasks/.test(e.message));
 const plain=await store.savePlannerTask({revision:p.revision,title:'Four',date:'2026-10-01'});
 const four=plain.tasks.at(-1);
 await assert.rejects(store.savePlannerTask({revision:plain.revision,id:four.id,focus:true}),e=>e.code==='FOCUS_FULL','flagging an existing task is refused too');
 // Other days and someday are separate; moving a flagged task onto a full day is refused.
 p=await store.savePlannerTask({revision:plain.revision,title:'Tomorrow focus',date:'2026-10-02',focus:true});
 await assert.rejects(store.savePlannerTask({revision:p.revision,id:p.tasks.at(-1).id,date:'2026-10-01'}),e=>e.code==='FOCUS_FULL');
 p=await store.savePlannerTask({revision:p.revision,title:'Someday focus',date:'',focus:true});
 // Finishing a focus task frees a slot; editing a flagged task's title still works.
 const one=p.tasks.find(x=>x.title==='One');
 p=await store.savePlannerTask({revision:p.revision,id:one.id,status:'done'});
 p=await store.savePlannerTask({revision:p.revision,id:four.id,focus:true});
 assert.equal(p.tasks.filter(x=>x.date==='2026-10-01'&&x.focus&&x.status!=='done').length,3);
 p=await store.savePlannerTask({revision:p.revision,id:p.tasks.find(x=>x.title==='Two').id,title:'Two, renamed'});
 assert.ok(p.tasks.some(x=>x.title==='Two, renamed'&&x.focus));
});
test('a day saved with more than three focus tasks stays readable and editable',async t=>{
 const {root,store}=await fixture(t);
 await fs.mkdir(path.join(root,'os/data'),{recursive:true});
 const at='2026-09-30T10:00:00.000Z';
 const tasks=[1,2,3,4,5].map(n=>({id:`T-legacy-${n}`,title:`Legacy ${n}`,date:'2026-10-01',status:'todo',focus:true,assignee:'agent',agent:'',notes:'',references:[],nextAction:'',createdAt:at,updatedAt:at,completedAt:null}));
 await fs.writeFile(path.join(root,'os/data/planner.json'),JSON.stringify({revision:4,tasks}));
 const saved=await store.savePlannerTask({revision:4,id:'T-legacy-5',nextAction:'Keep going'});
 assert.equal(saved.tasks[4].focus,true);
 assert.equal(saved.tasks[4].step,'');
});
test('moving tasks is one revision-checked write that never finishes work and keeps flags only while there is room',async t=>{
 const {store}=await fixture(t);
 let p=await store.getPlanner();
 for(const [title,date,focus] of [['Carried A','2026-09-29',true],['Carried B','2026-09-30',true],['Today open','2026-10-01',false],['Tomorrow 1','2026-10-02',true],['Tomorrow 2','2026-10-02',true]]) p=await store.savePlannerTask({revision:p.revision,title,date,focus});
 p=await store.savePlannerTask({revision:p.revision,title:'Finished',date:'2026-10-01',status:'done'});
 const id=title=>p.tasks.find(x=>x.title===title).id;
 const before=p.revision;
 await assert.rejects(store.movePlannerTasks({revision:before,ids:[id('Finished')],date:'2026-10-02'}),/stays on the day it was done/);
 await assert.rejects(store.movePlannerTasks({revision:before-1,ids:[id('Carried A')],date:'2026-10-02'}),e=>e.code==='REVISION_CONFLICT');
 await assert.rejects(store.movePlannerTasks({revision:before,ids:['T-missing'],date:'2026-10-02'}),e=>e.code==='NOT_FOUND');
 await assert.rejects(store.movePlannerTasks({revision:before,ids:[id('Carried A')],date:'2026-02-30'}));
 await assert.rejects(store.movePlannerTasks({revision:before,ids:[],date:'2026-10-02'}));
 assert.equal((await store.getPlanner()).revision,before,'refused moves write nothing');
 const moved=await store.movePlannerTasks({revision:before,ids:[id('Carried A'),id('Carried B'),id('Today open')],date:'2026-10-02'});
 assert.equal(moved.revision,before+1,'one write for the whole batch');
 assert.deepEqual(moved.moved.length,3);
 const after=title=>moved.tasks.find(x=>x.title===title);
 assert.equal(after('Carried A').date,'2026-10-02'); assert.equal(after('Carried A').focus,true,'tomorrow had room for one more flag');
 assert.equal(after('Carried B').focus,false,'the fourth flag moves without it');
 assert.deepEqual(moved.unflagged,[id('Carried B')]);
 assert.ok(moved.tasks.every(x=>x.title==='Finished'?x.status==='done':x.status==='todo'),'nothing was marked done');
 assert.equal(after('Finished').date,'2026-10-01');
 const saved=await store.getPlanner();
 assert.deepEqual(saved,{revision:moved.revision,tasks:moved.tasks},'the saved planner matches the response');
 const someday=await store.movePlannerTasks({revision:saved.revision,ids:[id('Carried A')],date:''});
 assert.equal(someday.tasks.find(x=>x.title==='Carried A').date,'');
 const same=await store.movePlannerTasks({revision:someday.revision,ids:[id('Carried A')],date:''});
 assert.equal(same.revision,someday.revision,'moving to the same day writes nothing'); assert.deepEqual(same.moved,[]);
});
