import {useEffect,useRef,useState} from 'react';
import {ancestors,layout,ROW,type Commit,type Branch} from './model';
const colors=['#70e0b4','#8f9fff','#e9b575','#d493dc','#74c4ed','#df8895'];
export function Graph({commits,branches,branch,reverse,onSelect,selected}:{commits:Commit[];branches:Branch[];branch:string;reverse:boolean;onSelect:(c:Commit)=>void;selected:string}){
 const container=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),prior=useRef(new Map<string,number>());
 const [view,setView]=useState({top:0,width:800,height:600});
 const data=layout(commits,prior.current);useEffect(()=>{prior.current=data.lanes;},[commits]);
 const ordered=reverse?[...data.ordered].reverse():data.ordered;
 const positions=new Map(ordered.map((c,i)=>[c.sha,{x:40+(data.lanes.get(c.sha)||0)*30,y:i*ROW+36}]));
 const head=branches.find(b=>b.name===branch)?.commit.sha;
 const highlighted=head?ancestors(head,commits):null;
 const maxLane=Array.from(data.lanes.values()).reduce((a,b)=>Math.max(a,b),0);
 const width=Math.max(view.width,250+maxLane*30),height=Math.max(view.height,ordered.length*ROW+60);
 useEffect(()=>{const el=container.current!;const observer=new ResizeObserver(()=>setView(v=>({...v,width:el.clientWidth,height:el.clientHeight})));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{const ctx=canvas.current!.getContext('2d')!;const dpr=window.devicePixelRatio||1;canvas.current!.width=width*dpr;canvas.current!.height=view.height*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,width,view.height);ctx.translate(0,-view.top);
 const text=getComputedStyle(container.current!).getPropertyValue('--text');
 for(const c of ordered){const p=positions.get(c.sha)!;for(const parent of c.parents){const end=positions.get(parent.sha);const ey=end?.y??p.y+(reverse?-35:35);if(Math.max(p.y,ey)<view.top-ROW||Math.min(p.y,ey)>view.top+view.height+ROW)continue;ctx.globalAlpha=highlighted&&!highlighted.has(c.sha)?0.12:0.7;ctx.strokeStyle=colors[(data.lanes.get(c.sha)||0)%colors.length];ctx.lineWidth=1.6;ctx.setLineDash(end?[]:[4,4]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(p.x,(p.y+ey)/2,end?.x??p.x,(p.y+ey)/2,end?.x??p.x,ey);ctx.stroke();} }
 ctx.setLineDash([]);
 for(const c of ordered){const p=positions.get(c.sha)!;if(p.y<view.top-ROW||p.y>view.top+view.height+ROW)continue;ctx.globalAlpha=highlighted&&!highlighted.has(c.sha)?0.25:1;ctx.fillStyle=colors[(data.lanes.get(c.sha)||0)%colors.length];ctx.beginPath();ctx.arc(p.x,p.y,c.sha===selected?7:4.5,0,Math.PI*2);ctx.fill();if(c.parents.length>1){ctx.strokeStyle=text;ctx.lineWidth=1;ctx.stroke();}const tx=130+maxLane*30;ctx.fillStyle=text;ctx.font='13px system-ui';ctx.fillText(c.commit.message.split('\n')[0].slice(0,85),tx,p.y-2);ctx.globalAlpha*=0.5;ctx.font='11px monospace';const refs=branches.filter(b=>b.commit.sha===c.sha).map(b=>b.name).join(' · ');ctx.fillText(`${c.sha.slice(0,7)}  ${refs||c.commit.author?.name||'Unknown author'}`,tx,p.y+17);}
 ctx.globalAlpha=1;
 },[commits,branch,reverse,view,selected,branches,width]);
 function pick(clientY:number){const i=Math.round((clientY-container.current!.getBoundingClientRect().top+view.top-36)/ROW);if(ordered[i])onSelect(ordered[i]);}
 return <div className="graph-scroll" ref={container} onScroll={e=>setView(v=>({...v,top:e.currentTarget.scrollTop}))}><div style={{height,width,position:'relative'}}><canvas aria-label="Commit history graph. Use the commit selector below for keyboard access." ref={canvas} style={{position:'sticky',top:0,width,height:view.height,display:'block'}} onClick={e=>pick(e.clientY)} onMouseMove={e=>{if(e.buttons===0)pick(e.clientY);}}/></div></div>;
}
