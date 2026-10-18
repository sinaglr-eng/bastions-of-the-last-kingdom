import {siteUrl} from '../game/site-url.js';

// UI cutouts keep exact original RGB pixels and add a transparent alpha mask.
// Original crops remain immutable; model, scenery and audio revisions are separate.
export const ORIGINAL_REFERENCE_PORTRAIT_REVISION='original-reference-20261016-v1';
export const REFERENCE_PORTRAIT_REVISION='reference-cutouts-20261016-v1';
const basicFamilies=['soldier','archer','mage','frostwarden','stormcaller','cleric','druid','runebreaker'];
const championFamilies=['rimewatch','frostblade','roseguard','highking','crownofages','thornwarden','verdantguard','tempest','stormcitadel','embercrown','worldfire','starfall','thunderheart','phoenix','greenheart','eldergrove','kingsreach','sunward','winterhold','dawnspire','royalmarshal','stonewarden','wyvernhunter','royalarsenal','rangermentor','kingdomprotector','mothernature','royalranger','kingsrangerguard','elvenking','fireballista','emeraldgolem','griffinbomber','mechanicalgolem','monk','archbishop','archangel','ladyclaire'];
const basics=new Set(basicFamilies),champions=new Set(championFamilies);
const enemyIds=Array.from({length:50},(_,index)=>`host_${String(index+1).padStart(2,'0')}`);
const enemies=new Set(enemyIds);
const identities=new Set([...basicFamilies.flatMap(family=>Array.from({length:6},(_,index)=>`${family}-${index+1}`)),...championFamilies,...enemyIds]);

// Pure URL lookup: constructing this catalogue never creates an Image, fetch,
// preload or hidden-draft identity request. Unknown inputs have no fallback.
export function referencePortrait(id,{base,revision=REFERENCE_PORTRAIT_REVISION}={}){
  if(!identities.has(id))return null;
  return `${siteUrl(`assets/ui/reference-cutouts/${id==='host_50'?'host_50-crimson':id}.png`,base)}?v=${encodeURIComponent(revision)}`;
}

export function referenceDefenderPortrait(family,tier=1,options){
  if(!Number.isInteger(tier))return null;
  if(basics.has(family))return tier>=1&&tier<=6?referencePortrait(`${family}-${tier}`,options):null;
  return champions.has(family)&&tier===1?referencePortrait(family,options):null;
}

export function referenceEnemyPortrait(id,options){
  return enemies.has(id)?referencePortrait(id,options):null;
}

export function referencePortraitImageMap(options){
  const images={};
  for(const family of basicFamilies){
    for(let tier=1;tier<=6;tier++)images[`${family}:${tier}`]=referenceDefenderPortrait(family,tier,options);
    images[family]=images[`${family}:1`];
  }
  for(const family of championFamilies)images[family]=images[`${family}:1`]=referenceDefenderPortrait(family,1,options);
  for(const id of enemyIds)images[`enemy:${id}`]=referenceEnemyPortrait(id,options);
  return images;
}
