import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthMarkers} from './monthMarkers';
import type {Commit} from './model';
const c=(sha:string,date?:string,parent?:string,authorDate?:string):Commit=>({sha,parents:parent?[{sha:parent}]:[],commit:{message:sha,author:authorDate?{name:'Test',date:authorDate}:null,committer:date?{date}:null},html_url:''});

test('month and year markers use the same month-start commits in both directions',()=>{
 const commits=[c('jan31','2026-01-31','jan1'),c('jan1','2026-01-01','dec31'),c('dec31','2025-12-31','dec2'),c('dec2','2025-12-02','nov30'),c('nov30','2025-11-30')];
 const spine=new Set(commits.map(commit=>commit.sha));
 const newest=monthMarkers(commits,spine),oldest=monthMarkers([...commits].reverse(),spine);
 assert.deepEqual(newest,[{sha:'jan1',label:'2026.01'},{sha:'dec2',label:'2025.12'},{sha:'nov30',label:'2025.11'}]);
 assert.deepEqual(oldest,[...newest].reverse());
 assert.deepEqual(commits.map(commit=>commit.sha),['jan31','jan1','dec31','dec2','nov30']);
});

test('a partial month never labels its latest or partially loaded oldest commit as the month start',()=>{
 const first=[c('late','2026-10-31','middle'),c('middle','2026-10-20','early')];
 const all=[...first,c('early','2026-10-01','september'),c('september','2026-09-30','missing')];
 const spine=new Set(all.map(commit=>commit.sha));
 assert.deepEqual(monthMarkers(first,spine),[]);
 assert.deepEqual(monthMarkers(all.slice(0,3),spine),[]);
 assert.deepEqual(monthMarkers(all,spine),[{sha:'early',label:'2026.10'}]);
});

test('the earliest available commit in the month is used when there was no commit on the first',()=>{
 const commits=[c('end','2026-03-31','start'),c('start','2026-03-04','prev'),c('prev','2026-02-28','missing')];
 assert.deepEqual(monthMarkers(commits,new Set(commits.map(commit=>commit.sha))),[{sha:'start',label:'2026.03'}]);
});

test('markers prefer committer time in UTC, fall back to valid author time, and ignore missing dates',()=>{
 const commits=[c('utc','2026-03-01T00:30:00+02:00',undefined,'2020-01-01'),c('invalid','invalid',undefined,'2026-01-01'),c('missing'),c('bad','invalid',undefined,'invalid')];
 assert.deepEqual(monthMarkers(commits,new Set(commits.map(commit=>commit.sha))),[{sha:'utc',label:'2026.02'},{sha:'invalid',label:'2026.01'}]);
});

test('out-of-order timestamps cannot create duplicate monthly labels',()=>{
 const commits=[c('feb','2026-02-28'),c('march','2026-03-01'),c('jan31','2026-01-31'),c('jan1','2026-01-01'),c('dec','2025-12-31')];
 const spine=new Set(commits.map(commit=>commit.sha));
 const actual=monthMarkers(commits,spine);
 assert.equal(actual.filter(marker=>marker.label==='2026.01').length,1);
 assert.equal(actual.find(marker=>marker.label==='2026.01')?.sha,'jan1');
 assert.deepEqual(monthMarkers([...commits].reverse(),spine),[...actual].reverse());
});

test('pagination preserves already confirmed month starts',()=>{
 const first=[c('late','2026-03-31','first'),c('first','2026-03-01','prev'),c('prev','2026-02-28','earlier')];
 const next=[...first,c('earlier','2026-02-01','root'),c('root','2026-01-31')];
 const spine=new Set(next.map(commit=>commit.sha));
 assert.deepEqual(monthMarkers(first,spine),[{sha:'first',label:'2026.03'}]);
 assert.deepEqual(monthMarkers(next,spine),[{sha:'first',label:'2026.03'},{sha:'earlier',label:'2026.02'},{sha:'root',label:'2026.01'}]);
});

test('an old unrelated branch cannot make a partial base month appear complete',()=>{
 const commits=[c('base','2026-10-29','missing'),c('side','2016-01-01')];
 assert.deepEqual(monthMarkers(commits,new Set(['base'])),[]);
});

test('oldest-first windows can mark repository creation before the tip is loaded',()=>{
 const commits=[c('root','2014-09-18'),c('next','2014-10-02','root')];
 assert.deepEqual(monthMarkers(commits,new Set(['unloaded-tip'])),[{sha:'root',label:'2014.09'},{sha:'next',label:'2014.10'}]);
 assert.deepEqual(monthMarkers([],new Set()),[]);
});
