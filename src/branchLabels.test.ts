import {test} from 'node:test';
import assert from 'node:assert/strict';
import {branchTracks,visibleBranchLabels,type BranchTrack} from './branchLabels';
import type {Commit} from './model';
const commit=(sha:string,parent?:string):Commit=>({sha,parents:parent?[{sha:parent}]:[],commit:{message:sha,author:null,committer:null},html_url:''});
test('branch labels follow visible paths after heads leave the viewport and disappear after the path ends',()=>{
 const tracks:BranchTrack[]=[{name:'main',lane:0,points:[{x:48,y:100},{x:48,y:500},{x:48,y:1000}]}];
 assert.equal(visibleBranchLabels(tracks,250,600)[0].names[0],'main');assert.equal(visibleBranchLabels(tracks,250,600)[0].y,250);
 assert.deepEqual(visibleBranchLabels(tracks,1100,1500),[]);assert.deepEqual(visibleBranchLabels(tracks,-500,0),[]);
});
test('a side branch ends at its first-parent join with the base instead of naming the shared trunk',()=>{
 const commits=[commit('m','root'),commit('f','join'),commit('join','root'),commit('root')];
 const positions=new Map([['m',{x:48,y:100}],['f',{x:82,y:150}],['join',{x:82,y:300}],['root',{x:48,y:500}]]);
 const tracks=branchTracks(commits,[{name:'main',commit:{sha:'m'}},{name:'feature',commit:{sha:'f'}}],'main',new Set(['m','root']),positions,false);
 assert.deepEqual(tracks.find(t=>t.name==='feature')!.points.map(p=>p.y),[150,300,500]);
 assert.ok(visibleBranchLabels(tracks,200,400).some(l=>l.names.includes('feature')));
 assert.ok(!visibleBranchLabels(tracks,501,800).some(l=>l.names.includes('feature')));
});
test('reversed tracks and curved joins place labels beside the actual visible line',()=>{
 const track:BranchTrack={name:'feature',lane:1,points:[{x:82,y:500},{x:48,y:100}]};
 const label=visibleBranchLabels([track],200,300)[0];assert.ok(label.x>48&&label.x<82);assert.ok(label.y>=200&&label.y<=300);
 assert.deepEqual(visibleBranchLabels([track],501,800),[]);
});
test('unloaded heads have no labels and references at the same point share one badge',()=>{
 const tracks=branchTracks([commit('root')],[{name:'main',commit:{sha:'root'}},{name:'release',commit:{sha:'root'}},{name:'unloaded',commit:{sha:'missing'}}],'main',new Set(['root']),new Map([['root',{x:48,y:200}]]),false);
 const labels=visibleBranchLabels(tracks,100,300);assert.equal(labels.length,1);assert.deepEqual(labels[0].names,['main','release']);
});

test('a branch outside the horizontal viewport does not leave a stray name behind',()=>{
 const tracks:BranchTrack[]=[{name:'main',lane:0,points:[{x:48,y:100},{x:48,y:900}]}];
 assert.equal(visibleBranchLabels(tracks,200,600,0,390).length,1);
 assert.equal(visibleBranchLabels(tracks,200,600,100,490).length,0);
});

test('labels use a visible curve segment even when their former preferred anchor is horizontally outside',()=>{
 const track:BranchTrack={name:'crossing',lane:0,points:[{x:0,y:0},{x:500,y:1000}]};
 const labels=visibleBranchLabels([track],100,900,200,300);
 assert.equal(labels.length,1);assert.ok(labels[0].x>=200&&labels[0].x<=300);assert.ok(labels[0].y>=100&&labels[0].y<=900);
});
test('merge connectors remain labeled when the branch head is below the viewport',()=>{
 const track:BranchTrack={name:'feature',lane:1,points:[{x:82,y:700},{x:48,y:1000}],connections:[[{x:48,y:0},{x:82,y:700}]]};
 const labels=visibleBranchLabels([track],100,300,0,390);assert.equal(labels.length,1);assert.equal(labels[0].names[0],'feature');
});
test('a reference on the base keeps its name on visible shared history after its head scrolls out',()=>{
 const commits=[commit('dev','main'),commit('main','root'),commit('root')];
 const positions=new Map([['dev',{x:48,y:100}],['main',{x:48,y:300}],['root',{x:48,y:900}]]);
 const tracks=branchTracks(commits,[{name:'dev',commit:{sha:'dev'}},{name:'main',commit:{sha:'main'}}],'dev',new Set(['dev','main','root']),positions,false);
 const names=visibleBranchLabels(tracks,500,700).flatMap(l=>l.names);assert.ok(names.includes('main'));assert.ok(names.includes('dev'));
});

test('nearby merge and trunk badges move along their paths to stay readable',()=>{
 const tracks:BranchTrack[]=[{name:'main',lane:0,points:[{x:48,y:136},{x:48,y:1000}]},{name:'feature',lane:1,points:[{x:82,y:700},{x:48,y:1000}],connections:[[{x:48,y:136},{x:82,y:700}]]}];
 const labels=visibleBranchLabels(tracks,115,600,0,390,()=>80);
 assert.equal(labels.length,2);assert.ok(Math.abs(labels[0].boxY!-labels[1].boxY!)>=24);
});
