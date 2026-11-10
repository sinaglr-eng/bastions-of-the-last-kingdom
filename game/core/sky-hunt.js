import {distance} from './math.js';
import {statusEffectAllowed} from './combat-rules.js';
import {immunityAuraCoverage} from './immunity-auras.js';
export const skyHuntAura=stats=>stats.abilities?.find(a=>a.familyId==='sky-hunt'&&a.slowTrigger==='continuous aura');
// Geometric coverage has no visibility, contact, damage or evasion gate.
// Physical immunity is also the game's existing Slow immunity; keep that
// status gate separate from coverage rather than treating aura as a hit.
export function skyHuntCoverage(stats,source,enemy){
 const a=skyHuntAura(stats);
 return a&&source.state==='active'&&!enemy.dead&&enemy.flying&&distance(source,enemy)<=a.slowAuraRadius?a:null;
}
export function skyHuntSlow(stats,source,enemy,{data,towers,immunityCoverage}={}){
 const a=skyHuntCoverage(stats,source,enemy);
 if(!a)return 0;
 const normal=a.slowPercent/100;
 // A legacy timed breach retains its full Slow permission. The modern Rune
 // exception belongs only to Dwarf Sky Hunt, never the global status gate.
 if(statusEffectAllowed(enemy,'slow'))return normal;
 if(!data?.fr008||data.factionId!=='forge'||!enemy.physicalImmune)return 0;
 const coverage=immunityCoverage??immunityAuraCoverage(enemy,towers,data);
 return normal*(coverage?.physical.multiplier||0);
}
