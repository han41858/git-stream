import {useMemo,type CSSProperties} from 'react';
import './RefreshButton.css';
import {refreshProgress} from './refreshProgress';

type Props={nextAt:number;interval:number;sweeping:boolean;disabled:boolean;onRefresh:()=>void};
export function RefreshButton({nextAt,interval,sweeping,disabled,onRefresh}:Props){
 // Anchor the CSS animation only when the real refresh deadline changes. Other
 // app renders must not restart it or create another polling timer.
 // Include sweeping so re-enabling a hidden sweep catches up to the same deadline.
 const style=useMemo(()=>{
  const {duration,delay,offset}=refreshProgress(nextAt,interval,Date.now());
  return {animationDuration:`${duration}ms`,animationDelay:`${delay}ms`,strokeDashoffset:offset} as CSSProperties;
 },[nextAt,interval,sweeping]);
 return <button className="refresh-button" aria-label="Refresh repository" title="Refresh repository" disabled={disabled} onClick={onRefresh}>
  <svg className="refresh-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
   {sweeping&&<circle key={`${nextAt}:${interval}`} cx="50" cy="50" r="50" pathLength="100" transform="rotate(-90 50 50)" fill="none" strokeWidth="100" strokeDasharray="100" style={style}/>}
  </svg>
  <span className="refresh-symbol" aria-hidden="true">↻</span>
 </button>;
}
