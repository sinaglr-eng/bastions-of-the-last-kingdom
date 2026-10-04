import {ENEMY_RULES as R,enemyNumber} from './enemy-rules.js';

const percent=value=>`${enemyNumber(value*100)}%`;

// This is CombatManager.spawn's variant/modifier merge, without allocating a
// live enemy. The guide and upcoming-wave cards can display the same values.
export function configuredWarbandInfo(definition,modifiers={}){
  const selected={...definition,...modifiers.variant};
  const enemy={...selected,resists:{...selected.resists,...modifiers.resists}};
  const traitDetails=warbandTraitDetails(enemy);
  return {name:enemy.name,maxHp:enemy.hp*(modifiers.hp||1),armor:enemy.armor+(modifiers.armor||0),speed:enemy.speed*(modifiers.speed||1),flying:!!enemy.flying,traits:traitDetails.map(trait=>trait.text),traitDetails};
}

export function warbandVariantInfo(definition,modifiers={}){
  return (definition.variants||[{}]).map(variant=>configuredWarbandInfo(definition,{...modifiers,variant}));
}

// Read the chosen variant from the actual wave, rather than listing every possible variant.
export function currentWarbandInfo(game) {
  return game.wave.groups.map(group=>{
    const queued=game.combat.spawnQueue.find(q=>q.type===group.type);
    const live=game.combat.enemies.find(e=>e.type===group.type&&!e.dead);
    const base={...game.data.enemies[group.type],type:group.type},modifiers=queued?.modifiers||{...game.wave,...group};
    const info=live?{name:live.name,maxHp:live.maxHp,armor:live.armor,speed:live.speed,flying:!!live.flying,traits:warbandTraits(live),traitDetails:warbandTraitDetails(live)}:configuredWarbandInfo(base,modifiers);
    return {type:group.type,count:group.count,...info};
  });
}

export function warbandTraits(enemy) {
  return warbandTraitDetails(enemy).map(trait=>trait.text);
}

// Explicit keys pair a description with the same silhouette used in combat.
export function warbandTraitDetails(enemy) {
  const traits=[];
  const add=(text,kind=null)=>traits.push({text,kind});
  if(enemy.magicImmune)add('Immune to magic and magical effects','magicImmune');
  if(enemy.physicalImmune)add('Immune to physical and piercing damage','physicalImmune');
  for(const [type,value] of Object.entries(enemy.resists||{}))if(value>0)add(`${percent(value)} ${type} resistance`,type);
  if(enemy.regen>0)add(`Regenerates ${enemyNumber(enemy.regen)} HP/s · healing block prevents regeneration`,'regen');
  if(enemy.evasion>0)add(`${percent(enemy.evasion)} chance to evade physical/piercing direct hits · True Strike bypasses evasion`,'evasion');
  if(enemy.refraction>0)add(`${enemyNumber(enemy.refraction)} hit-blocking shields · refresh every ${R.refraction.period}s · damage-over-time and auras bypass shields`,'refraction');
  if(enemy.krakenShell>0)add(`Shell blocks ${enemyNumber(enemy.krakenShell)} damage per non-pure direct hit`,'krakenShell');
  if(enemy.reactiveArmor>0)add(`Reactive armor · +${enemyNumber(enemy.reactiveArmor)} armor per direct hit · maximum ${R.reactive.maxStacks} stacks (${enemyNumber(enemy.reactiveArmor*R.reactive.maxStacks)} armor) · decays ${R.reactive.decayPerSecond} stacks/s`,'reactive');
  if(enemy.recharge>0)add(`Restores ${percent(enemy.recharge)} maximum health every ${R.recharge.period}s · healing block prevents recharge`,'recharge');
  if(enemy.stealth||enemy.cloakDaggers){
    const cloak=enemy.stealth?'Cloaked continuously':`Cloaked for ${R.cloak.hiddenDuration}s, visible for ${R.cloak.period-R.cloak.hiddenDuration}s, every ${R.cloak.period}s`;
    add(`${cloak} · revealed within ${R.reveal.checkpointRadius} tiles of checkpoints, ${R.reveal.defenderRadius} of defenders, or ${R.reveal.clericRadius} of Clerics (detector abilities may reach farther)`);
  }
  if(enemy.disarm)add(`Disarms defenders within ${R.disarm.radius} tiles for ${R.disarm.duration}s every ${R.disarm.period}s · control resistance shortens duration`);
  if(enemy.blink>0)add(`Blinks ${enemyNumber(enemy.blink)} tiles every ${R.blink.period}s`);
  if(enemy.rush>0)add(`Blood rush · ×${enemyNumber(enemy.rush)} speed for ${R.rush.duration}s every ${R.rush.period}s`);
  if(enemy.hasteAura>1)add(`Invaders within ${R.support.radius} tiles gain ${percent(enemy.hasteAura-1)} movement speed for ${R.support.hasteDuration}s every ${R.support.hastePeriod}s`);
  if(enemy.untouchable>0)add(`Dread aura · defenders within ${R.dread.radius} tiles lose ${percent(enemy.untouchable)} attack speed · control resistance reduces slowing`,'untouchable');
  if(enemy.thief>0)add(`Steals ${enemyNumber(enemy.thief)} gold on reaching the keep`);
  if(enemy.type==='shaman')add(`Invaders within ${R.support.radius} tiles gain ${percent(R.support.shamanHaste-1)} movement speed continuously`);
  if(enemy.type==='warlock')add(`Invaders within ${R.support.radius} tiles gain ${percent(R.support.warlockWard)} magic resistance`,'magic');
  if(enemy.type==='berserker')add(`Below ${percent(R.rush.berserkerThreshold)} health · ×${R.rush.berserkerSpeed} movement speed`);
  if(enemy.type==='sapper')add(`Scorches barricades within ${R.sapper.radius} tiles for ${R.sapper.duration}s · defenders within ${R.sapper.defenderRadius} tiles of each scorched barricade lose ${percent(R.sapper.attackPenalty)} attack speed`);
  return traits;
}

export function bossHealth(game) {
  if(!game.wave.boss)return null;
  const living=game.combat.enemies.filter(e=>e.boss&&!e.dead);
  let hp=living.reduce((sum,e)=>sum+Math.max(0,e.hp),0),maxHp=living.reduce((sum,e)=>sum+e.maxHp,0);
  for(const queued of game.combat.spawnQueue){
    const enemy={...game.data.enemies[queued.type],...queued.modifiers?.variant};
    if(!enemy.boss)continue;
    const health=enemy.hp*(queued.modifiers?.hp||1);hp+=health;maxHp+=health;
  }
  return {hp:Math.ceil(hp),maxHp:Math.ceil(maxHp),approaching:!living.length&&hp>0};
}

export function builtTowerCount(towers,family,tier=null) {
  return towers.filter(t=>t.state==='active'&&t.family===family&&(tier===null||t.tier===tier)).length;
}
