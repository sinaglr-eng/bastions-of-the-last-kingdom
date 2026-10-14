import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AudioManager} from '../game/audio/audio.js';
import {recordedCatalogue} from '../game/audio/recorded-attacks.js';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {icon} from '../ui/icons.js';
import {craftRecipeKey} from '../ui/crafting-dock.js';

const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const bank=recordedCatalogue(JSON.parse(readFileSync(new URL('../public/assets/audio/approved-20261011/catalogue.json',import.meta.url))),'https://test.example/catalogue.json');
const flush=()=>new Promise(resolve=>setImmediate(resolve)),noop=()=>{};
class Param{constructor(){this.value=1;this.calls=[];}setValueAtTime(value,time){this.value=value;this.calls.push(['set',value,time]);}linearRampToValueAtTime(value,time){this.value=value;this.calls.push(['linear',value,time]);}cancelScheduledValues(time){this.calls.push(['cancel',time]);}}
class AudioNode{constructor(){this.gain=new Param();this.playbackRate=new Param();this.stops=[];this.disconnects=0;}connect(target){this.connected=target;}disconnect(){this.disconnects++;}start(time,offset=0){this.started=[time,offset];}stop(time){this.stops.push(time);}finish(){this.onended?.();}}
class Context{constructor(){this.currentTime=0;this.state='running';this.destination={};this.nodes=[];}createGain(){const node=new AudioNode();this.nodes.push(node);return node;}createBufferSource(){const node=new AudioNode();this.nodes.push(node);return node;}decodeAudioData(bytes){return Promise.resolve({duration:new Uint8Array(bytes)[0]});}close(){return Promise.resolve();}}
const reply=url=>({ok:true,arrayBuffer:async()=>new Uint8Array([url.includes('/music/')?96:2]).buffer});
function declaration(name){const match=new RegExp(`(?:async )?function ${name}\\(`).exec(main);assert.ok(match);const rest=main.slice(match.index),next=/\n(?:async )?function /.exec(rest);return rest.slice(0,next?.index??rest.length);}
async function fixture({paused=false,fetchAudio=reply}={}){
  const game=new Game(data,{seed:890}),context=new Context(),timers=new Map();let serial=0;
  game.phase='combat';game.paused=paused;game.combat.spawnQueue=[{time:1e8,type:'host_01'}];const enemy=game.combat.spawn('host_01');
  const audio=new AudioManager(false,{contextFactory:()=>context,fetchAudio,musicRandom:()=>0,voiceRandom:()=>0,selectionCatalogue:{archer:['archer-a.mp3','archer-b.mp3']},musicTimers:{setTimer:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimer:id=>timers.delete(id)}});audio.context=context;audio.music.configure(bank.music,bank.policy);audio.recordedEffects=new Map(bank.effects);audio.recordedDefenders=new Map(bank.defenders);
  const dialogListeners=new Map(),windowListeners=new Map(),documentListeners=new Map(),menu={open:true},child={insertAdjacentHTML:noop},content={innerHTML:'',querySelector:()=>child,querySelectorAll:()=>[]};
  const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;dialogListeners.get('close')?.();},addEventListener:(type,callback)=>dialogListeners.set(type,callback)},$=id=>id==='dialog'?dialog:content;
  const document={hidden:false,addEventListener:(type,callback)=>documentListeners.set(type,callback),querySelector:()=>menu},world={keys:new Set(),maze:{editing:false},doubleTap:{clear:noop},sync:noop},connections={};
  const bindings={game,audio,$,document,world,window:{addEventListener:(type,callback)=>windowListeners.set(type,callback)},icon,craftRecipeKey,data,balance:data.balance,images:{},debug:false,app:{addEventListener:noop},draftPointerInput:{clear:noop},draftCardActivation:{clear:noop},profile:{},recipeCatalogState:{},championCatalogMarkup:()=>'<p>Recipe boundary</p>',connectChampionCatalog:()=>({dispose:noop}),renderIntelligence:noop,renderWarbandsOverview:noop,supportMapLegendMarkup:()=>'',DeveloperConsoleSession,statistics:{tracker:{id:'dialog-run'},disableForDeveloper:noop},excludeRunResult:noop,gameProfileBaseline:{},startGame:noop,developerConsoleMarkup:()=>'<p>Console boundary</p>',connectDeveloperConsole:(_host,_session,options)=>{connections.options=options;return {dispose:noop};},WaveThreatAnalyzer:class{},ArmyReadiness:class{},debugPanel:noop,sendWave:noop};
  const syncLine=declaration('hud').split('\n').find(line=>line.includes('audio.syncGameState('));assert.ok(syncLine,'Exercise the actual saved production HUD audio call');
  const stampLine=main.split('\n').find(line=>line.startsWith('function stampCraftButtons('));assert.ok(stampLine);
  const background=main.split('\n').find(line=>line.includes("window.addEventListener('blur'")&&line.includes('draftPointerInput.clear()'));assert.ok(background);
  const names=['openDialog','closeDialog','dialogHeader','codex','warbands','fieldGuide','help','requestDeveloperConsole','openDeveloperConsole','handleCommand'];
  const functions=Function(...Object.keys(bindings),`let modalPaused=false,developerConnection=null,developerSession=null,recipeFilterConnection=null,threatAnalyzer=null,armyReadiness=null,intelligenceKey=null;${stampLine}\nfunction syncAudio(){${syncLine}}\nfunction render(){syncAudio();}\n${names.map(declaration).join('\n')}\n${background}\nreturn {${names.join(',')},syncAudio,get session(){return developerSession;},get modalPaused(){return modalPaused;}};`)(...Object.values(bindings));
  functions.syncAudio();await flush();
  return {game,enemy,audio,context,timers,dialog,document,connections,functions,windowListeners,documentListeners,async command(action){functions.handleCommand({target:{closest:()=>({disabled:false,dataset:{action}})},detail:1});functions.syncAudio();await flush();},dispose(){functions.session?.dispose();audio.dispose();}};
}

test('actual Recipes, Enemy Waves, Help, New run and Developer dialogs freeze combat without interrupting running music; explicit Pause stays paused',async()=>{
  for(const paused of [false,true])for(const action of ['codex','warbands','help','new-run','developer']){
    const h=await fixture({paused});try{
      const playing=h.audio.music.current,saved=h.audio.music.saved,clock=h.game.combat.elapsed,traveled=h.enemy.traveled,requests=h.audio.music.request;
      h.context.currentTime=4;await h.command(action);assert.equal(h.dialog.open,true);assert.equal(h.game.paused,true);h.game.tick(1);assert.equal(h.game.combat.elapsed,clock);assert.equal(h.enemy.traveled,traveled);
      assert.equal(h.audio.gameState.paused,true);assert.equal(h.audio.music.paused,paused);assert.equal(h.audio.music.current,playing);assert.equal(h.audio.music.saved,saved);assert.equal(h.audio.music.request,requests);if(playing)assert.deepEqual(playing.source.stops,[]);
      await h.command('close');assert.equal(h.game.paused,paused);assert.equal(h.audio.music.paused,paused);assert.equal(h.audio.music.current,playing);
    }finally{h.dispose();}
  }
});

test('dialog replacement preserves the same transport, speech duck and committed line while recorded attacks stop',async()=>{
  const h=await fixture();try{
    const tower={family:'archer',tier:1,state:'active',round:1};assert.equal(await h.audio.playSelectionVoice({tower,round:1}),true);assert.equal(await h.audio.playRecordedEffect(bank.defenders.get('archer').effects[0]),true);
    const selection=h.audio.selectionVoice,attack=[...h.audio.voices].find(voice=>voice!==selection),playing=h.audio.music.current,timerIds=[...h.timers.keys()];h.context.currentTime=7;
    for(const action of ['codex','warbands','help','new-run','developer']){await h.command(action);assert.equal(h.functions.modalPaused,false);assert.equal(h.audio.music.current,playing);assert.deepEqual(playing.source.stops,[]);assert.equal(h.audio.selectionVoice,selection);assert.deepEqual(selection.source.stops,[]);assert.equal(h.audio.music.ducked,true);assert.deepEqual([...h.timers.keys()],timerIds);}
    assert.equal(attack.source.disconnects,1);assert.equal(await h.audio.playRecordedEffect(bank.defenders.get('archer').effects[0]),false);await h.command('close');assert.equal(h.audio.music.current,playing);selection.source.finish();assert.equal(h.audio.music.ducked,false);
    await h.command('pause');assert.equal(h.audio.music.current,null);assert.equal(h.audio.music.saved.offset,7);await h.command('pause');assert.equal(h.audio.music.current.track.id,playing.track.id);assert.equal(h.audio.music.current.offset,7);
  }finally{h.dispose();}
});

test('a committed speech load can finish under dialog suspension while stale recorded attacks cannot',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve),h=await fixture({fetchAudio:async url=>url==='archer-a.mp3'||url===bank.effects.get('arrow').url?gate:reply(url)});try{
    const pending=h.audio.playSelectionVoice({tower:{family:'archer',tier:1,state:'active'},round:1}),pendingAttack=h.audio.playRecordedEffect('arrow');await flush();await h.command('codex');release(reply('archer-a.mp3'));assert.equal(await pending,true);assert.equal(await pendingAttack,false);assert.ok(h.audio.selectionVoice);assert.equal(h.audio.music.ducked,true);assert.equal(h.audio.gameState.paused,true);await h.command('close');assert.ok(h.audio.selectionVoice);
  }finally{h.dispose();}
});

test('actual Developer simulation callback supplies its manual pause state, and Mute all still suspends the same dialog soundtrack',async()=>{
  const h=await fixture();try{
    await h.command('developer');await h.command('developer-confirm');await h.functions.session.activation;await flush();h.functions.syncAudio();const playing=h.audio.music.current;assert.ok(playing);assert.equal(h.audio.music.paused,false);
    h.game.paused=true;h.connections.options.onMutation('simulation');await flush();assert.equal(h.functions.modalPaused,true);assert.equal(h.audio.music.paused,true);assert.equal(h.audio.music.current,null);
    h.game.paused=false;h.connections.options.onMutation('simulation');await flush();assert.equal(h.functions.modalPaused,false);assert.equal(h.audio.music.paused,false);assert.ok(h.audio.music.current);
    h.audio.muted=true;assert.equal(h.audio.music.current,null);h.audio.muted=false;await flush();assert.ok(h.audio.music.current);assert.equal(h.audio.music.current.track.id,playing.track.id);assert.equal(h.audio.getCategoryVolume('music'),80);assert.equal(h.audio.getCategoryVolume('sounds'),40);
  }finally{h.dispose();}
});

test('actual blur and hidden-page handlers preserve the existing real background pause even with a dialog open',async()=>{
  for(const trigger of ['blur','hidden']){
    const h=await fixture();try{
      await h.command('codex');const playing=h.audio.music.current;assert.ok(playing);h.context.currentTime=3;
      if(trigger==='blur')h.windowListeners.get('blur')();else{h.document.hidden=true;h.documentListeners.get('visibilitychange')();}
      await flush();assert.equal(h.game.paused,true);assert.equal(h.functions.modalPaused,true);assert.equal(h.audio.music.paused,true);assert.equal(h.audio.music.current,null);assert.equal(playing.source.stops.length,1);
      h.document.hidden=false;await h.command('close');assert.equal(h.game.paused,true);assert.equal(h.audio.music.paused,true);await h.command('pause');assert.equal(h.game.paused,false);assert.equal(h.audio.music.paused,false);assert.equal(h.audio.music.current.track.id,playing.track.id);assert.equal(h.audio.music.current.offset,3);
    }finally{h.dispose();}
  }
});
