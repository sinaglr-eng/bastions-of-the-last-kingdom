import {towerStats,combatTowerStats} from '../game/core/math.js';
import {mvpDamageBonus} from '../game/core/mvp.js';
import {towerSupportState} from '../game/render/support-effects.js';
import {baseAttackDps,formatTowerNumber} from './grimoire.js';

// Inspection only. Damage comes from the combat engine; the support display
// supplies the same current attack-clock penalties used by CombatManager.
// A draft candidate or a hypothetical rank must never inherit live bonuses.
export function defenderEffectiveStats(game,tower,{data=game.data,view=tower}={}){
  const base=towerStats(view,data),live=tower.state==='active'&&game.towers.includes(tower)&&view.tier===tower.tier&&view.family===tower.family;
  const neutral={stats:base,bonuses:{damage:1,haste:1,range:0},multiplier:1};
  const combat=live?combatTowerStats(tower,game.towers,data):neutral;
  const support=live?towerSupportState(tower,game.towers,data,{combat:game.combat,phase:game.phase}):{byKey:{}};
  const own=live?mvpDamageBonus(tower):0;
  const damageBase=base.damage||0,dpsBase=baseAttackDps(base),damageParts=[],dpsParts=[];
  const add=(key,label,fraction)=>{if(fraction){damageParts.push({key,label,value:damageBase*fraction});dpsParts.push({key,label,value:dpsBase*fraction});}};
  add('mvp',`Own MVP +${Math.round(own*100)}%`,own);
  add('aura',`Damage aura +${Math.round((combat.bonuses.damage-1)*100)}%`,(1+own)*(combat.bonuses.damage-1));
  let dps=baseAttackDps(combat.stats),rate=combat.bonuses.haste;
  if(rate!==1){dpsParts.push({key:'haste',label:`Attack-speed aura +${Math.round((rate-1)*100)}%`,value:dps*(rate-1)});dps*=rate;}
  for(const [key,label]of [['dread','Dread'],['weakened','Barricade disruption']]){
    const penalty=support.byKey[key]?.amount||0;
    if(penalty){dpsParts.push({key,label:`${label} −${Math.round(penalty*100)}% attack speed`,value:-dps*penalty});dps*=1-penalty;rate*=1-penalty;}
  }
  const stopped=live&&(tower.attackPaused?'Attacks paused':support.byKey.melancholy?'Melancholy · cannot attack':support.byKey.disarm?'Disarmed · cannot attack':null);
  if(stopped&&dps){dpsParts.push({key:'stopped',label:stopped,value:-dps});dps=0;}
  return {live,base,stats:combat.stats,damage:combat.stats.damage||0,dps,range:combat.stats.range,interval:stopped||rate<=0?null:base.interval/rate,damageParts,dpsParts,rangeBonus:combat.stats.range-base.range,haste:combat.bonuses.haste,stopped};
}

const contributionMarkup=parts=>parts.length?`<dl class="effective-stat-breakdown">${parts.map(part=>`<div data-contribution="${part.key}"><dt>${part.label}</dt><dd>${part.value<0?'−':'+'}${formatTowerNumber(Math.abs(part.value))}</dd></div>`).join('')}</dl>`:'';
export function defenderEffectiveStatsMarkup(game,tower,options={}){
  const result=defenderEffectiveStats(game,tower,options),{base}=result;
  const breakdown=(value,parts)=>result.live&&parts.length?`<small class="effective-stat-base">Base ${formatTowerNumber(value)}</small>${contributionMarkup(parts)}`:'';
  return `<div class="folio-metrics stat-grid combat-stat-grid" data-effective-stats="" data-stats-scope="${result.live?'current':'base-preview'}"><div><span>Damage / hit</span><strong>${formatTowerNumber(result.damage)}</strong>${breakdown(base.damage,result.damageParts)}</div><div><span>Direct DPS</span><strong>${formatTowerNumber(result.dps)}</strong>${breakdown(baseAttackDps(base),result.dpsParts)}</div><div><span>Range</span><strong>${formatTowerNumber(result.range)}</strong>${result.rangeBonus?`<small class="effective-stat-base">Base ${formatTowerNumber(base.range)} + ${formatTowerNumber(result.rangeBonus)} aura</small>`:''}</div><div><span>Interval</span><strong>${result.interval===null?'—':formatTowerNumber(result.interval)+'s'}</strong>${result.stopped?`<small class="effective-stat-base">${result.stopped}</small>`:result.live&&result.interval!==base.interval?`<small class="effective-stat-base">Base ${formatTowerNumber(base.interval)}s · current attack speed</small>`:''}</div></div>`;
}
