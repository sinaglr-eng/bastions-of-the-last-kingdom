import test from 'node:test';
import assert from 'node:assert/strict';
import {RecordedMusic} from '../game/audio/recorded-music.js';
import {AudioManager} from '../game/audio/audio.js';
import {recordedAudioBankReview} from '../game/audio/audio-assets.js';

class Param{constructor(){this.value=1;this.calls=[];}setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}linearRampToValueAtTime(value,time){this.value=value;this.calls.push(['linear',value,time]);}cancelScheduledValues(time){this.calls.push(['cancel',time]);}}
class Node{constructor(kind){this.kind=kind;this.gain=new Param();this.playbackRate=new Param();this.disconnects=0;this.stops=[];}connect(target){this.connected=target;}disconnect(){this.disconnects++;}start(time,offset=0){this.started=[time,offset];}stop(time){this.stops.push(time);}finish(){this.onended?.();}}
class Context{constructor(){this.currentTime=0;this.state='running';this.destination={};this.nodes=[];}node(kind){const n=new Node(kind);this.nodes.push(n);return n;}createGain(){return this.node('gain');}createBufferSource(){return this.node('source');}decodeAudioData(bytes){const duration=new Uint8Array(bytes)[0];return Promise.resolve({duration,bytes,sampleRate:48000,numberOfChannels:2,length:duration*48000});}resume(){this.state='running';return Promise.resolve();}close(){return Promise.resolve();}}
const tracks=[{id:'buildA',phase:'build',url:'buildA.mp3'},{id:'buildB',phase:'build',url:'buildB.mp3'},{id:'battleA',phase:'battle',url:'battleA.mp3'},{id:'battleB',phase:'battle',url:'battleB.mp3'},{id:'battleC',phase:'battle',url:'battleC.mp3'},{id:'victory',phase:'victory',url:'victory.mp3'}];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const reply=url=>({ok:true,arrayBuffer:async()=>new Uint8Array([url.includes('victory')?8:96]).buffer});
function harness(options={}){
  const context=new Context(),requests=[],timers=new Map();let nextTimer=1,wallTime=0,liveContext=options.locked?null:context;
  const fetchAudio=async(url,{signal})=>{requests.push({url,signal});return reply(url);};
  const music=new RecordedMusic({getContext:()=>liveContext,fetchAudio,now:()=>wallTime,random:()=>0,setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id),...options});
  music.configure(tracks,{crossfadeSeconds:1.5,duckGain:.32});
  return {music,context,requests,timers,setContext:value=>{liveContext=value;},setNow:value=>{wallTime=value;},async sync(phase,paused=false,speed=1){music.sync({phase,paused,speed});await flush();},loop(){const [id,timer]=[...timers][0];timers.delete(id);timer.fn();return timer;}};
}

test('music waits for gesture context and loads one phase track without preloading all six',async()=>{
  const h=harness({locked:true});await h.sync('build');assert.equal(h.requests.length,0);assert.equal(h.music.current,null);
  h.setContext(h.context);assert.equal(await h.music.ensure(),true);assert.equal(h.requests.length,1);assert.equal(h.music.current.track.id,'buildA');assert.equal(h.music.current.source.playbackRate.value,1);
  h.music.dispose();assert.equal(h.timers.size,0);
});

test('build/battle transitions crossfade 1.5 seconds independently of speed and repeated HUD updates',async()=>{
  const h=harness();await h.sync('build');const first=h.music.current;
  await h.sync('combat');const battle=h.music.current;
  assert.equal(first.stops,undefined);assert.deepEqual(first.source.stops,[1.51]);
  assert.ok(battle.gain.gain.calls.some(x=>x[0]==='linear'&&x[1]===1&&x[2]===1.5));
  for(const speed of [1,3,5,1])await h.sync('combat',false,speed);
  assert.equal(h.music.current,battle);assert.equal(battle.source.playbackRate.value,1);assert.equal(h.requests.length,2);
  await h.sync('reward');assert.equal(h.music.current.track.phase,'build');assert.notEqual(h.music.current,battle);assert.ok(h.music.voices.size<=2);
  assert.equal(h.music.cache.size,2);h.music.dispose();
});

test('pause and mute retain position and resume the same asset without new downloads',async()=>{
  const h=harness();await h.sync('combat');const first=h.music.current;h.context.currentTime=12.25;
  await h.sync('combat',true);assert.equal(h.music.current,null);assert.equal(h.music.saved.offset,12.25);assert.equal(first.source.disconnects,1);assert.equal(h.timers.size,0);
  h.context.currentTime=20;await h.sync('combat');assert.deepEqual(h.music.current.source.started,[20,12.25]);
  h.context.currentTime=22;h.music.setMuted(true);assert.equal(h.music.saved.offset,14.25);assert.equal(h.music.current,null);
  h.music.setMuted(false);await flush();assert.equal(h.music.current.offset,14.25);assert.equal(h.requests.length,1);h.music.dispose();
});

test('speech duck changes only master gain and restores its level during crossfades',async()=>{
  const h=harness();await h.sync('build');const first=h.music.current,automation=[...first.gain.gain.calls];
  h.music.duck(true);assert.equal(h.music.master.gain.value,.032);assert.deepEqual(first.gain.gain.calls,automation);
  await h.sync('combat');assert.equal(h.music.master.gain.value,.032);
  h.music.duck(false);assert.equal(h.music.master.gain.value,.1);assert.ok(h.music.current.gain.gain.calls.some(x=>x[0]==='linear'&&x[1]===1));h.music.dispose();
});

test('long music uses overlap transport with at most two voices and a two-buffer cache',async()=>{
  const h=harness();await h.sync('build');assert.equal([...h.timers.values()][0].ms,94500);
  for(let i=0;i<5;i++){h.context.currentTime+=94.5;h.loop();assert.ok(h.music.voices.size<=2);assert.equal(h.music.current.offset,0);}
  assert.equal(h.requests.length,1);await h.sync('combat');await h.sync('won');assert.equal(h.music.cache.size,2);assert.equal(h.timers.size,0);
  h.music.dispose();assert.equal(h.music.voices.size,0);assert.equal(h.music.cache.size,0);
  for(const n of h.context.nodes.filter(x=>x.started))assert.equal(n.disconnects,1);
});

test('the only victory is a one-shot campaign celebration despite result-dialog pause',async()=>{
  const h=harness();await h.sync('combat');await h.sync('reward');assert.equal(h.music.current.track.phase,'build');
  await h.sync('won',true);const voice=h.music.current;assert.equal(voice.track.id,'victory');assert.equal(h.timers.size,0);assert.equal(voice.source.loop,false);
  voice.source.finish();assert.equal(h.music.victoryFinished,true);for(let i=0;i<3;i++)await h.sync('won',true);
  assert.equal(h.music.current,null);assert.equal(h.requests.filter(x=>x.url==='victory.mp3').length,1);
  h.music.reset();await h.sync('won',true);assert.equal(h.music.current.track.id,'victory');await h.sync('lost',true);assert.equal(h.music.current,null);h.music.dispose();
});

test('rapid phase changes abort stale downloads and never start the prior phase',async()=>{
  const gate=deferred(),requests=[];
  const h=harness({fetchAudio:async(url,{signal})=>{requests.push({url,signal});return url==='buildA.mp3'?gate.promise:reply(url);}});
  h.music.sync({phase:'build'});await flush();await h.sync('combat');assert.equal(h.music.current.track.phase,'battle');assert.equal(requests[0].signal.aborted,true);
  gate.resolve(reply('buildA.mp3'));await flush();assert.equal(h.music.current.track.phase,'battle');assert.equal(h.context.nodes.filter(x=>x.started).length,1);h.music.dispose();
});

test('missing music retries after a real five-second cooldown rather than each HUD frame',async()=>{
  let calls=0;const h=harness({fetchAudio:async url=>{calls++;return calls===1?{ok:false}:reply(url);}});
  await h.sync('build');assert.equal(calls,1);for(let i=0;i<20;i++)await h.sync('build');assert.equal(calls,1);
  h.setNow(5001);await h.sync('build');assert.equal(calls,2);assert.ok(h.music.current);h.music.dispose();
});

test('reset and dispose cancel transport, pending loads and all owned nodes exactly once',async()=>{
  const gate=deferred();const h=harness({fetchAudio:async()=>gate.promise});h.music.sync({phase:'build'});await flush();
  const pending=h.music.loads.values().next().value;h.music.reset();assert.equal(pending.controller.signal.aborted,true);
  gate.resolve(reply('buildA.mp3'));await flush();assert.equal(h.music.current,null);assert.equal(h.context.nodes.length,0);
  await h.sync('combat');h.music.dispose();h.music.dispose();assert.equal(h.timers.size,0);assert.equal(h.music.voices.size,0);for(const n of h.context.nodes)assert.equal(n.disconnects,1);
});

test('new run starts a fresh same-URL load immediately and canceled prior load cannot delete or cooldown it',async()=>{
  const first=deferred(),second=deferred();let calls=0;
  const h=harness({fetchAudio:async()=>++calls===1?first.promise:second.promise});h.music.sync({phase:'build'});await flush();const old=h.music.loads.get('buildA.mp3');
  h.music.reset();h.music.sync({phase:'build'});await flush();assert.equal(calls,2);assert.equal(old.controller.signal.aborted,true);const current=h.music.loads.get('buildA.mp3');assert.notEqual(current,old);
  first.resolve(reply('buildA.mp3'));await flush();assert.equal(h.music.loads.get('buildA.mp3'),current);assert.equal(h.music.failures.has('buildA.mp3'),false);
  second.resolve(reply('buildA.mp3'));await flush();assert.equal(h.music.current.track.id,'buildA');assert.equal(h.music.loads.size,0);assert.equal(h.music.failures.size,0);h.music.dispose();
});

test('AudioManager terminal pause and mute gesture resume use the same transport boundary',async()=>{
  const context=new Context();context.state='suspended';let factories=0;
  const audio=new AudioManager(true,{contextFactory:()=>{factories++;return context;},fetchAudio:async url=>reply(url),musicTimers:{setTimer:()=>1,clearTimer:()=>{}}});
  audio.music.configure(tracks);audio.syncGameState({phase:'build'});audio.unlock();assert.equal(factories,0);
  audio.muted=false;audio.unlock();await audio.resumePromise;await flush();assert.equal(factories,1);assert.equal(audio.music.current.track.phase,'build');
  audio.syncGameState({phase:'won',paused:true});await flush();assert.equal(audio.music.current.track.phase,'victory');
  audio.resetRun();assert.equal(audio.music.current,null);audio.dispose();
});

test('silent native bank review decodes 21 clips through bounded cache without interrupting a victory source',async()=>{
  const context=new Context();const audio=new AudioManager(false,{contextFactory:()=>context,fetchAudio:async url=>reply(url),musicTimers:{setTimer:()=>1,clearTimer:()=>{}}});audio.context=context;
  audio.recordedEffects=new Map(Array.from({length:15},(_,i)=>[String(i),{id:String(i),url:`attack${i}.mp3`}]));
  audio.music.configure(tracks);audio.syncGameState({phase:'won',paused:true});await flush();const victory=audio.music.current;
  const report=await recordedAudioBankReview(audio);assert.equal(report.status,'passed');assert.equal(report.expected,21);assert.equal(report.decoded,21);assert.equal(report.musicCacheBuffers,2);
  assert.equal(audio.music.current,victory);assert.equal(victory.source.stops.length,0);assert.equal(context.nodes.filter(n=>n.started).length,1,'review never plays a clip');
  assert.ok(report.clips.every(clip=>clip.sampleRate===48000&&clip.channels===2&&clip.frames>0));audio.dispose();
});

test('native bank review refuses partial banks and failed decodes instead of reporting a count-only pass',async()=>{
  const context=new Context();const audio=new AudioManager(false,{contextFactory:()=>context,fetchAudio:async()=>({ok:false}),musicTimers:{setTimer:()=>1,clearTimer:()=>{}}});audio.context=context;
  audio.recordedEffects=new Map([['one',{id:'one',url:'bad.mp3'}]]);audio.music.configure(tracks);
  const failed=await recordedAudioBankReview(audio);assert.equal(failed.status,'failed');assert.equal(failed.decoded,0);assert.equal(failed.expected,21);
  audio.muted=true;assert.equal((await recordedAudioBankReview(audio)).status,'unavailable');audio.dispose();
});
