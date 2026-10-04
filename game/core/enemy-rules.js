// Timing and reach used by combat, native cues and the numerical warband guide.
const rule=values=>Object.freeze(values);
export const ENEMY_RULES=Object.freeze({
  disarm:rule({duration:3,period:8,radius:3,phasePerId:.37}),
  dread:rule({radius:4}),
  refraction:rule({period:8}),
  recharge:rule({period:8}),
  blink:rule({period:6}),
  cloak:rule({period:6,hiddenDuration:4}),
  reveal:rule({checkpointRadius:1.5,defenderRadius:2,clericRadius:6}),
  support:rule({radius:3.5,hasteDuration:3,hastePeriod:6,shamanHaste:1.15,warlockWard:.18}),
  rush:rule({duration:2,period:6,berserkerThreshold:.5,berserkerSpeed:1.65}),
  reactive:rule({maxStacks:12,decayPerSecond:.7}),
  sapper:rule({radius:1.5,duration:3,defenderRadius:2,attackPenalty:.15}),
});

// Each invader retains its staggered combat-time window. Protection shortens
// that window; 100% control resistance prevents it completely.
export function enemyDisarmActive(enemy,elapsed,controlResistance=0){
  const r=ENEMY_RULES.disarm;
  return !!enemy.disarm&&(elapsed+enemy.id*r.phasePerId)%r.period<r.duration*(1-controlResistance);
}

export const enemyNumber=value=>Number(value.toFixed(3)).toLocaleString('en-US',{maximumFractionDigits:3});
