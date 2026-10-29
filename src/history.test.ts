import {test} from 'node:test';
import assert from 'node:assert/strict';
import {History} from './history';
const commit=(sha:string,parent?:string)=>({sha,parents:parent?[{sha:parent}]:[],commit:{message:sha,author:null,committer:null},html_url:`https://github.com/a/b/commit/${sha}`});
const response=(data:unknown,next=false)=>new Response(JSON.stringify(data),{headers:next?{Link:'<https://api.github.com/next>; rel="next"'}:{}});

test('history stops redundant pagination once other branches have supplied every missing ancestor',async()=>{
 const original=globalThis.fetch;const requests:string[]=[];
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));requests.push(url.pathname+url.search);
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([]);
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}},{name:'feature',commit:{sha:'f'}}]);
   if(url.pathname.endsWith('/commits')){
    if(url.searchParams.get('sha')==='feature')return response([commit('f','root'),commit('root')]);
    return url.searchParams.get('page')==='1'?response([commit('m','root')],true):response([commit('root')]);
   }
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');
  assert.equal(h.getSnapshot().base,'main');assert.equal(h.getSnapshot().loadedBranches,2);
  assert.deepEqual(h.getSnapshot().commits.map(c=>c.sha),['m','f','root']);
  assert.equal(h.getSnapshot().more,false);
  await Promise.all([h.loadMore(),h.loadMore(),h.loadMore()]);
  assert.equal(requests.filter(p=>p.includes('sha=main')&&p.includes('page=2')).length,0);
  assert.equal(h.getSnapshot().more,false);
  const count=requests.length;await h.loadMore();assert.equal(requests.length,count);
  await h.chooseBase('feature');assert.equal(h.getSnapshot().base,'feature');assert.equal(requests.length,count);
 }finally{globalThis.fetch=original;}
});
test('branch references paginate automatically after loaded histories end',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([]);
   if(url.pathname.endsWith('/branches'))return url.searchParams.get('page')==='1'?response([{name:'main',commit:{sha:'m'}}],true):response([{name:'other',commit:{sha:'o'}}]);
   if(url.pathname.endsWith('/commits'))return response([commit(url.searchParams.get('sha')==='main'?'m':'o')]);
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(h.getSnapshot().more,true);
  await h.loadMore();assert.equal(h.getSnapshot().loadedBranches,2);assert.equal(h.getSnapshot().more,false);
  assert.deepEqual(h.getSnapshot().commits.map(c=>c.sha),['m','o']);
 }finally{globalThis.fetch=original;}
});
test('request errors pause automatic loading and explicit retry resumes the same page',async()=>{
 const original=globalThis.fetch;let fail=true;let secondPages=0;
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([]);
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}}]);
   if(url.pathname.endsWith('/commits')){
    if(url.searchParams.get('page')==='1')return response([commit('m','root')],true);
    secondPages++;if(fail)return new Response('',{status:429,headers:{'Retry-After':'0'}});return response([commit('root')]);
   }
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');await h.loadMore();
  assert.match(h.getSnapshot().error,/rate limit/);await h.loadMore();assert.equal(secondPages,1);
  fail=false;await h.retry();assert.equal(secondPages,2);assert.equal(h.getSnapshot().error,'');assert.equal(h.getSnapshot().more,false);
 }finally{globalThis.fetch=original;}
});
test('clearing history cancels in-flight results and cannot restore private history',async()=>{
 const original=globalThis.fetch;let release!:(response:Response)=>void;
 try{
  globalThis.fetch=async()=>new Promise<Response>(resolve=>{release=resolve;});
  const h=new History();const opening=h.open('private/repo','test-only-token');
  h.clear();release(response({default_branch:'main'}));await opening;
  assert.equal(h.getSnapshot().repo,'');assert.equal(h.getSnapshot().busy,false);assert.deepEqual(h.getSnapshot().commits,[]);assert.equal(h.getSnapshot().meta,null);
 }finally{globalThis.fetch=original;}
});

test('more branch names can be requested without exhausting a long base history',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([]);
   if(url.pathname.endsWith('/branches'))return url.searchParams.get('page')==='1'?response([{name:'main',commit:{sha:'m'}}],true):response([{name:'hidden',commit:{sha:'h'}}]);
   if(url.pathname.endsWith('/commits'))return response([commit(url.searchParams.get('sha')==='main'?'m':'h')],true);
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(h.getSnapshot().moreBranches,true);
  await h.loadBranches();assert.equal(h.getSnapshot().moreBranches,false);
  assert.equal(h.getSnapshot().loadedBranches,1);
  await h.chooseBase('hidden');assert.equal(h.getSnapshot().base,'hidden');assert.equal(h.getSnapshot().loadedBranches,2);
 }finally{globalThis.fetch=original;}
});

test('main is selected even outside the first refs page and PR ranking is deferred',async()=>{
 const original=globalThis.fetch;const requests:string[]=[];
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));requests.push(url.pathname);
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([]);
   if(url.pathname.endsWith('/branches/main'))return response({name:'main',commit:{sha:'m'}});
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/branches'))return response([{name:'develop',commit:{sha:'d'}}],true);
   if(url.pathname.endsWith('/commits'))return response([commit(url.searchParams.get('sha')==='main'?'m':'d')]);
   return response({default_branch:'develop',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(h.getSnapshot().base,'main');assert.ok(!requests.some(p=>p.endsWith('/pulls')));
  await h.loadRecommendations();assert.equal(h.getSnapshot().ranking.complete,true);assert.equal(requests.filter(p=>p.endsWith('/pulls')).length,1);
 }finally{globalThis.fetch=original;}
});
test('PR ranking filters deleted refs, retains counts, and exact lookup can select a branch outside recommendations',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls'))return response([{id:1,merged_at:new Date().toISOString(),updated_at:new Date().toISOString(),base:{ref:'deleted'}}]);
   if(url.pathname.endsWith('/branches/hidden%2Fwork'))return response({name:'hidden/work',commit:{sha:'h'}});
   if(url.pathname.endsWith('/branches'))return response([{name:'master',commit:{sha:'m'}}]);
   if(url.pathname.endsWith('/commits'))return response([commit(url.searchParams.get('sha')==='master'?'m':'h')]);
   return response({default_branch:'master',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(h.getSnapshot().base,'master');await h.loadRecommendations();
  assert.equal(h.getSnapshot().ranking.counts.deleted,1);assert.equal(h.getSnapshot().ranking.complete,true);assert.ok(!h.getSnapshot().branches.some(b=>b.name==='deleted'));
  assert.equal(await h.findBranch('hidden/work'),true);assert.equal(h.getSnapshot().base,'hidden/work');
 }finally{globalThis.fetch=original;}
});
test('rate reset blocks premature retry and permits it after the deadline',async()=>{
 const original=globalThis.fetch,originalNow=Date.now;let clock=originalNow(),calls=0,fail=true;
 try{
  Date.now=()=>clock;
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}}]);
   if(url.pathname.endsWith('/commits')){
    if(url.searchParams.get('page')==='1')return response([commit('m','root')],true);
    calls++;return fail?new Response('{}',{status:429,headers:{'Retry-After':'2'}}):response([]);
   }
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');await h.loadMore();assert.equal(calls,1);
  await h.retry();assert.equal(calls,1);
  clock+=2100;fail=false;await h.retry();assert.equal(calls,2);assert.equal(h.getSnapshot().error,'');
 }finally{globalThis.fetch=original;Date.now=originalNow;}
});

test('PR counting stays bounded and marks partial counts until the 90-day scan ends',async()=>{
 const original=globalThis.fetch;let pulls=0;
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));
   if(url.pathname.endsWith('/branches/master'))return new Response('',{status:404});
   if(url.pathname.endsWith('/pulls')){
    pulls++;const old=pulls===4,date=old?'2020-01-01T00:00:00Z':new Date().toISOString();
    return response([{id:pulls,merged_at:date,updated_at:date,base:{ref:'release'}}],true);
   }
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}},{name:'release',commit:{sha:'r'}}]);
   if(url.pathname.endsWith('/commits'))return response([commit(url.searchParams.get('sha')==='main'?'m':'r')]);
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(pulls,0);
  await h.loadRecommendations();assert.equal(pulls,3);assert.equal(h.getSnapshot().ranking.complete,false);assert.equal(h.getSnapshot().ranking.counts.release,3);
  await h.loadRecommendations();assert.equal(pulls,4);assert.equal(h.getSnapshot().ranking.complete,true);assert.equal(h.getSnapshot().ranking.counts.release,3);
  assert.equal(h.getSnapshot().error,'');assert.equal(h.getSnapshot().commits.length,2);
 }finally{globalThis.fetch=original;}
});

test('a short unfinished visible branch can paginate without waiting for or requesting the longest branch',async()=>{
 const original=globalThis.fetch;const requests:string[]=[];
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));requests.push(url.pathname+url.search);
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}},{name:'feature',commit:{sha:'f'}}]);
   if(url.pathname.endsWith('/commits')){
    if(url.searchParams.get('sha')==='main')return response([commit('m','base')],true);
    return url.searchParams.get('page')==='1'?response([commit('f','missing')],true):response([commit('missing')]);
   }
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');
  assert.deepEqual(h.getSnapshot().frontiers.find(f=>f.sha==='f')?.sources,['feature']);
  await Promise.all([h.loadMore(['feature']),h.loadMore(['feature'])]);
  assert.equal(requests.filter(r=>r.includes('sha=feature')&&r.includes('page=2')).length,1);
  assert.equal(requests.filter(r=>r.includes('sha=main')&&r.includes('page=2')).length,0);
  assert.ok(!h.getSnapshot().frontiers.some(f=>f.sha==='f'));
  assert.equal(h.getSnapshot().more,true);
 }finally{globalThis.fetch=original;}
});

test('retry after a short-branch page error stays on that branch instead of fetching the base',async()=>{
 const original=globalThis.fetch;let fail=true;const requests:string[]=[];
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));requests.push(url.search);
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}},{name:'feature',commit:{sha:'f'}}]);
   if(url.pathname.endsWith('/commits')){
    if(url.searchParams.get('sha')==='main')return response([commit('m','base')],true);
    if(url.searchParams.get('page')==='1')return response([commit('f','missing')],true);
    return fail?new Response('',{status:500}):response([commit('missing')]);
   }
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');await h.loadMore(['feature']);assert.ok(h.getSnapshot().error);
  fail=false;await h.retry();assert.equal(h.getSnapshot().error,'');
  assert.equal(requests.filter(r=>r.includes('sha=main')&&r.includes('page=2')).length,0);
  assert.equal(requests.filter(r=>r.includes('sha=feature')&&r.includes('page=2')).length,2);
 }finally{globalThis.fetch=original;}
});

test('discovering more branches skips continuations whose loaded ancestry already joins known history',async()=>{
 const original=globalThis.fetch;const requests:string[]=[];
 try{
  globalThis.fetch=async input=>{
   const url=new URL(String(input));requests.push(url.pathname+url.search);
   if(url.pathname.endsWith('/branches'))return response([{name:'main',commit:{sha:'m'}},{name:'feature',commit:{sha:'f'}}]);
   if(url.pathname.endsWith('/commits'))return url.searchParams.get('sha')==='main'?response([commit('m','root'),commit('root')]):response([commit('f','root')],true);
   return response({default_branch:'main',stargazers_count:0});
  };
  const h=new History();await h.open('a/b');assert.equal(h.getSnapshot().more,false);await h.loadContext();
  assert.equal(requests.filter(r=>r.includes('sha=feature')&&r.includes('page=2')).length,0);
 }finally{globalThis.fetch=original;}
});
