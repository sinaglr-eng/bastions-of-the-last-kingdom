const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=value=>`${Number(((value||0)*100).toFixed(2)).toLocaleString('en-US')}%`;
const number=value=>Number(value||0).toLocaleString('en-US');

export const ARTIFACT_SET_STORIES=Object.freeze({
 'iron-legion':'At the Siege of Seven Gates, the Iron Legion held its line until the enemy warlord came within reach. Its battered arms still carry the oath to break the strongest foe first.',
 'stormwing-vanguard':'The first Stormwings crossed the mountain passes ahead of the thunder. Their signalers learned to strike quickly, reach distant targets and find a way through enchanted defenses.',
 'winter-court':'When the northern court fell silent, its wardens sealed the road beneath a sheet of living frost. Their regalia preserves the patient art of keeping an army within bowshot.',
 'venom-covenant':'The marsh apothecaries made their covenant beside a spring that no invader could drink from. Their weapons leave a lingering sickness that makes an enemy’s recovery falter.',
 'ashen-dragon':'A dragon’s last ember was divided among the keepers of a ruined forge. They carried its fire into battle, passing the remaining flame onward when a burning foe fell.',
 'royal-architect':'The royal builders arrived with plans, pay chests and enough stone to raise another wall. Their tools remind every commander that a lasting defense begins before the first arrow flies.',
 celestial:'Ten fragments of a fallen star were entrusted to ten guardians at the kingdom’s founding. Reunited, they lend the whole defending army the reach, speed and force of that first dawn.',
 necromancer:'The Dominion’s master bound the memory of a broken army into these relics. Their cold touch weighs down the living, strips away armor and opens cracks in otherwise untouchable wards.',
 'militia-oath':'A village smith armed two neighbors from the same bar of iron. Their simple oath spread along the walls: stand together, and make every strike count.',
 'scouts-trail':'Scouts marked the safe paths with ribbons that only their companions could read. Their traveling gear preserves that habit of finding a clear shot before the enemy closes.',
 'stewards-kit':'The keep’s steward once saved a siege by counting every sack, coin and spare arrow. This modest kit is still packed as if a long defense begins at sunrise.',
 'watchmans-vigil':'A lone watchman kept the beacon alight while pale shapes gathered beyond the gate. His cap and buckler passed from sentry to sentry with a promise to protect the keep through the night.',
 'quicksilver-drill':'The drillmaster timed each practice stroke against a falling silver bead. Recruits who learned the rhythm discovered that a swift second strike could turn a wavering defense.',
 farwatch:'Farwatch’s sentries hung a polished lens above the oldest tower door. Each new lookout wore it for one night and returned able to judge a threat beyond the usual watch.',
 hearthwarden:'When refugees reached the walls, the hearthwardens brought a shared purse and room beside the fire. Their small provisions gave the keep one more chance to endure.',
 'battle-cadence':'A marching drummer carried the same four-beat signal through three lost campaigns. At the final bridge, every defender answered together, and the line held.',
 'crimson-covenant':'The crimson wardens swore to return from every victory with one cup for the wounded. Their relics offer a small measure of recovery only after the battlefield has fallen quiet.',
});

export function artifactSetExplanation(set,summary){
 const e=summary.effects;
 switch(set.id){
  case 'iron-legion':return `All defenders deal ${pct(e.damage)} more own damage. Against bosses they also gain ${pct(e.bossDamage)} boss damage, helping the army bring down tougher leaders.`;
  case 'stormwing-vanguard':return `All defenders attack ${pct(e.speed)} faster and can target enemies ${number(e.rangeTiles)} tiles farther away. Their Physical and Magical attacks can pass ${pct(e.immunityReduction)} of their damage through the matching damage immunity.`;
  case 'winter-court':return `All defenders gain ${number(e.rangeTiles)} tiles of attack range. Valid primary hits slow enemies by ${pct(e.slow)} and can briefly freeze them; attacks also gain ${pct(e.conditionalControl)} damage against enemies that are actually slowed or frozen. Status immunity and the shared freeze cooldown still apply.`;
  case 'venom-covenant':return `A successful primary hit adds poison based on the health that hit actually removed. The full set’s +${pct(e.poisonPower)} artifact poison damage is already included in its ${pct(e.poisonFraction)} total poison budget, dealt over 3 seconds as Magical damage. For example, a hit that removes 100 HP creates ${number(100*e.poisonFraction)} poison damage before the target’s Magical defenses. Poisoned targets receive ${pct(e.healingReduction)} less healing, and your defenders deal ${pct(e.conditionalPoison)} more damage to them.`;
  case 'ashen-dragon':return `Successful primary hits leave an artifact burn worth ${pct(e.burnFraction)} of the health removed by that hit, spread over 2 seconds as Magical damage. The +${pct(e.burnPower)} artifact burn damage is included in that total. Your army gains ${number(e.rangeTiles)} tiles of attack range and ${pct(e.conditionalBurn)} damage against burning targets. When an artifact-burning enemy dies, its unused burn is shared among up to three valid nearby enemies; transferred fire cannot spread again.`;
  case 'royal-architect':return `Start a new defense with ${number(e.gold)} extra gold, ${number(e.cp)} extra CP and ${number(e.keepHealth)} extra current and maximum keep health. Attacks can pass ${pct(e.immunityReduction)} damage through matching Physical or Magical immunity. Once per run, a boss kill restores up to ${number(e.reinforceKeep)} missing keep health; the charge is saved if the keep is already full.`;
  case 'celestial':return `Every defender deals ${pct(e.damage)} more own damage, attacks ${pct(e.speed)} faster and can target enemies ${number(e.rangeTiles)} tiles farther away. This is a direct army-wide improvement without a status condition.`;
  case 'necromancer':return `Valid primary hits slow enemies by ${pct(e.slow)} and reduce their armor by ${number(e.shred)} for 2 seconds, making Physical attacks more effective. Your Physical and Magical attacks can pass ${pct(e.immunityReduction)} damage through their matching damage immunity. The strongest active armor reduction and immunity breach apply; weaker effects do not add on top.`;
  case 'militia-oath':return `Every defender deals ${pct(e.damage)} more own damage from the start of the next defense.`;
  case 'scouts-trail':return `Every defender attacks ${pct(e.speed)} faster and gains ${number(e.rangeTiles)} tiles of attack range. Support auras and splash areas keep their original size.`;
  case 'stewards-kit':return `Start the next defense with ${number(e.gold)} extra gold, ${number(e.cp)} extra CP and ${number(e.keepHealth)} extra current and maximum keep health. These supplies are granted once when the new defense begins.`;
  case 'watchmans-vigil':return `Begin with ${number(e.keepHealth)} extra current and maximum keep health. Your Physical and Magical attacks can pass ${pct(e.immunityReduction)} damage through the matching damage immunity; status immunities remain unchanged.`;
  case 'quicksilver-drill':case 'battle-cadence':return `Every defender attacks ${pct(e.speed)} faster for the entire next defense. This increases attack frequency; it does not raise the damage of each hit.`;
  case 'farwatch':return `Every defender can target enemies ${number(e.rangeTiles)} ${e.rangeTiles===1?'tile':'tiles'} farther away for the entire next defense. The bonus extends attack range; support auras, splash areas and secondary jumps keep their original reach.`;
  case 'hearthwarden':return `Start a new defense with ${number(e.gold)} extra gold and ${number(e.keepHealth)} extra current and maximum keep health. The gold is a starting supply, not a payment every wave.`;
  case 'crimson-covenant':return `Begin with ${number(e.keepHealth)} extra current and maximum keep health, and give every defender ${pct(e.damage)} more own damage. After each successfully completed wave, restore 1 missing keep health up to its existing maximum. It does not increase maximum health, store unused healing or heal after a failed wave.`;
  default:return '';
 }
}

export const artifactSetStoryMarkup=set=>ARTIFACT_SET_STORIES[set.id]?`<p class="vault-set-lore"><span>From the chronicles</span>${escape(ARTIFACT_SET_STORIES[set.id])}</p>`:'';
export const artifactSetExplanationMarkup=(set,summary)=>`<p class="vault-set-explanation">${escape(artifactSetExplanation(set,summary))}</p>`;
