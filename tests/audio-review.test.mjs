import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recordedVoiceReview} from '../game/audio/voice-review.js';
import {ALLIED_VOICE_CLIP_COUNT,ALLIED_VOICE_REVISION} from '../game/audio/voice-assets.js';
import {CURRENT_DEFENDER_VOICE_CLIP_COUNT,CURRENT_VOICE_REVIEW} from '../game/audio/current-voice-assets.js';

function fixture({count=92,buffers}={}){
  let loads=0,plays=0;
  const entries=Array.from({length:count/2},(_,index)=>[`family${index}`,[{id:`${index}_a`,url:`/${index}_a.mp3`},{id:`${index}_b`,url:`/${index}_b.mp3`}]]);
  const audio={selectionCatalogue:new Map(entries),muted:false,disposed:false,context:{state:'running'},preloadSelectionClips:async()=>{loads++;return buffers||Array.from({length:count},()=>({duration:2.25,sampleRate:48000,numberOfChannels:1,length:108000}));},play:()=>{plays++;}};
  return {audio,loads:()=>loads,plays:()=>plays};
}

test('native recorded voice review reports all real buffer properties without playing clips',async()=>{
  const h=fixture(),before=[...h.audio.selectionCatalogue.entries()],result=await recordedVoiceReview(h.audio);
  assert.equal(result.status,'passed');assert.equal(result.expected,ALLIED_VOICE_CLIP_COUNT);assert.equal(result.decoded,92);
  assert.equal(result.revision,ALLIED_VOICE_REVISION);assert.equal(result.clips.length,92);assert.equal(result.totalDurationSeconds,207);
  assert.deepEqual(result.sampleRates,[48000]);assert.ok(result.clips.every(clip=>clip.decoded&&clip.channels===1&&clip.frames===108000));
  assert.equal(h.loads(),1);assert.equal(h.plays(),0);assert.deepEqual([...h.audio.selectionCatalogue.entries()],before);
});

test('native review cannot report success for a partial catalogue or failed browser decode',async()=>{
  const partial=await recordedVoiceReview(fixture({count:2}).audio);assert.equal(partial.status,'failed');assert.equal(partial.decoded,2);assert.equal(partial.expected,92);
  const buffers=Array.from({length:92},()=>({duration:1,sampleRate:44100,numberOfChannels:2,length:44100}));buffers[17]=null;buffers[21]={duration:0,sampleRate:44100,numberOfChannels:2};
  const result=await recordedVoiceReview(fixture({buffers}).audio);assert.equal(result.status,'failed');assert.equal(result.decoded,90);
  assert.equal(result.clips[17].decoded,false);assert.equal(result.clips[21].decoded,false);
});

test('complete faction voice review uses its declared identity without weakening the approved legacy check',async()=>{
  const current=fixture({count:CURRENT_DEFENDER_VOICE_CLIP_COUNT}),result=await recordedVoiceReview(current.audio,CURRENT_VOICE_REVIEW);
  assert.equal(result.status,'passed');assert.equal(result.expected,272);assert.equal(result.decoded,272);assert.equal(result.revision,CURRENT_VOICE_REVIEW.revision);assert.equal(current.plays(),0);
  const onlyLegacy=await recordedVoiceReview(fixture().audio,CURRENT_VOICE_REVIEW);
  assert.equal(onlyLegacy.status,'failed');assert.equal(onlyLegacy.expected,272);assert.equal(onlyLegacy.decoded,92,'an unchanged Human-only catalogue cannot pass as complete faction coverage');
  const missing=fixture({count:270});assert.equal((await recordedVoiceReview(missing.audio,CURRENT_VOICE_REVIEW)).status,'failed');
});

test('voice review rejects an invalid declared revision or A/B clip count',async()=>{
  for(const options of [{revision:'',expected:272},{revision:'current',expected:271},{revision:'current',expected:0},{revision:'current',expected:NaN}])await assert.rejects(recordedVoiceReview(fixture().audio,options),TypeError);
});

test('muted, disposed and unavailable browser audio contexts fail visibly without starting loads',async()=>{
  for(const update of [{muted:true},{disposed:true},{context:null}]){
    const h=fixture();Object.assign(h.audio,update);const result=await recordedVoiceReview(h.audio);
    assert.equal(result.status,'unavailable');assert.equal(result.decoded,0);assert.ok(result.reason);assert.equal(h.loads(),0);assert.equal(h.plays(),0);
  }
});

test('native decode check is reachable only through the DEV dialog and writes its result to visible DOM',()=>{
  const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
  assert.match(main,/function debugPanel\(\)\{if\(!debug\)return/);
  assert.match(main,/async function reviewRecordedVoices\(button\)\{\s*if\(!debug\)return/);
  assert.match(main,/action==='debug-audio-review'&&debug/);assert.match(main,/data-action="debug-audio-review">Check recorded voices/);
  assert.match(main,/id="audio-review-status" role="status" aria-live="polite"/);assert.match(main,/report\.textContent=JSON\.stringify\(result,null,2\)/);
  assert.doesNotMatch(main,/__BASTIONS__=\{[^}]*audio/);
});
