import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Compass,Flame,Search,LayoutDashboard,CalendarCheck,Bot,Brain,BookOpen,Images,FlaskConical,GitBranch,Package,FileText,CornerDownLeft,ArrowUp,ArrowDown,CircleDot,Wrench,ArrowUpRight,Workflow,FolderOpen,Globe,LayoutGrid,Store,Settings,MessageSquareQuote,ListChecks,TrendingUp,MoreHorizontal,Plug} from 'lucide-react';
import {workProjects,projectHref,SHARED_ID} from './launchroomModel.mjs';
import {DISPLAY_LINE} from './displayLine.mjs';
import {DISPLAY_ICONS} from './LineNav.jsx';
import {assetUrl} from './kit.jsx';
import {activeTools,isThisApp,hostOf,OPENS_LABELS} from './toolsModel.mjs';
import {STATUS_LABELS} from './issueList.mjs';

const VIEWS = [
  ['','Home',LayoutDashboard],['pipeline','Pipeline',Workflow],['checklist','Launch Checklist',ListChecks],['manage','Manage',TrendingUp],['today','To-do: today, tomorrow and what got done',CalendarCheck],['agents','Subagents & Skills',Bot],['memory','Memory',Brain],['library','Library',BookOpen],['files','Files',FolderOpen],['tools','Tools',Wrench],
  ['hubs','Hubs: copy, creatives, research, themes and subagents',Compass],['trends','Trends & Research Hub: deep research, keywords and diagrams',Flame],['assets','Assets & Creatives Hub',Images],['store','Store & Theme Hub: edit copy, pictures and colors',Store],['more','More: memory, rules, tools, files and older records',MoreHorizontal],['connect','Connect: the agent browser, signed in to every site',Plug],['learning','Learning log',FlaskConical],['maps','Maps',GitBranch],['settings','Settings: light, dark and colour scheme',Settings],
];

// One keyboard-first jump list over views, stages, products, tasks and files.
export function Palette({onClose,data,leads,pipeline,planner,tools=[],go,openDoc,projects=[],project=null}) {
  const ref = useRef(null), input = useRef(null);
  const [query,setQuery] = useState(''),[active,setActive] = useState(0);
  useEffect(()=>{const el=ref.current;el.showModal();input.current?.focus();return()=>el.close();},[]);
  const results = useMemo(()=>{
    const q = query.trim().toLowerCase();
    const match = text => !q || text.toLowerCase().includes(q);
    const groups = [];
    const pages = [
      // Step 0 (owner, Oct 3): the issue list comes before the seven product steps.
      {key:'s-issues',label:'0. Issues: the issue list',hint:'Step 0',icon:MessageSquareQuote,run:()=>go('issues'),text:'Issues issue list step 0 avatars problems Gemini test pick'},
      ...DISPLAY_LINE.map((stage,i)=>({key:'s'+stage.id,label:`${i+1}. ${stage.short}`,hint:'Step',icon:DISPLAY_ICONS[stage.id],run:()=>go(stage.slug),text:`${stage.title} ${stage.short} ${stage.goal}`})),
      ...VIEWS.map(([id,label,icon])=>({key:'v'+id,label,hint:'Page',icon,run:()=>go(id),text:label})),
    ].filter(item=>match(item.text));
    if (pages.length) groups.push(['Go to',q?pages:pages.slice(0,9)]);
    // Launchroom is one site now (owner, Nov 4): no other projects or lobby to jump to.
    const places = [];
    if (places.length) groups.push(['Places',places]);
    // A tool opens its own page in a new tab; Luxury-app tools go to their card for the guidance.
    const toolItems = q ? activeTools(tools).filter(tool=>!isThisApp(tool)&&match(`${tool.name} ${tool.id} ${tool.purpose} ${hostOf(tool.url)}`)).slice(0,6).map(tool=>({key:'o'+tool.id,label:tool.name,hint:tool.opensIn==='luxury-desktop'?OPENS_LABELS[tool.opensIn]:`Open ${hostOf(tool.url)}`,icon:tool.opensIn==='luxury-desktop'?Wrench:ArrowUpRight,run:()=>tool.opensIn==='luxury-desktop'?go(`tools?tool=${tool.id}`):window.open(tool.url,'_blank','noopener,noreferrer')})) : [];
    if (toolItems.length) groups.push(['Tools',toolItems]);
    // A product opens its own line (#/product/<id>); cards and P### product records are both searchable.
    const rows = pipeline?.items?.length?[...pipeline.active,...pipeline.out]:leads.map(lead=>({id:lead.id,leadId:lead.id,productId:'',name:lead.name,image:lead.image,stepName:'',status:lead.state}));
    const products = rows.filter(item=>match(`${item.id} ${item.productId||''} ${item.name}`)).slice(0,q?8:4).map(item=>({key:'l'+item.id,label:`${item.id}${item.productId?` · ${item.productId.split('-')[0]}`:''} · ${item.name}`,hint:item.outcome?item.outcome.label:item.readyToBuild?'Ready to build':item.stepName||item.status,image:item.image,run:()=>go(`product/${item.id}`)}));
    if (products.length) groups.push(['Products',products]);
    // Issues by their words, avatars or products: each opens on the Issues page.
    const issues = q?(pipeline?.issues||[]).filter(issue=>match(`${issue.slug} ${issue.title} ${issue.group||''} ${(issue.productTypes||[]).join(' ')}`)).slice(0,6).map(issue=>({key:'i'+issue.slug,label:issue.title,hint:`Issue · ${STATUS_LABELS[issue.status]||issue.status}`,icon:MessageSquareQuote,run:()=>go(`issues?issue=${encodeURIComponent(issue.slug)}`)})):[];
    if (issues.length) groups.push(['Issues',issues]);
    const tasks = (planner?.tasks||[]).filter(task=>match(task.title)).slice(0,q?6:3).map(task=>({key:'t'+task.id,label:task.title,hint:task.status==='done'?'Done':'Task',icon:CircleDot,run:()=>go(`today?task=${task.id}`)}));
    if (tasks.length) groups.push(['Tasks',tasks]);
    if (q.length>1) {
      const docs = data.documents.filter(item=>match(`${item.title} ${item.path}`)).slice(0,8).map(item=>({key:'d'+item.path,label:item.title||item.path,hint:item.path,icon:FileText,run:()=>openDoc(item.path)}));
      if (docs.length) groups.push(['Files',docs]);
    }
    return groups;
  },[query,leads,pipeline,planner,tools,data,go,openDoc]);
  const flat = results.flatMap(([,items])=>items);
  useEffect(()=>{setActive(0);},[query]);
  function choose(item){if(!item)return;onClose();item.run();}
  function onKey(event){
    if (event.key==='ArrowDown'){event.preventDefault();setActive(i=>Math.min(flat.length-1,i+1));}
    else if (event.key==='ArrowUp'){event.preventDefault();setActive(i=>Math.max(0,i-1));}
    else if (event.key==='Enter'){event.preventDefault();choose(flat[active]);}
  }
  useEffect(()=>{ref.current?.querySelector('.mv-palette-item.is-active')?.scrollIntoView({block:'nearest'});},[active]);
  let index = -1;
  return <dialog ref={ref} className="mv-palette" aria-label="Search and jump" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===ref.current)onClose();}}>
    <div className="mv-palette-input"><Search size={18} color="var(--muted)"/><input ref={input} value={query} onChange={event=>setQuery(event.target.value)} onKeyDown={onKey} placeholder="Jump to a stage, product, task or file…" aria-label="Search"/><kbd className="mv-kbd">Esc</kbd></div>
    <div className="mv-palette-list" role="listbox">
      {!flat.length&&<div className="mv-empty"><strong>Nothing matches “{query}”.</strong><span className="mv-small">Try a product ID like L096, a task word or a file name.</span></div>}
      {results.map(([title,items])=><div key={title}><div className="mv-palette-group">{title}</div>{items.map(item=>{index++;const i=index,Icon=item.icon;return <button key={item.key} role="option" aria-selected={i===active} className={`mv-palette-item ${i===active?'is-active':''}`} onMouseEnter={()=>setActive(i)} onClick={()=>choose(item)}>
        {item.image?<img src={assetUrl(item.image)} alt=""/>:Icon?<Icon size={16} color="var(--text-2)"/>:<Package size={16}/>}<span>{item.label}</span><small>{item.hint}</small>
      </button>;})}</div>)}
    </div>
    <div className="mv-palette-foot"><span><ArrowUp size={11}/><ArrowDown size={11}/> move</span><span><CornerDownLeft size={11}/> open</span><span>Ctrl K or / anywhere</span></div>
  </dialog>;
}
