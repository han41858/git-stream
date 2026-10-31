import {commitTime,type Commit} from './model';

export type MonthMarker={sha:string;label:string};
export function monthMarkers(ordered:Commit[],spine:Set<string>):MonthMarker[]{
 const knownSpine=ordered.filter(commit=>spine.has(commit.sha));
 const calendar=new Map<number,{commit:Commit;time:number;date:Date}>();
 // Use the browser's local calendar; the earliest commit owns the month marker.
 for(const commit of knownSpine.length?knownSpine:ordered){
  const time=commitTime(commit);if(!Number.isFinite(time))continue;
  const date=new Date(time),key=date.getFullYear()*12+date.getMonth();
  if(!calendar.has(key)||time<calendar.get(key)!.time)calendar.set(key,{commit,time,date});
 }
 const earliest=Math.min(...calendar.keys());
 const markers=new Map<string,string>();
 for(const [key,{commit,date}] of calendar){
  // A partial oldest month is not its true beginning. Wait for older context;
  // a known root is the first available commit even if the repo began midmonth.
  if(key===earliest&&commit.parents.length>0)continue;
  markers.set(commit.sha,`${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}`);
 }
 return ordered.flatMap(commit=>markers.has(commit.sha)?[{sha:commit.sha,label:markers.get(commit.sha)!}]:[]);
}
