import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioManager} from '../game/audio/audio.js';

class Param{
  constructor(){this.values=[];}
  setValueAtTime(...args){this.values.push(['set',...args]);}
  linearRampToValueAtTime(...args){this.values.push(['linear',...args]);}
  exponentialRampToValueAtTime(...args){this.values.push(['exponential',...args]);}
  cancelScheduledValues(...args){this.values.push(['cancel',...args]);}
}
class Node{
  constructor(type){this.kind=type;this.frequency=new Param();this.gain=new Param();this.Q=new Param();this.disconnected=0;}
  connect(){}
  disconnect(){this.disconnected++;}
  start(time){this.started=time;}
  stop(time){this.stopped=time;}
  finish(){this.onended?.();this.onended=null;}
}
class Context{
  constructor(){this.currentTime=0;this.sampleRate=8000;this.destination={};this.state='suspended';this.nodes=[];this.resumes=0;this.closed=false;}
  node(kind){const node=new Node(kind);this.nodes.push(node);return node;}
  createOscillator(){return this.node('oscillator');}
  createGain(){return this.node('gain');}
  createBufferSource(){return this.node('noise');}
  createBiquadFilter(){return this.node('filter');}
  createBuffer(channels,length){const values=new Float32Array(length);return {getChannelData:()=>values};}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  close(){this.closed=true;return Promise.resolve();}
  finish(){for(const node of this.nodes)node.finish();}
}
const harness=(muted=false)=>{let now=0,created=0;const context=new Context();const audio=new AudioManager(muted,{contextFactory:()=>{created++;return context;},now:()=>now,random:()=>.6});return {audio,context,advance:ms=>now+=ms,created:()=>created};};
const attack=(family,type)=>({source:{family},stats:{type}});

test('AudioContext is lazy, muted play cannot create it, and unlock resumes only on interaction',()=>{
  const h=harness(true);h.audio.play('shot',attack('mage','arcane'));h.audio.unlock();assert.equal(h.created(),0);
  h.audio.muted=false;h.audio.play('place');assert.equal(h.created(),0);h.audio.unlock();assert.equal(h.created(),1);assert.equal(h.context.resumes,1);
  h.audio.unlock();assert.equal(h.created(),1);h.audio.play('place');assert.ok(h.audio.voices.size>0);h.audio.dispose();
});

test('attack mechanisms create different synthesized sound signatures',()=>{
  const signatures=[];
  for(const [family,type]of [['druid','poison'],['worldfire','fire'],['stormcaller','arcane'],['soldier','physical'],['stonewarden','physical'],['cleric','holy'],['frostwarden','frost'],['mage','arcane'],['archer','physical']]){
    const h=harness();h.audio.unlock();h.audio.play('shot',attack(family,type));
    signatures.push(JSON.stringify(h.context.nodes.map(n=>({kind:n.kind,type:n.type,frequency:n.frequency.values,stopped:n.stopped}))));
    assert.equal(h.audio.voices.size,2);h.context.finish();assert.equal(h.audio.voices.size,0);h.audio.dispose();
  }
  assert.equal(new Set(signatures).size,signatures.length);
});

test('rapid volleys are rate limited and concurrent voices remain capped',()=>{
  const h=harness();h.audio.unlock();for(let i=0;i<100;i++)h.audio.play('shot',attack('stormcaller','arcane'));assert.equal(h.audio.voices.size,2);
  for(let i=0;i<100;i++){h.advance(70);h.audio.play('shot',attack('stormcaller','arcane'));assert.ok(h.audio.voices.size<=h.audio.maxVoices);}
  assert.ok(h.audio.recent.length<=h.audio.maxEventsPerSecond);h.context.finish();assert.equal(h.audio.voices.size,0);h.audio.dispose();
});

test('hidden hit/death and damage ticks cannot leak enemies through audio',()=>{
  const h=harness();h.audio.unlock();h.audio.play('death',{visible:false});h.audio.play('hit',{visible:false,directHit:true,damage:10});h.audio.play('hit',{directHit:false,damage:10});h.audio.play('hit',{directHit:true,damage:0});assert.equal(h.audio.voices.size,0);
  h.audio.play('hit',{directHit:true,damage:10,visible:true});assert.equal(h.audio.voices.size,1);h.audio.dispose();
});

test('build, impact and death use distinct envelopes and mute stops current and scheduled voices',()=>{
  const h=harness();h.audio.unlock();h.audio.play('place');h.advance(200);h.audio.play('impact',attack('frostwarden','frost'));h.advance(200);h.audio.play('death',{enemy:{boss:true}});h.advance(200);h.audio.play('combine');
  assert.ok(h.audio.voices.size>=9);h.audio.muted=true;
  for(const voice of h.audio.voices){assert.ok(voice.gain.gain.values.some(v=>v[0]==='cancel'));assert.equal(voice.stopped,undefined);assert.ok(voice.source.stopped<=.012);}
  const before=h.context.nodes.length;h.audio.play('won');assert.equal(h.context.nodes.length,before);h.context.finish();assert.equal(h.audio.voices.size,0);
  h.audio.dispose();assert.equal(h.context.closed,true);h.audio.unlock();assert.equal(h.created(),1);
});
