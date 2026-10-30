import {GitHubError,branchByName,branchesPage,closedPullsPage,commitsPage,github} from './api';
import {preferredBranch,PullCounts,RECOMMENDATION_LIMIT} from './recommendations';
import {parseRepo, type Branch, type Commit, type HistoryFrontier} from './model';

type Meta = {default_branch:string; description:string|null; stargazers_count:number};
type Page = {page:number; next:boolean; head:string};
export type HistorySnapshot = {repo:string; meta:Meta|null; base:string; commits:Commit[]; branches:Branch[]; busy:boolean; error:string; retryAt:number|null; more:boolean; moreBranches:boolean; hasUnloadedBranches:boolean; loadedBranches:number; frontiers:HistoryFrontier[]; ranking:{counts:Record<string,number>; scanned:number; busy:boolean; complete:boolean; error:string; retryAt:number|null}; branchSearch:{busy:boolean; error:string}};
const empty = ():HistorySnapshot => ({repo:'',meta:null,base:'',commits:[],branches:[],busy:false,error:'',retryAt:null,more:false,moreBranches:false,hasUnloadedBranches:false,loadedBranches:0,frontiers:[],ranking:{counts:{},scanned:0,busy:false,complete:false,error:'',retryAt:null},branchSearch:{busy:false,error:''}});

// One operation owns a controller. Superseded operations cannot publish stale data.
export class History {
 private snapshot=empty();
 private listeners=new Set<()=>void>();
 private controller:AbortController|null=null;
 private pages=new Map<string,Page>();
 private commits=new Map<string,Commit>();
 private commitSources=new Map<string,Set<string>>();
 private refsPage=0;
 private refsNext=true;
 private cursor=0;
 private token='';
 private retrySources:string[]|undefined;
 private retryContext=false;
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
  this.snapshot.hasUnloadedBranches=this.refsNext||this.snapshot.branches.some(b=>!this.pages.has(b.name)&&!this.commits.has(b.commit.sha));
  this.snapshot.more=this.snapshot.hasUnloadedBranches||this.snapshot.frontiers.length>0;
  this.snapshot.loadedBranches=this.pages.size;
  this.snapshot.moreBranches=this.refsNext;
  for(const listener of this.listeners)listener();
 }
 private current(signal:AbortSignal){signal.throwIfAborted();}
 private async run(task:(signal:AbortSignal)=>Promise<void>) {
  const controller=new AbortController();this.controller=controller;
  this.publish({busy:true,error:'',retryAt:null});
  try {await task(controller.signal);}
  catch(e){if(!controller.signal.aborted)this.publish({error:(e as Error).message,retryAt:e instanceof GitHubError?e.retryAt||null:null});}
  finally {if(this.controller===controller&&!controller.signal.aborted)this.publish({busy:false});}
 }
 cancel=()=>{this.controller?.abort();this.rankingController?.abort();this.searchController?.abort();};
 clear=()=>{
  this.cancel();this.controller=null;this.rankingController=null;this.searchController=null;this.token='';this.pages.clear();this.commits.clear();this.commitSources.clear();this.retrySources=undefined;this.retryContext=false;
  this.pulls=new PullCounts();this.pullPage=0;this.pullsNext=true;this.checkedRefs.clear();
  this.refsPage=0;this.refsNext=false;this.cursor=0;this.snapshot=empty();this.publish();
 };
 private async fetchPage(name:string,signal:AbortSignal) {
  const previous=this.pages.get(name);if(previous&&!previous.next)return;
  const result=await commitsPage(this.snapshot.repo,name,(previous?.page||0)+1,this.token,signal);
  this.current(signal);
  for(const commit of result.data){
   this.commits.set(commit.sha,commit);
   const sources=this.commitSources.get(commit.sha)||new Set<string>();sources.add(name);this.commitSources.set(commit.sha,sources);
  }
  this.pages.set(name,{page:(previous?.page||0)+1,next:result.next,head:previous?.head||result.data[0]?.sha||''});
  const branches=[...this.snapshot.branches];
  const index=branches.findIndex(b=>b.name===name);
  const head=this.pages.get(name)!.head;
  if(head){const ref={name,commit:{sha:head}};if(index<0)branches.unshift(ref);else branches[index]=ref;}
  const frontiers:HistoryFrontier[]=[];
  for(const commit of this.commits.values()){
   if(!commit.parents.some(p=>!this.commits.has(p.sha)))continue;
   const sources=[...this.commitSources.get(commit.sha)||[]].filter(source=>this.pages.get(source)?.next);
   if(sources.length)frontiers.push({sha:commit.sha,sources});
  }
  this.publish({commits:[...this.commits.values()],branches,frontiers});
 }
 private addRefs(refs:Branch[]){
  const branches=new Map(this.snapshot.branches.map(b=>[b.name,b]));
  for(const ref of refs)if(!this.pages.has(ref.name)||!branches.has(ref.name))branches.set(ref.name,ref);
  this.publish({branches:[...branches.values()]});
 }
 private async fetchRefs(signal:AbortSignal) {
  const result=await branchesPage(this.snapshot.repo,this.refsPage+1,this.token,signal);
  this.current(signal);this.refsPage++;this.refsNext=result.next;
  const branches=new Map(this.snapshot.branches.map(b=>[b.name,b]));
  for(const b of result.data)if(!this.pages.has(b.name))branches.set(b.name,b);
  this.publish({branches:[...branches.values()]});
 }
 private async others(signal:AbortSignal) {
  const candidates=this.snapshot.branches.filter(b=>b.name!==this.snapshot.base&&(this.pages.has(b.name)?this.pages.get(b.name)!.next:!this.commits.has(b.commit.sha)));
  if(!candidates.length)return;
  const start=this.cursor%candidates.length;
  const batch=Array.from({length:Math.min(3,candidates.length)},(_,i)=>candidates[(start+i)%candidates.length]);
  this.cursor=start+batch.length;
  for(const b of batch)await this.fetchPage(b.name,signal);
 }
 open=async(value:string,token=this.token)=>{
  let repo:string;
  try{repo=parseRepo(value);}catch(e){this.publish({error:(e as Error).message});return;}
  this.clear();this.token=token;this.refsNext=true;this.publish({repo});
  await this.run(async signal=>{
   const {data:meta}=await github<Meta>(`/repos/${repo}`,this.token,signal);
   this.current(signal);this.publish({meta,base:meta.default_branch});
   await this.fetchRefs(signal);
   // main/master can lie beyond the first page of alphabetically listed refs.
   for(const name of new Set(['main','master',meta.default_branch])){
    if(this.snapshot.branches.some(b=>b.name===name))continue;
    if(this.refsNext){const ref=await branchByName(repo,name,this.token,signal);this.current(signal);this.checkedRefs.set(name,ref);if(ref)this.addRefs([ref]);}
   }
   const base=preferredBranch(this.snapshot.branches,meta.default_branch);this.publish({base});
   await this.fetchPage(base,signal);
   await this.others(signal);
  });
 };
 chooseBase=async(name:string)=>{
  if(name===this.snapshot.base)return;
  this.controller?.abort();this.retrySources=undefined;this.retryContext=false;this.publish({base:name});
  await this.run(async signal=>{if(!this.pages.has(name))await this.fetchPage(name,signal);});
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
  }catch(e){if(!controller.signal.aborted)this.publish({ranking:{...this.snapshot.ranking,error:e instanceof GitHubError&&e.status===403&&!e.retryAt?'Needs Pull requests: Read-only.':(e as Error).message,retryAt:e instanceof GitHubError?e.retryAt||null:null}});}
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
 private async batch(signal:AbortSignal) {
  if(this.refsNext)await this.fetchRefs(signal);
  if(this.snapshot.base)await this.fetchPage(this.snapshot.base,signal);
  await this.others(signal);
 }
 loadBranches=async()=>{
  if(this.snapshot.busy||!this.snapshot.meta||!this.refsNext)return;
  this.retrySources=undefined;await this.run(signal=>this.fetchRefs(signal));
 };
 private async continuation(signal:AbortSignal,sources?:string[]){
  if(!sources?.length){await this.batch(signal);return;}
  for(const name of [...new Set(sources)].slice(0,4))if(this.pages.get(name)?.next)await this.fetchPage(name,signal);
 }
 private async discover(signal:AbortSignal){
  if(this.refsNext)await this.fetchRefs(signal);
  const unseen=this.snapshot.branches.filter(b=>!this.pages.has(b.name)&&!this.commits.has(b.commit.sha));
  for(const ref of unseen.slice(0,3))await this.fetchPage(ref.name,signal);
 }
 loadContext=async()=>{
  if(this.snapshot.busy||this.snapshot.error||!this.snapshot.meta||!this.snapshot.hasUnloadedBranches)return;
  this.retrySources=undefined;this.retryContext=true;
  await this.run(signal=>this.discover(signal));
  if(!this.snapshot.error)this.retryContext=false;
 };
 loadMore=async(sources?:string[])=>{
  if(this.snapshot.busy||this.snapshot.error||!this.snapshot.meta||!this.snapshot.more)return;
  this.retryContext=false;this.retrySources=sources;
  await this.run(signal=>this.continuation(signal,sources));
  if(!this.snapshot.error)this.retrySources=undefined;
 };
 retry=async()=>{
  if(this.snapshot.busy||(this.snapshot.retryAt||0)>Date.now())return;
  if(!this.snapshot.meta){await this.open(this.snapshot.repo);return;}
  const sources=this.retrySources;
  await this.run(signal=>this.retryContext?this.discover(signal):this.continuation(signal,sources));
  if(!this.snapshot.error){this.retrySources=undefined;this.retryContext=false;}
 };
}
