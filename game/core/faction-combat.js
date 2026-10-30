import {distance,combatTowerStats,towerStats} from './math.js';
import {attackTargetAllowed,statusEffectAllowed} from './combat-rules.js';
const ability=(s,id)=>s.abilities?.find(a=>a.familyId===id);
const eligible=(c,t,s)=>c.targetList(t,s);
const fraction=n=>Math.max(0,Math.min(1,(n||0)/100));
const status=(e,key,row)=>{const old=e.statuses[key];if(!old||row.amount>=(old.amount||0)||row.dps>=(old.dps||0))e.statuses[key]=row;else old.time=Math.max(old.time,row.time);};
export function factionPrimaryBonuses(stats,tower,towers){
 if(!stats.factionProfile)return stats;
 let factor=1;const active=towers.filter(t=>t!==tower&&t.state==='active'),cardinal=t=>Math.abs(t.x-tower.x)+Math.abs(t.z-tower.z)===1;
 const lone=ability(stats,'lone-vigil'),bond=ability(stats,'bonded-formation');
 if(lone&&!active.some(cardinal))factor*=1+lone.bonusPercent/100;
 if(bond&&active.some(t=>cardinal(t)&&bond.partnerIds?.includes(t.family)))factor*=1+bond.bonusPercent/100;
 const rage=ability(stats,'berserker'),now=tower.factionNow||0;
 if(rage&&now>=rage.cooldown&&now%rage.cooldown<rage.duration){factor*=1+rage.damageBonusPercent/100;stats={...stats,range:stats.range*(1-rage.rangeReductionPercent/100),berserkHaste:1+rage.attackSpeedBonusPercent/100,berserkResistance:rage.disarmDreadReductionPercent/100};}
 return {...stats,damage:stats.damage*factor};
}
function pulse(c,t,key,a,targets,act){
 if(!a)return;t.factionClocks??={};const now=c.elapsed,next=t.factionClocks[key]??a.cooldown;
 if(now+1e-9<next)return;
 // A ready ability waits for a legal target, without accumulating banked casts.
 if(!targets.length){t.factionClocks[key]=now;return;}
 t.factionClocks[key]=now+a.cooldown;act(targets.slice(0,a.targets||targets.length));
}
function secondary(c,t,e,amount,type,s={}){return c.resolveDamage(e,amount,type,{...s,directHit:true},t);}
export function factionImpact(c,shot){
 const {source:t,target:e,stats:s}=shot;if(e.dead||!c.canSee(e,t)||!attackTargetAllowed(s,e))return;
 const sky=ability(s,'sky-hunt'),crit=ability(s,s.type==='magical'?'magical-critical-strike':'critical-strike')||ability(s,'critical-strike'),charge=ability(s,'charged-attack');
 let amount=s.damage;if(e.flying&&sky&&s.type==='physical')amount*=1+sky.bonusPercent/100;
 if(charge&&shot.firstPrimary&&shot.releaseCount%charge.everyAttacks===0)amount*=1+charge.bonusPercent/100;
 if(shot.execution)amount=e.boss?s.damage*shot.execution.bossCriticalMultiplier:Math.max(amount,e.maxHp*(1+(e.armor||0)/c.game.data.balance.armorConstant)+(e.krakenShell||0));
 const critical=!!crit&&c.game.rng()<fraction(crit.chancePercent);if(critical)amount*=crit.multiplier;
 const strike=ability(s,'true-strike'),hitStats={...s,directHit:true,critical,critMultiplier:crit?.multiplier,evasionIgnore:fraction(strike?.evasionIgnorePercent)};
 const result=c.resolveDamage(e,amount,s.type,hitStats,t);
 if(result.contact)factionOnContact(c,t,e,s,result.appliedDamage>0);
 if(shot.firstPrimary){
  const excluded=new Set(shot.directTargets||[e]);
  for(const id of ['splash','cleave-physical','cleave-magical']){const a=ability(s,id);if(!a)continue;for(const victim of c.enemies)if(!victim.dead&&!excluded.has(victim)&&attackTargetAllowed(s,victim)&&c.canSee(victim,t)&&distance(victim,e)<=a.radius)c.damage(victim,s.damage*a.damagePercent/100,a.damageType==='profile'?s.type:a.damageType,{},t);}
  const ricochet=ability(s,'ricochet');if(ricochet&&c.game.rng()<fraction(ricochet.chancePercent)){let from=e;for(let n=1;n<=ricochet.maxBounces;n++){const target=c.enemies.filter(v=>!v.dead&&!excluded.has(v)&&attackTargetAllowed(s,v)&&c.canSee(v,t)&&distance(from,v)<=ricochet.jumpRange).sort((a,b)=>distance(a,from)-distance(b,from)||a.id-b.id)[0];if(!target)break;excluded.add(target);secondary(c,t,target,(s.listedDamage??s.damage)*(1-ricochet.damageReductionPercent/100)**n,s.type);c.game.emit('chain',{source:t,from,to:target,visible:true,effect:s.projectileEffect});from=target;}}
  const moon=ability(s,'moon-strike');if(moon&&shot.releaseCount%moon.everyAttacks===0)secondary(c,t,e,(s.listedDamage??s.damage)*moon.damagePercent/100,'holy');
 }
 c.game.emit('impact',{source:t,target:e,stats:s,effect:s.projectileEffect,x:e.x,z:e.z,color:s.color,radius:ability(s,'splash')?.radius||.4});
}
function factionOnContact(c,t,e,s,landed){
 if(e.dead)return;
 for(const [id,key]of [['slow','slow'],['armor-reduction','shred']]){const a=ability(s,id);if(a&&(key!=='slow'||statusEffectAllowed(e,'slow')))status(e,key,{amount:key==='slow'?fraction(a.slowPercent):a.armorReduction,time:a.duration,source:t});}
 for(const id of ['poison','burn']){const a=ability(s,id);if(a&&landed&&statusEffectAllowed(e,id))status(e,id,{dps:a.dps,time:a.duration,source:t,damageType:a.damageType||'magical',amount:a.dps});}
 const anti=ability(s,'anti-regeneration');if(anti&&statusEffectAllowed(e,'healBlock'))status(e,'regenReduction',{amount:fraction(anti.reductionPercent),time:anti.duration,source:t});
 for(const id of ['freeze','stun']){const a=ability(s,id);if(a&&statusEffectAllowed(e,'freeze')&&c.elapsed>=(e.factionControlRecovery||0)&&c.game.rng()<fraction(a.chancePercent)){const duration=a.duration*(e.boss?.5:1);status(e,id,{time:duration,source:t});e.factionControlRecovery=c.elapsed+duration+2;}}
 const lightning=ability(s,'lightning');if(lightning&&landed&&c.game.rng()<fraction(lightning.chancePercent)){const used=new Set([e]);let previous=e;for(let i=0;i<lightning.targets;i++){const next=c.enemies.filter(v=>!v.dead&&!used.has(v)&&c.canSee(v,t)&&distance(v,previous)<=lightning.linkRange).sort((a,b)=>distance(a,previous)-distance(b,previous)||a.id-b.id)[0];if(!next)break;used.add(next);secondary(c,t,next,lightning.damage,s.type==='holy'?'holy':'magical');c.game.emit('chain',{source:t,from:previous,to:next,effect:'lightning',visible:true});previous=next;}}
}
export function updateFactionTower(c,t,s,dt,boost){
 const targets=eligible(c,t,s);if(s.targetPriority==='flying-then-furthest-path')targets.sort((a,b)=>Number(b.flying)-Number(a.flying)||b.traveled-a.traveled||a.id-b.id);
 for(const [id,key,immunity]of [['cancel-magic-immunity','breachMagic','magicImmune'],['cancel-physical-immunity','breachPhysical','physicalImmune']]){const a=ability(s,id);pulse(c,t,id,a,targets.filter(e=>e[immunity]&&c.elapsed>=(e[key+'Recovery']||0)),rows=>{for(const e of rows){const duration=a.duration*(e.boss?.5:1);e.statuses[key]={time:duration,multiplier:a.damageMultiplier,source:t};e[key+'Recovery']=c.elapsed+duration+4;}});}
 pulse(c,t,'root',ability(s,'root'),targets.filter(e=>statusEffectAllowed(e,'freeze')&&c.elapsed>=(e.factionControlRecovery||0)),rows=>{for(const e of rows){const duration=ability(s,'root').duration*(e.boss?.5:1);status(e,'root',{time:duration,source:t});e.factionControlRecovery=c.elapsed+duration+2;}});
 const spark=ability(s,'spark');pulse(c,t,'spark',spark,targets,rows=>{for(const e of rows)secondary(c,t,e,spark.damage,spark.damageType);});
 const heat=ability(s,'heat');pulse(c,t,'heat',heat,targets.slice(0,1),rows=>{const center=rows[0];for(const e of c.enemies)if(!e.dead&&!e.flying&&c.canSee(e,t)&&distance(e,center)<=heat.radius)c.damage(e,heat.damage,heat.damageType,{},t);});
 const execution=ability(s,'execution');
 const fire=ability(s,'fire-aura');if(fire){for(const e of c.enemies)if(!e.dead&&c.canSee(e,t)&&distance(e,t)<=fire.radius){const stronger=c.game.towers.some(other=>other!==t&&other.state==='active'&&!other.attackPaused&&(()=>{const a=ability(towerStats(other,c.game.data),'fire-aura');return a&&distance(other,e)<=a.radius&&(a.dps>fire.dps||a.dps===fire.dps&&other.id<t.id);})());if(!stronger)c.damage(e,fire.dps*dt,fire.damageType,{},t);}}
 const cone=s.continuousAttack;
 if(cone){const target=targets.find(e=>!e.flying);if(target){const angle=Math.atan2(target.z-t.z,target.x-t.x);for(const e of targets)if(!e.flying&&distance(e,t)<=s.range&&Math.abs(Math.atan2(Math.sin(Math.atan2(e.z-t.z,e.x-t.x)-angle),Math.cos(Math.atan2(e.z-t.z,e.x-t.x)-angle)))<=cone.angleDegrees*Math.PI/360){const hit=c.resolveDamage(e,cone.dps*dt,cone.damageType,{penetration:s.penetration},t);factionOnContact(c,t,e,{...s,abilities:s.abilities.filter(a=>['burn','slow','armor-reduction','anti-regeneration'].includes(a.familyId))},hit.appliedDamage>0);}c.game.emit('aura-attack',{source:t,target,stats:s});}return;}
 if(s.damage<=0)return;
 if(!(boost>0))return;
 const weapon=s.weaponCycle;t.cooldown-=dt*boost;
 if(weapon&&!t.weaponCycleState&&targets.length){t.weaponCycleState={remaining:weapon.magazine,start:c.elapsed,phase:0,readyAt:c.elapsed+Math.max(0,(weapon.spinUpSeconds||0)-dt)};t.cooldown=0;}
 if(weapon&&t.weaponCycleState){const duration=(weapon.spinUpSeconds||0)+weapon.magazine*weapon.fixedInterval/boost+weapon.reload;t.weaponCycleState.phase=Math.min(.999999,Math.max(0,(c.elapsed-t.weaponCycleState.start)/duration));}
 if(weapon&&(!t.weaponCycleState||c.elapsed+1e-9<t.weaponCycleState.readyAt))return;
 let guard=0;while(t.cooldown<=1e-9&&guard++<1000){if(!targets.length){t.cooldown=0;break;}
  const state=t.weaponCycleState;if(weapon&&state.remaining===0){state.remaining=weapon.magazine;t.cooldown=0;state.start=c.elapsed;state.phase=(weapon.spinUpSeconds||0)/Math.max(.001,s.cycleMetrics?.cycleSeconds||1);}
  const chosen=targets.filter(e=>!e.dead).slice(0,s.multishot||1);if(!chosen.length){t.cooldown=0;break;}const stamp=++c.shotSerial;t.factionReleases=(t.factionReleases||0)+1;
  const execute=execution&&c.elapsed>=(t.executionReadyAt??execution.cooldown);if(execute)t.executionReadyAt=c.elapsed+execution.cooldown;
  for(const [i,target]of chosen.entries()){const shot={id:++c.shotSerial,volleyStamp:stamp,source:t,target,stats:{...s,listedDamage:s.listedDamage??s.damage},faction:true,firstPrimary:i===0,...(execute&&i===0?{execution}:{}),directTargets:chosen,releaseCount:t.factionReleases,effect:s.projectileEffect,start:{x:t.x,z:t.z},x:t.x,z:t.z,progress:0,duration:Math.max(.08,distance(t,target)/s.projectileSpeed)};c.projectiles.push(shot);c.game.emit('shot',shot);}
  if(weapon){state.remaining--;t.cooldown+=weapon.fixedInterval;if(state.remaining===0){state.readyAt=c.elapsed+weapon.fixedInterval/boost+weapon.reload+(weapon.spinUpSeconds||0);break;}}else t.cooldown+=Math.max(.01,s.interval);
 }
}
