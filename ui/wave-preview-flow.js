// Intelligence describes the next assault without delaying the existing draft.
export function nextWavePreviewIndex(game){
  if(!game||['won','lost'].includes(game.phase))return null;
  const index=game.phase==='combat'?game.round:game.round-1;
  return index>=0&&index<game.waveLimit?index:null;
}

export function previewDisclosureOpen({index,previousIndex,round,previousRound,preparing,open}){
  if(index!==previousIndex||round!==previousRound)return !!preparing;
  return !!open;
}
