export const BOSS_TYPES=Object.freeze(['host_10','host_20','host_30','host_40','host_50']);
export function achievementCatalog(data,progress=null){
 const f=data.factionId,rows=Object.entries(data.towers).filter(([,u])=>u.advanced).map(([id,u])=>({id:`champion:${f}:${id}`,factionId:f,kind:'champion',name:u.classification?.toLowerCase()==='secret'?'Secret champion':u.name,secret:u.classification?.toLowerCase()==='secret',description:'Forge this champion in a legal run.',reward:1,target:1}));
 for(const id of BOSS_TYPES)rows.push({id:`boss:${f}:${id}`,factionId:f,kind:'boss',name:data.enemies[id]?.name||id,description:'Defeat this boss.',reward:2,target:1});
 for(const [target,reward]of [[5,2],[15,4],[30,8]])rows.push({id:`collection:${f}:${target}`,factionId:f,kind:'collection',name:`Forge ${target} different champions`,reward,target});
 rows.push({id:`mythic:${f}`,factionId:f,kind:'mastery',name:'First rank VI',description:'Merge two fresh rank-V recruits.',reward:2,target:1},{id:`campaign:${f}`,factionId:f,kind:'campaign',name:'Hold the kingdom',description:'Defeat wave 50.',reward:5,target:1},{id:`boss-collection:${f}`,factionId:f,kind:'boss',name:'All five warlords',description:'Defeat all five original bosses.',reward:5,target:5});
 const highest=Math.max(3,Math.ceil((progress?.streakBest||0)/10)+1);
 for(let n=1;n<=highest;n++)rows.push(streakAchievement(f,n));
 for(const [target,reward]of [[60,3],[75,5],[100,8]])rows.push({id:`endless:${target}`,kind:'endless',name:`Complete wave ${target}`,reward,target});
 return rows;
}
export const streakAchievement=(f,n)=>({id:`streak:${f}:${10*n}`,factionId:f,kind:'streak',name:`${10*n} consecutive flawless waves`,description:'Complete consecutive waves without losing keep health. Health loss resets the current streak.',reward:n,target:10*n});
export class RunProgress{
 constructor(game){this.game=game;this.champions=new Set();this.bosses=new Set();this.mythic=false;this.campaign=false;this.highestWave=0;this.streak=0;this.streakBest=0;this.waveDamaged=false;this.kills=0;this.bossKills=0;game.on((t,p)=>this.event(t,p));}
 event(type,p){
  if(this.game.developerMode)return;
  if(type==='wave')this.waveDamaged=false;
  if(type==='leak'&&(p.healthLost??p.enemy?.leak??1)>0){this.waveDamaged=true;this.streak=0;}
  if(type==='combine'&&p.crafted)this.champions.add(p.tower.family);
  if(type==='combine'&&!p.crafted&&p.tower.tier===6&&!this.game.data.towers[p.tower.family].advanced)this.mythic=true;
  if(type==='death'){this.kills++;if(p.enemy.boss){this.bossKills++;if(BOSS_TYPES.includes(p.enemy.type))this.bosses.add(p.enemy.type);}}
  if(type==='wave-complete'){this.highestWave=Math.max(this.highestWave,p.round);this.streak=this.waveDamaged?0:this.streak+1;this.streakBest=Math.max(this.streakBest,this.streak);if(p.round===50)this.campaign=true;}
 }
 grants(){
  const f=this.game.factionId,rows=[];
  for(const id of this.champions)rows.push({id:`champion:${f}:${id}`,reward:1,factionId:f});
  for(const id of this.bosses)rows.push({id:`boss:${f}:${id}`,reward:2,factionId:f});
  if(this.mythic)rows.push({id:`mythic:${f}`,reward:2,factionId:f});
  if(this.campaign)rows.push({id:`campaign:${f}`,reward:5,factionId:f});
  for(let n=1;n<=Math.floor(this.streakBest/10);n++)rows.push({id:`streak:${f}:${10*n}`,reward:n,factionId:f});
  for(const [target,reward]of [[60,3],[75,5],[100,8]])if(this.highestWave>=target)rows.push({id:`endless:${target}`,reward,factionId:null});
  return rows;
 }
}
