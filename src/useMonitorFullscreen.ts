import {useEffect,useRef} from 'react';

// Layout mode does not depend on permission to enter browser fullscreen.
export function useMonitorFullscreen(active:boolean,onExit:()=>void){
 const enabled=useRef(active),exit=useRef(onExit),requested=useRef(false),owned=useRef(false),generation=useRef(0);
 enabled.current=active;exit.current=onExit;
 function release(){
  generation.current++;requested.current=false;
  if(owned.current&&document.fullscreenElement===document.documentElement)void document.exitFullscreen?.().catch(()=>{});
  owned.current=false;
 }
 function leave(){release();exit.current();}
 function enter(){
  requested.current=true;const id=++generation.current;
  if(document.fullscreenElement===document.documentElement){owned.current=true;return;}
  if(document.fullscreenElement||!document.documentElement.requestFullscreen)return;
  try{void document.documentElement.requestFullscreen().then(()=>{
   if(id!==generation.current||!requested.current){if(!requested.current&&document.fullscreenElement===document.documentElement)void document.exitFullscreen().catch(()=>{});return;}
   owned.current=document.fullscreenElement===document.documentElement;
  }).catch(()=>{/* The monitor layout remains available after denial. */});}catch{/* Older browsers can throw before returning a promise. */}
 }
 useEffect(()=>{
  const changed=()=>{
   if(!requested.current)return;
   if(document.fullscreenElement===document.documentElement)owned.current=true;
   else if(owned.current){owned.current=false;requested.current=false;exit.current();}
  };
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&enabled.current){event.preventDefault();leave();}};
  document.addEventListener('fullscreenchange',changed);window.addEventListener('keydown',key);
  return()=>{document.removeEventListener('fullscreenchange',changed);window.removeEventListener('keydown',key);release();};
 },[]);
 useEffect(()=>{if(!active)release();},[active]);
 return {enter,leave};
}
