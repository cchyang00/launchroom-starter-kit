import {fail, object, text, assertRevision, evidenceSource, safeRelative} from './domain.mjs';
import {AGENT_ID} from './planner.mjs';
import {LIBRARY_KINDS, LIBRARY_TOPICS, LIBRARY_TRUST, LIBRARY_STATUSES, KIND_LABELS, TOPIC_LABELS, TRUST_MEANING, libraryCounts, readingList, searchTerms, termPattern, deriveTitle, guessTopics} from '../src/libraryModel.mjs';

// The Library catalog: one entry per piece of knowledge (research write-up,
// method or skill, guide, example, template or note), each pointing at the
// Markdown file that holds it. os/data/library.json is authoritative;
// resources/LIBRARY.md is the readable projection any harness can open.
export const LIBRARY_LIMIT = 2000;
export const NOTE_MAX = 20_000;
export const NOTE_DIR = 'resources/notes';
export const SEARCH_FILE_MAX = 400_000;
export const emptyLibrary = () => ({revision: 0, entries: []});
export const libraryDay = (at = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(at));
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LESSON_ID = /^LS-\d{3,}$/;
const one = value => String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

function day(value, label, today) {
  if (typeof value !== 'string' || !DAY.test(value) || new Date(value).toISOString().slice(0, 10) !== value) fail(`${label} must be a real YYYY-MM-DD date.`);
  if (today && value > today) fail(`${label} cannot be in the future.`);
  return value;
}
function list(value, label, max) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > max) fail(`${label} must be a list of at most ${max}.`);
  return value;
}
function oneOf(value, allowed, label) {
  if (!allowed.includes(value)) fail(`${label} must be one of: ${allowed.join(', ')}.`);
  return value;
}

function fields(input, previous = {}, today) {
  const status = oneOf(input.status ?? previous.status ?? 'learned', LIBRARY_STATUSES, 'Status');
  const kind = oneOf(input.kind ?? previous.kind ?? 'note', LIBRARY_KINDS, 'Kind');
  const topics = [...new Set(list(input.topics ?? previous.topics, 'Topics', 3).map(topic => oneOf(topic, LIBRARY_TOPICS, 'Each topic')))];
  // Quick notes may wait for topics (the manager tidies them); everything else needs 1 to 3.
  if (status === 'learned' && kind !== 'note' && !topics.length) fail('Choose 1 to 3 topics for a learned entry.');
  const rawPath = input.path ?? previous.path ?? '';
  const path = rawPath === '' ? '' : safeRelative(rawPath, {markdown: true});
  if (status === 'learned' && !path) fail('A learned entry needs the Markdown file that holds it (path), or write it down as a note.', 'PATH_REQUIRED');
  const forAgents = [...new Set(list(input.forAgents ?? previous.forAgents, 'For agents', 12).map(id => {
    if (typeof id !== 'string' || !AGENT_ID.test(id)) fail('For agents must hold team agent IDs.');
    return id;
  }))];
  const lessons = [...new Set(list(input.lessons ?? previous.lessons, 'Lessons', 6).map(id => {
    if (typeof id !== 'string' || !LESSON_ID.test(id)) fail('Related lessons must be IDs like LS-012.');
    return id;
  }))];
  const askedBy = input.askedBy ?? previous.askedBy ?? 'manager';
  if (typeof askedBy !== 'string' || !AGENT_ID.test(askedBy)) fail('Asked by must be owner, manager or a team agent ID.');
  const requestedOn = input.requestedOn ?? previous.requestedOn ?? '';
  const learnedOn = input.learnedOn ?? previous.learnedOn ?? '';
  return {
    title: text(input.title ?? previous.title, 'Title', {required: true, max: 120}),
    learned: text(input.learned ?? previous.learned, 'What we learned', {required: true, max: 400}),
    kind, topics,
    trust: oneOf(input.trust ?? previous.trust ?? 'idea', LIBRARY_TRUST, 'Trust'),
    status, path,
    sources: [...new Set(list(input.sources ?? previous.sources, 'Sources', 6).map(evidenceSource))],
    forAgents, lessons, askedBy,
    requestedOn: requestedOn === '' ? '' : day(requestedOn, 'Requested on', today),
    learnedOn: learnedOn === '' ? '' : day(learnedOn, 'Learned on', today),
  };
}

export function validateLibrary(raw) {
  object(raw);
  if (!Number.isSafeInteger(raw.revision) || raw.revision < 0 || !Array.isArray(raw.entries) || raw.entries.length > LIBRARY_LIMIT) fail('Invalid saved library. Restore os/data/library.json before editing.', 'MALFORMED_DATA', 500);
  const ids = new Set(), paths = new Set();
  for (const entry of raw.entries) {
    try {
      object(entry, 'Library entry'); const value = fields(entry, entry);
      if (typeof entry.id !== 'string' || !/^K-\d{3,}$/.test(entry.id) || ids.has(entry.id)) throw new Error('invalid or duplicate ID');
      if (value.path && paths.has(value.path)) throw new Error(`duplicate path ${value.path}`);
      if (value.status === 'learned' && !value.learnedOn) throw new Error('learned entry has no learnedOn date');
      for (const key of ['createdAt', 'updatedAt']) if (typeof entry[key] !== 'string' || !Number.isFinite(Date.parse(entry[key]))) throw new Error('invalid timestamp');
      ids.add(entry.id); if (value.path) paths.add(value.path);
    } catch (error) { fail(`Invalid saved library entry ${typeof entry?.id === 'string' ? entry.id : ''}: ${error.message}`, 'MALFORMED_DATA', 500); }
  }
  return raw;
}

/**
 * Create (no id) or edit (with id) one entry. Omitted fields keep their value.
 * A learned entry needs a path; moving from to-learn to learned sets learnedOn.
 * Two entries never share a file.
 */
export function updateLibrary(raw, input, now = new Date()) {
  const current = validateLibrary(raw); object(input); assertRevision(current.revision, input.revision);
  const next = structuredClone(current), at = now.toISOString(), today = libraryDay(now);
  if (input.id !== undefined && typeof input.id !== 'string') fail('Entry ID must be text like K-012.');
  const previous = input.id ? next.entries.find(entry => entry.id === input.id) : null;
  if (input.id && !previous) fail('Library entry not found. Refresh the library.', 'NOT_FOUND', 404);
  if (!previous && next.entries.length >= LIBRARY_LIMIT) fail(`The library holds ${LIBRARY_LIMIT} entries. Mark old ones outdated and archive before adding more.`, 'LIBRARY_FULL', 409);
  // A new entry without a title gets one from its first sentence (owner prompts are one text box).
  if (!previous && (input.title === undefined || input.title === '') && typeof input.learned === 'string') input = {...input, title: deriveTitle(input.learned)};
  const value = fields(input, previous || {}, today);
  if (previous?.status === 'learned' && value.status === 'to-learn') fail('A learned entry cannot go back on the reading list. Mark it outdated instead.');
  if (value.status === 'learned' && previous?.status !== 'learned' && input.learnedOn === undefined) value.learnedOn = today;
  if (value.status === 'to-learn' && !value.requestedOn) value.requestedOn = today;
  const twin = value.path && next.entries.find(entry => entry.id !== previous?.id && entry.path === value.path);
  if (twin) fail(`${value.path} is already in the library as ${twin.id}. Edit that entry instead.`, 'DUPLICATE_PATH', 409, {id: twin.id});
  const id = previous?.id || `K-${String(next.entries.reduce((max, entry) => Math.max(max, Number(entry.id.slice(2))), 0) + 1).padStart(3, '0')}`;
  const entry = {id, ...value, createdAt: previous?.createdAt || at, updatedAt: at};
  if (previous) next.entries[next.entries.indexOf(previous)] = entry; else next.entries.push(entry);
  next.revision++;
  if (JSON.stringify(next).length > 4_000_000) fail('Library storage limit reached.', 'LIBRARY_FULL', 409);
  return next;
}

export const presentLibrary = library => ({revision: library.revision, entries: library.entries, counts: libraryCounts(library.entries)});

/* ---------- Notes written from the app ---------- */
export function noteBody(note) {
  object(note, 'Note');
  return text(note.body ?? '', 'Note body', {max: NOTE_MAX});
}
export function noteSlug(title) {
  return String(title || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'note';
}
export const notePath = (on, slug, n = 1) => `${NOTE_DIR}/${on}-${slug}${n > 1 ? `-${n}` : ''}.md`;
export function noteContent({title, learned, body}) {
  const rest = String(body || '').replace(/\r\n/g, '\n').trim();
  // A one-line note is its own "what we learned"; don't repeat it below.
  return `# ${one(title)}\n\n**What we learned:** ${one(learned)}\n${rest && one(rest) !== one(learned) ? `\n${rest}\n` : ''}`;
}

/* ---------- Search ---------- */
/** Plain words from Markdown so search hits and snippets read naturally. */
export function cleanMarkdown(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_>`|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.;:!?)])/g, '$1')
    .trim();
}
function occurrences(haystack, term, cap) {
  if (!haystack) return {count: 0, index: -1};
  const pattern = termPattern(term); let count = 0, index = -1, match;
  while (count < cap && (match = pattern.exec(haystack))) { if (index < 0) index = match.index + (match[0].length - term.length); count += 1; }
  return {count, index};
}
function snippetAround(clean, index, length) {
  const start = Math.max(0, index - 80), end = Math.min(clean.length, index + length + 110);
  return `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}`;
}

/**
 * Rank entries for a query. Per word: title 12, what we learned 6, kind/topic/
 * ID/path 3, file text up to 2, so title beats learned beats topics beats file
 * text. Finding every word adds a small bonus; outdated entries rank lower.
 * `texts` maps a path to {clean, lower} file text (see store.searchLibrary).
 */
export function searchLibrary(entries, query, texts = new Map(), limit = 30) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const phrase = String(query).toLowerCase().replace(/\s+/g, ' ').trim();
  const results = [];
  for (const entry of entries) {
    const title = entry.title.toLowerCase(), learned = entry.learned.toLowerCase();
    const tags = [entry.id, entry.kind, KIND_LABELS[entry.kind], ...entry.topics, ...entry.topics.map(topic => TOPIC_LABELS[topic]), entry.path].join(' ').toLowerCase();
    const file = texts.get(entry.path);
    let score = 0, matched = 0, hitAt = -1, hitLength = 0;
    for (const term of terms) {
      let hit = false;
      if (termPattern(term).test(title)) { score += 12; hit = true; }
      if (termPattern(term).test(learned)) { score += 6; hit = true; }
      if (termPattern(term).test(tags)) { score += 3; hit = true; }
      const inFile = occurrences(file?.lower, term, 3);
      // The snippet centres on the most specific (longest) word found in the file.
      if (inFile.count) { score += inFile.count >= 3 ? 2 : 1; hit = true; if (term.length > hitLength) { hitAt = inFile.index; hitLength = term.length; } }
      if (hit) matched += 1;
    }
    if (!matched) continue;
    if (terms.length > 1 && matched === terms.length) score += 4;
    if (phrase.includes(' ')) {
      if (title.includes(phrase)) score += 10;
      else if (learned.includes(phrase)) score += 5;
      else if (file?.lower.includes(phrase)) { score += 2; hitAt = file.lower.indexOf(phrase); hitLength = phrase.length; }
    }
    if (entry.trust === 'outdated') score = Math.max(1, Math.floor(score / 2));
    results.push({id: entry.id, title: entry.title, learned: entry.learned, kind: entry.kind, trust: entry.trust, status: entry.status, topics: entry.topics, path: entry.path, score, snippet: hitAt >= 0 ? snippetAround(file.clean, hitAt, hitLength) : '', updatedAt: entry.updatedAt});
  }
  return results.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, limit).map(({updatedAt, ...result}) => result);
}

/* ---------- Closest entries when nothing matches ---------- */
// Words people use for a buyer or situation, mapped to the words our entries
// use ("grandparent" → gift). Small and plain on purpose; extend it when a
// real search comes back empty.
const RELATED = [
  {when: ['grandparent', 'grandma', 'grandpa', 'grandmother', 'grandfather', 'grandkid', 'grandchild', 'granny', 'nana', 'mom', 'mum', 'mother', 'dad', 'father', 'parent', 'birthday', 'christmas', 'xmas', 'holiday', 'valentine', 'anniversary', 'wedding', 'retirement', 'present', 'keepsake', 'stocking', 'santa'], words: ['gift', 'keepsake', 'present']},
  {when: ['child', 'children', 'kid', 'toddler', 'baby', 'babies', 'son', 'daughter', 'school', 'teen'], words: ['kids', 'children', 'child', 'family']},
  {when: ['dog', 'cat', 'puppy', 'kitten', 'pet'], words: ['pet', 'dog', 'cat']},
  {when: ['profit', 'margin', 'money', 'earn', 'cost', 'price', 'pricing', 'cheap', 'expensive', 'fee'], words: ['margin', 'contribution', 'cost', 'price', 'economics']},
  {when: ['ship', 'shipping', 'delivery', 'deliver', 'arrive', 'arrival', 'late', 'tracking'], words: ['shipping', 'delivery', 'arrival']},
  {when: ['facebook', 'instagram', 'fb', 'ig', 'advert', 'advertising', 'campaign'], words: ['meta', 'ads', 'campaign']},
  {when: ['viral', 'trend', 'trending', 'creator', 'influencer'], words: ['tiktok', 'trend', 'creator']},
  {when: ['review', 'rating', 'trust', 'testimonial', 'proof'], words: ['reviews', 'proof', 'trust']},
  {when: ['website', 'site', 'shop', 'landing'], words: ['store', 'page', 'shopify']},
];
/** A plain stem: "gifts" → "gift", "families" → "family", "shipping" → "ship". */
export function stemOf(word) {
  const w = String(word || '').toLowerCase();
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3).replace(/(.)\1$/, '$1');
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es') && /(?:ch|sh|x|ss)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
/**
 * Other words worth trying for one search word. `stems` match as word
 * beginnings ("puppy" finds "puppy's"); `related` situation words match whole
 * words only, so "cat" never finds "category".
 */
export function nearWords(term) {
  const stem = stemOf(term), related = new Set();
  for (const group of RELATED) if (group.when.some(word => term === word || stem === word)) group.words.forEach(word => related.add(word));
  related.delete(term); related.delete(stem);
  return {stems: stem !== term && stem.length >= 3 ? [stem] : [], related: [...related]};
}
/** Shorter beginnings of a long word ("grandparent" → "grandparen" … "grand"), longest first. */
const prefixes = term => term.length < 7 ? [] : Array.from({length: Math.min(6, term.length - 5)}, (_, i) => term.slice(0, term.length - 1 - i));
const escapeWord = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = word => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeWord(word)}(?:s|es)?(?![\\p{L}\\p{N}])`, 'u');

/**
 * When a search finds nothing, the closest entries (at most `limit`), each with
 * `closest: true` and `near` (the words that linked it). Uses word stems, the
 * longest shorter beginning of a long word that appears anywhere, related
 * situation words and topic overlap. Outdated entries and the reading list are
 * left out. `texts` is the same path → {clean, lower} map search uses.
 */
export function closestEntries(entries, query, texts = new Map(), limit = 5) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const pool = entries.filter(entry => entry.status === 'learned' && entry.trust !== 'outdated');
  const fields = pool.map(entry => ({entry, title: entry.title.toLowerCase(), learned: entry.learned.toLowerCase(), tags: [...entry.topics, ...entry.topics.map(topic => TOPIC_LABELS[topic]), KIND_LABELS[entry.kind]].join(' ').toLowerCase(), file: texts.get(entry.path)}));
  const anywhere = word => { const pattern = termPattern(word, 'u'); return fields.some(f => [f.title, f.learned, f.tags, f.file?.lower].some(value => value && pattern.test(value))); };
  const probes = new Map();
  const add = (word, weight, pattern) => { if (!probes.has(word) || probes.get(word).weight < weight) probes.set(word, {weight, pattern}); };
  for (const term of terms) {
    const near = nearWords(term);
    for (const word of near.stems) add(word, 1, termPattern(word, 'u'));
    for (const word of near.related) add(word, 1, wholeWord(word));
    const piece = prefixes(term).find(anywhere);
    if (piece) add(piece, 0.8, termPattern(piece, 'u'));
  }
  const topics = guessTopics([...terms, ...probes.keys()].join(' '));
  const results = [];
  for (const f of fields) {
    let score = 0, hitAt = -1, hitLength = 0; const near = [];
    for (const [word, {weight, pattern}] of probes) {
      let points = (pattern.test(f.title) ? 6 : 0) + (pattern.test(f.learned) ? 3 : 0) + (pattern.test(f.tags) ? 2 : 0);
      const found = f.file ? f.file.lower.match(pattern) : null;
      if (found) { points += 1; if (word.length > hitLength) { hitAt = found.index + (/^[^\p{L}\p{N}]/u.test(found[0]) ? 1 : 0); hitLength = word.length; } }
      if (points) { score += points * weight; near.push(word); }
    }
    const shared = f.entry.topics.filter(topic => topics.includes(topic));
    if (shared.length && near.length) score += shared.length;
    if (score <= 0) continue;
    const e = f.entry;
    results.push({id: e.id, title: e.title, learned: e.learned, kind: e.kind, trust: e.trust, status: e.status, topics: e.topics, path: e.path, score: Math.round(score * 10) / 10, snippet: hitAt >= 0 ? snippetAround(f.file.clean, hitAt, hitLength) : '', closest: true, near, updatedAt: e.updatedAt});
  }
  return results.sort((a, b) => b.score - a.score || String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, limit).map(({updatedAt, ...result}) => result);
}

/* ---------- resources/LIBRARY.md ---------- */
const link = path => `[${path}](${/\s/.test(path) ? `<../${path}>` : `../${path}`})`;
function entryLine(entry, topic) {
  const also = entry.topics.filter(item => item !== topic).map(item => TOPIC_LABELS[item]);
  const details = [
    entry.path ? `File: ${link(entry.path)}` : '',
    entry.forAgents.length ? `For: ${entry.forAgents.join(', ')}` : '',
    entry.lessons.length ? `Lessons: ${entry.lessons.join(', ')}` : '',
    also.length ? `Also in: ${also.join(', ')}` : '',
    entry.sources.length ? `Sources: ${entry.sources.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  return `- **${entry.id} · ${one(entry.title)}** — ${one(entry.learned)} _(${entry.trust} · ${KIND_LABELS[entry.kind].toLowerCase()} · ${entry.learnedOn})_${details ? `\n  ${details}` : ''}`;
}
export function libraryMarkdown(library) {
  const learned = library.entries.filter(entry => entry.status === 'learned');
  const current = learned.filter(entry => entry.trust !== 'outdated'), outdated = learned.filter(entry => entry.trust === 'outdated');
  const byNewest = (a, b) => b.learnedOn.localeCompare(a.learnedOn) || a.id.localeCompare(b.id);
  const waiting = readingList(library.entries);
  const sections = LIBRARY_TOPICS.map(topic => {
    const items = current.filter(entry => entry.topics[0] === topic).sort(byNewest);
    return items.length ? `## ${TOPIC_LABELS[topic]} (${items.length})\n\n${items.map(entry => entryLine(entry, topic)).join('\n')}\n` : '';
  }).filter(Boolean);
  return `# Library — all our knowledge\n\nGenerated from os/data/library.json revision ${library.revision}. Everything we learned, written down so the owner and every agent can find it. Change it through localhost:3000 → Library or the helper: \`node .claude/skills/merrivy-os/scripts/os.mjs library search "topic"\`, \`library read K-###\`, \`library note ...\`, \`library learn "..."\`, \`library done K-### ...\`.\n\nTrust: ${LIBRARY_TRUST.map(trust => `**${trust}** = ${TRUST_MEANING[trust].replace(/\.$/, '').toLowerCase()}`).join(' · ')}. Entries are listed under their first topic, newest first.\n\n${current.length} entries in use · ${outdated.length} outdated · ${waiting.length} on the reading list.\n\n${sections.join('\n') || 'Nothing written down yet.\n'}\n## On the reading list (${waiting.length})\n\n${waiting.map(entry => `- **${entry.id} · ${one(entry.title)}** — ${one(entry.learned)} _(asked by ${entry.askedBy} on ${entry.requestedOn}${entry.forAgents.length ? `; for ${entry.forAgents.join(', ')}` : ''})_`).join('\n') || 'Nothing waiting.'}\n\n## Outdated (${outdated.length})\n\nKept for history. Do not follow these.\n\n${outdated.sort(byNewest).map(entry => entryLine(entry, entry.topics[0])).join('\n') || 'None.'}\n`;
}
