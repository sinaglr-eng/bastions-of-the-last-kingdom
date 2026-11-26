import {GENERAL_SKILLS} from '../game/core/general.js';
import {commanderSkillArt} from './commander-art.js';
import {siteUrl} from '../game/site-url.js';
import {referenceEnemyPortrait} from './reference-portraits.js';

export const escapeProgression=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const illustration=key=>siteUrl('assets/ui/war-table/achievements/'+key+'.webp');

export function progressionArtwork(kind='collection'){
 if(GENERAL_SKILLS[kind])return commanderSkillArt(kind);
 if(kind==='boss')return referenceEnemyPortrait('host_50');
 const category=['collection','mastery','campaign','streak','endless','secret'].includes(kind)?kind:'collection';
 return siteUrl('assets/ui/war-table/'+category+'.webp');
}

// Flawless rewards continue after the authored single-scene series. The sequence
// of painted watchposts identifies the milestone even in endless campaigns.
function watchpostSequence(waves){
 const posts=[40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200];
 const route=[];
 for(const digit of String(Math.floor(waves/10))){
  const places=posts.filter(post=>!route.slice(-6).includes(post));
  route.push(places[Number(digit)]);
 }
 return route.map(post=>illustration('streak-global-'+post));
}

export function achievementPictureUrls(achievement,data,reveal=false){
 if(achievement.kind==='kills')return [progressionArtwork('endless')];
 if(achievement.secret)return [illustration((reveal?'discovery-':'sealed-')+achievement.factionId)];
 const id=achievement.id.split(':').at(-1);
 if(achievement.kind==='skill-mastery'&&GENERAL_SKILLS[id])return [commanderSkillArt(id)];
 if(achievement.kind==='champion'){
  const asset=data.defenderAssets?.find(a=>a.family===id&&a.tier===1);
  if(asset?.portrait)return [siteUrl(asset.portrait)];
 }
 if(achievement.kind==='boss'&&data.enemies[id])return [referenceEnemyPortrait(data.enemies[id].visualAsset||id)||progressionArtwork('boss')];
 if(achievement.kind==='streak'&&Number.isSafeInteger(achievement.target)&&achievement.target>200)return watchpostSequence(achievement.target);
 return [illustration(achievement.id.replaceAll(':','-'))];
}

export const achievementArtwork=(achievement,data,reveal=false)=>achievementPictureUrls(achievement,data,reveal)[0];

export function achievementPicture(achievement,data,reveal,{label='',className='',lazy=true,width=300,height=200}={}){
 const urls=achievementPictureUrls(achievement,data,reveal);
 const loading=lazy?' loading="lazy"':'';
 if(urls.length===1){
  const kind=urls[0].includes('/war-table/achievements/')?'achievement-scene':'achievement-icon';
  return `<img class="${className?className+' ':''}${kind}" src="${escapeProgression(urls[0])}" alt="${escapeProgression(label)}"${loading} decoding="async" width="${width}" height="${height}">`;
 }
 const accessible=label?`role="img" aria-label="${escapeProgression(label)}"`:'aria-hidden="true"';
 return `<span class="${className?className+' ':''}achievement-watch-panels" ${accessible}>${urls.map(src=>`<img src="${escapeProgression(src)}" alt=""${loading} decoding="async" width="300" height="200">`).join('')}</span>`;
}
export const medalIcon=(className='')=>`<img class="medal-icon ${className}" src="${siteUrl('assets/ui/ornate/medal.webp')}" alt="" aria-hidden="true" width="64" height="64">`;
export const medalAmount=(amount,label='medals')=>`<span class="medal-amount" aria-label="${BigInt(amount||0).toLocaleString('en-US')} ${BigInt(amount||0)===1n?'medal':'medals'}">${medalIcon()}<span><b>${BigInt(amount||0).toLocaleString('en-US')}</b> ${label}</span></span>`;
