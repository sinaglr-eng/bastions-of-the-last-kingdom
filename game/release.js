import {siteUrl} from './site-url.js';

export const GAME_VERSION='0.2.3';
export const CHAMPION_ART_VERSION='champions-v6.3';
// Updated assets must replace cached portraits and models from earlier editions.
export const releaseAsset=path=>`${siteUrl(path)}?v=${CHAMPION_ART_VERSION}`;
