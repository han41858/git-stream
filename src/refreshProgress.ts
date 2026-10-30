// Read the existing deadline; this helper never schedules or changes a refresh.
export function refreshProgress(nextAt:number,interval:number,now:number){
 const valid=Number.isFinite(interval)&&interval>0&&Number.isFinite(nextAt)&&nextAt>0&&Number.isFinite(now);
 const duration=Number.isFinite(interval)&&interval>0?interval:1;
 const elapsed=valid?Math.min(duration,Math.max(0,now-(nextAt-duration))):0;
 return {duration,delay:elapsed===0?0:-elapsed,offset:100*(1-elapsed/duration)};
}
