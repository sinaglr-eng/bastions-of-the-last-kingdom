// Timing and reach used by combat, native cues and the numerical warband guide.
const rule=values=>Object.freeze(values);
export const ENEMY_RULES=Object.freeze({
  disarm:rule({duration:5,period:8,radius:3,phasePerId:.37}),
  dread:rule({duration:3}),
  refraction:rule({period:2}),
  recharge:rule({period:4}),
  blink:rule({period:5}),
  cloak:rule({period:6,hiddenDuration:4}),
  reveal:rule({checkpointRadius:1.5,defenderRadius:2,clericRadius:6}),
  support:rule({radius:3.5,hasteDuration:3,hastePeriod:6,shamanHaste:1.5}),
  rush:rule({duration:2,period:6,berserkerThreshold:.5,berserkerSpeed:1.65}),
  reactive:rule({maxStacks:15,decayPerSecond:.7}),
  sapper:rule({radius:1.5,duration:3,defenderRadius:2,attackPenalty:.15}),
});
// Console changes are private to one Game's cloned balance. No caller can
// mutate the frozen global defaults or add an unrecognized rule field.
export function enemyRulesFor(gameOrData){
  const data=gameOrData?.data||gameOrData,overrides=data?.balance?.enemyRules;
  if(!overrides)return ENEMY_RULES;
  return Object.fromEntries(Object.entries(ENEMY_RULES).map(([group,defaults])=>[group,Object.fromEntries(Object.entries(defaults).map(([key,value])=>{
    const configured=overrides[group]?.[key],positive=/period/i.test(key);
    return [key,Number.isFinite(configured)&&configured>=(positive?Number.EPSILON:0)?configured:value];
  }))]));
}

// Each invader retains its staggered combat-time window. Protection shortens
// that window; 100% control resistance prevents it completely.
export function enemyDisarmActive(enemy,elapsed,controlResistance=0,rules=ENEMY_RULES){
  const r=rules.disarm;
  return !!enemy.disarm&&(elapsed+enemy.id*r.phasePerId)%r.period<r.duration*(1-controlResistance);
}

export function defenderDreadState(tower,elapsed,controlResistance=0){
  const status=tower?.dread,remaining=Math.max(0,(status?.until||0)-elapsed);
  const amount=remaining?Math.max(0,Math.min(1,status.amount||0))*(1-Math.max(0,Math.min(1,controlResistance))):0;
  return {amount,remaining,source:status?.source||null};
}

// regen is a fraction of actual maximum health, including variant and wave
// modifiers. Definitions use hp; live enemies retain their modified maxHp.
export function enemyRegenerationPerSecond(enemy){
  return Math.max(0,enemy.maxHp??enemy.hp??0)*Math.max(0,enemy.regen||0);
}

export const enemyNumber=value=>Number(value.toFixed(3)).toLocaleString('en-US',{maximumFractionDigits:3});
