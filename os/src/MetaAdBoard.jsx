import React, { useState, useMemo, useEffect } from 'react';
import { ExternalLink, Play, Image as ImageIcon, CheckCircle2, XCircle, ShieldCheck, ThumbsUp, ThumbsDown, CheckSquare, Square, Plus, Pencil, Save, ChevronDown, Wallet, DollarSign, MousePointerClick, TrendingUp, ShoppingBag, ArrowUpRight, ListChecks } from 'lucide-react';
import { Chip, Sheet, assetUrl } from './kit.jsx';
import { api } from './ui.jsx';
import { ReadMore, Stat } from './cards.jsx';
import { shortProductId } from './displayLine.mjs';

/** One ad: the picture first, Keep or Cut in one tap, its numbers, and the words behind "Read the copy". */
function AdCard({ ad, onVerdict, onInspect, onEdit, canEdit = true }) {
  const [open, setOpen] = useState(false);
  const isVideo = ad.format === 'video';
  const verdict = ad.ownerVerdict || '';
  return (
    <article className={`mv-cd-ad ${verdict === 'approved' ? 'is-kept' : verdict === 'cut' ? 'is-cut' : ''}`}>
      <div className="mv-cd-ad-media">
        {(isVideo || verdict) && <span className="mv-cd-ad-kind">{isVideo ? <Play size={11} /> : <ImageIcon size={11} />}{isVideo ? 'Video' : 'Image'}{verdict === 'approved' ? ' · Kept' : verdict === 'cut' ? ' · Cut' : ''}</span>}
        {isVideo
          ? <video src={assetUrl(ad.mediaPath)} controls preload="metadata" style={{ objectFit: 'contain' }} />
          : <button type="button" onClick={() => onInspect(ad)} title="See it full size"><img src={assetUrl(ad.mediaPath)} alt={ad.name} loading="lazy" /></button>}
      </div>
      <div className="mv-cd-ad-verdict">
        <button type="button" className={`mv-btn sm ${verdict === 'approved' ? 'primary' : ''}`} onClick={() => onVerdict(ad, verdict === 'approved' ? '' : 'approved')}><ThumbsUp size={13} />Keep</button>
        <button type="button" className={`mv-btn sm ${verdict === 'cut' ? 'danger' : 'ghost'}`} onClick={() => onVerdict(ad, verdict === 'cut' ? '' : 'cut')}><ThumbsDown size={13} />Cut</button>
      </div>
      <div className="mv-cd-ad-body">
        {ad.angle && <span className="mv-small" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>{ad.angle}</span>}
        <p className="mv-cd-ad-headline" title={ad.headline}>{ad.headline}</p>
        <div className="mv-cd-ad-tools">
          <button type="button" className="mv-link" aria-expanded={open} onClick={() => setOpen(value => !value)}>Read the copy<ChevronDown size={12} style={open ? { transform: 'rotate(180deg)' } : undefined} /></button>
          {canEdit && <button type="button" className="mv-link" onClick={() => onEdit(ad)}><Pencil size={12} />Edit</button>}
        </div>
        {open && <div className="mv-cd-ad-copy">
          <code>{ad.name}</code>
          {ad.angle && <b>{ad.angle}</b>}
          <p>{ad.primaryText}</p>
          {ad.note && <span><b>Why:</b> {ad.note}</span>}
        </div>}
      </div>
    </article>
  );
}

export function MetaAdBoard({ hub, defaultProductId = '', lockProductId = '', hideChecklist = false, go, notify }) {
  const [localCampaigns, setLocalCampaigns] = useState(() => Array.isArray(hub?.metaCampaigns) ? hub.metaCampaigns : []);
  useEffect(() => {
    if (Array.isArray(hub?.metaCampaigns) && hub.metaCampaigns.length) {
      setLocalCampaigns(hub.metaCampaigns);
    }
  }, [hub?.metaCampaigns]);

  const campaigns = localCampaigns;
  const matchesId = (c, id) => c.productId === id || shortProductId(c.productId) === shortProductId(id);
  const [selectedProductId, setSelectedProductId] = useState(() => {
    if (defaultProductId) {
      const found = campaigns.find(c => matchesId(c, defaultProductId));
      if (found) return found.productId;
    }
    return campaigns[0]?.productId || '';
  });
  useEffect(() => {
    if (defaultProductId) {
      const found = campaigns.find(c => matchesId(c, defaultProductId));
      if (found) setSelectedProductId(found.productId);
    }
  }, [defaultProductId, campaigns]);

  const [filter, setFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [inspectAd, setInspectAd] = useState(null);
  const [editingAd, setEditingAd] = useState(null);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);

  const activeCampaign = useMemo(
    () => lockProductId
      ? campaigns.find(c => matchesId(c, lockProductId)) || null
      : campaigns.find(c => c.productId === selectedProductId) || campaigns.find(c => defaultProductId && matchesId(c, defaultProductId)) || campaigns[0] || null,
    [campaigns, selectedProductId, lockProductId, defaultProductId]
  );

  if (!activeCampaign) return null;

  // Pipeline steps (lockProductId set, e.g. Checklist) only view & approve/cut creatives brought from the Hub.
  // Creation & editing happen in the Assets & Creatives Hub (#/assets?tab=studio).
  const isPipelineView = Boolean(lockProductId);
  const shortId = shortProductId(activeCampaign.productId);

  async function saveDecision(payload) {
    try {
      const data = await api('/api/meta-campaigns', { productId: activeCampaign.productId, ...payload });
      if (Array.isArray(data?.metaCampaigns)) {
        setLocalCampaigns(data.metaCampaigns);
      }
      return data;
    } catch (e) {
      console.error('Failed to save meta campaign decision:', e);
      return null;
    }
  }

  const ads = activeCampaign.ads || [];
  const checklist = activeCampaign.launchChecklist || [];
  const checkedCount = checklist.filter(c => c.checked).length;

  const counts = {
    all: ads.length,
    active: ads.filter(a => a.status === 'ACTIVE').length,
    static: ads.filter(a => a.format === 'static').length,
    video: ads.filter(a => a.format === 'video').length,
    approved: ads.filter(a => a.ownerVerdict === 'approved').length,
    cut: ads.filter(a => a.ownerVerdict === 'cut').length,
    unreviewed: ads.filter(a => !a.ownerVerdict).length,
  };

  const filteredAds = ads.filter(ad => {
    if (filter === 'active') return ad.status === 'ACTIVE';
    if (filter === 'static') return ad.format === 'static';
    if (filter === 'video') return ad.format === 'video';
    if (filter === 'approved') return ad.ownerVerdict === 'approved';
    if (filter === 'cut') return ad.ownerVerdict === 'cut';
    if (filter === 'unreviewed') return !ad.ownerVerdict;
    return true;
  });

  const sum = activeCampaign.summaryToday || {};

  return (
    <section className="mv-card mv-pad" style={{ border: '1.5px solid var(--accent)', background: 'var(--bg-1)' }}>
      {/* Top Header & Campaign Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 className="mv-h2">
            {isPipelineView ? `The ads we'll run (${(activeCampaign.ads || []).length})` : `Product Ad Creative Studio · ${activeCampaign.shortName}`}
          </h2>
          <p className="mv-small" style={{ marginTop: 4 }}>
            {isPipelineView
              ? <>Brought from the <b>Assets &amp; Creatives Hub</b>. Tap an image to enlarge it, and <b>Keep</b> or <b>Cut</b> each one.</>
              : <>Build and edit 9:16 creator videos &amp; 4:5 static ads here in the Hub. Everything saved here pushes straight to <b>Checklist</b> and <b>Manage</b>.</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isPipelineView ? (
            go && (
              <button type="button" className="mv-btn primary sm" onClick={() => go(`assets?tab=studio&product=${shortId}`)}>
                <ArrowUpRight size={14} /> Build / Edit Creatives in Assets Hub
              </button>
            )
          ) : (
            <>
              <button type="button" className="mv-btn primary sm" onClick={() => setEditingAd({ isNew: true, format: 'video', headline: 'You Have to Get This — Order Yours Today!', primaryText: '', angle: '', mediaPath: '' })}>
                <Plus size={14} /> Build Ad Creative &amp; Push to {shortId}
              </button>
              <button type="button" className="mv-btn sm" onClick={() => setNewCampaignOpen(true)}>
                <Plus size={14} /> New Product Ad Pack
              </button>
              {go && (
                <>
                  <button type="button" className="mv-btn sm" onClick={() => go(`checklist?product=${shortId}`)}>
                    <ListChecks size={14} /> View in Checklist
                  </button>
                  <button type="button" className="mv-btn sm" onClick={() => go(`manage?product=${shortId}`)}>
                    <TrendingUp size={14} /> View in Manage
                  </button>
                </>
              )}
            </>
          )}
          {activeCampaign.metaAdsManagerUrl && (
            <a className="mv-btn sm" href={activeCampaign.metaAdsManagerUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Meta Ads Manager
            </a>
          )}
          {activeCampaign.storeUrl && (
            <a className="mv-btn sm" href={activeCampaign.storeUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Live Store Page
            </a>
          )}
        </div>
      </div>

      {/* Product Campaign Selector Tabs */}
      {campaigns.length > 1 && !lockProductId && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
          {campaigns.map(c => {
            const isSel = c.productId === activeCampaign.productId;
            const totalAds = (c.ads || []).length;
            return (
              <button
                key={c.productId}
                type="button"
                onClick={() => setSelectedProductId(c.productId)}
                className={`mv-btn sm ${isSel ? 'primary' : ''}`}
                style={{ fontWeight: isSel ? 700 : 500 }}
              >
                <span>{c.shortName}</span>
                <Chip tone={String(c.status).startsWith('ACTIVE') ? 'done' : 'owner'}>
                  ${c.dailyBudget}/d · {totalAds} ads
                </Chip>
              </button>
            );
          })}
        </div>
      )}

      {activeCampaign.pricingSummary && <div style={{ marginBottom: 14 }}><ReadMore text={activeCampaign.pricingSummary} lines={1} /></div>}

      {/* 7-Point Interactive Launch Checklist */}
      {checklist.length > 0 && !hideChecklist && (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} style={{ color: 'var(--success)' }} />
              <h3 className="mv-h3" style={{ margin: 0 }}>
                Pre-Launch Verification &amp; Owner Signoff Checklist ({checkedCount}/{checklist.length} Verified)
              </h3>
            </div>
            <Chip tone={checkedCount === checklist.length ? 'done' : 'owner'}>
              {checkedCount === checklist.length ? 'ALL 7 LAUNCH GATES VERIFIED' : `${checklist.length - checkedCount} OWNER SIGNOFF(S) REMAINING`}
            </Chip>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {checklist.map(item => (
              <div
                key={item.id}
                onClick={() => saveDecision({ checkId: item.id, checked: !item.checked })}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'var(--bg-1)',
                  border: item.checked ? '1px solid var(--success, #2a7a4c)' : '1px solid var(--warn, #d97706)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ marginTop: 2, color: item.checked ? 'var(--success)' : 'var(--warn-text, #d97706)' }}>
                  {item.checked ? <CheckSquare size={18} /> : <Square size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Chip tone={item.checked ? 'done' : 'owner'}>{item.code}</Chip>
                    <strong style={{ fontSize: 13 }}>{item.title}</strong>
                  </div>
                  <p className="mv-small" style={{ marginTop: 4, marginBottom: 0, lineHeight: 1.45 }}>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          ['all', `All ${counts.all}`],
          ['static', `Images ${counts.static}`],
          ['video', `Videos ${counts.video}`],
          ['unreviewed', `To review ${counts.unreviewed}`],
          ['approved', `Kept ${counts.approved}`],
          ['cut', `Cut ${counts.cut}`],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`mv-btn sm ${filter === id ? 'primary' : 'ghost'}`} onClick={() => { setFilter(id); setShowAll(false); }}>{label}</button>
        ))}
      </div>

      {/* Ads Grid */}
      <div className="mv-cd-ad-grid">
        {(showAll ? filteredAds : filteredAds.slice(0, 12)).map(ad => <AdCard key={ad.id} ad={ad} canEdit={!isPipelineView} onInspect={setInspectAd} onEdit={setEditingAd} onVerdict={(item, ownerVerdict) => { saveDecision({ adId: item.id, ownerVerdict }); notify?.(ownerVerdict === 'approved' ? 'Marked ad as Keep.' : ownerVerdict === 'cut' ? 'Marked ad as Cut.' : 'Cleared verdict.'); }} />)}
      </div>
      {!showAll && filteredAds.length > 12 && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}><button type="button" className="mv-btn" onClick={() => setShowAll(true)}>Show all {filteredAds.length} ads<ChevronDown size={14} /></button></div>}

      {inspectAd && (
        <Sheet
          wide
          title={inspectAd.name}
          subtitle={`${inspectAd.angle} · ${inspectAd.status}`}
          onClose={() => setInspectAd(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 480px) 1fr', gap: 20, alignItems: 'start' }}>
            <img
              src={assetUrl(inspectAd.mediaPath)}
              alt={inspectAd.name}
              style={{ width: '100%', borderRadius: 12, border: '1px solid var(--line)' }}
            />
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="mv-btn primary"
                  onClick={() => {
                    saveDecision({ adId: inspectAd.id, ownerVerdict: 'approved' });
                    setInspectAd({ ...inspectAd, ownerVerdict: 'approved' });
                  }}
                >
                  <ThumbsUp size={15} /> Keep / Approve Creative
                </button>
                <button
                  type="button"
                  className="mv-btn danger"
                  onClick={() => {
                    saveDecision({ adId: inspectAd.id, ownerVerdict: 'cut' });
                    setInspectAd({ ...inspectAd, ownerVerdict: 'cut' });
                  }}
                >
                  <ThumbsDown size={15} /> Cut / Pause Creative
                </button>
              </div>
              <div>
                <span className="mv-eyebrow">Meta Headline</span>
                <h3 className="mv-h3" style={{ marginTop: 4 }}>{inspectAd.headline}</h3>
              </div>
              <div>
                <span className="mv-eyebrow">Primary Text</span>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 4 }}>{inspectAd.primaryText}</p>
              </div>
              {inspectAd.note && (
                <div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-2)' }}>
                  <strong>Strategist Note:</strong> {inspectAd.note}
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
      {editingAd && (
        <AdCreativeBuilderSheet
          ad={editingAd}
          campaign={activeCampaign}
          assets={hub?.assets || []}
          onClose={() => setEditingAd(null)}
          onSave={async payload => {
            await saveDecision(payload);
            setEditingAd(null);
          }}
        />
      )}
      {newCampaignOpen && (
        <NewCampaignSheet
          onClose={() => setNewCampaignOpen(false)}
          onCreate={async newCamp => {
            const res = await saveDecision({ newCampaign: newCamp });
            if (res?.metaCampaigns?.[0]) setSelectedProductId(res.metaCampaigns[0].productId);
            setNewCampaignOpen(false);
          }}
        />
      )}
    </section>
  );
}

function AdCreativeBuilderSheet({ ad, campaign, assets = [], onClose, onSave }) {
  const isNew = Boolean(ad?.isNew);
  const [name, setName] = useState(ad?.name || `CREATIVE_${campaign.productId.slice(0, 4).toUpperCase()}_${Date.now().toString().slice(-4)}`);
  const [format, setFormat] = useState(ad?.format || 'video');
  const [angle, setAngle] = useState(ad?.angle || '');
  const [headline, setHeadline] = useState(ad?.headline || '');
  const [primaryText, setPrimaryText] = useState(ad?.primaryText || '');
  const [mediaPath, setMediaPath] = useState(ad?.mediaPath || '');
  const [note, setNote] = useState(ad?.note || 'Viral video hook-harvested reveal creative');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        await onSave({
          newAd: { name, format, angle, headline, primaryText, mediaPath, note, status: 'ACTIVE' },
        });
      } else {
        await onSave({
          adId: ad.id,
          name,
          angle,
          headline,
          primaryText,
          mediaPath,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      wide
      title={isNew ? `Build New Ad Creative · ${campaign.shortName}` : `Edit Ad Copy · ${ad.name}`}
      subtitle="Remember the Viral Reveal Copy Rule: use eye-catching testimonial reveal hooks ('You have to get this 2027 planner') in Meta Headlines — never dry product labels."
      onClose={onClose}
    >
      <form className="mv-stack" onSubmit={handleSubmit} style={{ gap: 14 }}>
        <div className="mv-grid-2" style={{ gap: 12 }}>
          <label className="mv-field">
            <span>Creative Name</span>
            <input className="mv-input" value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label className="mv-field">
            <span>Ad Format</span>
            <select className="mv-input" value={format} onChange={e => setFormat(e.target.value)} disabled={!isNew}>
              <option value="video">🎬 9:16 Viral Creator Video Ad</option>
              <option value="static">🖼️ 4:5 Static Image Ad</option>
            </select>
          </label>
        </div>
        <label className="mv-field">
          <span>Hook Angle &amp; Target Avatar</span>
          <input className="mv-input" value={angle} onChange={e => setAngle(e.target.value)} placeholder="e.g. Viral Creator Reveal Hook: 'You Have to Get This...'" required />
        </label>
        <label className="mv-field">
          <span>Meta Headline (Urgent Reveal Hook — Not a Generic Label!)</span>
          <input className="mv-input" value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. You Have to Get This 2027 Journal — Get Yours Today! 🌙" required />
        </label>
        <label className="mv-field">
          <span>Primary Text (Combine Top Creator Reveal Phrasing + Offer)</span>
          <textarea className="mv-input" rows={6} value={primaryText} onChange={e => setPrimaryText(e.target.value)} placeholder="Start with the top viral creator's spoken 3-second hook, reveal the product in its best light, and close with our bundle/free-shipping offer..." required />
        </label>
        <label className="mv-field">
          <span>Media Path (Workspace Image or Video Path)</span>
          <input className="mv-input" list="mv-ad-asset-paths" value={mediaPath} onChange={e => setMediaPath(e.target.value)} placeholder="products/P004-.../creative/ads/..." />
          <datalist id="mv-ad-asset-paths">
            {assets.slice(0, 60).map(a => <option key={a.path} value={a.path}>{a.name}</option>)}
          </datalist>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="mv-btn primary" disabled={saving}><Save size={14} /> {saving ? 'Saving...' : isNew ? 'Add Creative to Campaign' : 'Save Ad Copy'}</button>
        </div>
      </form>
    </Sheet>
  );
}

function NewCampaignSheet({ onClose, onCreate }) {
  const [productId, setProductId] = useState('');
  const [shortName, setShortName] = useState('');
  const [storeUrl, setStoreUrl] = useState('https://merrivy.com/products/');
  const [dailyBudget, setDailyBudget] = useState('50');
  const [breakEvenCpa, setBreakEvenCpa] = useState('32');
  const [pricingSummary, setPricingSummary] = useState('1-Unit: $49.99 (Free Tracked Shipping) · 2-Pack Bundle: $79.98 (Save $20)');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onCreate({ productId, shortName, storeUrl, dailyBudget: Number(dailyBudget) || 50, breakEvenCpa: Number(breakEvenCpa) || 30, pricingSummary });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet wide title="Create New Meta Ad Campaign" subtitle="Set up a new product campaign board in Launchroom to stage and eye-test 9:16 creator videos and 4:5 static ads." onClose={onClose}>
      <form className="mv-stack" onSubmit={handleSubmit} style={{ gap: 14 }}>
        <div className="mv-grid-2" style={{ gap: 12 }}>
          <label className="mv-field">
            <span>Product ID</span>
            <input className="mv-input" value={productId} onChange={e => setProductId(e.target.value)} placeholder="e.g. P008-stone-seed-heating-pad" required />
          </label>
          <label className="mv-field">
            <span>Campaign Display Title</span>
            <input className="mv-input" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="e.g. P008 · Organic Stone-Seed Heating Pad" required />
          </label>
        </div>
        <div className="mv-grid-2" style={{ gap: 12 }}>
          <label className="mv-field">
            <span>Storefront Product URL</span>
            <input className="mv-input" value={storeUrl} onChange={e => setStoreUrl(e.target.value)} required />
          </label>
          <div className="mv-grid-2" style={{ gap: 8 }}>
            <label className="mv-field">
              <span>Daily Budget ($)</span>
              <input className="mv-input" type="number" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} required />
            </label>
            <label className="mv-field">
              <span>Break-Even CPA ($)</span>
              <input className="mv-input" type="number" step="0.01" value={breakEvenCpa} onChange={e => setBreakEvenCpa(e.target.value)} required />
            </label>
          </div>
        </div>
        <label className="mv-field">
          <span>Pricing &amp; Bundle Ladder Summary</span>
          <input className="mv-input" value={pricingSummary} onChange={e => setPricingSummary(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="mv-btn primary" disabled={saving}><Plus size={14} /> {saving ? 'Creating...' : 'Create Campaign Board'}</button>
        </div>
      </form>
    </Sheet>
  );
}
