import {useMemo,type CSSProperties} from 'react';
import './RefreshButton.css';

type Props={nextAt:number;interval:number;sweeping:boolean;disabled:boolean;onRefresh:()=>void};
export function RefreshButton({nextAt,interval,sweeping,disabled,onRefresh}:Props){
 // Anchor the CSS animation only when the real refresh deadline changes. Other
 // app renders must not restart it or create another polling timer.
 const style=useMemo(()=>{
  const duration=Math.max(1,interval),elapsed=Math.min(duration,Math.max(0,Date.now()-(nextAt-duration)));
  return {animationDuration:`${duration}ms`,animationDelay:`-${elapsed}ms`,'--refresh-offset':100*(1-elapsed/duration)} as CSSProperties;
 },[nextAt,interval,sweeping]);
 return <button className="refresh-button" aria-label="Refresh repository" title="Refresh repository" disabled={disabled} onClick={onRefresh}>
  <svg className="refresh-fill" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
   {sweeping&&<circle key={`${nextAt}:${interval}`} cx="50" cy="50" r="50" pathLength="100" transform="rotate(-90 50 50)" fill="none" stroke="white" strokeWidth="100" strokeDasharray="100" style={style}/>}
  </svg>
  <span className="refresh-symbol" aria-hidden="true">↻</span>
 </button>;
}
