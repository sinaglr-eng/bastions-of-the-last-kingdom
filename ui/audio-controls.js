const categories=[['music','Music'],['sounds','Sounds']];

export function audioControlsMarkup(audio){
  return `<section class="audio-controls" id="audio-controls" aria-label="Audio controls" hidden><h2>Audio controls</h2>${categories.map(([category,label])=>{
    const value=audio.getCategoryVolume(category);
    return `<div class="audio-volume-row"><label for="audio-${category}">${label}</label><output for="audio-${category}" data-audio-value="${category}">${value}%</output><input id="audio-${category}" data-audio-category="${category}" type="range" min="0" max="100" step="1" value="${value}" aria-valuetext="${value}%"></div>`;
  }).join('')}<button type="button" class="text-button audio-mute-all" data-audio-mute aria-pressed="${audio.muted}">Mute all</button></section>`;
}

// Mount once beneath the existing audio icon. Refresh reads current settings;
// opening/closing the popover never resets volumes or rebuilds its range inputs.
export function connectAudioControls(panel,{audio,onVolumeChange=()=>{},onMuteChange=()=>{}}){
  const controls=categories.map(([category])=>({category,input:panel.querySelector(`[data-audio-category="${category}"]`),output:panel.querySelector(`[data-audio-value="${category}"]`)}));
  const mute=panel.querySelector('[data-audio-mute]');
  const refresh=()=>{
    for(const {category,input,output}of controls){const value=audio.getCategoryVolume(category);input.value=String(value);input.setAttribute('aria-valuetext',`${value}%`);output.textContent=`${value}%`;}
    mute.setAttribute('aria-pressed',String(audio.muted));mute.title=audio.muted?'Unmute all audio':'Mute all audio';
  };
  const bindings=controls.map(({category,input})=>{
    const listener=()=>{audio.unlock();const value=audio.setCategoryVolume(category,Number(input.value));refresh();onVolumeChange(category,value);};
    input.addEventListener('input',listener);return {input,listener};
  });
  const toggleMute=()=>{audio.muted=!audio.muted;if(!audio.muted)audio.unlock();refresh();onMuteChange(audio.muted);};
  mute.addEventListener('click',toggleMute);refresh();
  return {refresh,dispose(){for(const {input,listener}of bindings)input.removeEventListener('input',listener);mute.removeEventListener('click',toggleMute);}};
}
