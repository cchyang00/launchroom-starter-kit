// The product card's Statistics panel (owner, Oct 2: "when you find a product,
// you have to bring in their statistics ... if it doesn't have the right
// statistics and for me to verify, it can't go to the 2nd stage").
// Agents collect, the owner verifies. Everything here is read from the saved
// card (cardStats and the six Step 1 checks); nothing is a pass by itself, and
// anything missing is named, never filled in. Tested in server/statsPanel.test.mjs.
import {FIND_CHECK_IDS, DEMAND_METRICS, DROPSHIP_HOSTS, CHECK_LABELS, cardStats, checkPasses, statsTrend, namedAudiences, cardIssues, AVATARS_MINIMUM, AUDIENCE_MINIMUM, LADDER_RUNGS, earlyWaveRuleApplies, EARLY_WAVE_MAX_UNITS} from './researchView.mjs';

const filled = value => typeof value === 'string' && value.trim() !== '';
const isLink = value => /^https?:\/\//i.test(String(value || ''));
const isDay = value => typeof value === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(value);
const hostOf = value => { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return ''; } };
const money = value => Number.isFinite(value) ? `$${value.toFixed(value % 1 ? 2 : 0)}` : '';

/** The F-number of each Step 2 check (workflow/CHECKS.md). */
export const GATE_NUMBERS = Object.fromEntries(FIND_CHECK_IDS.map((id, i) => [id, `F${i + 1}`]));

/** 7000 -> "7K", 12500 -> "12.5K", 1200000 -> "1.2M"; small numbers stay whole with commas. */
export function compactNumber(value) {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  const short = (n, unit) => `${(Math.round(n * 10) / 10).toString().replace(/\.0$/, '')}${unit}`;
  if (abs >= 1e6) return short(value / 1e6, 'M');
  if (abs >= 1e4 || (abs >= 1000 && value % 1000 === 0)) return short(value / 1e3, 'K');
  return Math.round(value).toLocaleString('en-US');
}

/** Big figure words per metric: Amazon's badge is a floor, so it reads "7K+". */
const FIGURE = {
  'amazon-bought': value => ({big: `${compactNumber(value)}+`, label: 'bought in past month'}),
  'amazon-reviews': value => ({big: value.toLocaleString('en-US'), label: 'reviews'}),
  'google-trends': value => ({big: `${value}`, label: 'Google Trends (of 100)'}),
  'kalodata-units': value => ({big: compactNumber(value), label: 'Kalodata units'}),
  'tiktok-shop-units': value => ({big: compactNumber(value), label: 'TikTok Shop units'}),
  other: value => ({big: compactNumber(value), label: 'other number'}),
};
const SOURCE_NAMES = [[/amazon\./i, 'Amazon'], [/trends\.google\./i, 'Google Trends'], [/kalodata\./i, 'Kalodata'], [/tiktok\./i, 'TikTok'], [/cjdropshipping\./i, 'CJ'], [/alibaba\./i, 'Alibaba'], [/aliexpress\./i, 'AliExpress']];
export const sourceName = url => { const host = hostOf(url); return (SOURCE_NAMES.find(([re]) => re.test(host)) || [null, host])[1]; };
const PRICE_IN_NOTE = /\$\s?(\d{1,4}(?:\.\d{2})?)/;

/**
 * F1 in figures: the newest point of each metric (newest first by metric
 * order: bought, reviews, then the rest), each with its source, date and link.
 * `price` is the saved price, else the first "$" amount in the leading
 * point's note (marked fromNote so the screen can say so).
 */
export function demandFigures(stats) {
  const latest = new Map();
  for (const point of stats.demand) {
    if (!Number.isFinite(point.value)) continue;
    const prev = latest.get(point.metric);
    if (!prev || String(point.observedAt).localeCompare(String(prev.observedAt)) > 0) latest.set(point.metric, point);
  }
  const order = ['amazon-bought', 'kalodata-units', 'tiktok-shop-units', 'amazon-reviews', 'google-trends', 'other'];
  const figures = [...latest.values()].sort((a, b) => order.indexOf(a.metric) - order.indexOf(b.metric)).map(point => {
    const words = (FIGURE[point.metric] || FIGURE.other)(point.value);
    const count = stats.demand.filter(p => p.metric === point.metric && isDay(p.observedAt)).length;
    return {metric: point.metric, ...words, value: point.value, url: point.url, source: sourceName(point.url), observedAt: point.observedAt, note: point.note || '', points: count};
  });
  const lead = figures[0];
  const saved = stats.demand.find(p => Number.isFinite(p.price));
  const noted = lead?.note.match(PRICE_IN_NOTE);
  const price = saved ? {value: saved.price, text: money(saved.price), fromNote: false} : noted ? {value: Number(noted[1]), text: `$${noted[1]}`, fromNote: true} : null;
  return {lead: lead || null, others: figures.slice(1), price};
}

/** The trend series to draw: the Google Trends curve when saved, else the dated points of the metric the trend was worked out from. */
export function trendSeries(check) {
  const curve = (Array.isArray(check?.trend) ? check.trend : []).filter(p => p && isDay(p.date) && Number.isFinite(p.value)).sort((a, b) => a.date.localeCompare(b.date));
  const direction = statsTrend(check || {});
  if (curve.length >= 2 && (direction.metric === 'google-trends' || !direction.metric)) return {metric: 'google-trends', points: curve.map(p => ({date: p.date, value: p.value}))};
  const metric = direction.metric || (Array.isArray(check?.demand) ? check.demand[0]?.metric : '') || '';
  const points = (Array.isArray(check?.demand) ? check.demand : []).filter(p => p && p.metric === metric && isDay(p.observedAt) && Number.isFinite(p.value)).map(p => ({date: p.observedAt, value: p.value})).sort((a, b) => a.date.localeCompare(b.date));
  if (points.length >= 1) return {metric, points};
  return {metric: curve.length ? 'google-trends' : '', points: curve.map(p => ({date: p.date, value: p.value}))};
}

/**
 * Points for a small sparkline in a width x height box (pure geometry, so the
 * screen only draws). Values scale from 0 (or the minimum when every point is
 * far above 0) to the maximum; dates are spaced evenly in time.
 */
export function sparkPoints(points, width = 160, height = 44, pad = 5) {
  if (!points.length) return [];
  const times = points.map(p => Date.parse(p.date.length === 7 ? `${p.date}-01` : p.date));
  const t0 = Math.min(...times), t1 = Math.max(...times), values = points.map(p => p.value);
  const top = Math.max(...values), bottom = Math.min(0, Math.min(...values));
  return points.map((p, i) => ({
    x: Math.round((pad + (t1 === t0 ? (width - 2 * pad) / 2 : (times[i] - t0) / (t1 - t0) * (width - 2 * pad))) * 10) / 10,
    y: Math.round((height - pad - (top === bottom ? 0.5 : (p.value - bottom) / (top - bottom)) * (height - 2 * pad)) * 10) / 10,
    date: p.date, value: p.value,
  }));
}

/** The saved Google Trends screenshot: F1's `trendShot`, else a referenced picture named for the trend. */
export function trendShot(candidate) {
  const check = candidate?.screen?.checks?.provenDemand;
  if (filled(check?.trendShot) && /\.(png|jpe?g|webp|gif|avif)$/i.test(check.trendShot)) return check.trendShot;
  return (candidate?.references || []).find(ref => !isLink(ref) && /\.(png|jpe?g|webp|gif|avif)$/i.test(ref) && /trend/i.test(ref.split('/').pop())) || '';
}

/** F2 for the owner: supplier links, the rough money line and the flags. */
export function dropshipView(candidate) {
  const checks = candidate?.screen?.checks || {}, k = checks.dropshippable || {}, contribution = checks.contribution || {};
  const links = [k.source, ...(Array.isArray(k.suppliers) ? k.suppliers.map(s => typeof s === 'string' ? s : s?.url) : []), ...(candidate?.references || [])]
    .filter(url => isLink(url) && DROPSHIP_HOSTS.test(hostOf(url)));
  const suppliers = [...new Set(links)].map(url => ({url, name: sourceName(url)}));
  const costs = contribution.costs || {};
  const landed = Number.isFinite(k.landedCost) ? k.landedCost : Number.isFinite(costs.itemCost) ? costs.itemCost + (Number.isFinite(costs.shippingCost) ? costs.shippingCost : 0) : null;
  const sell = Number.isFinite(k.sellPrice) ? k.sellPrice : Number.isFinite(costs.sellPrice) ? costs.sellPrice : null;
  const margin = landed !== null && sell !== null ? {value: Math.round((sell - landed) * 100) / 100, percent: sell > 0 ? Math.round((sell - landed) / sell * 100) : null} : null;
  const flags = [...(Array.isArray(k.flags) ? k.flags.filter(filled) : [])];
  const note = typeof k.note === 'string' ? k.note : '';
  const has = re => flags.some(flag => re.test(flag));
  if (!has(/\bCJ\b/i) && /CJ[^.]*(unread|human verification|not (checked|read))/i.test(note)) flags.push('CJ not checked yet (human verification)');
  const moq = note.match(/MOQ\s*([\d][\d\s-–]*)/i);
  if (moq && !has(/MOQ/i)) flags.push(`MOQ ${moq[1].trim().replace(/\s+/g, '')}`);
  if (suppliers.length && !suppliers.some(s => s.name === 'CJ') && k.usShipping !== true) flags.push('US shipping not confirmed');
  return {suppliers, landed, sell, margin, flags, note, money: {landed: money(landed), sell: money(sell), margin: margin ? money(margin.value) : ''}};
}

/** Exactly what a Step 2 check still needs, in plain words ('' when it passes). */
export function gateMissing(id, k, candidate) {
  if (checkPasses(id, k)) return '';
  if (k?.status === 'failed') return `Failed: ${filled(k.note) ? k.note : 'no reason saved'}`;
  const needs = [], problems = [];
  if (id === 'provenDemand') {
    const points = (Array.isArray(k?.demand) ? k.demand : []).filter(p => p && Number.isFinite(p.value));
    const linked = points.filter(p => isLink(p.url) && isDay(p.observedAt));
    const trend = statsTrend(k || {});
    if (!points.length) needs.push('a demand number with its link and date (Amazon bought in past month, reviews)');
    else if (!linked.length) needs.push('a link and date on each number');
    if (trend.direction === 'unknown') needs.push(trend.points === 1 ? 'a second dated point or the Google Trends curve (only one point so far)' : 'a second dated point or the Google Trends curve');
    if (trend.direction === 'falling') problems.push(`Demand is falling (${trend.changePercent}% from ${trend.from} to ${trend.to}).`);
    if (earlyWaveRuleApplies(k) && trend.direction === 'stable') problems.push(`Demand is flat/steady (${trend.changePercent}% from ${trend.from} to ${trend.to}) — already past peak; we require a RISING early-breakout uptrend.`);
    if (earlyWaveRuleApplies(k) && points.some(p => (['tiktok-shop-units', 'kalodata-units'].includes(p.metric) && p.value > EARLY_WAVE_MAX_UNITS) || (p.metric === 'amazon-bought' && p.value > 1000))) {
      problems.push(`Already pumped/saturated (>2,500 TikTok Shop/Kalodata units or >1,000 Amazon bought/mo); target 100–2,500 early-breakout units.`);
    }
    if (!isLink(k?.source)) needs.push('a source link');
    if (!filled(k?.observedAt)) needs.push('the date it was observed');
  } else if (id === 'dropshippable') {
    const host = hostOf(k?.source);
    if (!isLink(k?.source)) needs.push('a supplier listing link on CJ, Alibaba or AliExpress');
    else if (!DROPSHIP_HOSTS.test(host)) problems.push(`The link is on ${host}, not CJ, Alibaba or AliExpress.`);
    else if (!/cjdropshipping/i.test(host) && k?.usShipping !== true) needs.push('US dropship shipping confirmed (usShipping)');
  } else if (id === 'looksWorth') {
    if (!isLink(k?.source)) needs.push('the exact listing link whose photos were judged');
  } else if (id === 'audienceRoom') {
    const named = namedAudiences(k).length;
    if (!filled(k?.mainAudience)) needs.push('the audience it is sold to now');
    if (named < AUDIENCE_MINIMUM) needs.push(`${AUDIENCE_MINIMUM - named} more avatar${AUDIENCE_MINIMUM - named === 1 ? '' : 's'} with who, problem and why (${AVATARS_MINIMUM} in all)`);
  } else if (id === 'bigIssue') {
    if (!cardIssues(k).length) needs.push('the issue file(s) it ties to');
    const open = LADDER_RUNGS.filter(rung => !filled(k?.ladder?.[rung]));
    if (open.length) needs.push(`the benefit ladder's ${open.join(', ')} step${open.length === 1 ? '' : 's'}`);
  } else if (id === 'metaGap') {
    if (!isLink(k?.source)) needs.push('a link to the competitors checked');
    if (!filled(k?.gap)) needs.push('the gap: the angles or avatars competitors don\'t speak to');
  }
  if (!needs.length && !problems.length) return k?.status === 'supported' ? 'Evidence saved, but it does not meet the rule yet.' : 'Evidence is there; not marked as checked yet.';
  return [...problems, needs.length ? `Missing: ${needs.join('; ')}.` : ''].filter(Boolean).join(' ');
}

/** The six gates as the owner reads them: F-number, name, pass or not, and one line. */
export function gateList(candidate) {
  const checks = candidate?.screen?.checks || {};
  return FIND_CHECK_IDS.map(id => {
    const k = checks[id], pass = checkPasses(id, k);
    const note = typeof k?.note === 'string' ? k.note.replace(/\s+/g, ' ').trim() : '';
    const line = pass ? (note.split(/(?<=\.)\s/)[0] || 'Passes.') : gateMissing(id, k, candidate);
    return {id, number: GATE_NUMBERS[id], label: CHECK_LABELS[id], state: pass ? 'pass' : k?.status === 'failed' ? 'fail' : 'open', line, observedAt: k?.observedAt || '', source: isLink(k?.source) ? k.source : ''};
  });
}

/** Why Save is closed ('' when it is open): the owner's rule, F1 statistics first. */
export function saveBlockReason(candidate) {
  const k = candidate?.screen?.checks?.provenDemand;
  if (checkPasses('provenDemand', k)) return '';
  return `Save opens when F1 Statistics passes. ${gateMissing('provenDemand', k, candidate)}`;
}

/** Everything the panel draws, from the saved card. */
export function statsPanel(candidate) {
  const stats = cardStats(candidate);
  const check = candidate?.screen?.checks?.provenDemand || {};
  const gates = gateList(candidate);
  return {
    figures: demandFigures(stats),
    direction: stats.direction,
    series: trendSeries(check),
    trendUrl: isLink(stats.trendUrl) ? stats.trendUrl : '',
    trendShot: trendShot(candidate),
    dropship: dropshipView(candidate),
    ladder: LADDER_RUNGS.map(rung => ({rung, text: stats.ladder[rung]})),
    avatars: stats.avatars,
    gap: stats.competition.gap, gapUrl: stats.competition.url,
    issues: stats.issues,
    gates, passed: gates.filter(g => g.state === 'pass').length,
    saveBlock: saveBlockReason(candidate),
    validation: validationSnapshot(candidate),
  };
}

export const DIRECTION_WORDS = {rising: 'Rising', stable: 'Stable', falling: 'Falling', unknown: 'No trend yet'};

/**
 * The one-glance summary for Find cards and Pipeline rows: the top number
 * ("7K+ bought/mo") and the direction. null when the card has no numbers.
 */
export function statsSummary(candidate) {
  const check = candidate?.screen?.checks?.provenDemand;
  const stats = cardStats(candidate);
  const {lead} = demandFigures(stats);
  if (!lead && stats.direction.direction === 'unknown') return null;
  const SHORT = {'amazon-bought': 'bought/mo', 'amazon-reviews': 'reviews', 'google-trends': 'on Trends', 'kalodata-units': 'units', 'tiktok-shop-units': 'units', other: ''};
  return {
    top: lead ? `${lead.big} ${SHORT[lead.metric] || ''}`.trim() : '',
    source: lead?.source || '',
    direction: stats.direction.direction,
    word: DIRECTION_WORDS[stats.direction.direction],
    passed: checkPasses('provenDemand', check),
  };
}

const GMV_IN_NOTE = /(?:Kalodata[^$]*|30d[^$]*|Product\s+GMV[^$]*)\$\s*([\d,]+(?:\.\d+)?)|(?:\$\s*([\d,]+(?:\.\d+)?)\s*(?:30d|US\s*GMV|GMV))/i;
const VIDEO_GMV_IN_NOTE = /(?:video\s+GMV[^$]*|@\w+[^$]*=\s*)\$\s*([\d,]+(?:\.\d+)?)/i;
const COMPETITORS_IN_NOTE = /Competitors?:\s*([^).]+)/i;

/**
 * Simple at-a-glance validation numbers for the Pipeline (BuildingCard,
 * PipelineRow) and ProductPage:
 * 1. Kalodata & TikTok demand numbers (units sold, 30d GMV, top creator video GMV,
 *    creators count, price, uptrend direction & % change, sparkline points, direct links)
 * 2. Meta Ad Library competition (active competitors, exact live ads, broad ads,
 *    search query, Meta Ad Library URL, and named competitors list)
 * 3. Landed cost & retail margin summary
 */
export function validationSnapshot(candidate) {
  if (!candidate) return null;
  const checks = candidate?.screen?.checks || {};
  const d = checks.provenDemand || {};
  const gap = checks.metaGap || {};
  const gateComp = candidate?.gates?.competition || {};
  const stats = cardStats(candidate);
  const {lead, others, price} = demandFigures(stats);
  const series = trendSeries(d);
  const dir = stats.direction;
  if (!lead && dir.direction === 'unknown' && gap.advertisers == null && d.advertisers == null) return null;

  const allFigs = [lead, ...others].filter(Boolean);
  const tiktokPoint = allFigs.find(f => ['tiktok-shop-units', 'kalodata-units'].includes(f.metric));
  const unitsPoint = tiktokPoint || allFigs.find(f => f.metric === 'amazon-bought') || lead;
  const units = Number.isInteger(d.units) ? d.units : unitsPoint?.value ?? null;
  const isAmazonOnly = !Number.isInteger(d.units) && !tiktokPoint && unitsPoint?.metric === 'amazon-bought';
  const unitsText = units !== null
    ? `${compactNumber(units)} ${isAmazonOnly ? 'bought/mo' : 'sold'}`
    : (lead ? `${lead.big} ${lead.label}` : '');

  const noteText = `${d.note || ''} ${(Array.isArray(d.demand) ? d.demand.map(p => p.note || '').join(' ') : '')}`;
  const gmvMatch = noteText.match(GMV_IN_NOTE);
  const parsedGmv = gmvMatch ? Number((gmvMatch[1] || gmvMatch[2] || '').replace(/,/g, '')) : null;
  const kalodataGmv = Number.isFinite(d.kalodataGmv) ? d.kalodataGmv : (Number.isFinite(parsedGmv) && parsedGmv > 0 ? parsedGmv : null);
  const gmvText = kalodataGmv !== null ? `$${compactNumber(kalodataGmv)}` : '';

  const vidMatch = noteText.match(VIDEO_GMV_IN_NOTE);
  const parsedVidGmv = vidMatch ? Number((vidMatch[1] || '').replace(/,/g, '')) : null;
  const videoGmv = Number.isFinite(d.videoGmv) ? d.videoGmv : (Number.isFinite(parsedVidGmv) && parsedVidGmv > 0 && parsedVidGmv !== kalodataGmv ? parsedVidGmv : null);
  const videoGmvText = videoGmv !== null ? `$${compactNumber(videoGmv)}` : '';

  const creators = Number.isInteger(d.creators) ? d.creators : null;

  const allUrls = [
    d.kalodataUrl,
    ...(Array.isArray(d.kalodataLinks) ? d.kalodataLinks.map(l => l?.url) : []),
    ...(Array.isArray(d.demand) ? d.demand.map(p => p?.url) : []),
    d.source,
    ...(candidate?.references || []),
  ].filter(isLink);
  const kalodataUrl = allUrls.find(u => /kalodata\.com/i.test(u)) || '';
  const tiktokUrl = allUrls.find(u => /tiktok\.com/i.test(u)) || '';
  const amazonUrl = allUrls.find(u => /amazon\./i.test(u)) || '';
  const kalodataLinks = Array.isArray(d.kalodataLinks)
    ? d.kalodataLinks.filter(l => l && filled(l.label) && isLink(l.url))
    : [];

  const advertisers = Number.isInteger(gap.advertisers) ? gap.advertisers : Number.isInteger(d.advertisers) ? d.advertisers : null;
  const liveAds = Number.isInteger(gap.liveAds) ? gap.liveAds : Number.isInteger(d.liveAds) ? d.liveAds : null;
  const broadAds = Number.isInteger(gap.broadAds) ? gap.broadAds : null;
  const metaUrl = [gap.source, gateComp.source, d.source].filter(isLink).find(u => /facebook\.com\/ads\/library/i.test(u)) || (isLink(gap.source) ? gap.source : '');
  let query = filled(gap.exactQuery) ? gap.exactQuery.trim() : '';
  if (!query && metaUrl) {
    try { query = new URL(metaUrl).searchParams.get('q') || ''; } catch {}
  }

  let competitors = [];
  if (Array.isArray(gap.competitors) && gap.competitors.length) {
    competitors = gap.competitors.filter(c => c && (typeof c === 'string' ? filled(c) : filled(c.name))).map(c => typeof c === 'string'
      ? {name: c.trim(), ads: null, note: '', url: metaUrl}
      : {name: c.name.trim(), ads: Number.isInteger(c.ads) ? c.ads : null, note: c.note || '', url: isLink(c.url) ? c.url : metaUrl});
  } else {
    const compMatch = `${gap.note || ''} ${d.note || ''} ${candidate.decision || ''}`.match(COMPETITORS_IN_NOTE);
    if (compMatch) {
      competitors = compMatch[1].split(',').map(s => s.trim()).filter(Boolean).slice(0, 6).map(name => ({name, ads: null, note: '', url: metaUrl}));
    }
  }

  const metaCount = advertisers ?? liveAds;
  const metaTone = metaCount === null ? 'muted' : metaCount <= 5 ? 'good' : metaCount <= 15 ? 'ok' : 'bad';
  const metaBadge = advertisers !== null && liveAds !== null && advertisers !== liveAds
    ? `${advertisers} competitor${advertisers === 1 ? '' : 's'} · ${liveAds} exact ad${liveAds === 1 ? '' : 's'}`
    : liveAds !== null
      ? `${liveAds} active Meta ad${liveAds === 1 ? '' : 's'}`
      : advertisers !== null
        ? `${advertisers} Meta competitor${advertisers === 1 ? '' : 's'}`
        : 'Meta not checked yet';

  const drop = dropshipView(candidate);
  const contrib = checks.contribution || {};
  const costs = contrib.costs || {};
  const itemCost = Number.isFinite(costs.itemCost) ? costs.itemCost : (drop.landed ? Math.round(drop.landed * 0.7 * 100) / 100 : null);
  const shipCost = Number.isFinite(costs.shippingCost) ? costs.shippingCost : (drop.landed ? Math.round(drop.landed * 0.3 * 100) / 100 : null);

  let rawTiers = Array.isArray(contrib.tiers) && contrib.tiers.length ? contrib.tiers : null;
  if (!rawTiers && itemCost !== null && shipCost !== null) {
    const p1 = drop.sell && drop.sell < 50 ? drop.sell : 39.99;
    const s1 = 7.99;
    const p2 = Math.round(p1 * 2 * 0.85 * 100) / 100;
    const p3 = Math.round(p1 * 3 * 0.80 * 100) / 100;
    rawTiers = [
      {qty: 1, label: '1 Pack', price: p1, custShip: s1, landed: Math.round((itemCost + shipCost) * 100) / 100},
      {qty: 2, label: '2 Packs (Save 15% + Free Ship)', price: p2, custShip: 0, landed: Math.round((itemCost * 2 + shipCost * 1.15) * 100) / 100},
      {qty: 3, label: '3 Packs (Save 20% + Free Ship)', price: p3, custShip: 0, landed: Math.round((itemCost * 3 + shipCost * 1.3) * 100) / 100},
    ];
  }
  const tiers = rawTiers ? rawTiers.map(t => {
    const pr = Number(t.price) || 0;
    const cs = Number.isFinite(t.custShip) ? t.custShip : (pr < 50 ? 7.99 : 0);
    const prot = Number.isFinite(t.protFee) ? t.protFee : 4.99;
    const lnd = Number(t.landed) || 0;
    const baseFees = Math.round((pr * 0.029 + 0.30) * 100) / 100;
    const baseProfit = Math.round((pr - lnd - baseFees) * 100) / 100;
    const bonusGross = Math.round((cs + prot) * 100) / 100;
    const bonusNet = Math.round(bonusGross * (1 - 0.029) * 100) / 100;
    const collected = Math.round((pr + cs) * 100) / 100;
    const totalWithProt = Math.round((pr + cs + prot) * 100) / 100;
    const fees = Math.round((collected * 0.029 + 0.30) * 100) / 100;
    const beCpa = Math.round((collected - lnd - fees) * 100) / 100;
    const totalProfit = Math.round((baseProfit + bonusNet) * 100) / 100;
    const targetCpa = Math.round((totalWithProt * 0.80 - lnd - Math.round((totalWithProt * 0.029 + 0.30) * 100) / 100) * 100) / 100;
    const markup = lnd > 0 ? Math.round((pr / lnd) * 100) / 100 : 0;
    return {
      ...t,
      price: pr,
      custShip: cs,
      protFee: prot,
      landed: lnd,
      baseProfit,
      bonusGross,
      bonusNet,
      collected,
      totalWithProt,
      beCpa,
      totalProfit,
      targetCpa,
      markup,
    };
  }) : null;

  let pricingGuardrail = {ok: true, alert: '', summary: 'All 3 tiers profitable'};
  if (tiers && tiers.length >= 2) {
    const lowBase = tiers[0].baseProfit < 18;
    const profitDrop = tiers[1].totalProfit < tiers[0].totalProfit || (tiers[2] && tiers[2].totalProfit < tiers[1].totalProfit);
    if (profitDrop) {
      pricingGuardrail = {
        ok: false,
        alert: `BUNDLE PROFIT TRAP: ${tiers[1].label} ($${tiers[1].totalProfit} total profit) makes LESS than ${tiers[0].label} ($${tiers[0].totalProfit} total profit)! Raise 2-Pack price or consolidate 2-Pack shipping.`,
        summary: `⚠️ 2-Pack profit drop ($${tiers[1].totalProfit} vs $${tiers[0].totalProfit})`,
      };
    } else if (lowBase) {
      pricingGuardrail = {
        ok: false,
        alert: `LOW BASE ITEM PROFIT: ${tiers[0].label} only makes $${tiers[0].baseProfit} on the item price alone ($${tiers[0].price} vs $${tiers[0].landed} landed) before shipping & protection.`,
        summary: `⚠️ Base profit $${tiers[0].baseProfit} (<$18)`,
      };
    } else {
      pricingGuardrail = {
        ok: true,
        alert: '',
        summary: `Base $${tiers[0].baseProfit} + $${tiers[0].bonusNet} Ship/Prot = $${tiers[0].totalProfit} CPA`,
      };
    }
  }

  const rawVideos = Array.isArray(d.rawVideos) ? d.rawVideos : [];
  const rawProducts = Array.isArray(d.rawProducts) ? d.rawProducts : [];
  const tiktokPrice = Number.isFinite(d.tiktokPrice) ? `$${d.tiktokPrice.toFixed(2)}` : (price ? price.text : '');
  const waveLabel = d.waveLabel || (d.waveStart ? `${d.waveStart} → ${d.waveEnd || 'now'}` : '');
  const waveType = d.waveType || 'fresh';
  const brandStatus = d.brandStatus || (checks.noBrand?.status === 'supported' ? '100% Unbranded OEM' : '');

  const catPass = (broadAds !== null && broadAds >= 2) || (liveAds !== null && liveAds >= 1 && liveAds <= 15);
  const directPass = (liveAds ?? advertisers ?? 0) <= 15;
  const fiveRules = [
    {
      id: 'category',
      label: '1. Meta Problem Category',
      state: catPass ? 'good' : 'ok',
      value: broadAds !== null ? `Proven (~${broadAds} broad ads)` : 'Problem-solver category',
    },
    {
      id: 'direct',
      label: '2. Direct Meta Ads (≤15)',
      state: directPass ? 'good' : 'bad',
      value: `${liveAds ?? advertisers ?? 0} exact ads`,
    },
    {
      id: 'wave',
      label: '3. Kalodata Wave Age',
      state: waveType === 'fresh' ? 'good' : 'ok',
      value: waveLabel || `${videoGmvText || gmvText || unitsText} verified`,
    },
    {
      id: 'brand',
      label: '4. Unbranded & Price Floor',
      state: checks.noBrand?.status === 'supported' ? 'good' : 'bad',
      value: `${tiktokPrice ? `TikTok ${tiktokPrice} · ` : ''}${brandStatus || 'Unbranded'}`,
    },
    {
      id: 'tiers',
      label: '5. Bundle Tier Margin',
      state: pricingGuardrail.ok ? 'good' : 'bad',
      value: pricingGuardrail.summary,
    },
  ];

  return {
    direction: dir.direction,
    word: DIRECTION_WORDS[dir.direction] || dir.direction,
    changePercent: dir.changePercent,
    from: dir.from,
    to: dir.to,
    series,
    spark: sparkPoints(series.points, 96, 26, 3),
    sparkWide: sparkPoints(series.points, 200, 48, 5),
    kalodata: {
      units,
      unitsText,
      gmv: kalodataGmv,
      gmvText,
      videoGmv,
      videoGmvText,
      creators,
      price: tiktokPrice,
      kalodataUrl,
      tiktokUrl,
      amazonUrl,
      links: kalodataLinks,
      rawVideos,
      rawProducts,
      waveLabel,
      waveType,
      brandStatus,
      note: d.note || '',
    },
    meta: {
      advertisers,
      liveAds,
      broadAds,
      badge: metaBadge,
      tone: metaTone,
      query,
      url: metaUrl,
      competitors,
      gap: gap.gap || '',
      note: gap.note || '',
    },
    money: drop.money,
    margin: drop.margin,
    tiers,
    pricingGuardrail,
    fiveRules,
    passed: checkPasses('provenDemand', d) && checkPasses('metaGap', gap),
  };
}
