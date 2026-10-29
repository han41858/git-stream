export type Commit = { sha: string; parents: {sha:string}[]; commit: {message:string; author:{name:string;date:string}|null; committer:{date:string}|null}; html_url:string };
export type Branch = {name:string;commit:{sha:string}};
export const ROW = 62;
export function layout(commits: Commit[], previous = new Map<string,number>()) {
  const map = new Map(commits.map(c=>[c.sha,c]));
  const children = new Map<string,number>();
  for(const c of map.values()) for(const p of c.parents) if(map.has(p.sha)) children.set(p.sha,(children.get(p.sha)||0)+1);
  const ready = [...map.values()].filter(c=>!children.get(c.sha));
  const ordered: Commit[]=[];
  for(let i=0;i<ready.length;i++){const c=ready[i];ordered.push(c);for(const p of c.parents)if(map.has(p.sha)){const n=children.get(p.sha)!-1;children.set(p.sha,n);if(!n)ready.push(map.get(p.sha)!);}}
  const lanes = new Map<string,number>(); const active:(string|null)[]=[];
  for(const c of ordered){let lane=active.indexOf(c.sha);if(lane<0){const preferred=previous.get(c.sha);lane=preferred!==undefined&&!active[preferred]?preferred:active.indexOf(null);if(lane<0)lane=active.length;}lanes.set(c.sha,lane);active[lane]=null;
    c.parents.forEach((p,i)=>{if(active.includes(p.sha))return;let slot=i===0?lane:active.indexOf(null);if(slot<0)slot=active.length;active[slot]=p.sha;});}
  return {ordered,lanes};
}
export function ancestors(sha:string, commits:Commit[]){const map=new Map(commits.map(c=>[c.sha,c]));const found=new Set<string>();const todo=[sha];while(todo.length){const s=todo.pop()!;if(found.has(s))continue;found.add(s);for(const p of map.get(s)?.parents||[])todo.push(p.sha);}return found;}
export function parseRepo(input:string){const clean=input.trim().replace(/^https:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/\.git$/,'');if(!/^[\w.-]+\/[\w.-]+$/.test(clean)||clean.split('/').some(s=>s==='.'||s==='..'))throw new Error('Enter a GitHub URL or owner/repository.');return clean;}
