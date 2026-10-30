import {lazy,Suspense,useEffect,useSyncExternalStore} from 'react';
import {debug} from './debug';

const DebugUI=lazy(()=>import('./DebugPanel'));

// Stays in the main bundle: only the activation shortcut and mode wiring. The UI loads when debug mode turns on.
export function DebugRoot({developer}:{developer:boolean}){
 const mode=useSyncExternalStore(debug.subscribeMode,debug.getMode);
 useEffect(()=>{
  if(!developer)return;
  const key=(event:KeyboardEvent)=>{if(event.ctrlKey&&event.shiftKey&&event.code==='KeyD'){event.preventDefault();debug.toggle();}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[developer]);
 useEffect(()=>{
  if(mode==='off')return;
  const visibility=()=>debug.setHidden(document.hidden);
  visibility();document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);
 },[mode==='off']);
 if(mode==='off')return null;
 return <Suspense fallback={null}><DebugUI mode={mode}/></Suspense>;
}
