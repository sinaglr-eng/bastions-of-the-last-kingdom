import {towerStats} from '../game/core/math.js';
import {canonicalCombatStats,damageType,effectDamageType} from '../game/core/combat-rules.js';

export const RECIPE_FILTERS={
  damage:[['physical','Physical'],['magical','Magical'],['holy','Holy']],
  ability:[['poison','Poison'],['burn','Fire aura / burning'],['slow','Slow'],['stun','Stun / petrify'],['armor','Armor reduction'],['critical','Critical hits'],['splash','Splash / multiple targets'],['lightning','Lightning'],['support','Ally support'],['detection','Reveal hidden enemies'],['healing-block','Prevent healing']],
  counter:[['magic-immunity','Magical immunity'],['armor','Armor'],['physical-immunity','Physical immunity'],['evasion','Evasion'],['shields','Hit-blocking shields'],['shell','Direct-hit shell'],['regeneration','Regeneration'],['hidden','Hidden enemies'],['flying','Flying enemies']]
};
export function recipeCapabilities(s,{family}={}){
  s=canonicalCombatStats(s);
  const damage=new Set(),abilities=new Set(),counters=new Set();
  const channel=type=>{if(type)damage.add(damageType(type));};
  if(s.damage>0)channel(s.type);
  if(s.poisonDps||s.poison){channel(effectDamageType(s,'poison'));abilities.add('poison');}
  if(s.burnAura||s.burnDps||s.burn||s.burnedChance){channel(effectDamageType(s,'burn'));abilities.add('burn');}
  if(s.bleed)channel(effectDamageType(s,'bleed'));
  if(s.cleave){channel(s.cleaveType||s.type);abilities.add('splash');}
  if(s.chain){channel(s.type);abilities.add('lightning');abilities.add('splash');}
  if(s.forkedTargets){channel(effectDamageType(s,'lightning'));abilities.add('lightning');abilities.add('splash');}
  if(s.bouncingFrost){channel(effectDamageType(s,'frost'));abilities.add('splash');}
  if(s.multishot)abilities.add('splash');
  if(s.slow||s.slowAura||s.antiAirSlow||s.stoneGazeChance)abilities.add('slow');
  if(s.freeze||s.stoneGazeChance)abilities.add('stun');
  if(s.shred||s.armorShredAura||s.antiAirShred)abilities.add('armor');
  if(s.critChance)abilities.add('critical');
  if(s.aura)abilities.add('support');
  if(s.detectionRange||family==='cleric'){abilities.add('detection');counters.add('hidden');}
  if(s.healingBlockDuration){abilities.add('healing-block');counters.add('regeneration');}
  // Primary, independently triggered cleave and passive damage are the channels
  // that can still occur when the primary damage type is immune.
  const independent=new Set();if(s.damage>0)independent.add(s.type);
  if(s.cleave)independent.add(s.cleaveType||s.type);
  if(s.burnAura)independent.add(effectDamageType(s,'burn'));
  // On-hit poison and procs require a successful primary hit. A physical
  // attacker with poison cannot apply it to a physically immune ground target.
  if(independent.has('physical')||independent.has('holy'))counters.add('magic-immunity');
  if(s.penetration>0||s.shred||s.armorShredAura||s.antiAirShred)counters.add('armor');
  if(independent.has('magical')||independent.has('holy'))counters.add('physical-immunity');
  if(s.trueStrike||s.aura?.trueStrike||s.burnAura)counters.add('evasion');
  if(s.poisonDps||s.poison||s.burnDps||s.burn||s.bleed||s.burnAura||s.cleave){counters.add('shields');counters.add('shell');}
  if(!s.melee)counters.add('flying');
  return {damage,abilities,counters};
}
export function recipeMatches(stats,{damage='',ability='',counter=''}={},context={}){
  const tags=recipeCapabilities(stats,context);
  return (!damage||tags.damage.has(damage))&&(!ability||tags.abilities.has(ability))&&(!counter||tags.counters.has(counter));
}
const select=(key,label)=>`<label>${label}<select data-recipe-filter="${key}" aria-label="${label}"><option value="">All</option>${RECIPE_FILTERS[key].map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></label>`;
export function recipeFilterControlsMarkup(){
  return `<section class="recipe-filters" aria-label="Filter defenders"><div class="recipe-filter-controls">${select('damage','Damage type')}${select('ability','Ability')}${select('counter','Against defense')}<button class="text-button" type="button" data-recipe-filter-reset>Reset filters</button></div><p class="recipe-filter-note">Matches attacks, damaging abilities and ally support. On-hit poison and burning need an initial damaging hit; secondary attacks, support, air debuffs and chance effects have their stated conditions. Holy ignores damage immunities, but armor, evasion, shields and shells still apply. Read the effects below. Filters combine.</p><p class="recipe-filter-count" role="status" aria-live="polite"></p><p class="recipe-filter-empty" hidden>No defenders match these filters. Change a filter or reset them.</p></section>`;
}
export function connectRecipeFilters(host,data,{state={damage:'',ability:'',counter:''}}={}){
  const controls=[...host.querySelectorAll('[data-recipe-filter]')];
  const apply=()=>{
    let matches=0,total=0;
    for(const card of host.querySelectorAll('.recipe-card[data-family]')){
      const family=card.dataset.family,s=towerStats({family,tier:1},data);
      card.hidden=!recipeMatches(s,state,{family});total++;if(!card.hidden)matches++;
    }
    for(const entry of host.querySelectorAll('[data-filter-family]')){
      let ranks=0;
      for(const row of entry.querySelectorAll('[data-filter-tier]')){
        row.hidden=!recipeMatches(towerStats({family:entry.dataset.filterFamily,tier:Number(row.dataset.filterTier)},data),state,{family:entry.dataset.filterFamily});
        total++;if(!row.hidden){matches++;ranks++;}
      }
      entry.hidden=ranks===0;
    }
    host.querySelector('.recipe-filter-count').textContent=`${matches} of ${total} defender profiles match`;
    host.querySelector('.recipe-filter-empty').hidden=matches>0;
  };
  const change=event=>{const key=event.target.dataset.recipeFilter;if(key){state[key]=event.target.value;apply();}};
  const reset=()=>{for(const control of controls){state[control.dataset.recipeFilter]='';control.value='';}apply();};
  for(const control of controls){const key=control.dataset.recipeFilter;if(!RECIPE_FILTERS[key].some(([value])=>value===state[key]))state[key]='';control.value=state[key]||'';}
  host.addEventListener('change',change);const button=host.querySelector('[data-recipe-filter-reset]');button.addEventListener('click',reset);apply();
  return {state,apply,dispose(){host.removeEventListener('change',change);button.removeEventListener('click',reset);}};
}
