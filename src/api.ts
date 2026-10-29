import type {Branch,Commit} from './model';
export async function github<T>(path:string,token:string,signal?:AbortSignal):Promise<{data:T;next:boolean}>{
 let r:Response;try{r=await fetch(`https://api.github.com${path}`,{signal,headers:{Accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})}});}catch(e){if(signal?.aborted)throw e;throw new Error('Could not reach GitHub. Check your connection and retry.');}
 if(!r.ok){throw new Error(r.status===401?'The token is invalid or expired.':r.status===404?'Repository not found, or your token does not have access.':r.status===403||r.status===429?'GitHub access or rate limit reached. Check token permissions or try later.':r.status===409?'This repository has no commits.':`GitHub request failed (${r.status}). Please retry.`);}
 return {data:await r.json(),next: /rel="next"/.test(r.headers.get('Link')||'')};
}
export const commitsPage=(repo:string,branch:string,page:number,token:string,signal?:AbortSignal)=>github<Commit[]>(`/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`,token,signal);
export const branchesPage=(repo:string,page:number,token:string,signal?:AbortSignal)=>github<Branch[]>(`/repos/${repo}/branches?per_page=100&page=${page}`,token,signal);
