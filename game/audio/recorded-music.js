const phaseFor=phase=>phase==='combat'?'battle':phase==='won'?'victory':['build','select','ready','reward'].includes(phase)?'build':null;
const decoded=async(context,bytes)=>new Promise((resolve,reject)=>{const promise=context.decodeAudioData(bytes,resolve,reject);promise?.then?.(resolve,reject);});

// A separate transport keeps 96-second music buffers bounded and independent
// from short attack/speech buffers, battle speed, combat RNG and event budgets.
export class RecordedMusic {
  constructor({getContext,fetchAudio,random=Math.random,now=()=>performance.now(),volume=()=>.1,setTimer=setTimeout,clearTimer=clearTimeout}={}){
    this.getContext=getContext;this.fetchAudio=fetchAudio;this.random=random;this.now=now;this.volume=volume;this.setTimer=setTimer;this.clearTimer=clearTimer;
    this.tracks=[];this.cache=new Map();this.loads=new Map();this.failures=new Map();this.voices=new Set();this.current=null;this.master=null;
    this.phase=null;this.paused=false;this.muted=false;this.ducked=false;this.target=null;this.saved=null;this.request=0;this.pending=null;this.timer=null;this.victoryFinished=false;this.disposed=false;
    this.crossfade=1.5;this.duckGain=.32;
  }
  configure(tracks,policy={}){
    this.stopAll();this.request++;this.tracks=tracks;this.target=null;this.saved=null;this.victoryFinished=false;
    this.crossfade=Math.max(.05,Math.min(2,policy.crossfadeSeconds||1.5));this.duckGain=Math.max(.1,Math.min(1,policy.duckGain||.32));
    void this.ensure();
  }
  sync(game={}){
    if(this.disposed)return;
    const next=phaseFor(game.phase),paused=!!game.paused&&!['won','lost'].includes(game.phase);
    if(next!==this.phase){this.phase=next;this.target=null;this.saved=null;this.victoryFinished=false;this.request++;this.clearLoop();}
    if(paused!==this.paused){this.paused=paused;this.request++;if(paused)this.suspend();}
    if(!next){this.stopAll(.3);this.target=null;return;}
    void this.ensure();
  }
  setMuted(value){if(this.muted===!!value)return;this.muted=!!value;this.request++;if(this.muted)this.suspend();else void this.ensure();}
  duck(value){this.ducked=!!value;if(!this.master)return;const context=this.getContext(),param=this.master.gain,t=context.currentTime;param.cancelScheduledValues(t);param.setValueAtTime(param.value??this.volume(),t);param.linearRampToValueAtTime(this.volume()*(this.ducked?this.duckGain:1),t+.12);}
  contextReady(){const c=this.getContext();return !!c&&c.state==='running'&&!this.paused&&!this.muted&&!this.disposed;}
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
    if(!this.contextReady()||!this.phase||!this.tracks.length||(this.phase==='victory'&&this.victoryFinished))return false;
    if(!this.target){const group=this.tracks.filter(track=>track.phase===this.phase);if(!group.length)return false;
      this.target=group[Math.min(group.length-1,Math.max(0,Math.floor(this.random()*group.length)))];}
    const target=this.target;
    if(this.current?.track.id===target.id)return true;
    if(this.pending?.track===target)return this.pending.promise;
    if(this.now()-(this.failures.get(target.url)??-Infinity)<5000)return false;
    const request=this.request;
    // Cancel stale phase downloads instead of accumulating whole soundtracks.
    for(const [url,load]of this.loads)if(url!==target.url)load.controller.abort();
    const promise=(async()=>{
      const buffer=await this.buffer(target);
      if(!buffer){if(request===this.request&&this.target===target&&this.contextReady())this.failures.set(target.url,this.now());return false;}
      if(request!==this.request||this.target!==target||!this.contextReady())return false;
      const offset=this.saved?.track.id===target.id?this.saved.offset:0;this.saved=null;
      this.start(target,buffer,offset);return true;
    })();this.pending={track:target,promise};
    try{return await promise;}finally{if(this.pending?.promise===promise)this.pending=null;}
  }
  clearLoop(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  ensureMaster(){
    if(this.master)return;const context=this.getContext();this.master=context.createGain();this.master.gain.setValueAtTime(this.volume()*(this.ducked?this.duckGain:1),context.currentTime);this.master.connect(context.destination);
  }
  start(track,buffer,offset=0){
    if(!this.contextReady())return;
    const context=this.getContext(),time=context.currentTime;this.ensureMaster();this.clearLoop();
    offset=Math.max(0,Math.min(offset,Math.max(0,buffer.duration-.02)));
    const previous=this.current;for(const old of [...this.voices])if(old!==previous)this.stopVoice(old);
    const source=context.createBufferSource(),gain=context.createGain(),remaining=buffer.duration-offset;
    source.buffer=buffer;source.loop=false;source.playbackRate.setValueAtTime(1,time);source.connect(gain);gain.connect(this.master);
    const voice={source,gain,track,buffer,offset,startTime:time,stopping:false};this.voices.add(voice);
    this.current=voice;
    const fade=Math.min(this.crossfade,Math.max(.02,remaining/3));
    gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(1,time+fade);
    if(previous)this.stopVoice(previous,fade);
    source.onended=()=>{
      this.clean(voice);
      if(this.current!==voice)return;
      this.current=null;
      if(!voice.stopping&&track.phase==='victory'){this.victoryFinished=true;this.clearLoop();}
      else if(!voice.stopping)void this.ensure();
    };
    source.start(time,offset);
    if(track.phase!=='victory'){
      // Overlap tail/head in transport; approved source bytes remain unchanged.
      this.timer=this.setTimer(()=>{
        this.timer=null;if(this.current!==voice||!this.contextReady()||this.target?.id!==track.id)return;
        this.start(track,buffer,0);
      },Math.max(20,(remaining-fade)*1000));this.timer?.unref?.();
    }
  }
  clean(voice){if(!this.voices.delete(voice))return;voice.source.disconnect();voice.gain.disconnect();voice.source.onended=null;}
  stopVoice(voice,fade=0){
    voice.stopping=true;const context=this.getContext(),time=context.currentTime;voice.gain.gain.cancelScheduledValues(time);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value??1,time);voice.gain.gain.linearRampToValueAtTime(0,time+fade);
    try{voice.source.stop(time+fade+.01);}catch{/* Natural ending may have occurred. */}
    if(!fade)this.clean(voice);
  }
  stopAll(fade=0){this.clearLoop();for(const voice of [...this.voices])this.stopVoice(voice,fade);this.current=null;}
  suspend(){
    if(this.current){const c=this.getContext(),v=this.current;this.saved={track:v.track,offset:Math.min(v.buffer.duration-.02,v.offset+Math.max(0,c.currentTime-v.startTime))};}
    this.stopAll();
  }
  reset(){this.request++;this.stopAll();this.phase=null;this.target=null;this.saved=null;this.victoryFinished=false;for(const load of this.loads.values())load.controller.abort();this.pending=null;}
  dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.cache.clear();this.failures.clear();for(const load of this.loads.values())load.controller.abort();this.loads.clear();this.master?.disconnect();this.master=null;}
}
