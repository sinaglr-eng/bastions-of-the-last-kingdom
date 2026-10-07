import {attackVisualKind} from '../render/combat-effects.js';

const INTERVALS={attack:.065,impact:.09,hit:.10,death:.12,build:.045,magic:.12,ui:.07};
const soundKind=payload=>attackVisualKind(payload.source?.family||payload.tower?.family,payload.stats||{type:payload.type});
export class AudioManager{
  constructor(muted=false,{contextFactory=null,now=()=>globalThis.performance?.now?.()??Date.now(),random=Math.random,voiceRandom=Math.random,selectionCatalogue={},fetchAudio=globalThis.fetch?.bind(globalThis)}={}){
    this._muted=!!muted;this.context=null;this.contextFactory=contextFactory;this.now=now;this.random=random;
    this.channels={Music:.1,Ambience:.12,Attacks:.085,Impacts:.07,Magic:.075,UI:.12,Boss:.12,Victory:.14,Defeat:.12,Voices:.08};
    this.last=new Map();this.recent=[];this.voices=new Set();this.maxVoices=28;this.maxEventsPerSecond=16;this.noiseBuffer=null;this.disposed=false;
    this.voiceRandom=voiceRandom;this.fetchAudio=fetchAudio;this.selectionCatalogue=new Map();this.audioBuffers=new Map();this.audioLoads=new Set();
    this.selectionVoice=null;this.selectionRequest=0;this.selectionKey=null;this.craftVoiceKeys=new WeakMap();this.catalogueRequest=0;this.resumePromise=null;this.setSelectionCatalogue(selectionCatalogue);
  }
  get muted(){return this._muted;}
  set muted(value){
    this._muted=!!value;
    if(this._muted)this.cancelSelectionVoice();
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
    // Resume inside the accepted pointer/keyboard gesture, before fetching or
    // decoding. Safari can report an interrupted context after backgrounding.
    if(this.context&&['suspended','interrupted'].includes(this.context.state)){
      try{this.resumePromise=Promise.resolve(this.context.resume()).then(()=>true,()=>false);}catch{this.resumePromise=Promise.resolve(false);}
    }
  }
  // Only real recorded assets enter this boundary. Display names and ranks do
  // not choose a voice: each stable family ID owns exactly two A/B recordings.
  setSelectionCatalogue(catalogue={}){
    if(this.disposed)return false;
    if(!catalogue||typeof catalogue!=='object'||Array.isArray(catalogue))throw new TypeError('Selection catalogue must map family IDs to two clips.');
    const next=new Map();
    for(const [family,clips] of Object.entries(catalogue)){
      if(!Array.isArray(clips)||clips.length!==2)throw new TypeError(`Selection family ${family} requires two A/B clips.`);
      const pair=clips.map((clip,index)=>{
        const url=typeof clip==='string'?clip:clip?.url;
        if(typeof url!=='string'||!url.trim())throw new TypeError(`Selection family ${family} has a clip without an asset URL.`);
        return {id:typeof clip?.id==='string'?clip.id:`${family}_${index===0?'a':'b'}`,url};
      });
      if(pair[0].url===pair[1].url||pair[0].id===pair[1].id)throw new TypeError(`Selection family ${family} requires two distinct clips.`);
      next.set(family,pair);
    }
    this.catalogueRequest++;this.cancelSelectionVoice();this.selectionCatalogue=next;return next.size;
  }
  async loadSelectionCatalogue(url){
    if(this.disposed||!this.fetchAudio)return false;
    const request=++this.catalogueRequest,controller=new AbortController();this.audioLoads.add(controller);
    try{
      const response=await this.fetchAudio(String(url),{signal:controller.signal});
      if(!response?.ok||this.disposed||controller.signal.aborted||request!==this.catalogueRequest)return false;
      const raw=await response.json(),base=response.url||String(url),revision=new URL(base).searchParams.get('v');
      const catalogue=Object.fromEntries(Object.entries(raw).map(([family,clips])=>[family,clips.map(clip=>{
        const reference=typeof clip==='string'?{url:clip}:clip;
        if(typeof reference?.url!=='string'||!reference.url.trim())throw new TypeError('Selection clip has no asset URL.');
        const asset=new URL(reference.url,base);
        if(revision&&!asset.searchParams.has('v'))asset.searchParams.set('v',revision);
        return {...reference,url:asset.href};
      })]));
      if(this.disposed||controller.signal.aborted||request!==this.catalogueRequest)return false;
      return this.setSelectionCatalogue(catalogue);
    }catch{return false;}finally{this.audioLoads.delete(controller);}
  }
  cancelSelectionVoice(){
    this.selectionRequest++;this.selectionKey=null;
    const voice=this.selectionVoice;this.selectionVoice=null;
    if(!voice)return;
    try{voice.source.stop(this.context.currentTime);}catch{/* It may already have ended. */}
    voice.source.onended?.();voice.source.onended=null;
  }
  loadSelectionClip(clip){
    if(this.audioBuffers.has(clip.url))return this.audioBuffers.get(clip.url);
    if(this.disposed||!this.context||!this.fetchAudio)return Promise.resolve(null);
    const context=this.context,controller=new AbortController();this.audioLoads.add(controller);
    const pending=(async()=>{
      try{
        const response=await this.fetchAudio(clip.url,{signal:controller.signal});
        if(!response?.ok||this.disposed||controller.signal.aborted)return null;
        const bytes=await response.arrayBuffer();
        if(this.disposed||controller.signal.aborted)return null;
        // Support both Promise and callback forms of decodeAudioData.
        return await new Promise((resolve,reject)=>{const decoded=context.decodeAudioData(bytes,resolve,reject);decoded?.then?.(resolve,reject);});
      }catch{return null;}finally{this.audioLoads.delete(controller);}
    })();
    this.audioBuffers.set(clip.url,pending);
    void pending.then(buffer=>{if(!buffer&&this.audioBuffers.get(clip.url)===pending)this.audioBuffers.delete(clip.url);});
    return pending;
  }
  preloadSelectionClips(){
    // Preloading never creates or resumes an AudioContext outside a gesture.
    if(this.disposed||!this.context)return Promise.resolve([]);
    return Promise.all([...this.selectionCatalogue.values()].flat().map(clip=>this.loadSelectionClip(clip)));
  }
  async playSelectionVoice(payload={},kind='selection'){
    const tower=payload.tower;
    if(!tower?.family||!['draft','active'].includes(tower.state)){this.cancelSelectionVoice();return false;}
    const key=JSON.stringify([kind,payload.round??tower.round,tower.id,tower.family,tower.tier]);
    if(this.selectionKey===key)return false;
    this.cancelSelectionVoice();this.selectionKey=key;
    const pair=this.selectionCatalogue.get(tower.family),context=this.context;
    if(!pair||this.muted||this.disposed||!context)return false;
    const request=this.selectionRequest;
    // A fresh independent 50/50 choice; repeated B or A is allowed.
    const clip=pair[this.voiceRandom()<.5?0:1];
    try{
      const [buffer]=await Promise.all([this.loadSelectionClip(clip),this.resumePromise]);
      if(!buffer||this.muted||this.disposed||request!==this.selectionRequest||context!==this.context||context.state!=='running')return false;
      if(this.voices.size>=this.maxVoices)return false;
      const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;
      gain.gain.setValueAtTime(this.channels.Voices,context.currentTime);source.connect(gain);gain.connect(context.destination);
      const voice=this.register(source,gain);this.selectionVoice=voice;
      const ended=source.onended;source.onended=()=>{ended();if(this.selectionVoice===voice)this.selectionVoice=null;};
      source.start(context.currentTime);return true;
    }catch{
      if(request===this.selectionRequest)this.cancelSelectionVoice();
      return false;
    }
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
    source.onended=()=>{if(!this.voices.delete(voice))return;source.disconnect();gain.disconnect();nodes.forEach(node=>node.disconnect());};return voice;
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
    if(event==='defender-select')return this.playSelectionVoice(payload);
    if(['wave','won','lost','reroll','reserve','move'].includes(event))this.cancelSelectionVoice();
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
      if(event==='place')void this.playSelectionVoice(payload,'reveal');
      if(this.allow('build',INTERVALS.build)){this.noise(.07,'UI',event==='remove'?350:700,{gain:.6,type:'lowpass'});this.tone(event==='keep'?520:310,event==='keep' ? .20 : .08,'UI','triangle',event==='keep'?660:130,{gain:.6});}return;
    }
    if(event==='combine'||event==='upgrade'){
      if(event==='combine'){
        const tower=payload.tower;
        if(payload.crafted===true&&tower?.state==='active'&&tower.family!==payload.previousFamily){
          // The game verifies a successful family-changing advanced recipe.
          // Remember its result on the real tower so duplicate event delivery
          // cannot restart speech, even after another selection interrupts it.
          const key=JSON.stringify([payload.round??tower.round,tower.family,tower.tier,payload.previousFamily]);
          if(this.craftVoiceKeys.get(tower)!==key){this.craftVoiceKeys.set(tower,key);void this.playSelectionVoice(payload,'craft');}
        }else this.cancelSelectionVoice();
      }
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
    for(const controller of this.audioLoads)controller.abort();this.audioLoads.clear();this.audioBuffers.clear();this.selectionCatalogue.clear();
    for(const voice of [...this.voices]){voice.source.onended=null;voice.source.disconnect();voice.gain.disconnect();voice.nodes.forEach(node=>node.disconnect());}
    this.voices.clear();this.last.clear();this.recent=[];this.noiseBuffer=null;this.disposed=true;
    try{this.context?.close?.()?.catch?.(()=>{});}catch{/* Closing a closed context is harmless. */}
  }
}
