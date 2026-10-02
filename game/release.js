import {siteUrl} from './site-url.js';

export const GAME_VERSION='0.2.8';
export const CHAMPION_ART_VERSION='designed-defenders-v8.12';
// Updated assets must replace cached portraits and models from earlier editions.
export const releaseAsset=path=>`${siteUrl(path)}?v=${CHAMPION_ART_VERSION}`;
