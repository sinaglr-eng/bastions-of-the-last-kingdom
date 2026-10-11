// Separate revisions preserve the original recordings and approved MP3 bytes.
export const RECORDED_AUDIO_REVISION='approved-20261011-0019d4e4b9fa';
export const AUDIO_BANK_CATALOGUE=`assets/audio/approved-20261011/catalogue.json?v=${RECORDED_AUDIO_REVISION}`;
export const RECORDED_MUSIC_TRACK_COUNT=6;
export const RECORDED_ATTACK_TYPE_COUNT=15;

// Explicit DEV check only: decode approved music sequentially through the
// bounded production cache, without starting a source or consuming game RNG.
export async function recordedAudioBankReview(audio){
  const effects=[...audio.recordedEffects.values()],music=audio.music.tracks;
  const base={schemaVersion:1,revision:RECORDED_AUDIO_REVISION,expected:RECORDED_ATTACK_TYPE_COUNT+RECORDED_MUSIC_TRACK_COUNT,catalogueClips:effects.length+music.length};
  if(audio.muted||audio.disposed||!audio.context)return {...base,status:'unavailable',decoded:0,reason:audio.muted?'Unmute the game, then check again.':'A browser audio context is unavailable.',clips:[]};
  const details=(clip,buffer,category)=>{
    const decoded=!!buffer&&Number.isFinite(buffer.duration)&&buffer.duration>0&&Number.isFinite(buffer.sampleRate)&&buffer.sampleRate>0&&Number.isInteger(buffer.numberOfChannels)&&buffer.numberOfChannels>0;
    return {id:clip.id,url:clip.url,category,decoded,...(decoded?{durationSeconds:buffer.duration,sampleRate:buffer.sampleRate,channels:buffer.numberOfChannels,frames:buffer.length}:{})};
  };
  const buffers=await audio.preloadRecordedEffects(),clips=effects.map((clip,index)=>details(clip,buffers[index],'attack'));
  for(const clip of music)clips.push(details(clip,audio.disposed||audio.muted?null:await audio.music.reviewBuffer(clip),'music'));
  const decoded=clips.filter(clip=>clip.decoded).length;
  return {...base,status:decoded===base.expected&&effects.length===RECORDED_ATTACK_TYPE_COUNT&&music.length===RECORDED_MUSIC_TRACK_COUNT?'passed':'failed',decoded,contextState:audio.context.state,musicCacheBuffers:audio.music.cache.size,clips};
}
