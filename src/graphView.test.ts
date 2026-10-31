import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphFrame,branchDisplayNames,branchLabelText,visibleHistorySources,GRAPH_ORIGIN} from './graphView';

test('history requests use only currently visible boundaries and exclude toolbar, outside lanes and pending work',()=>{
 const positions=new Map([['visible',{x:48,y:1200}],['above',{x:48,y:1099}],['below',{x:48,y:1601}],['left',{x:-1,y:1200}],['right',{x:391,y:1200}]]);
 const frontiers=[{sha:'visible',sources:['same','pending','second','same']},...['above','below','left','right','missing'].map(sha=>({sha,sources:[sha]}))];
 const view={left:0,top:1000,width:390,height:600,inset:100};
 assert.deepEqual(visibleHistorySources(frontiers,positions,view,['pending']),['same','second']);
 assert.deepEqual(visibleHistorySources(frontiers,positions,{...view,width:0}),[]);
 assert.deepEqual(visibleHistorySources(frontiers,positions,{...view,height:50}),[]);
});
test('new offscreen boundaries wait for another scroll even if earlier rows were previously visible',()=>{
 const view={left:0,top:1000,width:390,height:600,inset:100},frontiers=[{sha:'gap',sources:['next-page']}];
 assert.deepEqual(visibleHistorySources(frontiers,new Map([['gap',{x:48,y:1500}]]),view),['next-page']);
 const positions=new Map([['gap',{x:48,y:4600}]]);
 assert.deepEqual(visibleHistorySources(frontiers,positions,view),[]);
 assert.deepEqual(visibleHistorySources(frontiers,positions,{...view,top:4200}),['next-page']);
 assert.deepEqual(visibleHistorySources(frontiers,positions,{...view,top:6000}),[]);
});

test('mobile frames fit every lane inside the left half without imposing a minimum spacing',()=>{
 for(const width of [280,320,390,800])for(const maxLane of [0,1,8,40,500]){
  const frame=graphFrame(width,maxLane,true);
  assert.equal(frame.width,width);assert.ok(frame.branchWidth<=width/2);assert.ok(frame.spacing>0&&frame.spacing<=34);assert.ok(GRAPH_ORIGIN+maxLane*frame.spacing<=frame.branchWidth-18+1e-9);
 }
 assert.ok(graphFrame(320,500,true).spacing<1);
});
test('mobile message columns use at most half the screen, retain readable space and stay clear of branches',()=>{
 for(const width of [280,320,390,430,800])for(const maxLane of [0,1,8,40,500]){
  const frame=graphFrame(width,maxLane,true);
  assert.ok(frame.messageX>frame.branchWidth);
  assert.ok(frame.messageWidth>=width*.4&&frame.messageWidth<=width/2);
  assert.ok(frame.messageX+frame.messageWidth<=width-12);
 }
});
test('sparse mobile and desktop graphs retain their usual spacing',()=>{
 assert.equal(graphFrame(390,3,true).spacing,34);
 assert.equal(graphFrame(1440,2,false).spacing,34);
});
test('desktop branch width grows with its content up to 50 percent and messages stay capped at 50 percent',()=>{
 for(const width of [801,900,1440,2560])for(const maxLane of [0,1,8,40,500]){
  const frame=graphFrame(width,maxLane,false);
  assert.equal(frame.width,width);assert.ok(frame.branchWidth<=width/2);
  assert.ok(frame.spacing>0&&frame.spacing<=34);assert.ok(GRAPH_ORIGIN+maxLane*frame.spacing<=frame.branchWidth-18+1e-9);
  assert.equal(frame.messageX,frame.branchWidth+16);assert.ok(frame.messageWidth<=width/2);assert.ok(frame.messageWidth>0);assert.ok(frame.messageX+frame.messageWidth<=width-16);
 }
 assert.ok(graphFrame(900,500,false).spacing<1);
});
test('sparse desktop graphs leave no half-screen gap and only compress after reaching the width cap',()=>{
 for(const width of [900,1440,2560]){
  const single=graphFrame(width,0,false),few=graphFrame(width,3,false),dense=graphFrame(width,100,false);
  assert.equal(single.messageX,140);assert.ok(single.branchWidth<few.branchWidth);assert.ok(few.branchWidth<width/2);
  assert.equal(few.spacing,34);assert.equal(few.messageWidth,width/2);
  assert.equal(dense.branchWidth,width/2);assert.ok(dense.spacing<34);assert.ok(dense.messageWidth<width/2);
 }
 assert.equal(graphFrame(900,3,false).messageX,graphFrame(2560,3,false).messageX);
});
test('branch display names remove repeated namespaces while keeping colliding suffixes distinct',()=>{
 const names=branchDisplayNames(['main','agents/fix-chat','agents/fix-chat','alice/topic','bob/topic','alice/feature/shared','bob/feature/shared']);
 assert.equal(names.get('main'),'main');assert.equal(names.get('agents/fix-chat'),'fix-chat');
 assert.equal(names.get('alice/topic'),'alice/topic');assert.equal(names.get('bob/topic'),'bob/topic');
 assert.equal(names.get('alice/feature/shared'),'alice/feature/shared');assert.equal(names.get('bob/feature/shared'),'bob/feature/shared');
});
test('long branch labels preserve both ends and shared references use one count',()=>{
 const name='agents/fix-a-very-long-window-bug-4721',display=branchDisplayNames([name,'main','master','dev']);
 const short=branchLabelText([name],display,16);assert.equal(Array.from(short).length,16);assert.ok(short.startsWith('fix-'));assert.ok(short.endsWith('4721'));assert.ok(short.includes('…'));
 assert.equal(branchLabelText(['main','master','dev'],display,16),'main +2');
 const unicode=branchLabelText(['修复窗口滚动时丢失分支显示的问题'],new Map(),10);assert.equal(Array.from(unicode).length,10);assert.ok(!unicode.includes('�'));
});
