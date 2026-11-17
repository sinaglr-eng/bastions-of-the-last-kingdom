import {usesArtifactRulesV3} from '../game/core/artifacts.js';
import {artifactEffects} from '../game/core/artifact-combat.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=value=>`${Number((100*value).toFixed(2)).toLocaleString('en-US')}%`;

// Explanations are scoped to this active defender. Enemy-dependent bonuses
// stay conditional instead of pretending to be unconditional displayed DPS.
export function artifactDefenderNotes(game,tower,stats){
 if(tower.state!=='active'||!game.towers.includes(tower))return [];
 const b=artifactEffects(game),rows=[],primary=stats.damage>0||stats.continuousAttack?.dps>0,modern=usesArtifactRulesV3(game);
 const abilities=stats.abilities||[],fixed=abilities.some(a=>['fire-aura','spark','heat'].includes(a.familyId))||stats.burnAura;
 if(b.damage)rows.push(`Own damage ${b.damage>0?'+':''}${pct(b.damage)} applies to attacks, native damage over time and damaging auras. Artifact damage over time includes this bonus once through its originating hit.`);
 if(b.speed&&fixed)rows.push('Attack speed changes primary attacks; independent aura and timed-ability clocks stay unchanged.');
 if((b.rangeTiles||b.range)&&!primary)rows.push('Attack range is inactive for this aura-only defender; its aura footprint stays unchanged.');
 if(b.poisonFraction)rows.push(primary?`Artifact Poison: ${pct(b.poisonFraction)} of effective primary-hit damage over 3s, before its Magical defenses${modern?'; main target only':''}.`:'Artifact Poison is inactive: this defender has no primary damaging attack.');
 if(b.burnFraction)rows.push(primary?`Artifact Burn: ${pct(b.burnFraction)} of effective primary-hit damage over 2s, before its Magical defenses${modern?'; main target only':''}.`:'Artifact Burn is inactive: this defender has no primary damaging attack.');
 if(b.poisonPower&&!b.poisonFraction)rows.push('Poison Power is inactive without an equipped artifact Poison source; native Poison is unchanged.');
 if(b.burnPower&&!b.burnFraction)rows.push('Burn Power is inactive without an equipped artifact Burn source; native Burn is unchanged.');
 if(!primary&&(b.slow||b.shred||b.freezeChance))rows.push('Artifact Slow, armor reduction and Freeze require a successful primary damaging hit.');
 if(b.slow)rows.push(`Artifact Slow: ${pct(b.slow)} for 2s (${pct(b.slow*.5)} on bosses). The strongest active Slow wins. ${modern?'Weaker sources keep their own expiry.':'This saved defense keeps its original Slow duration rules.'}`);
 if(b.shred){const native=Math.max(0,...abilities.filter(a=>a.familyId==='armor-reduction').map(a=>a.armorReduction??a.amount??0));rows.push(`Artifact armor reduction: ${b.shred} for 2s. ${native>b.shred?`This defender's stronger native reduction (${native}) takes precedence.`:'A stronger native reduction takes precedence instead of adding.'}`);}
 if(b.freezeChance)rows.push(`Artifact Freeze: ${pct(b.freezeChance)} for ${b.freezeDuration}s; half duration on bosses and a shared 6s target cooldown${modern?'. Longer native control takes precedence':'. This saved defense uses its original control rules'}.`);
 if(b.immunityReduction)rows.push(`${pct(b.immunityReduction)} damage passes through damage immunity; a stronger native breach wins. Status immunity, visibility and target permissions stay separate.`);
 if(b.healingReduction)rows.push(`${pct(b.healingReduction)} less healing and regeneration while ${modern?'any allowed native or artifact Poison':'artifact Poison'} is active. A stronger native healing reduction wins.`);
 const conditions=[];if(b.bossDamage)conditions.push(`+${pct(b.bossDamage)} against bosses`);if(b.conditionalPoison)conditions.push(`+${pct(b.conditionalPoison)} against poisoned targets`);if(b.conditionalBurn)conditions.push(`+${pct(b.conditionalBurn)} against burning targets`);if(b.conditionalControl)conditions.push(`+${pct(b.conditionalControl)} against slowed/frozen targets`);
 if(conditions.length)rows.push(`Conditional own damage, excluded from the neutral-target DPS above: ${conditions.join('; ')}.`);
 if(b.controlResistance)rows.push(`${pct(b.controlResistance)} artifact Disarm/Dread resistance combines with native protection through remaining vulnerability; Melancholy and barricade disruption are unaffected.`);
 return rows;
}

export function artifactDefenderNotesMarkup(game,tower,stats){
 const rows=artifactDefenderNotes(game,tower,stats);
 return rows.length?`<details class="defender-artifact-rules" style="grid-column:1/-1"><summary>Artifacts on this defender</summary><ul>${rows.map(row=>`<li>${esc(row)}</li>`).join('')}</ul></details>`:'';
}
