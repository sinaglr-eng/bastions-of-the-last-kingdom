import visuals from '../../data/faction-attack-visuals.json' with {type:'json'};
export const factionWeaponVisual=family=>visuals[family]||null;
const kinds={
 'axe-cleave':'axe','pick-strike':'pick','sword-slash':'melee','dual-blade':'melee',
 'rifle-shot':'bullet','gatling-shot':'bulletRapid','mortar-shot':'shell','cannon-shot':'cannon',
 'grenade-throw':'grenade','drum-strike':'drum','mech-punch':'hammer','ent-slam':'treeSlam',
 'spider-strike':'web','dragon-breath':'flame','flamethrower-channel':'flame',
};
export function factionAttackVisualKind(family,stats={}){
 const p=visuals[family];if(!p||p.factionId==='crown'||family==='ladyclaire')return null;
 if(p.motion==='spider-strike'&&p.weapon==='humanoid-claws')return 'claw';
 if(p.motion==='spear-thrust')return p.weapon==='storm-spear'?'stormSpear':'thrust';
 if(p.motion==='hammer-slam')return p.weapon.includes('rune')?'runic':'hammer';
 if(p.motion==='forge-channel')return stats.continuousAttack?'flame':'forge';
 if(p.motion==='beak-strike')return stats.type==='magical'?'lightning':'claw';
 if(p.motion==='bow-shot')return 'arrow';
 if(p.motion==='staff-cast')return p.weapon.includes('rune')?'runic':p.weapon.includes('storm')?'lightning':/lunar|crescent/.test(p.weapon)?'moon':stats.type==='holy'?'holy':'arcane';
 if(p.motion==='hand-cast')return 'moon';
 return kinds[p.motion]||null;
}

// Map authoritative ammunition timing to the original, immutable V3 clip.
export function authoredWeaponPhase(actual,authored,phase,rate=1){
 const a=actual?.weaponCycle,b=authored?.weaponCycle,clamp=v=>Math.max(0,Math.min(1,v));if(!a||!b||!(rate>0))return clamp(phase);
 const spin=a.spinUpSeconds||0,fire=a.magazine*a.fixedInterval/rate,reload=a.reload||0,total=spin+fire+reload;
 const oldSpin=b.spinUpSeconds||0,oldFire=b.magazine*b.fixedInterval,oldReload=b.reload||0,oldTotal=oldSpin+oldFire+oldReload,t=clamp(phase)*total;
 const mapped=t<spin?oldSpin*t/Math.max(.00001,spin):t<spin+fire?oldSpin+oldFire*(t-spin)/Math.max(.00001,fire):oldSpin+oldFire+oldReload*(t-spin-fire)/Math.max(.00001,reload);
 return clamp(mapped/Math.max(.00001,oldTotal));
}
