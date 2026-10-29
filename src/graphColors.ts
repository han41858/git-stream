import type {Branch,Commit} from './model';
export type GraphColors={nodes:Map<string,number>;branches:Map<string,number>;edges:Map<string,number>};
export const emptyGraphColors=():GraphColors=>({nodes:new Map(),branches:new Map(),edges:new Map()});
const tone=(key:string)=>{let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);return 1+(hash>>>0)%5;};

// Colors follow first-parent paths, not the reusable columns used for placement.
export function graphColors(commits:Commit[],ordered:Commit[],branches:Branch[],base:string,spine:Set<string>,previous=emptyGraphColors()):GraphColors{
 const map=new Map(commits.map(c=>[c.sha,c]));const result=emptyGraphColors();
 const firstChildren=new Map<string,number>();
 for(const c of commits){const parent=c.parents[0]?.sha;if(parent)firstChildren.set(parent,(firstChildren.get(parent)||0)+1);}
 for(const sha of spine)result.nodes.set(sha,0);
 const paint=(head:string,color:number)=>{
  let sha:string|undefined=head;
  while(sha&&!result.nodes.has(sha)){
   // A newly discovered join keeps the color of its already displayed trunk.
   const old=previous.nodes.get(sha);
   if(sha!==head&&old!==undefined&&old!==color&&(firstChildren.get(sha)||0)>1)break;
   result.nodes.set(sha,color);sha=map.get(sha)?.parents[0]?.sha;
  }
 };
 const refs=[...branches].sort((a,b)=>Number(b.name===base)-Number(a.name===base)||a.name.localeCompare(b.name));
 for(const ref of refs){
  if(!map.has(ref.commit.sha))continue;
  const color=result.nodes.get(ref.commit.sha)??previous.branches.get(ref.name)??previous.nodes.get(ref.commit.sha)??tone(ref.name);
  paint(ref.commit.sha,color);result.branches.set(ref.name,result.nodes.get(ref.commit.sha)!);
 }
 for(const c of ordered)if(!result.nodes.has(c.sha))paint(c.sha,previous.nodes.get(c.sha)??tone(c.sha));
 for(const c of commits)for(let i=0;i<c.parents.length;i++){
  const parent=c.parents[i].sha;
  if(!result.nodes.has(parent))result.nodes.set(parent,previous.nodes.get(parent)??tone(parent));
  // A merge connector belongs to the incoming side path, not the merge node.
  result.edges.set(`${c.sha}:${parent}`,i===0?result.nodes.get(c.sha)!:result.nodes.get(parent)!);
 }
 return result;
}
