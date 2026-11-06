import React, { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronDown, Copy, ExternalLink, Film, Image as ImageIcon, Images, Layers, LoaderCircle, Play, Sparkles, Store as StoreIcon, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';
import { api } from './ui.jsx';
import { Sheet, assetUrl, leadPhotos, leadVideos } from './kit.jsx';
import { LineTabs } from './LineNav.jsx';
import { isCampaignLaunched, shortProductId } from './displayLine.mjs';
import { STEP_IDS } from './steps.mjs';
import { firstImageAd } from './campaignView.mjs';

// Step 4 of 6 · Creatives (owner, Nov 5):
// Only shows pre-launch products currently in Build & Launch (once a product launches,
// it graduates out of Build & Launch and its ad testing lives in Manage -> Ad Testing).

function buildCreativeProducts(pipeline, campaigns) {
  const list = new Map();
  const launchedIds = new Set(
    (campaigns || []).filter(isCampaignLaunched).map(c => shortProductId(c.productId))
  );

  // 1. Pre-launch products with queued Meta Ad Creative Packs (excludes already-launched campaigns)
  for (const campaign of campaigns || []) {
    if (isCampaignLaunched(campaign)) continue;
    const id = shortProductId(campaign.productId);
    if (id === 'P005') continue;
    const name = String(campaign.shortName || id).replace(/^[PL]\d{3,}\s*·\s*/, '');
    list.set(id, {
      id,
      name,
      campaign,
      storeUrl: campaign.storeUrl || '',
      image: firstImageAd(campaign),
      stageLabel: 'Ad Pack Ready',
    });
  }

  // 2. Only products that have already been chosen to build (past Winners, not yet launched)
  const buildFrom = STEP_IDS.indexOf('create');
  const learnIndex = STEP_IDS.indexOf('learn');
  for (const item of pipeline?.active || []) {
    if (item.readyToBuild || item.stepIndex < buildFrom || item.stepIndex >= learnIndex) continue;
    const id = shortProductId(item.productId || item.id);
    if (launchedIds.has(id) || id === 'P005' || id === 'L166' || id === 'L264') continue;
    if (!list.has(id)) {
      list.set(id, {
        id,
        name: item.name,
        campaign: null,
        storeUrl: '',
        image: item.image || '',
        stageLabel: item.stepName || 'Building',
      });
    }
  }

  return [...list.values()];
}

function ImageAdCard({ ad, onVerdict, onInspect, onCopy }) {
  const [openCopy, setOpenCopy] = useState(false);
  const verdict = ad.ownerVerdict || '';
  return (
    <article className={`mv-cd-ad ${verdict === 'approved' ? 'is-kept' : verdict === 'cut' ? 'is-cut' : ''}`}>
      <div className="mv-cd-ad-media" style={{ aspectRatio: '4 / 5' }}>
        <span className="mv-cd-ad-kind">
          <ImageIcon size={11} />4:5 Static
          {verdict === 'approved' ? ' · Kept' : verdict === 'cut' ? ' · Cut' : ''}
        </span>
        <button type="button" onClick={() => onInspect(ad)} title="Click to view full size">
          <img src={assetUrl(ad.mediaPath)} alt={ad.headline || ad.name} loading="lazy" />
        </button>
      </div>
      {onVerdict && (
        <div className="mv-cd-ad-verdict">
          <button
            type="button"
            className={`mv-btn sm ${verdict === 'approved' ? 'primary' : ''}`}
            onClick={() => onVerdict(ad, verdict === 'approved' ? '' : 'approved')}
          >
            <ThumbsUp size={13} />Keep
          </button>
          <button
            type="button"
            className={`mv-btn sm ${verdict === 'cut' ? 'danger' : 'ghost'}`}
            onClick={() => onVerdict(ad, verdict === 'cut' ? '' : 'cut')}
          >
            <ThumbsDown size={13} />Cut
          </button>
        </div>
      )}
      <div className="mv-cd-ad-body">
        {ad.angle && (
          <span className="mv-small" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>
            {ad.angle}
          </span>
        )}
        <p className="mv-cd-ad-headline" title={ad.headline || ad.name}>
          {ad.headline || ad.name}
        </p>
        <div className="mv-cd-ad-tools">
          <button
            type="button"
            className="mv-link"
            aria-expanded={openCopy}
            onClick={() => setOpenCopy(v => !v)}
          >
            {openCopy ? 'Hide copy' : 'Read copy'}
            <ChevronDown size={12} style={openCopy ? { transform: 'rotate(180deg)' } : undefined} />
          </button>
          {ad.primaryText && (
            <button
              type="button"
              className="mv-link"
              onClick={() => onCopy(`${ad.headline ? `${ad.headline}\n\n` : ''}${ad.primaryText}`, 'Ad copy')}
            >
              <Copy size={11} />Copy
            </button>
          )}
        </div>
        {openCopy && (
          <div className="mv-cd-ad-copy">
            <code>{ad.name}</code>
            {ad.primaryText && <p>{ad.primaryText}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

function VideoAdCard({ ad, poster, onVerdict, onCopy }) {
  const [openCopy, setOpenCopy] = useState(false);
  const verdict = ad.ownerVerdict || '';
  return (
    <article className={`mv-cd-ad ${verdict === 'approved' ? 'is-kept' : verdict === 'cut' ? 'is-cut' : ''}`}>
      <div className="mv-cd-ad-media" style={{ aspectRatio: '9 / 16', background: 'var(--bg-2)' }}>
        <span className="mv-cd-ad-kind">
          <Play size={11} />9:16 Video
          {verdict === 'approved' ? ' · Kept' : verdict === 'cut' ? ' · Cut' : ''}
        </span>
        <video
          src={assetUrl(ad.mediaPath)}
          poster={poster ? assetUrl(poster) : undefined}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
      {onVerdict && (
        <div className="mv-cd-ad-verdict">
          <button
            type="button"
            className={`mv-btn sm ${verdict === 'approved' ? 'primary' : ''}`}
            onClick={() => onVerdict(ad, verdict === 'approved' ? '' : 'approved')}
          >
            <ThumbsUp size={13} />Keep
          </button>
          <button
            type="button"
            className={`mv-btn sm ${verdict === 'cut' ? 'danger' : 'ghost'}`}
            onClick={() => onVerdict(ad, verdict === 'cut' ? '' : 'cut')}
          >
            <ThumbsDown size={13} />Cut
          </button>
        </div>
      )}
      <div className="mv-cd-ad-body">
        {ad.angle && (
          <span className="mv-small" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>
            {ad.angle}
          </span>
        )}
        <p className="mv-cd-ad-headline" title={ad.headline || ad.name}>
          {ad.headline || ad.name}
        </p>
        {(ad.primaryText || ad.name) && (
          <div className="mv-cd-ad-tools">
            <button
              type="button"
              className="mv-link"
              aria-expanded={openCopy}
              onClick={() => setOpenCopy(v => !v)}
            >
              {openCopy ? 'Hide copy' : 'Read copy'}
              <ChevronDown size={12} style={openCopy ? { transform: 'rotate(180deg)' } : undefined} />
            </button>
            {ad.primaryText && (
              <button
                type="button"
                className="mv-link"
                onClick={() => onCopy(`${ad.headline ? `${ad.headline}\n\n` : ''}${ad.primaryText}`, 'Video ad copy')}
              >
                <Copy size={11} />Copy
              </button>
            )}
          </div>
        )}
        {openCopy && (
          <div className="mv-cd-ad-copy">
            <code>{ad.name}</code>
            {ad.primaryText && <p>{ad.primaryText}</p>}
          </div>
        )}
      </div>
    </article>
  );
}

export function CreativesPage({ current, hub, leads, go, notify, route }) {
  const pipeline = current?.pipeline;
  const [localCampaigns, setLocalCampaigns] = useState(() => Array.isArray(hub?.metaCampaigns) ? hub.metaCampaigns : []);
  React.useEffect(() => {
    if (Array.isArray(hub?.metaCampaigns) && hub.metaCampaigns.length) {
      setLocalCampaigns(hub.metaCampaigns);
    }
  }, [hub?.metaCampaigns]);

  const products = useMemo(
    () => buildCreativeProducts(pipeline, localCampaigns, leads),
    [pipeline, localCampaigns, leads]
  );

  const [selected, setSelected] = useState(route?.params?.product || '');
  const product = products.find(p => p.id === selected) || products[0] || null;
  const [mediaTab, setMediaTab] = useState('all'); // 'all' | 'images' | 'videos'
  const [verdictFilter, setVerdictFilter] = useState('all'); // 'all' | 'approved' | 'unreviewed' | 'cut'
  const [inspectAd, setInspectAd] = useState(null);

  if (!pipeline && !hub) {
    return <div className="mv-loading"><LoaderCircle className="mv-spin" size={22} />Opening Creatives…</div>;
  }

  const campaign = product?.campaign || null;

  // Normalize ads for the selected product (either from Meta campaign pack or from saved verified creator videos/photos)
  const rawAds = useMemo(() => {
    if (!product) return [];
    if (campaign?.ads?.length) {
      return campaign.ads.map(ad => ({
        ...ad,
        isVideo: ad.format === 'video' || String(ad.format).toLowerCase().includes('video') || /\.(mp4|webm|mov)$/i.test(ad.mediaPath || ''),
      }));
    }
    const vList = (product.savedVideos || []).map((path, idx) => ({
      id: `${product.id}-vid-${idx + 1}`,
      name: `${product.id} · Viral Creator Video ${idx + 1}`,
      headline: `${product.name} — Creator Clip #${idx + 1}`,
      angle: 'Saved TikTok Creator Video (9:16)',
      format: 'video',
      isVideo: true,
      mediaPath: path,
      primaryText: '',
      ownerVerdict: 'approved',
    }));
    const pList = (product.savedPhotos || []).map((path, idx) => ({
      id: `${product.id}-img-${idx + 1}`,
      name: `${product.id} · Reference Frame ${idx + 1}`,
      headline: `${product.name} — Reference Image #${idx + 1}`,
      angle: 'Verified Product Reference',
      format: 'static',
      isVideo: false,
      mediaPath: path,
      primaryText: '',
      ownerVerdict: '',
    }));
    return [...pList, ...vList];
  }, [product, campaign]);

  const filteredByVerdict = useMemo(() => {
    return rawAds.filter(ad => {
      if (verdictFilter === 'approved') return ad.ownerVerdict === 'approved';
      if (verdictFilter === 'cut') return ad.ownerVerdict === 'cut';
      if (verdictFilter === 'unreviewed') return !ad.ownerVerdict;
      return true;
    });
  }, [rawAds, verdictFilter]);

  const imageAds = filteredByVerdict.filter(a => !a.isVideo);
  const videoAds = filteredByVerdict.filter(a => a.isVideo);

  const totalImages = rawAds.filter(a => !a.isVideo).length;
  const totalVideos = rawAds.filter(a => a.isVideo).length;
  const keptCount = rawAds.filter(a => a.ownerVerdict === 'approved').length;
  const cutCount = rawAds.filter(a => a.ownerVerdict === 'cut').length;

  async function handleVerdict(ad, ownerVerdict) {
    if (!campaign) return;
    try {
      const data = await api('/api/meta-campaigns', {
        productId: campaign.productId,
        adId: ad.id,
        ownerVerdict,
      });
      if (Array.isArray(data?.metaCampaigns)) {
        setLocalCampaigns(data.metaCampaigns);
      }
      notify?.(
        ownerVerdict === 'approved'
          ? `Kept "${ad.headline || ad.name}".`
          : ownerVerdict === 'cut'
          ? `Cut "${ad.headline || ad.name}".`
          : 'Cleared verdict.'
      );
    } catch (e) {
      notify?.(e.message || 'Could not save creative decision.');
    }
  }

  function copyText(text, label = 'Copied') {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    notify?.(`${label} copied to clipboard.`);
  }

  return (
    <section>
      <LineTabs active="creatives" pipeline={pipeline} go={go} />

      <div className="mv-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="mv-eyebrow">Step 4 of 6 · Ad Creatives</span>
          <h1 className="mv-h1">Creatives</h1>
          <p className="mv-sub">
            Click any product below to view all of its <strong>4:5 Image Ads</strong> and <strong>9:16 Video Ads</strong> in one clean gallery before moving to the Checklist.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="mv-btn sm ghost" onClick={() => go('build')}>
            <StoreIcon size={14} />Step 3 · Store
          </button>
          <button type="button" className="mv-btn sm ghost" onClick={() => go(`assets?tab=studio${product ? `&product=${product.id}` : ''}`)}>
            <Images size={14} />Build Ads in Assets Hub
          </button>
          <button
            type="button"
            className="mv-btn sm primary"
            onClick={() => go(`checklist${product ? `?product=${product.id}` : ''}`)}
          >
            <CheckCircle2 size={14} />Next: Step 5 · Checklist
          </button>
        </div>
      </div>

      {/* Clean Product Picker Strip (uses .mv-cd-pick-photo so thumbnails are always crisp 56x56 squares) */}
      {products.length > 0 && (
        <div className="mv-cd-picks" role="tablist" aria-label="Products in Creatives">
          {products.map(p => {
            const cAds = p.campaign?.ads || [];
            const vCount = p.campaign
              ? cAds.filter(a => a.format === 'video' || String(a.format).toLowerCase().includes('video')).length
              : (p.savedVideos || []).length;
            const iCount = p.campaign
              ? cAds.length - vCount
              : (p.savedPhotos || []).length;
            return (
              <button
                key={p.id}
                type="button"
                className="mv-cd-pick"
                aria-pressed={p.id === product?.id}
                onClick={() => {
                  setSelected(p.id);
                  setInspectAd(null);
                }}
              >
                <span className="mv-cd-pick-photo">
                  {p.image ? <img src={assetUrl(p.image)} alt="" loading="lazy" /> : p.id}
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong>
                  <small>{p.id} · {iCount} image ads · {vCount} video ads</small>
                </span>
                <span className={`mv-pill ${p.campaign ? 'ok' : ''}`} style={{ marginLeft: 'auto' }}>
                  {p.stageLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!product ? (
        <div className="mv-card mv-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong>No unlaunched product is in Creatives right now.</strong>
            <div className="mv-small" style={{ marginTop: 4 }}>
              Once a product is launched, its ad creatives move to <b>Manage → Ad Testing</b>. Pick your next winner in <b>Winners</b> to build its ad creative pack here.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="mv-btn primary" onClick={() => go('winners')}><Sparkles size={14} />Pick Next Winner</button>
            <button type="button" className="mv-btn ghost" onClick={() => go('manage?tab=ads')}><TrendingUp size={14} />Open Manage · Ad Testing</button>
          </div>
        </div>
      ) : (
        <>
          {/* Clean Format Switcher & Verdict Filter Bar */}
          <div
            className="mv-card mv-pad"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 18,
              padding: '12px 16px',
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }} role="tablist" aria-label="Creative format filter">
              <button
                type="button"
                className={`mv-btn sm ${mediaTab === 'all' ? 'primary' : 'ghost'}`}
                onClick={() => setMediaTab('all')}
              >
                <Layers size={14} />All Creatives ({rawAds.length})
              </button>
              <button
                type="button"
                className={`mv-btn sm ${mediaTab === 'images' ? 'primary' : 'ghost'}`}
                onClick={() => setMediaTab('images')}
              >
                <ImageIcon size={14} />Image Ads · 4:5 ({totalImages})
              </button>
              <button
                type="button"
                className={`mv-btn sm ${mediaTab === 'videos' ? 'primary' : 'ghost'}`}
                onClick={() => setMediaTab('videos')}
              >
                <Film size={14} />Video Ads · 9:16 ({totalVideos})
              </button>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {campaign && (
                <>
                  {[
                    ['all', `All (${rawAds.length})`],
                    ['approved', `Kept (${keptCount})`],
                    ['cut', `Cut (${cutCount})`],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`mv-btn sm ${verdictFilter === id ? 'primary' : 'ghost'}`}
                      onClick={() => setVerdictFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </>
              )}
              {product.storeUrl && (
                <a className="mv-btn sm ghost" href={product.storeUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} />Live Store
                </a>
              )}
              <button
                type="button"
                className="mv-btn sm ghost"
                onClick={() => go(`assets?tab=studio&product=${product.id}`)}
              >
                <ArrowUpRight size={13} />Edit in Studio
              </button>
            </div>
          </div>

          {/* SECTION 1: 4:5 Static Image Ads */}
          {(mediaTab === 'all' || mediaTab === 'images') && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ImageIcon size={17} />
                  <h2 className="mv-h3" style={{ margin: 0 }}>
                    4:5 Static Image Ads ({imageAds.length})
                  </h2>
                  <span className="mv-small">Click any image to view full-size with its complete copy</span>
                </div>
              </div>
              {imageAds.length === 0 ? (
                <div className="mv-card mv-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="mv-small">No 4:5 static image ads match this filter for {product.id} yet.</span>
                  <button type="button" className="mv-btn sm primary" onClick={() => go(`assets?tab=studio&product=${product.id}`)}>
                    <Sparkles size={13} />Build Static Ads in Assets Hub
                  </button>
                </div>
              ) : (
                <div className="mv-cd-ad-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}>
                  {imageAds.map(ad => (
                    <ImageAdCard
                      key={ad.id}
                      ad={ad}
                      onVerdict={campaign ? handleVerdict : null}
                      onInspect={setInspectAd}
                      onCopy={copyText}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* SECTION 2: 9:16 Creator Video Ads */}
          {(mediaTab === 'all' || mediaTab === 'videos') && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Film size={17} />
                  <h2 className="mv-h3" style={{ margin: 0 }}>
                    9:16 Creator Video Ads ({videoAds.length})
                  </h2>
                  <span className="mv-small">Click play on any vertical video to watch with sound</span>
                </div>
              </div>
              {videoAds.length === 0 ? (
                <div className="mv-card mv-pad" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span className="mv-small">No 9:16 video ads match this filter for {product.id} yet.</span>
                  <button type="button" className="mv-btn sm primary" onClick={() => go(`assets?tab=studio&product=${product.id}`)}>
                    <Film size={13} />Add Video Ads in Assets Hub
                  </button>
                </div>
              ) : (
                <div className="mv-cd-ad-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))' }}>
                  {videoAds.map(ad => (
                    <VideoAdCard
                      key={ad.id}
                      ad={ad}
                      poster={product.image}
                      onVerdict={campaign ? handleVerdict : null}
                      onCopy={copyText}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Full-Size Image Lightbox Drawer */}
      {inspectAd && (
        <Sheet
          wide
          title={inspectAd.headline || inspectAd.name}
          subtitle={`${product?.id} · ${inspectAd.angle || '4:5 Static Ad'}`}
          onClose={() => setInspectAd(null)}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 480px) 1fr', gap: 20, alignItems: 'start' }}>
            <img
              src={assetUrl(inspectAd.mediaPath)}
              alt={inspectAd.headline || inspectAd.name}
              style={{ width: '100%', borderRadius: 14, border: '1px solid var(--line)' }}
            />
            <div style={{ display: 'grid', gap: 14 }}>
              {campaign && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`mv-btn ${inspectAd.ownerVerdict === 'approved' ? 'primary' : ''}`}
                    onClick={() => {
                      handleVerdict(inspectAd, 'approved');
                      setInspectAd({ ...inspectAd, ownerVerdict: 'approved' });
                    }}
                  >
                    <ThumbsUp size={15} /> Keep Creative
                  </button>
                  <button
                    type="button"
                    className={`mv-btn ${inspectAd.ownerVerdict === 'cut' ? 'danger' : 'ghost'}`}
                    onClick={() => {
                      handleVerdict(inspectAd, 'cut');
                      setInspectAd({ ...inspectAd, ownerVerdict: 'cut' });
                    }}
                  >
                    <ThumbsDown size={15} /> Cut Creative
                  </button>
                  {inspectAd.primaryText && (
                    <button
                      type="button"
                      className="mv-btn ghost"
                      onClick={() => copyText(`${inspectAd.headline ? `${inspectAd.headline}\n\n` : ''}${inspectAd.primaryText}`, 'Ad copy')}
                    >
                      <Copy size={14} /> Copy Headline + Body
                    </button>
                  )}
                </div>
              )}
              <div>
                <span className="mv-eyebrow">Meta Headline</span>
                <h3 className="mv-h3" style={{ marginTop: 4 }}>{inspectAd.headline || inspectAd.name}</h3>
              </div>
              {inspectAd.angle && (
                <div>
                  <span className="mv-eyebrow">Creative Angle</span>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{inspectAd.angle}</p>
                </div>
              )}
              {inspectAd.primaryText && (
                <div>
                  <span className="mv-eyebrow">Primary Text</span>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: 4 }}>{inspectAd.primaryText}</p>
                </div>
              )}
              {inspectAd.note && (
                <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-2)' }}>
                  <strong>Note:</strong> {inspectAd.note}
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}
