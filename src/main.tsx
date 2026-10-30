import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Graph} from './Graph';
import {BranchPicker} from './BranchPicker';
import {useRetryCountdown,retryLabel} from './useRetryCountdown';
import {History} from './history';
import type {Commit} from './model';
import {emojify} from './emoji';
import './style.css';

function App(){
 const [history]=useState(()=>new History());
 const state=useSyncExternalStore(history.subscribe,history.getSnapshot);
 const retrySeconds=useRetryCountdown(state.retryAt);
 const [input,setInput]=useState(new URLSearchParams(location.search).get('repo')||'');
 const [token,setToken]=useState(''),[auth,setAuth]=useState(false),[theme,setTheme]=useState('system'),[options,setOptions]=useState(false);
 const optionsRef=useRef<HTMLDivElement>(null),toolbarRef=useRef<HTMLElement>(null);
 const [topInset,setTopInset]=useState(window.innerWidth<=800?136:108);
 useLayoutEffect(()=>{
  const el=toolbarRef.current!;const update=()=>setTopInset(Math.ceil(el.getBoundingClientRect().bottom)+20);
  update();const observer=new ResizeObserver(update);observer.observe(el);window.addEventListener('resize',update);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);};
 },[]);
 const [selected,setSelected]=useState<Commit|null>(null),[details,setDetails]=useState(false),[reverse,setReverse]=useState(false);
 useEffect(()=>{if(input)void history.open(input);return()=>history.cancel();},[history]);
 useEffect(()=>{if(state.meta)window.history.replaceState(null,'',`?repo=${encodeURIComponent(state.repo)}`);},[state.repo,state.meta]);
 useEffect(()=>{
  if(!options)return;
  const outside=(event:PointerEvent)=>{if(!optionsRef.current?.contains(event.target as Node))setOptions(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOptions(false);};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[options]);
 function applyToken(){history.setToken(token);setAuth(false);if(state.repo){setSelected(null);setDetails(false);void history.open(state.repo,token);}}
 function open(){setSelected(null);setDetails(false);setReverse(false);void history.open(input,token);}
 function select(commit:Commit){setSelected(commit);setDetails(true);}
 return <div className="app" data-theme={theme}>
  <main className="graph-stage">
   {state.commits.length>0?<Graph key={`${state.repo}:${state.base}:${reverse}`} commits={state.commits} branches={state.branches} branch={state.base} reverse={reverse} selected={selected?.sha||''} onSelect={select} hasMore={state.more&&!state.error} loading={state.busy} onLoadMore={history.loadMore} frontiers={state.frontiers} topInset={topInset} hasUnloadedBranches={state.hasUnloadedBranches} onDiscover={history.loadContext}/>:<div className="empty"><span className="empty-mark">⑂</span><h1>Git history, in perspective.</h1>{!state.busy&&<p>Choose a repository. Follow its branches.</p>}{!state.busy&&<button onClick={()=>{setInput('angular/angular');void history.open('angular/angular',token);}}>Explore angular/angular ↗</button>}</div>}
  </main>
  <header className="topbar" ref={toolbarRef}>
   <a className="brand" href="./" aria-label="GitStream home"><span>⑂</span> GitStream</a>
   <form className="repo-form" onSubmit={e=>{e.preventDefault();open();}}><input aria-label="GitHub repository" value={input} onChange={e=>setInput(e.target.value)} placeholder="owner/repository"/><button type="submit" className="primary">Explore →</button></form>
   <div className="view-controls"><div className="base-control"><BranchPicker history={history} state={state} onPicked={()=>{setSelected(null);setDetails(false);}}/></div>
    <button className="direction-toggle" aria-label={reverse?'Oldest first; newer commits below':'Newest first; older commits below'} title={reverse?'Oldest first; newer commits below':'Newest first; older commits below'} aria-pressed={reverse} onClick={()=>setReverse(!reverse)}>{reverse?'↓ Newer':'↓ Older'}</button>
    <button aria-label="Access token" aria-expanded={auth} onClick={()=>{setAuth(!auth);setOptions(false);}}>Token</button>
    <div className="options" ref={optionsRef}><button className="options-trigger" aria-label="Options" aria-expanded={options} aria-controls="options-menu" onClick={()=>setOptions(!options)}>•••</button>{options&&<section className="options-menu floating-panel" id="options-menu" aria-label="View options"><label>Theme<select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label><button aria-label="Open commit details" onClick={()=>{setDetails(!details);setOptions(false);}}>Commit details</button></section>}</div>
   </div>
  </header>
  {auth&&<section className="auth floating-panel" aria-label="GitHub access token"><button className="close" aria-label="Close access token" onClick={()=>setAuth(false)}>×</button><h2>GitHub access token</h2><a className="create-token" href="https://github.com/settings/personal-access-tokens/new?name=GitStream&amp;contents=read&amp;pull_requests=read" target="_blank" rel="noreferrer">Create a fine-grained token ↗</a><p>Select your repository, then set <strong>Repository permissions</strong>:</p><dl className="token-permissions"><div><dt>Contents: Read-only</dt><dd>Required to read commits and branches</dd></div><div><dt>Pull requests: Read-only</dt><dd>For PR-based branch recommendations</dd></div></dl><form onSubmit={e=>{e.preventDefault();applyToken();}}><label>Access token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your token"/></label><button className="primary" type="submit">Apply token</button></form><small>Kept in memory only. Cleared on refresh.</small><button className="remove-token" onClick={()=>{history.clear();setToken('');setSelected(null);setDetails(false);setAuth(false);}}>Remove token & clear history</button></section>}
  {details&&<aside className="details floating-panel" aria-label="Commit details"><button className="close" aria-label="Close commit details" onClick={()=>setDetails(false)}>×</button><div className="eyebrow">COMMIT DETAILS</div>{selected?<><div className="commit-sha">◉ {selected.sha.slice(0,7)}</div><h2>{emojify(selected.commit.message.split('\n')[0])}</h2><dl><dt>AUTHOR</dt><dd>{selected.commit.author?.name||'Unknown'}</dd><dt>AUTHORED</dt><dd>{selected.commit.author?.date?new Date(selected.commit.author.date).toLocaleString():'Unknown'}</dd><dt>PARENTS</dt><dd>{selected.parents.map(p=><code key={p.sha}>{p.sha.slice(0,7)}{state.commits.some(c=>c.sha===p.sha)?'':' · not loaded'} </code>)}</dd></dl><a className="commit-link" href={selected.html_url.startsWith('https://github.com/')?selected.html_url:'#'} target="_blank" rel="noreferrer">View on GitHub ↗</a><pre>{emojify(selected.commit.message.split('\n').slice(1).join('\n'))}</pre></>:<p>Tap a node to inspect a commit.</p>}{state.commits.length>0&&<label className="keyboard">Select commit<select aria-label="Select commit" value={selected?.sha||''} onChange={e=>{const c=state.commits.find(c=>c.sha===e.target.value);if(c)select(c);}}><option value="">Choose a commit</option>{state.commits.map(c=><option key={c.sha} value={c.sha}>{c.sha.slice(0,7)} {emojify(c.commit.message.split('\n')[0])}</option>)}</select></label>}</aside>}
  {state.error&&<div className="error floating-panel" role="alert">{state.error}<button disabled={state.busy||retrySeconds>0} onClick={()=>void history.retry()}>{retryLabel(retrySeconds)}</button>{state.error.includes('GitHub')&&<button onClick={()=>setAuth(true)}>Access token</button>}</div>}
  <footer className="graph-status" aria-live="polite"><span><i/> {state.commits.length.toLocaleString()} commits</span>{state.busy?<span className="history-loading" role="status" aria-label="Loading history"><span className="loading-spinner" aria-hidden="true"/></span>:!state.more&&state.repo&&<span>End of available history</span>}</footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
