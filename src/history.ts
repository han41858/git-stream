import {GitHubError,branchByName,branchesPage,closedPullsPage,commitsPage,github,branchActivityPage} from './api';
import {preferredBranch,PullCounts,RECOMMENDATION_LIMIT} from './recommendations';
import {RequestPool} from './RequestPool';
import {parseRepo,commitTime, type Branch, type Commit, type HistoryFrontier} from './model';

type Meta = {default_branch:string; description:string|null; stargazers_count:number};
export type HistorySnapshot = {repo:string; meta:Meta|null; base:string; reverse:boolean; discoveryError:string; discoveryRetryAt:number|null; commits:Commit[]; branches:Branch[]; busy:boolean; error:string; retryAt:number|null; more:boolean; moreBranches:boolean; frontiers:HistoryFrontier[]; pendingSources:string[]; ranking:{counts:Record<string,number>; scanned:number; busy:boolean; complete:boolean; error:string; retryAt:number|null}; branchSearch:{busy:boolean; error:string}};
const empty = ():HistorySnapshot => ({repo:'',meta:null,base:'',reverse:false,discoveryError:'',discoveryRetryAt:null,commits:[],branches:[],busy:false,error:'',retryAt:null,more:false,moreBranches:false,frontiers:[],pendingSources:[],ranking:{counts:{},scanned:0,busy:false,complete:false,error:'',retryAt:null},branchSearch:{busy:false,error:''}});

// Ref names never drive history loading. Repository activity supplies independent
// live heads that cannot be discovered by following the selected head's parents.
export class History {
 private snapshot=empty();
 private listeners=new Set<()=>void>();
 private controllers=new Set<AbortController>();
 private generation=0;
 private commitPool=new RequestPool();
 private commitRequests=new Map<string,ReturnType<typeof commitsPage>>();
 private sourceTasks=new Map<string,Promise<void>>();
 private failedSources=new Set<string>();
 private discoveryTask:{signal:AbortSignal;promise:Promise<void>}|null=null;
 private commits=new Map<string,Commit>();
 private queried=new Set<string>();
 private started=false;
 private historyHead='';
 private nextPage=0;
 private forwardWindow:Commit[]=[];
 private activity=new Map<string,number>();
 private activityCursor:string|undefined;
 private activityRequested=new Set<string>();
 private activityNext=true;
 private oldestActivity=Infinity;
 private admitted=new Map<string,number>();
 private sideCommits=new Set<string>();
 private refsPage=0;
 private refsNext=true;
 private token='';
 private retryRefs=false;
 private rankingController:AbortController|null=null;
 private searchController:AbortController|null=null;
 private pulls=new PullCounts();
 private pullPage=0;
 private pullsNext=true;
 private checkedRefs=new Map<string,Branch|null>();
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.snapshot;
 setToken=(token:string)=>{this.token=token;};
 private publish(patch:Partial<HistorySnapshot>={}) {
  this.snapshot={...this.snapshot,...patch};
  this.snapshot.more=this.snapshot.frontiers.length>0;
  this.snapshot.moreBranches=this.refsNext;
  for(const listener of this.listeners)listener();
 }
 private current(signal:AbortSignal){signal.throwIfAborted();}
 private async run(task:(signal:AbortSignal)=>Promise<void>,clearError=true) {
  const controller=new AbortController();this.controllers.add(controller);
  this.publish({busy:true,...(clearError?{error:'',retryAt:null}:{})});
  try {await task(controller.signal);}
  catch(error){
   if(!controller.signal.aborted){
    const retryAt=error instanceof GitHubError?error.retryAt||null:null;
    if(!this.snapshot.error||(retryAt||0)>(this.snapshot.retryAt||0))this.publish({error:(error as Error).message,retryAt});
   }
  }
  finally {if(this.controllers.delete(controller)&&!controller.signal.aborted)this.publish({busy:this.controllers.size>0});}
 }
 cancel=()=>{this.generation++;for(const controller of this.controllers)controller.abort();this.rankingController?.abort();this.searchController?.abort();};
 private resetTraversal(){
  for(const controller of this.controllers)controller.abort();this.controllers.clear();this.generation++;
  this.commitPool=new RequestPool();this.commitRequests.clear();this.sourceTasks.clear();this.failedSources.clear();this.discoveryTask=null;
  this.commits.clear();this.queried.clear();
  this.admitted.clear();this.sideCommits.clear();this.retryRefs=false;this.started=false;this.historyHead='';this.nextPage=0;this.forwardWindow=[];
 }
 private fetchCommits(ref:string,page:number,signal:AbortSignal,since?:number){
  const key=`${ref}:${page}:${since??''}`;
  const existing=this.commitRequests.get(key);if(existing)return existing;
  const repo=this.snapshot.repo,token=this.token;
  const request=this.commitPool.run(signal,()=>commitsPage(repo,ref,page,token,signal,since)).finally(()=>{
   if(this.commitRequests.get(key)===request)this.commitRequests.delete(key);
  });
  this.commitRequests.set(key,request);return request;
 }
 clear=()=>{
  this.cancel();this.resetTraversal();this.rankingController=null;this.searchController=null;this.token='';
  this.pulls=new PullCounts();this.pullPage=0;this.pullsNext=true;this.checkedRefs.clear();
  this.activity.clear();this.activityCursor=undefined;this.activityRequested.clear();this.activityNext=true;this.oldestActivity=Infinity;
  this.refsPage=0;this.refsNext=false;this.snapshot=empty();this.publish();
 };
 private integrate(data:Commit[]){
  for(const commit of data)this.commits.set(commit.sha,commit);
  const frontiers:HistoryFrontier[]=[];
  if(this.snapshot.reverse){
   if(this.nextPage>0){
    const parents=new Set([...this.commits.values()].flatMap(commit=>commit.parents.map(parent=>parent.sha)));
    const tips=this.forwardWindow.filter(commit=>!parents.has(commit.sha));
    for(const commit of tips.length?tips:this.forwardWindow.slice(0,1))frontiers.push({sha:commit.sha,sources:[`page:${this.nextPage}`]});
   }
  }
  for(const commit of this.commits.values()){
    if(this.snapshot.reverse&&!this.sideCommits.has(commit.sha))continue;
    const sources=[...new Set(commit.parents.map(parent=>parent.sha))].filter(sha=>!this.commits.has(sha)&&!this.queried.has(sha));
    if(sources.length)frontiers.push({sha:commit.sha,sources});
  }
  const range=this.historyRange();
  if(range&&this.activityNeeded(range))frontiers.push({sha:range.anchor,sources:['activity']});
  this.publish({commits:[...this.commits.values()],frontiers});
 }
 private async start(signal:AbortSignal){
  const first=await this.fetchCommits(this.snapshot.base,1,signal);this.current(signal);
  this.historyHead=first.data[0]?.sha||'';
  let result=first;
  if(this.snapshot.reverse){
   if(first.next&&!first.lastPage)throw new Error('GitHub did not provide the oldest history page. Please retry.');
   const last=first.lastPage||1;
   if(last>1){result=await this.fetchCommits(this.historyHead,last,signal);this.current(signal);}
   this.nextPage=last-1;this.forwardWindow=result.data;
  }
  if(this.historyHead)this.addRefs([{name:this.snapshot.base,commit:{sha:this.historyHead}}]);
  this.started=true;this.integrate(result.data);await this.discoverActive(signal);
 }
 private historyRange(){
  const known:Commit[]=[];const seen=new Set<string>();let sha:string|undefined=this.historyHead;
  while(sha&&!seen.has(sha)){
   seen.add(sha);const commit=this.commits.get(sha);if(!commit)break;known.push(commit);sha=commit.parents[0]?.sha;
  }
  let min=Infinity,max=-Infinity,anchor='';
  for(const commit of known.length?known:this.forwardWindow){
   const time=commitTime(commit);if(!Number.isFinite(time))continue;
   if(time<min){min=time;anchor=commit.sha;}max=Math.max(max,time);
  }
  return anchor?{min,max,anchor}:null;
 }
 private activityNeeded(range:{min:number;max:number}){
  if(this.snapshot.discoveryError||this.snapshot.reverse&&this.nextPage>0)return false;
  if([...this.activity].some(([name,time])=>name!==this.snapshot.base&&(this.admitted.get(name)===undefined||range.min<this.admitted.get(name)!)&&time>=range.min&&(!this.snapshot.reverse||time<=range.max)))return true;
  return this.activityNext&&this.oldestActivity>=range.min;
 }
 private async discoverActive(signal:AbortSignal){
  if(this.discoveryTask&&!this.discoveryTask.signal.aborted)return this.discoveryTask.promise;
  const task={signal,promise:this.performDiscovery(signal)};this.discoveryTask=task;
  try{await task.promise;}finally{if(this.discoveryTask===task)this.discoveryTask=null;}
 }
 private async performDiscovery(signal:AbortSignal){
  const range=this.historyRange();if(!range||!this.activityNeeded(range))return;
  try{
   // One metadata page and at most three independent histories per batch.
   if(this.activityNext&&this.oldestActivity>=range.min){
    const result=await branchActivityPage(this.snapshot.repo,this.activityCursor,this.token,signal);this.current(signal);
    if(!Array.isArray(result.data))throw new Error('Recent branch activity is unavailable.');
    if(result.next&&(!result.nextCursor||result.nextCursor===this.activityCursor||this.activityRequested.has(result.nextCursor)))throw new Error('GitHub branch activity pagination did not advance. Please retry.');
    this.activityRequested.add(this.activityCursor??'');this.activityCursor=result.nextCursor;this.activityNext=result.next;
    for(const event of result.data){
     const time=Date.parse(event.timestamp);if(!Number.isFinite(time))continue;
     this.oldestActivity=Math.min(this.oldestActivity,time);
     if(!['push','pr_merge','merge_queue_merge','force_push','branch_creation'].includes(event.activity_type)||!event.ref.startsWith('refs/heads/'))continue;
     const name=event.ref.slice('refs/heads/'.length);
     this.activity.set(name,Math.max(this.activity.get(name)??-Infinity,time));
    }
   }
   const candidates=[...this.activity].filter(([name,time])=>name!==this.snapshot.base&&(this.admitted.get(name)===undefined||range.min<this.admitted.get(name)!)&&time>=range.min&&(!this.snapshot.reverse||time<=range.max)).sort((a,b)=>b[1]-a[1]).slice(0,3);
   const results=await Promise.allSettled(candidates.map(async([name])=>{
    const ref=this.snapshot.branches.find(branch=>branch.name===name)??await branchByName(this.snapshot.repo,name,this.token,signal);this.current(signal);
    if(ref){
     this.addRefs([ref]);
     if(!this.commits.has(ref.commit.sha)){
      const result=await this.fetchCommits(ref.commit.sha,1,signal,range.min);this.current(signal);
      // A fresh push of an ancient head must not inject that old history.
      const recent=result.data.filter(commit=>!Number.isFinite(commitTime(commit))||commitTime(commit)>=range.min);
      for(const commit of recent)this.sideCommits.add(commit.sha);
      this.integrate(recent);
     }
    }
    // An empty since-filtered page is deferred, not permanently forgotten.
    // Reconsider it when exploration reaches an older date window.
    this.current(signal);this.admitted.set(name,!ref||this.commits.has(ref.commit.sha)?-Infinity:range.min);
   }));
   const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')throw failed.reason;
  }catch(error){
   if(signal.aborted)return;
   this.publish({discoveryError:(error as Error).message,discoveryRetryAt:error instanceof GitHubError?error.retryAt||null:null});
  }
  if(!signal.aborted)this.integrate([]);
 }
 retryDiscovery=async()=>{
  if(this.snapshot.busy||this.snapshot.error||!this.snapshot.meta||(this.snapshot.discoveryRetryAt||0)>Date.now())return;
  this.publish({discoveryError:'',discoveryRetryAt:null});
  await this.run(signal=>this.discoverActive(signal));
 };
 private addRefs(refs:Branch[]){
  const branches=new Map(this.snapshot.branches.map(b=>[b.name,b]));
  for(const ref of refs)branches.set(ref.name,ref);
  this.publish({branches:[...branches.values()]});
 }
 private async fetchRefs(signal:AbortSignal) {
  const result=await branchesPage(this.snapshot.repo,this.refsPage+1,this.token,signal);
  this.current(signal);this.refsPage++;this.refsNext=result.next;
  // Ref pagination enriches labels/picker choices without fetching any commits.
  this.addRefs(result.data.filter(ref=>ref.name!==this.snapshot.base||!this.started));
 }
 open=async(value:string,token=this.token)=>{
  let repo:string;
  try{repo=parseRepo(value);}catch(e){this.publish({error:(e as Error).message});return;}
  this.clear();this.token=token;this.refsNext=true;this.publish({repo});
  await this.run(async signal=>{
   const {data:meta}=await github<Meta>(`/repos/${repo}`,this.token,signal);
   this.current(signal);this.publish({meta,base:meta.default_branch});
   await this.fetchRefs(signal);
   for(const name of new Set(['main','master',meta.default_branch])){
    if(this.snapshot.branches.some(b=>b.name===name))continue;
    if(this.refsNext){const ref=await branchByName(repo,name,this.token,signal);this.current(signal);this.checkedRefs.set(name,ref);if(ref)this.addRefs([ref]);}
   }
   this.publish({base:preferredBranch(this.snapshot.branches,meta.default_branch)});
   await this.start(signal);
  });
 };
 chooseBase=async(name:string)=>{
  if(name===this.snapshot.base)return;
  this.resetTraversal();this.publish({base:name,commits:[],frontiers:[],pendingSources:[],busy:false,error:'',retryAt:null,discoveryError:'',discoveryRetryAt:null});
  await this.run(signal=>this.start(signal));
 };
 setDirection=async(reverse:boolean)=>{
  if(reverse===this.snapshot.reverse)return;
  this.resetTraversal();this.publish({reverse,commits:[],frontiers:[],pendingSources:[],busy:false,error:'',retryAt:null,discoveryError:'',discoveryRetryAt:null});
  if(this.snapshot.meta)await this.run(signal=>this.start(signal));
 };
 private async checkRankedRefs(signal:AbortSignal){
  const names=Object.keys(this.pulls.counts).sort((a,b)=>this.pulls.counts[b]-this.pulls.counts[a]||a.localeCompare(b));
  let checked=0,valid=0;
  for(const name of names){
   if(valid>=RECOMMENDATION_LIMIT)break;
   if(this.snapshot.branches.some(b=>b.name===name)){valid++;continue;}
   if(this.checkedRefs.has(name)){if(this.checkedRefs.get(name))valid++;continue;}
   if(!this.refsNext){this.checkedRefs.set(name,null);continue;}
   if(checked>=5)break;
   const ref=await branchByName(this.snapshot.repo,name,this.token,signal);this.current(signal);checked++;this.checkedRefs.set(name,ref);
   if(ref){valid++;this.addRefs([ref]);}
   if(valid>=RECOMMENDATION_LIMIT)break;
  }
 }
 loadRecommendations=async()=>{
  if(!this.snapshot.meta||this.snapshot.ranking.busy||this.snapshot.ranking.complete||(this.snapshot.ranking.retryAt||0)>Date.now())return;
  const controller=new AbortController();this.rankingController=controller;
  this.publish({ranking:{...this.snapshot.ranking,busy:true,error:'',retryAt:null}});
  try{
   for(let i=0;i<3&&this.pullsNext;i++){
    const result=await closedPullsPage(this.snapshot.repo,this.pullPage+1,this.token,controller.signal);this.current(controller.signal);
    this.pullPage++;const cutoff=this.pulls.add(result.data);this.pullsNext=result.next&&!cutoff;
    this.publish({ranking:{...this.snapshot.ranking,counts:{...this.pulls.counts},scanned:this.pulls.scanned}});
   }
   await this.checkRankedRefs(controller.signal);
   const names=Object.keys(this.pulls.counts).sort((a,b)=>this.pulls.counts[b]-this.pulls.counts[a]||a.localeCompare(b));
   let valid=0,unverified=false;
   for(const name of names){
    if(valid>=RECOMMENDATION_LIMIT)break;
    if(this.snapshot.branches.some(b=>b.name===name)){valid++;continue;}
    if(!this.checkedRefs.has(name)){unverified=true;break;}
   }
   this.publish({ranking:{...this.snapshot.ranking,complete:!this.pullsNext&&!unverified}});
  }catch(e){if(!controller.signal.aborted)this.publish({ranking:{...this.snapshot.ranking,error:(e as Error).message,retryAt:e instanceof GitHubError?e.retryAt||null:null}});}
  finally{if(this.rankingController===controller&&!controller.signal.aborted)this.publish({ranking:{...this.snapshot.ranking,busy:false}});}
 };
 findBranch=async(name:string)=>{
  const known=this.snapshot.branches.find(b=>b.name===name);
  if(known){await this.chooseBase(name);return true;}
  this.searchController?.abort();const controller=new AbortController();this.searchController=controller;
  this.publish({branchSearch:{busy:true,error:''}});
  try{
   const ref=await branchByName(this.snapshot.repo,name,this.token,controller.signal);this.current(controller.signal);
   if(!ref){this.publish({branchSearch:{busy:false,error:'No branch with that exact name.'}});return false;}
   this.addRefs([ref]);
   await this.chooseBase(ref.name);this.current(controller.signal);return true;
  }catch(e){if(!controller.signal.aborted)this.publish({branchSearch:{busy:false,error:(e as Error).message}});return false;}
  finally{if(this.searchController===controller&&!controller.signal.aborted)this.publish({branchSearch:{...this.snapshot.branchSearch,busy:false}});}
 };
 loadBranches=async()=>{
  if(this.snapshot.busy||!this.snapshot.meta||!this.refsNext)return;
  this.retryRefs=true;await this.run(signal=>this.fetchRefs(signal),false);
  if(!this.snapshot.error)this.retryRefs=false;
 };
 private async fetchSource(source:string,signal:AbortSignal){
  try{
   if(source==='activity'){await this.discoverActive(signal);return;}
   if(source.startsWith('page:')){
    if(source!==`page:${this.nextPage}`||this.nextPage<1)return;
    const result=await this.fetchCommits(this.historyHead,this.nextPage,signal);this.current(signal);
    this.nextPage--;this.forwardWindow=result.data;this.integrate(result.data);
   }else{
    if(this.commits.has(source)||this.queried.has(source))return;
    const result=await this.fetchCommits(source,1,signal);this.current(signal);
    if(!result.data.some(commit=>commit.sha===source)&&!this.commits.has(source))throw new Error('GitHub did not return the requested commit. Retry to continue this branch.');
    this.queried.add(source);if(this.snapshot.reverse)for(const commit of result.data)this.sideCommits.add(commit.sha);this.integrate(result.data);
   }
   this.failedSources.delete(source);
  }catch(error){if(!signal.aborted)this.failedSources.add(source);throw error;}
 }
 private scheduleSource(source:string){
  const existing=this.sourceTasks.get(source);if(existing)return existing;
  const generation=this.generation;
  // Register accepted work before run() publishes; subscribers can re-enter here.
  const task=Promise.resolve().then(()=>{
   if(generation===this.generation)return this.run(signal=>this.fetchSource(source,signal),false);
  }).finally(()=>{
   if(this.sourceTasks.get(source)===task){
    this.sourceTasks.delete(source);
    // A response can leave the same cursor unresolved (notably activity pages).
    // Notify after cleanup so the viewport can schedule its continuation again.
    this.publish({pendingSources:[...this.sourceTasks.keys()]});
   }
  });
  this.sourceTasks.set(source,task);this.publish({pendingSources:[...this.sourceTasks.keys()]});return task;
 }
 loadMore=async(sources?:string[])=>{
  if(this.snapshot.error||!this.snapshot.meta||!this.started||!this.snapshot.more)return;
  const generation=this.generation;
  const pending=new Set(this.snapshot.frontiers.flatMap(frontier=>frontier.sources));
  // Capture all visible cursors now. The pool preserves them even after scrolling.
  const targets=[...new Set(sources?.length?sources:pending)].filter(source=>pending.has(source));
  await Promise.all(targets.map(source=>this.scheduleSource(source)));
  if(generation!==this.generation||this.snapshot.error||targets.includes('activity'))return;
  const range=this.historyRange();if(range&&this.activityNeeded(range))await this.scheduleSource('activity');
 };
 retry=async()=>{
  if(this.snapshot.busy||(this.snapshot.retryAt||0)>Date.now())return;
  if(!this.snapshot.meta){await this.open(this.snapshot.repo);return;}
  this.publish({error:'',retryAt:null});
  if(this.retryRefs){await this.run(signal=>this.fetchRefs(signal),false);if(!this.snapshot.error)this.retryRefs=false;return;}
  if(!this.started){await this.run(signal=>this.start(signal),false);return;}
  await this.loadMore(this.failedSources.size?[...this.failedSources]:undefined);
 };
}
