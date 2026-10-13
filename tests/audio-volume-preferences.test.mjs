import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProfile,saveProfile,audioVolumePreferences,recordRunResult,excludeRunResult} from '../game/core/save.js';

const PROFILE='bastions.profile.v1',SCORES='bastions.scores.v1';
const defaults={music:80,sounds:40};
const memory=()=>{const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};};
function withStorage(storage,callback){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true,writable:true});
  try{return callback();}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
}

test('legacy and fresh profiles gain initial 80/40 audio preferences while preserving history, mute and unrelated preferences',()=>{
  withStorage(memory(),()=>{const first=loadProfile();assert.deepEqual(first.audioVolumes,defaults);assert.equal(first.muted,false);assert.equal(saveProfile(first),true);assert.deepEqual(loadProfile().audioVolumes,defaults);});
  const storage=memory(),history=[{id:'historic-run',version:'0.3.27',mode:10,score:1200,wavesSurvived:6,outcome:'abandoned',finishedAt:12}],bestScores=[{version:'0.3.27',mode:10,score:1200}];
  storage.setItem(PROFILE,JSON.stringify({muted:true,discoveries:['worldfire'],wins:2,bestWave:6,bestScore:1200,bestScores,runHistory:history,tutorial:false,tutorialDecision:'skipped',futurePreference:{retain:'yes'}}));
  withStorage(storage,()=>{
    const first=loadProfile();assert.deepEqual(first.audioVolumes,defaults);assert.equal(first.muted,true);assert.deepEqual(first.runHistory,history);assert.deepEqual(first.bestScores,bestScores);assert.deepEqual(first.futurePreference,{retain:'yes'});
    assert.equal(saveProfile(first),true);const second=loadProfile();assert.deepEqual(second.audioVolumes,defaults);assert.equal(second.bestScore,1200);assert.equal(second.bestWave,6);assert.equal(second.wins,2);assert.deepEqual(second.discoveries,['worldfire']);assert.equal(second.tutorial,false);assert.equal(second.tutorialDecision,'skipped');assert.deepEqual(second.runHistory,history);
    assert.deepEqual(JSON.parse(storage.getItem(PROFILE)).audioVolumes,defaults);assert.deepEqual(JSON.parse(storage.getItem(SCORES)).runHistory,history);
  });
});

test('both zero percentages survive save and repeated visits independently of global mute and later category changes',()=>{
  const storage=memory();withStorage(storage,()=>{
    const first=loadProfile();first.audioVolumes={music:0,sounds:0};first.muted=true;assert.equal(saveProfile(first),true);
    for(let visit=0;visit<3;visit++){const next=loadProfile();assert.deepEqual(next.audioVolumes,{music:0,sounds:0});assert.equal(next.muted,true);assert.equal(saveProfile(next),true);}
    const later=loadProfile();later.audioVolumes.music=36;later.muted=false;assert.equal(saveProfile(later),true);const final=loadProfile();assert.deepEqual(final.audioVolumes,{music:36,sounds:0});assert.equal(final.muted,false);
    final.audioVolumes.sounds=92;assert.equal(saveProfile(final),true);assert.deepEqual(loadProfile().audioVolumes,{music:36,sounds:92});assert.deepEqual(JSON.parse(storage.getItem(PROFILE)).audioVolumes,{music:36,sounds:92});
  });
});

test('stored finite percentages clamp to range while malformed fields and hostile primitive types use category defaults',()=>{
  const rows=[
    [{music:-8,sounds:420},{music:0,sounds:100}],
    [{music:0,sounds:100},{music:0,sounds:100}],
    [{music:24.5,sounds:67.75},{music:24.5,sounds:67.75}],
    [{music:'0',sounds:'100'},defaults],
    [{music:false,sounds:true},defaults],
    [{music:null,sounds:[]},defaults],
    [{music:{value:12},sounds:[30]},defaults],
    [{music:NaN,sounds:Infinity},defaults],
    [{music:-Infinity,sounds:undefined},defaults],
    [{music:0,sounds:'oops'},{music:0,sounds:40}],
    [{music:'oops',sounds:0},{music:80,sounds:0}],
    [null,defaults],['untrusted',defaults],[true,defaults],[0,defaults],[[],defaults]
  ];
  for(const [value,expected]of rows){
    assert.deepEqual(audioVolumePreferences(value),expected);
    const storage=memory();storage.setItem(PROFILE,JSON.stringify({audioVolumes:value,muted:true}));withStorage(storage,()=>{
      const loaded=loadProfile();assert.deepEqual(loaded.audioVolumes,expected);assert.equal(loaded.muted,true);assert.equal(saveProfile(loaded),true);assert.deepEqual(loadProfile().audioVolumes,expected);
    });
  }
});

test('missing, corrupt, blocked and quota-limited storage falls back safely without changing in-memory audio choices',()=>{
  for(const storage of [undefined,{getItem(){throw new Error('read denied');},setItem(){throw new Error('write denied');}}])withStorage(storage,()=>{
    const profile=loadProfile();assert.deepEqual(profile.audioVolumes,defaults);profile.audioVolumes={music:0,sounds:76};assert.equal(saveProfile(profile),false);assert.deepEqual(profile.audioVolumes,{music:0,sounds:76});
  });
  const corrupt=memory();corrupt.setItem(PROFILE,'{broken json');corrupt.setItem(SCORES,'null');withStorage(corrupt,()=>{assert.deepEqual(loadProfile().audioVolumes,defaults);});
  const storage=memory();storage.setItem(PROFILE,JSON.stringify({audioVolumes:{music:18,sounds:43},muted:true}));const blocked={getItem:storage.getItem,setItem(){throw new Error('quota exceeded');}};
  withStorage(blocked,()=>{const profile=loadProfile();profile.audioVolumes={music:89,sounds:0};assert.equal(saveProfile(profile),false);assert.deepEqual(profile.audioVolumes,{music:89,sounds:0});assert.deepEqual(loadProfile().audioVolumes,{music:18,sounds:43});});
});

test('developer exclusion and a stale tab save retain the latest audio percentages and legitimate history',()=>{
  const storage=memory();withStorage(storage,()=>{
    const first=loadProfile();first.audioVolumes={music:10,sounds:20};assert.equal(saveProfile(first),true);const baseline=structuredClone(first);
    const experimental={developerMode:false,waveLimit:10,phase:'reward',round:2,score:999,earnedDiscoveries:new Set()};recordRunResult(first,experimental,{id:'excluded-audio-run',version:'0.3.27'});assert.equal(saveProfile(first),true);const stale=structuredClone(first);
    const latest=loadProfile();latest.audioVolumes={music:0,sounds:78};latest.muted=true;const legitimate={developerMode:false,waveLimit:10,phase:'reward',round:3,score:120,earnedDiscoveries:new Set()};recordRunResult(latest,legitimate,{id:'legitimate-audio-run',version:'0.3.27'});assert.equal(saveProfile(latest),true);
    experimental.developerMode=true;excludeRunResult(first,'excluded-audio-run',{baseline});assert.equal(recordRunResult(first,experimental,{id:'excluded-audio-run',version:'0.3.27'}),null);
    for(const action of [()=>{},()=>saveProfile(stale)]){
      action();const restored=loadProfile();assert.deepEqual(restored.audioVolumes,{music:0,sounds:78});assert.equal(restored.muted,true);assert.equal(restored.bestScore,120);assert.deepEqual(restored.runHistory.map(row=>row.id),['legitimate-audio-run']);assert.ok(restored.excludedRuns.includes('excluded-audio-run'));
    }
    assert.deepEqual(stale.audioVolumes,{music:0,sounds:78},'a pre-exclusion tab cannot overwrite newer persisted preferences');
  });
});
