// Winners (owner, Nov 5): "make it very easy for me to see if its a winner, and all the different links to
// every single thing that has been checked. all the listings, videos, kalodata, sourcing, etc."
//
// Pure, from the saved card only: every link it carries, sorted by what it is, and the seven checks as
// proof. Nothing here passes or fails a product; it only says what the record holds, so a search page is
// called a search and a search for some other product is marked.
import {VERIFY_CHECKS, shortReason, verifyLine} from './productGates.mjs';
import {markupOf, viralCounts} from './productView.mjs';

export const LINK_GROUPS = [
  {id: 'videos', title: 'Videos'},
  {id: 'listings', title: 'Listings'},
  {id: 'kalodata', title: 'Kalodata'},
  {id: 'meta', title: 'Meta Ad Library'},
  {id: 'sourcing', title: 'Sourcing'},
  {id: 'trends', title: 'Trends'},
  {id: 'files', title: 'Our research'},
  {id: 'other', title: 'Other'},
];

const SUPPLIERS = [[/aliexpress\./, 'AliExpress', /\/item\//], [/alibaba\./, 'Alibaba', /\/product-detail\//], [/1688\.com/, '1688', /\/offer\//], [/cjdropshipping\./, 'CJ', /\/product\//], [/hypersku\./, 'HyperSKU', /\/product/]];
const STORES = [[/amazon\./, 'Amazon', /\/(dp|gp\/product)\//], [/walmart\./, 'Walmart', /\/ip\//], [/temu\./, 'Temu', /-g-\d+/]];
const SEARCH_KEYS = ['q', 'k', 'keyword', 'SearchText', 'searchText', 'keywords'];

const hostOf = url => {try {return new URL(url).hostname.toLowerCase();} catch {return '';}};
const pathOf = url => {try {return new URL(url).pathname;} catch {return '';}};
function searchTerm(url) {
  try {
    const params = new URL(url).searchParams;
    for (const key of SEARCH_KEYS) if (params.get(key)) return params.get(key).trim();
  } catch {}
  return '';
}

/** Words that say what a product is. Words any gadget could have tell us nothing about a match. */
const PLAIN_WORDS = new Set(['usb', 'led', 'the', 'and', 'for', 'with', 'portable', 'electric', 'rechargeable', 'pack', 'set', 'kit', 'new', 'mini', 'large', 'extra', 'smart', 'wireless', 'pro', 'max', 'premium', 'home', 'black', 'white']);
const wordsOf = text => String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !/^\d+$/.test(word) && !PLAIN_WORDS.has(word));

/** A saved search that shares no real word with the product: most likely another product's link. */
export function offTopicSearch(term, about) {
  const asked = wordsOf(term);
  if (!asked.length) return false;
  const known = new Set(wordsOf(about));
  return !asked.some(word => known.has(word) || [...known].some(other => other.length > 4 && word.length > 4 && (other.startsWith(word) || word.startsWith(other))));
}

/** What one link is, from its address alone. Local files are `files`; pictures and videos stay in the media player. */
export function describeLink(url) {
  const link = String(url || '').trim();
  if (!/^https?:/i.test(link)) {
    const path = link.split('#')[0];
    if (!/\.(md|txt|json)$/i.test(path)) return null;
    const card = path.match(/(?:^|\/)(L\d{3,})\.\w+$/)?.[1] || '';
    const label = !card ? path.split('/').pop() : /\/buyers\//.test(path) ? `Buyers file, ${card}` : `Product file, ${card}`;
    return {group: 'files', label, kind: 'file', term: '', card};
  }
  const host = hostOf(link), path = pathOf(link), term = searchTerm(link);
  if (/tiktok\.com$/.test(host) || /(^|\.)tiktok\.com$/.test(host)) {
    const handle = path.match(/\/@([^/]+)\/video\//)?.[1];
    if (handle) return {group: 'videos', label: `@${handle}`, kind: 'exact', term: ''};
    if (/shop\.|\/product\/|\/shop\//.test(`${host}${path}`)) return {group: 'listings', label: 'TikTok Shop listing', kind: 'exact', term: ''};
    return {group: 'videos', label: 'TikTok', kind: term ? 'search' : 'exact', term};
  }
  if (/kalodata\.com$/.test(host)) return term ? {group: 'kalodata', label: 'Kalodata search', kind: 'search', term} : {group: 'kalodata', label: /\/product\/detail/.test(path) ? 'Kalodata product' : /\/video/.test(path) ? 'Kalodata video' : 'Kalodata', kind: 'exact', term: ''};
  if (/facebook\.com$/.test(host) && /\/ads\/library/.test(path)) return {group: 'meta', label: term ? 'Meta search' : 'Meta advertiser', kind: term ? 'search' : 'exact', term};
  if (/trends\.google\./.test(host)) return {group: 'trends', label: 'Google Trends', kind: 'search', term};
  for (const [hostPattern, name, exact] of SUPPLIERS) if (hostPattern.test(host)) return exact.test(path) && !term ? {group: 'sourcing', label: `${name} listing`, kind: 'exact', term: ''} : {group: 'sourcing', label: `${name} search`, kind: 'search', term};
  for (const [hostPattern, name, exact] of STORES) if (hostPattern.test(host)) return exact.test(path) && !term ? {group: 'listings', label: `${name} listing`, kind: 'exact', term: ''} : {group: 'listings', label: `${name} search`, kind: 'search', term};
  if (/\/products\/[^/]+/.test(path) && !term) return {group: 'listings', label: `${host.replace(/^www\./, '')} store`, kind: 'exact', term: ''};
  return {group: 'other', label: host.replace(/^www\./, '') || 'Link', kind: 'exact', term};
}

const compactMoney = value => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n >= 1000 ? `$${Math.round(n / 100) / 10}K` : `$${Math.round(n)}`;
};

function savedUrls(candidate, v, view) {
  const kalo = v?.kalodata || {}, meta = v?.meta || {}, checks = candidate?.screen?.checks || {}, gates = candidate?.gates || {};
  const urls = [
    ...(candidate?.references || []),
    kalo.tiktokUrl, kalo.kalodataUrl, kalo.amazonUrl,
    ...(kalo.links || []).map(link => link?.url),
    ...(kalo.rawVideos || []).map(video => video?.url),
    ...(kalo.rawProducts || []).map(product => product?.url),
    meta.url,
    ...(meta.competitors || []).map(comp => comp?.url),
    view?.trendUrl, view?.gapUrl,
    ...(view?.dropship?.suppliers || []).map(supplier => supplier?.url),
  ];
  for (const check of Object.values(checks)) urls.push(check?.source, check?.trendUrl, ...(check?.demand || []).map(point => point?.url), ...(check?.kalodataLinks || []).map(link => link?.url));
  for (const gate of Object.values(gates)) urls.push(gate?.source);
  return [...new Set(urls.map(url => String(url || '').trim()).filter(Boolean))];
}

/**
 * Every link on the card, deduped and sorted into LINK_GROUPS. `offTopic` marks a saved search whose words
 * have nothing to do with this product. A group with nothing saved is left out.
 */
export function winnerLinks(candidate, v, view) {
  const about = [candidate?.name, v?.meta?.query, candidate?.buyer].filter(Boolean).join(' ');
  const videos = new Map((v?.kalodata?.rawVideos || []).filter(video => video?.url).map(video => [video.url, video]));
  const customLabels = new Map([
    ...((v?.kalodata?.links || []).filter(l => l?.url && l?.label).map(l => [l.url, l.label])),
    ...((v?.meta?.competitors || []).filter(c => c?.url && c?.name).map(c => [c.url, c.name])),
    ...((v?.kalodata?.rawProducts || []).filter(p => p?.url && p?.title).map(p => [p.url, `${p.title.slice(0, 48)}${p.price ? ` ($${p.price})` : ''}`])),
  ]);
  const groups = new Map(LINK_GROUPS.map(group => [group.id, {...group, links: []}]));
  for (const url of savedUrls(candidate, v, view)) {
    const link = describeLink(url);
    if (!link) continue;
    const video = videos.get(url);
    const customLabel = customLabels.get(url);
    const otherCard = Boolean(link.card && candidate?.id && link.card !== candidate.id);
    const gmvNum = video && Number.isFinite(Number(video.gmv30d)) ? Number(video.gmv30d) : 0;
    const videoParts = [];
    if (gmvNum > 0) videoParts.push(`${compactMoney(gmvNum)} sales`);
    if (video?.sales30d) videoParts.push(`${Number(video.sales30d).toLocaleString('en-US')} sold`);
    if (video?.views) videoParts.push(`${compactMoney(video.views).replace('$', '')} views`);
    if (video?.ageLabel) videoParts.push(video.ageLabel);
    groups.get(link.group).links.push({
      ...link,
      label: customLabel || link.label,
      url,
      gmvNum,
      offTopic: otherCard || (link.kind === 'search' && offTopicSearch(link.term, about)),
      note: videoParts.join(' · '),
    });
  }
  const order = link => (link.offTopic ? 2 : link.kind === 'search' ? 1 : 0);
  return [...groups.values()].filter(group => group.links.length).map(group => {
    const sorted = group.links.sort((a, b) => (order(a) - order(b)) || ((b.gmvNum || 0) - (a.gmvNum || 0)));
    if (group.id === 'videos') {
      let rank = 1;
      for (const l of sorted) {
        if (l.kind === 'exact' && !l.offTopic) {
          l.label = `#${rank++} · ${l.label}`;
        }
      }
    }
    return {...group, links: sorted};
  });
}

const dayWord = value => {
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '';
};

/** The one number each check turns on, from the saved card. Blank when the card doesn't say. */
function factOf(id, candidate, v) {
  const kalo = v?.kalodata || {}, meta = v?.meta || {}, viral = viralCounts(kalo), markup = markupOf(v);
  const buyers = candidate?.screen?.checks?.buyers || {};
  const pack = qty => (v?.tiers || []).find(tier => Number(tier?.qty) === qty);
  switch (id) {
    case 'uptrend': return {big: Number.isFinite(v?.changePercent) ? `${v.changePercent > 0 ? '+' : ''}${v.changePercent}%` : v?.word || '', small: v?.from && v?.to ? `${dayWord(v.from)} to ${dayWord(v.to)}` : ''};
    case 'viral': return {big: viral.videos ? `${viral.videos} videos` : '', small: viral.creators ? `${viral.creators} creators${viral.saved ? ` · ${viral.saved} saved with links` : ''}` : ''};
    case 'value': return {big: v?.money?.sell || '', small: kalo.price ? `our price · ${kalo.price} on TikTok` : 'our price'};
    case 'factory': return {big: v?.money?.landed || '', small: 'landed cost'};
    case 'profit': {
      const one = pack(1), two = pack(2);
      return {big: one ? compactMoney(one.baseProfit) : v?.money?.margin || '', small: [one ? `an order${two ? `, ${compactMoney(two.baseProfit)} on 2` : ''}` : '', markup ? `${markup.toFixed(1)}x markup` : ''].filter(Boolean).join(' · ')};
    }
    case 'buyers': return {big: Number.isFinite(buyers.quotes) ? `${buyers.quotes} quotes` : '', small: Array.isArray(buyers.avatars) && buyers.avatars.length ? `${buyers.avatars.length} avatars` : ''};
    case 'meta': {
      const ads = meta.liveAds ?? meta.advertisers;
      return {big: ads === null || ads === undefined ? '' : `${ads} ads`, small: [Number.isFinite(meta.advertisers) ? `${meta.advertisers} competitor${meta.advertisers === 1 ? '' : 's'}` : '', Number.isFinite(meta.broadAds) ? `${meta.broadAds} in the category` : ''].filter(Boolean).join(' · ')};
    }
    default: return {big: '', small: ''};
  }
}

const CHECK_LINKS = {uptrend: ['trends', 'kalodata'], viral: ['videos'], value: ['listings'], factory: ['sourcing'], profit: [], buyers: ['files'], meta: ['meta']};

/** The seven checks as proof: pass or not, the one number, the saved words and the links behind them. */
export function winnerProof(candidate, v, view) {
  const line = verifyLine(candidate);
  const groups = winnerLinks(candidate, v, view);
  return VERIFY_CHECKS.map((check, index) => {
    const saved = line[index];
    const links = (CHECK_LINKS[check.id] || []).flatMap(id => groups.find(group => group.id === id)?.links || []);
    return {id: check.id, name: check.name, rule: check.rule, state: saved.state, note: shortReason(saved.note), observedAt: saved.observedAt, fact: factOf(check.id, candidate, v), links: check.id === 'buyers' ? links.filter(link => /buyers/i.test(link.url)) : links};
  });
}

/** One pack per card: we only sell a 1-pack and a 2-pack (owner, Nov 4), though older cards still hold a third. */
export const sellingPacks = tiers => (Array.isArray(tiers) ? tiers : []).filter(tier => Number(tier?.qty) <= 2);

/** The cost-per-sale numbers a new build starts from: the 1-pack's, when the card saved them. */
export function buildNumbers(v) {
  const one = sellingPacks(v?.tiers).find(tier => Number(tier.qty) === 1);
  return {breakEvenCpa: Number(one?.beCpa) || Number(v?.margin?.value) || 0, targetCpa: Number(one?.targetCpa) || 0};
}
