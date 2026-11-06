import {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import {Icon} from './Icons';
/** Matches the drawer's slide-out in app.css (.m-drawer.is-closing). */
const DRAWER_CLOSE_MS = 200;
type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};
const AsideContext = createContext<AsideContextValue | null>(null);
export function Aside({
  children,
  heading,
  type,
}: {
  children?: ReactNode;
  heading: ReactNode;
  type: AsideType;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let timer = 0;
    if (expanded) {
      dialog.classList.remove('is-closing');
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = 'hidden';
    } else if (dialog.open) {
      // Slide the drawer out, then close it. The page can scroll again as
      // soon as it starts leaving (a menu jump scrolls right after).
      document.body.style.overflow = '';
      const reduce = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reduce) dialog.close();
      else {
        dialog.classList.add('is-closing');
        timer = window.setTimeout(() => {
          dialog.classList.remove('is-closing');
          dialog.close();
        }, DRAWER_CLOSE_MS);
      }
    }
    return () => {
      window.clearTimeout(timer);
      if (dialog.open) document.body.style.overflow = '';
    };
  }, [expanded]);
  return (
    <dialog
      ref={ref}
      id={`${type}-drawer`}
      className="m-drawer"
      aria-label={typeof heading === 'string' ? heading : 'Shopping panel'}
      onCancel={(event) => {
        // Escape closes with the same slide-out as the close button.
        event.preventDefault();
        close();
      }}
    >
      <div className="drawer-inner">
        <header>
          <h2>{heading}</h2>
          <button onClick={close} aria-label="Close panel">
            <Icon name="close" />
          </button>
        </header>
        <div className="drawer-content">{children}</div>
      </div>
    </dialog>
  );
}
Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');
  return (
    <AsideContext.Provider
      value={{type, open: setType, close: () => setType('closed')}}
    >
      {children}
    </AsideContext.Provider>
  );
};
export function useAside() {
  const value = useContext(AsideContext);
  if (!value) throw new Error('Aside provider required');
  return value;
}
