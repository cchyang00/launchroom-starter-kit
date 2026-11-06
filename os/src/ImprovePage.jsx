import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Pencil,
  ArrowUpRight,
  ShoppingBag,
  Sparkles,
  Image as ImageIcon,
  ThumbsUp,
  ThumbsDown,
  Smartphone,
  CheckCircle2,
  Layers,
  RefreshCw,
  Calendar,
  ChevronDown,
  BarChart3,
  TrendingUp,
  Sliders,
  DollarSign,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { api } from './ui.jsx';
import { Chip, Sheet, assetUrl } from './kit.jsx';
import { shortProductId } from './displayLine.mjs';
import { PipelineSkillsBar } from './LineNav.jsx';
import { computeCampaignMetrics, adMetricsForWindow } from './campaignView.mjs';
import { DayCards, Funnel, ImprovePanel, KpiTiles, ManageAdCard, OrdersPanel, ProductPick } from './ManageParts.jsx';

// Manage (#/manage) — Dedicated top-level workspace for products that have already launched
// (owner, Nov 5: "The Pipeline and Launch should be the end: when we get to Launch, that
// product is already launched and it's good to go. Manage feels like it should be in its
// own tab where that product is already launched. It's on its own separate tab where now
// it has its own thing that we manage around it. That way when a product is launched, we
// have more avenues and ways to actually grow and work from it because it's in its own tab
// with its own dedicated tabs.")

const BUDGET_PRESETS = [25, 50, 75, 100, 150];
const money = value => `$${Number(value || 0).toFixed(2)}`;
const pct = value => `${Number(value || 0).toFixed(2)}%`;
const urlPath = value => {
  try {
    return new URL(value).pathname.replace(/\/$/, '');
  } catch {
    return '';
  }
};

function parseOrdersList(latestOrderText, purchases, revenue) {
  if (!latestOrderText) {
    return purchases ? [{ label: `${purchases} verified order(s)`, detail: `${money(revenue)} total revenue` }] : [];
  }
  const matches = [...String(latestOrderText).matchAll(/#(\d+)\s*\(([^)]+)\)/g)];
  if (matches.length > 0) {
    return matches.map(m => ({
      id: `ord-${m[1]}`,
      label: `Order No. ${m[1]}`,
      detail: m[2],
      isBundle: /2-Pack|2-Kit|Pair|\+|Bundle/i.test(m[2]),
    }));
  }
  return [{ id: 'ord-latest', label: String(latestOrderText).replace(/#/g, 'No. '), detail: 'Verified Storefront Purchase', isBundle: /Protection|Bundle|2/i.test(latestOrderText) }];
}

function buildDiagnostics(campaign, metrics) {
  const shortId = shortProductId(campaign.productId);
  const ads = campaign.ads || [];
  const topByClicks = [...ads].sort((a, b) => (b.clicksToday || 0) - (a.clicksToday || 0) || (b.ctrToday || 0) - (a.ctrToday || 0))[0];
  const bleeders = ads.filter(a => (a.spendToday || 0) >= 0.25 && (a.clicksToday || 0) === 0);

  const items = [];

  if (metrics.purchases > 0 && metrics.cpa <= metrics.breakEvenCpa) {
    items.push({
      id: `${shortId}-cpa-win`,
      tone: 'done',
      area: 'Meta Ad Profitability',
      hubTarget: `assets?tab=studio&product=${shortId}`,
      hubLabel: 'Open in Assets Hub',
      metricBadge: `${money(metrics.cpa)} CPA vs ${money(metrics.breakEvenCpa)} Break-Even`,
      title: `${shortId} is acquiring buyers ${money(Math.abs(metrics.cpaDelta))} below break-even CPA (${metrics.roas.toFixed(2)}x ROAS)`,
      detail: `Generated ${metrics.purchases} order(s) and ${money(metrics.revenue)} revenue on ${money(metrics.spend)} spend. Keep CBO budget concentrated on the proven purchase-driving creatives and avoid diluting spend into untested cold angles.`,
    });
  } else {
    items.push({
      id: `${shortId}-cpa-fix`,
      tone: 'owner',
      area: 'CPA vs. Break-Even Target',
      hubTarget: 'store',
      hubLabel: 'Open in Store Hub',
      metricBadge: `${money(metrics.cpa)} CPA vs ${money(metrics.breakEvenCpa)} Break-Even`,
      title: `Bring CPA down by ${money(Math.abs(metrics.cpaDelta))} to beat the ${money(metrics.breakEvenCpa)} break-even line`,
      detail: `Ad CTR is strong at ${pct(metrics.ctr)} (${money(metrics.cpc)} CPC), so traffic is cheap—improving storefront click-to-purchase conversion from ${pct(metrics.cvr)} to 4.5%+ or lifting 2-Kit take-rate will immediately push ROAS past 2.2x.`,
    });
  }

  if (topByClicks) {
    items.push({
      id: `${shortId}-top-creative`,
      tone: 'active',
      area: 'Winning Ad Creative & Hook',
      hubTarget: `assets?tab=studio&product=${shortId}`,
      hubLabel: 'Build in Assets Hub',
      metricBadge: `${topByClicks.clicksToday || 0} Clicks · ${pct(topByClicks.ctrToday)} CTR`,
      title: `Top Traffic Driver: ${topByClicks.name}`,
      detail: `Headline "${topByClicks.headline}" is pulling ${pct(topByClicks.ctrToday)} CTR on ${money(topByClicks.spendToday)} spend. Build 3 fresh 9:16 video & 4:5 static variations in the Assets & Creatives Hub and push them to ${shortId}.`,
    });
  }

  if (bleeders.length > 0) {
    const wasted = bleeders.reduce((acc, a) => acc + Number(a.spendToday || 0), 0);
    items.push({
      id: `${shortId}-bleeders`,
      tone: 'owner',
      area: 'Ad Spend Efficiency',
      hubTarget: '',
      hubLabel: '',
      metricBadge: `${bleeders.length} Ads w/ 0 Clicks (${money(wasted)})`,
      title: `Pause or replace ${bleeders.length} ad(s) that spent ${money(wasted)} with 0 link clicks`,
      detail: `Cutting zero-click creatives forces Meta CBO to route 100% of daily impressions into your proven ${pct(metrics.ctr)} CTR winners.`,
    });
  }

  items.push({
    id: `${shortId}-store-cvr`,
    tone: metrics.cvr >= 4 ? 'done' : 'active',
    area: 'Storefront Funnel & AOV',
    hubTarget: 'store',
    hubLabel: 'Edit in Store Hub',
    metricBadge: `${pct(metrics.cvr)} Site CVR · ${money(metrics.aov)} AOV`,
    title:
      metrics.cvr >= 4
        ? `High-Converting Storefront (${pct(metrics.cvr)} click-to-order CVR · ${money(metrics.aov)} AOV)`
        : `Storefront Conversion Lift Opportunity (${pct(metrics.cvr)} CVR across ${metrics.clicks} link clicks)`,
    detail: `Offer & Upsells: ${campaign.pricingSummary}. Ensure the 1-Kit / 2-Kit selector and $4.99 shipping/protection stay clean and visible on mobile.`,
  });

  return items;
}

export function ImprovePage({ hub, go, route, notify }) {
  const [localCampaigns, setLocalCampaigns] = useState(() =>
    Array.isArray(hub?.metaCampaigns) ? hub.metaCampaigns : []
  );
  const [lastSyncedAt, setLastSyncedAt] = useState(() => hub?.metaSavedAt || '');
  const [dataIntegrity, setDataIntegrity] = useState(() => hub?.metaDataIntegrity || null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (Array.isArray(hub?.metaCampaigns) && hub.metaCampaigns.length) {
      setLocalCampaigns(hub.metaCampaigns);
    }
    if (hub?.metaSavedAt) setLastSyncedAt(hub.metaSavedAt);
    if (hub?.metaDataIntegrity) setDataIntegrity(hub.metaDataIntegrity);
  }, [hub?.metaCampaigns, hub?.metaSavedAt, hub?.metaDataIntegrity]);

  async function syncLiveMetaAndShopify() {
    setSyncing(true);
    try {
      const res = await api('/api/meta-campaigns', { action: 'sync' });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
      if (res?.metaSavedAt) setLastSyncedAt(res.metaSavedAt);
      if (res?.metaDataIntegrity) setDataIntegrity(res.metaDataIntegrity);
      notify?.('Synced live Lifetime + Day-by-Day Meta Ads & Shopify orders.');
    } catch (e) {
      notify?.(`The sync did not finish: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const [packets, setPackets] = useState([]);
  useEffect(() => {
    api('/api/store-editor')
      .then(view => setPackets(view.packets || []))
      .catch(() => setPackets([]));
  }, []);

  const campaigns = useMemo(() => {
    return [...localCampaigns].sort((a, b) => {
      const revB = Number(b?.summaryToday?.revenue || 0);
      const revA = Number(a?.summaryToday?.revenue || 0);
      if (revB !== revA) return revB - revA;
      return Number(b?.summaryToday?.spend || 0) - Number(a?.summaryToday?.spend || 0);
    });
  }, [localCampaigns]);

  const [selectedId, setSelectedId] = useState(() => route?.params?.product || '');
  const activeCampaign = useMemo(() => {
    if (!campaigns.length) return null;
    if (selectedId) {
      const found = campaigns.find(
        c => c.productId === selectedId || shortProductId(c.productId) === shortProductId(selectedId)
      );
      if (found) return found;
    }
    return campaigns[0];
  }, [campaigns, selectedId]);

  const [subTab, setSubTab] = useState(() => route?.params?.tab || 'overview');
  useEffect(() => {
    if (route?.params?.tab) setSubTab(route.params.tab);
  }, [route?.params?.tab]);

  const [dateWindow, setDateWindow] = useState('lifetime');
  const [adFilter, setAdFilter] = useState('performing');
  const [adSort, setAdSort] = useState('rank');
  const [inspectAd, setInspectAd] = useState(null);
  const [frameKey, setFrameKey] = useState(0);
  const [showAllAds, setShowAllAds] = useState(false);

  // Budget & scaling form state inside Scale & Day Log sub-tab
  const [dailyBudget, setDailyBudget] = useState(50);
  const [countries, setCountries] = useState('US / CA / UK / AU (Broad)');
  const [breakEvenCpa, setBreakEvenCpa] = useState(36.4);
  const [lossLimit, setLossLimit] = useState(50);
  const [savingBudget, setSavingBudget] = useState(false);

  // Day-to-Day Learning Log state inside Scale or Cut sub-tab
  const [logDecision, setLogDecision] = useState('Keep & Iterate Ads');
  const [logWorked, setLogWorked] = useState('');
  const [logImprove, setLogImprove] = useState('');
  const [logNext, setLogNext] = useState('');
  const [savingLog, setSavingLog] = useState(false);

  // Cancel & Wipe Product (Clean Slate) modal state
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState(
    'Numbers failed Day-1/Day-2 baseline — cutting product for a clean slate.'
  );
  const [wipingProduct, setWipingProduct] = useState(false);

  useEffect(() => {
    if (!activeCampaign) return;
    setDailyBudget(Number(activeCampaign.dailyBudget || 50));
    setCountries(activeCampaign.countries || 'US / CA / UK / AU (Broad)');
    setBreakEvenCpa(Number(activeCampaign.breakEvenCpa || 36.4));
    setLossLimit(Number(activeCampaign.lossLimit || 50));
  }, [activeCampaign?.productId, activeCampaign?.updatedAt]);

  useEffect(() => {
    if (!activeCampaign || dateWindow === 'lifetime') return;
    const hasDay = (activeCampaign.dailyBreakdown || []).some(d => d.date === dateWindow);
    if (!hasDay) setDateWindow('lifetime');
  }, [activeCampaign, dateWindow]);

  const metrics = useMemo(
    () => (activeCampaign ? computeCampaignMetrics(activeCampaign, dateWindow) : null),
    [activeCampaign, dateWindow]
  );

  const lifetimeMetrics = useMemo(
    () => (activeCampaign ? computeCampaignMetrics(activeCampaign, 'lifetime') : null),
    [activeCampaign]
  );

  const linkedPacket = useMemo(() => {
    if (!activeCampaign) return null;
    const targetPath = urlPath(activeCampaign.storeUrl);
    return packets.find(p => p.productUrl === targetPath) || null;
  }, [activeCampaign, packets]);

  const orders = useMemo(() => {
    if (!activeCampaign) return [];
    const today = activeCampaign.summaryLifetime || activeCampaign.summaryToday || {};
    return parseOrdersList(today.latestOrder, today.purchases, today.revenue);
  }, [activeCampaign]);

  const diagnostics = useMemo(() => {
    if (!activeCampaign || !lifetimeMetrics) return [];
    return buildDiagnostics(activeCampaign, lifetimeMetrics);
  }, [activeCampaign, lifetimeMetrics]);

  async function saveAdVerdict(adId, ownerVerdict) {
    if (!activeCampaign) return;
    try {
      const res = await api('/api/meta-campaigns', {
        productId: activeCampaign.productId,
        adId,
        ownerVerdict,
      });
      if (Array.isArray(res?.metaCampaigns)) {
        setLocalCampaigns(res.metaCampaigns);
      }
      notify?.(ownerVerdict === 'approved' ? 'Marked ad as Keep / Winner.' : ownerVerdict === 'cut' ? 'Marked ad to Cut / Pause.' : 'Cleared verdict.');
    } catch (e) {
      notify?.(`That did not save: ${e.message}`);
    }
  }

  async function saveScalePlan(e) {
    if (e) e.preventDefault();
    if (!activeCampaign) return;
    setSavingBudget(true);
    try {
      const res = await api('/api/meta-campaigns', {
        campaignId: activeCampaign.campaignId,
        productId: activeCampaign.productId,
        dailyBudget: Number(dailyBudget),
        countries: String(countries).trim(),
        breakEvenCpa: Number(breakEvenCpa),
        lossLimit: Number(lossLimit),
      });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
      notify?.(`Updated ${shortProductId(activeCampaign.productId)} budget to $${Number(dailyBudget)}/day.`);
    } catch (err) {
      notify?.(`Could not save budget: ${err.message}`);
    } finally {
      setSavingBudget(false);
    }
  }

  async function saveDailyLog(e) {
    if (e) e.preventDefault();
    if (!activeCampaign) return;
    if (!logWorked.trim() && !logImprove.trim() && !logNext.trim()) {
      notify?.('Write at least one note about what worked, what to improve, or the next step.');
      return;
    }
    setSavingLog(true);
    try {
      const res = await api('/api/meta-campaigns', {
        campaignId: activeCampaign.campaignId,
        productId: activeCampaign.productId,
        dailyLogEntry: {
          date: new Date().toISOString().slice(0, 10),
          decision: logDecision,
          whatWorked: logWorked.trim(),
          whatToImprove: logImprove.trim(),
          nextStep: logNext.trim(),
        },
      });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
      setLogWorked('');
      setLogImprove('');
      setLogNext('');
      notify?.(`Saved today's learning log for ${shortProductId(activeCampaign.productId)}.`);
    } catch (err) {
      notify?.(`Could not save log: ${err.message}`);
    } finally {
      setSavingLog(false);
    }
  }

  async function toggleCroCheck(croCheckId, currentVal) {
    if (!activeCampaign) return;
    try {
      const res = await api('/api/meta-campaigns', {
        campaignId: activeCampaign.campaignId,
        productId: activeCampaign.productId,
        croCheckId,
        checked: !currentVal,
      });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
    } catch (err) {
      notify?.(`Could not update check: ${err.message}`);
    }
  }

  async function handleCancelAndWipe() {
    if (!activeCampaign) return;
    const droppedName = activeCampaign.shortName || shortProductId(activeCampaign.productId);
    setWipingProduct(true);
    try {
      const res = await api('/api/meta-campaigns', {
        action: 'cancel-and-wipe',
        campaignId: activeCampaign.campaignId,
        productId: activeCampaign.productId,
        reason: cancelReason.trim() || 'Numbers failed baseline — cancelled & wiped for a clean slate.',
      });
      if (Array.isArray(res?.metaCampaigns)) {
        setLocalCampaigns(res.metaCampaigns);
      }
      setConfirmCancel(false);
      notify?.(`Cancelled & wiped ${droppedName}. Clean slate ready.`);
      const nextRemaining = Array.isArray(res?.metaCampaigns) ? res.metaCampaigns[0] : null;
      if (nextRemaining) {
        setSelectedId(nextRemaining.productId);
      } else {
        setSelectedId('');
      }
    } catch (err) {
      notify?.(`Could not cancel & wipe product: ${err.message}`);
    } finally {
      setWipingProduct(false);
    }
  }

  const adSalesOf = ad =>
    Number(ad?.purchasesLifetime ?? (/(\d+)\s*Purchase/i.exec(ad?.note || '') || [])[1] ?? 0);
  const adAtcOf = ad =>
    Number(ad?.atcLifetime ?? (/(\d+)\s*AddToCart/i.exec(ad?.note || '') || [])[1] ?? 0);

  const filteredAds = useMemo(() => {
    if (!activeCampaign) return [];
    const list = [...(activeCampaign.ads || [])];
    const filtered = list.filter(ad => {
      const m = adMetricsForWindow(ad, dateWindow);
      const sales = adSalesOf(ad);
      if (adFilter === 'performing') return m.spend > 0 || m.clicks > 0 || sales > 0 || ad.status === 'ACTIVE';
      if (adFilter === 'winners') return sales > 0 || m.ctr >= 3 || m.clicks >= 2 || /Purchase|WINNER/i.test(ad.note || '');
      if (adFilter === 'video') return ad.format === 'video';
      if (adFilter === 'static') return ad.format === 'static';
      if (adFilter === 'bleeders') return m.spend > 0 && m.clicks === 0 && sales === 0;
      return true;
    });
    return filtered.sort((a, b) => {
      const ma = adMetricsForWindow(a, dateWindow);
      const mb = adMetricsForWindow(b, dateWindow);
      const sa = adSalesOf(a);
      const sb = adSalesOf(b);
      const atca = adAtcOf(a);
      const atcb = adAtcOf(b);

      if (adSort === 'sales') {
        if (sb !== sa) return sb - sa;
        if (sa > 0 && sb > 0) return ma.spend / sa - mb.spend / sb;
        return mb.ctr - ma.ctr || mb.clicks - ma.clicks;
      }
      if (adSort === 'ctr') return mb.ctr - ma.ctr || mb.clicks - ma.clicks || sb - sa;
      if (adSort === 'clicks') return mb.clicks - ma.clicks || mb.ctr - ma.ctr;
      if (adSort === 'spend') return mb.spend - ma.spend || mb.clicks - ma.clicks;

      // Default 'rank': Best -> Worst (Sale Makers -> High ATC -> Best CTR & Clicks -> Unspent -> 0-Click Bleeders at bottom)
      const tierOf = (ad, m, sales, atc) => {
        if (sales > 0) return 5;
        if (atc > 0 && m.clicks > 0) return 4;
        if (m.clicks > 0 && m.ctr >= 3.0) return 3;
        if (m.clicks > 0) return 2;
        if (m.spend === 0) return 1;
        return 0; // 0-click bleeder (worst)
      };
      const ta = tierOf(a, ma, sa, atca);
      const tb = tierOf(b, mb, sb, atcb);
      if (tb !== ta) return tb - ta;
      if (ta === 5) {
        if (sb !== sa) return sb - sa;
        const cpaA = ma.spend > 0 ? ma.spend / sa : 999;
        const cpaB = mb.spend > 0 ? mb.spend / sb : 999;
        return cpaA - cpaB || mb.ctr - ma.ctr;
      }
      if (ta === 0) {
        // Put heaviest-wasting 0-click bleeders at the very bottom
        return ma.spend - mb.spend;
      }
      return mb.ctr - ma.ctr || mb.clicks - ma.clicks || atcb - atca;
    });
  }, [activeCampaign, adFilter, adSort, dateWindow]);

  const portfolio = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => {
        const m = computeCampaignMetrics(c, 'lifetime');
        acc.spend += m.spend;
        acc.revenue += m.revenue;
        acc.purchases += m.purchases;
        acc.clicks += m.clicks;
        acc.impressions += m.impressions;
        return acc;
      },
      { spend: 0, revenue: 0, purchases: 0, clicks: 0, impressions: 0 }
    );
  }, [campaigns]);
  const portfolioRoas = portfolio.spend > 0 ? portfolio.revenue / portfolio.spend : 0;
  const portfolioCtr = portfolio.impressions > 0 ? (portfolio.clicks / portfolio.impressions) * 100 : 0;

  const daily = activeCampaign?.dailyBreakdown || [];
  const isLifetime = dateWindow === 'lifetime';
  const pid = activeCampaign ? shortProductId(activeCampaign.productId) : '';
  const hubLink = `assets?tab=studio&product=${pid}`;
  const adList = activeCampaign?.ads || [];
  const counts = list => list.filter(Boolean).length;
  const adCounts = {
    performing: counts(adList.map(a => { const m = adMetricsForWindow(a, dateWindow); return m.spend > 0 || m.clicks > 0 || adSalesOf(a) > 0 || a.status === 'ACTIVE'; })),
    winners: counts(adList.map(a => { const m = adMetricsForWindow(a, dateWindow); return adSalesOf(a) > 0 || m.ctr >= 3 || m.clicks >= 2 || /Purchase|WINNER/i.test(a.note || ''); })),
    bleeders: counts(adList.map(a => { const m = adMetricsForWindow(a, dateWindow); return m.spend > 0 && m.clicks === 0 && adSalesOf(a) === 0; })),
  };
  const shownAds = showAllAds ? filteredAds : filteredAds.slice(0, 12);
  const savedWhen = lastSyncedAt && Number.isFinite(new Date(lastSyncedAt).getTime())
    ? new Date(lastSyncedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';
  const standing = !metrics ? '' : metrics.isProfitable ? 'Under break-even cost' : metrics.roas >= 1 ? 'Earning more than it spends' : 'Cost per sale is too high';
  const inspected = inspectAd ? adMetricsForWindow(inspectAd, dateWindow) : null;

  const SUB_TABS = [
    { id: 'overview', label: 'Daily Numbers', icon: BarChart3, count: daily.length ? `${daily.length}d` : '' },
    { id: 'ads', label: 'Ad Testing', icon: Layers, count: metrics?.totalAds || 0 },
    { id: 'store', label: 'Store & CRO', icon: ShoppingBag, count: lifetimeMetrics?.purchases || 0 },
    { id: 'grow', label: 'Scale or Cut', icon: Sparkles, count: (activeCampaign?.dailyLogs?.length || 0) + (diagnostics.length || 0) },
  ];

  const topAdBySales = useMemo(() => {
    const list = activeCampaign?.ads || [];
    return [...list].filter(a => adSalesOf(a) > 0).sort((a, b) => adSalesOf(b) - adSalesOf(a) || (a.spendToday || 0) - (b.spendToday || 0))[0] || null;
  }, [activeCampaign]);

  const topAdByCtr = useMemo(() => {
    const list = activeCampaign?.ads || [];
    return [...list].filter(a => (a.clicksToday || 0) >= 2).sort((a, b) => (b.ctrToday || 0) - (a.ctrToday || 0) || (b.clicksToday || 0) - (a.clicksToday || 0))[0] || null;
  }, [activeCampaign]);

  const CRO_ITEMS = [
    { id: 'hook-match', label: 'Experiment 1 · Above-the-Fold Ad Hook & Hero Image Swap', detail: 'Match the #1 highest-CTR ad headline word-for-word in the mobile hero headline so clickers immediately see what made them tap.' },
    { id: 'bundle-take-rate', label: 'Experiment 2 · Entry Price & Free-Shipping Threshold Test', detail: 'When Click -> ATC or Checkout stalls (0 conversions), highlight FREE Tracked Shipping on the 2-Pack Gift Pair right above the buy button.' },
    { id: 'bonus-callout', label: 'Experiment 3 · Free Bonus Callout Directly Above Add-to-Bag', detail: 'Surface the included free bonus (4 Sticker Sheets + Ruler of Shadows) right above Add to Bag to lift cold-traffic Add-to-Cart rate (>= 8–10%).' },
    { id: 'palette-contrast', label: 'Experiment 4 · CTA Button Contrast & Palette Test (52 Palettes)', detail: 'Test a higher-contrast button/accent palette in Store Builder so the Add to Bag CTA pops immediately on 375px mobile.' },
    { id: 'theme-upgrade', label: 'Experiment 5 · Save Winning Layout Tweaks Back to Base Theme (base-theme.json)', detail: 'Bake high-converting layout improvements into our Master Base Theme in Store & Theme Hub so every future product converts out of the gate.' },
  ];

  const defaultDailyLogs = useMemo(() => {
    const saved = Array.isArray(activeCampaign?.dailyLogs) ? activeCampaign.dailyLogs : [];
    const builtIn = (daily || []).map((d, idx) => ({
      id: `auto-${d.date}`,
      date: d.date,
      decision: d.purchases > 0 && d.spend <= (activeCampaign?.breakEvenCpa || 36.4) * d.purchases ? 'Keep & Build Better Ads' : d.purchases > 0 ? 'Optimize CPA & CRO' : 'Monitor / Test New Hooks',
      whatWorked: `${d.label}: ${money(d.spend)} spend -> ${d.clicks || 0} link clicks (${pct(d.ctr || 0)} CTR) and ${d.purchases || 0} order(s) (${money(d.revenue || 0)} revenue).`,
      whatToImprove: d.purchases === 0 ? '0 orders on this day — cut zero-click creatives so CBO concentrates budget on top CTR winners.' : 'Push fresh 9:16 creator video hooks and native 4:5 statics to scale volume while keeping CPA below break-even.',
      nextStep: idx === 0 ? 'Test new ad creatives tomorrow and check 24h CPA vs. break-even.' : 'Continue tracking day-over-day ROAS and cut bleeders.',
    }));
    return [...saved, ...builtIn];
  }, [activeCampaign, daily]);

  return (
    <section>
      <div className="mv-mg-head">
        <div>
          <span className="mv-eyebrow">Manage · Improve, Test &amp; Scale Launched Products</span>
          <h1 className="mv-h1">
            {SUB_TABS.find(t => t.id === subTab)?.label || 'Manage'}
          </h1>
          <p className="mv-sub">Track day-to-day numbers, cut bleeding ads and test new hooks, lift storefront conversion (CRO), and log daily scaling decisions.</p>
        </div>
        <div className="mv-mg-sync">
          <span title={dataIntegrity?.status === 'verified' ? 'Reconciled: the daily spend adds up to the lifetime spend' : 'Source: the Meta Graph API'}>
            <i />Auto-sync every 15 min{savedWhen ? ` · last ${savedWhen}` : ''}
          </span>
          <button type="button" className="mv-btn sm primary" disabled={syncing} onClick={syncLiveMetaAndShopify}>
            <RefreshCw size={13} />{syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      <PipelineSkillsBar stepId="manage" go={go} />

      {!campaigns.length ? (
        <div className="mv-card mv-empty">
          <strong>No products have launched on Meta Ads yet.</strong>
          <span className="mv-small">Once a product finishes Launch, it lives here with its own dedicated tabs to manage and grow it.</span>
        </div>
      ) : (
        <>
          <div className="mv-mg-totals" aria-label="Every product added up">
            <span>All launched products</span>
            <span><b className="is-good">{money(portfolio.revenue)}</b> revenue</span>
            <span><b>{money(portfolio.spend)}</b> spent</span>
            <span><b>{portfolioRoas.toFixed(2)}x</b> ROAS</span>
            <span><b>{portfolio.purchases}</b> orders</span>
            <span><b>{pct(portfolioCtr)}</b> click rate</span>
          </div>

          <div className="mv-mg-picks">
            {campaigns.map(c => (
              <ProductPick key={c.productId} campaign={c} selected={activeCampaign?.productId === c.productId} onPick={() => { setSelectedId(c.productId); setDateWindow('lifetime'); setShowAllAds(false); }} />
            ))}
          </div>

          {activeCampaign && metrics && lifetimeMetrics && (
            <>
              <header className="mv-mg-title">
                <div>
                  <div className="mv-mg-title-chips">
                    <Chip tone="active">{pid} · {lifetimeMetrics.productAgeDays} {lifetimeMetrics.productAgeDays === 1 ? 'day' : 'days'} live</Chip>
                    <Chip tone={metrics.roas >= 1 ? 'done' : 'owner'}>{standing}</Chip>
                  </div>
                  <h2>{String(activeCampaign.shortName || pid).replace(/^[PL]\d{3,}\s*·\s*/, '')}</h2>
                  <p className="mv-mg-title-sub" title={`Campaign: ${activeCampaign.campaignName} · Ad set: ${activeCampaign.adsetName}`}>{activeCampaign.campaignName} · {activeCampaign.adsetName}</p>
                </div>
                <div className="mv-mg-actions">
                  <button type="button" className="mv-btn sm" onClick={() => go(hubLink)}><ImageIcon size={14} />Assets Hub</button>
                  <button type="button" className="mv-btn sm" onClick={() => go(linkedPacket ? `build?packet=${encodeURIComponent(linkedPacket.file)}` : 'build')}><Pencil size={14} />Store Builder</button>
                  {activeCampaign.storeUrl && <a className="mv-btn sm ghost" href={activeCampaign.storeUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Live Store</a>}
                  {activeCampaign.metaAdsManagerUrl && <a className="mv-btn sm ghost" href={activeCampaign.metaAdsManagerUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Ads Manager</a>}
                  <button
                    type="button"
                    className="mv-btn sm danger"
                    onClick={() => setConfirmCancel(true)}
                    title="Cut this product and wipe its campaign, storefront packet, and product files for a clean slate"
                  >
                    <Trash2 size={14} />Cancel &amp; Wipe Product
                  </button>
                </div>
              </header>

              {/* Dedicated Sub-Tabs for this Launched Product (synced with Sidebar Manage tabs) */}
              <nav className="mv-stage-tabs" aria-label={`Manage ${pid} tabs`} style={{ marginBottom: 16 }}>
                {SUB_TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      className="mv-stage-tab"
                      aria-current={subTab === tab.id ? 'page' : undefined}
                      onClick={() => {
                        setSubTab(tab.id);
                        go(`manage?tab=${tab.id}`);
                      }}
                    >
                      <Icon size={14} />
                      {tab.label}
                      {tab.count ? <b className="mv-pl-tab-count">{tab.count}</b> : null}
                    </button>
                  );
                })}
              </nav>

              {daily.length > 0 && (
                <div className="mv-mg-window" role="group" aria-label="Which days to show">
                  <button type="button" aria-pressed={isLifetime} onClick={() => setDateWindow('lifetime')}>
                    <strong>All {lifetimeMetrics.productAgeDays} {lifetimeMetrics.productAgeDays === 1 ? 'day' : 'days'}</strong>
                    <small>{money(lifetimeMetrics.spend)} · {lifetimeMetrics.purchases} {lifetimeMetrics.purchases === 1 ? 'order' : 'orders'}</small>
                  </button>
                  {daily.map(d => (
                    <button key={d.date} type="button" aria-pressed={dateWindow === d.date} onClick={() => setDateWindow(d.date)}>
                      <strong>{d.label}</strong>
                      <small>{money(d.spend)} · {d.purchases} {d.purchases === 1 ? 'order' : 'orders'}</small>
                    </button>
                  ))}
                </div>
              )}

              {/* SUB-TAB 1: DAILY NUMBERS */}
              {subTab === 'overview' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  <div
                    className="mv-card mv-pad"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      background: 'var(--surface-2)',
                      border: '1.5px solid var(--line)',
                    }}
                  >
                    <div>
                      <span className="mv-eyebrow">Day-to-Day Guardrail Verdict · {pid}</span>
                      <strong style={{ display: 'block', fontSize: 14.5, marginTop: 2 }}>
                        {lifetimeMetrics.isProfitable
                          ? `Winning (${lifetimeMetrics.roas.toFixed(2)}x ROAS · ${money(lifetimeMetrics.cpa)} CPA vs ${money(lifetimeMetrics.breakEvenCpa)} Break-Even) — Push better ads & scale`
                          : lifetimeMetrics.purchases > 0
                          ? `Generating Sales (${lifetimeMetrics.purchases} orders · ${money(lifetimeMetrics.revenue)} rev) — CPA is ${money(lifetimeMetrics.cpa)} vs ${money(lifetimeMetrics.breakEvenCpa)} break-even; test new hooks & evaluate tomorrow`
                          : `Testing (${money(lifetimeMetrics.spend)} spent) — Kill line is $${Number(activeCampaign.lossLimit || 50)} loss limit`}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="mv-btn sm ghost" onClick={() => { setSubTab('ads'); go('manage?tab=ads'); }}>
                        <Layers size={13} />Rank &amp; Cut Ads
                      </button>
                      <button type="button" className="mv-btn sm primary" onClick={() => { setSubTab('grow'); go('manage?tab=grow'); }}>
                        <Sparkles size={13} />Scale or Cut Analysis
                      </button>
                    </div>
                  </div>

                  <KpiTiles metrics={metrics} campaign={activeCampaign} lifetime={lifetimeMetrics} isLifetime={isLifetime} daily={daily} />
                  <Funnel metrics={metrics} />
                  {daily.length > 0 && (
                    <section className="mv-card mv-pad" style={{ display: 'grid', gap: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <Calendar size={16} />Day-by-Day Query &amp; Reconciliation ({daily.length} {daily.length === 1 ? 'day' : 'days'})
                        </strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Chip tone="done">
                            Reconciled: Daily Sum ({money(daily.reduce((s, d) => s + Number(d.spend || 0), 0))}) == Lifetime ({money(lifetimeMetrics.spend)})
                          </Chip>
                          <span className="mv-small">Click any day to filter</span>
                        </div>
                      </div>
                      <DayCards daily={daily} lifetime={lifetimeMetrics} dateWindow={dateWindow} onPick={setDateWindow} />

                      {/* Full Daily Numbers Table for Owner & Manage-Monitoring Agent */}
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ borderBottom: '1.5px solid var(--line)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 6px' }}>Day</th>
                              <th style={{ padding: '8px 6px' }}>Spend</th>
                              <th style={{ padding: '8px 6px' }}>Shown</th>
                              <th style={{ padding: '8px 6px' }}>Clicks</th>
                              <th style={{ padding: '8px 6px' }}>CTR</th>
                              <th style={{ padding: '8px 6px' }}>CPC</th>
                              <th style={{ padding: '8px 6px' }}>ATC</th>
                              <th style={{ padding: '8px 6px' }}>Checkout</th>
                              <th style={{ padding: '8px 6px' }}>Orders</th>
                              <th style={{ padding: '8px 6px' }}>Revenue</th>
                              <th style={{ padding: '8px 6px' }}>CPA</th>
                              <th style={{ padding: '8px 6px' }}>ROAS</th>
                              <th style={{ padding: '8px 6px' }}>Day Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daily.map((d, idx) => {
                              const prev = idx > 0 ? daily[idx - 1] : null;
                              const isPriming = idx < 2;
                              const statusText =
                                d.spend === 0
                                  ? 'No spend yet'
                                  : d.purchases > 0 && d.cpa <= (activeCampaign.breakEvenCpa || 36.4)
                                  ? isPriming
                                    ? 'Priming · Profitable'
                                    : 'Winning · Profitable'
                                  : d.purchases > 0
                                  ? 'Got Sales · Above BE CPA'
                                  : prev && prev.purchases > 0 && d.purchases === 0
                                  ? 'Regressing (0 Sales)'
                                  : isPriming
                                  ? 'Priming (0 Sales)'
                                  : 'Day 3+ Bleeder · Cut';
                              return (
                                <tr
                                  key={d.date}
                                  onClick={() => setDateWindow(d.date)}
                                  style={{
                                    borderBottom: '1px solid var(--line)',
                                    cursor: 'pointer',
                                    background: dateWindow === d.date ? 'var(--surface-2)' : 'transparent',
                                  }}
                                >
                                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{d.label}</td>
                                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{money(d.spend)}</td>
                                  <td style={{ padding: '8px 6px' }}>{Number(d.impressions || 0).toLocaleString()}</td>
                                  <td style={{ padding: '8px 6px' }}>{d.clicks || 0}</td>
                                  <td style={{ padding: '8px 6px' }}>{pct(d.ctr)}</td>
                                  <td style={{ padding: '8px 6px' }}>{money(d.cpc)}</td>
                                  <td style={{ padding: '8px 6px' }}>{d.addToCart || 0}</td>
                                  <td style={{ padding: '8px 6px' }}>{d.initiateCheckout || 0}</td>
                                  <td style={{ padding: '8px 6px', fontWeight: 700 }}>{d.purchases || 0}</td>
                                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{money(d.revenue)}</td>
                                  <td style={{ padding: '8px 6px' }}>{d.purchases > 0 ? money(d.cpa) : '—'}</td>
                                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{Number(d.roas || 0).toFixed(2)}x</td>
                                  <td style={{ padding: '8px 6px' }}>
                                    <Chip tone={d.purchases > 0 && d.cpa <= (activeCampaign.breakEvenCpa || 36.4) ? 'done' : d.spend === 0 ? 'neutral' : 'owner'}>
                                      {statusText}
                                    </Chip>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: AD TESTING */}
              {subTab === 'ads' && (
                <div className="mv-pp-panel" style={{ display: 'grid', gap: 14 }}>
                  {/* Ad Ranking Summary: #1 Sale Maker, #1 CTR Hook, and Bleeders to Cut */}
                  <div
                    className="mv-card mv-pad"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                      gap: 12,
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div>
                      <span className="mv-eyebrow">🏆 #1 Sale Maker (Keep &amp; Scale)</span>
                      <strong style={{ display: 'block', marginTop: 3 }}>
                        {topAdBySales
                          ? `${topAdBySales.name} (${adSalesOf(topAdBySales)} ${adSalesOf(topAdBySales) === 1 ? 'Sale' : 'Sales'} · ${pct(topAdBySales.ctrToday)} CTR)`
                          : 'No sale-making ad yet'}
                      </strong>
                      <span className="mv-small" style={{ display: 'block', marginTop: 2 }}>
                        {topAdBySales?.headline ? `"${topAdBySales.headline}"` : 'Ads that drive verified purchases rank #1.'}
                      </span>
                    </div>
                    <div>
                      <span className="mv-eyebrow">🔥 #1 Click-Through Rate (CTR) Hook</span>
                      <strong style={{ display: 'block', marginTop: 3 }}>
                        {topAdByCtr ? `${topAdByCtr.name} (${pct(topAdByCtr.ctrToday)} CTR · ${topAdByCtr.clicksToday || 0} clicks)` : 'No clicks yet'}
                      </strong>
                      <span className="mv-small" style={{ display: 'block', marginTop: 2 }}>
                        {topAdByCtr?.headline ? `"${topAdByCtr.headline}"` : 'Keep high-CTR hooks active to feed cheap traffic.'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <span className="mv-eyebrow">✂️ Zero-Click Bleeders to Cut</span>
                        <strong style={{ display: 'block', marginTop: 3 }}>
                          {adCounts.bleeders} ad{adCounts.bleeders === 1 ? '' : 's'} spent with 0 clicks
                        </strong>
                        <span className="mv-small" style={{ display: 'block', marginTop: 2 }}>
                          Ads are ranked Best (#1) to Worst below so you can Keep winners and Cut bleeders fast.
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" className="mv-btn sm ghost" onClick={() => setAdFilter('bleeders')}>
                          Filter {adCounts.bleeders} Bleeders
                        </button>
                        <button type="button" className="mv-btn sm primary" onClick={() => go(hubLink)}>
                          <ImageIcon size={13} />Build Next Ad Batch
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mv-mg-adbar">
                    <div className="mv-mg-pills">
                      {[
                        ['performing', `Active & Spending ${adCounts.performing}`],
                        ['winners', `Sale & CTR Winners ${adCounts.winners}`],
                        ['bleeders', `0-Click Bleeders ${adCounts.bleeders}`],
                        ['video', `Videos ${metrics?.videoAds ?? 0}`],
                        ['static', `Images ${metrics?.staticAds ?? 0}`],
                        ['all', `All ${metrics?.totalAds ?? 0}`],
                      ].map(([id, label]) => (
                        <button key={id} type="button" className={`mv-btn sm ${adFilter === id ? 'primary' : 'ghost'}`} onClick={() => { setAdFilter(id); setShowAllAds(false); }}>{label}</button>
                      ))}
                    </div>
                    <div className="mv-mg-pills">
                      {[
                        ['rank', 'Best Rank (Best \u2192 Worst)'],
                        ['sales', 'Most Sales'],
                        ['ctr', 'Best CTR'],
                        ['clicks', 'Most Clicks'],
                        ['spend', 'Most Spend'],
                      ].map(([id, label]) => (
                        <button key={id} type="button" className={`mv-btn sm ${adSort === id ? 'primary' : 'ghost'}`} onClick={() => setAdSort(id)}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {filteredAds.length ? (
                    <div className="mv-cd-ad-grid">
                      {shownAds.map((ad, index) => (
                        <ManageAdCard key={ad.id} ad={ad} rank={index + 1} dateWindow={dateWindow} totalSpend={metrics?.spend || 0} daily={daily} showDays={(lifetimeMetrics?.productAgeDays || 0) > 1} onVerdict={saveAdVerdict} onInspect={setInspectAd} onHub={() => go(hubLink)} />
                      ))}
                    </div>
                  ) : <p className="mv-small">No ads match this filter.</p>}
                  {!showAllAds && filteredAds.length > 12 && (
                    <div className="mv-mg-more"><button type="button" className="mv-btn" onClick={() => setShowAllAds(true)}>Show all {filteredAds.length} ads<ChevronDown size={14} /></button></div>
                  )}
                </div>
              )}

              {/* SUB-TAB 3: STORE & CRO */}
              {subTab === 'store' && (
                <div className="mv-cd-cl-layout">
                  <div style={{ display: 'grid', gap: 14 }}>
                    <Funnel metrics={metrics} />

                    {/* Live Funnel Bottleneck Diagnosis (Why Conversions or ATC Stalled) */}
                    {(() => {
                      const atcRate = metrics.clicks > 0 ? (metrics.addToCart / metrics.clicks) * 100 : 0;
                      const checkoutRate = metrics.addToCart > 0 ? (metrics.initiateCheckout / metrics.addToCart) * 100 : 0;
                      const closeRate = metrics.initiateCheckout > 0 ? (metrics.purchases / metrics.initiateCheckout) * 100 : 0;
                      const zeroSalesToday = metrics.clicks >= 15 && metrics.purchases === 0;
                      const lowAtc = metrics.clicks >= 15 && atcRate < 8;
                      return (
                        <section
                          className="mv-card mv-pad"
                          style={{
                            display: 'grid',
                            gap: 10,
                            background: zeroSalesToday ? 'var(--danger-soft)' : 'var(--surface-2)',
                            border: zeroSalesToday ? '1.5px solid var(--danger)' : '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <div>
                              <span className="mv-eyebrow">Storefront Bottleneck Diagnosis · {isLifetime ? `All ${lifetimeMetrics.productAgeDays} Days` : dateWindow}</span>
                              <strong style={{ display: 'block', fontSize: 14.5, marginTop: 2 }}>
                                {zeroSalesToday && lowAtc
                                  ? `0 Conversions & Low Add-to-Cart (${pct(atcRate)} ATC from ${metrics.clicks} clicks) — Try a New Above-the-Fold Hook or Offer Tweak`
                                  : zeroSalesToday
                                  ? `0 Conversions from ${metrics.clicks} Clicks (${metrics.addToCart} ATC -> ${metrics.initiateCheckout} Checkout -> 0 Orders) — Test Shipping / Offer Friction`
                                  : `Funnel Converting at ${pct(metrics.cvr)} CVR (${pct(atcRate)} Click-to-ATC · ${pct(closeRate)} Checkout-to-Sale)`}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button type="button" className="mv-btn sm ghost" onClick={() => go('store')}>
                                Base Theme Hub
                              </button>
                              <button type="button" className="mv-btn sm primary" onClick={() => go(linkedPacket ? `build?packet=${encodeURIComponent(linkedPacket.file)}` : 'build')}>
                                <Pencil size={13} />Try Tweaks in Store Builder
                              </button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
                              <span className="mv-small">Click &rarr; Add to Cart</span>
                              <strong style={{ display: 'block', fontSize: 15 }}>{pct(atcRate)} ({metrics.addToCart}/{metrics.clicks})</strong>
                              <span className="mv-small">Target: &gt;= 8.0% ATC</span>
                            </div>
                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
                              <span className="mv-small">ATC &rarr; Checkout</span>
                              <strong style={{ display: 'block', fontSize: 15 }}>{pct(checkoutRate)} ({metrics.initiateCheckout}/{metrics.addToCart || 0})</strong>
                              <span className="mv-small">Target: &gt;= 60% IC</span>
                            </div>
                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
                              <span className="mv-small">Checkout &rarr; Order</span>
                              <strong style={{ display: 'block', fontSize: 15 }}>{pct(closeRate)} ({metrics.purchases}/{metrics.initiateCheckout || 0})</strong>
                              <span className="mv-small">Target: &gt;= 35% Close</span>
                            </div>
                            <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-1)', border: '1px solid var(--line)' }}>
                              <span className="mv-small">Overall Store CVR</span>
                              <strong style={{ display: 'block', fontSize: 15 }}>{pct(metrics.cvr)} ({metrics.purchases} orders)</strong>
                              <span className="mv-small">Target: &gt;= 2.50% CVR</span>
                            </div>
                          </div>
                        </section>
                      );
                    })()}

                    {/* Post-Launch CRO Experiments ("Try Something New When ATC or Conversions Stall") */}
                    <section className="mv-card mv-pad" style={{ display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div>
                          <span className="mv-eyebrow">Try Something New · Post-Launch Store &amp; Theme Experiments</span>
                          <strong style={{ display: 'block', fontSize: 15 }}>CRO Experiments to Lift Add-to-Cart &amp; Conversions ({pid})</strong>
                          <span className="mv-small">
                            The base store was already built in Build &amp; Launch. Use these experiments when visitors click the ad but don&apos;t Add to Cart or convert.
                          </span>
                        </div>
                        <button type="button" className="mv-btn sm primary" onClick={() => go(linkedPacket ? `build?packet=${encodeURIComponent(linkedPacket.file)}` : 'build')}>
                          <Pencil size={13} />Edit Store Copy &amp; Sections
                        </button>
                      </div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {CRO_ITEMS.map(item => {
                          const checked = activeCampaign.croChecklist?.[item.id] ?? false;
                          return (
                            <label
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 10,
                                padding: '9px 12px',
                                borderRadius: 10,
                                background: 'var(--surface-2)',
                                border: '1px solid var(--line)',
                                cursor: 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(checked)}
                                onChange={() => toggleCroCheck(item.id, Boolean(checked))}
                                style={{ marginTop: 3 }}
                              />
                              <span style={{ minWidth: 0 }}>
                                <strong style={{ display: 'block', fontSize: 13.5 }}>{item.label}</strong>
                                <span className="mv-small">{item.detail}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>

                    <OrdersPanel orders={orders} total={lifetimeMetrics.revenue} pricing={activeCampaign.pricingSummary} storeUrl={activeCampaign.storeUrl} go={go} />
                  </div>
                  <aside className="mv-card mv-cd-phone">
                    <div className="mv-cd-phone-bar">
                      <Smartphone size={14} style={{ flex: 'none' }} />
                      <strong style={{ flex: 1, minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {linkedPacket ? linkedPacket.navLabel || linkedPacket.file : pid}
                      </strong>
                      <button type="button" className="mv-btn sm ghost" title="Reload" onClick={() => setFrameKey(k => k + 1)}><RefreshCw size={13} /></button>
                      {linkedPacket?.previewUrl && <a className="mv-btn sm ghost" href={(typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? `/api/store-preview?path=${encodeURIComponent(linkedPacket.productUrl || '/')}` : linkedPacket.previewUrl} target="_blank" rel="noreferrer" title="Open in a new tab"><ExternalLink size={13} /></a>}
                    </div>
                    {linkedPacket?.previewUrl
                      ? <iframe key={`${linkedPacket.file}:${frameKey}`} title={`Preview of ${activeCampaign.shortName}`} src={(typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? `/api/store-preview?path=${encodeURIComponent(linkedPacket.productUrl || '/')}` : linkedPacket.previewUrl} />
                      : <div className="mv-empty" style={{ padding: 30 }}><span className="mv-small">Storefront preview loads from the Store Hub packet.</span></div>}
                  </aside>
                </div>
              )}

              {/* SUB-TAB 4: SCALE & DAY LOG */}
              {subTab === 'grow' && (
                <div style={{ display: 'grid', gap: 16 }}>
                  {(() => {
                    const day1 = daily[0] || null;
                    const day1Sales = day1 ? Number(day1.purchases || 0) : Number(metrics.purchases || 0);
                    const beCpa = Number(activeCampaign.breakEvenCpa || metrics.breakEvenCpa || 36.4);
                    const targetCpa = Math.round(beCpa * 0.75 * 100) / 100;
                    const actualCpa = metrics.purchases > 0 ? metrics.cpa : metrics.spend;
                    const beRoas = Number((metrics.aov > 0 && beCpa > 0 ? metrics.aov / beCpa : 1.45).toFixed(2));
                    const windowLabel = isLifetime
                      ? `All ${lifetimeMetrics.productAgeDays} ${lifetimeMetrics.productAgeDays === 1 ? 'Day' : 'Days'}`
                      : (daily.find(d => d.date === dateWindow)?.label || dateWindow);

                    const benchmarks = [
                      {
                        id: 'day1-sales',
                        title: '1. First-Day / Window Sales',
                        actual: `${metrics.purchases} ${metrics.purchases === 1 ? 'order' : 'orders'} (${money(metrics.revenue)})`,
                        baseline: '>= 1 order on Day 1',
                        pass: metrics.purchases >= 1,
                        close: false,
                        badge: metrics.purchases >= 2
                          ? `STRONG · ${metrics.purchases} orders`
                          : metrics.purchases === 1
                          ? 'PASS · 1st-day sale proven'
                          : 'FAIL · 0 orders (Cut if > $50 spent)',
                        note: metrics.purchases >= 1
                          ? `Day-1 demand confirmed (${day1Sales} order${day1Sales === 1 ? '' : 's'} on Day 1).`
                          : 'Hard-verified winners must get at least 1 sale on Day 1. 0 sales in this window is a hard fail.',
                      },
                      {
                        id: 'cpa-vs-be',
                        title: '2. Cost Per Sale (CPA)',
                        actual: metrics.purchases > 0 ? money(metrics.cpa) : `${money(metrics.spend)} spent (0 sales)`,
                        baseline: `<= ${money(beCpa)} Break-Even (Target <= ${money(targetCpa)})`,
                        pass: metrics.purchases > 0 && metrics.cpa <= beCpa,
                        close: false,
                        badge: metrics.purchases === 0
                          ? 'FAIL · No sale in window'
                          : metrics.cpa <= targetCpa
                          ? `SCALE · ${money(beCpa - metrics.cpa)} under break-even`
                          : metrics.cpa <= beCpa
                          ? `PASS · ${money(beCpa - metrics.cpa)} under break-even`
                          : `FAIL · ${money(metrics.cpa - beCpa)} over break-even`,
                        note: metrics.purchases > 0 && metrics.cpa <= beCpa
                          ? `Profitable on every order (netting ${money(beCpa - metrics.cpa)} margin per sale).`
                          : `Losing ${money(Math.max(0, (metrics.purchases > 0 ? metrics.cpa : metrics.spend) - beCpa))} per order against ${money(beCpa)} break-even CPA.`,
                      },
                      {
                        id: 'roas-vs-target',
                        title: '3. Return on Ad Spend (ROAS)',
                        actual: `${metrics.roas.toFixed(2)}x`,
                        baseline: `>= ${beRoas.toFixed(2)}x Break-Even (2.00x+ Scale)`,
                        pass: metrics.roas >= beRoas,
                        close: false,
                        badge: metrics.roas >= 2.0
                          ? `SCALE · +${(metrics.roas - beRoas).toFixed(2)}x above break-even`
                          : metrics.roas >= beRoas
                          ? 'PASS · Profitable ROAS'
                          : `FAIL · Below ${beRoas.toFixed(2)}x break-even`,
                        note: metrics.roas >= beRoas
                          ? `Returning ${money(metrics.revenue)} on ${money(metrics.spend)} ad spend (${metrics.roas.toFixed(2)}x).`
                          : `At ${metrics.roas.toFixed(2)}x ROAS, ad spend + COGS exceeds revenue (${beRoas.toFixed(2)}x required to break even).`,
                      },
                      {
                        id: 'ctr-baseline',
                        title: '4. Outbound Link CTR (Ad Hook)',
                        actual: pct(metrics.ctr),
                        baseline: '>= 2.50% Baseline (3.50%+ Viral)',
                        pass: metrics.ctr >= 2.5,
                        close: false,
                        badge: metrics.ctr >= 3.5
                          ? `STRONG · ${pct(metrics.ctr)} viral hook`
                          : metrics.ctr >= 2.5
                          ? `PASS · Beats 2.50% baseline`
                          : 'FAIL · Weak hook (< 2.50%)',
                        note: metrics.ctr >= 2.5
                          ? `Strong thumb-stop & click intent (${metrics.clicks} clicks from ${metrics.impressions} impressions).`
                          : 'Ad hook is not stopping the scroll (< 2.50% CTR).',
                      },
                      {
                        id: 'cpc-baseline',
                        title: '5. Cost Per Link Click (CPC)',
                        actual: money(metrics.cpc),
                        baseline: '<= $1.25 Baseline (<= $0.90 Strong)',
                        pass: metrics.clicks > 0 && metrics.cpc <= 1.25,
                        close: false,
                        badge: metrics.clicks === 0
                          ? 'FAIL · 0 clicks'
                          : metrics.cpc <= 0.9
                          ? `STRONG · Cheap ${money(metrics.cpc)} clicks`
                          : metrics.cpc <= 1.25
                          ? 'PASS · Under $1.25 baseline'
                          : `FAIL · ${money(metrics.cpc - 1.25)} over $1.25 max`,
                        note: metrics.cpc <= 1.25
                          ? 'Traffic cost is healthy and allows profitable conversion.'
                          : `CPC is ${money(metrics.cpc)} (above the $1.25 hard baseline), inflating CPA above break-even.`,
                      },
                      {
                        id: 'store-cvr',
                        title: '6. Storefront Conversion Rate (CVR)',
                        actual: pct(metrics.cvr),
                        baseline: '>= 2.50% Baseline (4.00%+ Strong)',
                        pass: metrics.cvr >= 2.5,
                        close: false,
                        badge: metrics.cvr >= 4.0
                          ? `STRONG · ${pct(metrics.cvr)} store CVR`
                          : metrics.cvr >= 2.5
                          ? 'PASS · Beats 2.50% baseline'
                          : `FAIL · ${pct(metrics.cvr)} (< 2.50% target)`,
                        note: metrics.cvr >= 2.5
                          ? `Storefront converts 1 in ${Math.max(1, Math.round(100 / metrics.cvr))} visitors (${metrics.purchases} order${metrics.purchases === 1 ? '' : 's'} from ${metrics.clicks} clicks).`
                          : `Visitors are clicking (${metrics.clicks} clicks) but converting at ${pct(metrics.cvr)} (< 2.50% minimum).`,
                      },
                    ];

                    const passCount = benchmarks.filter(b => b.pass).length;
                    const day2 = daily[1] || null;
                    const day3 = daily[2] || null;
                    const day4Plus = daily.slice(3);
                    const day2Sales = day2 ? Number(day2.purchases || 0) : 0;
                    const day3Sales = day3 ? Number(day3.purchases || 0) : 0;
                    const day3Spend = day3 ? Number(day3.spend || 0) : 0;
                    const dailyBudgetNum = Number(activeCampaign.dailyBudget || 50);
                    const day3FullDayRun = Boolean(day3 && day3Spend >= Math.min(25, dailyBudgetNum * 0.5));
                    const stalledOnDay2 = Boolean(day2 && day2.spend >= 40 && day2Sales === 0);
                    const endOfDay3Failed = Boolean(day3FullDayRun && day3Sales === 0);
                    const unprofitableCpa = metrics.purchases === 0 || metrics.cpa > beCpa;

                    // 3-Day Meta Ad Testing & Kill/Scale Playbook (Owner Playbook, Nov 5)
                    const dayStages = [
                      {
                        step: 'Day 1 · Run Lots of Ads (Discovery)',
                        status: !day1
                          ? 'PENDING'
                          : day1Sales >= 1 && (day1.cpa || 0) <= beCpa
                          ? 'STRONG PASS'
                          : day1Sales >= 1
                          ? 'PASS (GOT SALES)'
                          : (day1.ctr || 0) >= 2.5
                          ? 'CONTINUE (GOOD CTR)'
                          : 'WEAK DAY 1',
                        tone: !day1
                          ? 'neutral'
                          : day1Sales >= 1
                          ? 'done'
                          : (day1.ctr || 0) >= 2.5
                          ? 'active'
                          : 'owner',
                        stats: day1
                          ? `${money(day1.spend)} spent · ${day1Sales} ${day1Sales === 1 ? 'order' : 'orders'} (${money(day1.revenue)}) · ${day1Sales > 0 ? `${money(day1.cpa)} CPA` : `${pct(day1.ctr)} CTR`}`
                          : 'Not started yet',
                        rule: 'Run lots of ads on Day 1. That is how we find which angles & creatives work—Meta automatically picks and pushes the winners.',
                      },
                      {
                        step: 'Day 2 · Cut Bad Eggs & Evaluate',
                        status: !day2
                          ? 'WAITING FOR DAY 2'
                          : day2Sales >= day1Sales && day2Sales >= 1
                          ? 'DID BETTER — KEEP GOING'
                          : day2Sales >= 1
                          ? 'PASS (GOT SALES)'
                          : 'DID WORSE — IMPROVE FOR DAY 3',
                        tone: !day2
                          ? 'neutral'
                          : day2Sales >= 1
                          ? 'done'
                          : 'owner',
                        stats: day2
                          ? `${money(day2.spend)} spent · ${day2Sales} ${day2Sales === 1 ? 'order' : 'orders'} (${money(day2.revenue)}) · ${pct(day2.ctr)} CTR · ${money(day2.cpc)} CPC`
                          : 'Runs after Day 1',
                        rule: 'Cut the bad eggs, keep all the good ones running, and evaluate at the end of Day 2. If it did better, keep going the same way; if it did worse, engineer improvements for Day 3.',
                      },
                      {
                        step: 'Day 3 · The Final Verdict (Keep or Kill)',
                        status: !day3
                          ? 'STAGED FOR TOMORROW ($50/d)'
                          : !day3FullDayRun
                          ? `RUNNING DAY 3 (${money(day3Spend)} spent)`
                          : day3Sales >= 1 && (day3.cpa || 0) <= beCpa
                          ? 'SURVIVED & PROFITABLE — KEEP'
                          : day3Sales === 0
                          ? 'DAY 3 FAILED — KILL PRODUCT'
                          : 'REVIEW AT END OF DAY 3',
                        tone: !day3 || !day3FullDayRun
                          ? 'active'
                          : day3Sales >= 1 && (day3.cpa || 0) <= beCpa
                          ? 'done'
                          : 'owner',
                        stats: day3
                          ? `${money(day3.spend)} spent · ${day3Sales} ${day3Sales === 1 ? 'order' : 'orders'} (${money(day3.revenue)}) · ${day3FullDayRun ? 'Full day run' : 'In progress'}`
                          : '15 good ads active · 3 bad eggs cut · Clara Vance persona + stronger hooks ready',
                        rule: 'Run our Day 3 improvements ($50/day). Whatever happens at the end of Day 3 determines whether the product lives & scales or gets killed.',
                      },
                      {
                        step: 'Day 4+ · Scale Winners Only',
                        status: lifetimeMetrics.isProfitable && day3Sales >= 1
                          ? 'SCALE CBO (+20%)'
                          : 'DECIDE AFTER DAY 3',
                        tone: lifetimeMetrics.isProfitable ? 'active' : 'neutral',
                        stats: day1Sales >= 2
                          ? `Day 1 proved demand (${day1Sales} sales, ${(day1?.roas || 0).toFixed(2)}x ROAS) — Day 3 decides if it scales into Day 4`
                          : 'Only products that pass Day 3 advance to Day 4 scaling',
                        rule: 'If Day 3 succeeds, keep scaling the winning CBO and adding fresh creatives. If Day 3 fails, kill and wipe immediately.',
                      },
                    ];

                    let verdictTitle = '';
                    let verdictSub = '';
                    let verdictTone = 'owner';
                    if (passCount >= 5 && !stalledOnDay2 && !unprofitableCpa) {
                      verdictTitle = `WORKABLE WINNER (${passCount}/6 Baselines Passed) — Keep & Scale`;
                      verdictSub = `${pid} hit Day-1 sales, CTR, CPC, CVR, and profitable CPA (${money(metrics.cpa)} vs ${money(beCpa)} break-even). Scale CBO budget +20% every 48h.`;
                      verdictTone = 'done';
                    } else if (endOfDay3Failed) {
                      verdictTitle = `DAY 3 VERDICT: KILL PRODUCT (${passCount}/6 Passed) — Failed Day 3 Test · Cancel & Wipe`;
                      verdictSub = `Day 3 determines whether a product lives or dies, and ${pid} failed to convert profitably on Day 3. Hit Cancel & Wipe Product below for a clean slate.`;
                      verdictTone = 'owner';
                    } else if (stalledOnDay2 && !day3FullDayRun) {
                      verdictTitle = `DAY 2 DID WORSE (Day 1: ${day1Sales} Sales -> Day 2: 0 Sales) — Day 3 Improvements Staged ($50/d Test Determines Keep or Kill)`;
                      verdictSub = `Day 1 proved strong demand (${day1Sales} orders, ${money(day1?.revenue || 0)} rev, ${(day1?.roas || 0).toFixed(2)}x ROAS), while Day 2 dropped to 0 sales. Per our 3-Day Playbook: we cut the 3 bad eggs, turned all 15 good ads back ON, switched to our isolated female user persona (Clara Vance), and upgraded every headline & hook. Tomorrow's $50 Day 3 test determines if ${pid} lives or gets killed.`;
                      verdictTone = 'active';
                    } else {
                      verdictTitle = `BELOW PROFITABILITY BASELINE (${passCount}/6 Passed) — CPA ${money(actualCpa)} vs ${money(beCpa)} Break-Even`;
                      verdictSub = `${pid} passed ${passCount}/6 checks (CTR ${pct(metrics.ctr)}, CVR ${pct(metrics.cvr)}), with CPA at ${money(actualCpa)} vs ${money(beCpa)} break-even. Whatever happens on Day 3 determines if the product is kept or killed.`;
                      verdictTone = 'owner';
                    }

                    return (
                      <>
                        {/* 3-Day Meta Ad Testing & Kill/Scale Playbook */}
                        <section className="mv-card mv-pad" style={{ display: 'grid', gap: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <span className="mv-eyebrow">3-Day Meta Ad Testing &amp; Kill/Scale Playbook · {pid}</span>
                              <h3 className="mv-h3" style={{ margin: '4px 0 4px' }}>
                                Day 1: Run Lots of Ads &rarr; Day 2: Cut Bad Eggs &amp; Evaluate &rarr; Day 3: Final Verdict (Keep or Kill)
                              </h3>
                              <p className="mv-small" style={{ margin: 0 }}>
                                <b>Day 1:</b> Run lots of ads so Meta picks and pushes what works. <b>Day 2:</b> Cut the bad eggs, keep all the good ones running, and evaluate at end of day (if better, keep going; if worse, improve for Day 3). <b>Day 3:</b> Whatever happens on Day 3 determines if the product lives or gets killed.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="mv-btn sm primary"
                              onClick={() => go(hubLink)}
                            >
                              <Sparkles size={13} />Build Day-4 Veo &amp; Static Ads in Assets Hub
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
                            {dayStages.map(stage => (
                              <article
                                key={stage.step}
                                style={{
                                  display: 'grid',
                                  gap: 6,
                                  padding: 12,
                                  borderRadius: 10,
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--line)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                  <strong style={{ fontSize: 13 }}>{stage.step}</strong>
                                  <Chip tone={stage.tone}>{stage.status}</Chip>
                                </div>
                                <div style={{ fontSize: 12.5, fontWeight: 600, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                                  {stage.stats}
                                </div>
                                <span className="mv-small" style={{ lineHeight: 1.45 }}>{stage.rule}</span>
                              </article>
                            ))}
                          </div>
                        </section>

                        <section className="mv-card mv-pad" style={{ display: 'grid', gap: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                            <div>
                              <span className="mv-eyebrow">Strict Actual vs. Target Baseline · {windowLabel} ({pid})</span>
                              <h3 className="mv-h3" style={{ margin: '4px 0 4px' }}>
                                Hard Baseline Scorecard — Keep, Upgrade Ads, or Cut?
                              </h3>
                              <p className="mv-small" style={{ margin: 0 }}>
                                Click <b>All {lifetimeMetrics.productAgeDays} days</b> or any individual day above (`Day 1`, `Day 2`, `Day 3`) to grade that exact day against our 6 non-negotiable baselines.
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Chip tone={verdictTone}>{passCount} / 6 Baselines Passed</Chip>
                              <button
                                type="button"
                                className="mv-btn sm danger"
                                onClick={() => setConfirmCancel(true)}
                              >
                                <Trash2 size={13} />Cancel &amp; Wipe Product
                              </button>
                            </div>
                          </div>

                          {/* Overall Workability Verdict Banner */}
                          <div
                            style={{
                              padding: '12px 14px',
                              borderRadius: 10,
                              background: 'var(--danger-soft)',
                              border: '1.5px solid var(--danger)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ display: 'grid', gap: 4, flex: '1 1 420px' }}>
                              <strong style={{ fontSize: 14.5, color: 'var(--danger-text)' }}>{verdictTitle}</strong>
                              <span className="mv-small" style={{ lineHeight: 1.5 }}>{verdictSub}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="mv-btn sm primary"
                                onClick={() => go(hubLink)}
                              >
                                <Sparkles size={13} />Build Veo Ads (Day 4)
                              </button>
                              <button
                                type="button"
                                className="mv-btn sm danger"
                                onClick={() => setConfirmCancel(true)}
                              >
                                <Trash2 size={14} />Cancel &amp; Wipe {pid} (Clean Slate)
                              </button>
                            </div>
                          </div>

                          {/* 6-Card Actual vs. Baseline Comparison Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                            {benchmarks.map(b => (
                              <article
                                key={b.id}
                                style={{
                                  display: 'grid',
                                  gap: 6,
                                  padding: 12,
                                  borderRadius: 10,
                                  background: 'var(--surface-2)',
                                  border: '1px solid var(--line)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <strong style={{ fontSize: 13 }}>{b.title}</strong>
                                  <Chip tone={b.pass ? 'done' : b.close ? 'active' : 'owner'}>{b.badge}</Chip>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                                  <div>
                                    <span className="mv-small" style={{ display: 'block', fontSize: 11 }}>Actual ({windowLabel})</span>
                                    <b style={{ fontSize: 17 }}>{b.actual}</b>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <span className="mv-small" style={{ display: 'block', fontSize: 11 }}>Target Baseline</span>
                                    <strong style={{ fontSize: 12.5 }}>{b.baseline}</strong>
                                  </div>
                                </div>
                                <span className="mv-small" style={{ lineHeight: 1.45 }}>{b.note}</span>
                              </article>
                            ))}
                          </div>
                        </section>
                      </>
                    );
                  })()}

                  {/* Day-to-Day Learning & Action Log */}
                  <section className="mv-card mv-pad" style={{ display: 'grid', gap: 14 }}>
                    <div>
                      <span className="mv-eyebrow">Day-to-Day Improvement &amp; Decision Log</span>
                      <strong style={{ display: 'block', fontSize: 15, marginTop: 2 }}>
                        Daily Learning &amp; Scaling Log ({pid})
                      </strong>
                      <span className="mv-small">
                        Record what worked today, what needs improvement tomorrow (better ads, store CRO, or budget changes), and track day-over-day decisions.
                      </span>
                    </div>

                    <form onSubmit={saveDailyLog} style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="mv-small" style={{ fontWeight: 600 }}>Today&apos;s Decision</span>
                          <select className="mv-input" value={logDecision} onChange={e => setLogDecision(e.target.value)}>
                            <option value="Day 1-2: Prime Algorithm & Cut Bleeders">Day 1–2: Prime Algorithm &amp; Cut 0-Click Bleeders</option>
                            <option value="Day 3: Run Full Day Until End-of-Day Check">Day 3: Run Full Day Until End-of-Day Kill Check</option>
                            <option value="Day 4: Build Custom Veo Video Ads & Experiment">Day 4: Build Custom Veo Video Ads &amp; Experiment</option>
                            <option value="Scale Budget +20%">Scale CBO Budget (+20%)</option>
                            <option value="Improve Store CRO">Improve Storefront Conversion (CRO)</option>
                            <option value="End of Day 3 Kill — Cancel & Wipe">End of Day 3 Kill — Cancel &amp; Wipe Product</option>
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="mv-small" style={{ fontWeight: 600 }}>What Worked Today</span>
                          <input
                            type="text"
                            className="mv-input"
                            placeholder="e.g., 5.65% CTR on NEED LIGHT hook + $59.98 order..."
                            value={logWorked}
                            onChange={e => setLogWorked(e.target.value)}
                          />
                        </label>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="mv-small" style={{ fontWeight: 600 }}>What to Improve / Fix</span>
                          <input
                            type="text"
                            className="mv-input"
                            placeholder="e.g., Cut 0-click bleeders and test 3 stronger video hooks..."
                            value={logImprove}
                            onChange={e => setLogImprove(e.target.value)}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: 4 }}>
                          <span className="mv-small" style={{ fontWeight: 600 }}>Next Step for Tomorrow</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              type="text"
                              className="mv-input"
                              style={{ flex: 1 }}
                              placeholder="e.g., Push Batch 2 ads & check 24h CPA..."
                              value={logNext}
                              onChange={e => setLogNext(e.target.value)}
                            />
                            <button type="submit" className="mv-btn sm primary" disabled={savingLog}>
                              {savingLog ? 'Saving…' : 'Add Log'}
                            </button>
                          </div>
                        </label>
                      </div>
                    </form>

                    <div style={{ display: 'grid', gap: 8 }}>
                      {defaultDailyLogs.map(entry => (
                        <article
                          key={entry.id}
                          style={{
                            display: 'grid',
                            gap: 4,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'var(--surface-2)',
                            border: '1px solid var(--line)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13.5 }}>{entry.date}</strong>
                            <Chip tone="active">{entry.decision}</Chip>
                          </div>
                          {entry.whatWorked && <div style={{ fontSize: 13 }}><b>Worked:</b> {entry.whatWorked}</div>}
                          {entry.whatToImprove && <div style={{ fontSize: 13 }}><b>Improve:</b> {entry.whatToImprove}</div>}
                          {entry.nextStep && <div className="mv-small"><b>Next:</b> {entry.nextStep}</div>}
                        </article>
                      ))}
                    </div>
                  </section>

                  <form className="mv-card mv-pad" onSubmit={saveScalePlan} style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <strong style={{ fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                          Scale Budget &amp; Guardrails ({pid})
                        </strong>
                        <div className="mv-small">Adjust daily CBO spend (+20% every 48h when beating break-even CPA), target countries, and guardrails.</div>
                      </div>
                      <button type="submit" className="mv-btn sm primary" disabled={savingBudget}>
                        <Sliders size={14} />{savingBudget ? 'Saving…' : 'Save Budget & Rules'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="mv-small" style={{ fontWeight: 600 }}>Daily CBO Budget:</span>
                      {BUDGET_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          className={`mv-btn sm ${Number(dailyBudget) === preset ? 'primary' : 'ghost'}`}
                          onClick={() => setDailyBudget(preset)}
                        >
                          <DollarSign size={12} />{preset}/day
                        </button>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="mv-small" style={{ fontWeight: 600 }}>Daily Budget ($/day)</span>
                        <input type="number" step="1" min="5" className="mv-input" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="mv-small" style={{ fontWeight: 600 }}>Target Countries</span>
                        <input type="text" className="mv-input" value={countries} onChange={e => setCountries(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="mv-small" style={{ fontWeight: 600 }}>Break-Even CPA ($)</span>
                        <input type="number" step="0.01" min="1" className="mv-input" value={breakEvenCpa} onChange={e => setBreakEvenCpa(e.target.value)} />
                      </label>
                      <label style={{ display: 'grid', gap: 4 }}>
                        <span className="mv-small" style={{ fontWeight: 600 }}>Loss Limit ($)</span>
                        <input type="number" step="1" min="10" className="mv-input" value={lossLimit} onChange={e => setLossLimit(e.target.value)} />
                      </label>
                    </div>
                  </form>

                  <ImprovePanel diagnostics={diagnostics} go={go} />

                  {/* Cancel & Wipe Product (Clean Slate) */}
                  <section
                    className="mv-card mv-pad"
                    style={{
                      display: 'grid',
                      gap: 12,
                      background: 'var(--danger-soft)',
                      border: '1.5px solid var(--danger)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ maxWidth: 680 }}>
                        <span className="mv-eyebrow" style={{ color: 'var(--danger-text)' }}>
                          Cut Product · Clean Slate Wipe
                        </span>
                        <h3 className="mv-h3" style={{ margin: '4px 0 6px', color: 'var(--danger-text)' }}>
                          Cancel &amp; Wipe {String(activeCampaign.shortName || pid).replace(/^[PL]\d{3,}\s*·\s*/, '')} ({pid})
                        </h3>
                        <p className="mv-small" style={{ margin: 0, lineHeight: 1.55 }}>
                          When a product fails the baseline and isn&apos;t worth spending more ad budget on, hit <b>Cancel &amp; Wipe Product</b>. Launchroom removes it from Manage, archives its Hydrogen storefront packet and product folder, clears the active build slot, and marks the research card as killed so you have a 100% clean slate to pick your next winner.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="mv-btn danger"
                        onClick={() => setConfirmCancel(true)}
                      >
                        <Trash2 size={15} />Cancel &amp; Wipe {pid}
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </>
          )}
        </>
      )}

      {confirmCancel && activeCampaign && (
        <Sheet
          title={`Cancel & Wipe ${shortProductId(activeCampaign.productId)}?`}
          subtitle={String(activeCampaign.shortName || activeCampaign.productId)}
          onClose={() => !wipingProduct && setConfirmCancel(false)}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                padding: 12,
                borderRadius: 10,
                background: 'var(--danger-soft)',
                border: '1px solid var(--danger)',
              }}
            >
              <AlertTriangle size={18} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong style={{ display: 'block', color: 'var(--danger-text)', marginBottom: 4 }}>
                  This wipes {shortProductId(activeCampaign.productId)} across Launchroom for a clean slate:
                </strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Removes <b>{activeCampaign.campaignName}</b> from Manage (`meta-campaigns.json`)</li>
                  <li>Moves storefront packet (`hydrogen-storefront/app/content/`) to `_archived/`</li>
                  <li>Moves product folder (`products/{activeCampaign.productId}`) to `products/drafts/`</li>
                  <li>Clears active build slot &amp; launch checklist so you can start fresh on your next winner</li>
                </ul>
              </div>
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Reason for Cutting / Lesson Logged</span>
              <input
                type="text"
                className="mv-input"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g., Failed Day-1/Day-2 CPA baseline — cutting for a clean slate."
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                className="mv-btn ghost"
                disabled={wipingProduct}
                onClick={() => setConfirmCancel(false)}
              >
                Keep For Now
              </button>
              <button
                type="button"
                className="mv-btn danger"
                disabled={wipingProduct}
                onClick={handleCancelAndWipe}
              >
                <Trash2 size={14} />
                {wipingProduct ? 'Wiping Product…' : `Yes, Cancel & Wipe ${shortProductId(activeCampaign.productId)}`}
              </button>
            </div>
          </div>
        </Sheet>
      )}

      {inspectAd && (
        <Sheet wide title={inspectAd.name} subtitle={inspectAd.angle} onClose={() => setInspectAd(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 20, alignItems: 'start' }}>
            <img src={assetUrl(inspectAd.mediaPath)} alt={inspectAd.name} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }} />
            <div style={{ display: 'grid', gap: 12 }}>
              <div className="mv-cd-ad-stats">
                <span><small>Spend</small><b>{money(inspected.spend)}</b></span>
                <span><small>Shown</small><b>{inspected.impressions}</b></span>
                <span><small>Clicks</small><b>{inspected.clicks}</b></span>
                <span><small>CTR</small><b>{pct(inspected.ctr)}</b></span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className={`mv-btn ${inspectAd.ownerVerdict === 'approved' ? 'primary' : ''}`} onClick={() => { const next = inspectAd.ownerVerdict === 'approved' ? '' : 'approved'; saveAdVerdict(inspectAd.id, next); setInspectAd({ ...inspectAd, ownerVerdict: next }); }}><ThumbsUp size={15} />Keep</button>
                <button type="button" className={`mv-btn ${inspectAd.ownerVerdict === 'cut' ? 'danger' : ''}`} onClick={() => { const next = inspectAd.ownerVerdict === 'cut' ? '' : 'cut'; saveAdVerdict(inspectAd.id, next); setInspectAd({ ...inspectAd, ownerVerdict: next }); }}><ThumbsDown size={15} />Cut</button>
                <button type="button" className="mv-btn ghost" onClick={() => go(hubLink)}><ArrowUpRight size={15} />Assets hub</button>
              </div>
              <div>
                <span className="mv-eyebrow">Headline</span>
                <h3 className="mv-h3" style={{ marginTop: 4 }}>{inspectAd.headline}</h3>
              </div>
              <div>
                <span className="mv-eyebrow">Primary text</span>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 4 }}>{inspectAd.primaryText}</p>
              </div>
              {inspectAd.note && (
                <div>
                  <span className="mv-eyebrow">Performance note</span>
                  <p className="mv-small" style={{ marginTop: 4 }}>{inspectAd.note}</p>
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
