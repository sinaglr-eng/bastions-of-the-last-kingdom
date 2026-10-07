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
const tower=(id=1,family='soldier')=>({id,family,tier:1,state:'active',round:1});
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

test('each committed defender independently chooses A/B and permits B twice in a row',async()=>{
  const choices=[.1,.9,.9,.1],h=harness({voiceRandom:()=>choices.shift()});h.audio.unlock();
  for(let id=1;id<=4;id++)assert.equal(await h.audio.play('defender-committed',{tower:tower(id)}),true);
  assert.deepEqual(h.context.speech.map(source=>source.buffer.clip),[1,2,2,1]);
  assert.equal(h.requests.length,2);assert.equal(h.audio.voices.size,1,'only the latest speech source remains');
  assert.ok(h.context.speech.slice(0,-1).every(source=>source.stopped&&source.disconnected));h.audio.dispose();
});

test('duplicate commits do not restart speech; a new unrecorded final identity cancels it',async()=>{
  const h=harness({voiceRandom:()=>.1}),defender=tower();h.audio.unlock();
  assert.equal(await h.audio.play('defender-committed',{tower:defender}),true);
  assert.equal(await h.audio.play('defender-committed',{tower:defender}),false);assert.equal(h.context.speech.length,1);
  assert.equal(await h.audio.play('defender-committed',{tower:tower(2,'unrecorded')}),false);
  assert.equal(h.audio.selectionVoice,null);assert.equal(h.audio.voices.size,0);assert.equal(h.context.speech[0].stopped,true);
  h.audio.dispose();
});

test('latest committed defender wins even if earlier fetch/decode completes later',async()=>{
  const pendingA=defer(),pendingB=defer(),choices=[.1,.9];
  const h=harness({voiceRandom:()=>choices.shift(),fetchAudio:url=>url.includes('-a.')?pendingA.promise:pendingB.promise});h.audio.unlock();
  const first=h.audio.play('defender-committed',{tower:tower(1)}),second=h.audio.play('defender-committed',{tower:tower(2)});
  pendingB.resolve(response(2));assert.equal(await second,true);pendingA.resolve(response(1));assert.equal(await first,false);
  assert.deepEqual(h.context.speech.map(source=>source.buffer.clip),[2]);h.audio.dispose();
});

test('mute, catalogue replacement and dispose suppress pending speech and dispose aborts loads',async()=>{
  for(const action of ['mute','replace','dispose']){
    const pending=defer();let signal;
    const h=harness({voiceRandom:()=>.1,fetchAudio:(url,options)=>{signal=options.signal;return pending.promise;}});h.audio.unlock();
    const selection=h.audio.play('defender-committed',{tower:tower()});
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
  const selection=h.audio.play('defender-committed',{tower:tower()});await flush();assert.equal(h.context.speech.length,0);
  pendingResume.resolve();assert.equal(await selection,true);h.audio.dispose();
  const rejected=harness();rejected.context.resume=()=>Promise.reject(new Error('gesture unavailable'));
  rejected.audio.unlock();assert.equal(await rejected.audio.play('defender-committed',{tower:tower()}),false);rejected.audio.dispose();
});

test('missing or undecodable recordings fail softly and a later committed defender can retry',async()=>{
  let attempts=0;
  const h=harness({voiceRandom:()=>.1,fetchAudio:async()=>++attempts===1?{ok:false}:response(1)});h.audio.unlock();
  assert.equal(await h.audio.play('defender-committed',{tower:tower(1)}),false);
  assert.equal(await h.audio.play('defender-committed',{tower:tower(2)}),true);assert.equal(attempts,2);
  h.context.decodeAudioData=()=>Promise.reject(new Error('bad audio'));
  h.audio.setSelectionCatalogue({soldier:['/bad-a.wav','/bad-b.wav']});
  assert.equal(await h.audio.play('defender-committed',{tower:tower(3)}),false);h.audio.dispose();
});

test('place, keep and combine retain synthetic sounds while inspection never starts or interrupts committed speech',async()=>{
  const h=harness({voiceRandom:()=>.1}),defender=tower();h.audio.unlock();
  h.audio.play('place',{tower:{...defender,state:'draft'}});h.audio.play('defender-select',{tower:defender});
  h.audio.play('keep',{tower:defender});h.audio.play('combine',{tower:defender,crafted:true,previousFamily:'archer'});
  await flush();assert.equal(h.context.speech.length,0);assert.equal(h.requests.length,0);
  assert.ok(h.context.nodes.some(node=>node.kind==='oscillator'),'construction and combination still synthesize their sounds');
  assert.equal(await h.audio.play('defender-committed',{tower:defender,action:'keep'}),true);
  const source=h.audio.selectionVoice.source;
  for(const inspected of [defender,{...defender,id:2,state:'draft'},null])h.audio.play('defender-select',{tower:inspected});
  h.audio.play('combine',{tower:defender});await flush();
  assert.equal(h.context.speech.length,1);assert.equal(source.stopped,false);assert.equal(h.audio.selectionVoice.source,source);
  h.audio.play('wave');assert.equal(h.audio.selectionVoice.source,source);assert.equal(source.stopped,false);h.audio.dispose();
});

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const familyCatalogue=(...families)=>Object.fromEntries([...new Set(families)].map(family=>[family,[`/${family}-a.wav`,`/${family}-b.wav`]]));
const placeFive=(game,z=3)=>{for(let x=3;x<8;x++)assert.equal(game.place(x,z),true);};
const finishWave=game=>{assert.equal(game.startCombat(),true);game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();};
const listen=(game,audio)=>{
  const events=[];game.on((type,payload={})=>{events.push({type,payload,state:payload.tower?.state,family:payload.tower?.family,tier:payload.tower?.tier});audio.play(type,payload);});return events;
};
test('real draft reveals, explicit choices and rank previews stay silent until a double tap keeps the final defender',async()=>{
  const game=new Game(data,{seed:42}),h=harness({selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1});h.audio.unlock();
  const events=listen(game,h.audio);
  const mysteryInput=new DraftCardActivation();assert.equal(mysteryInput.activate(game,0),false);
  assert.equal(events.filter(event=>event.type==='defender-committed').length,0);
  assert.equal(game.place(-1,-1),false);assert.equal(events.filter(event=>event.type==='place').length,0);
  placeFive(game);
  const reveals=events.filter(event=>event.type==='place');assert.equal(reveals.length,5);assert.ok(reveals.every(event=>event.payload.tower.family));
  let now=1000;const input=new DraftCardActivation(()=>now),pointer={pointerType:'touch',button:0,clientX:100,clientY:100};
  input.activate(game,4,pointer);game.select(game.selected);
  const preview=new DefenderRankPreview();preview.select(game.selection,6,data);
  await flush();assert.equal(h.context.speech.length,0);assert.equal(h.requests.length,0,'latent and inspected candidates never load a recording');
  const keeper=game.selection;
  now+=150;assert.equal(input.activate(game,4,pointer),true);
  await flush();const commits=events.filter(event=>event.type==='defender-committed');
  assert.equal(commits.length,1);assert.equal(commits[0].payload.tower,keeper);assert.equal(commits[0].state,'active');assert.equal(commits[0].payload.action,'keep');
  assert.ok(events.findIndex(event=>event.type==='keep')<events.findIndex(event=>event.type==='defender-committed'));
  assert.equal(h.context.speech.length,1);assert.equal(h.requests[0].url,`/${keeper.family}-a.wav`);
  const source=h.audio.selectionVoice.source;assert.equal(game.keep(),false);
  const ruin=game.towers.find(unit=>unit.state==='ruin');game.select(ruin.id);
  await flush();assert.equal(source.stopped,false);assert.equal(h.context.speech.length,1);h.audio.dispose();
});

test('inspection and deselection during a pending final line do not invalidate its load',async()=>{
  const pending=defer(),game=new Game(data,{seed:42}),h=harness({selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1,fetchAudio:()=>pending.promise});h.audio.unlock();listen(game,h.audio);
  placeFive(game);const kept=game.selection;assert.equal(game.keep(),true);
  game.select(null);game.select(game.towers.find(unit=>unit.state==='ruin').id);game.select(kept.id);
  await flush();assert.equal(h.context.speech.length,0);
  pending.resolve(response(1));await flush();assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].stopped,false);h.audio.dispose();
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
    const combine=events.find(event=>event.type==='combine'),committed=events.find(event=>event.type==='defender-committed');
    assert.equal(combine.payload.tower,game.selection);assert.equal(combine.payload.previousFamily,previousFamily);assert.equal(combine.payload.crafted,true);
    assert.equal(committed.payload.tower,game.selection);assert.equal(committed.payload.action,'craft');assert.equal(committed.payload.round,game.round);
    assert.equal(committed.payload.tower.state,'active');assert.equal(committed.payload.tower.family,family);assert.equal(committed.payload.tower.tier,1);
    assert.ok(events.indexOf(combine)<events.indexOf(committed),'the committed announcement follows the existing combination sound');
    assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].buffer.clip,choice<.5?1:2);
    assert.equal(h.requests[0].url,`/${family}-${choice<.5?'a':'b'}.wav`);
    assert.ok(h.context.nodes.some(node=>node.kind==='oscillator'),'the synthetic combination chord remains');
    assert.equal(game.craft(recipe.id),false);await flush();assert.equal(h.context.speech.length,1);h.audio.dispose();
  }
});

test('duplicate commits cannot restart a pending or interrupted line, regardless of action labels',async()=>{
  const pending=defer();let choices=0;
  const h=harness({selectionCatalogue:{rimewatch:['/rimewatch-a.wav','/rimewatch-b.wav']},voiceRandom:()=>{choices++;return .1;},fetchAudio:()=>pending.promise});h.audio.unlock();
  const crafted=tower(1,'rimewatch'),payload={tower:crafted,round:1,action:'craft'};
  const first=h.audio.play('defender-committed',payload);assert.equal(await h.audio.play('defender-committed',{...payload,action:'keep'}),false);assert.equal(choices,1);
  pending.resolve(response(1));await flush();assert.equal(h.context.speech.length,1);
  assert.equal(await first,true);h.audio.play('reserve');assert.equal(h.context.speech[0].stopped,true);
  assert.equal(await h.audio.play('defender-committed',payload),false);assert.equal(choices,1);assert.equal(h.context.speech.length,1);
  assert.equal(await h.audio.play('defender-committed',{...payload,round:2}),true,'a later round is a separate final commitment');
  const source=h.audio.selectionVoice.source;h.audio.play('wave');assert.equal(await h.audio.play('defender-committed',{...payload,round:2}),false);assert.equal(source.stopped,false);
  crafted.tier=2;assert.equal(await h.audio.play('defender-committed',{...payload,round:2}),true,'a genuinely new final rank is distinct');
  assert.equal(choices,3);assert.equal(h.context.speech.length,3);h.audio.dispose();
});

test('ordinary basic merging announces the final higher rank once after the combination chord',async()=>{
  const game=new Game(data,{seed:42});for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  game.towers.forEach(tower=>Object.assign(tower,{family:'soldier',tier:1}));game.select(game.towers[0].id);
  const h=harness({voiceRandom:()=>.1});h.audio.unlock();const events=listen(game,h.audio);
  h.audio.play('defender-select',{tower:game.selection});assert.equal(h.context.speech.length,0);
  assert.equal(game.merge(),true);await flush();
  const combine=events.find(event=>event.type==='combine'),committed=events.find(event=>event.type==='defender-committed');assert.equal(combine.payload.crafted,undefined);
  assert.equal(game.selection.family,'soldier');assert.equal(game.selection.tier,2);
  assert.equal(committed.payload.action,'merge');assert.equal(committed.state,'active');assert.equal(committed.tier,2);assert.ok(events.indexOf(combine)<events.indexOf(committed));
  assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].stopped,false);
  assert.equal(game.merge(),false);assert.equal(events.filter(event=>event.type==='defender-committed').length,1);
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

test('paid reserve and returning fixed-position candidate remain silent until the returning defender is kept',async()=>{
  const game=new Game(data,{seed:42}),h=harness({selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1});h.audio.unlock();const events=listen(game,h.audio);
  placeFive(game);const reserved=game.towers[0],position=[reserved.x,reserved.z];game.select(reserved.id);
  assert.equal(game.reserve(),true);game.select(reserved.id);await flush();
  assert.equal(reserved.state,'reserved');assert.equal(h.context.speech.length,0);assert.equal(events.filter(event=>event.type==='defender-committed').length,0);
  assert.equal(await h.audio.play('defender-committed',{tower:reserved,round:1}),false,'inactive blockers cannot announce themselves');
  game.select(game.towers.find(tower=>tower.state==='draft').id);assert.equal(game.keep(),true);await flush();assert.equal(h.context.speech.length,1);
  const firstKeeperSource=h.audio.selectionVoice.source;finishWave(game);assert.equal(h.audio.selectionVoice.source,firstKeeperSource);assert.equal(firstKeeperSource.stopped,false);
  assert.equal(reserved.state,'draft');assert.equal(game.draft.draws[0].fixedPosition,true);assert.deepEqual([reserved.x,reserved.z],position);
  game.select(reserved.id);assert.equal(game.keep(),false,'four new placements are still required');
  for(let x=3;x<7;x++)assert.equal(game.place(x,4),true);
  game.select(reserved.id);await flush();assert.equal(h.context.speech.length,1,'returning candidate inspection is silent');
  assert.equal(game.keep(),true);await flush();assert.equal(h.context.speech.length,2);
  const committed=events.filter(event=>event.type==='defender-committed').at(-1);
  assert.equal(committed.payload.tower,reserved);assert.equal(committed.payload.round,2);assert.equal(committed.state,'active');assert.equal(h.requests.at(-1).url,`/${reserved.family}-a.wav`);h.audio.dispose();
});

test('render changes stay silent and voices never consume seeded gameplay randomness',async()=>{
  const game=new Game(data,{seed:42}),control=new Game(data,{seed:42});for(let x=3;x<8;x++){game.place(x,3);control.place(x,3);}
  const families=[...new Set(game.towers.map(tower=>tower.family))],h=harness({selectionCatalogue:Object.fromEntries(families.map(family=>[family,[`/${family}-a.wav`,`/${family}-b.wav`]])),voiceRandom:()=>.9});h.audio.unlock();
  game.on((type,payload)=>h.audio.play(type,payload));
  for(let index=0;index<20;index++){game.select(game.towers[index%5].id);await flush();}
  assert.equal(h.context.speech.length,0);game.select(game.towers[0].id);control.select(control.towers[0].id);assert.equal(game.keep(),true);assert.equal(control.keep(),true);await flush();
  const source=h.audio.selectionVoice.source;
  for(let index=0;index<20;index++){game.select(game.towers[index%5].id);game.emit('change');}await flush();
  assert.equal(h.context.speech.length,1);assert.equal(source.stopped,false);assert.equal(game.rng(),control.rng());h.audio.dispose();
});

test('playing final line continues through wave start at 3x speed and paused combat inspection stays silent',async()=>{
  const game=new Game(data,{seed:42}),h=harness({selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1});h.audio.unlock();const events=listen(game,h.audio);
  placeFive(game);game.speed=3;const active=game.selection;assert.equal(game.keep(),true);await flush();
  assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].playbackRate.value,1);
  game.select(null);game.select(active.id);assert.equal(h.context.speech[0].stopped,false);
  const source=h.audio.selectionVoice.source;
  assert.equal(game.startCombat(),true);game.paused=true;game.select(null);game.select(active.id);await flush();game.tick(.2);
  assert.equal(h.context.speech.length,1);assert.equal(h.audio.selectionVoice.source,source);assert.equal(source.stopped,false);assert.equal(source.playbackRate.value,1);
  assert.equal(await h.audio.play('defender-committed',{tower:active,round:game.round,action:'keep'}),false,'starting the wave does not allow the same commitment to replay');
  assert.ok(!events.some(event=>['shot','impact','hit','death','aura-attack'].includes(event.type)));h.audio.dispose();
});

test('immediate Keep to wave start preserves pending fetch and decode, while mute still suppresses that line',async()=>{
  for(const stage of ['fetch','decode'])for(const muted of [false,true]){
    const pending=defer(),game=new Game(data,{seed:42});let fetches=0;
    const options={selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1};
    if(stage==='fetch')options.fetchAudio=()=>{fetches++;return pending.promise;};
    const h=harness(options);if(stage==='decode')h.context.decodeAudioData=()=>pending.promise;
    h.audio.unlock();const events=listen(game,h.audio);placeFive(game);const active=game.selection;
    assert.equal(game.keep(),true);game.speed=3;assert.equal(game.startCombat(),true);game.paused=true;
    game.select(null);game.select(active.id);game.tick(.2);await flush();
    assert.equal(h.context.speech.length,0);assert.equal(stage==='fetch'?fetches:h.requests.length,1);
    assert.equal(events.filter(event=>event.type==='defender-committed').length,1);assert.equal(events.filter(event=>event.type==='wave').length,1);
    assert.equal(await h.audio.play('defender-committed',{tower:active,round:game.round,action:'keep'}),false,'wave start cannot duplicate the pending commitment');
    if(muted)h.audio.muted=true;
    pending.resolve(stage==='fetch'?response(1):{clip:1,duration:1});await flush();
    if(muted){
      assert.equal(h.context.speech.length,0);h.audio.muted=false;
      assert.equal(await h.audio.play('defender-committed',{tower:active,round:game.round,action:'keep'}),false);
    }else{
      assert.equal(h.context.speech.length,1);assert.equal(h.context.speech[0].stopped,false);assert.equal(h.context.speech[0].playbackRate.value,1);
      const source=h.audio.selectionVoice.source;h.audio.play('wave');await flush();
      assert.equal(h.context.speech.length,1);assert.equal(h.audio.selectionVoice.source,source);assert.equal(source.stopped,false);
    }
    h.audio.dispose();
  }
});

test('new-run cancellation stops pending and playing commitments and permits a fresh game with reused tower IDs',async()=>{
  for(const stage of ['pending','playing']){
    const pending=defer(),game=new Game(data,{seed:42}),options={selectionCatalogue:familyCatalogue(...Object.keys(data.towers)),voiceRandom:()=>.1};
    if(stage==='pending')options.fetchAudio=()=>pending.promise;
    const h=harness(options);h.audio.unlock();listen(game,h.audio);placeFive(game);const previous=game.selection;
    assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);await flush();
    const previousSource=h.audio.selectionVoice?.source;assert.equal(h.context.speech.length,stage==='playing'?1:0);
    // startGame uses this transport boundary before replacing the real Game.
    h.audio.cancelSelectionVoice();assert.equal(h.audio.selectionVoice,null);
    if(previousSource)assert.equal(previousSource.stopped,true);
    if(stage==='pending'){pending.resolve(response(1));await flush();assert.equal(h.context.speech.length,0);}
    assert.equal(await h.audio.play('defender-committed',{tower:previous,round:1,action:'keep'}),false,'the interrupted old game cannot replay its result');
    const nextGame=new Game(data,{seed:42});listen(nextGame,h.audio);placeFive(nextGame);const next=nextGame.selection;
    assert.equal(next.id,previous.id);assert.notEqual(next,previous);assert.equal(nextGame.keep(),true);await flush();
    assert.equal(h.context.speech.length,stage==='playing'?2:1);assert.equal(h.audio.selectionVoice.source.stopped,false);h.audio.dispose();
  }
});

test('downgrade rejects insufficient gold silently and announces only the paid final lower rank',async()=>{
  const game=new Game(data,{seed:42}),h=harness({voiceRandom:()=>.1});h.audio.unlock();const events=listen(game,h.audio);placeFive(game);
  const candidate=game.towers[0];Object.assign(candidate,{family:'soldier',tier:3});game.select(candidate.id);
  game.economy.gold=data.balance.downgradeCost-1;assert.equal(game.downgrade(),false);await flush();assert.equal(h.context.speech.length,0);
  assert.equal(candidate.state,'draft');assert.equal(candidate.tier,3);assert.equal(events.filter(event=>event.type==='defender-committed').length,0);
  game.economy.gold=data.balance.downgradeCost;assert.equal(game.downgrade(),true);await flush();
  const committed=events.find(event=>event.type==='defender-committed');
  assert.equal(committed.payload.action,'downgrade');assert.equal(committed.state,'active');assert.equal(committed.family,'soldier');assert.equal(committed.tier,2);
  assert.ok(events.findIndex(event=>event.type==='keep')<events.indexOf(committed));assert.equal(h.context.speech.length,1);assert.equal(game.economy.gold,0);h.audio.dispose();
});

test('null, unrevealed, reserved and ruin commit payloads never load speech or interrupt a valid line',async()=>{
  const h=harness({voiceRandom:()=>.1}),active=tower();h.audio.unlock();assert.equal(await h.audio.play('defender-committed',{tower:active}),true);
  const source=h.audio.selectionVoice.source;
  for(const invalid of [null,{},...['draft','reserved','ruin'].map(state=>({...tower(2),state}))])assert.equal(await h.audio.play('defender-committed',{tower:invalid}),false);
  assert.equal(await h.audio.play('defender-committed',{tower:tower(3),visible:false}),false);
  assert.equal(h.requests.length,1);assert.equal(h.context.speech.length,1);assert.equal(source.stopped,false);h.audio.dispose();
});

test('endgame and command actions cancel pending and playing speech without permitting duplicate replay',async()=>{
  for(const event of ['won','lost','reroll','reserve','move']){
    const pending=defer(),defender=tower(),h=harness({voiceRandom:()=>.1,fetchAudio:()=>pending.promise});h.audio.unlock();
    const loading=h.audio.play('defender-committed',{tower:defender});h.audio.play(event);pending.resolve(response(1));
    assert.equal(await loading,false,event);assert.equal(await h.audio.play('defender-committed',{tower:defender}),false,event);assert.equal(h.context.speech.length,0);h.audio.dispose();
    const playing=harness({voiceRandom:()=>.1}),other=tower();playing.audio.unlock();assert.equal(await playing.audio.play('defender-committed',{tower:other}),true);
    playing.audio.play(event);assert.equal(playing.context.speech[0].stopped,true,event);assert.equal(playing.audio.selectionVoice,null);
    assert.equal(await playing.audio.play('defender-committed',{tower:other}),false,event);assert.equal(playing.context.speech.length,1);playing.audio.dispose();
  }
});

test('muted or locked commitment does not queue a line for a later gesture',async()=>{
  const h=harness({voiceRandom:()=>.1}),locked=tower();assert.equal(await h.audio.play('defender-committed',{tower:locked}),false);
  h.audio.unlock();assert.equal(await h.audio.play('defender-committed',{tower:locked}),false);assert.equal(h.requests.length,0);
  const muted=tower(2);h.audio.muted=true;assert.equal(await h.audio.play('defender-committed',{tower:muted}),false);
  h.audio.muted=false;assert.equal(await h.audio.play('defender-committed',{tower:muted}),false);assert.equal(h.requests.length,0);
  const next=tower(3);assert.equal(await h.audio.play('defender-committed',{tower:next}),true);h.audio.muted=true;h.audio.muted=false;
  assert.equal(await h.audio.play('defender-committed',{tower:next}),false);assert.equal(h.context.speech.length,1);h.audio.dispose();
});

test('a pending line cannot play after its committed tower becomes inactive or changes identity',async()=>{
  for(const mutation of [{state:'reserved'},{family:'archer'},{tier:2}]){
    const pending=defer(),defender=tower(),h=harness({voiceRandom:()=>.1,fetchAudio:()=>pending.promise});h.audio.unlock();
    const loading=h.audio.play('defender-committed',{tower:defender});Object.assign(defender,mutation);pending.resolve(response(1));
    assert.equal(await loading,false);assert.equal(h.context.speech.length,0);h.audio.dispose();
  }
});

test('crafting an existing active army between waves announces its actual new champion rather than an ingredient',async()=>{
  const game=new Game(data,{seed:42}),recipe=game.recipes.find(recipe=>recipe.id==='rimewatch');
  const families=[...recipe.ingredients.map(piece=>piece.family),'rimewatch'],h=harness({selectionCatalogue:familyCatalogue(...families),voiceRandom:()=>.1});h.audio.unlock();const events=listen(game,h.audio),army=[];
  for(const [index,piece] of recipe.ingredients.entries()){
    placeFive(game,3+index);const candidate=game.towers.find(unit=>unit.state==='draft');Object.assign(candidate,piece);game.select(candidate.id);assert.equal(game.keep(),true);army.push(candidate);await flush();
    if(index<recipe.ingredients.length-1){finishWave(game);h.context.nodes.forEach(node=>node.finish());}
  }
  game.select(army[0].id);await flush();assert.equal(h.context.speech.length,recipe.ingredients.length);
  assert.equal(game.phase,'ready');assert.equal(game.craft(recipe.id),true);await flush();
  const committed=events.filter(event=>event.type==='defender-committed').at(-1);
  assert.equal(committed.payload.action,'craft');assert.equal(committed.payload.tower,army[0]);assert.equal(committed.state,'active');assert.equal(committed.family,'rimewatch');assert.equal(committed.tier,1);
  assert.equal(h.context.speech.length,recipe.ingredients.length+1);assert.equal(h.requests.at(-1).url,'/rimewatch-a.wav');assert.equal(army[1].state,'ruin');assert.equal(army[2].state,'ruin');h.audio.dispose();
});
