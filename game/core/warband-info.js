const percent=value=>`${Math.round(value*100)}%`;

// Read the chosen variant from the actual wave, rather than listing every possible variant.
export function currentWarbandInfo(game) {
  return game.wave.groups.map(group=>{
    const queued=game.combat.spawnQueue.find(q=>q.type===group.type);
    const live=game.combat.enemies.find(e=>e.type===group.type&&!e.dead);
    const base=game.data.enemies[group.type],modifiers=queued?.modifiers||game.wave;
    const selected={...base,...modifiers.variant};
    const enemy=live||{...selected,resists:{...selected.resists,...modifiers.resists}};
    const maxHp=live?.maxHp??enemy.hp*(modifiers.hp||1);
    const armor=live?.armor??enemy.armor+(modifiers.armor||0);
    return {type:group.type,name:enemy.name,count:group.count,maxHp,armor,flying:!!enemy.flying,traits:warbandTraits(enemy),traitDetails:warbandTraitDetails(enemy)};
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
  if(enemy.regen)add(`Regenerates ${Math.round(enemy.regen).toLocaleString()} HP/s`,'regen');
  if(enemy.evasion)add(`${percent(enemy.evasion)} chance to evade direct physical hits`,'evasion');
  if(enemy.refraction)add(`${enemy.refraction} hit-blocking shields · refresh every 8s`,'refraction');
  if(enemy.krakenShell)add(`Shell blocks ${Math.round(enemy.krakenShell)} damage per direct hit`,'krakenShell');
  if(enemy.reactiveArmor)add(`Reactive armor · +${enemy.reactiveArmor} per hit`,'reactive');
  if(enemy.recharge)add(`Restores ${percent(enemy.recharge)} health every 8s`,'recharge');
  if(enemy.stealth||enemy.cloakDaggers)add(enemy.cloakDaggers?'Cycles cloak and close-range disarms':'Cloaked beyond 2 tiles · Clerics reveal within 6');
  if(enemy.disarm&&!enemy.cloakDaggers)add('Disarms nearby defenders every 8s');
  if(enemy.blink)add(`Blinks ${enemy.blink} tiles every 6s`);
  if(enemy.rush)add(`Blood rush · ×${enemy.rush} speed for 2s every 6s`);
  if(enemy.hasteAura)add(`Nearby invaders gain ${percent(enemy.hasteAura-1)} movement speed for 3s every 6s`);
  if(enemy.untouchable)add(`Dread aura · nearby defenders lose ${percent(enemy.untouchable)} attack speed`,'untouchable');
  if(enemy.thief)add(`Steals ${enemy.thief} gold on reaching the keep`);
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
