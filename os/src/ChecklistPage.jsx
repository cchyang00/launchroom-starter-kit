import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ExternalLink, RefreshCw, Smartphone, Rocket, LoaderCircle, Lock, Pencil, Sparkles, Store, TrendingUp } from 'lucide-react';
import { api } from './ui.jsx';
import { assetUrl } from './kit.jsx';
import { LineTabs, useChecklists } from './LineNav.jsx';
import { checklistScore, isCampaignLaunched, shortProductId } from './displayLine.mjs';
import { STEP_IDS } from './steps.mjs';
import { firstImageAd } from './campaignView.mjs';

// Step 5 of 6 · Checklist (owner, Nov 4): compact 7-point site, Shopify Admin + Pixel,
// and Amy/CJ supplier checklist right next to the 375px mobile site preview.

const urlPath = value => { try { return new URL(value).pathname.replace(/\/$/, ''); } catch { return ''; } };

function checklistProducts(pipeline, campaigns) {
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

export function ChecklistPage({ current, hub, go, notify, route, reloadChecklists }) {
  const checklists = useChecklists();
  const pipeline = current?.pipeline;
  const products = useMemo(() => checklistProducts(pipeline, hub?.metaCampaigns), [pipeline, hub?.metaCampaigns]);
  const [selected, setSelected] = useState(route?.params?.product || '');
  const product = products.find(p => p.id === selected) || products[0] || null;
  const [packets, setPackets] = useState([]);
  const [busy, setBusy] = useState('');
  const [editing, setEditing] = useState('');
  const [openItem, setOpenItem] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [frameKey, setFrameKey] = useState(0);

  useEffect(() => { api('/api/store-editor').then(view => setPackets(view.packets || [])).catch(() => setPackets([])); }, []);

  if (!checklists) return <div className="mv-loading"><LoaderCircle className="mv-spin" size={22} />Opening the checklist…</div>;
  const items = checklists.items || [];
  const score = product ? checklistScore(checklists, product.id) : { done: 0, total: items.length, record: {} };
  const record = score.record || {};
  const linkedFile = record.packet || packets.find(p => product?.storeUrl && p.productUrl === urlPath(product.storeUrl))?.file || '';
  const packet = packets.find(p => p.file === linkedFile) || null;

  async function save(payload, key) {
    if (!product) return;
    setBusy(key); setError('');
    try { await api('/api/launch-checklists', { productId: product.id, ...payload }); await reloadChecklists?.(); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }
  async function toggle(item) {
    const was = record.items?.[item.id];
    await save({ itemId: item.id, done: !was?.done }, item.id);
    if (!was?.done && score.done + 1 === score.total) notify?.(`${product.id} checklist complete. Ready for Launch.`);
  }

  const groups = [...new Set(items.map(item => item.group))];
  return (
    <section>
      <LineTabs active="checklist" pipeline={pipeline} go={go} />
      <div className="mv-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <span className="mv-eyebrow">Step 5 of 6 · Storefront, Shopify &amp; Supplier Check</span>
          <h1 className="mv-h1">Checklist</h1>
          <p className="mv-sub">Check off the mobile storefront, strong copy, 1-Kit / 2-Kit upsells &amp; $4.99s, Shopify Admin + Meta Pixel, and Amy/CJ supplier check right beside the live phone preview.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="mv-btn sm ghost" onClick={() => go('store')}><Store size={14} />Store Hub</button>
          <a className="mv-btn sm ghost" href="https://admin.shopify.com/store/ndfdtc-br/products" target="_blank" rel="noreferrer"><ExternalLink size={14} />Shopify Admin</a>
          <button type="button" className="mv-btn sm primary" onClick={() => go(product ? `launch?product=${product.id}` : 'launch')}><Rocket size={14} />Go to Launch</button>
        </div>
      </div>

      {!products.length ? (
        <div className="mv-card mv-pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <strong>No unlaunched product is at Checklist right now.</strong>
            <div className="mv-small" style={{ marginTop: 4 }}>
              Previously built products have already been launched and moved to <b>Manage</b>. Pick your next winner in <b>Winners</b> to start a new pre-launch checklist.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="mv-btn primary" onClick={() => go('winners')}><Sparkles size={14} />Pick Next Winner</button>
            <button type="button" className="mv-btn ghost" onClick={() => go('manage')}><TrendingUp size={14} />Open Manage</button>
          </div>
        </div>
      ) : <>
        <div className="mv-cd-picks">
          {products.map(p => {
            const s = checklistScore(checklists, p.id);
            const photo = p.image || firstImageAd(p.campaign);
            return (
              <button key={p.id} type="button" className="mv-cd-pick" aria-pressed={p.id === product.id} onClick={() => { setSelected(p.id); setEditing(''); setOpenItem(''); setError(''); }}>
                <span className="mv-cd-pick-photo">{photo ? <img src={assetUrl(photo)} alt="" loading="lazy" /> : p.id}</span>
                <span style={{ minWidth: 0 }}><strong>{p.name}</strong><small>{p.id} · {s.complete ? 'Ready' : `${s.done} of ${s.total} checked`}</small></span>
              </button>
            );
          })}
        </div>

        {error && <div className="mv-error" role="alert" style={{ marginBottom: 12 }}>{error}</div>}

        <div className="mv-cd-cl-layout">
          <div>
            {groups.map(group => {
              const inGroup = items.filter(item => item.group === group);
              return (
                <section key={group}>
                  <h2 className="mv-cd-cl-group">{group}</h2>
                  <div className="mv-cd-cl-grid">
                    {inGroup.map(item => {
                      const state = record.items?.[item.id] || {};
                      const expanded = openItem === item.id;
                      const writing = editing === item.id;
                      return (
                        <article key={item.id} className={`mv-cd-tick ${state.done ? 'is-done' : ''}`}>
                          <div className="mv-cd-tick-top">
                            <button type="button" className={`mv-checkbox ${state.done ? 'is-checked' : ''}`} aria-label={`${state.done ? 'Untick' : 'Tick'} ${item.title}`} disabled={busy === item.id} onClick={() => toggle(item)}>
                              {busy === item.id ? <LoaderCircle size={13} className="mv-spin" /> : state.done && <Check size={14} strokeWidth={3} />}
                            </button>
                            <strong>{item.title}</strong>
                            {item.ownerOnly && <span className="mv-cd-tick-mine"><Lock size={11} />You</span>}
                            {!writing && (
                              <div className="mv-cd-tick-tools">
                                <button type="button" className="mv-link" aria-expanded={expanded} onClick={() => setOpenItem(expanded ? '' : item.id)}>Details<ChevronDown size={12} style={expanded ? { transform: 'rotate(180deg)' } : undefined} /></button>
                                <button type="button" className="mv-link" onClick={() => { setEditing(item.id); setDraft(state.note || ''); }}><Pencil size={11} />{state.note ? 'Note' : 'Add note'}</button>
                              </div>
                            )}
                          </div>
                          {expanded && <p className="mv-cd-tick-detail">{item.detail}</p>}
                          {expanded && state.note && !writing && <p className="mv-cd-tick-note">“{state.note}”</p>}
                          {writing && (
                            <div style={{ display: 'grid', gap: 6, marginLeft: 34 }}>
                              <input className="mv-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Optional note or proof" autoFocus />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button type="button" className="mv-btn sm primary" disabled={busy === item.id} onClick={async () => { await save({ itemId: item.id, done: Boolean(state.done), note: draft }, item.id); setEditing(''); }}>Save</button>
                                <button type="button" className="mv-btn sm ghost" onClick={() => setEditing('')}>Cancel</button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <span className="mv-small">{score.complete ? `All ${score.total} items checked for ${product.id}.` : `${score.total - score.done} left to check on ${product.id}.`}</span>
              <button type="button" className="mv-btn primary" onClick={() => go(`launch?product=${product.id}`)}><Rocket size={15} />Next: Launch Ads</button>
            </div>
          </div>

          <aside className="mv-card mv-cd-phone">
            <div className="mv-cd-phone-bar">
              <Smartphone size={14} style={{ flex: 'none' }} />
              <select className="mv-input" style={{ flex: 1, minWidth: 0, padding: '4px 8px' }} value={linkedFile} onChange={e => save({ packet: e.target.value }, 'packet')}>
                <option value="">Pick this product's page…</option>
                {packets.map(p => <option key={p.file} value={p.file}>{p.navLabel || p.file} · {p.productUrl}</option>)}
              </select>
              <button type="button" className="mv-btn sm ghost" title="Reload" onClick={() => setFrameKey(k => k + 1)}><RefreshCw size={13} /></button>
              {packet?.previewUrl && <a className="mv-btn sm ghost" href={(typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? `/api/store-preview?path=${encodeURIComponent(packet.productUrl || '/')}` : packet.previewUrl} target="_blank" rel="noreferrer" title="Open in a new tab"><ExternalLink size={13} /></a>}
            </div>
            {packet?.previewUrl
              ? <iframe key={`${packet.file}:${frameKey}`} title={`Phone preview of ${packet.navLabel || packet.file}`} src={(typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? `/api/store-preview?path=${encodeURIComponent(packet.productUrl || '/')}` : packet.previewUrl} />
              : <div className="mv-empty" style={{ padding: 30 }}><span className="mv-small">Pick the product page above to see it on a phone.</span></div>}
          </aside>
        </div>
      </>}
    </section>
  );
}
