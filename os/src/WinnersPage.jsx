import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Circle, CircleHelp, DollarSign, ExternalLink, FileText, Hammer, LoaderCircle, MessageSquareQuote, ShieldCheck, Trash2, Users, Video, X } from 'lucide-react';
import { api } from './ui.jsx';
import { lineLeadState } from './pipeline.mjs';
import { Chip, assetUrl, leadPhotos, leadVideos } from './kit.jsx';
import { LineTabs } from './LineNav.jsx';
import { statsPanel } from './statsPanel.mjs';
import { Spark, ReadMore, SectionHead } from './cards.jsx';
import { BuyersPanel, EvidenceFlags, GateTiles, HardRules, HeroStats, MediaStage, MetaPanel, MoneyPanel, NumbersPanel, TrendCard } from './ProductParts.jsx';
import { cardName, evidenceFlags, markupOf, trendInDoubt, viralCounts } from './productView.mjs';
import { shortReason } from './productGates.mjs';
import { buildNumbers, sellingPacks, winnerLinks, winnerProof } from './winnerView.mjs';
import './winners.css';

// Step 3 of 7 · Winners (owner, Nov 5):
// "I feel like the product and the verify are more for the agents. The winners are more for me
// to see and I can refute it too. I can reject these products too and once I reject them they
// basically get deleted. If I pass it then move on to the next one, which is making the store
// for it now and making all the stuff."
//
// And (owner, Nov 5): "make it very easy for me to see if its a winner, and all the different links to every
// single thing that has been checked." So: the video beside the verdict, the seven checks as proof cards, then
// every saved link by what it is (winnerView.mjs). The video stays put when the page scrolls.

const BUCKET_META = {
  PAIN: { label: 'Pain & Frustrations (Why They Search)', tone: 'warn' },
  TRIED: { label: 'Failed Alternatives (What They Tried Before)', tone: 'muted' },
  CARE: { label: 'Features Buyers Love (2–5★ Reviews)', tone: 'done' },
  TRIGGER: { label: 'Buying Triggers (What Made Them Order)', tone: 'active' },
};

function parseBuyerQuotes(markdown = '') {
  const quotes = [];
  for (const line of String(markdown).split(/\r?\n/)) {
    const match = line.match(/^\s*\d+\.\s*\*?"?\[?(PAIN|TRIED|CARE|TRIGGER)\]?\s*([^"*]+)"?\*?\s*$/i);
    if (match) {
      quotes.push({
        bucket: match[1].toUpperCase(),
        text: match[2].trim().replace(/^["“]|["”]\s*$/g, ''),
      });
    }
  }
  return quotes;
}

/** One saved link. A search page says so, and a search for some other product is marked. */
function LinkRow({ link, openDoc }) {
  const inner = <>
    {link.kind === 'file' ? <FileText size={13} /> : <ArrowUpRight size={13} />}
    <span title={link.term ? `${link.label}: ${link.term}` : link.url}><b>{link.label}</b>{link.term && <i>{link.term}</i>}{link.note && <i>{link.note}</i>}</span>
    {link.offTopic ? <em title="This search has nothing to do with this product">Other product?</em> : link.kind === 'search' ? <em>Search</em> : null}
  </>;
  const className = `mv-wn-link ${link.offTopic ? 'is-off' : ''}`;
  return link.kind === 'file'
    ? <button type="button" className={className} onClick={() => openDoc(link.url)}>{inner}</button>
    : <a className={className} href={link.url} target="_blank" rel="noreferrer">{inner}</a>;
}

const LINKS_SHOWN = 5;
function LinkList({ links, openDoc }) {
  const [all, setAll] = useState(false);
  return <>
    <div className="mv-wn-card-links">{(all ? links : links.slice(0, LINKS_SHOWN)).map(link => <LinkRow key={link.url} link={link} openDoc={openDoc} />)}</div>
    {links.length > LINKS_SHOWN && <button type="button" className="mv-link mv-wn-more" onClick={() => setAll(!all)}>{all ? 'Show less' : `${links.length - LINKS_SHOWN} more`}</button>}
  </>;
}

const CheckLinks = ({ links, openDoc }) => links.length ? <div className="mv-wn-card-links">{links.slice(0, 3).map(link => <LinkRow key={link.url} link={link} openDoc={openDoc} />)}</div> : null;

export function WinnersPage({ current, leads = [], recordDecision, go, openDoc, notify, route }) {
  const pipeline = current?.pipeline;
  const winners = useMemo(
    () => (pipeline?.active || []).filter(item => item.readyToBuild && item.id !== 'P005' && item.id !== 'L166' && item.id !== 'L264'),
    [pipeline]
  );

  const [selectedId, setSelectedId] = useState(route?.params?.product || '');
  const [activeTab, setActiveTab] = useState('why'); // 'why' | 'angles' | 'reviews' | 'pricing'
  const [buyersDoc, setBuyersDoc] = useState('');
  const [busyDecision, setBusyDecision] = useState('');

  const item = winners.find(w => w.id === selectedId) || winners[0] || null;
  const rawLead = useMemo(() => (item ? leads.find(entry => entry.id === (item.leadId || item.id)) : null), [item, leads]);
  const lead = useMemo(() => (rawLead ? { ...rawLead, state: lineLeadState(rawLead) } : null), [rawLead]);
  const view = useMemo(() => (lead?.candidate ? statsPanel(lead.candidate) : null), [lead?.candidate]);

  const v = item?.validation || view?.validation || null;
  const meta = v?.meta || {};
  const buyersCheck = lead?.candidate?.screen?.checks?.buyers;
  const buyersSource = buyersCheck?.source || '';
  const inDoubt = item ? trendInDoubt(item, pipeline?.active || []) : false;

  useEffect(() => {
    let alive = true;
    setBuyersDoc('');
    if (!buyersSource || /^https?:/i.test(buyersSource)) return undefined;
    const cleanPath = buyersSource.split('#')[0];
    api(`/api/doc?path=${encodeURIComponent(cleanPath)}`)
      .then(res => {
        if (alive) setBuyersDoc(res?.content || '');
      })
      .catch(() => {
        if (alive) setBuyersDoc('');
      });
    return () => {
      alive = false;
    };
  }, [buyersSource]);

  const parsedQuotes = useMemo(() => parseBuyerQuotes(buyersDoc), [buyersDoc]);

  if (!pipeline) {
    return <div className="mv-loading"><LoaderCircle className="mv-spin" size={22} />Opening Winners…</div>;
  }

  async function handleOwnerDecision(decision, label) {
    if (!lead || !recordDecision || busyDecision) return;
    setBusyDecision(decision);
    try {
      const currentIdx = winners.findIndex(w => w.id === item?.id);
      const nextWinner = winners[currentIdx + 1] || winners[currentIdx - 1] || null;
      await recordDecision(lead, decision, { note: `${label} in Winners tab` });
      if (nextWinner) setSelectedId(nextWinner.id);
    } catch (e) {
      notify?.(e.message || 'Could not save decision.');
    } finally {
      setBusyDecision('');
    }
  }

  async function handleApproveAndBuildStore() {
    if (!item || busyDecision) return;
    setBusyDecision('build');
    try {
      const savedVideos = leadVideos(lead);
      const savedPhotos = leadPhotos(lead);
      const { breakEvenCpa: beCpa, targetCpa } = buildNumbers(v);
      const tCpa = targetCpa || Math.round(beCpa * 0.75 * 100) / 100;
      const res = await api('/api/meta-campaigns', {
        action: 'approve-winner-to-build',
        leadId: item.leadId || item.id,
        name: cardName(item.name),
        angle: gapText || lead?.candidate?.decision || '',
        breakEvenCpa: beCpa,
        targetCpa: tCpa,
        savedVideos,
        savedPhotos,
      });
      notify?.(`Approved ${res.productId}! Cloned Store packet (${res.packetFile}) & initialized Creatives, Checklist & Launch.`);
      go(res.packetFile ? `build?packet=${encodeURIComponent(res.packetFile)}` : 'build');
    } catch (e) {
      notify?.(e.message || 'Could not initialize store build.');
    } finally {
      setBusyDecision('');
    }
  }

  const gapText = view?.gap || buyersCheck?.angleGap || meta.gap || meta.note || '';
  const avatars = Array.isArray(buyersCheck?.avatars) && buyersCheck.avatars.length
    ? buyersCheck.avatars.map(a => ({ who: a.who, text: a.trigger }))
    : (view?.avatars || []).map(a => ({ who: a.who, text: [a.problem, a.why].filter(Boolean).join(' · ') }));
  const categoryCompetitors = Array.isArray(lead?.candidate?.screen?.checks?.metaGap?.categoryCompetitors)
    ? lead.candidate.screen.checks.metaGap.categoryCompetitors
    : (Array.isArray(lead?.candidate?.proof?.categoryCompetitors) ? lead.candidate.proof.categoryCompetitors : []);

  const proof = winnerProof(lead?.candidate, v, view);
  const linkGroups = winnerLinks(lead?.candidate, v, view);
  const linkCount = linkGroups.reduce((sum, group) => sum + group.links.length, 0);
  const passed = proof.filter(check => check.state === 'pass').length;
  const flags = item ? evidenceFlags(item, pipeline.active || [], lead?.candidate) : [];
  const jumpTo = id => {
    const card = document.getElementById(`wn-${id}`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('is-flash');
    setTimeout(() => card.classList.remove('is-flash'), 1500);
  };
  const deepTabs = [
    ['why', Video, 'Numbers'],
    ['angles', Users, 'Audience'],
    ['reviews', MessageSquareQuote, 'Reviews'],
    ['pricing', DollarSign, 'Money'],
  ];
  const money = v ? { ...v, tiers: sellingPacks(v.tiers) } : v;

  return (
    <section className="mv-wn">
      <LineTabs active="winners" pipeline={pipeline} go={go} />

      <header className="mv-wn-head">
        <div>
          <span className="mv-eyebrow">Step 3 of 7</span>
          <h1 className="mv-h1">Winners</h1>
          <p>{winners.length ? `${winners.length} passed the hard test. Your call on each.` : 'Nothing is waiting on you.'}</p>
        </div>
        <button type="button" className="mv-btn sm ghost" onClick={() => go('verify')}>
          <ShieldCheck size={14} />See the hard test
        </button>
      </header>

      {!winners.length ? (
        <div className="mv-card mv-empty">
          <strong>No winners right now.</strong>
          <span className="mv-small">A product lands here when it passes every check on Verify.</span>
        </div>
      ) : (
        <>
          <div className="mv-cd-picks" role="group" aria-label="Winners">
            {winners.map(w => {
              const wRaw = leads.find(entry => entry.id === (w.leadId || w.id));
              const photos = wRaw ? leadPhotos(wRaw) : [];
              const photo = w.image || photos[0] || '';
              const wVal = w.validation || (wRaw?.candidate ? statsPanel(wRaw.candidate)?.validation : null);
              const wViral = viralCounts(wVal?.kalodata || {});
              const wMarkup = markupOf(wVal);
              const gmvLabel = wVal?.kalodata?.gmvText || '';
              return (
                <button key={w.id} type="button" className="mv-cd-pick" aria-pressed={w.id === item?.id} onClick={() => setSelectedId(w.id)}>
                  <span className="mv-cd-pick-photo">{photo ? <img src={assetUrl(photo)} alt="" loading="lazy" /> : w.id}</span>
                  <span style={{ minWidth: 0 }}>
                    <strong>{cardName(w.name)}</strong>
                    <small>{[w.id, gmvLabel, wViral.videos ? `${wViral.videos} videos` : '', wMarkup ? `${wMarkup.toFixed(1)}x` : ''].filter(Boolean).join(' · ')}</small>
                  </span>
                </button>
              );
            })}
          </div>

          {item && (
            <>
              <article className="mv-wn-hero">
                <MediaStage key={item.id} item={item} lead={lead} />
                <div className="mv-wn-main">
                  <div className="mv-wn-title">
                    <small>{item.id}</small>
                    <h2 title={item.name}>{cardName(item.name)}</h2>
                  </div>

                  <div className="mv-wn-score">
                    <header className={passed === proof.length ? 'is-pass' : 'is-open'}>
                      {passed === proof.length ? <Check size={15} strokeWidth={3} /> : <CircleHelp size={15} />}
                      {passed} of {proof.length} checks passed
                    </header>
                    <div>
                      {proof.map(check => (
                        <button key={check.id} type="button" className={`mv-wn-mark is-${check.state}`} onClick={() => jumpTo(check.id)} title={check.rule}>
                          <i>{check.state === 'pass' ? <Check size={11} strokeWidth={3} /> : check.state === 'fail' ? <X size={11} strokeWidth={3} /> : <Circle size={8} />}</i>
                          {check.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <HeroStats validation={v} />

                  <div className="mv-wn-decide">
                    <button type="button" className="mv-btn primary" disabled={Boolean(busyDecision)} onClick={handleApproveAndBuildStore}>
                      {busyDecision === 'build' ? <LoaderCircle size={14} className="mv-spin" /> : <Hammer size={15} />}
                      Approve and build the store
                    </button>
                    <button type="button" className="mv-btn" disabled={Boolean(busyDecision)} onClick={() => handleOwnerDecision('passed', 'Passed for now')}>
                      {busyDecision === 'passed' ? <LoaderCircle size={14} className="mv-spin" /> : null}Pass for now
                    </button>
                    <button type="button" className="mv-btn danger" disabled={Boolean(busyDecision)} onClick={() => handleOwnerDecision('rejected', 'Rejected and removed')}>
                      {busyDecision === 'rejected' ? <LoaderCircle size={14} className="mv-spin" /> : <Trash2 size={14} />}Reject
                    </button>
                  </div>

                  {gapText && (
                    <div className="mv-wn-angle">
                      <small>The angle nobody uses</small>
                      <ReadMore text={shortReason(gapText)} lines={3} />
                    </div>
                  )}

                  {linkCount > 0 && (
                    <div className="mv-wn-jump" aria-label="Go to a source">
                      {linkGroups.map(group => {
                        const first = group.links[0];
                        return first.kind === 'file' ? (
                          <button key={group.id} type="button" onClick={() => openDoc(first.url)}><FileText size={13} />{group.title}</button>
                        ) : (
                          <a key={group.id} href={first.url} target="_blank" rel="noreferrer" title={first.url}>{group.title}<ArrowUpRight size={12} /></a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>

              <EvidenceFlags flags={flags} />

              {categoryCompetitors.length > 0 && (
                <section className="mv-wn-section" aria-label="Category competitors and why our mechanism wins">
                  <SectionHead icon={ShieldCheck} title="Category competitors & why our mechanism wins" count={categoryCompetitors.length} />
                  <div className="mv-wn-avatars">
                    {categoryCompetitors.map((cat, index) => (
                      <article key={`${cat.type}-${index}`} className={`mv-wn-avatar is-tile-${(index + 2) % 6 + 1}`}>
                        <strong>{cat.type}</strong>
                        {cat.theyDo && <p><b>What they sell:</b> {cat.theyDo}</p>}
                        {cat.howWeWin && <p style={{ marginTop: 4 }}><b>How we win:</b> {cat.howWeWin}</p>}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {avatars.length > 0 && (
                <section className="mv-wn-section" aria-label="Who buys it">
                  <SectionHead icon={Users} title="Who buys it" count={avatars.length} />
                  <div className="mv-wn-avatars">
                    {avatars.slice(0, 3).map((avatar, index) => (
                      <article key={`${avatar.who}-${index}`} className={`mv-wn-avatar is-tile-${index % 6 + 1}`} title={avatar.text}>
                        <strong>{avatar.who}</strong>
                        {avatar.text && <p>{avatar.text}</p>}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="mv-wn-section" aria-label="The proof">
                <SectionHead icon={ShieldCheck} title="The proof" count={`${passed}/${proof.length}`} />
                <div className="mv-wn-proof">
                  {proof.map(check => (
                    <article key={check.id} id={`wn-${check.id}`} className={`mv-wn-card is-${check.state}`}>
                      <header>
                        <i>{check.state === 'pass' ? <Check size={11} strokeWidth={3} /> : check.state === 'fail' ? <X size={11} strokeWidth={3} /> : <Circle size={8} />}</i>
                        {check.name}
                        {check.observedAt && <time>{check.observedAt.slice(5).replace('-', '/')}</time>}
                      </header>
                      {check.fact.big && (
                        <div className="mv-wn-fact"><b>{check.fact.big}</b>{check.fact.small && <small>{check.fact.small}</small>}</div>
                      )}
                      {check.id === 'uptrend' && v?.series?.points?.length > 1 && <Spark points={v.series.points} tone={inDoubt ? 'doubt' : v.direction} height={44} />}
                      {check.note ? <ReadMore text={check.note} lines={2} /> : <p className="mv-wn-rule">{check.rule}</p>}
                      <CheckLinks links={check.links} openDoc={openDoc} />
                    </article>
                  ))}
                </div>
              </section>

              {linkCount > 0 && (
                <section className="mv-wn-section" id="wn-links" aria-label="Every link">
                  <SectionHead icon={ExternalLink} title="Every link" count={linkCount} />
                  <div className="mv-wn-groups">
                    {linkGroups.map((group, index) => (
                      <article key={group.id} className={`mv-wn-group is-tile-${index % 6 + 1}`}>
                        <header>{group.title}<b>{group.links.length}</b></header>
                        <LinkList links={group.links} openDoc={openDoc} />
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="mv-wn-section" aria-label="Go deeper">
                <nav className="mv-stage-tabs" aria-label="Go deeper">
                  {deepTabs.map(([id, Icon, label]) => (
                    <button key={id} type="button" className="mv-stage-tab" aria-current={activeTab === id ? 'page' : undefined} onClick={() => setActiveTab(id)}>
                      <Icon size={14} />{label}
                    </button>
                  ))}
                </nav>
                <div className="mv-card mv-pad mv-wn-deep">
                  {activeTab === 'why' && (
                    <>
                      {v && (
                        <div className="mv-pp-signal">
                          <TrendCard validation={v} inDoubt={inDoubt} trendUrl={view?.trendUrl} />
                          <HardRules rules={v.fiveRules} />
                        </div>
                      )}
                      <NumbersPanel validation={v} view={view} openDoc={openDoc} />
                      <div className="mv-wn-divider"><h3 className="mv-h3">Who else is on Meta</h3><MetaPanel validation={v} /></div>
                      {view?.gates?.length > 0 && <div className="mv-wn-divider"><h3 className="mv-h3">The first checks (F1–F6)</h3><GateTiles gates={view.gates} /></div>}
                    </>
                  )}
                  {activeTab === 'angles' && <BuyersPanel view={view} candidate={lead?.candidate} openDoc={openDoc} />}
                  {activeTab === 'reviews' && (
                    <>
                      {buyersSource && (
                        <div className="mv-wn-reviews"><button type="button" className="mv-btn sm ghost" onClick={() => openDoc(buyersSource)}><FileText size={14} />Open the buyers file</button></div>
                      )}
                      {parsedQuotes.length > 0 ? (
                        <div className="mv-wn-quotes">
                          {Object.entries(BUCKET_META).map(([bucket, metaInfo]) => {
                            const inBucket = parsedQuotes.filter(quote => quote.bucket === bucket);
                            if (!inBucket.length) return null;
                            return (
                              <div key={bucket} className="mv-wn-bucket">
                                <div><Chip tone={metaInfo.tone}>{bucket}</Chip><span className="mv-small">{inBucket.length}</span></div>
                                <strong>{metaInfo.label}</strong>
                                <ul>{inBucket.map((quote, index) => <li key={index}>“{quote.text}”</li>)}</ul>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <BuyersPanel view={view} candidate={lead?.candidate} openDoc={openDoc} />
                      )}
                    </>
                  )}
                  {activeTab === 'pricing' && <MoneyPanel validation={money} view={view} />}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </section>
  );
}
