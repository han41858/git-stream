import type {Branch,Commit} from './model';
import type {ClosedPull} from './recommendations';
import {requestActivity} from './requestActivity';
export type BranchActivity={ref:string;timestamp:string;activity_type:string};
export class GitHubError extends Error {constructor(message:string,readonly status:number,readonly retryAt?:number){super(message);}}
export async function github<T>(path:string,token:string,signal?:AbortSignal):Promise<{data:T;next:boolean;lastPage?:number;nextCursor?:string}>{
 const finish=requestActivity.begin(signal);
 try{
 let r:Response;try{r=await fetch(`https://api.github.com${path}`,{signal,headers:{Accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})}});}catch(e){if(signal?.aborted)throw e;throw new Error('Could not reach GitHub. Check your connection and retry.');}
 if(!r.ok){
  if(r.status===403||r.status===429){
   const remaining=r.headers.get('X-RateLimit-Remaining'),retry=r.headers.get('Retry-After');
   let rateMessage=false;
   try{const body=await r.json();rateMessage=typeof body?.message==='string'&&/rate limit|abuse detection/i.test(body.message);}catch{/* Error bodies are never shown to users. */}
   if(r.status===429||remaining==='0'||retry!==null||rateMessage){
    const reset=Number(r.headers.get('X-RateLimit-Reset'))*1000;
    const retryTime=retry!==null?(/^\d+$/.test(retry)?Date.now()+Number(retry)*1000:Date.parse(retry)):NaN;
    const retryAt=Number.isFinite(retryTime)?retryTime:remaining==='0'&&reset>Date.now()?reset:Date.now()+60000;
    const time=new Date(retryAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    throw new GitHubError(`GitHub API rate limit reached. Retry after ${time}.${!token?' An access token raises the usual hourly limit.':''}`,r.status,retryAt);
   }
   throw new GitHubError('GitHub denied access. Check repository access and token permissions.',r.status);
  }
  throw new GitHubError(r.status===401?'The token is invalid or expired.':r.status===404?'Repository not found, or your token does not have access.':r.status===409?'This repository has no commits.':`GitHub request failed (${r.status}). Please retry.`,r.status);
 }
 const link=r.headers.get('Link')||'';
 const last=link.match(/<([^>]+)>;\s*rel="last"/);
 const page=last?Number(new URL(last[1],'https://api.github.com').searchParams.get('page')):NaN;
 const next=link.match(/<([^>]+)>;\s*rel="next"/);
 const cursor=next?new URL(next[1],'https://api.github.com').searchParams.get('after'):null;
 return {data:await r.json(),next:/rel="next"/.test(link),...(Number.isSafeInteger(page)&&page>0?{lastPage:page}:{}),...(cursor?{nextCursor:cursor}:{})};
 }finally{finish();}
}
export const commitsPage=(repo:string,branch:string,page:number,token:string,signal?:AbortSignal,since?:number)=>github<Commit[]>(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}${since===undefined?'':`&since=${encodeURIComponent(new Date(since).toISOString())}`}`,token,signal);
export const branchesPage=(repo:string,page:number,token:string,signal?:AbortSignal)=>github<Branch[]>(`/repos/${repo}/branches?per_page=100&page=${page}`,token,signal);

export async function branchByName(repo:string,name:string,token:string,signal?:AbortSignal){
 try{return (await github<Branch>(`/repos/${repo}/branches/${encodeURIComponent(name)}`,token,signal)).data;}
 catch(e){if(e instanceof GitHubError&&e.status===404)return null;throw e;}
}
export const closedPullsPage=(repo:string,page:number,token:string,signal?:AbortSignal)=>github<ClosedPull[]>(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`,token,signal);

export const branchActivityPage=(repo:string,after:string|undefined,token:string,signal?:AbortSignal)=>github<BranchActivity[]>(`/repos/${repo}/activity?time_period=year&direction=desc&per_page=100${after===undefined?'':`&after=${encodeURIComponent(after)}`}`,token,signal);
