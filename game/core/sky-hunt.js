import {distance} from './math.js';
import {statusEffectAllowed} from './combat-rules.js';
export const skyHuntAura=stats=>stats.abilities?.find(a=>a.familyId==='sky-hunt'&&a.slowTrigger==='continuous aura');
// Geometric coverage has no visibility, contact, damage or evasion gate.
// Physical immunity is also the game's existing Slow immunity; keep that
// status gate separate from coverage rather than treating aura as a hit.
export function skyHuntCoverage(stats,source,enemy){
 const a=skyHuntAura(stats);
 return a&&source.state==='active'&&!enemy.dead&&enemy.flying&&distance(source,enemy)<=a.slowAuraRadius?a:null;
}
export function skyHuntSlow(stats,source,enemy){
 const a=skyHuntCoverage(stats,source,enemy);
 return a&&statusEffectAllowed(enemy,'slow')?a.slowPercent/100:0;
}
