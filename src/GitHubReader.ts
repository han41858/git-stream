import {github,GitHubError,type GitHubPage} from './api';
import {RequestPool} from './RequestPool';

// Each repository/token session owns its conditional cache and cancellation scope.
export class GitHubReader {
 private cache=new Map<string,GitHubPage<unknown>>();
 private pending=new Map<string,Promise<GitHubPage<unknown>>>();
 private pool=new RequestPool(4);
 readonly controller=new AbortController();
 retryAt=0;
 constructor(private readonly token:string){}
 cancel(){this.controller.abort();this.cache.clear();this.pending.clear();}
 get<T>(path:string,immutable=false):Promise<GitHubPage<T>>{
  if(immutable&&this.cache.has(path))return Promise.resolve(this.cache.get(path) as GitHubPage<T>);
  const old=this.pending.get(path);if(old)return old as Promise<GitHubPage<T>>;
  if(this.retryAt>Date.now())return Promise.reject(new GitHubError('GitHub API rate limit reached. Waiting to retry.',429,this.retryAt));
  const signal=this.controller.signal;
  const task=this.pool.run(signal,()=>github<T>(path,this.token,signal,this.cache.get(path) as GitHubPage<T>|undefined)).then(result=>{signal.throwIfAborted();this.cache.set(path,result);return result;}).catch(error=>{if(error instanceof GitHubError&&error.retryAt)this.retryAt=Math.max(this.retryAt,error.retryAt);throw error;}).finally(()=>{if(this.pending.get(path)===task)this.pending.delete(path);});
  this.pending.set(path,task);return task;
 }
}
