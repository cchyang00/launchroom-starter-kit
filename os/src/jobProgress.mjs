// Live job progress for the Agents tab (pure, shared with tests).
// Everything comes from a saved activity report: its startedAt/updatedAt and
// its events. An agent posts "Plan: 1 read · 2 route · 3 screens" once, then
// "Step 2/3: route saved" as it goes; nothing here guesses progress.

/** A running job with no update for this long shows its "last update" in amber. */
export const QUIET_AFTER = 10*60*1000;

const toMs = value => value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
const PLAN = /^\s*plan\s*:\s*(.+)$/i;
const STEP = /^\s*step\s+(\d{1,2})\s*(?:\/|of)\s*(\d{1,2})\b\s*[:.\-–—]?\s*(.*)$/i;

/** "Plan: 1 read · 2 server route · 3 screens" -> ['read','server route','screens']; null when not a plan. */
export function parsePlan(text = '') {
  const match = PLAN.exec(String(text));
  if (!match) return null;
  let parts = match[1].split(/\s*[·•|;]\s*/);
  if (parts.length===1) parts = match[1].split(/\s*,\s*/);
  const steps = parts.map(part=>part.replace(/^\(?\d{1,2}\s*[.):\-]?\s+/,'').trim()).filter(Boolean).slice(0,12);
  return steps.length ? steps : null;
}

/** "Step 4/6: tests 241/285 passing" -> {n:4, of:6, text:'tests 241/285 passing'}; null otherwise. */
export function parseStep(text = '') {
  const match = STEP.exec(String(text));
  if (!match) return null;
  const n = Number(match[1]), of = Number(match[2]);
  if (!n || !of || n>of || of>12) return null;
  return {n,of,text:match[3].trim()};
}

/** 32 min, 1 h 5 min, 2 d 3 h. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms<60000) return 'under a minute';
  const minutes = Math.floor(ms/60000);
  if (minutes<60) return `${minutes} min`;
  const hours = Math.floor(minutes/60), rest = minutes%60;
  if (hours<24) return rest?`${hours} h ${rest} min`:`${hours} h`;
  const days = Math.floor(hours/24), h = hours%24;
  return h?`${days} d ${h} h`:`${days} d`;
}

/** just now, 1 min ago, 14 min ago, 2 h ago. */
export function sinceText(ms) {
  if (!Number.isFinite(ms) || ms<60000) return 'just now';
  return `${formatDuration(ms)} ago`;
}

/**
 * A job card's live progress, from one saved report:
 * - elapsed since it started, the last update and whether it has gone quiet
 *   (running and no update for QUIET_AFTER);
 * - latest: the newest event that is not the plan itself;
 * - plan: the newest "Plan:" event's steps, with each step done, current or
 *   to do from the newest "Step N/M" event after it. Without a plan, Step
 *   events alone give numbered steps. A completed report shows every step done.
 */
export function jobProgress(report = {}, now = Date.now()) {
  const events = Array.isArray(report.events) ? report.events : [];
  const at = toMs(now);
  const started = toMs(report.startedAt ?? events[0]?.at);
  const last = Math.max(...[report.updatedAt, events.at(-1)?.at].map(toMs).filter(Number.isFinite), -Infinity);
  const running = report.status==='running';
  const elapsedMs = Number.isFinite(started) ? Math.max(0, at-started) : NaN;
  const quietMs = Number.isFinite(last) ? Math.max(0, at-last) : NaN;
  let planIndex = -1, steps = null;
  for (let i = events.length-1; i>=0; i--) { const parsed = parsePlan(events[i]?.text); if (parsed) { planIndex = i; steps = parsed; break; } }
  let step = null;
  for (let i = events.length-1; i>planIndex; i--) { const parsed = parseStep(events[i]?.text); if (parsed) { step = parsed; break; } }
  const latestEvent = [...events].reverse().find((event,i)=>events.length-1-i!==planIndex && !parsePlan(event?.text));
  let plan = null;
  const labels = steps || (step ? Array.from({length:step.of},(_,i)=>`Step ${i+1}`) : null);
  if (labels) {
    const total = labels.length;
    const current = report.status==='completed' ? null : step ? Math.min(step.n,total) : null;
    const done = report.status==='completed' ? total : current ? current-1 : 0;
    plan = {
      total, done, current,
      percent: Math.round(done/total*100),
      steps: labels.map((label,i)=>({n:i+1,label,state:i<done?'done':i+1===current?'current':'todo'})),
      named: Boolean(steps),
    };
  }
  return {
    running,
    elapsedMs, elapsed: formatDuration(elapsedMs),
    quietMs, lastUpdate: sinceText(quietMs),
    quiet: running && Number.isFinite(quietMs) && quietMs>QUIET_AFTER,
    latest: latestEvent?.text || '',
    plan,
  };
}
