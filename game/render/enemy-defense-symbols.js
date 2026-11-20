import {damageDefenseBreakdown} from '../core/math.js';
import {enemyRulesFor,enemyNumber,enemyRegenerationPerSecond} from '../core/enemy-rules.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const symbol=(label,color,id)=>Object.freeze({label,color,art:`assets/ui/war-table/ui-icons/status-${id}.webp`});
export const ENEMY_DEFENSE_SYMBOLS=Object.freeze({
 physicalImmune:symbol('Physical immunity','#ffd18c','physical-ward'),
 magicImmune:symbol('Magic immunity','#d99aff','arcane-ward'),
 reactive:symbol('Reactive armor','#efb261','reactive-plate'),
 refraction:symbol('Direct-hit shields','#7bfff4','prism-shields'),
 regen:symbol('Regeneration','#82efa2','regeneration'),
 recharge:symbol('Periodic healing','#5de4cd','periodic-healing'),
 evasion:symbol('Direct-hit evasion','#a8dfca','direct-evasion'),
 krakenShell:symbol('Damage absorption','#adc8ee','kraken-shell'),
 untouchable:symbol('Dread on damaging hit','#e9a6da','dread'),
});

const defenseBalance=balance=>({armorConstant:Math.max(.0001,finite(balance?.armorConstant,30))});

// The live fields are CombatManager's damage inputs. In particular, a status
// expiring does not justify pretending its cached shred has already changed.
export function enemyDefenseVisualState(enemy,{balance}={}){
  if(!enemy||enemy.dead)return [];
  const states=[],rules=defenseBalance(balance);
  const reactive=Math.max(0,finite(enemy.reactiveArmor)*finite(enemy.reactiveStacks));
  const armor=damageDefenseBreakdown(0,'holy',{armor:finite(enemy.armor),reactiveArmor:finite(enemy.reactiveArmor),reactiveStacks:finite(enemy.reactiveStacks),armorShred:finite(enemy.armorShred),mvpArmorReduction:finite(enemy.mvpArmorReduction)},{},rules).effectiveArmor;
  if(enemy.physicalImmune)states.push({kind:'physicalImmune',amount:1});
  if(reactive>0&&armor>0)states.push({kind:'reactive',amount:clamp(armor/rules.armorConstant,.15,1),armor,stacks:finite(enemy.reactiveStacks)});
  if(enemy.magicImmune)states.push({kind:'magicImmune',amount:1});
  const charges=Math.max(0,Math.ceil(finite(enemy.shields)));
  if(charges>0)states.push({kind:'refraction',amount:charges,count:charges});
  if(finite(enemy.regen)>0&&!(enemy.statuses?.healBlock?.time>0))states.push({kind:'regen',amount:1,fraction:enemy.regen,perSecond:enemyRegenerationPerSecond(enemy)});
  if(finite(enemy.recharge)>0&&!(enemy.statuses?.healBlock?.time>0))states.push({kind:'recharge',amount:1,fraction:enemy.recharge,remainingSeconds:Math.max(0,finite(enemy.rechargeClock))});
  if(finite(enemy.evasion)>0)states.push({kind:'evasion',amount:clamp(enemy.evasion,0,1)});
  if(finite(enemy.krakenShell)>0)states.push({kind:'krakenShell',amount:1,perHit:enemy.krakenShell});
  if(finite(enemy.untouchable)>0)states.push({kind:'untouchable',amount:clamp(enemy.untouchable,0,1)});
  return states;
}

// Wave descriptions list configured capabilities; live battlefield symbols
// use enemyDefenseVisualState above, including actual depletion/suppression.
export function enemyDefenseDescriptions(definition,{balance}={}){
  if(!definition)return [];
  const R=enemyRulesFor({balance});
  const initial={...definition,dead:false,statuses:{},armorShred:0,magicShred:0,ward:0,shields:finite(definition.refraction),reactiveStacks:finite(definition.reactiveArmor)>0?1:0,rechargeClock:R.recharge.period};
  const states=enemyDefenseVisualState(initial,{balance});
  return states.map(state=>{
    const percent=Math.round(state.amount*100);
    const detail=state.kind==='refraction'?state.count+' direct-hit charges; regenerate '+R.refraction.period+'s after the final charge is spent':
      state.kind==='regen'?enemyNumber(state.fraction*100)+'% maximum HP/s ('+enemyNumber(state.perSecond)+' HP/s); disabled by healing block':
      state.kind==='recharge'?enemyNumber(state.fraction*100)+'% missing HP every '+R.recharge.period+'s; disabled by healing block':
      state.kind==='reactive'?definition.reactiveArmor+' armor per direct hit, up to '+R.reactive.maxStacks+' stacks ('+enemyNumber(definition.reactiveArmor*R.reactive.maxStacks)+' armor); decays '+R.reactive.decayPerSecond+' stacks/s':
      state.kind==='krakenShell'?state.perHit+' damage removed after armor from each Physical, Magical and Holy direct hit':
      state.kind==='evasion'?percent+'% chance against Physical, Magical and Holy direct hits; True Strike bypasses it':
      state.kind==='untouchable'?percent+'% attack slowing for '+R.dread.duration+'s after actual HP damage from that defender, including owned DOT and secondary hits; no range limit or stacking; control resistance reduces it':
      state.kind==='physicalImmune'?'Blocks Physical damage, slowing and freezing; only Holy damage bypasses this immunity':
      state.kind==='magicImmune'?'Blocks Magical damage, poison, burning and healing block; only Holy damage bypasses this immunity':'Reactive armor reduces Physical, Magical and Holy damage';
    return {...state,...ENEMY_DEFENSE_SYMBOLS[state.kind],detail};
  });
}
