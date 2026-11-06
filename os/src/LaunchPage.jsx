import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, DollarSign, ExternalLink, Film, Image as ImageIcon, Images, LoaderCircle, Megaphone, Rocket, ShieldAlert, Sliders, Sparkles, TrendingUp } from 'lucide-react';
import { api } from './ui.jsx';
import { assetUrl, Chip } from './kit.jsx';
import { LineTabs, useChecklists } from './LineNav.jsx';
import { checklistScore, isCampaignLaunched, shortProductId } from './displayLine.mjs';
import { MetaAdBoard } from './MetaAdBoard.jsx';
import { STEP_IDS } from './steps.mjs';
import { firstImageAd } from './campaignView.mjs';

// Step 6 of 6 · Launch (owner, Nov 5):
// "I feel like Launch is setting everything for the campaign, making sure everything for
// the campaign is set and known. The checklist is just supposed to check everything else
// and then Launch is the last thing: launching the ads, right?... We need to find a way
// to make Launch be like: 'Okay Launch,' and then boom, that product jumps into Manage Now.
// It won't appear back in the Build and Launch tab again."

const BUDGET_PRESETS = [25, 50, 75, 100, 150];

function launchProducts(pipeline, campaigns) {
  const list = new Map();
  const buildFrom = STEP_IDS.indexOf('create');
  const learnIndex = STEP_IDS.indexOf('learn');
  const launchedIds = new Set(
    (campaigns || []).filter(isCampaignLaunched).map(c => shortProductId(c.productId))
  );

  for (const item of pipeline?.active || []) {
    if (item.readyToBuild || item.stepIndex < buildFrom || item.stepIndex >= learnIndex) continue;
    const id = shortProductId(item.productId || item.id);
    if (launchedIds.has(id) || id === 'P005') continue;
    list.set(id, { id, name: item.name, image: item.image || '', stepIndex: item.stepIndex });
  }
  for (const campaign of campaigns || []) {
    if (isCampaignLaunched(campaign)) continue;
    const id = shortProductId(campaign.productId);
    if (id === 'P005') continue;
    const name = String(campaign.shortName || id).replace(/^[PL]\d{3,}\s*·\s*/, '');
    list.set(id, { ...(list.get(id) || { id, name }), campaign, storeUrl: campaign.storeUrl });
  }
  return [...list.values()];
}

export function LaunchPage({ current, hub, go, notify, route }) {
  const checklists = useChecklists();
  const pipeline = current?.pipeline;
  const [localCampaigns, setLocalCampaigns] = useState(() =>
    Array.isArray(hub?.metaCampaigns) ? hub.metaCampaigns : []
  );
  useEffect(() => {
    if (Array.isArray(hub?.metaCampaigns)) setLocalCampaigns(hub.metaCampaigns);
  }, [hub?.metaCampaigns]);

  const products = useMemo(() => launchProducts(pipeline, localCampaigns), [pipeline, localCampaigns]);
  const launchedCampaigns = useMemo(
    () => (localCampaigns || []).filter(isCampaignLaunched),
    [localCampaigns]
  );

  const [selected, setSelected] = useState(route?.params?.product || '');
  const product = products.find(p => p.id === selected) || products[0] || null;
  const campaign = product?.campaign || null;

  const [dailyBudget, setDailyBudget] = useState(50);
  const [countries, setCountries] = useState('US / CA / UK / AU (Broad)');
  const [breakEvenCpa, setBreakEvenCpa] = useState(36.4);
  const [targetCpa, setTargetCpa] = useState(27.3);
  const [lossLimit, setLossLimit] = useState(50);
  const [campaignName, setCampaignName] = useState('');
  const [adsetName, setAdsetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!product) return;
    const c = product.campaign;
    const be = Number(c?.breakEvenCpa || 36.4);
    setDailyBudget(Number(c?.dailyBudget || 50));
    setCountries(c?.countries || 'US / CA / UK / AU (Broad)');
    setBreakEvenCpa(be);
    setTargetCpa(Number(c?.targetCpa || Math.round(be * 0.75 * 100) / 100));
    setLossLimit(Number(c?.lossLimit || 50));
    setCampaignName(c?.campaignName || `Merrivy - ${product.id} - ${product.name} - CBO`);
    setAdsetName(c?.adsetName || `${product.id} - Broad - US/CA/UK/AU - 18-65+`);
    setError('');
  }, [product?.id, product?.campaign?.updatedAt]);

  if (!checklists) return <div className="mv-loading"><LoaderCircle className="mv-spin" size={22} />Opening Launch…</div>;
  const items = checklists.items || [];
  const score = product ? checklistScore(checklists, product.id) : { done: 0, total: items.length || 7, complete: false };

  const ads = campaign?.ads || [];
  const videoCount = ads.filter(a => a.format?.includes('Video')).length;
  const imageCount = ads.length - videoCount;
  const cutCount = ads.filter(a => a.status === 'PAUSED' || a.ownerVerdict === 'cut').length;
  const keptCount = ads.length - cutCount;
  const killLineCpa = Math.round(Number(breakEvenCpa || 0) * 1.5 * 100) / 100;

  async function saveLaunchPlan(e) {
    if (e) e.preventDefault();
    if (!product?.campaign) return;
    setSaving(true);
    setError('');
    try {
      const res = await api('/api/meta-campaigns', {
        campaignId: product.campaign.campaignId,
        productId: product.campaign.productId,
        dailyBudget: Number(dailyBudget),
        countries: String(countries).trim(),
        breakEvenCpa: Number(breakEvenCpa),
        targetCpa: Number(targetCpa),
        lossLimit: Number(lossLimit),
        campaignName: String(campaignName).trim(),
        adsetName: String(adsetName).trim(),
      });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
      notify?.(`Saved Meta Ads budget ($${Number(dailyBudget)}/day) and launch guardrails for ${product.id}.`);
    } catch (err) {
      setError(err.message || 'Could not save Meta launch settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleLaunchToManage() {
    if (!product) return;
    setLaunching(true);
    setError('');
    try {
      const res = await api('/api/meta-campaigns', {
        action: 'launch-product',
        campaignId: product.campaign?.campaignId,
        productId: product.campaign?.productId || product.id,
        shortName: product.name,
        storeUrl: product.storeUrl || '',
        dailyBudget: Number(dailyBudget),
        countries: String(countries).trim(),
        breakEvenCpa: Number(breakEvenCpa),
        targetCpa: Number(targetCpa),
        lossLimit: Number(lossLimit),
        campaignName: String(campaignName).trim(),
        adsetName: String(adsetName).trim(),
      });
      if (Array.isArray(res?.metaCampaigns)) setLocalCampaigns(res.metaCampaigns);
      notify?.(`Launched ${product.id} ($${Number(dailyBudget)}/day CBO)! Product moved from Build & Launch into Manage.`);
      go(`manage?product=${product.id}`);
    } catch (err) {
      setError(err.message || 'Could not launch campaign');
    } finally {
      setLaunching(false);
    }
  }

  return (
    <section>
      <LineTabs active="launch" pipeline={pipeline} go={go} />
      <div className="mv-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="mv-eyebrow">Step 6 of 6 · Final Build &amp; Launch Step</span>
          <h1 className="mv-h1">Launch · Set Campaign &amp; Go Live</h1>
          <p className="mv-sub">
            Set the Meta Ads campaign budget, target countries, and CPA guardrails, verify the queued ad pack, and click <b>Launch Campaign Now</b>. The moment a product launches, it leaves <b>Build &amp; Launch</b> and lives exclusively in <b>Manage</b>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="mv-btn sm ghost" onClick={() => go(product ? `checklist?product=${product.id}` : 'checklist')}>
            <CheckCircle2 size={14} />Checklist
          </button>
          <button type="button" className="mv-btn sm ghost" onClick={() => go('assets?tab=studio')}>
            <Images size={14} />Assets Hub
          </button>
          <button type="button" className="mv-btn sm primary" onClick={() => go('manage')}>
            <TrendingUp size={14} />Go to Manage ({launchedCampaigns.length})
          </button>
        </div>
      </div>

      {!products.length ? (
        <div className="mv-card mv-pad" style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <span className="mv-eyebrow">Build &amp; Launch Queue Empty</span>
              <h2 className="mv-h2" style={{ margin: '4px 0 6px' }}>
                No Unlaunched Product Waiting at Launch
              </h2>
              <p className="mv-small" style={{ margin: 0, maxWidth: 680, lineHeight: 1.55 }}>
                Once a product is launched, it automatically leaves <b>Build &amp; Launch</b> (<code>Store → Creatives → Checklist → Launch</code>) and moves permanently into <b>Manage</b> so you always know what has already launched vs. what still needs to be launched.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="mv-btn primary" onClick={() => go('winners')}>
                <Sparkles size={14} />Pick Next Winner to Build
              </button>
              <button type="button" className="mv-btn ghost" onClick={() => go('manage')}>
                <TrendingUp size={14} />Open Manage ({launchedCampaigns.length} Live)
              </button>
            </div>
          </div>

          {launchedCampaigns.length > 0 && (
            <div style={{ display: 'grid', gap: 8, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
              <span className="mv-eyebrow">Already Launched &amp; Graduated to Manage ({launchedCampaigns.length})</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {launchedCampaigns.map(c => {
                  const id = shortProductId(c.productId);
                  const photo = firstImageAd(c);
                  const name = String(c.shortName || id).replace(/^[PL]\d{3,}\s*·\s*/, '');
                  return (
                    <article
                      key={c.productId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'var(--surface-2)',
                        border: '1px solid var(--line)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {photo ? (
                          <img
                            src={assetUrl(photo)}
                            alt=""
                            style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : null}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13.5 }}>{id} · {name}</strong>
                            <Chip tone="done">Launched → In Manage</Chip>
                          </div>
                          <span className="mv-small">
                            ${Number(c.dailyBudget || 50)}/day CBO · {(c.ads || []).length} ads
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mv-btn sm primary"
                        onClick={() => go(`manage?product=${id}`)}
                      >
                        Manage<ArrowRight size={13} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : <>
        <div className="mv-cd-picks">
          {products.map(p => {
            const c = p.campaign;
            const photo = p.image || firstImageAd(c);
            const adTotal = c?.ads?.length || 0;
            const budget = c?.dailyBudget || 50;
            return (
              <button key={p.id} type="button" className="mv-cd-pick" aria-pressed={p.id === product.id} onClick={() => setSelected(p.id)}>
                <span className="mv-cd-pick-photo">{photo ? <img src={assetUrl(photo)} alt="" loading="lazy" /> : p.id}</span>
                <span style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong>
                  <small>{p.id} · ${budget}/day · {adTotal} ads</small>
                </span>
                <span className="mv-pill" style={{ marginLeft: 'auto' }}>
                  READY TO LAUNCH
                </span>
              </button>
            );
          })}
        </div>

        {!score.complete && (
          <div className="mv-card mv-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16, borderColor: 'var(--warn)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ShieldAlert size={22} style={{ color: 'var(--warn)' }} />
              <div>
                <strong>{score.total - score.done} item(s) still open on the Checklist for {product.id}.</strong>
                <div className="mv-small">Finish the remaining Storefront &amp; Shopify Checklist items before spending ad budget.</div>
              </div>
            </div>
            <button type="button" className="mv-btn sm ghost" onClick={() => go(`checklist?product=${product.id}`)}>
              Open Checklist
            </button>
          </div>
        )}

        {error && <div className="mv-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        <form className="mv-card mv-pad" onSubmit={saveLaunchPlan} style={{ marginBottom: 20, display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Megaphone size={18} style={{ color: 'var(--accent-text)' }} />
                <strong style={{ fontSize: 16 }}>Meta CBO Campaign Budget, Targeting &amp; Guardrails ({product.id})</strong>
                <Chip tone="active">Ready to Launch</Chip>
              </div>
              <p className="mv-small" style={{ marginTop: 4 }}>
                Set how much daily CBO budget we are running on Meta Ads, target markets, and our hard CPA / loss-limit rules. Then click <b>Launch Campaign Now → Move to Manage</b>.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {campaign && (
                <button type="submit" className="mv-btn sm ghost" disabled={saving || launching}>
                  {saving ? <LoaderCircle size={14} className="mv-spin" /> : <Sliders size={14} />}
                  Save Draft Settings
                </button>
              )}
              <button
                type="button"
                className="mv-btn primary"
                disabled={launching}
                onClick={handleLaunchToManage}
              >
                {launching ? <LoaderCircle size={15} className="mv-spin" /> : <Rocket size={15} />}
                {launching ? 'Launching…' : `Launch ${product.id} Now → Move to Manage`}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="mv-small" style={{ fontWeight: 600 }}>Quick Daily Budget:</span>
            {BUDGET_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                className={`mv-btn sm ${Number(dailyBudget) === preset ? 'primary' : 'ghost'}`}
                onClick={() => setDailyBudget(preset)}
              >
                ${preset}/day
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Daily CBO Budget ($/day)</span>
              <input
                type="number"
                step="1"
                min="5"
                className="mv-input"
                value={dailyBudget}
                onChange={e => setDailyBudget(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Target Countries &amp; Audience</span>
              <input
                type="text"
                className="mv-input"
                value={countries}
                onChange={e => setCountries(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Break-Even CPA ($)</span>
              <input
                type="number"
                step="0.01"
                min="1"
                className="mv-input"
                value={breakEvenCpa}
                onChange={e => setBreakEvenCpa(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Target CPA ($)</span>
              <input
                type="number"
                step="0.01"
                min="1"
                className="mv-input"
                value={targetCpa}
                onChange={e => setTargetCpa(e.target.value)}
              />
            </label>

            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>First-Test Loss Limit ($)</span>
              <input
                type="number"
                step="1"
                min="10"
                className="mv-input"
                value={lossLimit}
                onChange={e => setLossLimit(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Meta Campaign Name</span>
              <input
                type="text"
                className="mv-input"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
              />
            </label>
            <label style={{ display: 'grid', gap: 5 }}>
              <span className="mv-small" style={{ fontWeight: 600 }}>Meta Ad Set Name</span>
              <input
                type="text"
                className="mv-input"
                value={adsetName}
                onChange={e => setAdsetName(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div className="mv-card mv-pad" style={{ background: 'var(--bg-1)' }}>
              <span className="mv-small">Active Daily Spend Plan</span>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <DollarSign size={16} style={{ color: 'var(--success)' }} />
                {Number(dailyBudget || 0).toFixed(0)}/day CBO
              </div>
              <span className="mv-small">{countries}</span>
            </div>

            <div className="mv-card mv-pad" style={{ background: 'var(--bg-1)' }}>
              <span className="mv-small">Ad Pack Loaded from Hub</span>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                {keptCount} Active / {ads.length} Total Ads
              </div>
              <span className="mv-small" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span><Film size={11} /> {videoCount} 9:16 Videos</span>
                <span><ImageIcon size={11} /> {imageCount} 4:5 Statics</span>
              </span>
            </div>

            <div className="mv-card mv-pad" style={{ background: 'var(--bg-1)' }}>
              <span className="mv-small">Money Line &amp; Target CPA</span>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                ${Number(breakEvenCpa || 0).toFixed(2)} BE · ${Number(targetCpa || 0).toFixed(2)} Target
              </div>
              <span className="mv-small">Kill ad at ${killLineCpa.toFixed(2)} spend with 0 sales</span>
            </div>

            <div className="mv-card mv-pad" style={{ background: 'var(--bg-1)' }}>
              <span className="mv-small">First-Test Loss Cap</span>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>
                ${Number(lossLimit || 50).toFixed(0)} Max Net Loss
              </div>
              <span className="mv-small">Pixel {campaign?.pixelId || '955359040485060'} · Website Purchase</span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              paddingTop: 12,
              borderTop: '1px solid var(--line)',
            }}
          >
            <span className="mv-small">
              Clicking <b>Launch {product.id} Now</b> marks this campaign as live, removes {product.id} from Build &amp; Launch, and opens it in <b>Manage</b>.
            </span>
            <button
              type="button"
              className="mv-btn primary"
              disabled={launching}
              onClick={handleLaunchToManage}
            >
              {launching ? <LoaderCircle size={15} className="mv-spin" /> : <Rocket size={15} />}
              {launching ? 'Launching…' : `Launch ${product.id} Now → Move to Manage`}
            </button>
          </div>
        </form>

        {campaign && (
          <div>
            <MetaAdBoard key={product.id} hub={hub} lockProductId={product.id} hideChecklist go={go} notify={notify} />
          </div>
        )}
      </>}
    </section>
  );
}
