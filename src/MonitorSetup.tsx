import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {MONITOR_LIMIT,monitorRepository,normalizeMonitorRepositories,type MonitorRepositories} from './MonitorRepositories';
import type {RecentRepositories} from './RecentRepositories';
import {lowercaseField} from './repoInput';

export function MonitorSetup({current,recent,saved,onStart,onClose}:{current:string;recent:RecentRepositories;saved:MonitorRepositories;onStart:(repositories:string[])=>void;onClose:()=>void}){
 const visits=useSyncExternalStore(recent.subscribe,recent.getSnapshot);
 const [selected,setSelected]=useState(()=>normalizeMonitorRepositories([current,...saved.getSnapshot()]));
 const [input,setInput]=useState(''),[error,setError]=useState('');
 const dialog=useRef<HTMLElement>(null),field=useRef<HTMLInputElement>(null);
 useEffect(()=>{dialog.current?.focus();},[]);
 function add(value:string){
  let repository:string;try{repository=monitorRepository(value);}catch{setError('Enter a GitHub URL or owner/repository.');return;}
  if(selected.includes(repository)){setError('Repository already selected.');return;}
  if(selected.length>=MONITOR_LIMIT){setError(`Select up to ${MONITOR_LIMIT} repositories.`);return;}
  setSelected(names=>[...names,repository]);setInput('');setError('');
 }
 return <div className="monitor-setup-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget)onClose();}}>
  <section className="monitor-setup floating-panel" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="monitor-setup-title" onKeyDown={event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}
   if(event.key==='Tab'){
    const controls=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!controls?.length)return;
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   }
  }}>
   <button className="close" aria-label="Close monitor setup" onClick={onClose}>×</button>
   <h2 id="monitor-setup-title">Monitor repositories</h2><p>Watch up to {MONITOR_LIMIT} repositories side by side. Landscape works best.</p>
   <ol className="monitor-selected" aria-label="Selected repositories">{selected.map(repository=><li key={repository}><span title={repository}>{repository}</span><button type="button" aria-label={`Remove ${repository} from monitor`} onClick={()=>{setSelected(names=>names.filter(name=>name!==repository));setError('');}}>×</button></li>)}</ol>
   <form className="monitor-add" onSubmit={event=>{event.preventDefault();add(input);field.current?.focus();}}>
    <input ref={field} aria-label="Repository to monitor" placeholder="owner/repository" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={input} onChange={event=>{setInput(lowercaseField(event.currentTarget));setError('');}}/>
    <button type="submit" disabled={selected.length>=MONITOR_LIMIT}>Add</button>
   </form>
   {error&&<p className="monitor-setup-error" role="alert">{error}</p>}
   {visits.entries.length>0&&<><h3>Recent repositories</h3><div className="monitor-recent">{visits.entries.map(entry=><button type="button" key={entry.repository} title={entry.repository} disabled={selected.includes(entry.repository)||selected.length>=MONITOR_LIMIT} aria-label={`Add ${entry.repository} to monitor`} onClick={()=>add(entry.repository)}><span aria-hidden="true">↶</span><span>{entry.repository}</span></button>)}</div></>}
   <div className="monitor-setup-actions"><small>{selected.length} / {MONITOR_LIMIT}</small><button type="button" className="primary" disabled={!selected.length} onClick={()=>onStart(selected)}>Start monitoring</button></div>
  </section>
 </div>;
}
