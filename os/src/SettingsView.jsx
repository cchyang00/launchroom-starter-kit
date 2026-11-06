import React,{useEffect,useState} from 'react';
import {Sun,Moon,MonitorSmartphone,Check,RotateCcw,Palette as PaletteIcon} from 'lucide-react';
import {SCHEMES,MODE_CHOICES,DEFAULT_APPEARANCE,currentAppearance,onAppearance,saveAppearance,resolveMode} from './appearance.mjs';
import {useLaunchroom} from './LaunchroomShell.jsx';
import './settings.css';

const MODE_ICONS = {light:Sun,dark:Moon,device:MonitorSmartphone};
const deviceDark = () => {try {return window.matchMedia('(prefers-color-scheme: dark)').matches;} catch {return false;}};

/** A small picture of the app in one scheme: sidebar, a card and the accent. Uses the real tokens. */
export function SchemePreview({scheme,mode}) {
  return <span className="mv-st-mini" data-scheme={scheme} data-mode={mode} aria-hidden="true">
    <span className="mv-st-mini-side"><i className="is-brand"/><i className="is-on"/><i/><i/><i/></span>
    <span className="mv-st-mini-main">
      <span className="mv-st-mini-hero"><i/><i className="is-short"/></span>
      <span className="mv-st-mini-card"><i/><i className="is-short"/><span className="mv-st-mini-row"><b className="is-accent"/><b className="is-butter"/></span></span>
    </span>
  </span>;
}

/** Appearance: mode and colour scheme. Applies at once and is remembered per person on this device. */
export function AppearanceSettings({compact=false}) {
  const lr = useLaunchroom();
  const username = lr?.user?.username||'';
  const [choice,setChoice] = useState(currentAppearance);
  const [dark,setDark] = useState(deviceDark);
  useEffect(()=>onAppearance(setChoice),[]);
  useEffect(()=>{
    let mq; try {mq = window.matchMedia('(prefers-color-scheme: dark)');} catch {return undefined;}
    const on = () => setDark(mq.matches); mq.addEventListener?.('change',on); return () => mq.removeEventListener?.('change',on);
  },[]);
  const pick = next => setChoice(saveAppearance({...choice,...next},username));
  const shownMode = resolveMode(choice.mode,dark);
  const groups = [...new Set(SCHEMES.map(s=>s.group.replace(' · default','')))];
  const isDefault = choice.scheme===DEFAULT_APPEARANCE.scheme&&choice.mode===DEFAULT_APPEARANCE.mode;
  return <div className={`mv-st ${compact?'is-compact':''}`}>
    <section className="mv-card mv-st-panel" aria-labelledby="mv-st-mode">
      <div className="mv-st-head"><h2 className="mv-h2" id="mv-st-mode">Mode</h2><span className="mv-small">{choice.mode==='device'?`Your device is in ${dark?'dark':'light'} mode right now`:'Applies straight away'}</span></div>
      <div className="mv-st-modes" role="radiogroup" aria-label="Mode">
        {MODE_CHOICES.map(mode=>{const Icon = MODE_ICONS[mode.id];const on = choice.mode===mode.id;
          return <button key={mode.id} type="button" role="radio" aria-checked={on} className={`mv-st-mode ${on?'is-on':''}`} onClick={()=>pick({mode:mode.id})}>
            <span className={`mv-st-mode-art is-${mode.id}`} aria-hidden="true"><Icon size={18}/></span>
            <span className="mv-st-mode-text"><strong>{mode.label}</strong><small>{mode.note}</small></span>
            {on&&<Check size={16} className="mv-st-tick"/>}
          </button>;})}
      </div>
    </section>
    <section className="mv-card mv-st-panel" aria-labelledby="mv-st-scheme">
      <div className="mv-st-head"><h2 className="mv-h2" id="mv-st-scheme">Colour scheme</h2><span className="mv-small">Each card shows the sidebar, a card and the accent in {shownMode} mode</span></div>
      {groups.map(group=><div key={group} className="mv-st-group">
        <h3 className="mv-st-group-title">{group==='Soft'?'Soft · light sidebar':'Deep sidebar · the original themes'}</h3>
        <div className="mv-st-schemes" role="radiogroup" aria-label={`${group} colour schemes`}>
          {SCHEMES.filter(s=>s.group.replace(' · default','')===group).map(scheme=>{const on = choice.scheme===scheme.id;
            return <button key={scheme.id} type="button" role="radio" aria-checked={on} className={`mv-st-scheme ${on?'is-on':''}`} onClick={()=>pick({scheme:scheme.id})}>
              <SchemePreview scheme={scheme.id} mode={shownMode}/>
              <span className="mv-st-scheme-text"><strong>{scheme.name}{scheme.id===DEFAULT_APPEARANCE.scheme&&<em>Default</em>}</strong><small>{scheme.note}</small></span>
              {on&&<span className="mv-st-scheme-tick"><Check size={13}/></span>}
            </button>;})}
        </div>
      </div>)}
      <div className="mv-st-foot">
        <span className="mv-small">{username?`Saved for ${lr.user.name} on this device.`:'Saved on this device.'} The store’s own colours are in Store editor › Colors.</span>
        {!isDefault&&<button type="button" className="mv-btn sm ghost" onClick={()=>pick({...DEFAULT_APPEARANCE})}><RotateCcw size={14}/>Back to default</button>}
      </div>
    </section>
  </div>;
}

export function SettingsView() {
  return <div className="mv-page mv-st-page">
    <div className="mv-page-head"><div><span className="mv-eyebrow">Settings</span><h1 className="mv-h1">Appearance</h1><p className="mv-sub">Pick light or dark, and the colours you like. Everything changes at once; nothing about the work changes.</p></div>
      <div className="mv-page-actions"><span className="mv-st-badge"><PaletteIcon size={14}/>Just for you</span></div></div>
    <AppearanceSettings/>
  </div>;
}
