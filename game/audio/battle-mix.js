import {CONTACT_OFFSETS,CONTACT_SLICE_SECONDS,directContact,launchOrnament,statusAccent,weaponPitch} from './contact-cues.js';
import {factionWeaponVisual} from '../render/faction-attack-visuals.js';

const contactBank={url:'assets/audio/combat-effects-current/contact-atlas-1.wav'};
const channelMotions=new Set(['flamethrower-channel','dragon-breath','forge-channel']);
const launchSeconds={sword:.14,spear:.14,arrow:.14,heavy_bolt:.21,hammer:.175,cannon:.31,mortar:.26,musket:.15,war_drum:.28,ent_slam:.28,holy:.24,electric_arc:.15,stone:.23,axe:.16};
const gates={shot:.065,contact:.095,ability:.18,ornament:.22,continuous:.11};

export class BattleMix{
  constructor(audio){
    this.audio=audio;
    this.tails=new Map();
    this.onsets=new WeakMap();
  }
  clear(){this.tails.clear();}
  allow(group,name,important=false){
    const audio=this.audio;
    // Leave room for rare proc and boss feedback even during a large volley.
    if(!important&&(audio.voices.size>=audio.maxVoices-4||audio.recent.length>=audio.maxEventsPerSecond-3&&audio.now()/1000-audio.recent[0]<1))return false;
    return audio.allow(group+':'+name,gates[group]);
  }
  async buffer(clip){
    const audio=this.audio,generation=audio.attackGeneration,requested=audio.now();
    if(!clip||audio.context?.state!=='running'||audio.muted||audio.gameState?.paused||audio.disposed)return null;
    if(requested-(audio.effectFailures.get(clip.url)??-Infinity)<5000)return null;
    const buffer=await audio.loadSelectionClip(clip);
    if(!buffer){audio.effectFailures.set(clip.url,audio.now());return null;}
    return generation===audio.attackGeneration&&audio.now()-requested<=250&&!audio.gameState?.paused&&!audio.muted&&!audio.disposed&&audio.voices.size<audio.maxVoices&&audio.context?.state==='running'?buffer:null;
  }
  recordOnset(buffer){
    if(this.onsets.has(buffer))return this.onsets.get(buffer);
    const pcm=buffer.getChannelData?.(0),end=Math.min(pcm?.length||0,Math.floor(.28*(buffer.sampleRate||0)));
    // Ignore MP3 priming silence, retaining 4 ms of pre-roll on the real attack.
    let sample=0;while(sample<end&&Math.abs(pcm[sample])<.002)sample++;
    const offset=sample<end?Math.max(0,sample/buffer.sampleRate-.004):0;
    this.onsets.set(buffer,offset);return offset;
  }
  async oneShot(name,{recorded=false,group='contact',important=false,rate=1,gain=1,channel='Impacts',duration=CONTACT_SLICE_SECONDS}={}){
    const audio=this.audio,clip=recorded?audio.recordedEffects.get(name):contactBank;
    if(!clip||(!recorded&&!CONTACT_OFFSETS.has(name))||!this.allow(group,name,important))return false;
    const buffer=await this.buffer(clip);if(!buffer||audio.voices.size>=audio.maxVoices)return false;
    const c=audio.context,now=c.currentTime,source=c.createBufferSource(),level=c.createGain();
    const offset=recorded?this.recordOnset(buffer):CONTACT_OFFSETS.get(name);
    const length=Math.min(duration,buffer.duration-offset);
    if(!(length>0))return false;
    const seconds=length/rate,volume=audio.channels[channel]*(clip.gain||1)*gain;
    source.buffer=buffer;source.playbackRate.setValueAtTime(rate,now);
    level.gain.setValueAtTime(volume,now);
    if(recorded){level.gain.setValueAtTime(volume,now+seconds*.70);level.gain.linearRampToValueAtTime(.0001,now+seconds);}
    source.connect(level);level.connect(audio.effectOutput('sounds'));audio.register(source,level);
    source.start(now,offset,length);return true;
  }
  // The simulation keeps this sample alive only while the emitter is active.
  // One shared loop of each timbre avoids phase cancellation between towers.
  async sustain(name,hold,rate){
    const audio=this.audio,c=audio.context,stamp=c.currentTime;
    const row=this.tails.get(name);
    if(row&&row.generation===audio.attackGeneration&&(row.pending||row.until>stamp)){
      if(row.until-stamp>hold-.045)return;
      row.until=stamp+hold;if(row.voice)this.extend(row,stamp);return;
    }
    if(!this.allow('continuous',name))return;
    const clip=audio.recordedEffects.get(name);if(!clip)return;
    const active={generation:audio.attackGeneration,pending:true,until:stamp+hold,voice:null};
    this.tails.set(name,active);
    const buffer=await this.buffer(clip);
    if(this.tails.get(name)!==active)return;
    if(!buffer||audio.voices.size>=audio.maxVoices||active.until<=c.currentTime){this.tails.delete(name);return;}
    const source=c.createBufferSource(),gain=c.createGain(),offset=this.recordOnset(buffer),now=c.currentTime;
    source.buffer=buffer;source.loop=true;
    source.loopStart=offset+(buffer.duration-offset)*.2;source.loopEnd=offset+(buffer.duration-offset)*.74;
    source.playbackRate.setValueAtTime(rate,now);source.connect(gain);gain.connect(audio.effectOutput('sounds'));
    active.volume=audio.channels.Attacks*(clip.gain||1)*.74;
    active.voice=audio.register(source,gain);active.pending=false;
    const dispose=source.onended;source.onended=()=>{if(this.tails.get(name)===active)this.tails.delete(name);dispose();};
    source.start(now,offset);this.extend(active,now,true);
    return true;
  }
  extend(row,now,start=false){
    const {source,gain}=row.voice,level=gain.gain;
    level.cancelScheduledValues(now);level.setValueAtTime(start?.0001:row.volume,now);
    if(start)level.linearRampToValueAtTime(row.volume,now+.012);
    level.setValueAtTime(row.volume,Math.max(now+.012,row.until-.045));
    level.linearRampToValueAtTime(.0001,row.until);source.stop(row.until+.004);
  }
  play(event,p){
    const audio=this.audio,source=p.source||p.tower;
    if(event==='recover'&&p.amount>0)return this.oneShot('holy',{group:'ability',important:true,rate:.82,gain:.88});
    if(!source?.family||!['shot','hit','impact','damage-trace','chain','aura-attack','burn-proc'].includes(event))return;
    if(event==='hit')return true; // damage-trace carries the authoritative outcome.
    const family=source.family,row=audio.recordedDefenders.get(family);
    const cue=row?.cues?.find(c=>c.ranks.includes(source.tier))||factionWeaponVisual(family);
    if(!cue)return;
    if(event==='shot'){
      if(p.firstPrimary===false)return true;
      const rate=weaponPitch(family,source.tier,p.stats?.listedDamage??p.stats?.damage);
      if(cue.motion==='gatling-shot'&&cue.shot){
        const magazine=p.stats?.weaponCycle?.magazine;
        if(magazine&&p.releaseCount%magazine===1)void this.oneShot('valve',{group:'ornament',channel:'Attacks',gain:.65});
        return this.sustain(cue.shot,Math.min(.22,p.stats?.weaponCycle?.fixedInterval||.16),rate);
      }
      const accent=launchOrnament(family);if(accent)void this.oneShot(accent,{group:'ornament',rate,gain:.44});
      if(family==='frostwarden')return this.oneShot('oak',{channel:'Attacks',group:'shot',rate:1.12});
      if(family==='ladyclaire')return this.oneShot('holy',{group:'shot',channel:'Attacks',rate:1.15,gain:.84});
      if(family==='phoenix'||family==='thunderheart'||family==='el_dragon_keeper')return this.oneShot('ember',{group:'shot',channel:'Attacks',rate,gain:1.2});
      if(!cue.shot)return;
      return this.oneShot(cue.shot,{recorded:true,group:'shot',channel:'Attacks',rate,duration:launchSeconds[cue.shot]||.18});
    }
    if(event==='aura-attack'){
      if(channelMotions.has(cue.motion)&&p.stats?.continuousAttack)return this.sustain('fire_breath',.19,weaponPitch(family,source.tier));
      return this.oneShot('ember',{group:'ability',gain:.76});
    }
    if(event==='damage-trace'){
      if(p.presentationAbility==='fire-aura'&&p.effectiveDamage>0)return this.oneShot('ember',{group:'ornament',gain:.54});
      if(p.presentationAbility==='heat'&&p.effectiveDamage>0)return this.oneShot('steam',{group:'ability',gain:.55});
      let name=directContact(cue,p);
      if(name==='breach'){
        void this.oneShot('breach',{group:'ability',important:true,gain:.74});
        name=directContact(cue,{...p,immunityMultiplier:1});
      }
      if(p.critical&&p.effectiveDamage>0)void this.oneShot('critical',{group:'ability',important:true,gain:.82});
      return name?this.oneShot(name,{group:'contact',important:!!p.blockReason||!!p.enemy?.boss,rate:weaponPitch(family,source.tier),gain:name==='holy'?1.2:1}):true;
    }
    if(event==='impact'){
      if(p.execution&&p.result?.effectiveDamage>0)return this.oneShot('execute',{group:'ability',important:true,gain:1.24});
      if(p.charged&&p.result?.effectiveDamage>0)void this.oneShot('charge',{group:'ability',important:true,gain:.75});
      else if(p.skyHunt&&p.result?.effectiveDamage>0)void this.oneShot('wing',{group:'ornament',gain:.5});
      const accent=statusAccent(p.appliedStatuses);
      if(accent)return this.oneShot(accent,{group:'ability',important:true,gain:.85});
      return true;
    }
    if(event==='chain'){
      if(!p.to||p.visible===false)return true;
      const name=p.abilityId==='spark'?'spark':p.effect==='lightning'?'storm':p.effect==='frost'?'frost':'rebound';
      return this.oneShot(name,{group:'ability',important:true,gain:.62});
    }
    return p.amount>0?this.oneShot('ember',{group:'ability',important:true}):true;
  }
}
