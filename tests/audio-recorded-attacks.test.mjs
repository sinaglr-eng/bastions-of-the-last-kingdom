import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager} from '../game/audio/audio.js';
import {recordedCatalogue,recordedAttackCue} from '../game/audio/recorded-attacks.js';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';

const raw=JSON.parse(readFileSync(new URL('../public/assets/audio/approved-20261011/catalogue.json',import.meta.url)));
const bankUrl='https://example.test/tower-defense/assets/audio/approved-20261011/catalogue.json?v=test';
const bank=recordedCatalogue(raw,bankUrl);
const sourceData=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const campaign={...sourceData,towers:campaignTowers(sourceData.towers),enemies:campaignEnemies(sourceData.enemies),recipes:campaignRecipes(sourceData.recipes),waves:campaignWaves(sourceData.waves)};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Param{constructor(){this.value=1;this.calls=[];}setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}linearRampToValueAtTime(value,time){this.value=value;}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class Node{constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.playbackRate=new Param();this.disconnects=0;this.stops=[];}connect(){}disconnect(){this.disconnects++;}start(time,offset=0){this.started=[time,offset];}stop(time){this.stops.push(time);}finish(){this.onended?.();}}
class Context{constructor(){this.currentTime=0;this.sampleRate=8;this.state='running';this.destination={};this.nodes=[];}node(kind){const n=new Node(kind);this.nodes.push(n);return n;}createBufferSource(){return this.node('source');}createGain(){return this.node('gain');}createOscillator(){return this.node('oscillator');}createBiquadFilter(){return this.node('filter');}createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}decodeAudioData(bytes){return Promise.resolve({id:new Uint8Array(bytes)[0],duration:1});}close(){return Promise.resolve();}}
const response=id=>({ok:true,arrayBuffer:async()=>new Uint8Array([id]).buffer});
function harness(options={}){
  let time=0;const context=new Context(),requests=[];
  const ids=new Map([...bank.effects.values()].map((clip,index)=>[clip.url,index+1]));
  const audio=new AudioManager(false,{contextFactory:()=>context,now:()=>time,fetchAudio:async(url,{signal})=>{requests.push({url,signal});return response(ids.get(url)||99);},...options});
  audio.context=context;audio.recordedEffects=new Map(bank.effects);audio.recordedDefenders=new Map(bank.defenders);audio.syncGameState({phase:'combat'});
  return {audio,context,requests,advance:ms=>{time+=ms;},played:()=>context.nodes.filter(n=>n.started&&n.buffer?.id)};
}
const shot=(family,tier=1)=>({source:{family,tier},stats:{type:'physical'},visible:true});

test('recorded primary attacks play a shared decoded MP3 once per simultaneous volley',async()=>{
  const h=harness();await Promise.all(Array.from({length:8},()=>h.audio.play('shot',shot('archer',6))));
  assert.equal(h.played().length,1);assert.equal(h.requests.length,1);assert.equal(h.played()[0].buffer.id,1);assert.equal(h.played()[0].playbackRate.value,1);
  assert.equal(h.context.nodes.filter(n=>n.kind==='oscillator'||n.kind==='filter').length,0,'no synthesized double attack');
  h.advance(66);await h.audio.play('shot',shot('royalranger'));assert.equal(h.played().length,2);assert.equal(h.requests.length,1,'all bows share the arrow buffer');h.audio.dispose();
});

test('actual tier, primary equipment and explicit elemental procs determine independent cues',()=>{
  const cue=(event,payload)=>recordedAttackCue(event,payload,bank.defenders);
  assert.equal(cue('shot',{...shot('soldier'),source:{family:'soldier',tier:1,level:6}}),'spear');
  assert.equal(cue('shot',shot('soldier',6)),'sword');assert.equal(cue('shot',shot('runebreaker',6)),'runic_bolt');
  assert.equal(cue('shot',shot('fireballista')),'heavy_bolt');assert.equal(cue('shot',shot('mechanicalgolem')),'toxic_canister');
  assert.equal(cue('chain',{source:{family:'archangel'},effect:'frost',visible:true}),'frost');
  assert.equal(cue('chain',{source:{family:'archangel'},effect:'lightning'}),null);
  assert.equal(cue('chain',{source:{family:'ladyclaire'},effect:'lightning'}),'lightning');
  assert.equal(cue('chain',{source:{family:'ladyclaire'}}),null);
  assert.equal(cue('burn-proc',{source:{family:'elvenking'},effect:'fire',amount:24,visible:true}),'fire');
  for(const payload of [{source:{family:'elvenking'},effect:'fire',amount:0},{source:{family:'soldier'},effect:'fire',amount:24},{source:{family:'elvenking'},effect:'fire',amount:24,visible:false}])assert.equal(cue('burn-proc',payload),null);
  assert.equal(cue('aura-attack',{source:{family:'worldfire'},stats:{type:'magical',burnAura:60}}),'fire');
});

test('hidden events, ordinary DOT ticks, passive auras and unattributed chains remain silent',async()=>{
  const h=harness();for(const [event,payload]of [['shot',{...shot('mage'),visible:false}],['chain',{source:{family:'archangel'}}],['burn-proc',{source:{family:'elvenking'},effect:'fire',amount:0}],['hit',{damage:12,directHit:false}],['aura',{source:{family:'worldfire'}}],['poison-tick',{source:{family:'royalranger'}}]])await h.audio.play(event,payload);
  assert.equal(h.context.nodes.length,0);assert.equal(h.requests.length,0);h.audio.dispose();
});

test('visible fire aura pulses are bounded and recorded effects respect event/concurrency budgets',async()=>{
  const h=harness(),payload={source:{family:'worldfire'},stats:{type:'magical',burnAura:60},visible:true};
  for(let i=0;i<30;i++)await h.audio.play('aura-attack',payload);assert.equal(h.played().length,1);
  h.advance(279);await h.audio.play('aura-attack',payload);assert.equal(h.played().length,1);
  h.advance(2);await h.audio.play('aura-attack',payload);assert.equal(h.played().length,2);
  for(let i=0;i<80;i++){h.advance(70);await h.audio.play('shot',shot('mage'));assert.ok(h.audio.voices.size<=28);assert.ok(h.audio.recent.length<=16);}
  h.audio.dispose();assert.equal(h.audio.voices.size,0);for(const n of h.played())assert.equal(n.disconnects,1);
});

test('a late attack download is discarded on pause, mute, phase switch, restart and elapsed delay',async()=>{
  for(const change of [h=>h.audio.syncGameState({phase:'combat',paused:true}),h=>{h.audio.muted=true;},h=>h.audio.syncGameState({phase:'reward'}),h=>h.audio.resetRun(),h=>h.advance(251),h=>h.audio.dispose()]){
    const gate=defer();const h=harness({fetchAudio:async()=>gate.promise});const pending=h.audio.play('shot',shot('mage'));await flush();change(h);gate.resolve(response(9));assert.equal(await pending,false);assert.equal(h.played().length,0);h.audio.dispose();
  }
});

test('restart immediately disconnects all old attack voices and pending speech cannot cross pause',async()=>{
  const h=harness();await h.audio.play('shot',shot('mage'));const old=h.played()[0];h.audio.resetRun();assert.ok(old.stops.length);assert.equal(old.disconnects,1);assert.equal(h.audio.voices.size,0);
  h.audio.setSelectionCatalogue({mage:[{id:'a',url:'a.mp3'},{id:'b',url:'b.mp3'}]});h.audio.syncGameState({phase:'build'});
  const gate=defer();h.audio.fetchAudio=async()=>gate.promise;const pending=h.audio.playSelectionVoice({tower:{family:'mage',tier:1,state:'active'}});await flush();h.audio.syncGameState({phase:'build',paused:true});gate.resolve(response(99));assert.equal(await pending,false);assert.equal(h.audio.selectionVoice,null);h.audio.dispose();
});

test('pausing actual battle state stops already playing attack voices without resuming old attacks',async()=>{
  const h=harness();await h.audio.play('shot',shot('mage'));const voice=h.played()[0];h.audio.syncGameState({phase:'combat',paused:true});
  assert.equal(voice.disconnects,1);assert.equal(h.audio.voices.size,0);h.audio.syncGameState({phase:'combat',paused:false});await flush();assert.equal(h.played().length,1);h.audio.dispose();
});

test('voice duck begins only for actual speech and is restored on ending or interruption',async()=>{
  const h=harness();h.audio.setSelectionCatalogue({mage:[{id:'a',url:'a.mp3'},{id:'b',url:'b.mp3'}]});h.audio.voiceRandom=()=>0;
  assert.equal(await h.audio.playSelectionVoice({tower:{family:'mage',tier:1,state:'active'}}),true);assert.equal(h.audio.music.ducked,true);
  h.audio.selectionVoice.source.finish();assert.equal(h.audio.music.ducked,false);
  await h.audio.playSelectionVoice({tower:{family:'mage',tier:1,state:'active'}});h.audio.cancelSelectionVoice();assert.equal(h.audio.music.ducked,false);h.audio.dispose();
});

test('short effect warmup uses at most three concurrent downloads and catalogue load never creates a context',async()=>{
  const context=new Context();let active=0,peak=0;
  const audio=new AudioManager(false,{contextFactory:()=>context,fetchAudio:async(url)=>{
    if(url===bankUrl)return {ok:true,url:bankUrl,json:async()=>raw};
    active++;peak=Math.max(peak,active);await flush();active--;return response(1);
  }});
  assert.equal(await audio.loadRecordedCatalogue(bankUrl),true);assert.equal(audio.context,null);assert.equal(peak,0);
  audio.unlock();await audio.preloadRecordedEffects();assert.equal(peak,3);assert.equal(audio.audioBuffers.size,15);audio.dispose();
});

test('asset or decode failure has finite cooldown and a later real attack can recover',async()=>{
  let requests=0;const h=harness({fetchAudio:async()=>++requests===1?{ok:false}:response(9)});
  assert.equal(await h.audio.play('shot',shot('mage')),false);for(let i=0;i<10;i++){h.advance(100);await h.audio.play('shot',shot('mage'));}assert.equal(requests,1);
  h.advance(5001);assert.equal(await h.audio.play('shot',shot('mage')),true);assert.equal(requests,2);h.audio.dispose();
});

test('the audio transport never consumes actual campaign randomness or changes defender combat state',async()=>{
  const game=new Game(campaign);let rolls=0;game.rng=()=>{rolls++;return .25;};
  assert.deepEqual(new Set(Object.keys(game.data.towers)),new Set(bank.defenders.keys()));
  const h=harness();const before=JSON.stringify(game.towers);await h.audio.play('shot',shot('soldier'));h.audio.syncGameState(game);
  assert.equal(rolls,0);assert.equal(JSON.stringify(game.towers),before);h.audio.dispose();
});

test('actual combat frost and lightning branches carry their originating defender into recorded playback',async()=>{
  for(const [family,effect]of [['archangel','frost'],['ladyclaire','lightning']]){
    const game=new Game(campaign),h=harness();game.phase='combat';game.combat.start(game.wave);game.combat.spawnQueue=[];
    const source={id:1,family,tier:1,state:'active',x:12,z:12,kills:0};game.towers.push(source);
    for(let i=0;i<3;i++){const e=game.combat.spawn('host_01',{variant:{hp:100000,armor:0,speed:0}});e.x=12;e.z=13+i;}
    const chains=[];game.on((event,payload)=>{if(event==='chain'){chains.push(payload);void h.audio.play(event,payload);}});
    const stats=towerStats(source,game.data),target=game.combat.enemies[0];game.rng=()=>0;
    if(effect==='frost')game.combat.bounceFrost(target,stats,source);else game.combat.impact({source,target,stats});
    await flush();assert.ok(chains.length>0);for(const payload of chains){assert.equal(payload.effect,effect);assert.equal(payload.source,source);assert.equal(payload.visible,true);}
    assert.equal(h.played().length,1);assert.equal(h.requests[0].url,bank.effects.get(effect).url);h.audio.dispose();
  }
});
