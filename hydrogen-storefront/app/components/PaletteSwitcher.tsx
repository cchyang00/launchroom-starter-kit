import {useEffect, useState} from 'react';
import {
  PALETTES,
  PALETTE_GROUPS,
  PALETTE_STORAGE_KEY,
  applyPalette,
  type Palette,
} from '~/content/palettes';
import {Icon} from './Icons';

/**
 * Palette preview for us on the local dev server (localhost:3001). PageLayout
 * renders it only when import.meta.env.DEV is true, so production builds
 * (Oxygen, merrivy.com) never ship it; verification/dev-tools.mjs checks the
 * built bundle.
 */
export function PaletteSwitcher({productDefault}: {productDefault: string}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    try {
      setActive(localStorage.getItem(PALETTE_STORAGE_KEY));
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  function choose(id: string | null) {
    applyPalette(id);
    setActive(id);
    try {
      if (id) localStorage.setItem(PALETTE_STORAGE_KEY, id);
      else localStorage.removeItem(PALETTE_STORAGE_KEY);
    } catch {
      /* preview still applies for this page */
    }
  }
  const current = PALETTES.find((palette) => palette.id === active);
  return (
    <div className={`palette-switcher ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="palette-tab"
        aria-expanded={open}
        aria-controls="palette-panel"
        onClick={() => setOpen(!open)}
      >
        <span className="palette-tab-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        Palette
      </button>
      {open && (
        <section
          id="palette-panel"
          className="palette-panel"
          aria-label="Preview store palettes"
        >
          <header>
            <div>
              <strong>Store palette</strong>
              <small>
                {current ? current.name : `Product default · ${productDefault}`}
              </small>
            </div>
            <button
              type="button"
              aria-label="Close palette panel"
              onClick={() => setOpen(false)}
            >
              <Icon name="close" size={16} />
            </button>
          </header>
          <button
            type="button"
            className={`palette-option ${!active ? 'is-active' : ''}`}
            onClick={() => choose(null)}
          >
            <span className="palette-chips is-default" aria-hidden="true" />
            <span>
              Product default
              <small>{productDefault}</small>
            </span>
          </button>
          {PALETTE_GROUPS.map((group) => (
            <div key={group.id} className="palette-group">
              <span className="palette-group-label" title={group.note}>
                {group.name}
              </span>
              {PALETTES.filter((palette) => palette.group === group.name).map(
                (palette) => (
                  <PaletteOption
                    key={palette.id}
                    palette={palette}
                    active={active === palette.id}
                    onChoose={() => choose(palette.id)}
                  />
                ),
              )}
            </div>
          ))}
          <p className="palette-note">
            Local preview only, saved in this browser. The live store always
            uses the product packet&rsquo;s theme; choose it in Launchroom&rsquo;s
            Store editor.
          </p>
        </section>
      )}
    </div>
  );
}

function PaletteOption({
  palette,
  active,
  onChoose,
}: {
  palette: Palette;
  active: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      className={`palette-option ${active ? 'is-active' : ''}`}
      aria-pressed={active}
      onClick={onChoose}
    >
      <span className="palette-chips" aria-hidden="true">
        {(['ink', 'accent', 'accentText', 'highlight', 'paper'] as const).map(
          (role) => (
            <i key={role} style={{background: palette[role]}} />
          ),
        )}
      </span>
      <span>
        {palette.name}
        <small>{palette.goodFor}</small>
      </span>
      {active && <Icon name="check" size={15} />}
    </button>
  );
}
