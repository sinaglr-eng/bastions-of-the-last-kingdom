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
    return {type:group.type,name:enemy.name,count:group.count,maxHp,armor,flying:!!enemy.flying,traits:warbandTraits(enemy)};
  });
}

export function warbandTraits(enemy) {
  const traits=[];
  if(enemy.magicImmune)traits.push('Immune to magic and magical effects');
  if(enemy.physicalImmune)traits.push('Immune to physical and piercing damage');
  for(const [type,value] of Object.entries(enemy.resists||{}))if(value>0)traits.push(`${percent(value)} ${type} resistance`);
  if(enemy.regen)traits.push(`Regenerates ${Math.round(enemy.regen).toLocaleString()} HP/s`);
  if(enemy.evasion)traits.push(`${percent(enemy.evasion)} chance to evade direct physical hits`);
  if(enemy.refraction)traits.push(`${enemy.refraction} hit-blocking shields · refresh every 8s`);
  if(enemy.krakenShell)traits.push(`Shell blocks ${Math.round(enemy.krakenShell)} damage per direct hit`);
  if(enemy.reactiveArmor)traits.push(`Reactive armor · +${enemy.reactiveArmor} per hit`);
  if(enemy.recharge)traits.push(`Restores ${percent(enemy.recharge)} health every 8s`);
  if(enemy.stealth||enemy.cloakDaggers)traits.push(enemy.cloakDaggers?'Cycles cloak and close-range disarms':'Cloaked beyond 2 tiles · Clerics reveal within 6');
  if(enemy.disarm&&!enemy.cloakDaggers)traits.push('Disarms nearby defenders every 8s');
  if(enemy.blink)traits.push(`Blinks ${enemy.blink} tiles every 6s`);
  if(enemy.rush)traits.push(`Blood rush · ×${enemy.rush} speed for 2s every 6s`);
  if(enemy.hasteAura)traits.push(`Nearby invaders gain ${percent(enemy.hasteAura-1)} movement speed for 3s every 6s`);
  if(enemy.untouchable)traits.push(`Dread aura · nearby defenders lose ${percent(enemy.untouchable)} attack speed`);
  if(enemy.thief)traits.push(`Steals ${enemy.thief} gold on reaching the keep`);
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
