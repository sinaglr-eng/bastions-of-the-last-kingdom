import {ALLIED_VOICE_CLIP_COUNT,ALLIED_VOICE_REVISION} from './voice-assets.js';

// Called only by the DEV dialog's native user action. Decode, never play, each
// existing recording through the same browser AudioContext as gameplay.
export async function recordedVoiceReview(audio){
  const entries=[...audio.selectionCatalogue.entries()].flatMap(([family,pair])=>pair.map(clip=>({family,...clip})));
  const base={schemaVersion:1,revision:ALLIED_VOICE_REVISION,expected:ALLIED_VOICE_CLIP_COUNT,catalogueClips:entries.length};
  if(audio.muted||audio.disposed||!audio.context)return {...base,status:'unavailable',decoded:0,reason:audio.muted?'Unmute the game, then check again.':'A browser audio context is unavailable.',clips:[]};
  const buffers=await audio.preloadSelectionClips();
  const clips=entries.map((clip,index)=>{
    const buffer=buffers[index],decoded=!!buffer&&Number.isFinite(buffer.duration)&&buffer.duration>0&&Number.isFinite(buffer.sampleRate)&&buffer.sampleRate>0&&Number.isInteger(buffer.numberOfChannels)&&buffer.numberOfChannels>0;
    return {...clip,decoded,...(decoded?{durationSeconds:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,frames:buffer.length}:{})};
  });
  const successes=clips.filter(clip=>clip.decoded),decoded=successes.length;
  return {...base,status:decoded===ALLIED_VOICE_CLIP_COUNT&&entries.length===ALLIED_VOICE_CLIP_COUNT?'passed':'failed',decoded,contextState:audio.context.state,totalDurationSeconds:successes.reduce((sum,clip)=>sum+clip.durationSeconds,0),sampleRates:[...new Set(successes.map(clip=>clip.sampleRate))].sort((a,b)=>a-b),clips};
}
