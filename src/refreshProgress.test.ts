import {test} from 'node:test';
import assert from 'node:assert/strict';
import {refreshProgress} from './refreshProgress';
import {RefreshLoop,type RefreshClock} from './RefreshLoop';

test('the sweep follows elapsed time for all supported intervals',()=>{
 for(const duration of [30000,60000,300000]){
  const start=1000,next=start+duration;
  for(const fraction of [0,.25,.5,.75,1])assert.deepEqual(refreshProgress(next,duration,start+duration*fraction),{duration,delay:fraction===0?0:-duration*fraction,offset:100*(1-fraction)});
 }
});

test('future starts and overdue deadlines clamp to empty and full',()=>{
 assert.deepEqual(refreshProgress(90000,60000,0),{duration:60000,delay:0,offset:100});
 assert.deepEqual(refreshProgress(90000,60000,120000),{duration:60000,delay:-60000,offset:0});
});

test('invalid or unset scheduling data cannot produce invalid CSS timings',()=>{
 for(const interval of [0,-1,NaN,Infinity])assert.deepEqual(refreshProgress(60000,interval,30000),{duration:1,delay:0,offset:100});
 for(const nextAt of [0,-1,NaN,Infinity])assert.deepEqual(refreshProgress(nextAt,60000,30000),{duration:60000,delay:0,offset:100});
 assert.equal(refreshProgress(60000,60000,NaN).offset,100);
});

test('manual completion and interval changes reset the sweep using actual loop deadlines',async()=>{
 let now=1000;const clock:RefreshClock={now:()=>now,set:()=>0,clear:()=>{}};
 const loop=new RefreshLoop(async()=>({}),()=>true,clock);loop.configure('repo',true,60000);loop.loaded();
 now+=15000;assert.equal(refreshProgress(loop.getSnapshot().nextAt,60000,now).offset,75);
 await loop.refresh();assert.equal(refreshProgress(loop.getSnapshot().nextAt,60000,now).offset,100);
 loop.configure('repo',true,300000);assert.deepEqual(refreshProgress(loop.getSnapshot().nextAt,300000,now),{duration:300000,delay:0,offset:100});
 now+=30000;assert.equal(refreshProgress(loop.getSnapshot().nextAt,300000,now).offset,90);
 loop.stop();
});
