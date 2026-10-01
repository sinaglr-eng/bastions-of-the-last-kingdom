// An exhibition model, never a combat entity or an extra random tower draw.
export function upcomingInvader(game){
  if(['won','lost'].includes(game.phase))return null;
  const waveIndex=game.round-1+(game.phase==='combat'?1:0);
  if(waveIndex>=game.waveLimit)return null;
  const wave=game.data.waves[waveIndex],group=wave?.groups[0];
  if(!group)return null;
  const base=game.data.enemies[group.type];
  if(!base)return null;
  return {...base,...base.variants?.[0],type:group.type,previewRound:waveIndex+1};
}
