import {artifactBonuses,validateArtifactEquipment,ARTIFACT_VERSION,ARTIFACT_CAPS} from './artifacts.js';
import {statusEffectAllowed,attackTargetAllowed} from './combat-rules.js';
const zero=Object.freeze({}),eps=1e-9;
export const artifactEffects=game=>game?.developerMode?zero:game?.artifactState?.effects||zero;
export function installArtifacts(game,equipment={}){
 const aggregate=artifactBonuses(equipment);game.artifactEquipment=aggregate.equipment;game.artifactVersion=ARTIFACT_VERSION;
 game.artifactState={effects:aggregate.effects,sets:aggregate.sets,randomState:((game.seed>>>0)^0xAF711C79)>>>0,reinforced:false,loot:{}};
 bindArtifactTowers(game);return aggregate;
}
export function bindArtifactTowers(game){Object.defineProperty(game.towers,'artifactEffects',{configurable:true,get:()=>artifactEffects(game)});}
export function normalizeArtifacts(game,snapshot){
 const equipment=validateArtifactEquipment(snapshot?.artifactEquipment||{}),aggregate=artifactBonuses(equipment);
 if(snapshot?.artifactVersion&&snapshot.artifactVersion!==ARTIFACT_VERSION)throw Error('Unsupported artifact effects version.');
 game.artifactEquipment=equipment;game.artifactVersion=ARTIFACT_VERSION;
 game.artifactState??={randomState:((game.seed>>>0)^0xAF711C79)>>>0,reinforced:false,loot:{}};game.artifactState.effects=aggregate.effects;game.artifactState.sets=aggregate.sets;bindArtifactTowers(game);
}
const random=game=>{let x=game.artifactState.randomState>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;game.artifactState.randomState=x>>>0;return (x>>>0)/4294967296;};
export function artifactDamageMultiplier(game,enemy){
 const b=artifactEffects(game);let conditional=0;if(enemy.statuses.poison?.time>0||enemy.statuses.artifactPoison?.time>0)conditional+=b.conditionalPoison||0;if(enemy.statuses.burn?.time>0||enemy.statuses.artifactBurn?.time>0)conditional+=b.conditionalBurn||0;if(enemy.statuses.slow?.time>0||enemy.statuses.freeze?.time>0||enemy.statuses.gazeSlow?.time>0)conditional+=b.conditionalControl||0;
 return 1+(b.damage||0)+(enemy.boss?b.bossDamage||0:0)+Math.min(ARTIFACT_CAPS.conditional,conditional);
}
function addDot(c,enemy,source,stats,kind,total,duration){
 if(!(total>0)||enemy.dead||!statusEffectAllowed(enemy,kind))return;
 enemy.artifactDots??={poison:new Map(),burn:new Map()};const now=Math.floor((c.elapsed+eps)*60),ticks=duration*60,rows=enemy.artifactDots[kind];let row=rows.get(source.id);
 if(!row){row={source,groundOnly:!!(stats.melee||stats.groundOnly),rate:0,pending:0,rates:Array(ticks+1).fill(0),lastTick:now,untilTick:now};rows.set(source.id,row);}
 const rate=total/duration,end=now+ticks;row.rate+=rate;row.pending+=total;row.rates[end%row.rates.length]+=rate;row.untilTick=Math.max(row.untilTick,end);
 enemy.statuses[kind==='poison'?'artifactPoison':'artifactBurn']={time:duration,amount:row.rate};
}
export function artifactPrimaryContact(c,result,stats,source){
 const e=result.enemy,b=artifactEffects(c.game);if(!(b.poisonFraction||b.burnFraction||b.slow||b.shred||b.freezeChance))return;if(!source||source.kind==='commander'||!c.game.towers.includes(source)||!(result.effectiveDamage>0)||e.dead||e.hp<=0)return;
 for(const[kind,duration]of [['poison',3],['burn',2]])addDot(c,e,source,stats,kind,result.effectiveDamage*(b[kind+'Fraction']||0),duration);
 if(b.slow&&statusEffectAllowed(e,'slow')){const old=e.statuses.slow;e.statuses.slow={...(old||{}),amount:Math.max(old?.amount||0,b.slow),time:Math.max(old?.time||0,2),source:old?.amount>b.slow?old.source:source};}
 // Defense clamps the final armor after reactive stacks and the strongest
 // shred. Keep the full reduction even when the target's base armor is zero.
 if(b.shred)e.statuses.artifactShred={amount:b.shred,time:2,source};
 if(b.freezeChance&&statusEffectAllowed(e,'freeze')&&c.elapsed>=(e.artifactFreezeReady||0)&&c.elapsed>=(e.factionControlRecovery||0)&&!['freeze','stun','root','petrify'].some(k=>e.statuses[k]?.time>0)){
  const attempts=e.artifactFreezeAttempts??(e.artifactFreezeAttempts=new Map()),next=attempts.get(source.id)||0;
  if(c.elapsed+eps>=next){attempts.set(source.id,c.elapsed+1);if(random(c.game)<b.freezeChance){const duration=b.freezeDuration*(e.boss?.5:1);e.statuses.freeze={time:duration,source};e.artifactFreezeReady=c.elapsed+6;e.factionControlRecovery=c.elapsed+duration+2;}}
 }
}
export function updateArtifactDots(c,enemy){
 const groups=enemy.artifactDots;if(!groups)return;const now=Math.floor((c.elapsed+eps)*60);
 for(const kind of ['poison','burn']){
  const marker=kind==='poison'?'artifactPoison':'artifactBurn',rows=groups[kind];if(!statusEffectAllowed(enemy,kind)){rows.clear();delete enemy.statuses[marker];continue;}
  let remaining=0,totalRate=0;
  for(const [id,row]of rows){
   if(enemy.dead)break;let damage=0;
   while(row.lastTick<now&&row.pending>eps){row.lastTick++;const slice=Math.min(row.pending,Math.max(0,row.rate)/60);row.pending=Math.max(0,row.pending-slice);damage+=slice;const at=row.lastTick%row.rates.length;row.rate=Math.max(0,row.rate-row.rates[at]);row.rates[at]=0;}
   // Amount already lives in the target's normalized HP space and includes
   // the originating hit multipliers. No second Blood Wrath or scaling pass.
   if(damage>0)c.resolveDamage(enemy,damage,'magical',{effect:kind==='burn'?'fire':'poison',_artifactDot:true,_artifactStoredHP:true,directHit:false},row.source);
   if(row.pending<=eps){rows.delete(id);}else{remaining=Math.max(remaining,(row.untilTick-now)/60);totalRate+=row.rate;}
  }
  if(!enemy.dead&&remaining>eps)enemy.statuses[marker]={time:remaining+1/60,amount:totalRate};else delete enemy.statuses[marker];
 }
}
export function artifactDeath(c,enemy,{transfer=false}={}){
 const b=artifactEffects(c.game);
 if(enemy.boss&&b.reinforceKeep&&!c.game.artifactState.reinforced&&!c.game.developerMode){c.game.artifactState.reinforced=true;const amount=Math.min(b.reinforceKeep,c.game.maxLives-c.game.lives);if(amount>0){c.game.lives+=amount;c.game.emit('artifact-heal',{amount,id:'royal-architect'});}}
 if(transfer||!b.emberTransfer||!enemy.artifactDots?.burn?.size)return;
 // Clear before resolving recipients: deaths caused by the transfer cannot
 // recursively transfer this budget or establish any new artifact effects.
 const rows=[...enemy.artifactDots.burn.values()];enemy.artifactDots.burn.clear();
 for(const row of rows){if(!(row.pending>eps))continue;const targets=c.enemies.filter(e=>!e.dead&&e!==enemy&&e.hp>0&&Math.hypot(e.x-enemy.x,e.z-enemy.z)<=1.5&&attackTargetAllowed({groundOnly:row.groundOnly},e)&&c.canSee(e,row.source)).sort((a,b)=>a.id-b.id).slice(0,3);if(!targets.length)continue;
  const share=row.pending/targets.length;for(const target of targets){const log=Math.log(share)+(enemy.healthScaleLog||0)-(target.healthScaleLog||0),amount=Math.exp(Math.min(Math.log(Number.MAX_VALUE),log));c.resolveDamage(target,amount,'magical',{effect:'fire',_artifactDot:true,_artifactStoredHP:true,_artifactTransfer:true,directHit:false},row.source);}
 }
}
