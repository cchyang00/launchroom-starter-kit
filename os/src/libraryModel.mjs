// The Library: everything we learned, written down so the owner and every
// agent can find it. Pure constants and derivations shared by the server
// (server/library.mjs) and the Library tab. No Node imports here.

export const LIBRARY_KINDS = ['research', 'method', 'guide', 'example', 'template', 'note'];
export const LIBRARY_TOPICS = ['product-research', 'buyer-angles', 'copywriting', 'images-ads', 'store', 'sourcing', 'testing', 'operations', 'tools'];
export const LIBRARY_TRUST = ['tested', 'sourced', 'idea', 'outdated'];
export const LIBRARY_STATUSES = ['learned', 'to-learn'];

export const KIND_LABELS = {research: 'Research', method: 'Method', guide: 'Guide', example: 'Example', template: 'Template', note: 'Note'};
export const TOPIC_LABELS = {
  'product-research': 'Finding products', 'buyer-angles': 'Buyers & angles', copywriting: 'Copywriting', 'images-ads': 'Images & ads',
  store: 'Store', sourcing: 'Sourcing', testing: 'Testing', operations: 'Operations', tools: 'Tools',
};
export const TRUST_LABELS = {tested: 'Tested by us', sourced: 'From good sources', idea: 'Idea', outdated: 'Outdated'};
export const TRUST_MEANING = {
  tested: 'We applied it and saw it work.',
  sourced: 'From good sources, not yet tested by us.',
  idea: 'A hypothesis or opinion worth checking.',
  outdated: 'Kept for history. Do not follow it.',
};

const isLearned = entry => entry.status === 'learned';
const newest = (a, b) => String(b.learnedOn || b.requestedOn || '').localeCompare(String(a.learnedOn || a.requestedOn || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(b.id).localeCompare(String(a.id));

/** Counts for the Library strip. Kind, topic and trust count learned entries only. */
export function libraryCounts(entries = []) {
  const learned = entries.filter(isLearned);
  const tally = (keys, pick) => Object.fromEntries(keys.map(key => [key, learned.filter(entry => pick(entry, key)).length]));
  return {
    learned: learned.length,
    toLearn: entries.filter(entry => entry.status === 'to-learn').length,
    byKind: tally(LIBRARY_KINDS, (entry, key) => entry.kind === key),
    byTopic: tally(LIBRARY_TOPICS, (entry, key) => (entry.topics || []).includes(key)),
    byTrust: tally(LIBRARY_TRUST, (entry, key) => entry.trust === key),
  };
}

export const readingList = entries => entries.filter(entry => entry.status === 'to-learn').sort((a, b) => String(a.requestedOn).localeCompare(String(b.requestedOn)) || String(a.id).localeCompare(String(b.id)));
export const recentlyLearned = (entries, limit = 6) => entries.filter(entry => isLearned(entry) && entry.trust !== 'outdated').sort(newest).slice(0, limit);

/** Learned entries for a shelf: one topic (or all), optionally one kind or trust, outdated hidden unless asked. */
export function shelf(entries, {topic = 'all', kind = '', trust = '', showOutdated = false} = {}) {
  return entries.filter(entry => isLearned(entry)
    && (topic === 'all' || (entry.topics || []).includes(topic))
    && (!kind || entry.kind === kind)
    && (!trust || entry.trust === trust)
    && (showOutdated || trust === 'outdated' || entry.trust !== 'outdated')).sort(newest);
}

/**
 * What a Library filter shows: the reading list, one trust level, or everything with
 * outdated entries last, so nothing silently disappears.
 */
export function browseEntries(entries, {topic = 'all', kind = '', trust = ''} = {}) {
  if (trust === 'to-learn') return readingList(entries).filter(entry => (topic === 'all' || (entry.topics || []).includes(topic)) && (!kind || entry.kind === kind));
  if (trust) return shelf(entries, {topic, kind, trust});
  return [...shelf(entries, {topic, kind}), ...shelf(entries, {topic, kind, trust: 'outdated'})];
}
/** Tapping a topic tile: picks it, keeps the trust filter, and tapping it again takes it off. null means no filter. */
export function toggleTopic(filter, id) {
  const trust = filter?.trust || '';
  if (id === 'all') return filter?.topic === 'all' && !trust ? null : {topic: 'all', trust: '', kind: ''};
  if (filter?.topic === id) return trust ? {topic: 'all', trust, kind: ''} : null;
  return {topic: id, trust, kind: ''};
}
/** Tapping a number tile: the same, for how sure we are. */
export function toggleTrust(filter, value) {
  const topic = filter?.topic || 'all';
  if (filter?.trust === value) return topic === 'all' ? null : {topic, trust: '', kind: ''};
  return {topic, trust: value, kind: ''};
}

/** Entries an agent should read, newest first (the agent brief lists these). */
export const forAgent = (entries, agent, limit = 6) => entries.filter(entry => isLearned(entry) && entry.trust !== 'outdated' && (entry.forAgents || []).includes(agent)).sort(newest).slice(0, limit);

/* ---------- One plain prompt in, a tidy entry out ---------- */
// The owner types one sentence or paragraph (LS-062: prompts, never forms).
// These derive the title, the short "what we learned" and a topic guess; the
// manager or an agent tidies the details later.
const LINK = /https?:\/\/[^\s<>()"']+/i;
export const firstLink = value => (String(value || '').match(LINK)?.[0] || '').replace(/[.,;:!?]+$/, '');
const squash = value => String(value || '').replace(/^\s*#+\s*/, '').replace(/\s+/g, ' ').trim();
function clipWords(value, max) {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1), space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, '')}…`;
}
const sentences = value => value.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g)?.map(part => part.trim()).filter(Boolean) || [];
/** A short title: the first sentence (max 120), or "Read example.com/page" for a bare link. */
export function deriveTitle(value) {
  const clean = squash(value);
  if (!clean) return '';
  if (/^https?:\/\/\S+$/i.test(clean)) {
    try { const url = new URL(clean); return clipWords(`Read ${url.hostname.replace(/^www\./, '')}${url.pathname.length > 1 ? url.pathname.replace(/\/$/, '') : ''}`, 120); } catch { /* not a URL after all */ }
  }
  return clipWords((sentences(clean)[0] || clean).replace(/[.!]+$/, ''), 120);
}
/** "What we learned": the first paragraph, cut at a sentence boundary within 400 characters. */
export function deriveLearned(value) {
  const first = squash(String(value || '').trim().split(/\r?\n\s*\r?\n/)[0]);
  if (first.length <= 400) return first;
  let out = '';
  for (const sentence of sentences(first)) { if ((out ? `${out} ${sentence}` : sentence).length > 400) break; out = out ? `${out} ${sentence}` : sentence; }
  return out || clipWords(first, 400);
}
const TOPIC_WORDS = {
  'product-research': ['product', 'products', 'kalodata', 'trend', 'trending', 'winning', 'winner', 'niche', 'discovery', 'curate', 'curation', 'eye'],
  'buyer-angles': ['buyer', 'buyers', 'avatar', 'avatars', 'angle', 'angles', 'audience', 'customer', 'customers', 'pain', 'reddit', 'forum', 'forums', 'situation'],
  copywriting: ['copy', 'copywriting', 'headline', 'headlines', 'hook', 'hooks', 'wording', 'caption', 'captions', 'description', 'offer', 'offers'],
  'images-ads': ['image', 'images', 'photo', 'photos', 'ad', 'ads', 'creative', 'creatives', 'video', 'videos', 'visual', 'visuals', 'static', 'statics'],
  store: ['store', 'shopify', 'page', 'pages', 'checkout', 'storefront', 'hydrogen', 'theme', 'cart', 'palette', 'section', 'sections'],
  sourcing: ['supplier', 'suppliers', 'sourcing', 'aliexpress', 'cj', 'alibaba', 'shipping', 'delivery', 'sample', 'quote', 'cost', 'costs', 'margin'],
  testing: ['test', 'tests', 'testing', 'roas', 'budget', 'cpa', 'cpc', 'ctr', 'campaign', 'campaigns', 'spend', 'experiment', 'results'],
  operations: ['process', 'workflow', 'team', 'agent', 'agents', 'manager', 'handoff', 'routine', 'planner', 'memory'],
  tools: ['tool', 'tools', 'trendtrack', 'pipiads', 'dicloak', 'extension', 'api', 'chrome', 'crawlee', 'luxury'],
};
/** Best-guess topics (at most 2) from the words used; [] when nothing fits. */
export function guessTopics(value) {
  const words = String(value || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return LIBRARY_TOPICS.map(topic => [topic, words.filter(word => TOPIC_WORDS[topic].includes(word)).length])
    .filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1] || LIBRARY_TOPICS.indexOf(a[0]) - LIBRARY_TOPICS.indexOf(b[0])).slice(0, 2).map(([topic]) => topic);
}

const STOP = new Set(['a', 'an', 'and', 'are', 'about', 'as', 'at', 'be', 'by', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'learn', 'me', 'my', 'of', 'on', 'or', 'our', 'should', 'that', 'the', 'this', 'to', 'we', 'what', 'when', 'which', 'who', 'why', 'with', 'want', 'you']);
/** Search words: lowercase, no stop words, at most 8. */
export function searchTerms(query) {
  const words = String(query || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(word => word && !STOP.has(word) && (word.length > 1 || /\d/.test(word)));
  return [...new Set(words)].slice(0, 8);
}
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a word that starts with the term ("copy" finds "copywriting"). */
export const termPattern = (term, flags = 'gu') => new RegExp(`(?:^|[^\\p{L}\\p{N}])${escape(term)}`, flags);

/** Split text into plain and highlighted parts for the search results. */
export function highlightParts(value, terms) {
  const text = String(value || '');
  if (!terms.length || !text) return [{text, hit: false}];
  // Highlight only where a word starts with the term, as search matches it.
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${terms.map(escape).join('|')})`, 'giu');
  return text.split(pattern).filter(Boolean).map(part => ({text: part, hit: terms.includes(part.toLowerCase())}));
}
