import {siteUrl} from './site-url.js';

export const GAME_VERSION='0.3.16';
export const DEFENDER_ART_VERSION='geometric-game-v6';
export const CHAMPION_ART_VERSION=DEFENDER_ART_VERSION;
export const ENEMY_ART_VERSION='geometric-game-v7';
export const SCENERY_ART_VERSION='scenery-v9';
// Updated assets must replace cached portraits and models from earlier editions.
export const releaseAsset=path=>`${siteUrl(path)}?v=${/\/scenery\//.test(path)?SCENERY_ART_VERSION:/geometric-enemies\.json$|\/enemies\/|\/portraits\/host_/.test(path)?ENEMY_ART_VERSION:CHAMPION_ART_VERSION}`;
const basicFamilies=new Set(['soldier','archer','mage','frostwarden','stormcaller','cleric','druid','runebreaker']);
export const defenderPortrait=(family,tier=1)=>releaseAsset(`assets/geometric/portraits/${family}${basicFamilies.has(family)?'-'+tier:''}.png`);
export const enemyPortrait=id=>releaseAsset(`assets/geometric/portraits/${id}.png`);
