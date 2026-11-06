// A Meta campaign's numbers (owner, Nov 4: "this is where I go to view everything"),
// worked out from the saved record (os/data/meta-campaigns.json). Pure, so Home and
// Improve show the same figures. Nothing here writes a record.

/** The picture that stands for a campaign: its best static ad, else any static ad. */
export function firstImageAd(campaign) {
  const ads = campaign?.ads || [];
  const winnerStatic = ads.find(a => a.format === 'static' && (a.clicksToday > 0 || a.status === 'ACTIVE') && a.mediaPath);
  const anyStatic = ads.find(a => a.format === 'static' && a.mediaPath);
  return winnerStatic?.mediaPath || anyStatic?.mediaPath || '';
}

export function adMetricsForWindow(ad, windowId = 'lifetime') {
  if (windowId === '2026-11-03' || windowId === 'yesterday') {
    const spend = Number(ad?.spendYesterday ?? 0);
    const impressions = Number(ad?.impressionsYesterday ?? 0);
    const clicks = Number(ad?.clicksYesterday ?? 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(ad?.ctrYesterday ?? 0);
    return { spend, impressions, clicks, ctr };
  }
  if (windowId === '2026-11-04' || windowId === 'today') {
    const hasDayToday = ad?.spendDayToday !== undefined;
    const spend = Number(hasDayToday ? ad.spendDayToday : ad?.spendToday || 0);
    const impressions = Number(hasDayToday ? ad.impressionsDayToday : ad?.impressionsToday || 0);
    const clicks = Number(hasDayToday ? ad.clicksDayToday : ad?.clicksToday || 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(hasDayToday ? ad.ctrDayToday : ad?.ctrToday || 0);
    return { spend, impressions, clicks, ctr };
  }
  const spend = Number(ad?.spendLifetime ?? ad?.spendToday ?? 0);
  const impressions = Number(ad?.impressionsLifetime ?? ad?.impressionsToday ?? 0);
  const clicks = Number(ad?.clicksLifetime ?? ad?.clicksToday ?? 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(ad?.ctrLifetime ?? ad?.ctrToday ?? 0);
  return { spend, impressions, clicks, ctr };
}

export function computeCampaignMetrics(campaign, windowId = 'lifetime') {
  const daily = Array.isArray(campaign?.dailyBreakdown) ? campaign.dailyBreakdown : [];
  const dayMatch = windowId !== 'lifetime' ? daily.find(d => d.date === windowId || d.id === windowId) : null;
  const source = dayMatch || campaign?.summaryLifetime || campaign?.summaryToday || {};

  const spend = Number(source.spend || 0);
  const impressions = Number(source.impressions || 0);
  const clicks = Number(source.clicks || 0);
  const viewContent = Number(source.viewContent || clicks || 0);
  const addToCart = Number(source.addToCart || 0);
  const initiateCheckout = Number(source.initiateCheckout || 0);
  const purchases = Number(source.purchases || 0);
  const revenue = Number(source.revenue || 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : Number(source.ctr || 0);
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const cvr = clicks > 0 ? (purchases / clicks) * 100 : 0;
  const cpa = purchases > 0 ? spend / purchases : spend;
  const roas = spend > 0 ? revenue / spend : 0;
  const aov = purchases > 0 ? revenue / purchases : 0;
  const breakEvenCpa = Number(campaign?.breakEvenCpa || 30);
  const cpaDelta = breakEvenCpa - cpa; // positive means profitable below break-even CPA
  const isProfitable = purchases > 0 && cpa <= breakEvenCpa;
  const productAgeDays = Number(campaign?.productAgeDays || daily.length || 1);
  const dateRangeLabel = dayMatch ? dayMatch.label : (campaign?.dateRangeLabel || `${productAgeDays} ${productAgeDays === 1 ? 'Day' : 'Days'} Total`);

  const ads = campaign?.ads || [];
  const activeAds = ads.filter(a => a.status === 'ACTIVE');
  const videoAds = ads.filter(a => a.format === 'video');
  const staticAds = ads.filter(a => a.format === 'static');
  const clickingAds = ads.filter(a => adMetricsForWindow(a, windowId).clicks > 0);
  const bleedingAds = ads.filter(a => {
    const m = adMetricsForWindow(a, windowId);
    return m.spend >= 0.5 && m.clicks === 0;
  });

  const videoSpend = videoAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).spend, 0);
  const videoImpr = videoAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).impressions, 0);
  const videoClicks = videoAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).clicks, 0);
  const videoCtr = videoImpr > 0 ? (videoClicks / videoImpr) * 100 : 0;
  const videoCpc = videoClicks > 0 ? videoSpend / videoClicks : 0;

  const staticSpend = staticAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).spend, 0);
  const staticImpr = staticAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).impressions, 0);
  const staticClicks = staticAds.reduce((s, a) => s + adMetricsForWindow(a, windowId).clicks, 0);
  const staticCtr = staticImpr > 0 ? (staticClicks / staticImpr) * 100 : 0;
  const staticCpc = staticClicks > 0 ? staticSpend / staticClicks : 0;

  return {
    spend,
    impressions,
    clicks,
    viewContent,
    addToCart,
    initiateCheckout,
    purchases,
    revenue,
    ctr,
    cpc,
    cpm,
    cvr,
    cpa,
    roas,
    aov,
    breakEvenCpa,
    cpaDelta,
    isProfitable,
    productAgeDays,
    dateRangeLabel,
    dailyBreakdown: daily,
    totalAds: ads.length,
    activeAds: activeAds.length,
    videoAds: videoAds.length,
    staticAds: staticAds.length,
    clickingAds: clickingAds.length,
    bleedingAds: bleedingAds.length,
    videoStats: { spend: videoSpend, impr: videoImpr, clicks: videoClicks, ctr: videoCtr, cpc: videoCpc },
    staticStats: { spend: staticSpend, impr: staticImpr, clicks: staticClicks, ctr: staticCtr, cpc: staticCpc },
  };
}

/** Every campaign added up: the money row on Home and Improve. */
export function portfolioTotals(campaigns) {
  const totals = (campaigns || []).reduce((sum, campaign) => {
    const m = computeCampaignMetrics(campaign);
    return { spend: sum.spend + m.spend, revenue: sum.revenue + m.revenue, purchases: sum.purchases + m.purchases, clicks: sum.clicks + m.clicks, impressions: sum.impressions + m.impressions };
  }, { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0 });
  return {
    ...totals,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    profitable: (campaigns || []).filter(campaign => computeCampaignMetrics(campaign).isProfitable).length,
  };
}

/** How a campaign's cost per sale sits against its break-even, as a 0-100 bar (100 = at or past break-even). */
export function cpaGauge(metrics) {
  if (!metrics.breakEvenCpa) return 0;
  return Math.min(100, Math.round((metrics.cpa / metrics.breakEvenCpa) * 100));
}
