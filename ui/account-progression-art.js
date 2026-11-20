import {siteUrl} from '../game/site-url.js';

export const ACCOUNT_PROGRESSION_ART_REVISION='account-progression-art-20261115-reference-raster';
const BASE='assets/ui/account-progression/';
const names=Object.freeze(['Peasant','Militia','Recruit','Footman','Soldier','Veteran','Sergeant','Lieutenant','Captain','Major','Colonel','Commander','General','Marshal','King']);
export const ACCOUNT_RANK_ART=Object.freeze(names.map((name,index)=>Object.freeze({level:index+1,id:name.toLowerCase(),name,path:BASE+'rank-'+name.toLowerCase()+'.webp',vectorPath:BASE+'rank-'+name.toLowerCase()+'.svg',width:512,height:512,alt:name+' rank badge'})));
export const ALLIANCE_LOGO_ART=Object.freeze({
 wide:BASE+'alliance-logo.webp',
 original:BASE+'alliance-logo-original.png',
 vector:BASE+'alliance-logo.svg',
 light:BASE+'alliance-logo-light.svg',
 compact:BASE+'alliance-crest-compact.webp',
 crest:BASE+'alliance-crest.svg',
 monochrome:BASE+'alliance-logo-monochrome.svg',
 monochromeCrest:BASE+'alliance-crest-monochrome.svg',
 favicon:BASE+'favicon.svg'
});
export function accountRankArt(value=1){
 const rank=typeof value==='object'&&value?value.level??value.id??value.name:value;
 const record=typeof rank==='string'&&!/^\d+$/.test(rank)?ACCOUNT_RANK_ART.find(item=>item.id===rank.toLowerCase()):ACCOUNT_RANK_ART[Math.min(15,Math.max(1,Math.floor(Number(rank)||1)))-1];
 const item=record||ACCOUNT_RANK_ART[0];return {...item,src:siteUrl(item.path)};
}
export const accountRankArtwork=value=>accountRankArt(value).src;
export const allianceLogoArtwork=(variant='wide')=>siteUrl(ALLIANCE_LOGO_ART[variant]||ALLIANCE_LOGO_ART.wide);

