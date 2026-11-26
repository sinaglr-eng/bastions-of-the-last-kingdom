import {eligibleChampion,achievementXP} from './account-progression.js';
import {FACTION_ACHIEVEMENT_DEFINITIONS,factionCollectionAchievements} from './faction-achievements.js';
import {GENERAL_SKILLS} from './general.js';
import {killMilestone,nextKillTarget} from './kill-milestones.js';
export {canonicalAchievementId,isSharedAchievement} from './account-progression.js';
export const championMedalReward=unit=>unit?.classification?.toLowerCase()==='top'?3:1;
export const BOSS_TYPES=Object.freeze(['host_10','host_20','host_30','host_40','host_50']);
export function commanderMasteryAchievements(skills=null){return Object.entries(GENERAL_SKILLS).filter(([id])=>skills===null||skills[id]===3).map(([skillId,skill])=>({id:`skill-mastery:global:${skillId}`,factionId:null,kind:'skill-mastery',skillId,name:`${skill.name} Mastery`,description:`Purchase all three ranks of ${skill.name}. Claim this reward once across all factions.`,reward:3,xp:5,target:3}));}
export function achievementCatalog(data,progress=null){
 const f=data.factionId,rows=Object.entries(data.towers).filter(([,u])=>eligibleChampion(u)).map(([id,u])=>({id:`champion:${f}:${id}`,factionId:f,kind:'champion',name:u.classification?.toLowerCase()==='secret'?'Secret champion':u.name,secret:u.classification?.toLowerCase()==='secret',description:'Forge this champion in a legal run.',reward:championMedalReward(u),target:1}));
 for(const id of BOSS_TYPES)rows.push({id:`boss:global:${id}`,factionId:null,kind:'boss',name:data.enemies[id]?.name||id,description:'Defeat this boss with any faction.',reward:2,target:1});
 for(const [target,reward]of [[5,2],[15,4],[30,8]])rows.push({id:`collection:${f}:${target}`,factionId:f,kind:'collection',name:`Forge ${target} different champions`,reward,target});
 rows.push(...factionCollectionAchievements(data));
 const faction=FACTION_ACHIEVEMENT_DEFINITIONS[f];
 rows.push({id:`mythic:${f}`,factionId:f,kind:'mastery',name:'First rank VI',description:'Merge two fresh rank-V recruits.',reward:2,target:1},{id:`campaign:${f}`,factionId:f,kind:'campaign',name:faction?.campaignName||'Wave 50 Victory',description:`Complete all of wave 50 in a legal ${faction?.factionName||'faction'} run. Defeating the boss alone is not enough.`,reward:5,target:1},{id:'boss-collection:global',factionId:null,kind:'boss',name:'All five warlords',description:'Defeat all five original bosses across any factions.',reward:5,target:5});
 const highest=Math.max(3,Math.ceil((progress?.streakBest||0)/10)+1);
 for(let n=1;n<=highest;n++)rows.push(streakAchievement(f,n));
 for(const [target,reward]of [[60,3],[75,5],[100,8]])rows.push({id:`endless:${target}`,kind:'endless',name:`Complete wave ${target}`,reward,target});
 rows.push(...commanderMasteryAchievements());
 const kills=progress?.seasonalKills;
 rows.push(killMilestone(kills?.nextTarget)??killMilestone(nextKillTarget(kills?.claimedTarget||0)));
 return rows.map(row=>({...row,xp:achievementXP(data,row.id)}));
}
export const streakAchievement=(f,n)=>({id:`streak:global:${10*n}`,factionId:null,kind:'streak',name:`${10*n} consecutive flawless waves`,description:'Complete consecutive waves in one run with any faction without losing keep health. Health loss resets the current streak.',reward:n,xp:n,target:10*n});
export class RunProgress{
 constructor(game){this.game=game;this.champions=new Set();this.bosses=new Set();this.bossWaves={};this.mythic=false;this.campaign=false;this.highestWave=0;this.streak=0;this.streakBest=0;this.waveDamaged=false;this.kills=0;this.bossKills=0;game.on((t,p)=>this.event(t,p));}
 event(type,p){
  if(this.game.developerMode)return;
  if(type==='wave')this.waveDamaged=false;
  if(type==='leak'&&(p.healthLost??p.enemy?.leak??1)>0){this.waveDamaged=true;this.streak=0;}
  if(type==='combine'&&p.crafted)this.champions.add(p.tower.family);
  if(type==='combine'&&!p.crafted&&p.tower.tier===6&&!this.game.data.towers[p.tower.family].advanced)this.mythic=true;
  if(type==='death'){this.kills++;if(p.enemy.boss){this.bossKills++;if(BOSS_TYPES.includes(p.enemy.type)){this.bosses.add(p.enemy.type);this.bossWaves[p.enemy.type]??=this.game.round;}}}
  if(type==='wave-complete'){this.highestWave=Math.max(this.highestWave,p.round);this.streak=this.waveDamaged?0:this.streak+1;this.streakBest=Math.max(this.streakBest,this.streak);if(p.round===50){this.campaign=true;this.campaignBossKills=this.bossKills;}}
 }
 grants(){
  const f=this.game.factionId,rows=[];
  for(const id of this.champions)if(eligibleChampion(this.game.data.towers[id]))rows.push({id:`champion:${f}:${id}`,reward:championMedalReward(this.game.data.towers[id]),factionId:f});
  for(const id of this.bosses)rows.push({id:`boss:global:${id}`,reward:2,factionId:null});
  if(this.mythic)rows.push({id:`mythic:${f}`,reward:2,factionId:f});
  if(this.campaign)rows.push({id:`campaign:${f}`,reward:5,factionId:f});
  for(let n=1;n<=Math.floor(this.streakBest/10);n++)rows.push({id:`streak:global:${10*n}`,reward:n,factionId:null});
  for(const [target,reward]of [[60,3],[75,5],[100,8]])if(this.highestWave>=target)rows.push({id:`endless:${target}`,reward,factionId:null});
  return rows;
 }
}
