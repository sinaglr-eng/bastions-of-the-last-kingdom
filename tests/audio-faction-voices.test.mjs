import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioManager} from '../game/audio/audio.js';
import {siteUrl} from '../game/site-url.js';
import {CURRENT_DEFENDER_VOICE_CATALOGUE,CURRENT_DEFENDER_VOICE_REVISION} from '../game/audio/current-voice-assets.js';

const pair=(family,prefix='')=>['a','b'].map(suffix=>({id:`ally_${family}_select_${suffix}`,url:`${prefix}ally_${family}_select_${suffix}.mp3`}));
class Param{setValueAtTime(value){this.value=value;}cancelScheduledValues(){}linearRampToValueAtTime(){}exponentialRampToValueAtTime(){}}
class Node{constructor(){this.gain=new Param();this.playbackRate=new Param();}connect(){}disconnect(){}start(){this.started=true;}stop(){this.stopped=true;}}
class Context{
  constructor(){this.currentTime=0;this.state='running';this.destination={};this.sources=[];}
  createGain(){return new Node();}
  createBufferSource(){const source=new Node();this.sources.push(source);return source;}
  decodeAudioData(bytes){return Promise.resolve({clip:new Uint8Array(bytes)[0],duration:2,sampleRate:44100,numberOfChannels:1,length:88200});}
  close(){return Promise.resolve();}
}
const bytes=id=>({ok:true,arrayBuffer:async()=>new Uint8Array([id]).buffer});

test('complete catalogue resolves native voices and exact approved Human clips for root, project and portable bases',async()=>{
  for(const base of ['/','/bastions-of-the-last-kingdom/','./']){
    const url=new URL(siteUrl(CURRENT_DEFENDER_VOICE_CATALOGUE,base),'https://example.test/portable/index.html').href;
    const raw={soldier:pair('soldier','../allied-recast-20261011/'),dw_musketeer:pair('dw_musketeer'),el_grove_archer:pair('el_grove_archer')};
    const requested=[],audio=new AudioManager(false,{fetchAudio:async requestedUrl=>{requested.push(requestedUrl);return {ok:true,url,json:async()=>raw};}});
    assert.equal(await audio.loadSelectionCatalogue(url),3);assert.equal(audio.context,null,'loading metadata does not unlock or play audio');assert.deepEqual(requested,[url]);
    for(const [family,clips]of audio.selectionCatalogue){assert.equal(clips.length,2);for(const [index,clip]of clips.entries()){
      const expected=new URL(raw[family][index].url,url);expected.searchParams.set('v',CURRENT_DEFENDER_VOICE_REVISION);assert.equal(clip.url,expected.href);
      assert.equal(clip.id,raw[family][index].id);
    }}
    assert.ok(audio.selectionCatalogue.get('soldier')[0].url.includes('/allied-recast-20261011/'));assert.ok(audio.selectionCatalogue.get('dw_musketeer')[0].url.includes('/voice-completion-current/'));
    audio.dispose();
  }
});

test('all native basic ranks use their own stable family voice and do not borrow the Human casting',async()=>{
  const context=new Context(),requests=[],catalogue={soldier:pair('soldier'),dw_musketeer:pair('dw_musketeer'),el_grove_archer:pair('el_grove_archer')};
  const audio=new AudioManager(false,{contextFactory:()=>context,selectionCatalogue:catalogue,voiceRandom:()=>.1,fetchAudio:async url=>{requests.push(url);return bytes(url.includes('dw_musketeer')?2:url.includes('el_grove_archer')?3:1);}});audio.unlock();
  for(const family of ['dw_musketeer','el_grove_archer'])for(let tier=1;tier<=6;tier++){
    const tower={id:family+'/'+tier,family,tier,state:'active'};assert.equal(await audio.play('defender-committed',{tower,round:38,action:'keep'}),true);
    assert.equal(context.sources.at(-1).buffer.clip,family==='dw_musketeer'?2:3);assert.equal(context.sources.at(-1).playbackRate.value,1,'game speed does not alter character delivery');
  }
  assert.deepEqual(requests,['ally_dw_musketeer_select_a.mp3','ally_el_grove_archer_select_a.mp3'],'ranks share the character identity and decoded clip rather than requesting rank-specific or Human fallback audio');
  audio.dispose();
});

test('an unconfigured native identity stays silent instead of using a Human fallback or a provisional draft voice',async()=>{
  const context=new Context(),requests=[],audio=new AudioManager(false,{contextFactory:()=>context,selectionCatalogue:{soldier:pair('soldier')},fetchAudio:async url=>{requests.push(url);return bytes(1);}});audio.unlock();
  assert.equal(await audio.play('defender-committed',{tower:{id:1,family:'dw_steamrail',tier:1,state:'active'},round:38}),false);
  assert.equal(await audio.play('defender-committed',{tower:{id:2,family:'soldier',tier:1,state:'draft'},round:38}),false);
  assert.equal(context.sources.length,0);assert.deepEqual(requests,[]);audio.dispose();
});
