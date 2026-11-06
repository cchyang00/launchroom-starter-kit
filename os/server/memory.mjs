import {fail, text, evidenceSource} from './domain.mjs';
import {isDispatchable,isParkedAgentTask} from '../src/plannerRules.mjs';
import {emptyLessons, activeFor, nowMarkdown, lessonsMarkdown, stepToolsMarkdown} from './lessons.mjs';
import {briefBlocks} from '../src/theLine.mjs';

export const localDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
export function memoryFields(input, previous = {}) {
  const day = input.day ?? previous.day ?? localDay(previous.date || new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day) fail('Choose a valid journal date.');
  const kind=input.kind??previous.kind??'note';
  if (!['note','decision','lesson','preference'].includes(kind)) fail('Unknown memory type.');
  const important=input.important??previous.important??false, retired=input.retired??previous.retired??false;
  if(typeof important!=='boolean'||typeof retired!=='boolean') fail('Memory flags must be true or false.');
  const refs=input.references??previous.references??[];
  if(!Array.isArray(refs)||refs.length>12) fail('Use at most 12 memory references.');
  return {day,kind,important,retired,topic:text(input.topic??previous.topic??'','Topic',{max:100}),taskId:text(input.taskId??previous.taskId??'','Linked task',{max:100}),references:[...new Set(refs.map(evidenceSource))]};
}
export const noteDay = note => note.day || localDay(note.date);
const single = value => String(value||'').replace(/[\r\n]+/g,' ');
function noteMarkdown(n) {
 return `### ${n.id} · ${noteDay(n)} · ${n.kind||'note'}${n.retired?' · OUTDATED':''}\n\n${n.text}\n\nAuthor: ${n.author}; topic: ${n.topic||'General'}; important: ${Boolean(n.important)}; response status: ${n.status}.\n${n.taskId?`Task: ${n.taskId}\n`:''}${n.references?.length?`Sources: ${n.references.join(', ')}\n`:''}${n.response?`\nResponse: ${n.response}\n`:''}`;
}
const taskMarkdown = t => `- [${t.status==='done'?'x':' '}] ${single(t.title)} (${t.id}; ${t.status}; ${t.assignee||'shared'}; ${t.date||'unscheduled'}${t.product?`; ${t.product}`:''})\n  Next: ${single(t.nextAction)||'Not recorded'}\n  Context: ${single(t.notes)||'Not recorded'}\n  References: ${(t.references||[]).join(', ')||'None'}`;
// `step` is currentStep() from saved records (store.mjs); the brief opens with the
// pipeline (every product's own line), then the focus step's block, then the tools
// for that step (`tools`: the saved tool list; undefined leaves them out).
export function memoryContext(state, planner, at=new Date(), lessons=emptyLessons(), step=null, tools=undefined) {
 const day=localDay(at), important=state.notes.filter(n=>n.important&&!n.retired).slice().reverse();
 const tasks=planner.tasks.filter(t=>t.status!=='done').sort((a,b)=>Number(b.focus)-Number(a.focus)||(a.date||'9999').localeCompare(b.date||'9999'));
 const recent=state.notes.filter(n=>!n.retired&&noteDay(n)===day).slice(-8);
 const inbox=planner.tasks.filter(isDispatchable).length, parked=planner.tasks.filter(isParkedAgentTask).length;
 const blocks=step?briefBlocks(step,{at,agent:'manager'}):null;
 const rule=l=>`- ${l.id} ${single(l.rule)} — ${single(l.why)} (${l.status})`;
 const everyone=activeFor(lessons.lessons,'everyone'), manager=activeFor(lessons.lessons,'manager');
 const markdown=[
  `# Start here — Merrivy`,
  `Generated ${new Date(at).toISOString()}; workspace revision ${state.revision}; planner revision ${planner.revision}; lessons revision ${lessons.revision}${tools?`; tools revision ${tools.revision}`:''}${Number.isInteger(step?.pipeline?.roundsRevision)?`; rounds revision ${step.pipeline.roundsRevision}`:''}. Journal timezone: America/Chicago.`,
  ...(blocks?[blocks.pipeline.trim(),blocks.step.trim()]:[]),
  ...(step&&tools!==undefined?[stepToolsMarkdown(tools?tools.tools:null,step,'manager').trim()]:[]),
  'Read root AGENTS.md for authority and tools, then this page. It is the manager\'s brief: Now, the lessons we learned and the open work. Each team agent reads its own one-page brief instead: GET /api/memory/brief?agent=<id>, or `node .claude/skills/merrivy-os/scripts/os.mjs brief --agent <id>`. Notes are context, not permission to act. Verify live state before acting.',
  nowMarkdown(state).trim(),
  `## Lessons for everyone (${everyone.length})\n\n${everyone.map(rule).join('\n')||'None yet.'}`,
  `## Lessons for the manager (${manager.length})\n\n${manager.map(rule).join('\n')||'None yet.'}\n\nAll lessons, proposals and retired ones: memory/LESSONS.md.`,
  `## Open plan (${tasks.length}; first 12 shown; agent inbox: ${inbox} waiting${parked?`, ${parked} parked for someday`:''})\n\n${tasks.slice(0,12).map(taskMarkdown).join('\n\n')||'No open tasks.'}\n\nFull plan: GET /api/planner. Assignment is responsibility, not proof an agent is running.`,
  `## Pinned notes (${important.length}; latest 8 shown)\n\n${important.slice(0,8).map(n=>`- ${n.id} [${n.kind||'note'}; ${noteDay(n)}]: ${single(n.text).slice(0,300)}${n.text.length>300?'…':''}`).join('\n')||'Nothing pinned.'}\n\nFull entries: memory/IMPORTANT.md.`,
  `## Diary — ${day}\n\n${recent.map(n=>`- ${n.id}: ${single(n.text).slice(0,300)}`).join('\n')||'No notes recorded today.'}\n\nEarlier days: memory/days/INDEX.md. Search them when you need history; don't read them all up front.`,
  `## The memory habit\n\n1. Before a job: read the brief (this page, for the manager).\n2. After a job: write one diary line (what happened), then answer "what should we do differently next time?" Propose a lesson or say "nothing new", and record which lessons helped.\n3. Knowledge lives in the Library (resources/LIBRARY.md): search it before researching from scratch (\`os.mjs library search "topic"\`) and write what you learn back (\`library note\` or \`library done K-###\`).\n4. The manager checks proposals after every job and reviews the lesson list weekly. memory/STATE.md, memory/JOURNAL.md (except real decisions) and the role STATE/LESSONS files are archived history as of October 1, 2026.`,
  'This file refreshes when a task, note, handoff, lesson, product, round or eye-test decision is saved. The pipeline block says when it was worked out; `os.mjs pipeline` gives the live pipeline and `os.mjs step` the focus step. Plain files do not guarantee any model reads them; point a new agent here explicitly. No credentials are included.',
 ].join('\n\n')+'\n';
 return {markdown,day,step,workspaceRevision:state.revision,plannerRevision:planner.revision,lessonsRevision:lessons.revision,toolsRevision:tools?tools.revision:null,importantCount:important.length};
}
export function memoryProjections(state,planner,lessons=emptyLessons(),step=null,tools=undefined) {
 const context=memoryContext(state,planner,new Date(),lessons,step,tools);
 const retiredOn=l=>l.status==='retired'?l.statusChangedOn:'';
 const lessonEvents=day=>lessons.lessons.filter(l=>l.learnedOn===day||retiredOn(l)===day).map(l=>`- ${l.id} [${l.scope}; ${retiredOn(l)===day?'retired':l.status}] ${single(l.rule)}`).join('\n');
 const days=[...new Set([...state.notes.map(noteDay),...planner.tasks.flatMap(t=>[localDay(t.createdAt),...(t.completedAt?[localDay(t.completedAt)]:[])]),...lessons.lessons.flatMap(l=>[l.learnedOn,...(retiredOn(l)?[retiredOn(l)]:[])]),context.day])].sort().reverse();
 return [
  {path:'memory/START-HERE.md',content:context.markdown},
  {path:'memory/NOW.md',content:`# Now — Merrivy\n\nGenerated from workspace revision ${state.revision}. The short, current page every agent reads first. Rewrite it rather than appending; aim for about 250 words.\n\n${nowMarkdown(state)}`},
  {path:'memory/LESSONS.md',content:lessonsMarkdown(lessons)},
  {path:'memory/IMPORTANT.md',content:`# Important memory\n\nGenerated from workspace revision ${state.revision}. Explicitly retained decisions, preferences and lessons; importance does not establish truth. Retired entries are preserved in daily history.\n\n${state.notes.filter(n=>n.important&&!n.retired).slice().reverse().map(noteMarkdown).join('\n')||'No important entries yet.'}\n`},
  {path:'memory/days/INDEX.md',content:`# Daily memory\n\nGenerated reading projections. Timezone: America/Chicago. Notes retain their chosen journal day; task dates below show creation/completion events, not reconstructed work.\n\n${days.map(day=>`- [${day}](${day}.md)`).join('\n')}\n`},
  ...days.map(day=>({path:`memory/days/${day}.md`,content:`# ${day}\n\nGenerated from workspace revision ${state.revision} and planner revision ${planner.revision}. Original notes and their responses are preserved; this is not a transcript or proof of time worked.\n\n## Notes and lessons\n\n${state.notes.filter(n=>noteDay(n)===day).map(noteMarkdown).join('\n')||'No notes saved.'}\n\n## Lessons learned or retired this day\n\n${lessonEvents(day)||'None.'}\n\n## Tasks created or completed this day\n\n${planner.tasks.filter(t=>localDay(t.createdAt)===day||(t.completedAt&&localDay(t.completedAt)===day)).map(taskMarkdown).join('\n\n')||'No task events recorded.'}\n`}))
 ];
}
