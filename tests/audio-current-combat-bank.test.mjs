import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {AudioManager} from '../game/audio/audio.js';
import {recordedCatalogue,recordedAttackCue,RECORDED_ATTACK_TYPES} from '../game/audio/recorded-attacks.js';
import {recordedAudioBankReview} from '../game/audio/audio-assets.js';
import {CURRENT_ATTACK_CATALOGUE,CURRENT_ATTACK_REVIEW,CURRENT_ATTACK_REVISION} from '../game/audio/current-attack-assets.js';
import {CONTACT_NAMES,CONTACT_OFFSETS,CONTACT_SLICE_SECONDS,directContact} from '../game/audio/contact-cues.js';
import {buildCurrentCombatAudio,currentCombatBindings,NEW_COMBAT_EFFECT_IDS} from '../tools/build-current-combat-audio.mjs';
const read=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url))),raw=read('public/assets/audio/combat-effects-current/catalogue.json'),legacy=read('public/assets/audio/approved-20261011/catalogue.json');
const bankUrl='https://example.test/project/assets/audio/combat-effects-current/catalogue.json?v=test',bank=recordedCatalogue(raw,bankUrl),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const shot=(family,tier=1)=>({source:{family,tier,state:'active',x:10,z:10},visible:true});
class Param{constructor(){this.value=1;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(){}cancelScheduledValues(){}}
class AudioNode{constructor(kind){this.kind=kind;this.gain=new Param();this.playbackRate=new Param();this.frequency=new Param();this.Q=new Param();this.stops=[];}connect(to){this.connected=to;}disconnect(){this.disconnected=true;}start(){this.started=true;}stop(at){this.stops.push(at);}finish(){this.onended?.();}}
class Context{constructor(){this.state='running';this.currentTime=0;this.sampleRate=8;this.destination={};this.nodes=[];}node(kind){const n=new AudioNode(kind);this.nodes.push(n);return n;}createGain(){return this.node('gain');}createBufferSource(){return this.node('source');}createOscillator(){return this.node('oscillator');}createBiquadFilter(){return this.node('filter');}createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}decodeAudioData(bytes){return Promise.resolve({id:new Uint8Array(bytes)[0],duration:1,sampleRate:44100,numberOfChannels:1,length:44100});}close(){return Promise.resolve();}}
function harness({fetchAudio}={}){let time=0;const context=new Context(),ids=new Map([...bank.effects].map(([id,clip],i)=>[clip.url,i+1])),requests=[];const audio=new AudioManager(false,{now:()=>time,contextFactory:()=>context,fetchAudio:fetchAudio||(async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>new Uint8Array([ids.get(url)]).buffer};})});audio.context=context;audio.recordedEffects=new Map(bank.effects);audio.recordedDefenders=new Map(bank.defenders);audio.syncGameState({phase:'combat'});return {audio,context,requests,advance:n=>time+=n,played:()=>context.nodes.filter(n=>n.started&&n.buffer),idFor:id=>ids.get(bank.effects.get(id).url)};}

test('the current combat bank retains every original recording and adds fifteen exact selected source copies',()=>{
  assert.equal(RECORDED_ATTACK_TYPES.size,15);assert.equal(raw.effects.length,30);assert.equal(raw.music.length,6);assert.deepEqual(raw.effects.slice(0,15),legacy.effects);assert.deepEqual(raw.music,legacy.music);assert.equal(raw.revision,CURRENT_ATTACK_REVISION);assert.ok(CURRENT_ATTACK_CATALOGUE.endsWith(CURRENT_ATTACK_REVISION));
  const selected=read('output/implementation/combat-effects-current/audio/selected-clips.json');assert.deepEqual(new Set(selected.clips.map(c=>c.id)),new Set(NEW_COMBAT_EFFECT_IDS));
  for(const clip of selected.clips){const entry=raw.effects.find(c=>c.id===clip.id),bytes=readFileSync(new URL('../public/assets/audio/combat-effects-current/'+entry.url,import.meta.url));assert.equal(sha(bytes),clip.sha256);assert.equal(bytes.length,clip.bytes);assert.equal(entry.gain,clip.gain);assert.equal(entry.prompt,clip.prompt);assert.equal(entry.approved,false);assert.equal(entry.status,'generated');assert.ok(entry.gain>0&&entry.gain<=16);}
  assert.equal(raw.effects.find(c=>c.id==='war_drum').gain,16,'The quiet measured drum is mixed without rewriting its source MP3');
});

test('all 258 live faction/rank weapon contracts have declared cues and native source URLs resolve under every deployment base',()=>{
  assert.deepEqual(raw.defenders,currentCombatBindings());assert.equal(bank.defenders.size,136);assert.equal(raw.defenders.reduce((n,r)=>n+r.cues.length,0),256);
  for(const row of raw.defenders)for(const cue of row.cues)for(const tier of cue.ranks){assert.equal(recordedAttackCue('shot',shot(row.character_id,tier),bank.defenders),cue.shot);if(cue.impact)assert.ok(['cannon','shell','grenade'].includes(cue.kind));}
  for(const [family,id]of Object.entries({dw_musketeer:'musket',dw_repeatercrew:'gatling',dw_grapeshotcart:'mortar',dw_grenadier:'grenade_throw',dw_boarstandard:'war_drum',el_elven_king:'ent_slam',el_spark_adept:'storm_spear',dw_griffinhandler:'claw',mechanicalgolem:'cannon',stormcitadel:'arrow',kingdomprotector:'hammer'}))assert.equal(recordedAttackCue('shot',shot(family),bank.defenders),id,family);
  assert.equal(recordedAttackCue('shot',shot('soldier',1),bank.defenders),'spear');assert.equal(recordedAttackCue('shot',shot('soldier',6),bank.defenders),'spear','All six active native Soldier models carry spears; the legacy geometric bank keeps its original rank switch');assert.equal(recordedAttackCue('shot',shot('soldier',99),bank.defenders),null);
  for(const base of ['https://example.test/assets/audio/','https://example.test/project/assets/audio/','file:///C:/portable/assets/audio/']){const current=recordedCatalogue(raw,base+'combat-effects-current/catalogue.json?v=current');for(const clip of [...current.effects.values(),...current.music]){assert.equal(new URL(clip.url).searchParams.get('v'),'current');assert.ok(new URL(clip.url).pathname.includes('/assets/audio/'));}}
});

test('current native release and artillery impact select distinct recordings with their intended channels and clip gain',async()=>{
  const h=harness();try{await h.audio.play('shot',shot('dw_musketeer'));assert.equal(h.played().at(-1).buffer.id,h.idFor('musket'));await h.audio.play('impact',shot('dw_cinderhowitzer'));assert.equal(h.played().at(-1).buffer.id,h.idFor('explosive_impact'));const impact=[...h.audio.voices].at(-1);assert.equal(impact.gain.gain.value,h.audio.channels.Impacts*bank.effects.get('explosive_impact').gain);
    await h.audio.play('shot',shot('dw_boarstandard'));const drum=[...h.audio.voices].at(-1);assert.equal(drum.gain.gain.value,h.audio.channels.Attacks*16);assert.equal(drum.gain.connected,h.audio.soundsMaster);h.audio.setCategoryVolume('sounds',0);assert.equal(h.audio.soundsMaster.gain.value,0);assert.equal(drum.gain.gain.value,h.audio.channels.Attacks*16);assert.equal(drum.source.playbackRate.value,1);
  }finally{h.audio.dispose();}
});

test('only positive visible real Fire Aura damage in the correct rank radius/channel can create bounded fire sound',async()=>{
  const h=harness(),source={family:'dw_cinderhowitzer',tier:1,state:'active',x:10,z:10},enemy={x:11,z:10},trace={source,enemy,effectiveDamage:1,directHit:false,visible:true,type:'magical'};try{
    assert.equal(recordedAttackCue('damage-trace',trace,bank.defenders),'fire_breath');
    for(const changes of [{effectiveDamage:0},{visible:false},{type:'physical'},{directHit:true},{source:{...source,state:'ruin'}},{source:{...source,attackPaused:true}},{source:{...source,disarmed:true}},{source:{...source,tier:6}},{enemy:{x:14,z:10}},{enemy:{...enemy,dead:true}}])assert.equal(recordedAttackCue('damage-trace',{...trace,...changes},bank.defenders),null);
    for(let i=0;i<30;i++)await h.audio.play('damage-trace',trace);assert.equal(h.played().length,1);h.advance(349);await h.audio.play('damage-trace',trace);assert.equal(h.played().length,1);h.advance(2);await h.audio.play('damage-trace',trace);assert.equal(h.played().length,2);
    h.audio.syncGameState({phase:'combat',paused:true});h.advance(400);await h.audio.play('damage-trace',trace);assert.equal(h.played().length,2);h.audio.syncGameState({phase:'reward'});await h.audio.play('damage-trace',trace);assert.equal(h.played().length,2);
    assert.equal(recordedAttackCue('damage-trace',{...trace,source:{family:'dw_grenadier',tier:1,state:'active',x:10,z:10}},bank.defenders),null,'An ordinary Burn DOT source has no Fire Aura permission');
  }finally{h.audio.dispose();}
});

test('native chain cues use actual owner/effect and muted, hidden, stale or paused new downloads remain silent',async()=>{
  assert.equal(recordedAttackCue('chain',{...shot('el_spark_adept'),effect:'lightning'},bank.defenders),'electric_arc');assert.equal(recordedAttackCue('chain',{...shot('archangel'),effect:'frost'},bank.defenders),'frost');assert.equal(recordedAttackCue('chain',{...shot('dw_musketeer'),effect:'lightning'},bank.defenders),null);
  for(const change of [h=>h.audio.syncGameState({phase:'combat',paused:true}),h=>h.audio.resetRun(),h=>{h.audio.muted=true;},h=>h.advance(251),h=>h.audio.dispose()]){let release;const gate=new Promise(resolve=>release=resolve),h=harness({fetchAudio:()=>gate});const playing=h.audio.play('shot',shot('dw_musketeer'));change(h);release({ok:true,arrayBuffer:async()=>new Uint8Array([1]).buffer});assert.equal(await playing,false);assert.equal(h.played().length,0);h.audio.dispose();}
});

test('explicit current bank review requires all thirty effects plus six music and leaves legacy defaults strict',async()=>{
  const buffer={duration:1,sampleRate:44100,numberOfChannels:1,length:44100},audio={recordedEffects:bank.effects,music:{tracks:bank.music,cache:new Map(),reviewBuffer:async()=>buffer},context:{state:'running'},preloadRecordedEffects:async()=>Array(30).fill(buffer)};
  const current=await recordedAudioBankReview(audio,CURRENT_ATTACK_REVIEW);assert.equal(current.status,'passed');assert.equal(current.expected,36);assert.equal(current.decoded,36);assert.equal(current.revision,CURRENT_ATTACK_REVISION);assert.equal((await recordedAudioBankReview(audio)).status,'failed');
  audio.recordedEffects=new Map([...bank.effects].slice(0,15));audio.preloadRecordedEffects=async()=>Array(15).fill(buffer);assert.equal((await recordedAudioBankReview(audio,CURRENT_ATTACK_REVIEW)).status,'failed');
  for(const options of [{revision:''},{expectedEffects:0},{expectedMusic:NaN}])await assert.rejects(()=>recordedAudioBankReview(audio,options),TypeError);
});

test('current catalogue rejects ambiguous rank cues, unknown effects and unsafe gains',()=>{
  for(const mutate of [x=>x.defenders[0].cues.push(x.defenders[0].cues[0]),x=>x.defenders[0].cues[0].ranks=[1,1],x=>x.defenders[0].cues[0].impact='missing',x=>x.effects.at(-1).gain=17,x=>x.effects.at(-1).gain=Infinity,x=>x.defenders.find(r=>r.cues.some(c=>c.fireAura)).cues[0].fireAura.radius=NaN]){const copy=structuredClone(raw);mutate(copy);assert.throws(()=>recordedCatalogue(copy,bankUrl));}
});

test('builder rejects an incomplete selection before replacing the existing output',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bastions-combat-audio-test-'));try{const target=path.join(directory,'public/assets/audio/combat-effects-current/catalogue.json'),selection=path.join(directory,'selection.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,'preserved');await fs.writeFile(selection,JSON.stringify({clips:[]}));await assert.rejects(()=>buildCurrentCombatAudio({workspace:directory,selectionFile:selection}),/fifteen selected identities/);assert.equal(await fs.readFile(target,'utf8'),'preserved');}finally{assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep+'bastions-combat-audio-test-'));await fs.rm(directory,{recursive:true,force:true});}
});

test('all current weapons have a contact, with independent damage, immunity and evasion outcomes',()=>{
  for(const row of raw.defenders)for(const cue of row.cues){
    for(const type of ['physical','magical','holy']){
      const result={type,directHit:true,effectiveDamage:15,visible:true};
      assert.ok(CONTACT_NAMES.includes(directContact(cue,result)),row.character_id);
      for(const [reason,expected] of [['shield','block'],['shell','block'],['evasion','dodge'],['magic-immunity','ward'],['physical-immunity','ward'],['dead',null],['invalid',null]]){
        assert.equal(directContact(cue,{...result,effectiveDamage:0,blockReason:reason}),expected);
      }
      assert.equal(directContact(cue,{...result,immunityMultiplier:.15}),'breach');
      assert.equal(directContact(cue,{...result,visible:false}),null);
      assert.equal(directContact(cue,{...result,directHit:false}),null);
    }
  }
  const sound=(family,type)=>directContact(bank.defenders.get(family).cues[0],{type,directHit:true,effectiveDamage:5});
  assert.equal(sound('frostwarden','physical'),'oak');assert.equal(sound('runebreaker','physical'),'anvil');
  assert.equal(sound('ladyclaire','holy'),'holy');assert.equal(sound('el_drow_blade','magical'),'moon');
  assert.equal(sound('royalarsenal','magical'),'storm');assert.equal(sound('el_drow_cinder','magical'),'silk');
});

test('each authored contact slice decodes to a distinct, bounded mono waveform and decays to silence',()=>{
  const bytes=readFileSync(new URL('../public/assets/audio/combat-effects-current/contact-atlas-1.wav',import.meta.url));
  assert.equal(bytes.toString('ascii',8,12),'WAVE');assert.equal(bytes.readUInt16LE(22),1);
  const frames=bytes.readUInt32LE(24)*CONTACT_SLICE_SECONDS;
  assert.equal(bytes.length,44+2*CONTACT_NAMES.length*frames);const hashes=new Set();
  for(let i=0;i<CONTACT_NAMES.length;i++){
    const slice=bytes.subarray(44+i*frames*2,44+(i+1)*frames*2);hashes.add(sha(slice));
    let peak=0,power=0;for(let n=0;n<slice.length;n+=2){const v=slice.readInt16LE(n);peak=Math.max(peak,Math.abs(v));power+=(v/32768)**2;}
    assert.ok(peak<27000&&peak>20000&&power/frames>.001,CONTACT_NAMES[i]);
    assert.equal(slice.readInt16LE(0),0);assert.ok(slice.subarray(slice.length-200).every(x=>x===0));
  }
  assert.equal(hashes.size,CONTACT_NAMES.length);
});

test('real campaign plays one body/outcome per attack and FX only for confirmed statuses',async()=>{
  const h=harness();h.audio.syncGameState({phase:'combat',data:{fr010:true}});
  // The atlas is a single shared long buffer. Preserve start offsets to check slice selection.
  h.context.decodeAudioData=async()=>({duration:CONTACT_NAMES.length*CONTACT_SLICE_SECONDS,sampleRate:24000});
  const node=h.context.createBufferSource.bind(h.context);
  h.context.createBufferSource=()=>{const src=node();src.start=(...args)=>{src.started=args;};return src;};
  const s=shot('el_drow_blade'),p={...s,type:'magical',enemy:{},target:{},effectiveDamage:4,directHit:true,visible:true};
  try{
    await h.audio.play('shot',p);await h.audio.play('shot',{...p,firstPrimary:false});assert.equal(h.played().length,1);
    await h.audio.play('hit',p);await h.audio.play('damage-trace',{...p,directHit:false});assert.equal(h.played().length,1);
    await h.audio.play('damage-trace',p);assert.equal(h.played().at(-1).started[1],CONTACT_OFFSETS.get('moon'));
    await h.audio.play('impact',{...p,appliedStatuses:[]});assert.equal(h.played().length,2);
    await h.audio.play('impact',{...p,appliedStatuses:['freeze']});assert.equal(h.played().at(-1).started[1],CONTACT_OFFSETS.get('shatter'));
    await h.audio.play('damage-trace',{...p,effectiveDamage:0,blockReason:'evasion'});assert.equal(h.played().at(-1).started[1],CONTACT_OFFSETS.get('dodge'));
    await h.audio.play('impact',{...p,execution:true,result:p});assert.equal(h.played().at(-1).started[1],CONTACT_OFFSETS.get('execute'));
    await h.audio.play('damage-trace',{...p,visible:false});assert.equal(h.played().length,5);
    assert.equal(h.requests.filter(url=>url.endsWith('.wav')).length,1);
  }finally{h.audio.dispose();}
});

test('a channel shares one sustained voice, releases when input expires and is cut on pause',async()=>{
  const h=harness();const state={phase:'combat',data:{fr010:true}};
  h.audio.syncGameState(state);
  const flame={...shot('dw_flamewarden'),stats:{continuousAttack:{angleDegrees:35}}};
  try{
    await h.audio.play('aura-attack',flame);
    for(let i=0;i<15;i++){h.context.currentTime+=.016;h.advance(16);await h.audio.play('aura-attack',flame);}
    assert.equal(h.played().length,1);const src=h.played()[0];
    assert.equal(src.loop,true);assert.ok(src.stops.at(-1)>.3&&src.stops.at(-1)<.5);
    h.audio.syncGameState({...state,paused:true});assert.equal(h.audio.voices.size,0);
    h.audio.syncGameState(state);h.advance(500);await h.audio.play('aura-attack',flame);assert.equal(h.played().length,2);
  }finally{h.audio.dispose();}
});
