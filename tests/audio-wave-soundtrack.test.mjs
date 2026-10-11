import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager} from '../game/audio/audio.js';
import {recordedCatalogue} from '../game/audio/recorded-attacks.js';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';

const raw=JSON.parse(readFileSync(new URL('../public/assets/audio/approved-20261011/catalogue.json',import.meta.url)));
const bank=recordedCatalogue(raw,'https://example.test/assets/audio/approved-20261011/catalogue.json?v=test');
const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(name=>[name,JSON.parse(readFileSync(new URL(`../data/${name}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const reply=url=>({ok:true,arrayBuffer:async()=>new Uint8Array([url.includes('victory')?8:url.includes('/music/')?96:2]).buffer});
class Param{constructor(){this.value=1;this.calls=[];}setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}linearRampToValueAtTime(value,time){this.value=value;this.calls.push(['linear',value,time]);}exponentialRampToValueAtTime(value,time){this.value=value;this.calls.push(['exponential',value,time]);}cancelScheduledValues(time){this.calls.push(['cancel',time]);}}
class Node{constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param();this.stops=[];this.disconnects=0;}connect(to){this.connected=to;}disconnect(){this.disconnects++;}start(time,offset=0){this.started=[time,offset];}stop(time){this.stops.push(time);}finish(){this.onended?.();}}
class Context{constructor(){this.state='running';this.currentTime=0;this.sampleRate=8;this.nodes=[];this.destination={};}node(kind){const n=new Node(kind);this.nodes.push(n);return n;}createGain(){return this.node('gain');}createBufferSource(){return this.node('source');}createOscillator(){return this.node('oscillator');}createBiquadFilter(){return this.node('filter');}createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}decodeAudioData(bytes){const duration=new Uint8Array(bytes)[0];return Promise.resolve({duration,sampleRate:48000,numberOfChannels:2,length:duration*48000});}resume(){this.state='running';return Promise.resolve();}close(){return Promise.resolve();}}
function harness({fetchAudio=null,locked=false}={}){
 const context=new Context(),requests=[],timers=new Map();let timerId=0,rngCalls=0;
 const audio=new AudioManager(false,{contextFactory:()=>context,fetchAudio:async(url,options)=>{requests.push({url,...options});return fetchAudio?fetchAudio(url,options):reply(url);},musicRandom:()=>{rngCalls++;return 0;},musicTimers:{setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)}});
 if(!locked)audio.context=context;audio.music.configure(bank.music,bank.policy);audio.recordedEffects=new Map(bank.effects);audio.recordedDefenders=new Map(bank.defenders);
 return {audio,context,requests,timers,rngCalls:()=>rngCalls,async sync(phase,round=1,paused=false){audio.syncGameState({phase,round,paused,waveLimit:10});await tick();},async boundary(){const [id,timer]=[...timers][0];timers.delete(id);context.currentTime+=timer.ms/1000;timer.fn();await tick();},celebrations:()=>context.nodes.filter(n=>n.started&&n.buffer?.duration===8)};
}
function connect(game,audio){return game.on((type,payload)=>{audio.play(type,payload);audio.syncGameState(game);});}

test('the actual six-track catalogue rotates through both phase bags and all three battle tails without immediate repeats',async()=>{
 const h=harness();try{
  await h.sync('build');assert.equal(h.audio.music.current.track.id,'iron_build');
  await h.sync('combat');const battleIds=[h.audio.music.current.track.id];
  for(let i=0;i<5;i++){await h.boundary();battleIds.push(h.audio.music.current.track.id);assert.ok(h.audio.music.cache.size<=2);assert.ok(h.audio.music.voices.size<=2);}
  assert.deepEqual(battleIds,['iron_battle','wilds_battle','fallen_battle','iron_battle','wilds_battle','fallen_battle']);
  await h.sync('build');assert.equal(h.audio.music.current.track.id,'wilds_build');await h.boundary();assert.equal(h.audio.music.current.track.id,'iron_build');
  await h.sync('combat');assert.equal(h.audio.music.current.track.id,'iron_battle');
 }finally{h.audio.dispose();}
});

test('two real Game wave completions play one quiet celebration each underneath the newly selected build soundtrack',async()=>{
 const h=harness(),game=new Game(data,{seed:82,waveLimit:10}),off=connect(game,h.audio);try{
  game.phase='combat';h.audio.syncGameState(game);await tick();game.completeWave();await tick();
  assert.equal(game.round,2);assert.equal(game.phase,'build');assert.equal(h.audio.music.current.track.phase,'build');assert.equal(h.celebrations().length,1);assert.ok(h.audio.music.celebration);assert.ok(h.audio.music.voices.size<=3);assert.equal(h.audio.music.cache.size,2);
  const build=h.audio.music.current;h.context.currentTime=8;h.audio.music.celebration.source.finish();await tick();assert.equal(h.audio.music.current,build);assert.equal(h.audio.music.celebration,null,'completion does not stop the construction soundtrack');
  game.phase='combat';game.emit('wave',{});game.completeWave();await tick();assert.equal(game.round,3);assert.equal(h.celebrations().length,2);assert.equal(h.audio.music.celebration.key,'wave:2');
  h.audio.play('wave-complete',{round:2});for(let i=0;i<5;i++)h.audio.syncGameState(game);await tick();assert.equal(h.celebrations().length,2,'duplicate completion and HUD refresh cannot replay it');
 }finally{off();h.audio.dispose();}
});

test('final real 10-wave and 50-wave victories share the completion key and have no background or duplicate result cue',async()=>{
 for(const waveLimit of [10,50]){
  const h=harness(),game=new Game(data,{seed:83,waveLimit}),off=connect(game,h.audio);try{
   game.phase='combat';game.round=waveLimit;h.audio.syncGameState(game);await tick();game.completeWave();await tick();
   assert.equal(game.phase,'won');assert.equal(h.celebrations().length,1);assert.equal(h.audio.music.current,null);assert.equal(h.audio.music.celebration.key,`wave:${waveLimit}`);assert.equal(h.timers.size,0);
   game.paused=true;for(let i=0;i<5;i++)h.audio.syncGameState(game);h.audio.play('won',{});await tick();assert.equal(h.celebrations().length,1);assert.equal(h.audio.music.celebration.source.stops.length,0);
   h.audio.music.celebration.source.finish();await tick();h.audio.syncGameState(game);await tick();assert.equal(h.audio.music.celebration,null);assert.equal(h.celebrations().length,1);
  }finally{off();h.audio.dispose();}
 }
});

test('measured gain nodes make music nominally 3.52dB above a recorded attack and the celebration lower than every other channel',async()=>{
 const h=harness();try{
  await h.sync('build');assert.equal(await h.audio.playRecordedEffect('arrow'),true);const attack=[...h.audio.voices].find(v=>v.source.buffer?.duration===2);
  h.audio.play('wave-complete',{round:1});await tick();const celebration=h.audio.music.celebration;
  assert.equal(h.audio.music.master.gain.value,.18);assert.equal(attack.gain.gain.value,.12);assert.ok(Math.abs(20*Math.log10(.18/.12)-3.5218251811136247)<1e-10);
  assert.ok(Math.abs(celebration.gain.gain.value*h.audio.music.master.gain.value-.025)<1e-12);
  assert.ok(Object.entries(h.audio.channels).filter(([key])=>key!=='Victory').every(([,gain])=>gain>.025));
  assert.equal(celebration.source.loop,false);assert.equal(celebration.buffer.duration,8);
  for(const speed of [1,2,3]){h.audio.syncGameState({phase:'build',round:2,speed});assert.equal(h.audio.music.current.source.playbackRate.value,1);assert.equal(celebration.source.playbackRate.value,1);assert.equal(attack.source.playbackRate.value,1);}
 }finally{h.audio.dispose();}
});

test('pause and mute preserve independent background and celebration offsets instead of restarting or duplicating either source',async()=>{
 const h=harness();try{
  await h.sync('build',2);h.audio.play('wave-complete',{round:1});await tick();h.context.currentTime=3.25;
  await h.sync('build',2,true);assert.equal(h.audio.music.current,null);assert.equal(h.audio.music.celebration,null);assert.equal(h.audio.music.saved.offset,3.25);assert.equal(h.audio.music.savedCelebration.offset,3.25);
  h.context.currentTime=30;await h.sync('build',2);assert.deepEqual(h.audio.music.current.source.started,[30,3.25]);assert.deepEqual(h.audio.music.celebration.source.started,[30,3.25]);
  h.context.currentTime=31.5;h.audio.muted=true;assert.equal(h.audio.music.saved.offset,4.75);assert.equal(h.audio.music.savedCelebration.offset,4.75);
  h.audio.muted=false;await tick();assert.equal(h.audio.music.celebration.offset,4.75);assert.equal(h.audio.music.current.offset,4.75);
  assert.equal(h.requests.filter(r=>r.url.includes('victory')).length,1);assert.ok(h.audio.music.cache.size<=2);
 }finally{h.audio.dispose();}
});

test('real five-placement, Keep and immediate next-wave start retain both pending and playing quiet celebrations',async()=>{
 for(const pendingDownload of [true,false]){
  const gate=deferred(),h=harness({fetchAudio:url=>pendingDownload&&url.includes('victory')?gate.promise:reply(url)}),game=new Game(data,{seed:85,waveLimit:10}),off=connect(game,h.audio);try{
   game.phase='combat';h.audio.syncGameState(game);await tick();game.completeWave();await tick();
   const request=h.requests.find(r=>r.url.includes('victory')),original=h.audio.music.celebration;
   assert.equal(game.phase,'build');assert.equal(game.round,2);assert.equal(h.audio.music.celebrationKey,'wave:1');
   for(const x of [12,13,14,15,16])assert.equal(game.place(x,18),true);
   assert.equal(game.phase,'select');assert.equal(game.keep(),true);assert.equal(game.phase,'ready');assert.equal(game.startCombat(),true);await tick();
   assert.equal(game.phase,'combat');assert.equal(h.audio.music.current.track.phase,'battle');assert.equal(request.signal.aborted,false,'wave start must not invalidate the previous completion download');
   if(pendingDownload){assert.equal(h.celebrations().length,0);gate.resolve(reply(request.url));await tick();}
   else{assert.equal(h.audio.music.celebration,original);assert.deepEqual(original.source.stops,[]);}
   const playing=h.audio.music.celebration;assert.equal(playing.key,'wave:1');assert.equal(h.celebrations().length,1);assert.ok(h.audio.music.voices.size<=3);assert.ok(h.audio.music.cache.size<=2);
   const battle=h.audio.music.current;h.context.currentTime=8;playing.source.finish();await tick();assert.equal(h.audio.music.current,battle);assert.equal(h.audio.music.celebration,null);
   game.completeWave();await tick();const second=h.audio.music.celebration;assert.equal(second.key,'wave:2');assert.equal(h.celebrations().length,2);
   assert.equal(game.startCombat(),false,'the soundtrack cannot advance game phases');
   game.phase='combat';game.completeWave();await tick();assert.equal(h.audio.music.celebration.key,'wave:3');assert.ok(second.source.stops.length>0,'a later completion replaces a still-playing celebration');assert.equal(second.source.disconnects,1);assert.ok(h.audio.music.voices.size<=3);
  }finally{off();h.audio.dispose();}
 }
});

test('restart discards a pending celebration and can immediately load the same approved URL for a fresh run',async()=>{
 const first=deferred(),second=deferred();let attempts=0;const h=harness({fetchAudio:url=>url.includes('victory')?(++attempts===1?first.promise:second.promise):reply(url)});try{
  await h.sync('build');h.audio.play('wave-complete',{round:1});await tick();const old=h.requests.find(r=>r.url.includes('victory'));
  h.audio.resetRun();await h.sync('build');h.audio.play('wave-complete',{round:1});await tick();assert.equal(attempts,2);assert.equal(old.signal.aborted,true);
  first.resolve(reply(old.url));await tick();assert.equal(h.celebrations().length,0);assert.equal(h.audio.music.failures.size,0);
  second.resolve(reply(old.url));await tick();assert.equal(h.celebrations().length,1);assert.equal(h.audio.music.celebration.key,'wave:1');
  const playing=h.audio.music.celebration;h.audio.resetRun();playing.source.finish();await tick();assert.equal(h.audio.music.celebration,null);assert.equal(h.audio.music.voices.size,0);assert.equal(h.timers.size,0);assert.equal(playing.source.disconnects,1);
 }finally{h.audio.dispose();}
});

test('a completion while audio is locked waits for the real unlock gesture and a muted completion cannot sound',async()=>{
 const h=harness({locked:true});try{
  await h.sync('build',2);h.audio.play('wave-complete',{round:1});await tick();assert.equal(h.context.nodes.length,0);assert.equal(h.requests.length,0);
  h.audio.muted=true;h.audio.unlock();assert.equal(h.audio.context,null);h.audio.muted=false;h.audio.unlock();await tick();assert.equal(h.celebrations().length,1);assert.ok(h.audio.music.current);
 }finally{h.audio.dispose();}
});

test('phase rotations, all real completion events and tail callbacks leave the campaign RNG and combat data untouched',async()=>{
 const h=harness(),game=new Game(data,{seed:84,waveLimit:10}),control=new Game(data,{seed:84,waveLimit:10}),before=JSON.stringify(data),off=connect(game,h.audio);try{
  for(let round=1;round<=3;round++){
   for(const run of [game,control]){run.phase='combat';run.completeWave();}
   await tick();await h.boundary();assert.equal(game.rng(),control.rng());
  }
  assert.ok(h.rngCalls()>3);assert.equal(JSON.stringify(data),before);assert.equal(game.score,control.score);assert.equal(game.round,control.round);assert.deepEqual(game.draft.draws,control.draft.draws);
 }finally{off();h.audio.dispose();}
});

test('a natural source ending also rotates when a background timer was delayed and releases the old nodes once',async()=>{
 const h=harness();try{
  await h.sync('build');const old=h.audio.music.current;h.context.currentTime=96;old.source.finish();await tick();
  assert.equal(h.audio.music.current.track.id,'wilds_build');assert.equal(old.source.disconnects,1);assert.equal(old.gain.disconnects,1);assert.equal(h.timers.size,1);
 }finally{h.audio.dispose();}
});

test('pausing during a slow tail rotation preserves the audible old-track position and suppresses the canceled next download',async()=>{
 const gate=deferred(),h=harness({fetchAudio:url=>url.includes('wilds_build')?gate.promise:reply(url)});try{
  await h.sync('build');await h.boundary();const pending=h.requests.find(row=>row.url.includes('wilds_build'));
  await h.sync('build',1,true);assert.equal(pending.signal.aborted,true);assert.equal(h.audio.music.saved.track.id,'iron_build');assert.equal(h.audio.music.saved.offset,94.5);
  h.context.currentTime=110;await h.sync('build');assert.equal(h.audio.music.current.track.id,'iron_build');assert.equal(h.audio.music.current.offset,94.5);
  gate.resolve(reply(pending.url));await tick();assert.equal(h.audio.music.current.track.id,'iron_build');assert.equal(h.audio.music.failures.size,0);assert.equal(h.timers.size,1);
 }finally{h.audio.dispose();}
});

test('repeated terminal HUD frames do not postpone the one background fade or stop the quiet final celebration',async()=>{
 const h=harness();try{
  await h.sync('combat',10);const battle=h.audio.music.current;h.audio.play('wave-complete',{round:10});await h.sync('won',10,true);
  const victory=h.audio.music.celebration,stops=[...battle.source.stops];assert.deepEqual(stops,[.31]);
  for(let i=0;i<8;i++){h.context.currentTime+=.2;await h.sync('won',10,true);}
  assert.deepEqual(battle.source.stops,stops);assert.deepEqual(victory.source.stops,[]);assert.equal(h.celebrations().length,1);assert.equal(h.timers.size,0);
 }finally{h.audio.dispose();}
});
