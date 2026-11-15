// Shared account rules. Presentation never grants experience or changes combat.
export const MILITARY_RANKS=Object.freeze(['Peasant','Militia','Recruit','Footman','Soldier','Veteran','Sergeant','Lieutenant','Captain','Major','Colonel','Commander','General','Marshal','King'].map((name,i)=>Object.freeze({name,level:i+1,xp:[0,20,45,75,110,150,200,260,330,410,500,600,720,850,1000][i],id:name.toLowerCase()})));
export const BOSS_XP=Object.freeze({host_10:2,host_20:3,host_30:4,host_40:5,host_50:8});
export const SKILL_LEVEL_GATES=Object.freeze({'morale-boost':[5,9,12],'war-horn':[7,11,14],'blood-wrath':[9,12,15]});
export const eligibleChampion=u=>!!u?.advanced&&String(u.classification||'').trim().toLowerCase()!=='basic';
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
 const [kind,,last]=id.split(':');
 if(kind==='champion'){const u=data.towers[last];return eligibleChampion(u)?({intermediate:2,advanced:3,top:5,secret:8}[String(u.classification).trim().toLowerCase()]||0):0;}
 if(kind==='collection')return {5:3,15:8,30:15}[last]||0;
 if(kind==='campaign')return 8;if(kind==='boss-collection')return 10;
 if(kind==='endless')return {60:5,75:10,100:20}[id.split(':')[1]]||0;
 if(kind==='streak')return Number.isSafeInteger(+last)&&+last>0&&+last%10===0?+last/10:0;
 return 0;
}
