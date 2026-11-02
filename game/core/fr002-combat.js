import {distance,towerStats} from './math.js';
import {attackTargetAllowed,statusEffectAllowed} from './combat-rules.js';
const ability=(s,id)=>s.abilities?.find(a=>a.familyId===id),chance=(c,n)=>c.game.rng()<Math.max(0,Math.min(1,n/100));
const channel=(type,s)=>type==='profile'?s.type:type==='magical-or-holy'?(s.type==='holy'?'holy':'magical'):type;
const nearest=(c,t,s,from,excluded,reach=Infinity)=>c.enemies.filter(e=>!e.dead&&!excluded.has(e)&&attackTargetAllowed(s,e)&&c.canSee(e,t)&&distance(e,from)<=reach).sort((a,b)=>distance(a,from)-distance(b,from)||a.id-b.id)[0];
const packet=(s,lineage=[])=>({_fr002Stats:s,_fr002Lineage:lineage});
function critical(c,s){const a=ability(s,'critical-strike');return a&&chance(c,a.chancePercent)?a.multiplier:1;}
function hit(c,t,e,basis,type,s,{lineage=[],canCrit=false,onHit=false,direct=true,slice=null,multiplier=null,replacement=null}={}){
 const crit=multiplier??(canCrit?critical(c,s):1),aim=ability(s,'true-strike');
 const result=c.resolveDamage(e,(replacement??basis)*crit,type,{...s,...packet(s,lineage),_fr002Basis:basis,_fr002Slice:slice,_fr002OnHit:onHit,directHit:direct,critical:crit>1,critMultiplier:crit,evasionIgnore:(aim?.evasionIgnorePercent||0)/100},t);
 if(onHit&&result.contact)contact(c,t,e,s,result.effectiveDamage>0,lineage,!slice);
 return result;
}
function contact(c,t,e,s,landed,lineage,randomEffects=true){
 if(!e.dead){
  const slow=ability(s,'slow'),shred=ability(s,'armor-reduction'),burn=ability(s,'burn');
  const p=packet(s,lineage),effects={type:s.type,slow:slow&&(!slow.targeting||slow.targeting!=='flying-only'||e.flying)?slow.slowPercent/100:0,slowDuration:slow?.duration,shred:shred&&(shred.targeting!=='flying-only'||e.flying)?shred.armorReduction:0,burnDps:burn?.dps,dotDuration:burn?.duration};
  c.applyEffects(e,effects,t,{landedDamage:landed});
  if(burn&&e.statuses.burn?.source===t)e.statuses.burn.fr002Packet=p;
  const anti=ability(s,'anti-regeneration');if(anti&&statusEffectAllowed(e,'healBlock')){const old=e.statuses.regenReduction,amount=anti.reductionPercent/100;e.statuses.regenReduction=old?.amount>amount?{...old,time:Math.max(old.time,anti.duration)}:{amount,time:anti.duration,source:t};}
  if(slow?.radius>0)for(const other of c.enemies)if(other!==e&&!other.dead&&attackTargetAllowed(s,other)&&c.canSee(other,t)&&distance(other,e)<=slow.radius)c.applyEffects(other,{type:s.type,slow:slow.slowPercent/100,slowDuration:slow.duration},t);
 }
 if(randomEffects){poisonContact(c,t,e,s,lineage,landed);chanceContact(c,t,e,s,lineage,landed);}
}
function poisonContact(c,t,e,s,lineage,landed){const a=ability(s,'poison');if(a&&landed&&!e.dead){c.applyEffects(e,{type:s.type,poisonDps:a.dps},t);const last=e.statuses.poison?.applications?.at(-1);if(last?.source===t&&!last.fr002Packet)last.fr002Packet=packet(s,lineage);}}
function chanceContact(c,t,e,s,lineage,landed){
 applyCanonicalControlContact(c,t,e,s);
 if(landed)lightning(c,t,e,s,lineage);
}
export function applyCanonicalControlContact(c,t,e,s){
 if(!e.dead)for(const id of ['freeze','stun']){const a=ability(s,id);if(a&&statusEffectAllowed(e,id)&&c.elapsed>=(e.factionControlRecovery||0)&&chance(c,a.chancePercent)){const duration=a.duration*(e.boss?(a.bossDurationMultiplier??.5):1);e.statuses[id]={time:duration,source:t};e.factionControlRecovery=c.elapsed+duration+2;}}
}
function lightning(c,t,origin,s,lineage){
 const a=ability(s,'lightning');if(!a||lineage.includes('lightning')||!chance(c,a.chancePercent))return;
 const child=[...lineage,'lightning'],used=new Set([origin]);let from=origin;
 for(let i=0;i<a.targets;i++){const center=a.mode==='forked-lightning'||a.mode==='near-target-chain'?origin:from,next=nearest(c,t,s,center,used,a.linkRange??a.range??Infinity);if(!next)break;used.add(next);
  hit(c,t,next,a.damage,channel(a.damageType,s),s,{lineage:child,onHit:true,direct:true});c.game.emit('chain',{source:t,from,to:next,effect:'lightning',visible:true});from=next;
 }
}
function ricochet(c,t,origin,s,type,basis,lineage){
 const a=ability(s,'ricochet');if(!a||lineage.includes('ricochet')||!(basis>0)||!chance(c,a.chancePercent))return;
 const child=[...lineage,'ricochet'],used=new Set([origin]);let from=origin;
 c.game.emit('ability-proc',{source:t,abilityId:'ricochet',origin,basis,type,lineage:child});
 for(let i=1;i<=a.maxBounces;i++){const next=nearest(c,t,s,from,used,a.unlimitedBounceDistance?Infinity:a.jumpRange??Infinity);if(!next)break;used.add(next);
  hit(c,t,next,basis*(1-a.damageReductionPercent/100)**i,type,s,{lineage:child,canCrit:a.canCrit,onHit:a.canApplyOnHit,direct:true});c.game.emit('chain',{source:t,from,to:next,effect:s.projectileEffect,visible:true});from=next;
 }
}
// Called after real owned HP loss, including lethal hits, irrespective of the
// original delivery path. The unmodified Human/Claire engine has no Ricochet.
export function fr002DamageResolved(c,result,stats,t){
 if(!t||!(result.effectiveDamage>0))return;
 const s=stats._fr002Stats||(stats.fr002?stats:c.game.data.fr002&&c.game.data.towers[t.family]?towerStats(t,c.game.data):null);
 if(!s?.fr002)return;const lineage=stats._fr002Lineage||[],rawSlice=stats._fr002Slice,liveFraction=rawSlice&&result.enemy.dead?Math.min(1,result.effectiveDamage/result.appliedDamage):1,basis=(stats._fr002Basis??result.requestedDamage)*liveFraction,slice=rawSlice&&liveFraction<1?{...rawSlice,dt:rawSlice.dt*liveFraction,endAt:(rawSlice.endAt??c.elapsed)-rawSlice.dt+rawSlice.dt*liveFraction}:rawSlice;
 if(!slice){ricochet(c,t,result.enemy,s,result.type,basis,lineage);return;}
 const onHit=!!stats._fr002OnHit;
 if((!ability(s,'ricochet')||lineage.includes('ricochet'))&&!(onHit&&(ability(s,'lightning')||ability(s,'freeze')||ability(s,'stun')||ability(s,'poison'))))return;
 c.fr002Pulses??=new Map();const key=`${t.id}/${slice.key}/${result.enemy.id}`;
 let row=c.fr002Pulses.get(key);if(!row){row={key,source:t,enemy:result.enemy,stats:s,type:result.type,start:(slice.endAt??c.elapsed)-slice.dt,kind:slice.key,lastAt:c.elapsed,windows:new Map()};c.fr002Pulses.set(key,row);}row.lastAt=c.elapsed;
 // Absolute time intervals let several independent poison stacks contribute
 // damage to the same one-second window without advancing its clock twice.
 const end=slice.endAt??c.elapsed,begin=end-slice.dt;let cursor=Math.max(begin,row.start);
 while(cursor<end-1e-10){const index=Math.max(0,Math.floor(cursor-row.start+1e-8)),finish=Math.min(end,row.start+index+1),part=(finish-cursor)/slice.dt;let window=row.windows.get(index);if(!window){window={end:row.start+index+1,basis:0,lineage:new Set(),onHit:false};row.windows.set(index,window);}window.basis+=basis*part;for(const id of lineage)window.lineage.add(id);window.onHit||=onHit;cursor=finish;}
}
function pulseActive(row,c){
 if(row.enemy.dead)return false;if(!row.kind.startsWith('dot:'))return row.lastAt>=c.elapsed-1e-8;
 const effect=row.enemy.statuses[row.kind.slice(4)];if(effect?.applications)return effect.applications.some(a=>a.source===row.source&&a.time>0);return effect?.source===row.source&&effect.time>0;
}
export function flushFr002Pulses(c,{all=false}={}){
 if(!c.fr002Pulses?.size)return;const ready=[];
 for(const [key,row]of c.fr002Pulses){const ended=all||!pulseActive(row,c);for(const [index,w]of row.windows)if(ended||w.end<=c.elapsed+1e-7){row.windows.delete(index);ready.push({row,w});}if(ended)c.fr002Pulses.delete(key);}
 ready.sort((a,b)=>a.w.end-b.w.end||a.row.source.id-b.row.source.id||a.row.key.localeCompare(b.row.key));
 for(const {row,w}of ready){const lineage=[...w.lineage];ricochet(c,row.source,row.enemy,row.stats,row.type,w.basis,lineage);if(w.onHit){poisonContact(c,row.source,row.enemy,row.stats,lineage,true);chanceContact(c,row.source,row.enemy,row.stats,lineage,true);}}
}
export function fr002Impact(c,shot){
 const {source:t,target:e,stats:s}=shot;if(e.dead||!c.canSee(e,t)||!attackTargetAllowed(s,e))return;
 let basis=s.damage;const sky=ability(s,'sky-hunt'),charged=ability(s,'charged-attack');if(e.flying&&sky&&s.type==='physical')basis*=1+sky.bonusPercent/100;if(charged&&shot.firstPrimary&&shot.releaseCount%charged.everyAttacks===0)basis*=1+charged.bonusPercent/100;
 const multiplier=critical(c,s),replacement=shot.execution?(e.boss?s.damage*shot.execution.bossCriticalMultiplier:Math.max(basis,e.maxHp*(1+(e.armor||0)/c.game.data.balance.armorConstant)+(e.krakenShell||0))):null;
 const result=hit(c,t,e,basis,s.type,s,{canCrit:false,multiplier,onHit:true,replacement});
 const recovery=ability(s,'keep-recovery'),release=shot.release||(shot.release={});if(recovery&&result.effectiveDamage>0&&!release.recoveryRolled){release.recoveryRolled=true;if(chance(c,recovery.chancePercent)){const before=c.game.lives;c.game.lives=Math.min(c.game.data.balance.startingLives,c.game.lives+recovery.health);if(c.game.lives>before)c.game.emit('recover',{source:t,amount:c.game.lives-before});}}
 if(shot.firstPrimary){
  const excluded=new Set(shot.directTargets||[e]);for(const id of ['splash','cleave-physical','cleave-magical']){const a=ability(s,id);if(!a)continue;for(const other of c.enemies)if(!other.dead&&!excluded.has(other)&&attackTargetAllowed(s,other)&&c.canSee(other,t)&&distance(other,e)<=a.radius)hit(c,t,other,s.damage*a.damagePercent/100,channel(a.damageType,s),s,{direct:false,multiplier:a.secondaryCanCrit?multiplier:1,lineage:[id]});}
  const moon=ability(s,'moon-strike');if(moon&&chance(c,moon.chancePercent))hit(c,t,e,(s.listedDamage??s.damage)*moon.damagePercent/100,'holy',s,{lineage:['moon-strike'],direct:true});
 }
 c.game.emit('impact',{source:t,target:e,stats:s,effect:s.projectileEffect,x:e.x,z:e.z,color:s.color,radius:ability(s,'splash')?.radius||.4});
}
function timed(c,t,id,a,targets,act){
 if(!a)return;t.factionClocks??={};const next=t.factionClocks[id]??a.cooldown;if(c.elapsed+1e-9<next)return;if(!targets.length){t.factionClocks[id]=c.elapsed;return;}t.factionClocks[id]=c.elapsed+a.cooldown;act(targets.slice(0,a.targets||targets.length));
}
export function updateFr002Tower(c,t,s,dt,boost){
 const targets=c.targetList(t,s);if(s.targetPriority==='flying-then-furthest-path')targets.sort((a,b)=>Number(b.flying)-Number(a.flying)||b.traveled-a.traveled||a.id-b.id);
 for(const [id,key,immunity]of [['cancel-magic-immunity','breachMagic','magicImmune'],['cancel-physical-immunity','breachPhysical','physicalImmune']]){const a=ability(s,id);timed(c,t,id,a,targets.filter(e=>e[immunity]&&c.elapsed>=(e[key+'Recovery']||0)),rows=>{for(const e of rows){const duration=a.duration*(e.boss?.5:1);e.statuses[key]={time:duration,multiplier:a.damageMultiplier,source:t};e[key+'Recovery']=c.elapsed+duration+4;}});}
 const root=ability(s,'root');timed(c,t,'root',root,targets.filter(e=>statusEffectAllowed(e,'freeze')&&c.elapsed>=(e.factionControlRecovery||0)),rows=>{for(const e of rows){const duration=root.duration*(e.boss?.5:1);e.statuses.root={time:duration,source:t};e.factionControlRecovery=c.elapsed+duration+2;}});
 const spark=ability(s,'spark');timed(c,t,'spark',spark,targets,rows=>{for(const e of rows){hit(c,t,e,spark.damage,channel(spark.damageType,s),s,{lineage:['spark']});c.game.emit('chain',{source:t,from:t,to:e,effect:'lightning',abilityId:'spark',visible:true});}});
 const heat=ability(s,'heat');timed(c,t,'heat',heat,targets.slice(0,1),rows=>{const center=rows[0];for(const e of c.enemies)if(!e.dead&&!e.flying&&c.canSee(e,t)&&distance(e,center)<=heat.radius)hit(c,t,e,heat.damage,channel(heat.damageType,s),s,{direct:false,lineage:['heat']});c.game.emit('impact',{source:t,target:center,stats:s,effect:'fire',abilityId:'heat',radius:heat.radius,visible:true});});
 const fire=ability(s,'fire-aura');if(fire)for(const e of c.enemies)if(!e.dead&&c.canSee(e,t)&&distance(e,t)<=fire.radius){const stronger=c.game.towers.some(other=>other!==t&&other.state==='active'&&!other.attackPaused&&(()=>{const a=ability(towerStats(other,c.game.data),'fire-aura');return a&&distance(other,e)<=a.radius&&(a.dps>fire.dps||a.dps===fire.dps&&other.id<t.id);})());if(!stronger)hit(c,t,e,fire.dps*dt,channel(fire.damageType,s),s,{direct:false,slice:{key:'fire-aura',dt}});}
 const cone=s.continuousAttack;if(cone){const target=targets.find(e=>!e.flying);if(target){const angle=Math.atan2(target.z-t.z,target.x-t.x);for(const e of targets)if(!e.flying&&distance(e,t)<=s.range&&Math.abs(Math.atan2(Math.sin(Math.atan2(e.z-t.z,e.x-t.x)-angle),Math.cos(Math.atan2(e.z-t.z,e.x-t.x)-angle)))<=cone.angleDegrees*Math.PI/360)hit(c,t,e,cone.dps*dt,cone.damageType,s,{direct:false,onHit:true,slice:{key:'flame-cone',dt}});c.game.emit('aura-attack',{source:t,target,stats:s});}return;}
 if(!(s.damage>0)||!(boost>0))return;
 const weapon=s.weaponCycle;t.cooldown-=dt*boost;if(weapon&&!t.weaponCycleState&&targets.length){t.weaponCycleState={remaining:weapon.magazine,start:c.elapsed,phase:0,readyAt:c.elapsed+Math.max(0,(weapon.spinUpSeconds||0)-dt)};t.cooldown=0;}
 if(weapon&&t.weaponCycleState){const duration=(weapon.spinUpSeconds||0)+weapon.magazine*weapon.fixedInterval/boost+weapon.reload;t.weaponCycleState.phase=Math.min(.999999,Math.max(0,(c.elapsed-t.weaponCycleState.start)/duration));}
 if(weapon&&(!t.weaponCycleState||c.elapsed+1e-9<t.weaponCycleState.readyAt))return;
 while(t.cooldown<=1e-9){const chosen=targets.filter(e=>!e.dead).slice(0,s.multishot||1);if(!chosen.length){t.cooldown=0;break;}const state=t.weaponCycleState;if(weapon&&state.remaining===0){state.remaining=weapon.magazine;t.cooldown=0;state.start=c.elapsed;state.phase=(weapon.spinUpSeconds||0)/Math.max(.001,s.cycleMetrics?.cycleSeconds||1);}
  t.factionReleases=(t.factionReleases||0)+1;const release={},stamp=++c.shotSerial,execution=ability(s,'execution'),execute=execution&&c.elapsed>=(t.executionReadyAt??execution.cooldown);if(execute)t.executionReadyAt=c.elapsed+execution.cooldown;
  for(const [i,target]of chosen.entries()){const shot={id:++c.shotSerial,volleyStamp:stamp,release,source:t,target,stats:s,faction:true,firstPrimary:i===0,...(execute&&i===0?{execution}:{}),directTargets:chosen,releaseCount:t.factionReleases,effect:s.projectileEffect,start:{x:t.x,z:t.z},x:t.x,z:t.z,progress:0,duration:Math.max(.08,distance(t,target)/s.projectileSpeed)};c.projectiles.push(shot);c.game.emit('shot',shot);}
  if(weapon){state.remaining--;t.cooldown+=weapon.fixedInterval;if(state.remaining===0){state.readyAt=c.elapsed+weapon.fixedInterval/boost+weapon.reload+(weapon.spinUpSeconds||0);break;}}else t.cooldown+=Math.max(.01,s.interval);
 }
}
