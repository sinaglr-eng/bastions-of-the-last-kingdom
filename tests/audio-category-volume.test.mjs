import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager,DEFAULT_AUDIO_VOLUMES} from '../game/audio/audio.js';
import {recordedCatalogue} from '../game/audio/recorded-attacks.js';

const raw=JSON.parse(readFileSync(new URL('../public/assets/audio/approved-20261011/catalogue.json',import.meta.url)));
const bank=recordedCatalogue(raw,'https://example.test/assets/audio/approved-20261011/catalogue.json?v=test');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
class Param{
  constructor(){this.value=1;this.calls=[];}
  setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}
  linearRampToValueAtTime(value,time){this.value=value;this.calls.push(['linear',value,time]);}
  exponentialRampToValueAtTime(value,time){this.value=value;this.calls.push(['exponential',value,time]);}
  cancelScheduledValues(time){this.calls.push(['cancel',time]);}
}
class Node{
  constructor(kind){this.kind=kind;this.gain=new Param();this.frequency=new Param();this.playbackRate=new Param();this.Q=new Param();this.stops=[];this.disconnects=0;}
  connect(target){this.connected=target;}disconnect(){this.disconnects++;}
  start(time,offset=0){this.started=[time,offset];}stop(time){this.stops.push(time);}finish(){this.onended?.();}
}
class Context{
  constructor(){this.state='running';this.currentTime=0;this.sampleRate=8;this.destination={};this.nodes=[];}
  node(kind){const node=new Node(kind);this.nodes.push(node);return node;}
  createGain(){return this.node('gain');}createBufferSource(){return this.node('source');}createOscillator(){return this.node('oscillator');}createBiquadFilter(){return this.node('filter');}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  decodeAudioData(bytes){return Promise.resolve({duration:new Uint8Array(bytes)[0]});}close(){return Promise.resolve();}
}
const reply=url=>({ok:true,arrayBuffer:async()=>new Uint8Array([url.includes('victory')?8:url.includes('/music/')?96:2]).buffer});
function harness({categoryVolumes,recorded=true,locked=false,fetchAudio=reply}={}){
  const context=new Context(),requests=[],timers=new Map();let time=0,timerId=0;
  const audio=new AudioManager(false,{contextFactory:()=>context,categoryVolumes,now:()=>time,selectionCatalogue:{soldier:['voice-a.mp3','voice-b.mp3']},voiceRandom:()=>0,musicRandom:()=>0,fetchAudio:async(url,options)=>{requests.push({url,...options});return fetchAudio(url,options);},musicTimers:{setTimer:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)}});
  if(!locked)audio.context=context;
  if(recorded){audio.recordedEffects=new Map(bank.effects);audio.recordedDefenders=new Map(bank.defenders);audio.music.configure(bank.music,bank.policy);}
  return {audio,context,requests,timers,advance:ms=>{time+=ms;},async sync(phase='combat'){audio.syncGameState({phase,round:2});await flush();}};
}
const shot=family=>({source:{family,tier:1},stats:{type:'physical'},visible:true});
const peak=voice=>Math.max(...voice.gain.gain.calls.filter(row=>row[0]==='linear'||row[0]==='set').map(row=>row[1]));

test('fresh 80/40 settings remain lazy, accept restored percentages, clamp values and survive run reset',()=>{
  const h=harness({locked:true});try{
    assert.deepEqual(DEFAULT_AUDIO_VOLUMES,{music:80,sounds:40});assert.equal(h.audio.getCategoryVolume('music'),80);assert.equal(h.audio.getCategoryVolume('sounds'),40);
    assert.equal(h.audio.setCategoryVolume('music',0),0);assert.equal(h.audio.setCategoryVolume('sounds',67),67);assert.equal(h.audio.context,null);assert.equal(h.context.nodes.length,0);assert.equal(h.requests.length,0);
    h.audio.resetRun();assert.equal(h.audio.getCategoryVolume('music'),0);assert.equal(h.audio.getCategoryVolume('sounds'),67);
    assert.equal(h.audio.setCategoryVolume('sounds',999),100);assert.equal(h.audio.setCategoryVolume('sounds',-1),0);assert.equal(h.audio.setCategoryVolume('sounds',NaN),0);assert.throws(()=>h.audio.setCategoryVolume('voices',10),/Unknown audio category/);
  }finally{h.audio.dispose();}
  const restored=harness({locked:true,categoryVolumes:{music:28,sounds:92}});try{assert.equal(restored.audio.getCategoryVolume('music'),28);assert.equal(restored.audio.getCategoryVolume('sounds'),92);}finally{restored.audio.dispose();}
});

test('recorded attacks change live on the Sounds bus without affecting music, source playback or clip gain',async()=>{
  const h=harness();try{
    await h.sync();await h.audio.play('shot',shot('archer'));
    const attack=[...h.audio.voices][0],music=h.audio.music.current,clipAutomation=[...attack.gain.gain.calls],musicAutomation=[...h.audio.music.master.gain.calls],starts=h.context.nodes.filter(node=>node.started).length,requests=h.requests.length;
    assert.equal(attack.gain.connected,h.audio.soundsMaster);assert.equal(attack.gain.gain.value,.12);assert.equal(h.audio.soundsMaster.gain.value,.4);
    h.context.currentTime=.15;h.audio.setCategoryVolume('sounds',0);assert.equal(h.audio.soundsMaster.gain.value,0);assert.equal(attack.gain.gain.value*h.audio.soundsMaster.gain.value,0);assert.deepEqual(attack.gain.gain.calls,clipAutomation);assert.deepEqual(h.audio.music.master.gain.calls,musicAutomation);
    h.audio.setCategoryVolume('sounds',73);assert.equal(h.audio.soundsMaster.gain.value,.73);assert.equal(attack.gain.gain.value,.12);assert.equal(h.audio.music.current,music);assert.deepEqual(attack.source.stops,[]);assert.equal(h.context.nodes.filter(node=>node.started).length,starts);assert.equal(h.requests.length,requests);
    const soundAutomation=[...h.audio.soundsMaster.gain.calls];h.audio.setCategoryVolume('music',0);assert.equal(h.audio.music.master.gain.value,0);assert.deepEqual(h.audio.soundsMaster.gain.calls,soundAutomation);assert.equal(h.audio.music.current,music);assert.deepEqual(music.source.stops,[]);
  }finally{h.audio.dispose();}
});

test('every fallback attack and impact mechanism and direct-hit effect is silent at Sounds zero, preserving relative envelopes',()=>{
  const cases=[['druid','poison'],['worldfire','fire'],['stormcaller','arcane'],['soldier','physical'],['stonewarden','physical'],['cleric','holy'],['frostwarden','frost'],['mage','arcane'],['archer','physical']];
  for(const [family,type]of cases){
    const h=harness({recorded:false,categoryVolumes:{sounds:0}});try{
      const payload={source:{family},stats:{type},visible:true};h.audio.play('shot',payload);h.advance(100);h.audio.play('impact',payload);h.advance(100);h.audio.play('hit',{directHit:true,damage:5,visible:true});
      assert.ok(h.audio.voices.size>=4,`${family} creates its existing fallback mechanisms`);
      for(const voice of h.audio.voices){assert.equal(voice.gain.connected,h.audio.soundsMaster);assert.ok(peak(voice)>0);assert.equal(peak(voice)*h.audio.soundsMaster.gain.value,0);}
      const snapshots=[...h.audio.voices].map(voice=>[voice,[...voice.gain.gain.calls]]);h.audio.setCategoryVolume('sounds',60);
      assert.equal(h.audio.soundsMaster.gain.value,.6);for(const [voice,calls]of snapshots)assert.deepEqual(voice.gain.gain.calls,calls);
    }finally{h.audio.dispose();}
  }
});

test('the Sounds slider leaves UI, crafting, death, leak and fallback victory cues at their prior gain paths',()=>{
  const h=harness({recorded:false,categoryVolumes:{music:0,sounds:0}});try{
    for(const event of ['place','combine','death','leak','reward','won','lost']){h.audio.play(event,{enemy:{boss:true}});h.advance(1500);}
    assert.ok(h.audio.voices.size>10);assert.equal(h.audio.soundsMaster,null);
    const snapshots=[...h.audio.voices].map(voice=>[voice,[...voice.gain.gain.calls]]);for(const [voice]of snapshots)assert.equal(voice.gain.connected,h.context.destination);
    h.audio.setCategoryVolume('music',100);h.audio.setCategoryVolume('sounds',100);for(const [voice,calls]of snapshots){assert.deepEqual(voice.gain.gain.calls,calls);assert.equal(voice.gain.connected,h.context.destination);}
    assert.ok(snapshots.some(([voice])=>Math.abs(peak(voice)-h.audio.channels.Victory*.7)<1e-12));
  }finally{h.audio.dispose();}
});

test('Music changes preserve speech ducking, crossfade envelopes, rotation timers, cache and active tracks',async()=>{
  const h=harness();try{
    await h.sync('build');const build=h.audio.music.current;await h.sync('combat');const battle=h.audio.music.current;
    const envelope=[...battle.gain.gain.calls],fade=[...build.gain.gain.calls],timer=[...h.timers],cache=[...h.audio.music.cache],requests=h.requests.length;
    h.audio.music.duck(true);h.audio.setCategoryVolume('music',50);assert.equal(h.audio.music.master.gain.value,.18*.5*.32);h.audio.setCategoryVolume('music',0);assert.equal(h.audio.music.master.gain.value,0);
    h.audio.setCategoryVolume('music',100);assert.equal(h.audio.music.master.gain.value,.18*.32);h.audio.music.duck(false);assert.equal(h.audio.music.master.gain.value,.18);
    assert.equal(h.audio.music.current,battle);assert.deepEqual(battle.gain.gain.calls,envelope);assert.deepEqual(build.gain.gain.calls,fade);assert.deepEqual([...h.timers],timer);assert.deepEqual([...h.audio.music.cache],cache);assert.equal(h.requests.length,requests);assert.deepEqual(battle.source.stops,[]);
    h.audio.muted=true;assert.equal(h.audio.music.current,null);h.audio.muted=false;await flush();assert.equal(h.audio.music.current.track.id,battle.track.id);assert.equal(h.audio.music.master.gain.value,.18);assert.equal(h.audio.getCategoryVolume('sounds'),40);
  }finally{h.audio.dispose();}
});

test('quiet per-wave victory keeps original gain and speech ducking while Music and Sounds reach zero',async()=>{
  const h=harness({categoryVolumes:{music:0,sounds:0}});try{
    await h.sync('build');h.audio.play('wave-complete',{round:1});await flush();const victory=h.audio.music.celebration;
    assert.equal(h.audio.music.master.gain.value,0);assert.equal(victory.gain.connected,h.audio.music.celebrationMaster);assert.equal(h.audio.music.celebrationMaster.gain.value,.025);assert.equal(victory.gain.gain.value,1);
    const tower={id:1,family:'soldier',tier:1,state:'active',round:2};assert.equal(await h.audio.play('defender-committed',{tower,round:2}),true);const speech=h.audio.selectionVoice;
    assert.equal(speech.gain.connected,h.context.destination);assert.equal(speech.gain.gain.value,.08);assert.equal(h.audio.music.celebrationMaster.gain.value,.025*.32);assert.equal(h.audio.music.master.gain.value,0);
    const speechEnvelope=[...speech.gain.gain.calls],victoryEnvelope=[...victory.gain.gain.calls],victoryMasterAutomation=[...h.audio.music.celebrationMaster.gain.calls];
    for(const [music,sounds]of [[100,100],[25,70],[0,0]]){h.audio.setCategoryVolume('music',music);h.audio.setCategoryVolume('sounds',sounds);assert.equal(h.audio.selectionVoice,speech);assert.equal(h.audio.music.celebration,victory);assert.deepEqual(speech.source.stops,[]);assert.deepEqual(victory.source.stops,[]);}
    assert.deepEqual(speech.gain.gain.calls,speechEnvelope);assert.deepEqual(victory.gain.gain.calls,victoryEnvelope);assert.deepEqual(h.audio.music.celebrationMaster.gain.calls,victoryMasterAutomation);
    assert.equal(await h.audio.play('defender-committed',{tower,round:2}),false,'sliders cannot replay a committed line');speech.source.finish();assert.equal(h.audio.music.celebrationMaster.gain.value,.025);assert.equal(h.audio.music.master.gain.value,0);
    h.audio.play('wave-complete',{round:1});await h.sync('build');assert.equal(h.audio.music.celebration,victory);assert.equal(h.context.nodes.filter(node=>node.buffer?.duration===8&&node.started).length,1);
  }finally{h.audio.dispose();}
});

test('volume changes during pending attack and background downloads use latest settings without cancelling loads',async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});const h=harness({fetchAudio:async url=>{await gate;return reply(url);}});try{
    h.audio.syncGameState({phase:'combat'});const attack=h.audio.play('shot',shot('archer'));await flush();h.audio.setCategoryVolume('music',0);h.audio.setCategoryVolume('sounds',0);
    assert.ok(h.requests.length>=2);assert.ok(h.requests.every(request=>!request.signal.aborted));release();assert.equal(await attack,true);await flush();assert.equal(h.audio.music.master.gain.value,0);assert.equal(h.audio.soundsMaster.gain.value,0);assert.equal(h.audio.music.current.track.phase,'battle');
  }finally{release();h.audio.dispose();}
});
