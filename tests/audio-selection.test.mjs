import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager} from '../game/audio/audio.js';
import {Game} from '../game/core/game.js';
import {DraftCardActivation} from '../ui/draft-input.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {siteUrl} from '../game/site-url.js';
import {ALLIED_VOICE_CATALOGUE,ALLIED_VOICE_REVISION} from '../game/audio/voice-assets.js';

class Param{
  setValueAtTime(){} linearRampToValueAtTime(){} exponentialRampToValueAtTime(){} cancelScheduledValues(){}
}
class Node{
  constructor(kind){this.kind=kind;this.frequency=new Param();this.gain=new Param();this.Q=new Param();this.playbackRate={value:1,setValueAtTime(value){this.value=value;}};this.disconnected=false;this.stopped=false;}
  connect(){} disconnect(){this.disconnected=true;} start(){this.started=true;} stop(){this.stopped=true;}
  finish(){this.onended?.();this.onended=null;}
}
class Context{
  constructor(){this.currentTime=0;this.sampleRate=8;this.state='suspended';this.destination={};this.nodes=[];this.decoded=[];this.resumes=0;}
  node(kind){const node=new Node(kind);this.nodes.push(node);return node;}
  createBufferSource(){return this.node('source');} createGain(){return this.node('gain');}
  createOscillator(){return this.node('oscillator');} createBiquadFilter(){return this.node('filter');}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
  decodeAudioData(bytes){const value={clip:new Uint8Array(bytes)[0],duration:1};this.decoded.push(value);return Promise.resolve(value);}
  resume(){this.resumes++;this.state='running';return Promise.resolve();} close(){this.state='closed';return Promise.resolve();}
  get speech(){return this.nodes.filter(node=>node.buffer?.clip!==undefined&&node.started);}
}
const catalogue={soldier:[{id:'soldier_a',url:'/soldier-a.wav'},{id:'soldier_b',url:'/soldier-b.wav'}]};
const tower=(id=1,family='soldier')=>({id,family,tier:1,state:'draft',round:1});
const bytes=value=>new Uint8Array([value]).buffer;
const response=value=>({ok:true,arrayBuffer:async()=>bytes(value)});
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const harness=(options={})=>{
  const context=new Context(),requests=[];
  const fetchAudio=async(url,{signal})=>{requests.push({url,signal});return response(url.includes('-a.')?1:2);};
  const audio=new AudioManager(false,{contextFactory:()=>context,selectionCatalogue:catalogue,fetchAudio,...options});
  return {audio,context,requests};
};

test('selection catalogue accepts two real A/B URLs per stable family and remains lazy',async()=>{
  const h=harness();assert.equal(h.audio.selectionCatalogue.size,1);assert.equal(h.audio.context,null);
  assert.deepEqual(await h.audio.preloadSelectionClips(),[]);assert.equal(h.requests.length,0);
  assert.equal(await h.audio.playSelectionVoice({tower:tower()}),false);assert.equal(h.audio.context,null);
  assert.throws(()=>h.audio.setSelectionCatalogue({soldier:['/one.wav']}),/two A\/B/);
  assert.throws(()=>h.audio.setSelectionCatalogue({soldier:['/same.wav','/same.wav']}),/distinct/);
  assert.equal(h.audio.selectionCatalogue.size,1,'invalid replacement is atomic');
  h.audio.unlock();assert.equal(h.context.resumes,1);
  assert.equal((await h.audio.preloadSelectionClips()).length,2);assert.equal(h.requests.length,2);
  await h.audio.preloadSelectionClips();assert.equal(h.requests.length,2,'decoded assets are cached');h.audio.dispose();
});

test('catalogue loading resolves MP3 filenames relative to root, project and portable deployments without unlocking audio',async()=>{
  for(const base of ['/','/tower-defense/','./']){
    const documentUrl='https://example.test/portable/index.html',catalogueUrl=new URL(siteUrl('assets/audio/selection/catalogue.json',base),documentUrl).href;
    let fetched;
    const h=harness({selectionCatalogue:{},fetchAudio:async url=>{fetched=url;return {ok:true,url:catalogueUrl,json:async()=>({soldier:[{id:'a',url:'ally_soldier_select_a.mp3'},{id:'b',url:'ally_soldier_select_b.mp3'}]})};}});
    assert.equal(await h.audio.loadSelectionCatalogue(catalogueUrl),1);assert.equal(fetched,catalogueUrl);assert.equal(h.audio.context,null);
    assert.equal(h.audio.selectionCatalogue.get('soldier')[0].url,new URL('ally_soldier_select_a.mp3',catalogueUrl).href);h.audio.dispose();
  }
});

test('missing, malformed or superseded catalogue loads fail softly and preserve existing recordings',async()=>{
  for(const response of [{ok:false},{ok:true,json:async()=>{throw new Error('invalid JSON');}},{ok:true,json:async()=>({soldier:[{}]})}]){
    const h=harness({fetchAudio:async()=>response});assert.equal(await h.audio.loadSelectionCatalogue('https://example.test/catalogue.json'),false);
    assert.equal(h.audio.selectionCatalogue.get('soldier')[0].url,'/soldier-a.wav');assert.equal(h.audio.context,null);h.audio.dispose();
  }
  const pending=defer(),h=harness({fetchAudio:()=>pending.promise});
  const loading=h.audio.loadSelectionCatalogue('https://example.test/catalogue.json');h.audio.setSelectionCatalogue({});
  pending.resolve({ok:true,json:async()=>catalogue});assert.equal(await loading,false);assert.equal(h.audio.selectionCatalogue.size,0);h.audio.dispose();
});

test('each accepted selection independently chooses A/B and permits B twice in a row',async()=>{
  const choices=[.1,.9,.9,.1],h=harness({voiceRandom:()=>choices.shift()});h.audio.unlock();
  for(let id=1;id<=4;id++)assert.equal(await h.audio.play('defender-select',{tower:tower(id)}),true);
  assert.deepEqual(h.context.speech.map(source=>source.buffer.clip),[1,2,2,1]);
  assert.equal(h.requests.length,2);assert.equal(h.audio.voices.size,1,'only the latest speech source remains');
  assert.ok(h.context.speech.slice(0,-1).every(source=>source.stopped&&source.disconnected));h.audio.dispose();
});

test('duplicate selection gestures do not restart speech; switching to an unknown identity cancels it',async()=>{
  const h=harness({voiceRandom:()=>.1});h.audio.unlock();
  assert.equal(await h.audio.play('defender-select',{tower:tower()}),true);
  assert.equal(await h.audio.play('defender-select',{tower:tower()}),false);assert.equal(h.context.speech.length,1);
  assert.equal(await h.audio.play('defender-select',{tower:tower(2,'unrecorded')}),false);
  assert.equal(h.audio.selectionVoice,null);assert.equal(h.audio.voices.size,0);assert.equal(h.context.speech[0].stopped,true);
  h.audio.dispose();
});

test('latest selection wins even if earlier fetch/decode completes later',async()=>{
  const pendingA=defer(),pendingB=defer(),choices=[.1,.9];
  const h=harness({voiceRandom:()=>choices.shift(),fetchAudio:url=>url.includes('-a.')?pendingA.promise:pendingB.promise});h.audio.unlock();
  const first=h.audio.play('defender-select',{tower:tower(1)}),second=h.audio.play('defender-select',{tower:tower(2)});
  pendingB.resolve(response(2));assert.equal(await second,true);pendingA.resolve(response(1));assert.equal(await first,false);
  assert.deepEqual(h.context.speech.map(source=>source.buffer.clip),[2]);h.audio.dispose();
});

test('mute, catalogue replacement and dispose suppress pending speech and dispose aborts loads',async()=>{
  for(const action of ['mute','replace','dispose']){
    const pending=defer();let signal;
    const h=harness({voiceRandom:()=>.1,fetchAudio:(url,options)=>{signal=options.signal;return pending.promise;}});h.audio.unlock();
    const selection=h.audio.play('defender-select',{tower:tower()});
    if(action==='mute')h.audio.muted=true;
    if(action==='replace')h.audio.setSelectionCatalogue({});
    if(action==='dispose'){h.audio.dispose();assert.equal(signal.aborted,true);}
    pending.resolve(response(1));assert.equal(await selection,false);assert.equal(h.context.speech.length,0);h.audio.dispose();
  }
});

test('iPad gesture resumes the context synchronously, pending resume precedes speech, and failures stay silent',async()=>{
  const pendingResume=defer(),h=harness({voiceRandom:()=>.1});
  h.context.resume=()=>{h.context.resumes++;return pendingResume.promise.then(()=>{h.context.state='running';});};
  h.audio.unlock();assert.equal(h.context.resumes,1,'resume is invoked before any asynchronous asset work');
  const selection=h.audio.play('defender-select',{tower:tower()});await flush();assert.equal(h.context.speech.length,0);
  pendingResume.resolve();assert.equal(await selection,true);h.audio.dispose();
  const rejected=harness();rejected.context.resume=()=>Promise.reject(new Error('gesture unavailable'));
  rejected.audio.unlock();assert.equal(await rejected.audio.play('defender-select',{tower:tower()}),false);rejected.audio.dispose();
});

test('missing or undecodable recordings fail softly and a later selection can retry',async()=>{
  let attempts=0;
  const h=harness({voiceRandom:()=>.1,fetchAudio:async()=>++attempts===1?{ok:false}:response(1)});h.audio.unlock();
  assert.equal(await h.audio.play('defender-select',{tower:tower(1)}),false);
  assert.equal(await h.audio.play('defender-select',{tower:tower(2)}),true);assert.equal(attempts,2);
  h.context.decodeAudioData=()=>Promise.reject(new Error('bad audio'));
  h.audio.setSelectionCatalogue({soldier:['/bad-a.wav','/bad-b.wav']});
  assert.equal(await h.audio.play('defender-select',{tower:tower(3)}),false);h.audio.dispose();
});

test('revealing a defender keeps its synthetic build sound and plays one line; keeper confirmation does not repeat it',async()=>{
  const h=harness({voiceRandom:()=>.1});h.audio.unlock();h.audio.play('place',{tower:tower()});await flush();
  assert.equal(h.context.speech.length,1);assert.ok(h.context.nodes.some(node=>node.kind==='oscillator'));
  h.audio.play('keep',{tower:{...tower(),state:'active'}});await flush();assert.equal(h.context.speech.length,1);
  h.audio.play('wave');assert.equal(h.audio.selectionVoice,null);h.audio.dispose();
});

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
test('five real reveals and explicit draft choices speak; duplicate taps, mystery slots and rank previews do not',()=>{
  const game=new Game(data,{seed:42});const events=[];game.on((type,payload)=>events.push({type,payload}));
  const mysteryInput=new DraftCardActivation();assert.equal(mysteryInput.activate(game,0),false);
  assert.equal(events.filter(event=>event.type==='defender-select').length,0,'unrevealed slots have no voice identity');
  assert.equal(game.place(-1,-1),false);assert.equal(events.filter(event=>event.type==='place').length,0);
  for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  const reveals=events.filter(event=>event.type==='place');assert.equal(reveals.length,5);assert.ok(reveals.every(event=>event.payload.tower.family));
  assert.equal(events.filter(event=>event.type==='defender-select').length,0,'automatic selection is not an explicit candidate choice');
  let now=1000;const input=new DraftCardActivation(()=>now),pointer={pointerType:'touch',button:0,clientX:100,clientY:100};
  input.activate(game,4,pointer);assert.equal(events.filter(event=>event.type==='defender-select').length,1,'first explicit choice of auto-selected fifth recruit speaks');
  game.select(game.selected);assert.equal(events.filter(event=>event.type==='defender-select').length,1,'same candidate does not repeat');
  const preview=new DefenderRankPreview();preview.select(game.selection,6,data);
  assert.equal(events.filter(event=>event.type==='defender-select').length,1,'preview has no selection event');
  now+=150;assert.equal(input.activate(game,4,pointer),true);
  assert.equal(events.filter(event=>event.type==='defender-select').length,1,'confirming a double tap does not repeat');
  const ruin=game.towers.find(unit=>unit.state==='ruin');game.select(ruin.id);
  assert.equal(events.filter(event=>event.type==='defender-select').at(-1).payload.tower,null,'a wall only cancels speech');
});

test('deselecting immediately after a reveal cancels pending speech even before any explicit choice',()=>{
  const game=new Game(data,{seed:42}),events=[];game.on((type,payload)=>events.push({type,payload}));
  game.place(3,3);assert.equal(game.selectionVoiceKey,null);game.select(null);
  const selections=events.filter(event=>event.type==='defender-select');assert.equal(selections.length,1);assert.equal(selections[0].payload.tower,null);
  game.select(null);assert.equal(events.filter(event=>event.type==='defender-select').length,1,'repeat deselection is deduplicated');
});

test('successful advanced crafting and Lady Claire speak once, while recipe previews and rejected crafts remain silent',async()=>{
  for(const [family,choice] of [['rimewatch',.1],['ladyclaire',.9]]){
    const game=new Game(data,{seed:42}),recipe=game.recipes.find(recipe=>recipe.id===family);
    for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
    recipe.ingredients.forEach((piece,index)=>Object.assign(game.towers[index],piece));game.select(game.towers[0].id);
    const previousFamily=game.selection.family,events=[];
    const h=harness({voiceRandom:()=>choice,selectionCatalogue:{[family]:[{id:`${family}_a`,url:`/${family}-a.wav`},{id:`${family}_b`,url:`/${family}-b.wav`}]}});h.audio.unlock();
    game.on((type,payload)=>{events.push({type,payload});h.audio.play(type,payload);});
    assert.equal(game.previewRecipe(recipe.id),true);await flush();assert.equal(h.context.speech.length,0);
    assert.equal(game.craft(recipe.id),true);await flush();
    const combine=events.find(event=>event.type==='combine');
    assert.equal(combine.payload.tower,game.selection);assert.equal(combine.payload.previousFamily,previousFamily);assert.equal(combine.payload.crafted,true);
    assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].buffer.clip,choice<.5?1:2);
    assert.equal(h.requests[0].url,`/${family}-${choice<.5?'a':'b'}.wav`);
    assert.ok(h.context.nodes.some(node=>node.kind==='oscillator'),'the synthetic combination chord remains');
    assert.equal(game.craft(recipe.id),false);await flush();assert.equal(h.context.speech.length,1);h.audio.dispose();
  }
});

test('duplicate advanced combine delivery cannot restart a pending or interrupted crafting line',async()=>{
  const pending=defer();let choices=0;
  const h=harness({selectionCatalogue:{rimewatch:['/rimewatch-a.wav','/rimewatch-b.wav']},voiceRandom:()=>{choices++;return .1;},fetchAudio:()=>pending.promise});h.audio.unlock();
  const crafted={...tower(1,'rimewatch'),state:'active'},payload={tower:crafted,previousFamily:'frostwarden',crafted:true};
  h.audio.play('combine',payload);h.audio.play('combine',payload);assert.equal(choices,1);
  pending.resolve(response(1));await flush();assert.equal(h.context.speech.length,1);
  h.audio.play('defender-select',{tower:null});assert.equal(h.context.speech[0].stopped,true);
  h.audio.play('combine',payload);await flush();assert.equal(choices,1);assert.equal(h.context.speech.length,1);
  assert.equal(await h.audio.play('defender-select',{tower:crafted}),true,'a later explicit champion selection still gets its own A/B choice');
  h.audio.play('combine',payload);await flush();assert.equal(choices,2);assert.equal(h.context.speech.length,2);assert.equal(h.context.speech[1].stopped,false);h.audio.dispose();
});

test('ordinary basic rank merging keeps the combination chord and cancels speech without announcing a new identity',async()=>{
  const game=new Game(data,{seed:42});for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  game.towers.forEach(tower=>Object.assign(tower,{family:'soldier',tier:1}));game.select(game.towers[0].id);
  const h=harness({voiceRandom:()=>.1});h.audio.unlock();assert.equal(await h.audio.play('defender-select',{tower:game.selection}),true);
  const events=[];game.on((type,payload)=>{events.push({type,payload});h.audio.play(type,payload);});
  assert.equal(game.merge(),true);await flush();
  const combine=events.find(event=>event.type==='combine');assert.equal(combine.payload.crafted,undefined);
  assert.equal(game.selection.family,'soldier');assert.equal(game.selection.tier,2);
  assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].stopped,true);
  assert.ok(h.context.nodes.some(node=>node.kind==='oscillator'));h.audio.dispose();
});

test('catalogue and both MP3s retain their independent audio revision under each deployment base',async()=>{
  for(const base of ['/','/bastions-of-the-last-kingdom/','./']){
    const catalogueUrl=new URL(siteUrl(ALLIED_VOICE_CATALOGUE,base),'https://example.test/portable/index.html').href;
    const h=harness({selectionCatalogue:{},fetchAudio:async()=>({ok:true,url:catalogueUrl,json:async()=>({soldier:[{id:'a',url:'ally_soldier_select_a.mp3'},{id:'b',url:'ally_soldier_select_b.mp3'}]})})});
    assert.equal(await h.audio.loadSelectionCatalogue(catalogueUrl),1);
    for(const clip of h.audio.selectionCatalogue.get('soldier')){
      const asset=new URL(clip.url);assert.equal(asset.searchParams.get('v'),ALLIED_VOICE_REVISION);
      assert.equal(asset.pathname,new URL(clip.id==='a'?'ally_soldier_select_a.mp3':'ally_soldier_select_b.mp3',catalogueUrl).pathname);
    }
    assert.equal(h.audio.context,null);h.audio.dispose();
  }
});

test('reserved inactive blockers cancel speech while their known returning candidate can be selected normally',async()=>{
  const game=new Game(data,{seed:42});for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  const reserved=game.towers[0],h=harness({selectionCatalogue:{[reserved.family]:['/reserved-a.wav','/reserved-b.wav']},voiceRandom:()=>.1});h.audio.unlock();
  game.on((type,payload)=>h.audio.play(type,payload));game.select(reserved.id);await flush();assert.equal(h.context.speech.length,1);
  assert.equal(game.reserve(),true);game.select(reserved.id);await flush();assert.equal(h.context.speech.length,1);assert.equal(h.audio.selectionVoice,null);
  game.select(game.towers.find(tower=>tower.state==='draft').id);game.keep();game.startCombat();game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();
  assert.equal(reserved.state,'draft');assert.equal(game.draft.draws[0].fixedPosition,true);
  game.select(reserved.id);await flush();assert.equal(h.context.speech.length,2);h.audio.dispose();
});

test('render changes stay silent and voices never consume seeded gameplay randomness',async()=>{
  const game=new Game(data,{seed:42}),control=new Game(data,{seed:42});for(let x=3;x<8;x++){game.place(x,3);control.place(x,3);}
  const families=[...new Set(game.towers.map(tower=>tower.family))],h=harness({selectionCatalogue:Object.fromEntries(families.map(family=>[family,[`/${family}-a.wav`,`/${family}-b.wav`]])),voiceRandom:()=>.9});h.audio.unlock();
  game.on((type,payload)=>h.audio.play(type,payload));
  for(let index=0;index<20;index++){game.select(game.towers[index%5].id);await flush();}
  const spoken=h.context.speech.length;for(let index=0;index<20;index++)game.emit('change');await flush();
  assert.equal(h.context.speech.length,spoken);assert.equal(game.rng(),control.rng());h.audio.dispose();
});

test('explicit inspection while combat is paused speaks at ordinary playback rate, without combat sound events',async()=>{
  const game=new Game(data,{seed:42});for(let x=3;x<8;x++)game.place(x,3);game.select(game.towers[0].id);game.keep();game.startCombat();game.paused=true;game.speed=3;
  const active=game.towers.find(tower=>tower.state==='active'),h=harness({selectionCatalogue:{[active.family]:['/active-a.wav','/active-b.wav']},voiceRandom:()=>.1});h.audio.unlock();
  const events=[];game.on((type,payload)=>{events.push(type);h.audio.play(type,payload);});game.select(active.id);await flush();game.tick(.2);
  assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].playbackRate.value,1);
  assert.ok(!events.some(type=>['shot','impact','hit','death','aura-attack'].includes(type)));h.audio.dispose();
});
