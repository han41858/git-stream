import{test}from'node:test';import assert from'node:assert/strict';import{github,commitsPage,branchesPage}from'./api';
test('pagination uses 100 commits and encoded branch; token only sent to GitHub',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async(input,init)=>{assert.equal(input,'https://api.github.com/repos/a/b/commits?sha=feat%2Ftest&per_page=100&page=2');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-token');return new Response('[]',{headers:{Link:'<https://api.github.com/x?page=3>; rel="next"'}});};assert.equal((await commitsPage('a/b','feat/test',2,'test-token')).next,true);}finally{globalThis.fetch=original;}});
test('branch pagination and unauthenticated request',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async(input,init)=>{assert.equal(input,'https://api.github.com/repos/a/b/branches?per_page=100&page=2');assert.equal((init?.headers as Record<string,string>).Authorization,undefined);return new Response('[]');};assert.equal((await branchesPage('a/b',2,'')).next,false);}finally{globalThis.fetch=original;}});
test('API errors are safe, distinct and retryable',async()=>{const original=globalThis.fetch;try{for(const status of [401,403,404,409,429,500]){globalThis.fetch=async()=>new Response('sensitive response',{status});await assert.rejects(github('/repos/a/b','secret'),e=>e instanceof Error&&!e.message.includes('sensitive')&&!e.message.includes('secret'));}globalThis.fetch=async()=>new Response('[]');assert.deepEqual((await github('/repos/a/b','')).data,[]);}finally{globalThis.fetch=original;}});
test('network and cancellation errors',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>{throw new TypeError('network')};await assert.rejects(github('/repos/a/b',''),/Could not reach/);const controller=new AbortController();controller.abort();await assert.rejects(github('/repos/a/b','',controller.signal));}finally{globalThis.fetch=original;}});

test('primary and secondary rate limits include a retry deadline; permission errors stay distinct',async()=>{
 const original=globalThis.fetch;
 try{
  const reset=Math.ceil(Date.now()/1000)+1800;
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'sensitive rate limit exceeded'}),{status:403,headers:{'X-RateLimit-Remaining':'0','X-RateLimit-Reset':String(reset)}});
  await assert.rejects(github('/repos/a/b',''),(e:any)=>e.retryAt===reset*1000&&e.message.includes('rate limit')&&!e.message.includes('sensitive')&&e.message.includes('access token'));
  const before=Date.now();
  globalThis.fetch=async()=>new Response('{}',{status:429,headers:{'Retry-After':'120'}});
  await assert.rejects(github('/repos/a/b','test-token'),(e:any)=>e.retryAt>=before+120000&&e.message.includes('rate limit')&&!e.message.includes('test-token'));
  globalThis.fetch=async()=>new Response(JSON.stringify({message:'Resource not accessible by personal access token'}),{status:403});
  await assert.rejects(github('/repos/a/b','test-token'),(e:any)=>!e.retryAt&&e.message.includes('denied access')&&!e.message.includes('rate limit'));
 }finally{globalThis.fetch=original;}
});
