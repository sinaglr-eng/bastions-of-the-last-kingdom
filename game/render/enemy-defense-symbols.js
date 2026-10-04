import {damageAfterDefense} from '../core/math.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const typedKinds=['fire','frost','poison','holy','arcane'];
const shield=[[-16,17],[16,17],[13,-7],[0,-19],[-13,-7],[-16,17]];
const diamond=[[0,20],[17,0],[0,-20],[-17,0],[0,20]];
const cross=[[[-15,0],[15,0]],[[0,-15],[0,15]]];
const symbol=(label,color,paths)=>Object.freeze({label,color,viewBox:'-24 -24 48 48',paths:Object.freeze(paths.map(path=>Object.freeze(path.map(point=>Object.freeze(point))))),svgPaths:Object.freeze(paths.map(path=>path.map(([x,y],index)=>(index?'L':'M')+x+' '+(-y)).join(' ')))});

// Both the real 3D strokes and the UI SVG use these exact colored paths.
// Separate silhouettes retain meaning even when the color is hard to see.
export const ENEMY_DEFENSE_SYMBOLS=Object.freeze({
  physicalImmune:symbol('Physical immunity','#ffd18c',[shield,[[-19,-19],[19,19]],[[0,-9],[0,11]]]),
  magicImmune:symbol('Magic immunity','#d99aff',[diamond,[[-18,-18],[18,18]],[[-9,0],[0,10],[9,0],[0,-10],[-9,0]]]),
  reactive:symbol('Reactive armor','#efb261',[shield,[[-11,9],[11,9]],[[-9,1],[9,1]],[[-5,-8],[5,-8]]]),
  magic:symbol('Magic resistance','#b9a3ff',[diamond,[[-10,0],[0,11],[10,0],[0,-11],[-10,0]]]),
  fire:symbol('Fire resistance','#ff985c',[[[-13,-9],[-16,0],[-9,8],[-8,17],[0,10],[7,21],[10,8],[17,-1],[13,-13],[0,-19],[-13,-9]],[[0,-11],[-5,-3],[1,6],[6,-3],[0,-11]]]),
  frost:symbol('Frost resistance','#81e5ff',[[[-18,0],[18,0]],[[0,-20],[0,20]],[[-14,-14],[14,14]],[[-14,14],[14,-14]],[[-6,14],[0,20],[6,14]],[[-6,-14],[0,-20],[6,-14]]]),
  poison:symbol('Poison resistance','#b1ef70',[[[-7,14],[7,14],[5,-2],[15,-15],[13,-19],[-13,-19],[-15,-15],[-5,-2],[-7,14]],[[-8,-10],[8,-10]],[[13,9],[18,9],[18,14],[13,14],[13,9]]]),
  holy:symbol('Holy resistance','#fff0a6',[[[0,12],[11,5],[11,-6],[0,-12],[-11,-6],[-11,5],[0,12]],[[0,17],[0,23]],[[0,-17],[0,-23]],[[-17,0],[-23,0]],[[17,0],[23,0]],[[-13,13],[-18,18]],[[13,13],[18,18]],[[-13,-13],[-18,-18]],[[13,-13],[18,-18]]]),
  arcane:symbol('Arcane resistance','#f79ddd',[[[0,22],[5,6],[20,7],[9,-3],[12,-19],[0,-10],[-12,-19],[-9,-3],[-20,7],[-5,6],[0,22]]]),
  refraction:symbol('Direct-hit shields','#7bfff4',[shield,[[-9,4],[0,12],[9,4],[0,-9],[-9,4]]]),
  regen:symbol('Regeneration','#82efa2',[[[-7,17],[7,17],[7,7],[17,7],[17,-7],[7,-7],[7,-17],[-7,-17],[-7,-7],[-17,-7],[-17,7],[-7,7],[-7,17]]]),
  recharge:symbol('Periodic healing','#5de4cd',[[[-17,6],[-12,16],[0,20],[12,16],[18,6],[18,-8],[10,-17],[-3,-20],[-14,-14]],[[11,-12],[-14,-14],[-10,7]],...cross.map(path=>path.map(([x,y])=>[x*.48,y*.48]))]),
  evasion:symbol('Physical evasion','#a8dfca',[[[-20,-9],[-6,-9],[2,1],[-5,12],[9,12],[20,1],[9,-12]],[[11,1],[-1,1]],[[-20,4],[-13,4]]]),
  krakenShell:symbol('Damage absorption','#adc8ee',[[[-19,-16],[-21,-2],[-15,11],[-6,19],[6,19],[15,11],[21,-2],[19,-16],[-19,-16]],[[0,-16],[0,18]],[[-1,-16],[-13,12]],[[1,-16],[13,12]],[[-2,-16],[-20,-2]],[[2,-16],[20,-2]]]),
  untouchable:symbol('Attack slowing aura','#e9a6da',[[[-15,19],[15,19],[-12,-18],[12,-18],[-15,19]],[[-8,11],[8,11]],[[-6,-10],[6,-10]]]),
});

const defenseBalance=balance=>({armorConstant:Math.max(.0001,finite(balance?.armorConstant,30)),maxResistance:clamp(finite(balance?.maxResistance,.85),0,1)});

// The live fields are CombatManager's damage inputs. In particular, a status
// expiring does not justify pretending its cached shred has already changed.
export function enemyDefenseVisualState(enemy,{balance}={}){
  if(!enemy||enemy.dead)return [];
  const states=[],rules=defenseBalance(balance),resists=enemy.resists||{};
  const reactive=Math.max(0,finite(enemy.reactiveArmor)*finite(enemy.reactiveStacks));
  const armor=Math.max(0,finite(enemy.armor)+reactive-finite(enemy.armorShred));
  if(enemy.physicalImmune)states.push({kind:'physicalImmune',amount:1});
  else if(reactive>0&&armor>0)states.push({kind:'reactive',amount:clamp(armor/rules.armorConstant,.15,1),armor,stacks:finite(enemy.reactiveStacks)});
  if(enemy.magicImmune)states.push({kind:'magicImmune',amount:1});
  else{
    const common=clamp(finite(resists.magic)+finite(enemy.ward)-finite(enemy.magicShred),0,rules.maxResistance);
    if(common>0)states.push({kind:'magic',amount:common});
    for(const kind of typedKinds){
      const effective=1-damageAfterDefense(1,kind,enemy,{},rules);
      if(finite(resists[kind])>0&&effective>0)states.push({kind,amount:effective});
    }
  }
  const charges=Math.max(0,Math.ceil(finite(enemy.shields)));
  if(charges>0)states.push({kind:'refraction',amount:charges,count:charges});
  if(finite(enemy.regen)>0&&!enemy.statuses?.healBlock)states.push({kind:'regen',amount:1,perSecond:enemy.regen});
  if(finite(enemy.recharge)>0&&!enemy.statuses?.healBlock)states.push({kind:'recharge',amount:1,fraction:enemy.recharge,remainingSeconds:Math.max(0,finite(enemy.rechargeClock))});
  if(finite(enemy.evasion)>0)states.push({kind:'evasion',amount:clamp(enemy.evasion,0,1)});
  if(finite(enemy.krakenShell)>0)states.push({kind:'krakenShell',amount:1,perHit:enemy.krakenShell});
  return states;
}

// Wave descriptions list configured capabilities; live battlefield symbols
// use enemyDefenseVisualState above, including actual depletion/suppression.
export function enemyDefenseDescriptions(definition,{balance}={}){
  if(!definition)return [];
  const initial={...definition,dead:false,statuses:{},armorShred:0,magicShred:0,ward:0,shields:finite(definition.refraction),reactiveStacks:finite(definition.reactiveArmor)>0?1:0,rechargeClock:8};
  const states=enemyDefenseVisualState(initial,{balance});
  if(finite(definition.untouchable)>0)states.push({kind:'untouchable',amount:clamp(definition.untouchable,0,1)});
  return states.map(state=>{
    const percent=Math.round(state.amount*100);
    const detail=state.kind==='refraction'?state.count+' direct-hit charges; recharge every 8s':
      state.kind==='regen'?state.perSecond+' HP/s; disabled by healing block':
      state.kind==='recharge'?Math.round(state.fraction*100)+'% maximum HP every 8s; disabled by healing block':
      state.kind==='reactive'?definition.reactiveArmor+' armor per direct hit, up to 12 stacks':
      state.kind==='krakenShell'?state.perHit+' damage removed from each non-pure direct hit':
      state.kind==='evasion'?percent+'% chance against physical/piercing direct hits; True Strike bypasses it':
      state.kind==='untouchable'?percent+'% attack slowing within 4 tiles; control resistance counters it':
      state.kind.endsWith('Immune')?'Blocks matching damage; pure damage bypasses it':percent+'% resistance before suppression or shred';
    return {...state,...ENEMY_DEFENSE_SYMBOLS[state.kind],detail};
  });
}
