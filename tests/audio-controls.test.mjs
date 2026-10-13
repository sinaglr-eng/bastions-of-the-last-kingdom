import test from 'node:test';
import assert from 'node:assert/strict';
import {AudioManager} from '../game/audio/audio.js';
import {audioControlsMarkup,connectAudioControls} from '../ui/audio-controls.js';

class Control extends EventTarget{
  constructor(){super();this.value='';this.textContent='';this.attributes=new Map();}
  setAttribute(name,value){this.attributes.set(name,value);}getAttribute(name){return this.attributes.get(name);}
}
function panel(){
  const music=new Control(),sounds=new Control(),musicValue=new Control(),soundsValue=new Control(),mute=new Control();
  const selectors=new Map([['[data-audio-category="music"]',music],['[data-audio-category="sounds"]',sounds],['[data-audio-value="music"]',musicValue],['[data-audio-value="sounds"]',soundsValue],['[data-audio-mute]',mute]]);
  return {querySelector:selector=>selectors.get(selector),music,sounds,musicValue,soundsValue,mute};
}

test('the mounted controls expose labelled native 0–100 ranges, visible percentages and a separate global mute toggle',()=>{
  const audio=new AudioManager(true,{categoryVolumes:{music:31,sounds:66}});try{
    const markup=audioControlsMarkup(audio);assert.match(markup,/<section[^>]+id="audio-controls"[^>]+hidden>/);assert.match(markup,/<label for="audio-music">Music<\/label>/);assert.match(markup,/<label for="audio-sounds">Sounds<\/label>/);
    assert.equal((markup.match(/type="range" min="0" max="100" step="1"/g)||[]).length,2);assert.match(markup,/value="31" aria-valuetext="31%"/);assert.match(markup,/value="66" aria-valuetext="66%"/);assert.match(markup,/>31%<\/output>/);assert.match(markup,/>66%<\/output>/);assert.match(markup,/data-audio-mute aria-pressed="true">Mute all<\/button>/);
  }finally{audio.dispose();}
});

test('native input events apply live settings and accessible values without resetting the other slider or mute',()=>{
  const audio=new AudioManager(true),host=panel(),changes=[],muteChanges=[];
  const controller=connectAudioControls(host,{audio,onVolumeChange:(category,value)=>changes.push([category,value]),onMuteChange:muted=>muteChanges.push(muted)});
  try{
    assert.equal(host.music.value,'80');assert.equal(host.sounds.value,'40');host.music.value='0';host.music.dispatchEvent(new Event('input'));
    assert.equal(audio.getCategoryVolume('music'),0);assert.equal(audio.getCategoryVolume('sounds'),40);assert.equal(audio.muted,true);assert.equal(host.musicValue.textContent,'0%');assert.equal(host.music.getAttribute('aria-valuetext'),'0%');assert.deepEqual(changes,[['music',0]]);
    host.sounds.value='76';host.sounds.dispatchEvent(new Event('input'));assert.equal(audio.getCategoryVolume('sounds'),76);assert.equal(host.soundsValue.textContent,'76%');assert.equal(host.music.value,'0');assert.deepEqual(changes,[['music',0],['sounds',76]]);
    controller.refresh();assert.equal(host.music.value,'0');assert.equal(host.sounds.value,'76');assert.equal(audio.context,null);assert.equal(host.mute.getAttribute('aria-pressed'),'true');assert.deepEqual(muteChanges,[]);
  }finally{controller.dispose();audio.dispose();}
});

test('Mute all preserves chosen category values and refresh/dispose never replay input changes',()=>{
  const audio=new AudioManager(false,{categoryVolumes:{music:20,sounds:70},contextFactory:()=>null}),host=panel(),muted=[],changes=[];
  const controller=connectAudioControls(host,{audio,onVolumeChange:(...values)=>changes.push(values),onMuteChange:value=>muted.push(value)});
  try{
    host.mute.dispatchEvent(new Event('click'));assert.equal(audio.muted,true);assert.equal(host.mute.getAttribute('aria-pressed'),'true');assert.equal(host.mute.title,'Unmute all audio');
    host.mute.dispatchEvent(new Event('click'));assert.equal(audio.muted,false);assert.deepEqual(muted,[true,false]);assert.equal(host.music.value,'20');assert.equal(host.sounds.value,'70');
    audio.setCategoryVolume('music',56);controller.refresh();assert.equal(host.music.value,'56');assert.equal(host.musicValue.textContent,'56%');assert.deepEqual(changes,[]);
    controller.dispose();host.music.value='99';host.music.dispatchEvent(new Event('input'));host.mute.dispatchEvent(new Event('click'));assert.equal(audio.getCategoryVolume('music'),56);assert.equal(audio.muted,false);assert.deepEqual(muted,[true,false]);
  }finally{controller.dispose();audio.dispose();}
});
