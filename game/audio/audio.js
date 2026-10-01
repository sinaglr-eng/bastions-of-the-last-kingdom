import {attackVisualKind} from '../render/combat-effects.js';

const INTERVALS={attack:.065,impact:.09,hit:.10,death:.12,build:.045,magic:.12,ui:.07};
const soundKind=payload=>attackVisualKind(payload.source?.family||payload.tower?.family,payload.stats||{type:payload.type});
export class AudioManager{
  constructor(muted=false,{contextFactory=null,now=()=>globalThis.performance?.now?.()??Date.now(),random=Math.random}={}){
    this._muted=!!muted;this.context=null;this.contextFactory=contextFactory;this.now=now;this.random=random;
    this.channels={Music:.1,Ambience:.12,Attacks:.085,Impacts:.07,Magic:.075,UI:.12,Boss:.12,Victory:.14,Defeat:.12,Voices:.08};
    this.last=new Map();this.recent=[];this.voices=new Set();this.maxVoices=28;this.maxEventsPerSecond=16;this.noiseBuffer=null;this.disposed=false;
  }
  get muted(){return this._muted;}
  set muted(value){
    this._muted=!!value;
    if(this._muted&&this.context)for(const voice of [...this.voices]){
      voice.gain.gain.cancelScheduledValues(this.context.currentTime);
      voice.gain.gain.setValueAtTime(.0001,this.context.currentTime);
      try{voice.source.stop(this.context.currentTime+.012);}catch{/* A source may already have ended. */}
    }
  }
  unlock(){
    if(this.disposed||this.muted)return;
    if(!this.context){
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext||globalThis.window?.AudioContext||globalThis.window?.webkitAudioContext;
      try{this.context=this.contextFactory?this.contextFactory():(Context?new Context():null);}catch{return;}
    }
    if(this.context?.state==='suspended')this.context.resume()?.catch?.(()=>{});
  }
  allow(key,interval){
    if(this.muted||this.disposed||!this.context)return false;
    const now=this.now()/1000,previous=this.last.get(key)??-Infinity;
    if(now-previous<interval)return false;
    this.recent=this.recent.filter(time=>now-time<1);
    if(this.recent.length>=this.maxEventsPerSecond||this.voices.size>=this.maxVoices)return false;
    this.last.set(key,now);this.recent.push(now);return true;
  }
  register(source,gain,nodes=[]){
    const voice={source,gain,nodes};this.voices.add(voice);
    source.onended=()=>{source.disconnect();gain.disconnect();nodes.forEach(node=>node.disconnect());this.voices.delete(voice);};return voice;
  }
  tone(freq,duration=.12,channel='UI',shape='sine',end=null,{delay=0,gain=.8}={}){
    if(this.muted||this.disposed||!this.context||this.voices.size>=this.maxVoices)return;
    const c=this.context,start=c.currentTime+delay,osc=c.createOscillator(),envelope=c.createGain();
    osc.type=shape;osc.frequency.setValueAtTime(Math.max(20,freq),start);
    if(end)osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.linearRampToValueAtTime((this.channels[channel]||.08)*gain,start+.006);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(envelope);envelope.connect(c.destination);this.register(osc,envelope);osc.start(start);osc.stop(start+duration+.012);
  }
  noise(duration=.1,channel='Impacts',frequency=800,{delay=0,gain=.8,type='bandpass'}={}){
    if(this.muted||this.disposed||!this.context||this.voices.size>=this.maxVoices)return;
    const c=this.context;
    if(!this.noiseBuffer){this.noiseBuffer=c.createBuffer(1,c.sampleRate,c.sampleRate);const samples=this.noiseBuffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=this.random()*2-1;}
    const start=c.currentTime+delay,source=c.createBufferSource(),filter=c.createBiquadFilter(),envelope=c.createGain();
    source.buffer=this.noiseBuffer;filter.type=type;filter.frequency.setValueAtTime(frequency,start);filter.Q.setValueAtTime(.7,start);
    envelope.gain.setValueAtTime(.0001,start);envelope.gain.linearRampToValueAtTime((this.channels[channel]||.08)*gain,start+.004);envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(filter);filter.connect(envelope);envelope.connect(c.destination);this.register(source,envelope,[filter]);source.start(start);source.stop(start+duration+.012);
  }
  attack(kind){
    if(kind==='roots'){this.noise(.16,'Attacks',480,{gain:.9,type:'lowpass'});this.tone(170,.13,'Magic','triangle',78,{gain:.55});}
    else if(kind==='flame'){this.noise(.31,'Attacks',750,{gain:1.15,type:'lowpass'});this.tone(78,.30,'Attacks','sawtooth',43,{gain:.26});}
    else if(kind==='lightning'){this.noise(.045,'Magic',3600,{gain:.75,type:'highpass'});this.tone(1450,.11,'Magic','sawtooth',160,{gain:.3});}
    else if(kind==='melee'){this.noise(.095,'Attacks',1900,{gain:.7});this.tone(190,.09,'Attacks','triangle',82,{gain:.4});}
    else if(kind==='siege'){this.noise(.15,'Attacks',340,{gain:1.05,type:'lowpass'});this.tone(100,.20,'Attacks','triangle',47,{gain:.7});}
    else if(kind==='holy'){this.tone(660,.18,'Magic','sine',880,{gain:.6});this.tone(990,.21,'Magic','sine',null,{gain:.28});}
    else if(kind==='frost'){this.noise(.07,'Magic',4200,{gain:.4,type:'highpass'});this.tone(1180,.18,'Magic','sine',1560,{gain:.4});}
    else if(kind==='arcane'){this.tone(350,.16,'Magic','triangle',1150,{gain:.6});this.tone(700,.12,'Magic','sine',400,{gain:.28});}
    else{this.noise(.035,'Attacks',1200,{gain:.65});this.tone(210,.055,'Attacks','triangle',90,{gain:.5});}
  }
  impact(kind){
    if(kind==='roots'){this.noise(.19,'Impacts',260,{gain:1,type:'lowpass'});this.tone(95,.12,'Impacts','triangle',42,{gain:.4});}
    else if(kind==='flame'||kind==='siege'){this.noise(.21,'Impacts',kind==='flame'?850:420,{gain:1.25,type:'lowpass'});this.tone(75,.21,'Impacts','sine',35,{gain:.65});}
    else if(kind==='frost'){this.noise(.12,'Impacts',4000,{gain:.7,type:'highpass'});this.tone(1600,.13,'Magic','sine',760,{gain:.23});}
    else if(kind==='holy'){this.tone(1046,.16,'Magic','sine',null,{gain:.42});this.tone(1568,.17,'Magic','sine',null,{gain:.18});}
    else if(kind==='lightning'){this.noise(.075,'Impacts',3300,{gain:.75,type:'highpass'});this.tone(290,.08,'Impacts','sawtooth',80,{gain:.25});}
    else if(kind==='arcane'){this.noise(.08,'Impacts',1500,{gain:.6});this.tone(520,.13,'Magic','triangle',130,{gain:.4});}
    else{this.noise(.065,'Impacts',1200,{gain:.75});this.tone(140,.08,'Impacts','triangle',68,{gain:.35});}
  }
  play(event,payload={}){
    if(this.muted||this.disposed||!this.context||payload.visible===false)return;
    if(event==='shot'||event==='aura-attack'){
      const kind=soundKind(payload);if(this.allow('attack:'+kind,INTERVALS.attack))this.attack(kind);return;
    }
    if(event==='impact'){if(this.allow('impact',INTERVALS.impact))this.impact(soundKind(payload));return;}
    if(event==='hit'){
      // Damage-over-time ticks must not generate a continuous hit-sound storm.
      if(payload.directHit&&payload.damage>0&&this.allow('hit',INTERVALS.hit))this.noise(.04,'Impacts',500,{gain:.24,type:'lowpass'});return;
    }
    if(event==='death'){
      if(this.allow('death',INTERVALS.death)){this.noise(payload.enemy?.boss ? .42 : .20,'Voices',190,{gain:.8,type:'lowpass'});this.tone(payload.enemy?.boss?95:150,.24,'Voices','triangle',45,{gain:.45});}return;
    }
    if(['place','keep','remove'].includes(event)){
      if(this.allow('build',INTERVALS.build)){this.noise(.07,'UI',event==='remove'?350:700,{gain:.6,type:'lowpass'});this.tone(event==='keep'?520:310,event==='keep' ? .20 : .08,'UI','triangle',event==='keep'?660:130,{gain:.6});}return;
    }
    if(event==='combine'||event==='upgrade'){
      if(this.allow('combine',INTERVALS.magic)){[440,554,659,880].forEach((freq,i)=>this.tone(freq,.32,'Magic','sine',null,{delay:i*.065,gain:.7}));}return;
    }
    if(event==='wave'&&this.allow('wave',1))this.tone(110,.65,'Boss','triangle',82,{gain:.7});
    if(event==='leak'&&this.allow('leak',.12))this.tone(90,.20,'Impacts','sawtooth',45,{gain:.5});
    if(event==='reward'&&this.allow('reward',.5))this.tone(660,.30,'Victory','sine',null,{gain:.6});
    if(event==='won'&&this.allow('won',2))[440,554,659,880,1108].forEach((freq,i)=>this.tone(freq,.45,'Victory','sine',null,{delay:i*.13,gain:.7}));
    if(event==='lost'&&this.allow('lost',2))this.tone(160,.9,'Defeat','triangle',55,{gain:.65});
  }
  dispose(){
    if(this.disposed)return;this.muted=true;
    for(const voice of [...this.voices]){voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();voice.nodes.forEach(node=>node.disconnect());}
    this.voices.clear();this.last.clear();this.recent=[];this.noiseBuffer=null;this.context?.close?.();this.disposed=true;
  }
}
