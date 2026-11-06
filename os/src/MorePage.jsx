import React,{useEffect,useMemo,useState} from 'react';
import {Archive,ArrowRight,Brain,Check,FileText,FolderOpen,Gauge,GitBranch,HeartPulse,MessageSquareQuote,FlaskConical,RefreshCw,Settings as SettingsIcon,ShieldBan,TriangleAlert,Wrench,BookOpen} from 'lucide-react';
import {api} from './ui.jsx';
import {Sheet} from './kit.jsx';
import {CountUp,SectionHead} from './cards.jsx';
import {DoctorSheet,readReport} from './DoctorBadge.jsx';
import {SCHEMES} from './appearance.mjs';
import {MORE_GUIDES,headlineRule,lessonCounts,oldRecords,ruleFigure,ruleGroups,toolCounts} from './moreView.mjs';
import './more.css';

// More (#/more): the back room. The owner, Nov 5: "it's a tab that we have not
// worked with before, I don't know what should even go in there." It holds what
// keeps the team running, the guides agents follow and the older records we keep.
// Every door opens a page or a read-only sheet; nothing here starts agent work.

const OLD_ICONS = {issues:MessageSquareQuote,learning:FlaskConical,maps:GitBranch};
const day = value => {try{return value?new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';}catch{return '';}};

function useOnce(load) {
  const [value,setValue] = useState(null),[error,setError] = useState('');
  useEffect(()=>{let alive = true;load().then(v=>{if(alive)setValue(v);}).catch(e=>{if(alive)setError(e.message||'Could not load.');});return ()=>{alive = false;};},[]);
  return [value,error,setValue];
}

/** One door: an icon, a big figure, a name, one line and its shortcuts. */
function Door({tile,icon:Icon,figure,unit,title,line,onOpen,links=[],tone}) {
  return <article className={`mv-hb-door mv-mo-door is-tile-${tile} ${tone?`is-${tone}`:''}`}>
    <button type="button" className="mv-hb-door-main" onClick={onOpen} aria-label={`${title}: open`}>
      <span className="mv-hb-door-top">
        <span className="mv-hb-door-icon"><Icon size={20}/></span>
        {figure!==undefined&&figure!==null&&figure!==''&&<span className="mv-hb-door-count"><b>{typeof figure==='number'?<CountUp value={figure}/>:figure}</b>{unit&&<small>{unit}</small>}</span>}
      </span>
      <strong>{title}</strong>
      <p>{line}</p>
    </button>
    {links.length>0&&<div className="mv-hb-door-links">{links.map(link=><button key={link.label} type="button" onClick={link.onClick}>{link.label}</button>)}</div>}
  </article>;
}

function RulesSheet({record,error,onClose}) {
  const groups = useMemo(()=>ruleGroups(record||{}),[record]);
  return <Sheet wide title="Rules & numbers" subtitle="What the agents work by. To change one, say it in chat." onClose={onClose}>
    {error?<p className="mv-mo-quiet">{error}</p>:!record?<p className="mv-mo-quiet">Loading…</p>:<div className="mv-mo-rules">
      <section>
        <SectionHead icon={Gauge} title="Your numbers" count={groups.yours.length}/>
        <div className="mv-mo-rule-tiles">{groups.yours.map((rule,index)=>{const fig = ruleFigure(rule);return <article key={rule.id} className={`mv-mo-rule is-tile-${index%6+1}`}>
          <b>{fig.big}</b>{fig.small&&<small>{fig.small}</small>}
          <strong>{rule.label}</strong>
          {rule.whose&&<p title={rule.whose}>{rule.whose}</p>}
        </article>;})}</div>
      </section>
      {groups.never.length>0&&<section>
        <SectionHead icon={ShieldBan} title="We never sell" count={groups.never.length}/>
        <div className="mv-mo-never">{groups.never.map(limit=><span key={limit.id||limit.label} title={limit.whose||''}>{limit.label}</span>)}</div>
      </section>}
      <section>
        <SectionHead icon={BookOpen} title="Starting numbers" count={groups.startingCount}/>
        <p className="mv-mo-quiet">Used until you give your own. Each one says where it came from.</p>
        <div className="mv-mo-steps">{groups.starting.map(step=><div key={step.id} className="mv-mo-step">
          <h3>{step.label}</h3>
          <ul>{step.rules.map(rule=>{const fig = ruleFigure(rule);return <li key={rule.id} title={rule.whose||''}><span>{rule.label}</span><b>{fig.big}</b></li>;})}</ul>
        </div>)}</div>
      </section>
    </div>}
  </Sheet>;
}

export function MorePage({data,hub,tools,go,openDoc,project}) {
  const [lessons,lessonsError] = useOnce(()=>api('/api/lessons'));
  const [rules,rulesError] = useOnce(()=>api('/api/rules'));
  const [health,healthError,setHealth] = useOnce(readReport);
  const [files] = useOnce(async()=>{const res = await fetch(`/p/${project?.id||'merrivy'}/api/files?folder=`);if(!res.ok)throw new Error('Files could not be read.');return res.json();});
  const [sheet,setSheet] = useState(''),[checking,setChecking] = useState(false);
  const counts = lessonCounts(lessons?.lessons);
  const toolsNow = toolCounts(tools?.tools);
  const head = headlineRule(rules||{}), headFig = head?ruleFigure(head):null;
  const never = (rules?.hardLimits||[]).length;
  const yours = (rules?.rules||[]).filter(rule=>rule.by==='owner').length;
  const fileCount = files?(files.files||[]).length:null;
  const scheme = SCHEMES.find(entry=>entry.id===document.documentElement.dataset.scheme)||SCHEMES[0];
  const mode = document.documentElement.dataset.mode==='dark'?'dark':'light';
  const looks = health?.old?1:health?.count||0;
  const old = useMemo(()=>oldRecords({issues:data?.issues,improvements:data?.improvements,maps:hub?.maps}),[data?.issues,data?.improvements,hub?.maps]);
  async function recheck(){setChecking(true);try{setHealth(await readReport());}catch{}finally{setChecking(false);}}

  return <section className="mv-hb mv-mo">
    <header className="mv-hb-hero">
      <div>
        <span className="mv-eyebrow">Behind the scenes</span>
        <h1>More</h1>
        <p>The memory, rules, tools and files that keep the team running.</p>
      </div>
    </header>

    <section className="mv-mo-section">
      <SectionHead icon={Brain} title="Keep the team on track"/>
      <div className="mv-hb-doors">
        <Door tile={1} icon={Brain} figure={lessons?counts.inUse:lessonsError?'':null} unit="lessons in use" title="Memory & Lessons"
          line={counts.proposed?`${counts.proposed} new lesson${counts.proposed===1?'':'s'} waiting. Plus where we left off and the diary.`:'Where we left off, the lessons agents follow and the diary.'}
          onOpen={()=>go('memory')} links={[{label:'Now',onClick:()=>go('memory?tab=now')},{label:'Lessons',onClick:()=>go('memory?tab=lessons')},{label:'Diary',onClick:()=>go('memory?tab=diary')},{label:'What agents read',onClick:()=>go('memory?tab=brief')}]}/>
        <Door tile={2} icon={Gauge} figure={headFig?.big} unit={head?head.label.toLowerCase():''} title="Rules & numbers"
          line={rules?`${yours} of your numbers, ${never} things we never sell, and the starting numbers.`:rulesError||'The numbers agents work by.'}
          onOpen={()=>setSheet('rules')} links={[{label:'Your numbers',onClick:()=>setSheet('rules')},{label:'Never sell',onClick:()=>setSheet('rules')}]}/>
        <Door tile={3} icon={looks||healthError?TriangleAlert:HeartPulse} figure={health?(looks?looks:<Check size={24} aria-label="All good"/>):healthError?null:'…'} unit={health?(looks?`thing${looks===1?'':'s'} to look at`:'all good'):healthError?'':'checking'} title="Health check"
          line={healthError?healthError:'Reads every record and says what is broken or stale. It never changes anything.'}
          tone={looks?'warn':''} onOpen={()=>setSheet('health')}/>
      </div>
    </section>

    <section className="mv-mo-section">
      <SectionHead icon={Wrench} title="Tools and files"/>
      <div className="mv-hb-doors">
        <Door tile={4} icon={Wrench} figure={tools?toolsNow.live:null} unit="tools" title="Tools"
          line={tools?`Kalodata, Meta Ad Library, Shopify and the rest. ${toolsNow.signedIn} marked signed in.`:'Kalodata, Meta Ad Library, Shopify and the rest.'}
          onOpen={()=>go('tools')}/>
        <Door tile={5} icon={FolderOpen} figure={fileCount??null} unit={fileCount===null?'':'files'} title="Files"
          line={fileCount===0?'Nothing uploaded yet. Drop in videos, photos or PDFs to share them.':'Uploads you and the agents share.'}
          onOpen={()=>go('files')}/>
        <Door tile={6} icon={SettingsIcon} title="Settings" line={`${scheme.name}, ${mode}. Change the colours or switch to dark.`} onOpen={()=>go('settings')}/>
      </div>
    </section>

    <section className="mv-mo-section">
      <SectionHead icon={FileText} title="Guides the agents follow" count={MORE_GUIDES.length}/>
      <div className="mv-mo-guides">{MORE_GUIDES.map((guide,index)=><button key={guide.path} type="button" className={`mv-mo-guide is-tile-${index%6+1}`} onClick={()=>openDoc(guide.path)}>
        <span className="mv-mo-guide-icon"><FileText size={16}/></span>
        <strong>{guide.title}</strong>
        <small>{guide.line}</small>
      </button>)}</div>
    </section>

    <section className="mv-mo-section">
      <SectionHead icon={Archive} title="Older records"/>
      <p className="mv-mo-quiet">Kept for reference. They are not part of today's workflow.</p>
      <div className="mv-mo-old">{old.map(item=>{const Icon = OLD_ICONS[item.id]||Archive;return <button key={item.id} type="button" className="mv-mo-old-card" onClick={()=>go(item.id)}>
        <span className="mv-mo-old-icon"><Icon size={17}/></span>
        <span className="mv-mo-old-text"><strong>{item.title}</strong><small>{item.line}</small></span>
        <span className="mv-mo-old-meta"><b>{item.count}</b><small>{item.unit}{item.last?` · last ${day(item.last)}`:''}</small></span>
        <ArrowRight size={15} className="mv-mo-old-go"/>
      </button>;})}</div>
    </section>

    {sheet==='rules'&&<RulesSheet record={rules} error={rulesError} onClose={()=>setSheet('')}/>}
    {sheet==='health'&&<Sheet title="Health check" subtitle={health?.summary||healthError||'Checking…'} onClose={()=>setSheet('')}
      actions={<button className="mv-btn sm" onClick={recheck} disabled={checking}><RefreshCw size={13}/>{checking?'Checking…':'Check again'}</button>}>
      {health||healthError?<DoctorSheet report={health} error={healthError}/>:<p className="mv-mo-quiet">Checking…</p>}
    </Sheet>}
  </section>;
}
