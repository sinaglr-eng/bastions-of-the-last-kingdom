import {siteUrl} from './site-url.js';

export const GAME_VERSION='0.3.18';
export const DEFENDER_ART_VERSION='basic-defenders-v7';
export const CHAMPION_ART_VERSION='champions-v8';
export const ENEMY_ART_VERSION='geometric-game-v7';
export const SCENERY_ART_VERSION='scenery-v9';
const basicFamilies=new Set(['soldier','archer','mage','frostwarden','stormcaller','cleric','druid','runebreaker']);
// Every revised roster has its own cache key; unchanged scenery and enemies
// retain their reviewed native export revision.
export function releaseAsset(path){
  const champion=/geometric-champions\.json$|\/champions\//.test(path)||/\/portraits\/([^/]+)\.png$/.test(path)&&!basicFamilies.has(path.match(/\/portraits\/([^/]+)\.png$/)[1].replace(/-\d+$/,''));
  const revision=/\/scenery\//.test(path)?SCENERY_ART_VERSION:/geometric-enemies\.json$|\/enemies\/|\/portraits\/host_/.test(path)?ENEMY_ART_VERSION:/source-manifest\.json$/.test(path)?GAME_VERSION:champion?CHAMPION_ART_VERSION:DEFENDER_ART_VERSION;
  return siteUrl(path)+'?v='+revision;
}
export const defenderPortrait=(family,tier=1)=>releaseAsset('assets/geometric/portraits/'+family+(basicFamilies.has(family)?'-'+tier:'')+'.png');
export const enemyPortrait=id=>releaseAsset('assets/geometric/portraits/'+id+'.png');
