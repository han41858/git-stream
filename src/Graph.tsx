import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {layout,ROW,type Commit,type Branch,type HistoryFrontier} from './model';
import {branchTracks,visibleBranchLabels} from './branchLabels';
import {emptyGraphColors,graphColors} from './graphColors';
import {monthMarkers} from './monthMarkers';
import {emojify} from './emoji';
import {FrontierViewport} from './FrontierViewport';
const labelText=(names:string[])=>{const text=names.join(' · ');return text.length>34?`${text.slice(0,31)}…`:text;};
type Props={theme:string;commits:Commit[];branches:Branch[];branch:string;reverse:boolean;onSelect:(c:Commit)=>void;selected:string;hasMore:boolean;loading:boolean;onLoadMore:(sources?:string[])=>void;frontiers:HistoryFrontier[];pendingSources:string[];topInset:number};
export function Graph({theme,commits,branches,branch,reverse,onSelect,selected,hasMore,loading,onLoadMore,frontiers,pendingSources,topInset}:Props){
 const container=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),prior=useRef(new Map<string,number>());
 const priorColors=useRef(emptyGraphColors());
 const visited=useRef(new FrontierViewport()),encountered=useRef(new Set<string>()),captureFrontiers=useRef<()=>void>(()=>{});
 const [view,setView]=useState({top:0,width:800,height:600});
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:800px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:800px)');const update=()=>setMobile(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const head=branches.find(b=>b.name===branch)?.commit.sha;
 const data=useMemo(()=>layout(commits,prior.current,head),[commits,head]);
 useEffect(()=>{prior.current=data.lanes;},[data]);
 const tones=useMemo(()=>graphColors(commits,data.ordered,branches,branch,data.spine,priorColors.current),[commits,data,branches,branch]);
 useLayoutEffect(()=>{priorColors.current=tones;},[tones]);
 const ordered=useMemo(()=>reverse?[...data.ordered].reverse():data.ordered,[data,reverse]);
 const months=useMemo(()=>monthMarkers(ordered,data.spine),[ordered,data,reverse]);
 const padding=topInset;
 const positions=useMemo(()=>new Map(ordered.map((c,i)=>[c.sha,{x:48+(data.lanes.get(c.sha)||0)*34,y:i*ROW+padding}])) ,[ordered,data,padding]);
 const tracks=useMemo(()=>branchTracks(commits,branches,branch,data.spine,positions,reverse,tones),[commits,branches,branch,data,positions,reverse,tones]);
 const maxLane=Array.from(data.lanes.values()).reduce((a,b)=>Math.max(a,b),0);
 const width=Math.max(view.width,(mobile?110:720)+maxLane*34),height=Math.max(view.height,ordered.length*ROW+padding+80);
 const lastOrder=useRef<string[]>([]);
 // Keep the visible commit in place when pagination inserts rows before it.
 useLayoutEffect(()=>{
  const el=container.current!;const before=lastOrder.current;
  const row=Math.max(0,Math.floor((el.scrollTop-padding)/ROW));
  const anchor=before[row];const next=anchor?ordered.findIndex(c=>c.sha===anchor):-1;
  if(next>=0&&next!==row&&el.scrollTop>0){el.scrollTop+=(next-row)*ROW;setView(v=>({...v,top:el.scrollTop}));}
  lastOrder.current=ordered.map(c=>c.sha);
 },[ordered,padding,reverse]);
 useEffect(()=>{const el=container.current!;const observer=new ResizeObserver(()=>{const {clientWidth:width,clientHeight:height}=el;setView(v=>({...v,width,height}));});observer.observe(el);return()=>observer.disconnect();},[]);
 useLayoutEffect(()=>{
  visited.current.rebase(ordered.map(commit=>commit.sha),padding,ROW);
  captureFrontiers.current=()=>{
   const el=container.current!;
   visited.current.visit({left:el.scrollLeft,top:el.scrollTop,width:el.clientWidth,height:el.clientHeight,inset:padding});
   const unresolved=new Set(frontiers.flatMap(frontier=>frontier.sources));
   for(const source of encountered.current)if(!unresolved.has(source))encountered.current.delete(source);
   for(const frontier of frontiers){
    const position=positions.get(frontier.sha);
    if(position&&visited.current.contains(position))for(const source of frontier.sources)encountered.current.add(source);
   }
   const ready=[...encountered.current].filter(source=>!pendingSources.includes(source));
   if(hasMore&&ready.length)onLoadMore(ready);
  };
  // New pages can reveal unresolved parents behind the current viewport.
  captureFrontiers.current();
 },[ordered,positions,frontiers,pendingSources,padding,hasMore,onLoadMore,view.width,view.height]);
 useEffect(()=>{
  const ctx=canvas.current!.getContext('2d')!;const dpr=window.devicePixelRatio||1;
  canvas.current!.width=width*dpr;canvas.current!.height=view.height*dpr;
  ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,view.height);ctx.translate(0,-view.top);
  const style=getComputedStyle(container.current!);const text=style.getPropertyValue('--text'),surface=style.getPropertyValue('--surface');
  const colors=Array.from({length:6},(_,i)=>style.getPropertyValue(`--graph-${i}`).trim());
  const left=container.current!.scrollLeft,right=left+view.width-16;
  ctx.save();ctx.font='11px system-ui';ctx.textBaseline='bottom';
  for(const marker of months){
   const p=positions.get(marker.sha);if(!p)continue;
   const y=p.y;
   if(y<view.top||y>view.top+view.height)continue;
   ctx.globalAlpha=1;ctx.strokeStyle=style.getPropertyValue('--month-line');ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(left,y+0.5);ctx.lineTo(left+view.width,y+0.5);ctx.stroke();
   const labelWidth=ctx.measureText(marker.label).width;
   ctx.globalAlpha=1;ctx.fillStyle=style.getPropertyValue('--bg');ctx.fillRect(right-labelWidth-5,y-18,labelWidth+10,15);
   ctx.fillStyle=style.getPropertyValue('--muted');ctx.fillText(marker.label,right-labelWidth,y-4);
  }
  ctx.restore();
  for(const c of ordered){const p=positions.get(c.sha)!;
   for(const parent of c.parents){const end=positions.get(parent.sha);const spineEdge=data.spine.has(c.sha)&&c.parents[0]?.sha===parent.sha;
    const ex=end?.x??(spineEdge?48:p.x);const ey=end?.y??p.y+(reverse?-ROW/2:ROW/2);
    if(Math.max(p.y,ey)<view.top-ROW||Math.min(p.y,ey)>view.top+view.height+ROW)continue;
    ctx.globalAlpha=spineEdge?0.95:0.65;ctx.strokeStyle=colors[(tones.edges.get(`${c.sha}:${parent.sha}`)||0)%colors.length];ctx.lineWidth=spineEdge?2.5:1.6;ctx.setLineDash(end?[]:[4,4]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(p.x,(p.y+ey)/2,ex,(p.y+ey)/2,ex,ey);ctx.stroke();
   }
  }
  ctx.setLineDash([]);
  for(const c of ordered){const p=positions.get(c.sha)!;if(p.y<view.top-ROW||p.y>view.top+view.height+ROW)continue;
   ctx.globalAlpha=1;ctx.fillStyle=colors[(tones.nodes.get(c.sha)||0)%colors.length];ctx.beginPath();ctx.arc(p.x,p.y,c.sha===selected?7:4.5,0,Math.PI*2);ctx.fill();
   if(c.parents.length>1){ctx.strokeStyle=text;ctx.lineWidth=1;ctx.stroke();}
   const tx=140+maxLane*34;ctx.fillStyle=text;
   if(!mobile){ctx.font='13px system-ui';ctx.fillText(emojify(c.commit.message.split('\n')[0]).slice(0,85),tx,p.y-3);}
   if(!mobile){ctx.globalAlpha=0.5;ctx.font='11px monospace';ctx.fillText(`${c.sha.slice(0,7)}  ${c.commit.author?.name||'Unknown author'}`,tx,p.y+9);}
  }
  ctx.globalAlpha=1;ctx.font='11px system-ui';
  for(const label of visibleBranchLabels(tracks,view.top+padding-20,view.top+view.height-48,left,left+view.width,names=>ctx.measureText(labelText(names)).width+16)){
   const name=labelText(label.names);
   const boxWidth=ctx.measureText(name).width+16;
   const x=label.boxX!,y=label.boxY!;
   ctx.fillStyle=surface;ctx.beginPath();ctx.roundRect(x,y,boxWidth,22,5);ctx.fill();
   ctx.strokeStyle=colors[(label.color??label.lane)%colors.length];ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=text;ctx.fillText(name,x+8,y+15);
  }
 },[theme,months,tones,tracks,padding,data,ordered,positions,branches,width,view,selected,mobile,maxLane,reverse]);
 function pick(clientX:number,clientY:number){
  const el=container.current!,rect=el.getBoundingClientRect();const x=clientX-rect.left+el.scrollLeft,y=clientY-rect.top+el.scrollTop;
  const c=ordered[Math.round((y-padding)/ROW)];if(!c)return;
  const p=positions.get(c.sha)!;
  return Math.abs(y-p.y)<=22&&(Math.abs(x-p.x)<=22||(!mobile&&x>=140+maxLane*34))?c:undefined;
 }
 return <div className="graph-scroll" ref={container} tabIndex={0} aria-label="Commit graph. Scroll to load more history." onScroll={e=>{captureFrontiers.current();const top=e.currentTarget.scrollTop;setView(v=>({...v,top}));}}><div style={{height,width,position:'relative'}}><canvas aria-label="Commit history graph. Tap a node to inspect it." ref={canvas} style={{position:'sticky',top:0,width,height:view.height,display:'block'}} onClick={e=>{const c=pick(e.clientX,e.clientY);if(c)onSelect(c);}} onMouseMove={e=>{const c=pick(e.clientX,e.clientY);e.currentTarget.title=c?`${c.sha.slice(0,7)} · ${emojify(c.commit.message.split('\n')[0])}`:'';}}/></div></div>;
}
