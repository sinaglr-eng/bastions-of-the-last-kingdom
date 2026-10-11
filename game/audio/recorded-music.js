const phaseFor=phase=>phase==='combat'?'battle':phase==='won'?'victory':['build','select','ready','reward'].includes(phase)?'build':null;
const decoded=async(context,bytes)=>new Promise((resolve,reject)=>{const promise=context.decodeAudioData(bytes,resolve,reject);promise?.then?.(resolve,reject);});

// A separate transport keeps 96-second music buffers bounded and independent
// from short attack/speech buffers, battle speed, combat RNG and event budgets.
export class RecordedMusic {
  constructor({getContext,fetchAudio,random=Math.random,now=()=>performance.now(),volume=()=>.18,celebrationVolume=()=>.025,setTimer=setTimeout,clearTimer=clearTimeout}={}){
    this.getContext=getContext;this.fetchAudio=fetchAudio;this.random=random;this.now=now;this.volume=volume;this.celebrationVolume=celebrationVolume;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.tracks=[];this.cache=new Map();this.loads=new Map();this.reviewLoads=new Map();this.failures=new Map();this.voices=new Set();this.current=null;this.master=null;
    this.phase=null;this.paused=false;this.muted=false;this.ducked=false;this.target=null;this.saved=null;this.request=0;this.pending=null;this.timer=null;this.victoryFinished=false;this.disposed=false;
    this.lastTracks=new Map();this.trackBags=new Map();this.completedWaves=new Set();this.celebration=null;this.celebrationTarget=null;this.celebrationKey=null;this.savedCelebration=null;this.celebrationRequest=0;this.celebrationPending=null;
    this.crossfade=1.5;this.duckGain=.32;
  }
  configure(tracks,policy={}){
    this.stopAll();this.stopCelebration();this.request++;this.celebrationRequest++;this.tracks=tracks;this.target=null;this.saved=null;this.celebrationTarget=null;
    this.crossfade=Math.max(.05,Math.min(2,policy.crossfadeSeconds||1.5));this.duckGain=Math.max(.1,Math.min(1,policy.duckGain||.32));
    void this.ensure();void this.ensureCelebration();
  }
  sync(game={}){
    if(this.disposed)return;
    const next=phaseFor(game.phase),paused=!!game.paused&&!['won','lost'].includes(game.phase);
    if(next!==this.phase){this.phase=next;this.target=null;this.saved=null;this.request++;this.clearLoop();}
    if(paused!==this.paused){this.paused=paused;this.request++;this.celebrationRequest++;if(paused)this.suspend();}
    if(next==='victory')this.onWaveComplete({round:game.round});
    if(!next||next==='victory'){this.stopAll(.3);this.target=null;if(!next)this.cancelCelebration();}
    this.cancelStaleLoads();void this.ensure();void this.ensureCelebration();
  }
  setMuted(value){if(this.muted===!!value)return;this.muted=!!value;this.request++;this.celebrationRequest++;if(this.muted)this.suspend();else{void this.ensure();void this.ensureCelebration();}}
  duck(value){this.ducked=!!value;if(!this.master)return;const context=this.getContext(),param=this.master.gain,t=context.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value??this.volume(),t);param.linearRampToValueAtTime(this.volume()*(this.ducked?this.duckGain:1),t+.12);}
  contextReady(){const c=this.getContext();return !!c&&c.state==='running'&&!this.paused&&!this.muted&&!this.disposed;}
  chooseTrack(){
    const group=this.tracks.filter(track=>track.phase===this.phase),last=this.lastTracks.get(this.phase);
    let bag=this.trackBags.get(this.phase)?.filter(id=>group.some(track=>track.id===id))||[];
    if(!bag.length)bag=group.map(track=>track.id);
    let candidates=group.filter(track=>bag.includes(track.id)&&(group.length===1||track.id!==last));
    if(!candidates.length){bag=group.map(track=>track.id);candidates=group.filter(track=>group.length===1||track.id!==last);}
    this.trackBags.set(this.phase,bag);
    return candidates[Math.min(candidates.length-1,Math.max(0,Math.floor(this.random()*candidates.length)))]||null;
  }
  cancelStaleLoads(){
    const wanted=new Set([this.target?.url,this.celebrationTarget?.url,...this.reviewLoads.keys()]);
    for(const [url,load]of this.loads)if(!wanted.has(url))load.controller.abort();
  }
  onWaveComplete({round}={}){
    if(this.disposed)return false;
    const key=Number.isSafeInteger(round)&&round>0?`wave:${round}`:'final';
    if(this.completedWaves.has(key))return false;
    this.completedWaves.add(key);this.cancelCelebration();this.celebrationKey=key;this.victoryFinished=false;
    this.celebrationTarget=this.tracks.find(track=>track.phase==='victory')||null;
    void this.ensureCelebration();return true;
  }
  cancelCelebration(){
    this.celebrationRequest++;this.stopCelebration();this.savedCelebration=null;this.celebrationTarget=null;this.celebrationKey=null;this.celebrationPending=null;
  }
  stopCelebration(){const voice=this.celebration;this.celebration=null;if(voice)this.stopVoice(voice);}
  async reviewBuffer(track){
    if(this.disposed)return null;
    // A silent sequential review shares the bounded cache, but owns its load
    // until it resolves. HUD/phase changes may cancel only transport-owned loads.
    const leases=this.reviewLoads.get(track.url)||new Set(),owner={};leases.add(owner);this.reviewLoads.set(track.url,leases);
    try{return await this.buffer(track);}finally{
      leases.delete(owner);if(!leases.size&&this.reviewLoads.get(track.url)===leases)this.reviewLoads.delete(track.url);
    }
  }
  async buffer(track){
    if(this.disposed)return null;
    if(this.cache.has(track.url)){const value=this.cache.get(track.url);this.cache.delete(track.url);this.cache.set(track.url,value);return value;}
    const existing=this.loads.get(track.url);
    if(existing&&!existing.controller.signal.aborted)return existing.promise;
    if(existing)this.loads.delete(track.url);
    if(!this.fetchAudio||!this.getContext())return null;
    const controller=new AbortController(),context=this.getContext();let load;
    const promise=(async()=>{
      try{const response=await this.fetchAudio(track.url,{signal:controller.signal});if(!response?.ok||controller.signal.aborted||this.disposed)return null;
        const value=await decoded(context,await response.arrayBuffer());if(controller.signal.aborted||this.disposed||!value||!(value.duration>0))return null;
        this.cache.set(track.url,value);while(this.cache.size>2)this.cache.delete(this.cache.keys().next().value);return value;
      }catch{return null;}finally{if(this.loads.get(track.url)===load)this.loads.delete(track.url);}
    })();load={controller,promise};this.loads.set(track.url,load);return promise;
  }
  async ensure(){
    if(!this.contextReady()||!this.phase||this.phase==='victory'||!this.tracks.length)return false;
    if(!this.target)this.target=this.chooseTrack();if(!this.target)return false;
    const target=this.target;
    if(this.current?.track.id===target.id)return true;
    if(this.pending?.track===target&&this.pending.request===this.request)return this.pending.promise;
    if(this.now()-(this.failures.get(target.url)??-Infinity)<5000)return false;
    const request=this.request;
    // Cancel stale phase downloads instead of accumulating whole soundtracks.
    this.cancelStaleLoads();
    const promise=(async()=>{
      const buffer=await this.buffer(target);
      if(!buffer){if(request===this.request&&this.target===target&&this.contextReady())this.failures.set(target.url,this.now());return false;}
      if(request!==this.request||this.target!==target||!this.contextReady())return false;
      const offset=this.saved?.track.id===target.id?this.saved.offset:0;this.saved=null;
      this.start(target,buffer,offset);return true;
    })();this.pending={track:target,request,promise};
    try{return await promise;}finally{if(this.pending?.promise===promise)this.pending=null;}
  }
  async ensureCelebration(){
    if(!this.contextReady()||!this.celebrationKey||this.victoryFinished||!this.tracks.length)return false;
    if(!this.celebrationTarget)this.celebrationTarget=this.tracks.find(track=>track.phase==='victory')||null;
    const target=this.celebrationTarget;if(!target)return false;
    if(this.celebration)return true;
    const request=this.celebrationRequest,key=this.celebrationKey;
    if(this.celebrationPending?.request===request)return this.celebrationPending.promise;
    if(this.now()-(this.failures.get(target.url)??-Infinity)<5000)return false;
    const promise=(async()=>{
      const buffer=await this.buffer(target);
      if(!buffer){if(request===this.celebrationRequest&&this.contextReady())this.failures.set(target.url,this.now());return false;}
      if(request!==this.celebrationRequest||key!==this.celebrationKey||!this.contextReady())return false;
      const offset=this.savedCelebration?.key===key?this.savedCelebration.offset:0;this.savedCelebration=null;
      this.startCelebration(target,buffer,offset,key);return true;
    })();this.celebrationPending={request,promise};
    try{return await promise;}finally{if(this.celebrationPending?.promise===promise)this.celebrationPending=null;}
  }
  clearLoop(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  ensureMaster(){
    if(this.master)return;const context=this.getContext();this.master=context.createGain();this.master.gain.setValueAtTime(this.volume()*(this.ducked?this.duckGain:1),context.currentTime);this.master.connect(context.destination);
  }
  start(track,buffer,offset=0){
    if(!this.contextReady())return;
    const context=this.getContext(),time=context.currentTime;this.ensureMaster();this.clearLoop();
    offset=Math.max(0,Math.min(offset,Math.max(0,buffer.duration-.02)));
    const previous=this.current;for(const old of [...this.voices])if(old!==previous&&old!==this.celebration)this.stopVoice(old);
    const source=context.createBufferSource(),gain=context.createGain(),remaining=buffer.duration-offset;
    source.buffer=buffer;source.loop=false;source.playbackRate.setValueAtTime(1,time);source.connect(gain);gain.connect(this.master);
    const voice={source,gain,track,buffer,offset,startTime:time,stopping:false};this.voices.add(voice);
    this.current=voice;
    this.lastTracks.set(track.phase,track.id);
    this.trackBags.set(track.phase,(this.trackBags.get(track.phase)||[]).filter(id=>id!==track.id));
    const fade=Math.min(this.crossfade,Math.max(.02,remaining/3));
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(1,time+fade);
    if(previous)this.stopVoice(previous,fade);
    source.onended=()=>{
      this.clean(voice);
      if(this.current!==voice)return;
      this.current=null;
      if(!voice.stopping){this.target=null;this.request++;void this.ensure();}
    };
    source.start(time,offset);
    // Select another approved phase track at the tail, rather than looping one.
    this.timer=this.setTimer(()=>{
      this.timer=null;if(this.current!==voice||!this.contextReady()||this.target?.id!==track.id)return;
      this.target=null;this.saved=null;this.request++;void this.ensure();
    },Math.max(20,(remaining-fade)*1000));this.timer?.unref?.();
  }
  startCelebration(track,buffer,offset,key){
    if(!this.contextReady())return;this.ensureMaster();this.stopCelebration();
    const context=this.getContext(),time=context.currentTime,source=context.createBufferSource(),gain=context.createGain();
    offset=Math.max(0,Math.min(offset,Math.max(0,buffer.duration-.02)));
    source.buffer=buffer;source.loop=false;source.playbackRate.setValueAtTime(1,time);source.connect(gain);gain.connect(this.master);
    const voice={source,gain,track,buffer,offset,startTime:time,key,stopping:false};this.voices.add(voice);this.celebration=voice;
    const level=this.celebrationVolume()/Math.max(.0001,this.volume());
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.12);
    source.onended=()=>{this.clean(voice);if(this.celebration!==voice)return;this.celebration=null;if(!voice.stopping)this.victoryFinished=true;};
    source.start(time,offset);
  }
  clean(voice){if(!this.voices.delete(voice))return;voice.source.disconnect();voice.gain.disconnect();voice.source.onended=null;}
  stopVoice(voice,fade=0){
    voice.stopping=true;const context=this.getContext(),time=context.currentTime;voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value??1,time);voice.gain.gain.linearRampToValueAtTime(0,time+fade);
    try{voice.source.stop(time+fade+.01);}catch{/* Natural ending may have occurred. */}
    if(!fade)this.clean(voice);
  }
  stopAll(fade=0){this.clearLoop();for(const voice of [...this.voices])if(voice!==this.celebration&&(!fade||!voice.stopping))this.stopVoice(voice,fade);this.current=null;}
  suspend(){
    const c=this.getContext();
    if(this.current){const v=this.current;this.saved={track:v.track,offset:Math.min(v.buffer.duration-.02,v.offset+Math.max(0,c.currentTime-v.startTime))};this.target=v.track;}
    if(this.celebration){const v=this.celebration;this.savedCelebration={key:v.key,offset:Math.min(v.buffer.duration-.02,v.offset+Math.max(0,c.currentTime-v.startTime))};}
    this.stopAll();this.stopCelebration();
  }
  reset(){this.request++;this.stopAll();this.cancelCelebration();this.phase=null;this.target=null;this.saved=null;this.victoryFinished=false;this.completedWaves.clear();this.lastTracks.clear();this.trackBags.clear();for(const load of this.loads.values())load.controller.abort();this.reviewLoads.clear();this.pending=null;}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.cache.clear();this.failures.clear();for(const load of this.loads.values())load.controller.abort();this.loads.clear();this.master?.disconnect();this.master=null;}
}
