import {siteUrl} from '../game/site-url.js';

const artwork={
  maze:'ornate/maze-builder.webp?v=faceted-maze',
  wave:'hud-generated/wave.webp', shield:'hud-generated/keep-health.webp',
  coin:'hud-generated/gold.webp', command:'hud-generated/command-points.webp',
  clock:'hud-generated/time.webp', spark:'hud-generated/command-points.webp',
  commander:'commander-generated/commander.webp', book:'hud-generated/recipes.webp',
  warband:'hud-generated/enemy-waves.webp', sound:'commander-generated/skill-war-horn.webp',
  settings:'hud-generated/settings.webp', crown:'commander-feedback/champions.webp',
  basic:'commander-feedback/basic-defenders.webp', swords:'commander-generated/skill-blood-wrath.webp',
  bow:'commander-generated/skill-extended-range.webp',
};
const interfaceIcons=new Set([
  'loading','compass','play','pause','path','grid','reset','help','close','check','pin','target',
  'chevron','mute','snow','fire','flask','sun','hammer','bolt','scroll',
]);
export function iconArt(name){
  const file=interfaceIcons.has(name)?'war-table/ui-icons/'+name+'.webp':Object.hasOwn(artwork,name)?artwork[name]:artwork.shield;
  return siteUrl('assets/ui/'+file);
}
export function icon(name,cls=''){
  return `<img class="icon ${cls}" src="${iconArt(name)}" width="24" height="24" alt="" aria-hidden="true" draggable="false">`;
}
export const ornateIcon=(name,cls='')=>icon(name,'illustrated-icon '+cls);
