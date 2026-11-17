// Shared account rules. Presentation never grants experience or changes combat.
import {FACTION_ACHIEVEMENT_DEFINITIONS} from './faction-achievements.js';
import {GENERAL_SKILLS} from './general.js';
export const MILITARY_RANKS=Object.freeze(['Peasant','Militia','Recruit','Footman','Soldier','Veteran','Sergeant','Lieutenant','Captain','Major','Colonel','Commander','General','Marshal','King'].map((name,i)=>Object.freeze({name,level:i+1,xp:[0,20,45,75,110,150,200,260,330,410,500,600,720,850,1000][i],id:name.toLowerCase()})));
export const BOSS_XP=Object.freeze({host_10:2,host_20:3,host_30:4,host_40:5,host_50:8});
export const SKILL_LEVEL_GATES=Object.freeze({'deep-refit':[1,3,5],'recruitment-focus':[1,3,5],'field-logistics':[1,3,5],quartermaster:[1,3,5],'morale-boost':[5,9,12],'war-horn':[7,11,14],'blood-wrath':[9,12,15],'field-promotion':[7,10,14],'decisive-strike':[9,13,15],'fortified-keep':[2,6,11],'extended-range':[6,10,13]});
// Basic is a champion classification; recruit families have advanced:false.
export const eligibleChampion=u=>!!u?.advanced;
// Keep legacy account/save keys readable while awarding shared milestones once.
export function canonicalAchievementId(id){
 if(typeof id!=='string')return id;
 const [kind,faction,last,...extra]=id.split(':'),scope=['crown','forge','grove','global'].includes(faction);
 if(!scope||extra.length)return id;
 if(kind==='boss'&&Object.hasOwn(BOSS_XP,last))return `boss:global:${last}`;
 if(kind==='streak'&&/^[1-9]\d*$/.test(last||'')&&Number.isSafeInteger(+last)&&+last%10===0)return `streak:global:${last}`;
 if(kind==='boss-collection'&&last===undefined)return 'boss-collection:global';
 return id;
}
export function isSharedAchievement(id){
 const canonical=canonicalAchievementId(id);
 if(typeof canonical==='string'&&canonical.startsWith('skill-mastery:global:')&&Object.hasOwn(GENERAL_SKILLS,canonical.slice('skill-mastery:global:'.length)))return true;
 return typeof canonical==='string'&&(canonical==='boss-collection:global'||/^boss:global:host_(10|20|30|40|50)$/.test(canonical)||/^streak:global:[1-9]\d*$/.test(canonical)&&Number.isSafeInteger(+canonical.split(':')[2])&&+canonical.split(':')[2]%10===0);
}
export function accountRank(total=0){
 const xp=Number.isSafeInteger(total)&&total>=0?total:0,current=MILITARY_RANKS.findLast(r=>xp>=r.xp),next=MILITARY_RANKS[current.level]||null;
 return {...current,total:xp,next,progress:next?xp-current.xp:0,span:next?next.xp-current.xp:0,percent:next?(xp-current.xp)/(next.xp-current.xp)*100:100};
}
export function skillGate(skill,rank,profile={}){
 const required=SKILL_LEVEL_GATES[skill]?.[rank-1]||1,legacy=(profile.permanentUnlocks?.[skill]||0)>=rank,level=accountRank(profile.xpTotal).level;
 return {required,rank:MILITARY_RANKS[required-1],legacy,allowed:legacy||level>=required};
}
export function newlyAvailableSkills(before,after){return Object.entries(SKILL_LEVEL_GATES).flatMap(([skill,levels])=>levels.flatMap((level,i)=>accountRank(before).level<level&&accountRank(after).level>=level?[{skill,rank:i+1,level}]:[]));}
export function achievementXP(data,id){
 const [kind,faction,last]=id.split(':');
 if(kind==='skill-mastery')return isSharedAchievement(id)?5:0;
 if(kind==='champion'){const u=data.towers[last];return eligibleChampion(u)?({basic:1,intermediate:2,advanced:3,top:5,secret:8}[String(u.classification).trim().toLowerCase()]||0):0;}
 if(kind==='collection')return last==='all'&&FACTION_ACHIEVEMENT_DEFINITIONS[faction]&&id===`collection:${faction}:all`?20:{5:3,15:8,30:15}[last]||0;
 if(kind==='faction'){const theme=FACTION_ACHIEVEMENT_DEFINITIONS[faction]?.thematic;return theme?.slug===last&&id===`faction:${faction}:${last}`?theme.xp:0;}
 if(kind==='campaign')return 8;if(kind==='boss-collection')return 10;
 if(kind==='endless')return {60:5,75:10,100:20}[id.split(':')[1]]||0;
 if(kind==='streak')return Number.isSafeInteger(+last)&&+last>0&&+last%10===0?+last/10:0;
 return 0;
}
