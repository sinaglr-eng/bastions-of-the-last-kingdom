import {siteUrl} from './site-url.js';

export const GAME_VERSION='0.2.8';
export const DEFENDER_ART_VERSION='hooded-turnarounds-v3.1';
export const CHAMPION_ART_VERSION=DEFENDER_ART_VERSION;
// Updated assets must replace cached portraits and models from earlier editions.
export const releaseAsset=path=>`${siteUrl(path)}?v=${CHAMPION_ART_VERSION}`;
export const defenderPortrait=(family,tier=1)=>releaseAsset(`assets/army/${family}-t${tier}.png`);
