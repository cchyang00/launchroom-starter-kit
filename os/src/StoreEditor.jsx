import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Store,Send,Undo2,Save,X,Lock,ImageIcon,Smartphone,RefreshCw,History,UserPen,AlertTriangle,CheckCircle2,Search,ExternalLink,LoaderCircle,Eye,Layers,ShoppingBag,Sparkles,Copy,Check,Palette,Plus,ArrowLeft,ArrowRight,Maximize2,Minimize2,FileText,ShieldCheck,TrendingUp} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet,assetUrl,timeAgo,Chip} from './kit.jsx';
import {LineTabs} from './LineNav.jsx';
import {isCampaignLaunched} from './displayLine.mjs';
import {conditionHint,valueText,THEME_TOKENS} from './storeEditorModel.mjs';
import './storeEditor.css';

// Pipeline Step 3 · Store (#/build) vs. Hub · Store & Theme Hub (#/store)
// Owner, Nov 5:
// "My vision for the Store tab is that this is really where we start to build the store.
// In the hub there's a Store and Theme hub. I think the Store and Theme hub should just be
// a place where we store our themes. That's all but the Store, that's really where we
// actually build the entire store. We should see the Store on the right. It should be
// easily viewable and I can scroll through and look along with you. That's where we build
// it together... Anything really to store, pretty much anything that has to do with the
// store, the product itself, and the admin stuff for Shopify, that's where we do it here."

const imageUrl = src => assetUrl(`hydrogen-storefront/public${src}`);
const timeOf = at => {try {return new Date(at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});} catch {return '';}};
const dayTime = at => {try {const d = new Date(at);return `${d.toLocaleDateString([], {month:'short',day:'numeric'})}, ${timeOf(at)}`;} catch {return '';}};
const short = (value,n=90) => {const text = valueText(value).replace(/\s+/g,' ').trim();return text.length>n?`${text.slice(0,n-1)}…`:text;};

function errorWords(error) {
  switch (error?.code) {
    case 'PACKET_CHANGED': return 'An agent saved this page while you were editing. Your draft was kept on screen; reload before saving.';
    case 'NOTHING_CHANGED': return 'Nothing to save: those fields already say that.';
    case 'IMAGE_NOT_IN_STORE': return 'Pick a picture from the store’s images. Uploading comes later.';
    case 'PUBLISH_PENDING': return 'You already asked the Store Builder to publish. Wait for that to finish.';
    case 'CHECK_UNAVAILABLE': return 'The store check is missing, so nothing can be saved right now. Ask your agent to look at it.';
    default: return error?.message || 'That didn’t save. Try again.';
  }
}

function Field({field,value,pending,owner,onChange,onPick}) {
  const changed = pending!==undefined;
  const shown = changed?pending:field.value;
  const hint = conditionHint(field,shown);
  const id = `mv-se-f-${field.path.replace(/\./g,'-')}`;
  if (field.kind==='fixed') return <div className="mv-se-field is-fixed">
    <span className="mv-se-label">{field.label}</span>
    <div className="mv-se-fixed"><Lock size={13}/><strong>{String(field.value)}{field.unit||''}</strong><small>{field.note}</small></div>
  </div>;
  if (field.kind==='image') return <div className={`mv-se-field is-image ${changed?'is-changed':''}`}>
    <span className="mv-se-label">{field.label}{owner&&<span className="mv-se-mine" title={`You edited this ${dayTime(owner.at)}`}><UserPen size={11}/>Yours</span>}</span>
    <div className="mv-se-image">
      {shown?<img src={imageUrl(shown)} alt="" loading="lazy"/>:<span className="mv-se-image-empty"><ImageIcon size={18}/></span>}
      <div><code title={shown}>{shown||'No picture'}</code><button type="button" className="mv-btn sm" onClick={()=>onPick(field)}><ImageIcon size={14}/>Change picture</button>{changed&&<button type="button" className="mv-se-revert" onClick={()=>onChange(field,undefined)}>Keep the old one</button>}</div>
    </div>
  </div>;
  const Input = field.kind==='text'?'textarea':'input';
  return <div className={`mv-se-field ${changed?'is-changed':''}`}>
    <label className="mv-se-label" htmlFor={id}>{field.label}{owner&&<span className="mv-se-mine" title={`You edited this ${dayTime(owner.at)}`}><UserPen size={11}/>Yours</span>}{changed&&<span className="mv-se-dot">Not saved</span>}</label>
    <Input id={id} className={field.kind==='text'?'mv-se-textarea':'mv-input'} value={shown} rows={field.kind==='text'?Math.min(8,Math.max(2,Math.ceil(String(shown).length/60)+String(shown).split('\n').length-1)):undefined}
      onChange={event=>onChange(field,event.target.value)} spellCheck="true"/>
    {hint?<p className="mv-se-warn"><AlertTriangle size={13}/>{hint} This will be refused on save.</p>:field.hint&&<small className="mv-se-hint">{field.hint}</small>}
  </div>;
}

function groupFields(fields) {
  const groups = [];
  for (const field of fields) {
    const match = field.path.match(/^(.*?\.(?:items|steps|rows|gallery|offerChoices|disclosures))\.(\d+)\./);
    const key = match?`${match[1]}.${match[2]}`:'';
    const last = groups.at(-1);
    if (last&&last.key===key&&key) last.fields.push(field);
    else groups.push({key,index:match?Number(match[2]):-1,review:match?.[1]==='reviews.items',fields:[field]});
  }
  return groups;
}

function ColorsSection({section,colors,pendingTheme,owner,previewId,onPreview,onUse,busy}) {
  const field = section?.fields?.[0] || {};
  if (!colors?.count) return <p className="mv-se-hint">No palettes found in app/content/palettes.ts. Ask your agent to add them.</p>;
  const all = colors.groups.flatMap(group=>group.palettes);
  const current = all.find(p=>p.id===colors.current);
  const previewing = all.find(p=>p.id===previewId);
  return <div className="mv-se-colors">
    <div className="mv-se-colors-now">
      <span className="mv-se-label">Active palette{owner&&<span className="mv-se-mine"><UserPen size={11}/>Yours</span>}</span>
      <div className="mv-se-swatch-row">{THEME_TOKENS.slice(0,6).map(key=><i key={key} style={{background:field.value?.[key]}}/>)}</div>
      <strong>{current?.name||field.value?.name||'Custom palette'}</strong>
      <small>Click any palette below to preview it live in the Store on the right.</small>
    </div>
    {previewing&&<div className="mv-se-colors-try" role="status">
      <Eye size={15}/><span>Previewing <strong>{previewing.name}</strong> in the live store on the right.</span>
      <button type="button" className="mv-btn sm primary" disabled={busy||previewing.id===colors.current} onClick={()=>onUse(previewing)}>{busy?<LoaderCircle size={14} className="mv-spin"/>:<CheckCircle2 size={14}/>}Apply palette</button>
      <button type="button" className="mv-btn sm ghost" onClick={()=>onPreview(null)}>Cancel preview</button>
    </div>}
    {colors.groups.map(group=><div key={group.name} className="mv-se-mood">
      <h4>{group.name}</h4>{group.note&&<p className="mv-se-mood-note">{group.note}</p>}
      <div className="mv-se-palettes">{group.palettes.map(palette=><button type="button" key={palette.id} className={`mv-se-palette ${palette.id===colors.current?'is-current':''} ${palette.id===previewId?'is-preview':''}`} aria-pressed={palette.id===previewId} onClick={()=>onPreview(palette.id===previewId?null:palette)} title={palette.goodFor||palette.name}>
        <span className="mv-se-palette-paper" style={{background:palette.colors.paper,color:palette.colors.ink}}>
          <span className="mv-se-palette-bar" style={{background:palette.colors.accent,color:palette.colors.onAccent}}>Aa</span>
          <span className="mv-se-palette-dots">{['ink','accentText','highlight','shade'].map(key=><i key={key} style={{background:palette.colors[key]}}/>)}</span>
        </span>
        <strong>{palette.name}</strong>
        {palette.goodFor&&<small>{palette.goodFor}</small>}
        {palette.id===colors.current&&<em>Active</em>}
      </button>)}</div>
    </div>)}
    {pendingTheme&&<p className="mv-se-hint">Saving the palette…</p>}
  </div>;
}

function ImagePicker({field,images,onPick,onClose}) {
  const [query,setQuery] = useState('');
  const list = images.filter(image=>!query||image.src.toLowerCase().includes(query.toLowerCase()));
  return <Sheet wide title={`Choose ${field.label.toLowerCase()}`} subtitle="Pictures already in the store (hydrogen-storefront/public/images)." onClose={onClose}>
    <label className="mv-se-pick-search"><Search size={15}/><input className="mv-input" placeholder="Search pictures" value={query} onChange={event=>setQuery(event.target.value)} autoFocus/></label>
    <div className="mv-se-pick-grid">{list.map(image=><button type="button" key={image.src} className={`mv-se-pick ${image.src===field.value?'is-current':''}`} onClick={()=>{onPick(field,image.src);onClose();}}>
      <img src={imageUrl(image.src)} alt="" loading="lazy"/><span>{image.folder?`${image.folder}/`:''}{image.name}</span>{image.src===field.value&&<em>Now</em>}
    </button>)}{!list.length&&<p className="mv-se-hint">No picture matches.</p>}</div>
  </Sheet>;
}

function PhonePreview({view,storeUp,frameKey,frameRef,onReload,onLoad,widePreview,onToggleWide}) {
  const routePath = view?.packet?.productUrl || '/';
  const isRemote = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const url = isRemote ? `/api/store-preview?path=${encodeURIComponent(routePath)}` : view?.preview?.url;
  return <aside className="mv-se-preview is-open" aria-label="Live store preview">
    <div className="mv-se-preview-head">
      <Smartphone size={15}/>
      <strong>Live Store</strong>
      <code style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{routePath}</code>
      <span/>
      {onToggleWide&&<button type="button" className="mv-icon-btn" title={widePreview?'Switch to phone width (375px)':'Expand preview width'} onClick={onToggleWide}>{widePreview?<Minimize2 size={14}/>:<Maximize2 size={14}/>}</button>}
      <button type="button" className="mv-icon-btn" title="Reload the preview" aria-label="Reload the preview" onClick={onReload}><RefreshCw size={14}/></button>
      {url&&<a className="mv-icon-btn" href={url} target="_blank" rel="noreferrer" title="Open this store page in a full tab" aria-label="Open this store page in a full tab"><ExternalLink size={14}/></a>}
    </div>
    {storeUp===false?<div className="mv-se-down"><AlertTriangle size={18}/><strong>The store preview is off.</strong><p>Nothing is running at {(view?.preview?.origin||'').replace(/^http:\/\//,'')}. Your edits still save; ask the manager to start the store preview (`localhost:3021`).</p><button type="button" className="mv-btn sm" onClick={onReload}><RefreshCw size={14}/>Check again</button></div>
      :<div className="mv-se-phone"><iframe key={`${view?.packet?.file||'p'}-${frameKey}`} ref={frameRef} title="The product page on a phone" src={url} onLoad={onLoad}/></div>}
  </aside>;
}

const THEME_FILES = [
  {label: '★ Master Base Theme (base-theme.json — Military-Grade Water Purifier Floor)', path: 'hydrogen-storefront/app/content/base-theme.json', role: 'The 10/10 Master Base Theme floor (built from portable-water-purifier-pump.json: Hero + 4 Checkmark Benefits + 1-Kit/2-Kit + 3 Creator Videos + Don\'t Wait Until The Tap Runs Dry + Comparison + Customer Reviews + Guarantee + FAQ + Cart-Drawer Upsells) that we clone for every new product'},
  {label: '1-Command Agent Cloner (new <slug> --palette <id>)', path: 'node scripts/packet-tools.mjs new <slug> --palette slate-and-ice --live', role: 'Clones base-theme.json (our Military-Grade Water Purifier floor) into app/content/<slug>.json with any of our 52 WCAG-verified palettes pre-applied'},
  {label: '52-Palette Theme Library (7 Mood Groups)', path: 'hydrogen-storefront/app/content/palettes.json', role: '52 curated per-product color palettes (Holiday Crimson & Pine, Warm Parchment & Espresso, Emerald & Champagne, Nordic Pine, Calm & Sleep, Focus, etc.)'},
  {label: 'Multi-Product Packet Registry', path: 'hydrogen-storefront/app/content/templates.ts', role: 'Maps every app/content/<handle>.json packet to /products/<handle> with its own copy, gallery, palette & upsells'},
  {label: 'Dynamic Product Route (/products/<handle>)', path: 'hydrogen-storefront/app/routes/products.$handle.tsx', role: 'Renders ProductExperience + per-product theme palette CSS for every active product handle'},
  {label: 'Hero & 1-Kit / 2-Kit Selector', path: 'hydrogen-storefront/app/components/ProductExperience.tsx', role: 'Phone-first gallery, rating bar, headline, 1-Kit / 2-Kit selector & Add to bag'},
  {label: 'Slide-Out Cart Drawer + $4.99 Shipping Protection + 2-Kit Upgrade', path: 'hydrogen-storefront/app/components/CartSummary.tsx', role: 'Cart drawer $4.99 Shipping & Transit Protection toggle + 1-tap 1-Kit → 2-Kit upgrade banner'},
];

function ThemeBlueprintHub() {
  const [copied, setCopied] = useState('');
  const copyText = (text) => {
    try { navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1800); } catch {}
  };
  return (
    <div style={{display: 'grid', gap: 16}}>
      <section className="mv-card mv-pad">
        <div className="mv-panel-title" style={{marginBottom: 10}}>
          <h2 className="mv-h3" style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <Layers size={16} />
            Master Store Theme Architecture (merrivy.com/products/&lt;handle&gt;)
          </h2>
          <Chip tone="done">1 Master Theme · 52 Color Palettes</Chip>
        </div>
        <p className="mv-small" style={{margin: '0 0 12px', lineHeight: 1.5}}>
          The <strong>Store &amp; Theme Hub</strong> stores our Master Base Theme (<code>base-theme.json</code>) and 52 color palettes. When we build a product store in the Pipeline <strong>Store</strong> tab (<code>#/build</code>), it clones this theme into <code>hydrogen-storefront/app/content/&lt;handle&gt;.json</code>.
        </p>
        <div style={{display: 'grid', gap: 8}}>
          {THEME_FILES.map((item) => (
            <div key={item.path} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface-2)'}}>
              <div style={{minWidth: 0}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                  <strong style={{fontSize: 13}}>{item.label}</strong>
                  <code style={{fontSize: 11.5, color: 'var(--accent-text)'}}>{item.path}</code>
                </div>
                <div style={{fontSize: 12, color: 'var(--muted)'}}>{item.role}</div>
              </div>
              <button type="button" className="mv-btn sm ghost" onClick={() => copyText(item.path)}>
                {copied === item.path ? <Check size={13} /> : <Copy size={13} />}
                {copied === item.path ? 'Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Visual Media Grid for all pictures on this product's store page. */
function StoreMediaGrid({sections, pending, ownerByPath, onPick}) {
  const imageFields = useMemo(() => {
    const list = [];
    for (const section of sections || []) {
      for (const field of section.fields || []) {
        if (field.kind === 'image') list.push({...field, sectionTitle: section.title});
      }
    }
    return list;
  }, [sections]);

  return (
    <section className="mv-card mv-pad" style={{display: 'grid', gap: 14}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
        <div>
          <h2 className="mv-h3">Store Pictures &amp; Gallery Slots ({imageFields.length})</h2>
          <p className="mv-small">Every image slot on this product's store page. Click any picture to swap it while looking at the live Store on the right.</p>
        </div>
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 12}}>
        {imageFields.map(field => {
          const shown = pending.has(field.path) ? pending.get(field.path) : field.value;
          const owner = ownerByPath.get(field.path);
          return (
            <article key={field.path} className="mv-card" style={{padding: 10, display: 'grid', gap: 8, alignContent: 'start'}}>
              <div style={{aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center'}}>
                {shown ? <img src={imageUrl(shown)} alt="" loading="lazy" style={{width: '100%', height: '100%', objectFit: 'cover'}} /> : <ImageIcon size={22} />}
              </div>
              <div style={{minWidth: 0}}>
                <span className="mv-small" style={{display: 'block', fontSize: 10.5}}>{field.sectionTitle}</span>
                <strong style={{fontSize: 12.5, display: 'block'}}>{field.label}</strong>
                <code style={{fontSize: 10.5, color: 'var(--muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={shown}>{shown || 'Empty'}</code>
              </div>
              <button type="button" className="mv-btn sm ghost" onClick={() => onPick(field)}>
                <ImageIcon size={13} />Swap Picture
              </button>
              {owner && <span className="mv-se-mine"><UserPen size={10} />Edited by you</span>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Dedicated Shopify Admin & Product Setup workspace inside the Pipeline Store tab (#/build). */
function ShopifyAdminWorkspace({view, fields, pending, ownerByPath, onChange, onPick, go}) {
  const [copiedKey, setCopiedKey] = useState('');
  const copyVal = (key, text) => {
    try { navigator.clipboard.writeText(String(text || '')); setCopiedKey(key); setTimeout(() => setCopiedKey(''), 1800); } catch {}
  };

  const handleSlug = String(view?.packet?.productUrl || '').replace(/^\/products\//, '').replace(/^\//, '') || String(view?.packet?.file || '').replace(/\.json$/i, '');
  const liveStoreUrl = `https://merrivy.com/products/${handleSlug}`;
  const titleField = fields.get('navLabel');
  const headlineField = fields.get('hero.headline');
  const hookField = fields.get('purchase.hook');
  const descField = fields.get('purchase.description');

  // Offer choices (1-Kit & 2-Kit)
  const offerFields = [...fields.values()].filter(f => f.path.startsWith('purchase.offerChoices.') || f.path.startsWith('bundle.'));
  const disclosureFields = [...fields.values()].filter(f => f.path.startsWith('purchase.disclosures.'));

  const currentTitle = pending.get('navLabel') ?? titleField?.value ?? handleSlug;
  const currentHook = pending.get('purchase.hook') ?? hookField?.value ?? '';
  const currentDesc = pending.get('purchase.description') ?? descField?.value ?? '';

  return (
    <div style={{display: 'grid', gap: 16}}>
      <section className="mv-card mv-pad" style={{display: 'grid', gap: 14}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap'}}>
          <div>
            <span className="mv-eyebrow">Shopify Admin &amp; Store Setup (ndfdtc-br)</span>
            <h2 className="mv-h3" style={{marginTop: 2}}>Shopify Product, 1-Kit / 2-Kit Variants, Descriptions &amp; Meta Pixel</h2>
            <p className="mv-small">Everything needed to set up this product in Shopify Admin so variants, descriptions, $4.99 shipping/protection, and Meta Pixel match the storefront 1:1.</p>
          </div>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <a className="mv-btn sm primary" href="https://admin.shopify.com/store/ndfdtc-br/products" target="_blank" rel="noreferrer">
              <ExternalLink size={13} />Open Shopify Products
            </a>
            <a className="mv-btn sm ghost" href="https://admin.shopify.com/store/ndfdtc-br/settings/shipping" target="_blank" rel="noreferrer">
              <ExternalLink size={13} />Shipping ($4.99s)
            </a>
            <a className="mv-btn sm ghost" href="https://admin.shopify.com/store/ndfdtc-br/settings/customer_events" target="_blank" rel="noreferrer">
              <ExternalLink size={13} />Meta Pixel Settings
            </a>
          </div>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10}}>
          <div className="mv-card mv-pad" style={{background: 'var(--bg-1)', display: 'grid', gap: 6}}>
            <span className="mv-small">Shopify Product Handle</span>
            <code style={{fontWeight: 700, fontSize: 13}}>{handleSlug}</code>
            <button type="button" className="mv-btn sm ghost" onClick={() => copyVal('handle', handleSlug)}>
              {copiedKey === 'handle' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'handle' ? 'Copied Handle' : 'Copy Handle'}
            </button>
          </div>

          <div className="mv-card mv-pad" style={{background: 'var(--bg-1)', display: 'grid', gap: 6}}>
            <span className="mv-small">Live Product URL</span>
            <code style={{fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={liveStoreUrl}>{liveStoreUrl}</code>
            <button type="button" className="mv-btn sm ghost" onClick={() => copyVal('url', liveStoreUrl)}>
              {copiedKey === 'url' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'url' ? 'Copied URL' : 'Copy Store URL'}
            </button>
          </div>

          <div className="mv-card mv-pad" style={{background: 'var(--bg-1)', display: 'grid', gap: 6}}>
            <span className="mv-small">Shopify Variants &amp; Shipping</span>
            <strong style={{fontSize: 13}}>1-Kit &amp; 2-Kit Only + $4.99s</strong>
            <span className="mv-small">No 3-Kit tier · No add-on headaches</span>
          </div>

          <div className="mv-card mv-pad" style={{background: 'var(--bg-1)', display: 'grid', gap: 6}}>
            <span className="mv-small">Meta Pixel &amp; Shopify CAPI</span>
            <strong style={{fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6}}>
              <ShieldCheck size={14} style={{color: 'var(--success)'}} />Pixel 955359040485060
            </strong>
            <span className="mv-small">Online Store + CAPI Active</span>
          </div>
        </div>
      </section>

      <section className="mv-card mv-pad" style={{display: 'grid', gap: 12}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
          <div>
            <h3 className="mv-h3">1. Product Title &amp; Description (Storefront + Shopify Admin)</h3>
            <p className="mv-small">Edit the product title, reveal headline, and description here, or copy them straight into Shopify Admin.</p>
          </div>
          <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
            <button type="button" className="mv-btn sm ghost" onClick={() => copyVal('title', currentTitle)}>
              {copiedKey === 'title' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'title' ? 'Copied Title' : 'Copy Title for Shopify'}
            </button>
            <button type="button" className="mv-btn sm ghost" onClick={() => copyVal('desc', `${currentHook}\n\n${currentDesc}`.trim())}>
              {copiedKey === 'desc' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'desc' ? 'Copied Description' : 'Copy Description for Shopify'}
            </button>
          </div>
        </div>
        <div className="mv-se-fields">
          {[titleField, headlineField, hookField, descField].filter(Boolean).map(field => (
            <Field key={field.path} field={field} value={field.value} pending={pending.get(field.path)} owner={ownerByPath.get(field.path)} onChange={onChange} onPick={onPick} />
          ))}
        </div>
      </section>

      {offerFields.length > 0 && (
        <section className="mv-card mv-pad" style={{display: 'grid', gap: 12}}>
          <div>
            <h3 className="mv-h3">2. 1-Kit &amp; 2-Kit Variant Options &amp; Upsell Copy</h3>
            <p className="mv-small">Keep only 1-Kit and 2-Kit options active (no 3-Kit tier or messy physical add-ons), matched to Shopify Admin variants and $4.99 shipping/protection.</p>
          </div>
          <div className="mv-se-fields">
            {offerFields.map(field => (
              <Field key={field.path} field={field} value={field.value} pending={pending.get(field.path)} owner={ownerByPath.get(field.path)} onChange={onChange} onPick={onPick} />
            ))}
          </div>
        </section>
      )}

      {disclosureFields.length > 0 && (
        <section className="mv-card mv-pad" style={{display: 'grid', gap: 12}}>
          <div>
            <h3 className="mv-h3">3. Specifications, Shipping ($4.99 / Free 2-Kit) &amp; 30-Day Guarantee Tabs</h3>
            <p className="mv-small">Accordion tabs shown directly under the Add to Bag button on the product page.</p>
          </div>
          <div className="mv-se-fields">
            {disclosureFields.map(field => (
              <Field key={field.path} field={field} value={field.value} pending={pending.get(field.path)} owner={ownerByPath.get(field.path)} onChange={onChange} onPick={onPick} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function StoreEditor({isMerrivy=true, notify, mode='hub', current, hub, go, route}) {
  const isPipeline = mode === 'pipeline';
  const pipeline = current?.pipeline;
  const [view,setView] = useState(null),[loadError,setLoadError] = useState('');
  const [file,setFile] = useState(() => route?.params?.packet || '');
  const [pending,setPending] = useState(()=>new Map());
  const [busy,setBusy] = useState(''),[failure,setFailure] = useState(null),[note,setNote] = useState('');
  const [picker,setPicker] = useState(null),[publishOpen,setPublishOpen] = useState(false),[historyOpen,setHistoryOpen] = useState(false),[cloneOpen,setCloneOpen] = useState(false);
  const [storeUp,setStoreUp] = useState(null),[frameKey,setFrameKey] = useState(0),[previewId,setPreviewId] = useState(null),[widePreview,setWidePreview] = useState(false);
  const [workTab, setWorkTab] = useState('copy'); // 'copy' | 'media' | 'shopify' | 'colors' (in pipeline mode)
  const [hubTab, setHubTab] = useState('palettes'); // 'palettes' | 'blueprint' (in hub mode)
  const [sectionId,setSectionId] = useState('');
  const frameRef = useRef(null), previewRef = useRef(null), failureRef = useRef(null);

  useEffect(()=>{if(failure)failureRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[failure]);
  const fields = useMemo(()=>view?.sections?new Map(view.sections.flatMap(s=>s.fields.map(f=>[f.path,f]))):new Map(),[view]);
  const ownerByPath = useMemo(()=>new Map((view?.ownerEdits||[]).filter(edit=>edit.kept).map(edit=>[edit.path,edit])),[view]);
  const palettes = useMemo(()=>(view?.colors?.groups||[]).flatMap(group=>group.palettes),[view]);

  const load = useCallback(async(packet=file)=>{
    const targetPacket = !packet && !isPipeline ? 'base-theme.json' : packet;
    try {
      const next = await api(`/api/store-editor${targetPacket?`?packet=${encodeURIComponent(targetPacket)}`:''}`);
      // In pipeline mode, if the default packet returned is base-theme.json and real product packets exist, load the first real product packet!
      if (isPipeline && !packet && next?.packet?.file === 'base-theme.json') {
        const firstReal = (next.packets || []).find(p => p.file !== 'base-theme.json');
        if (firstReal) {
          const realView = await api(`/api/store-editor?packet=${encodeURIComponent(firstReal.file)}`);
          setView(realView);
          setLoadError('');
          setFile(firstReal.file);
          return realView;
        }
      }
      setView(next);
      setLoadError('');
      if(next?.packet) setFile(next.packet.file);
      return next;
    } catch (error) {
      setLoadError(error.message);
      return null;
    }
  },[file, isPipeline]);

  useEffect(()=>{load();},[]);// eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{const timer = setInterval(()=>{if(!pending.size&&!busy)load();},15000);return()=>clearInterval(timer);},[pending,busy,load]);

  const ping = useCallback(async()=>{
    if (!view?.preview?.origin) return;
    const isRemote = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    try {
      if (isRemote) { const r = await fetch('/api/store-preview?path=%2F', {cache:'no-store'}); setStoreUp(r.ok); }
      else { await fetch(view.preview.origin+'/',{mode:'no-cors',cache:'no-store'}); setStoreUp(true); }
    } catch {setStoreUp(false);}
  },[view?.preview?.origin]);
  useEffect(()=>{ping();const timer = setInterval(ping,20000);return()=>clearInterval(timer);},[ping]);

  previewRef.current = previewId?palettes.find(p=>p.id===previewId):null;
  const sendPreview = useCallback(()=>{
    const win = frameRef.current?.contentWindow, origin = view?.preview?.origin;
    if (!win||!origin) return;
    try {win.postMessage({type:'launchroom:palette',palette:previewRef.current?.colors||null},origin);} catch {}
  },[view?.preview?.origin]);
  useEffect(()=>{sendPreview();},[previewId,sendPreview]);
  useEffect(()=>{
    const onMessage = event=>{if(event.origin===view?.preview?.origin&&event.data?.type==='launchroom:ready')sendPreview();};
    window.addEventListener('message',onMessage);return()=>window.removeEventListener('message',onMessage);
  },[view?.preview?.origin,sendPreview]);
  const reloadPreview = useCallback((delay=0)=>{setTimeout(()=>{setFrameKey(k=>k+1);ping();},delay);},[ping]);

  const change = (field,value)=>setPending(prev=>{const next = new Map(prev);if(value===undefined||value===field.value)next.delete(field.path);else next.set(field.path,value);return next;});
  async function save(changes,{label}={}) {
    if (!view?.packet) return;
    setBusy('save');setFailure(null);setNote('');
    try {
      const result = await api('/api/store-editor/save',{packet:view.packet.file,hash:view.packet.hash,changes});
      setView(result);
      setPending(prev=>{const next = new Map(prev);for(const item of changes)next.delete(item.path);return next;});
      const names = result.save.changes.map(c=>c.label);
      setNote(`Saved: ${names.slice(0,3).join(', ')}${names.length>3?` and ${names.length-3} more`:''}. The store preview on the right updates in a moment.`);
      notify?.(label||`Saved ${names.length} ${names.length===1?'change':'changes'} to the store page.`);
      reloadPreview(900);
      return result;
    } catch (error) {setFailure(error);return null;} finally {setBusy('');}
  }
  const saveAll = ()=>save([...pending].map(([path,value])=>({path,value})));
  async function undo(saveItem) {
    setBusy(`undo-${saveItem.id}`);setFailure(null);setNote('');
    try {const result = await api('/api/store-editor/undo',{packet:view.packet.file,hash:view.packet.hash,saveId:saveItem.id});setView(result);setNote(`Undone: ${saveItem.changes.map(c=>c.label).join(', ')}.`);notify?.('Undone. The page is back to how it was.');reloadPreview(900);}
    catch (error) {setFailure(error);} finally {setBusy('');}
  }
  async function publish() {
    setBusy('publish');setFailure(null);
    try {const result = await api('/api/store-editor/publish',{packet:view.packet.file});setView(result);setPublishOpen(false);notify?.('Publishing approved. Recorded on Today.');}
    catch (error) {setFailure(error);setPublishOpen(false);} finally {setBusy('');}
  }
  async function loadLatest() {const next = await load(view?.packet?.file);if(next)setFailure(null);}
  async function usePalette(palette) {const done = await save([{path:'theme',value:palette.id}],{label:`${palette.name} is now the store’s palette.`});if(done)setPreviewId(null);}

  if (!isMerrivy) return <div className="mv-empty">This project has no store yet. The Store editor works on a project with a Hydrogen storefront.</div>;
  if (loadError&&!view) return <div className="mv-error">{loadError}</div>;
  if (!view) return <div className="mv-loading"><LoaderCircle className="mv-spin" size={22}/>Opening the store…</div>;
  if (!view.packet) return <div className="mv-empty">No product packet in hydrogen-storefront/app/content yet. Ask the Store Builder to create one.</div>;

  const publishState = view.publish||{};
  const problems = view.problems;
  const pendingTheme = busy==='save'&&pending.has('theme');
  const failureBox = failure&&<div ref={failureRef} className="mv-se-failure" role="alert">
      <div><AlertTriangle size={16}/><strong>{failure.code==='PACKET_CHECK'?'Not saved: the store check said no.':'Not saved.'}</strong></div>
      {failure.code==='PACKET_CHECK'&&failure.details?.problems?.length?<ul>{failure.details.problems.map(item=><li key={item.problem}><span>{item.plain}</span><code>{item.problem}</code></li>)}</ul>:<p>{errorWords(failure)}</p>}
      <div className="mv-se-failure-actions">{failure.code==='PACKET_CHANGED'&&<button className="mv-btn sm primary" onClick={loadLatest}><RefreshCw size={14}/>Load the latest (keeps your edits)</button>}<button className="mv-btn sm ghost" onClick={()=>setFailure(null)}>Close</button></div>
  </div>;

  const copySections = (view.sections || []).filter(s => s.id !== 'colors');
  const colorSection = (view.sections || []).find(s => s.id === 'colors') || view.sections?.[0];
  const shownIndex = Math.max(0, copySections.findIndex(section=>section.id===sectionId));
  const shown = copySections[shownIndex] || view.sections[0];
  const previous = copySections[shownIndex-1], following = copySections[shownIndex+1];
  const unsavedIn = section=>section.fields.filter(field=>pending.has(field.path)).length;
  const openSection = id=>{setSectionId(id);document.querySelector('.mv-se-tabs')?.scrollIntoView({behavior:'smooth',block:'nearest'});};

  // In pipeline mode (#/build), exclude stores whose campaigns have already launched and moved to Manage
  // (unless explicitly opened via ?packet= from Manage -> Store & CRO)
  const launchedStorePaths = new Set(
    (hub?.metaCampaigns || [])
      .filter(isCampaignLaunched)
      .map(c => {
        try { return new URL(c.storeUrl || '').pathname.replace(/\/$/, ''); } catch { return ''; }
      })
      .filter(Boolean)
  );
  const productPackets = (view.packets || []).filter(p => p.file !== 'base-theme.json');
  const unlaunchedPackets = productPackets.filter(
    p => !launchedStorePaths.has(String(p.productUrl || '').replace(/\/$/, '')) || p.file === route?.params?.packet
  );
  const displayedPackets = isPipeline ? unlaunchedPackets : (view.packets || []);

  // ============================================================================
  // MODE 1: HUB (#/store — Theme & Palette Vault)
  // ============================================================================
  if (!isPipeline) {
    return <div className="mv-se">
      <div className="mv-page-head">
        <div>
          <span className="mv-eyebrow">Hub · Themes, Blueprints &amp; 52 Color Palettes</span>
          <h1 className="mv-h1">Store &amp; Theme Hub</h1>
          <p className="mv-sub">Where we store our Master Base Theme and 52 WCAG AA color palettes. Preview themes on the right, or clone a theme into a new product to build in the Pipeline Store tab.</p>
        </div>
        <div className="mv-page-actions">
          <button className="mv-btn primary" onClick={()=>setCloneOpen(true)}><Plus size={15}/>Clone Theme for New Product</button>
          {go&&<button className="mv-btn ghost" onClick={()=>go('build')}><Store size={15}/>Go to Store Builder (Pipeline)</button>}
        </div>
      </div>

      <nav className="mv-stage-tabs" aria-label="Theme Hub tabs" style={{marginBottom: 16}}>
        <button type="button" className="mv-stage-tab" aria-current={hubTab === 'palettes' ? 'page' : undefined} onClick={() => setHubTab('palettes')}>
          <Palette size={14} />52 Theme Color Palettes
        </button>
        <button type="button" className="mv-stage-tab" aria-current={hubTab === 'blueprint' ? 'page' : undefined} onClick={() => setHubTab('blueprint')}>
          <Layers size={14} />Master Base Theme &amp; Blueprint Files
        </button>
      </nav>

      <div className={`mv-se-layout ${widePreview?'is-wide-preview':''}`}>
        <div className="mv-se-form">
          {hubTab === 'palettes' ? (
            <section className="mv-card mv-se-section">
              <header>
                <span className="mv-se-num"><Palette size={15}/></span>
                <div>
                  <h2>52 Curated Store Theme Palettes</h2>
                  <p>Click any palette below to preview it live on the Master Base Theme on the right.</p>
                </div>
              </header>
              <ColorsSection
                section={colorSection}
                colors={view.colors}
                pendingTheme={pendingTheme}
                owner={ownerByPath.get('theme')}
                previewId={previewId}
                busy={busy==='save'}
                onPreview={palette => setPreviewId(palette?.id || null)}
                onUse={usePalette}
              />
            </section>
          ) : (
            <ThemeBlueprintHub />
          )}
        </div>
        <PhonePreview view={view} storeUp={storeUp} frameKey={frameKey} frameRef={frameRef} onReload={()=>reloadPreview(0)} onLoad={sendPreview} widePreview={widePreview} onToggleWide={()=>setWidePreview(w=>!w)}/>
      </div>

      {cloneOpen&&<CloneBaseThemeSheet groups={view.colors?.groups||[]} onClose={()=>setCloneOpen(false)} onCloned={res=>{
        setCloneOpen(false);
        setView(res);
        setFile(res.clonedFile);
        notify?.(`Cloned ${res.clonedFile} from the Master Base Theme.`);
        if (go) go(`build?packet=${encodeURIComponent(res.clonedFile)}`);
      }}/>}
    </div>;
  }

  // ============================================================================
  // MODE 2: PIPELINE STEP 3 · STORE (#/build — Build the Store & Shopify Setup)
  // ============================================================================
  if (displayedPackets.length === 0) {
    return <div className="mv-se">
      <LineTabs active="build" pipeline={pipeline} go={go} />
      <div className="mv-page-head">
        <div>
          <span className="mv-eyebrow">Step 3 of 6 · Build the Store &amp; Shopify Setup</span>
          <h1 className="mv-h1">Store</h1>
          <p className="mv-sub">Build the product store together on the left while scrolling through the live Store on the right—page copy, pictures, 1-Kit / 2-Kit offer, and Shopify Admin setup.</p>
        </div>
        <div className="mv-page-actions">
          <button className="mv-btn sm primary" onClick={()=>setCloneOpen(true)}><Plus size={14}/>Clone Theme for New Product</button>
          {go&&<button className="mv-btn sm ghost" onClick={()=>go('manage?tab=store')}><TrendingUp size={14}/>Open Manage · Store &amp; CRO</button>}
        </div>
      </div>

      <div className="mv-card mv-pad" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{maxWidth:680}}>
          <strong>No unlaunched product is in the Store Builder right now.</strong>
          <div className="mv-small" style={{marginTop:4,lineHeight:1.55}}>
            Previously built product stores have already launched and graduated to <b>Manage → Store &amp; CRO</b>. Choose your next product in <b>Winners</b> or click <b>Clone Theme for New Product</b> to start building a new store.
          </div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {go&&<button type="button" className="mv-btn primary" onClick={()=>go('winners')}><Sparkles size={14}/>Pick Next Winner</button>}
          <button type="button" className="mv-btn ghost" onClick={()=>setCloneOpen(true)}><Plus size={14}/>Clone Theme for New Product</button>
          {go&&<button type="button" className="mv-btn ghost" onClick={()=>go('manage?tab=store')}><TrendingUp size={14}/>Manage Live Stores</button>}
        </div>
      </div>

      {cloneOpen&&<CloneBaseThemeSheet groups={view.colors?.groups||[]} onClose={()=>setCloneOpen(false)} onCloned={res=>{
        setCloneOpen(false);
        setView(res);
        setFile(res.clonedFile);
        notify?.(`Created ${res.clonedFile} from the Master Base Theme.`);
        reloadPreview(500);
      }}/>}
    </div>;
  }

  return <div className="mv-se">
    <LineTabs active="build" pipeline={pipeline} go={go} />
    <div className="mv-page-head">
      <div>
        <span className="mv-eyebrow">Step 3 of 6 · Build the Store &amp; Shopify Setup</span>
        <h1 className="mv-h1">Store</h1>
        <p className="mv-sub">Build the product store together on the left while scrolling through the live Store on the right—page copy, pictures, 1-Kit / 2-Kit offer, and Shopify Admin setup.</p>
      </div>
      <div className="mv-page-actions">
        <button className="mv-btn sm ghost" onClick={()=>setCloneOpen(true)}><Plus size={14}/>New Store</button>
        <button className="mv-btn sm ghost" onClick={()=>setHistoryOpen(true)}><History size={14}/>History &amp; Undo</button>
        {publishState.pending?<span className="mv-se-waiting" title="The manager publishes, then answers your note"><LoaderCircle size={14} className="mv-spin"/>Waiting for deploy · asked {timeOf(publishState.pending.at)}</span>
          :<button className="mv-btn sm ghost" onClick={()=>setPublishOpen(true)} disabled={busy==='publish'}><Send size={14}/>Publish</button>}
        {go&&<button className="mv-btn sm primary" onClick={()=>go('create')}>Next: Creatives<ArrowRight size={14}/></button>}
      </div>
    </div>

    <section className="mv-se-pages" aria-label="Product stores">
      {displayedPackets.map(p=>{
        const isCurrent = p.file===view.packet.file;
        const isBase = p.file==='base-theme.json';
        return <button key={p.file} type="button" className={`mv-se-page ${isBase?'is-base':''}`} aria-pressed={isCurrent} onClick={()=>{
          if (isCurrent) return;
          if (pending.size&&!window.confirm('You have unsaved edits on this store page. Switch product anyway?')) return;
          setPending(new Map());
          setFile(p.file);
          load(p.file);
        }}>
          {p.heroImage?<img src={imageUrl(p.heroImage)} alt="" loading="lazy"/>:<span className="mv-se-page-mark" style={{background:p.themePaper||undefined,borderColor:p.themeAccent||undefined}}><Store size={18}/></span>}
          <span>
            <strong title={p.navLabel||p.file}>{p.navLabel||p.file.replace(/\.json$/i,'')}</strong>
            <small title={p.productUrl}>{isBase?'Master template':(p.productUrl||`/products/${p.file.replace(/\.json$/i,'')}`)}</small>
            <em><i style={{background:p.themeAccent||undefined}}/>{p.themeName||p.status}</em>
          </span>
        </button>;
      })}
    </section>

    {view.undo?.length>0&&<div className="mv-se-undo" aria-label="Undo a recent save"><span><Undo2 size={14}/>Undo</span>{view.undo.slice(0,3).map(item=><button key={item.id} className="mv-btn sm ghost" disabled={Boolean(busy)||item.stale.length>0} title={item.stale.length?`${item.stale.join(', ')} changed after this save`:`Put back: ${item.changes.map(c=>c.label).join(', ')}`} onClick={()=>undo(item)}>{busy===`undo-${item.id}`?<LoaderCircle size={13} className="mv-spin"/>:null}{short(item.changes.map(c=>c.label).join(', '),38)} · {timeOf(item.at)}</button>)}</div>}

    {note&&<p className="mv-se-note" role="status"><CheckCircle2 size={15}/>{note}</p>}
    {failure&&!pending.size&&failureBox}

    {/* 4 Clean Builder Tabs */}
    <nav className="mv-stage-tabs" aria-label="Store builder sections" style={{marginBottom: 14}}>
      <button type="button" className="mv-stage-tab" aria-current={workTab === 'copy' ? 'page' : undefined} onClick={() => setWorkTab('copy')}>
        <FileText size={14} />1. Page Builder
      </button>
      <button type="button" className="mv-stage-tab" aria-current={workTab === 'media' ? 'page' : undefined} onClick={() => setWorkTab('media')}>
        <ImageIcon size={14} />2. Pictures
      </button>
      <button type="button" className="mv-stage-tab" aria-current={workTab === 'shopify' ? 'page' : undefined} onClick={() => setWorkTab('shopify')}>
        <ShoppingBag size={14} />3. Shopify Admin &amp; Variants
      </button>
      <button type="button" className="mv-stage-tab" aria-current={workTab === 'colors' ? 'page' : undefined} onClick={() => setWorkTab('colors')}>
        <Palette size={14} />4. Palette
      </button>
    </nav>

    <div className={`mv-se-layout ${widePreview?'is-wide-preview':''}`}>
      <div className="mv-se-form">
        {workTab === 'copy' && (
          <section key={shown.id} id={`mv-se-s-${shown.id}`} className="mv-card mv-se-section">
            <header style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1}}>
                <span className="mv-se-num">{shown.number}</span>
                <div style={{minWidth: 0, flex: 1}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
                    <select
                      className="mv-input"
                      aria-label="Choose page section to edit"
                      value={shown.id}
                      onChange={e => setSectionId(e.target.value)}
                      style={{fontWeight: 700, fontSize: 14, padding: '6px 10px', maxWidth: 320}}
                    >
                      {copySections.map(section => {
                        const unsaved = unsavedIn(section);
                        return (
                          <option key={section.id} value={section.id}>
                            Step {section.number} of {copySections.length} · {section.title}{unsaved > 0 ? ` (${unsaved} edited)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <p style={{marginTop: 4}}>{shown.help}</p>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <button type="button" className="mv-btn sm ghost" disabled={!previous} onClick={() => previous && openSection(previous.id)} title={previous ? `Previous: ${previous.title}` : 'First section'}>
                  <ArrowLeft size={14} />Prev
                </button>
                <button type="button" className="mv-btn sm ghost" disabled={!following} onClick={() => following && openSection(following.id)} title={following ? `Next: ${following.title}` : 'Last section'}>
                  Next<ArrowRight size={14} />
                </button>
              </div>
            </header>
            {groupFields(shown.fields).map((group,i)=>{
              const inner = group.fields.map(field=><Field key={field.path} field={field} value={field.value} pending={pending.get(field.path)} owner={ownerByPath.get(field.path)} onChange={change} onPick={setPicker}/>);
              if (!group.key) return <div key={`flat-${i}`} className="mv-se-fields">{inner}</div>;
              const sample = group.review&&group.fields.some(field=>field.sample);
              return <div key={group.key} className={`mv-se-group ${group.review?(sample?'is-sample':'is-real'):''}`}>
                {group.review&&<div className="mv-se-group-head">Review {group.index+1}{sample?<span className="mv-se-sample">Sample (demo only)</span>:<span className="mv-se-real">Real buyer · not editable</span>}</div>}
                {inner}
              </div>;
            })}
            <footer className="mv-se-step">
              {previous?<button type="button" className="mv-btn sm ghost" onClick={()=>openSection(previous.id)}><ArrowLeft size={14}/>{previous.title}</button>:<span/>}
              {following&&<button type="button" className="mv-btn sm" onClick={()=>openSection(following.id)}>Next: {following.title}<ArrowRight size={14}/></button>}
            </footer>
          </section>
        )}

        {workTab === 'media' && (
          <StoreMediaGrid sections={view.sections} pending={pending} ownerByPath={ownerByPath} onPick={setPicker} />
        )}

        {workTab === 'shopify' && (
          <ShopifyAdminWorkspace view={view} fields={fields} pending={pending} ownerByPath={ownerByPath} onChange={change} onPick={setPicker} go={go} />
        )}

        {workTab === 'colors' && (
          <section className="mv-card mv-se-section">
            <header><span className="mv-se-num"><Palette size={15}/></span><div><h2>Store Color Palette</h2><p>Pick any of the 52 palettes from the Theme Hub and see it live in the Store on the right.</p></div></header>
            <ColorsSection section={colorSection} colors={view.colors} pendingTheme={pendingTheme} owner={ownerByPath.get('theme')} previewId={previewId} busy={busy==='save'} onPreview={palette=>setPreviewId(palette?.id||null)} onUse={usePalette}/>
          </section>
        )}
      </div>
      <PhonePreview view={view} storeUp={storeUp} frameKey={frameKey} frameRef={frameRef} onReload={()=>reloadPreview(0)} onLoad={sendPreview} widePreview={widePreview} onToggleWide={()=>setWidePreview(w=>!w)}/>
    </div>

    {pending.size>0&&<div className="mv-se-dock">{failureBox}<div className="mv-se-bar" role="region" aria-label="Unsaved edits">
      <span><strong>{pending.size}</strong> {pending.size===1?'edit':'edits'} not saved yet</span>
      <button className="mv-btn ghost sm" onClick={()=>{setPending(new Map());setFailure(null);}} disabled={busy==='save'}><X size={14}/>Discard</button>
      <button className="mv-btn primary" onClick={saveAll} disabled={busy==='save'}>{busy==='save'?<LoaderCircle size={15} className="mv-spin"/>:<Save size={15}/>}Save to Store</button>
    </div></div>}

    {picker&&<ImagePicker field={picker} images={view.images||[]} onPick={change} onClose={()=>setPicker(null)}/>}
    {publishOpen&&<Sheet title="Publish to merrivy.com" subtitle="You approve it here. The Store Builder deploys it." onClose={()=>setPublishOpen(false)}>
      <div className="mv-se-publish">
        <p>Nothing goes live until the Store Builder deploys it, and your agent tells you when it’s done.</p>
        <h4>{publishState.changes?.length?`What changed since the last publish (${publishState.changes.length})`:'No editor changes since the last publish'}</h4>
        {publishState.changes?.length>0&&<ul>{publishState.changes.slice(0,30).map(item=><li key={`${item.packet}:${item.path}`}><strong>{item.section}</strong> · {item.label}<small>{item.by==='owner'?'you':'an agent'} · {timeAgo(item.at)}</small></li>)}</ul>}
        {pending.size>0&&<p className="mv-se-warn"><AlertTriangle size={13}/>You have {pending.size} unsaved {pending.size===1?'edit':'edits'}. Save first if you want them published.</p>}
        <div className="mv-se-publish-actions"><button className="mv-btn ghost" onClick={()=>setPublishOpen(false)}>Not yet</button><button className="mv-btn primary" onClick={publish} disabled={busy==='publish'}>{busy==='publish'?<LoaderCircle size={15} className="mv-spin"/>:<CheckCircle2 size={15}/>}Approve publishing</button></div>
      </div>
    </Sheet>}
    {historyOpen&&<Sheet wide title="History" subtitle={`Every save to ${view.packet.file}, newest first. Undo works on the last few.`} onClose={()=>setHistoryOpen(false)}>
      {view.ownerEdits?.length>0&&<div className="mv-se-mine-list"><h4><UserPen size={14}/>Your edits agents keep ({view.ownerEdits.length})</h4><ul>{view.ownerEdits.map(edit=><li key={edit.path} className={edit.kept?'':'is-changed'}><strong>{edit.section} · {edit.label}</strong><span>“{short(edit.after)}”</span>{!edit.kept&&<em>Changed since by someone else: “{short(edit.current)}”</em>}</li>)}</ul></div>}
      <ol className="mv-se-history">{(view.history||[]).map(item=><li key={item.id} className={item.undoneAt?'is-undone':''}>
        <div className="mv-se-history-head"><strong>{item.by==='owner'?'You':item.who||'An agent'}</strong><span>{dayTime(item.at)}</span>{item.undoOf&&<em>Undo</em>}{item.undoneAt&&<em>Undone</em>}
          {view.undo?.some(u=>u.id===item.id)&&<button className="mv-btn sm ghost" disabled={Boolean(busy)||view.undo.find(u=>u.id===item.id).stale.length>0} onClick={()=>undo(item)}><Undo2 size={13}/>Undo</button>}</div>
        <ul>{item.changes.map(c=><li key={c.path}><b>{c.section} · {c.label}</b><span className="mv-se-before">{short(c.before)||'(empty)'}</span><span className="mv-se-after">{short(c.after)||'(empty)'}</span></li>)}</ul>
      </li>)}{!view.history?.length&&<p className="mv-se-hint">No saves yet.</p>}</ol>
    </Sheet>}
    {cloneOpen&&<CloneBaseThemeSheet groups={view.colors?.groups||[]} onClose={()=>setCloneOpen(false)} onCloned={res=>{
      setCloneOpen(false);
      setView(res);
      setFile(res.clonedFile);
      notify?.(`Created ${res.clonedFile} from the Master Base Theme.`);
      reloadPreview(500);
    }}/>}
  </div>;
}

export function CloneBaseThemeSheet({groups=[],onClose,onCloned}) {
  const allPalettes = useMemo(()=>groups.flatMap(g=>g.palettes||[]),[groups]);
  const [title,setTitle] = useState('');
  const [slug,setSlug] = useState('');
  const [paletteId,setPaletteId] = useState(allPalettes[0]?.id||'botanical-linen');
  const [status,setStatus] = useState('live');
  const [saving,setSaving] = useState(false);
  const [err,setErr] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    const cleanSlug = (slug||title).trim().toLowerCase().replace(/\.json$/i,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
    if (!cleanSlug) { setErr('Enter a product name or handle slug.'); return; }
    setSaving(true);
    try {
      const res = await api('/api/store-editor/clone',{slug:cleanSlug,title:title.trim()||cleanSlug,paletteId,status});
      onCloned?.(res);
    } catch (error) {
      setErr(error.message||'Could not clone base theme.');
    } finally {
      setSaving(false);
    }
  }

  return <Sheet wide title="Clone New Product Store from Master Base Theme" subtitle="Clones base-theme.json with our conversion layout, Cart-Drawer upsell stack, and your chosen WCAG AA color palette." onClose={onClose}>
    <form className="mv-stack" onSubmit={handleSubmit} style={{gap:14}}>
      {err&&<div className="mv-error" role="alert">{err}</div>}
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>Product Title (`purchase.heading` &amp; `navLabel`)</span>
          <input className="mv-input" value={title} onChange={e=>{setTitle(e.target.value);if(!slug)setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,''));}} placeholder="e.g. Organic Stone-Seed Infrared Heating Pad" required/>
        </label>
        <label className="mv-field">
          <span>URL Handle Slug (`/products/&lt;slug&gt;`)</span>
          <input className="mv-input" value={slug} onChange={e=>setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g,'-'))} placeholder="e.g. stone-seed-heating-pad" required/>
        </label>
      </div>
      <div className="mv-grid-2" style={{gap:12}}>
        <label className="mv-field">
          <span>Initial Page Status</span>
          <select className="mv-input" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="live">Live on storefront (`/products/&lt;slug&gt;`)</option>
            <option value="draft">Draft (preview only)</option>
          </select>
        </label>
        <label className="mv-field">
          <span>Color Palette ({allPalettes.length||52} WCAG AA Palettes)</span>
          <select className="mv-input" value={paletteId} onChange={e=>setPaletteId(e.target.value)}>
            {groups.map(group=><optgroup key={group.id} label={group.title}>{(group.palettes||[]).map(p=><option key={p.id} value={p.id}>{p.name} — {p.feel}</option>)}</optgroup>)}
          </select>
        </label>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
        <button type="button" className="mv-btn" onClick={onClose}>Cancel</button>
        <button type="submit" className="mv-btn primary" disabled={saving}><Copy size={14}/>{saving?'Cloning Base Theme...':'Clone & Open Product Store'}</button>
      </div>
    </form>
  </Sheet>;
}
