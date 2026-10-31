import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MonitorSession} from './MonitorSession';
import {History} from './history';
import {CommitInfoStore} from './CommitInfoStore';
import {RefreshLoop,type RefreshClock} from './RefreshLoop';

const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function until(check:()=>boolean){for(let n=0;n<100;n++){if(check())return;await tick();}assert.ok(check(),'operation did not settle');}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const response=(data:unknown,status=200,headers:Record<string,string>={})=>new Response(status===304?null:JSON.stringify(data),{status,headers});
async function using(check:(context:{group:MonitorSession;history:History;info:CommitInfoStore;paths:string[];visits:string[];holds:Map<string,ReturnType<typeof deferred<Response>>>;failures:Map<string,number>;aborted:string[];conditional:string[]})=>Promise<void>){
 const original=globalThis.fetch,paths:string[]=[],visits:string[]=[],aborted:string[]=[],conditional:string[]=[],holds=new Map<string,ReturnType<typeof deferred<Response>>>(),failures=new Map<string,number>();
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input)),path=url.pathname;paths.push(path);init?.signal?.addEventListener('abort',()=>aborted.push(path),{once:true});
  const hold=holds.get(path);if(hold)return hold.promise;
  const failure=failures.get(path);if(failure)return response({},failure,failure===429?{'Retry-After':'60'}:{});
  if((init?.headers as Record<string,string>)?.['If-None-Match']){conditional.push(path);return response(null,304);}
  if(path.endsWith('/branches'))return response([{name:'main',commit:{sha:'head'}}],200,{ETag:'"stable"'});
  if(path.endsWith('/commits'))return response([{sha:'head',parents:[],commit:{message:'fixture',author:{name:'Test',date:'2026-11-01T00:00:00Z'},committer:null},html_url:''}]);
  if(path.endsWith('/actions/runs'))return response({workflow_runs:[]},200,{ETag:'"stable"'});
  if(['/tags','/releases','/activity'].some(suffix=>path.endsWith(suffix)))return response([],200,{ETag:'"stable"'});
  return response({default_branch:'main',private:false},200,{ETag:'"stable"'});
 };
 const metadata=(repo:string,_private:boolean,visit:boolean)=>{if(visit)visits.push(repo);},history=new History(metadata),info=new CommitInfoStore(),group=new MonitorSession(history,info,metadata);
 try{await check({group,history,info,paths,visits,holds,failures,aborted,conditional});}
 finally{group.stop();history.cancel();info.cancel();for(const hold of holds.values())hold.resolve(response({default_branch:'main',private:false}));await tick();globalThis.fetch=original;}
}
test('one to four independent models reuse the already opened primary repository without another initial request',async()=>{
 await using(async({group,history,info,paths,visits})=>{
  await history.open('a/one');await info.open('a/one','');const before=paths.filter(path=>path==='/repos/a/one').length;
  group.start(['a/one','b/two','b/two','c/three','d/four','e/five'],'');await until(()=>group.getSnapshot().running.size===0);
  assert.deepEqual(group.getSnapshot().entries.map(entry=>entry.repository),['a/one','b/two','c/three','d/four']);
  assert.equal(group.getSnapshot().entries[0].history,history);assert.equal(paths.filter(path=>path==='/repos/a/one').length,before);
  assert.deepEqual(visits,['a/one','b/two','c/three','d/four']);
  assert.equal(new Set(group.getSnapshot().entries.map(entry=>entry.history)).size,4);
 });
});
test('a slow repository does not delay dispatch completion or the next refresh of faster repositories',async()=>{
 await using(async({group,paths,holds})=>{
  group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  const slow=deferred<Response>();holds.set('/repos/b/two',slow);
  await group.refreshAll('auto');await until(()=>paths.filter(path=>path==='/repos/a/one').length===2&&group.getSnapshot().running.size===1);
  await group.refreshAll('auto');await until(()=>paths.filter(path=>path==='/repos/a/one').length===3&&group.getSnapshot().running.size===1);
  assert.equal(paths.filter(path=>path==='/repos/b/two').length,2);
  slow.resolve(response({default_branch:'main',private:false}));await until(()=>!group.getSnapshot().running.size);
 });
});
test('the shared RefreshLoop keeps one timer even when one repository remains in flight',async()=>{
 await using(async({group,paths,holds})=>{
  group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  holds.set('/repos/b/two',deferred<Response>());let now=1000,id=0;const timers=new Map<number,()=>void>();
  const clock:RefreshClock={now:()=>now,set:fn=>{timers.set(++id,fn);return id;},clear:key=>{timers.delete(key as number);}};
  const loop=new RefreshLoop(group.refreshAll,()=>true,clock);loop.configure('monitor',true,60000);loop.loaded();
  for(let n=0;n<2;n++){assert.equal(timers.size,1);const callback=[...timers.values()][0];timers.clear();now+=60000;callback();await until(()=>paths.filter(path=>path==='/repos/a/one').length===n+2&&group.getSnapshot().running.size===1);}
  assert.equal(paths.filter(path=>path==='/repos/b/two').length,2);loop.stop();assert.equal(timers.size,0);
 });
});
test('failures stay isolated and failed metadata is retried on the common schedule',async()=>{
 await using(async({group,failures,paths})=>{
  failures.set('/repos/b/two',404);group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  assert.equal(group.getSnapshot().entries[0].history.getSnapshot().commits.length,1);assert.ok(group.getSnapshot().entries[1].history.getSnapshot().error);
  failures.clear();await group.refreshAll('auto');await until(()=>!group.getSnapshot().running.size);
  assert.equal(group.getSnapshot().entries[1].history.getSnapshot().commits.length,1);assert.equal(paths.filter(path=>path==='/repos/b/two').length,2);
 });
});
test('one repository rate limit pauses all repositories until the shared deadline',async()=>{
 await using(async({group,failures,paths})=>{
  failures.set('/repos/b/two',429);group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  assert.equal(group.canRequest(),false);const before=paths.length,result=await group.refreshAll('auto');
  assert.ok(result.retryAt!>Date.now());assert.equal(paths.length,before);
  const now=Date.now;try{const next=result.retryAt!+1;Date.now=()=>next;failures.clear();await group.refreshAll('auto');await until(()=>!group.getSnapshot().running.size);assert.equal(group.canRequest(),true);assert.ok(paths.length>before);}finally{Date.now=now;}
 });
});
test('a rate limit is shared immediately even if the same repository metadata refresh is still slow',async()=>{
 await using(async({group,history,info,holds,failures})=>{
  await history.open('a/one');await info.open('a/one','');group.start(['a/one'],'');
  holds.set('/repos/a/one/tags',deferred<Response>());failures.set('/repos/a/one',429);
  await group.refreshAll('auto');await until(()=>!group.canRequest());assert.equal(group.getSnapshot().running.size,1);
 });
});
test('conditional caches remain repository-local and unchanged refreshes keep commit array identity',async()=>{
 await using(async({group,conditional})=>{
  group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  const commits=group.getSnapshot().entries.map(entry=>entry.history.getSnapshot().commits);
  for(let i=0;i<2;i++){await group.refreshAll('auto');await until(()=>!group.getSnapshot().running.size);}
  group.getSnapshot().entries.forEach((entry,index)=>assert.equal(entry.history.getSnapshot().commits,commits[index]));
  assert.ok(conditional.includes('/repos/a/one'));assert.ok(conditional.includes('/repos/b/two'));
 });
});
test('exit cancels monitor-owned requests and late metadata cannot record a visit or load more metadata',async()=>{
 await using(async({group,holds,paths,visits,aborted})=>{
  const slow=deferred<Response>();holds.set('/repos/b/two',slow);group.start(['b/two'],'');await until(()=>paths.includes('/repos/b/two'));
  group.stop();const before=paths.length;slow.resolve(response({default_branch:'main',private:false}));await tick();await tick();
  assert.equal(group.getSnapshot().active,false);assert.equal(group.getSnapshot().running.size,0);assert.deepEqual(visits,[]);assert.equal(paths.length,before);assert.ok(aborted.includes('/repos/b/two'));
 });
});
test('exiting preserves the primary model and changing PAT releases the old shared backoff',async()=>{
 await using(async({group,history,info,failures})=>{
  await history.open('a/one');await info.open('a/one','');const snapshot=history.getSnapshot();
  failures.set('/repos/b/two',429);group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  group.stop();assert.equal(history.getSnapshot(),snapshot);assert.equal(group.canRequest(),false);
  group.authenticationChanged('old','new');assert.equal(group.canRequest(),true);
 });
});
test('a late rate error from a cancelled metadata refresh cannot throttle a new authentication context',async()=>{
 await using(async({group,history,info,holds,paths})=>{
  await history.open('a/one');await info.open('a/one','');group.start(['a/one','b/two'],'');await until(()=>!group.getSnapshot().running.size);
  const slow=deferred<Response>();holds.set('/repos/b/two/tags',slow);await group.refreshAll('auto');await until(()=>paths.filter(path=>path==='/repos/b/two/tags').length===2);
  group.authenticationChanged('old','new');slow.resolve(response({},429,{'Retry-After':'60'}));await tick();await tick();
  assert.equal(group.canRequest(),true);assert.equal(group.getSnapshot().retryAt,0);
 });
});
