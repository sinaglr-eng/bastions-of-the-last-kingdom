import {towerStats,combatTowerStats} from '../game/core/math.js';
import {mvpDamageBonus} from '../game/core/mvp.js';
import {towerSupportState} from '../game/render/support-effects.js';
import {baseAttackDps,formatTowerNumber} from './grimoire.js';
import {factionPrimaryBonuses} from '../game/core/faction-combat.js';
import {artifactDefenderNotesMarkup} from './artifact-defender-notes.js';
import {artifactEffects} from '../game/core/artifact-combat.js';

// Inspection only. Damage comes from the combat engine; the support display
// supplies the same current attack-clock penalties used by CombatManager.
// A draft candidate or a hypothetical rank must never inherit live bonuses.
export function defenderEffectiveStats(game,tower,{data=game.data,view=tower}={}){
  const base=towerStats(view,data),live=tower.state==='active'&&game.towers.includes(tower)&&view.tier===tower.tier&&view.family===tower.family;
  const neutral={stats:base,bonuses:{damage:1,haste:1,range:0},multiplier:1};
  const combat=live?combatTowerStats(tower,game.towers,data):neutral;
  const gear=live?artifactEffects(game):{},morale=live?(game.general?.multiplier('morale-boost')||1)*(1+(gear.speed||0)):1;
  const support=live?towerSupportState(tower,game.towers,data,{combat:game.combat,phase:game.phase}):{byKey:{}};
  const own=live?mvpDamageBonus(tower):0;
  const damageBase=base.damage||0,dpsBase=baseAttackDps(base),damageParts=[],dpsParts=[];
  const add=(key,label,fraction)=>{if(fraction){damageParts.push({key,label,value:damageBase*fraction});dpsParts.push({key,label,value:dpsBase*fraction});}};
  add('mvp',`Own MVP +${Math.round(own*100)}%`,own);
  add('aura',`Damage aura +${Math.round((combat.bonuses.damage-1)*100)}%`,(1+own)*(combat.bonuses.damage-1));
  let dps=baseAttackDps(combat.stats),rate=combat.bonuses.haste;
  if(rate!==1){dpsParts.push({key:'haste',label:`${gear.speed||morale!==1?'Attack-speed bonuses':'Attack-speed aura'} ${rate>=1?'+':''}${Math.round((rate-1)*100)}%`,value:dps*(rate-1)});dps*=rate;}
  for(const [key,label]of [['dread','Dread'],['weakened','Barricade disruption']]){
    const penalty=support.byKey[key]?.amount||0;
    if(penalty){dpsParts.push({key,label:`${label} −${Math.round(penalty*100)}% attack speed`,value:-dps*penalty});dps*=1-penalty;rate*=1-penalty;}
  }
  const stopped=live&&(tower.attackPaused?'Attacks paused':support.byKey.melancholy?'Melancholy · cannot attack':support.byKey.disarm?'Disarmed · cannot attack':null);
  if(stopped&&dps){dpsParts.push({key:'stopped',label:stopped,value:-dps});dps=0;}
  if(base.factionProfile){
    const s=combat.stats,weapon=s.weaponCycle;
    // The native engine speeds continuous fire and fr010 reload/spin-up with
    // Commander/artifact morale, while shot intervals also use support haste.
    if(s.continuousAttack)dps=stopped?0:s.continuousAttack.dps*morale;
    else if(weapon)dps=stopped||rate<=0?0:s.damage*weapon.magazine/(((weapon.spinUpSeconds||0)+weapon.reload)/(data.fr010?morale:1)+weapon.magazine*weapon.fixedInterval/rate);
    else dps=stopped?0:s.damage/Math.max(.01,s.interval)*Math.max(0,rate);
    dpsParts.length=0;
    if(Math.abs(dps-dpsBase)>1e-9)dpsParts.push({key:'native-cycle',label:'Native attack cycle & current support',value:dps-dpsBase});
  }
  const nativeDamage=combat.stats.damage||0,nativeDelta=nativeDamage-damageBase-damageParts.reduce((sum,part)=>sum+part.value,0);
  if(Math.abs(nativeDelta)>1e-9)damageParts.push({key:'native-ability',label:'Native attack abilities',value:nativeDelta});
  let damage=nativeDamage;
  for(const[key,label,factor]of [['artifact-damage','Artifacts · own damage',1+(gear.damage||0)],['commander-damage','Blood Wrath',live?game.general?.multiplier('blood-wrath')||1:1]])if(factor!==1){damageParts.push({key,label,value:damage*(factor-1)});dpsParts.push({key,label,value:dps*(factor-1)});damage*=factor;dps*=factor;}
  const nativeRange=live?factionPrimaryBonuses(base,tower,game.towers).range:base.range,rangeApplies=!!(base.damage>0||base.continuousAttack),artifactRange=rangeApplies&&(gear.range||gear.rangeTiles)?Math.max(.5,nativeRange*(1+(gear.range||0))+(gear.rangeTiles||0))-nativeRange:0;
  const rangeBonus=combat.stats.range-base.range,commanderRange=combat.bonuses.commanderRange||0,auraRange=combat.stats.damage>0||combat.stats.continuousAttack?combat.bonuses.range:0,ownRange=rangeBonus-auraRange-commanderRange-artifactRange,rangeParts=[];
  if(Math.abs(ownRange)>1e-9){const rage=base.abilities?.find(ability=>ability.familyId==='berserker');rangeParts.push({key:'own-range',label:ownRange<0&&rage?`Berserker −${rage.rangeReductionPercent}% range`:'Own range modifier',value:ownRange});}
  if(auraRange>1e-9)rangeParts.push({key:'range-aura',label:'Range aura',value:auraRange});
  if(Math.abs(artifactRange)>1e-9)rangeParts.push({key:'artifact-range',label:'Artifacts · final attack range',value:artifactRange});
  if(commanderRange)rangeParts.push({key:'commander-range',label:'Extended Range · current wave',value:commanderRange});
  return {live,base,stats:combat.stats,damage,dps,range:combat.stats.range,interval:stopped||rate<=0?null:base.interval/rate,damageParts,dpsParts,rangeParts,rangeBonus,haste:combat.bonuses.haste,stopped};
}

const contributionMarkup=parts=>parts.length?`<dl class="effective-stat-breakdown">${parts.map(part=>`<div data-contribution="${part.key}"><dt>${part.label}</dt><dd>${part.value<0?'−':'+'}${formatTowerNumber(Math.abs(part.value))}</dd></div>`).join('')}</dl>`:'';
export function defenderEffectiveStatsMarkup(game,tower,options={}){
  const result=defenderEffectiveStats(game,tower,options),{base}=result;
  const breakdown=(value,parts)=>result.live&&parts.length?`<small class="effective-stat-base">Base ${formatTowerNumber(value)}</small>${contributionMarkup(parts)}`:'';
  return `<div class="folio-metrics stat-grid combat-stat-grid" data-effective-stats="" data-stats-scope="${result.live?'current':'base-preview'}"><div><span>Damage / hit</span><strong>${base.continuousAttack?'—':formatTowerNumber(result.damage)}</strong>${breakdown(base.damage,result.damageParts)}</div><div><span>${base.continuousAttack?'Continuous DPS':base.weaponCycle?'Cycle DPS':'Direct DPS'}</span><strong>${formatTowerNumber(result.dps)}</strong>${breakdown(baseAttackDps(base),result.dpsParts)}</div><div><span>Range</span><strong>${formatTowerNumber(result.range)}</strong>${breakdown(base.range,result.rangeParts)}</div><div><span>Interval</span><strong>${base.continuousAttack?'Continuous':result.interval===null?'—':formatTowerNumber(result.interval)+'s'}</strong>${result.stopped?`<small class="effective-stat-base">${result.stopped}</small>`:result.live&&result.interval!==base.interval?`<small class="effective-stat-base">Base ${formatTowerNumber(base.interval)}s · current attack speed</small>`:''}</div>${result.live?artifactDefenderNotesMarkup(game,tower,result.stats):''}</div>`;
}
