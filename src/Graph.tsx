import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {layout,ROW,type Commit,type Branch,type HistoryFrontier} from './model';
import {branchTracks,visibleBranchLabels} from './branchLabels';
import {emptyGraphColors,graphColors} from './graphColors';
const colors=['#70e0b4','#8f9fff','#e9b575','#d493dc','#74c4ed','#df8895'];
const labelText=(names:string[])=>{const text=names.join(' · ');return text.length>34?`${text.slice(0,31)}…`:text;};
type Props={commits:Commit[];branches:Branch[];branch:string;reverse:boolean;onSelect:(c:Commit)=>void;selected:string;hasMore:boolean;loading:boolean;onLoadMore:(sources?:string[])=>void;frontiers:HistoryFrontier[];topInset:number;hasUnloadedBranches:boolean;onDiscover:()=>void};
export function Graph({commits,branches,branch,reverse,onSelect,selected,hasMore,loading,onLoadMore,frontiers,topInset,hasUnloadedBranches,onDiscover}:Props){
 const container=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),prior=useRef(new Map<string,number>());
 const priorColors=useRef(emptyGraphColors());
 const [view,setView]=useState({top:0,width:800,height:600});
 const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width:800px)').matches);
 useEffect(()=>{const media=window.matchMedia('(max-width:800px)');const update=()=>setMobile(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const head=branches.find(b=>b.name===branch)?.commit.sha;
 const data=useMemo(()=>layout(commits,prior.current,head),[commits,head]);
 useEffect(()=>{prior.current=data.lanes;},[data]);
 const tones=useMemo(()=>graphColors(commits,data.ordered,branches,branch,data.spine,priorColors.current),[commits,data,branches,branch]);
 useEffect(()=>{priorColors.current=tones;},[tones]);
 const ordered=useMemo(()=>reverse?[...data.ordered].reverse():data.ordered,[data,reverse]);
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
  if(next>=0&&next!==row&&(el.scrollTop>0||reverse)){el.scrollTop+=(next-row)*ROW;setView(v=>({...v,top:el.scrollTop}));}
  lastOrder.current=ordered.map(c=>c.sha);
 },[ordered,padding,reverse]);
 useEffect(()=>{const el=container.current!;const observer=new ResizeObserver(()=>{const {clientWidth:width,clientHeight:height}=el;setView(v=>({...v,width,height}));});observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  if(!hasMore||loading)return;
  const el=container.current!,sources=new Set<string>();
  for(const frontier of frontiers){
   const p=positions.get(frontier.sha);if(!p)continue;
   if(p.x<el.scrollLeft-22||p.x>el.scrollLeft+view.width+22)continue;
   if(p.y<el.scrollTop+padding-60||p.y>el.scrollTop+view.height+300)continue;
   sources.add(frontier.sources.includes(branch)?branch:frontier.sources[0]);
  }
  if(sources.size){onLoadMore([...sources]);return;}
  const nearBoundary=reverse?el.scrollTop<400:el.scrollHeight-el.scrollTop-el.clientHeight<400;
  if(nearBoundary&&hasUnloadedBranches)onDiscover();
 },[view,positions,frontiers,branch,padding,height,hasMore,loading,reverse,onLoadMore,hasUnloadedBranches,onDiscover]);
 useEffect(()=>{
  const ctx=canvas.current!.getContext('2d')!;const dpr=window.devicePixelRatio||1;
  canvas.current!.width=width*dpr;canvas.current!.height=view.height*dpr;
  ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,view.height);ctx.translate(0,-view.top);
  const style=getComputedStyle(container.current!);const text=style.getPropertyValue('--text'),surface=style.getPropertyValue('--surface');
  for(const c of ordered){const p=positions.get(c.sha)!;
   for(const parent of c.parents){const end=positions.get(parent.sha);const spineEdge=data.spine.has(c.sha)&&c.parents[0]?.sha===parent.sha;
    const ex=end?.x??(spineEdge?48:p.x);const ey=end?.y??p.y+(reverse?-35:35);
    if(Math.max(p.y,ey)<view.top-ROW||Math.min(p.y,ey)>view.top+view.height+ROW)continue;
    ctx.globalAlpha=spineEdge?0.95:0.65;ctx.strokeStyle=colors[(tones.edges.get(`${c.sha}:${parent.sha}`)||0)%colors.length];ctx.lineWidth=spineEdge?2.5:1.6;ctx.setLineDash(end?[]:[4,4]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(p.x,(p.y+ey)/2,ex,(p.y+ey)/2,ex,ey);ctx.stroke();
   }
  }
  ctx.setLineDash([]);
  for(const c of ordered){const p=positions.get(c.sha)!;if(p.y<view.top-ROW||p.y>view.top+view.height+ROW)continue;
   ctx.globalAlpha=1;ctx.fillStyle=colors[(tones.nodes.get(c.sha)||0)%colors.length];ctx.beginPath();ctx.arc(p.x,p.y,c.sha===selected?7:4.5,0,Math.PI*2);ctx.fill();
   if(c.parents.length>1){ctx.strokeStyle=text;ctx.lineWidth=1;ctx.stroke();}
   const tx=140+maxLane*34;ctx.fillStyle=text;
   if(!mobile){ctx.font='13px system-ui';ctx.fillText(c.commit.message.split('\n')[0].slice(0,85),tx,p.y-2);}
   if(!mobile){ctx.globalAlpha=0.5;ctx.font='11px monospace';ctx.fillText(`${c.sha.slice(0,7)}  ${c.commit.author?.name||'Unknown author'}`,tx,p.y+17);}
  }
  ctx.globalAlpha=1;ctx.font='11px system-ui';
  const left=container.current!.scrollLeft;
  for(const label of visibleBranchLabels(tracks,view.top+padding-20,view.top+view.height-48,left,left+view.width,names=>ctx.measureText(labelText(names)).width+16)){
   const name=labelText(label.names);
   const boxWidth=ctx.measureText(name).width+16;
   const x=label.boxX!,y=label.boxY!;
   ctx.fillStyle=surface;ctx.beginPath();ctx.roundRect(x,y,boxWidth,22,5);ctx.fill();
   ctx.strokeStyle=colors[(label.color??label.lane)%colors.length];ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=text;ctx.fillText(name,x+8,y+15);
  }
 },[tones,tracks,padding,data,ordered,positions,branches,width,view,selected,mobile,maxLane,reverse]);
 function pick(clientX:number,clientY:number){
  const el=container.current!,rect=el.getBoundingClientRect();const x=clientX-rect.left+el.scrollLeft,y=clientY-rect.top+el.scrollTop;
  const c=ordered[Math.round((y-padding)/ROW)];if(!c)return;
  const p=positions.get(c.sha)!;
  return Math.abs(y-p.y)<=22&&(Math.abs(x-p.x)<=22||(!mobile&&x>=140+maxLane*34))?c:undefined;
 }
 return <div className="graph-scroll" ref={container} tabIndex={0} aria-label="Commit graph. Scroll to load more history." onScroll={e=>{const top=e.currentTarget.scrollTop;setView(v=>({...v,top}));}}><div style={{height,width,position:'relative'}}><canvas aria-label="Commit history graph. Tap a node to inspect it." ref={canvas} style={{position:'sticky',top:0,width,height:view.height,display:'block'}} onClick={e=>{const c=pick(e.clientX,e.clientY);if(c)onSelect(c);}} onMouseMove={e=>{const c=pick(e.clientX,e.clientY);e.currentTarget.title=c?`${c.sha.slice(0,7)} · ${c.commit.message.split('\n')[0]}`:'';}}/></div></div>;
}
