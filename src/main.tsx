import React,{useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {Graph} from './Graph';
import {CommitDetails} from './CommitDetails';
import {BranchPicker} from './BranchPicker';
import {useRetryCountdown,retryLabel} from './useRetryCountdown';
import {History} from './history';
import {RefreshLoop} from './RefreshLoop';
import {CommitInfoStore} from './CommitInfoStore';
import type {Commit} from './model';
import logo from '../assets/logo.png';
import {emojify} from './emoji';
import {requestActivity} from './requestActivity';
import {readStoredToken,saveStoredToken} from './tokenStorage';
import './style.css';

function App(){
 const [history]=useState(()=>new History());
 const [info]=useState(()=>new CommitInfoStore());
 const extras=useSyncExternalStore(info.subscribe,info.getSnapshot);
 const [loop]=useState(()=>new RefreshLoop(async()=>{const results=await Promise.all([history.refresh(),info.refresh()]);return {error:results.map(result=>result.error).filter(Boolean).join(' · ')||undefined,retryAt:Math.max(0,...results.map(result=>result.retryAt||0))};},()=>!document.hidden&&navigator.onLine));
 const refreshState=useSyncExternalStore(loop.subscribe,loop.getSnapshot);
 const state=useSyncExternalStore(history.subscribe,history.getSnapshot);
 const activeRequests=useSyncExternalStore(requestActivity.subscribe,requestActivity.getSnapshot);
 const loadingSpeed=activeRequests>8?'fast':activeRequests>4?'medium':'slow';
 const retrySeconds=useRetryCountdown(state.retryAt);
 const discoverySeconds=useRetryCountdown(state.discoveryRetryAt);
 const [input,setInput]=useState(new URLSearchParams(location.search).get('repo')||'');
 const [savedToken]=useState(readStoredToken);
 const [appliedToken,setAppliedToken]=useState(savedToken.token),[authRevision,setAuthRevision]=useState(0),[autoRefresh,setAutoRefresh]=useState(true),[intervalChoice,setIntervalChoice]=useState<number|null>(null);
 const seconds=intervalChoice===30&&!appliedToken?300:intervalChoice??(appliedToken?60:300);
 const refreshRetrySeconds=useRetryCountdown(refreshState.retryAt||null);
 const [token,setToken]=useState(savedToken.token),[tokenStorageError,setTokenStorageError]=useState(savedToken.error),[tokenApplied,setTokenApplied]=useState(savedToken.token!==''),[auth,setAuth]=useState(false),[theme,setTheme]=useState('system'),[options,setOptions]=useState(false);
 const [systemTheme,setSystemTheme]=useState(()=>window.matchMedia('(prefers-color-scheme:light)').matches?'light':'dark');
 const resolvedTheme=theme==='system'?systemTheme:theme;
 useEffect(()=>{const media=window.matchMedia('(prefers-color-scheme:light)');const update=()=>setSystemTheme(media.matches?'light':'dark');media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolvedTheme==='light'?'#f2f6fc':'#070a11');},[resolvedTheme]);
 const optionsRef=useRef<HTMLDivElement>(null),toolbarRef=useRef<HTMLElement>(null);
 const [topInset,setTopInset]=useState(window.innerWidth<=800?136:108);
 useLayoutEffect(()=>{
  const el=toolbarRef.current!;const update=()=>setTopInset(Math.ceil(el.getBoundingClientRect().bottom)+20);
  update();const observer=new ResizeObserver(update);observer.observe(el);window.addEventListener('resize',update);
  return()=>{observer.disconnect();window.removeEventListener('resize',update);};
 },[]);
 const [selected,setSelected]=useState<Commit|null>(null),[details,setDetails]=useState(false);
 const reverse=state.reverse;
 useEffect(()=>{void info.open(state.meta?state.repo:'',appliedToken);return()=>info.cancel();},[info,state.repo,!!state.meta,appliedToken,authRevision]);
 useEffect(()=>{loop.configure(state.meta?`${state.repo}:${authRevision}`:'',autoRefresh,seconds*1000);},[loop,state.repo,!!state.meta,authRevision,autoRefresh,seconds]);
 useEffect(()=>{const changed=()=>loop.visibilityChanged();document.addEventListener('visibilitychange',changed);window.addEventListener('online',changed);window.addEventListener('offline',changed);return()=>{loop.stop();document.removeEventListener('visibilitychange',changed);window.removeEventListener('online',changed);window.removeEventListener('offline',changed);};},[loop]);
 useEffect(()=>{if(state.meta&&!state.busy&&extras.repo===state.repo&&!extras.busy&&!Object.keys(extras.errors).length&&!state.error)loop.loaded();},[loop,state.meta,state.busy,state.error,extras]);
 useEffect(()=>{if(selected&&extras.repo===state.repo)void info.inspect(selected.sha);},[info,selected?.sha,extras.repo,state.repo]);
 useEffect(()=>{history.setToken(savedToken.token);if(input)void history.open(input,savedToken.token);return()=>history.cancel();},[history,savedToken]);
 useEffect(()=>{if(state.meta)window.history.replaceState(null,'',`?repo=${encodeURIComponent(state.repo)}`);},[state.repo,state.meta]);
 useEffect(()=>{
  if(!options)return;
  const outside=(event:PointerEvent)=>{if(!optionsRef.current?.contains(event.target as Node))setOptions(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setOptions(false);};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[options]);
 function applyToken(){const value=token.trim(),error=saveStoredToken(value);setToken(value);setAppliedToken(value);setAuthRevision(v=>v+1);setTokenStorageError(error);history.setToken(value);setTokenApplied(value!=='');setAuth(!!error);if(state.repo){setSelected(null);setDetails(false);void history.open(state.repo,value);}}
 function removeToken(){const error=saveStoredToken('');history.clear();void info.open('','');setToken('');setAppliedToken('');setAuthRevision(v=>v+1);setTokenApplied(false);setTokenStorageError(error);setSelected(null);setDetails(false);setAuth(!!error);}
 function open(){setSelected(null);setDetails(false);void history.open(input,appliedToken);}
 function select(commit:Commit){setSelected(commit);setDetails(true);}
 return <div className="app" data-theme={resolvedTheme}>
  <main className="graph-stage">
   {state.commits.length>0?<Graph key={`${state.repo}:${state.base}:${reverse}`} theme={resolvedTheme} commits={state.commits} branches={state.branches} branch={state.base} reverse={reverse} selected={selected?.sha||''} onSelect={select} hasMore={state.more&&!state.error} loading={state.busy} onLoadMore={history.loadMore} frontiers={state.frontiers} pendingSources={state.pendingSources} topInset={topInset} refreshVersion={state.refreshVersion} baseHead={state.baseHead} info={extras.bySha} onVisible={info.watch}/>:<div className="empty"><img className="empty-mark" src={logo} alt="" width="160" height="160"/><h1>Git history, in perspective.</h1>{!state.busy&&<p>Choose a repository. Follow its branches.</p>}{!state.busy&&<button onClick={()=>{setInput('angular/angular');void history.open('angular/angular',appliedToken);}}>Explore angular/angular ↗</button>}</div>}
  </main>
  <header className="topbar" ref={toolbarRef}>
   <a className="brand" href="./" aria-label="GitStream home"><img src={logo} alt="" width="36" height="36"/> GitStream</a>
   <form className="repo-form" onSubmit={e=>{e.preventDefault();open();}}><input aria-label="GitHub repository" value={input} onChange={e=>setInput(e.target.value)} placeholder="owner/repository"/><button type="submit" className="primary explore-button" aria-label="Explore repository" title="Explore repository"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button></form>
   <div className="view-controls"><div className="base-control"><BranchPicker history={history} state={state} onPicked={()=>{setSelected(null);setDetails(false);}}/></div>
    <button className="direction-toggle" aria-label={reverse?'Oldest first; newer commits below':'Newest first; older commits below'} title={reverse?'Oldest first; newer commits below':'Newest first; older commits below'} aria-pressed={reverse} onClick={()=>{setSelected(null);setDetails(false);void history.setDirection(!reverse);}}>{reverse?'↓ Newer':'↓ Older'}</button>
    <button className="refresh-button" aria-label="Refresh repository" title="Refresh repository" disabled={!state.meta||(!state.commits.length&&state.busy)||refreshState.running||refreshRetrySeconds>0} onClick={()=>void loop.refresh()}>↻</button>
    <button className="token-button" aria-label={tokenApplied?'Access token (applied)':'Access token'} title={tokenApplied?'Access token applied':'Access token'} aria-expanded={auth} onClick={()=>{setAuth(!auth);setOptions(false);}}><svg className={`ticket-icon${tokenApplied?' applied':''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6z"/><path d="M15 5v2M15 11v2M15 17v2"/></svg><span className="token-label">Token</span></button>
    <div className="options" ref={optionsRef}><button className="options-trigger" aria-label="Options" aria-expanded={options} aria-controls="options-menu" onClick={()=>setOptions(!options)}>•••</button>{options&&<section className="options-menu floating-panel" id="options-menu" aria-label="View options"><label>Theme<select aria-label="Color theme" value={theme} onChange={e=>setTheme(e.target.value)}><option value="system">System</option><option value="dark">Dark</option><option value="light">Light</option></select></label><label>Auto refresh<input type="checkbox" aria-label="Auto refresh" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/></label><label>Interval<select aria-label="Refresh interval" value={seconds} onChange={e=>setIntervalChoice(Number(e.target.value))}>{appliedToken&&<option value={30}>30 seconds</option>}<option value={60}>1 minute</option><option value={300}>5 minutes</option></select></label></section>}</div>
   </div>
  </header>
  {auth&&<section className="auth floating-panel" aria-label="GitHub access token"><button className="close" aria-label="Close access token" onClick={()=>setAuth(false)}>×</button><h2>GitHub access token</h2><p>Without a token: about 60 requests/hour per IP.<br/>With a token: about 5,000/hour.</p><a className="create-token" href="https://github.com/settings/personal-access-tokens/new?name=GitStream&amp;contents=read&amp;pull_requests=read&amp;actions=read" target="_blank" rel="noreferrer">Create a fine-grained token ↗</a><p>Select your repository, then set <strong>Repository permissions</strong>:</p><dl className="token-permissions"><div><dt>Contents: Read-only</dt><dd>Required to read commits and branches</dd></div><div><dt>Pull requests: Read-only</dt><dd>For PR-based branch recommendations</dd></div><div><dt>Actions: Read-only</dt><dd>Optional workflow runs and jobs</dd></div></dl><form onSubmit={e=>{e.preventDefault();applyToken();}}><label>Access token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Paste your token"/></label><button className="primary" type="submit">Apply token</button></form><small>Saved in this browser until you remove it.</small>{tokenStorageError&&<p role="alert">{tokenStorageError}</p>}<button className="remove-token" onClick={removeToken}>Remove token & clear history</button></section>}
  {details&&<CommitDetails commit={selected} onClose={()=>setDetails(false)} info={extras} onMore={info.loadMore}/>}
  {state.error&&<div className="error floating-panel" role="alert">{state.error}<button disabled={state.busy||retrySeconds>0} onClick={()=>void history.retry()}>{retryLabel(retrySeconds)}</button>{state.error.includes('GitHub')&&<button onClick={()=>setAuth(true)}>Access token</button>}</div>}
  <footer className="graph-status" aria-live="polite"><span><i/> {state.commits.length.toLocaleString()} commits</span>{state.busy||activeRequests>0||refreshState.running?<span className="history-loading" role="status" aria-label={activeRequests?`Loading history, ${activeRequests} active requests`:'Loading history'} aria-live="off"><span className="loading-spinner" data-speed={loadingSpeed} aria-hidden="true"/>{activeRequests>0&&<span className="request-count" aria-hidden="true">x{activeRequests}</span>}</span>:null}{state.discoveryError&&<button className="discovery-retry" title={state.discoveryError} aria-label="Retry recent branch discovery" disabled={state.busy||!!state.error||discoverySeconds>0} onClick={()=>void history.retryDiscovery()}>{discoverySeconds?retryLabel(discoverySeconds):"Retry branches"}</button>}{state.meta&&!refreshState.running&&(refreshRetrySeconds>0||!!refreshState.error||refreshState.lastSuccess!==null)&&<span className="refresh-status" role="status" title={refreshState.error||undefined}>{refreshRetrySeconds?`Retry in ${refreshRetrySeconds}s`:refreshState.error?'Refresh failed':refreshState.lastSuccess!==null?`Updated ${new Date(refreshState.lastSuccess).toLocaleTimeString()}`:''}</span>}{Object.keys(extras.errors).length>0&&<span className="metadata-error" title={Object.values(extras.errors).join(' · ')}>Metadata unavailable</span>}</footer>
 </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
