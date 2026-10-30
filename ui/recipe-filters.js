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
  if(s.factionProfile){
    const groups={poison:['poison'],burn:['burn','fire-aura','flame-cone'],slow:['slow','slow-aura','root'],stun:['stun','freeze','root'],armor:['armor-reduction','armor-reduction-aura','armor-penetration'],critical:['critical-strike','magical-critical-strike'],splash:['splash','cleave-physical','cleave-magical','multishot','ricochet','flame-cone'],lightning:['lightning','spark'],support:['attack-speed-aura','damage-aura','range-aura','protection-aura'],detection:['visibility'],'healing-block':['anti-regeneration']};
    for(const a of s.abilities||[]){for(const [tag,ids]of Object.entries(groups))if(ids.includes(a.familyId))abilities.add(tag);if(a.damage||a.dps||a.damagePercent){const type=a.damageType==='profile'?s.type:a.damageType==='magical-or-holy'?(s.type==='holy'?'holy':'magical'):a.damageType;if(type)damage.add(damageType(type));}if(a.familyId==='cancel-magic-immunity')counters.add('magic-immunity');if(a.familyId==='cancel-physical-immunity')counters.add('physical-immunity');if(a.familyId==='true-strike')counters.add('evasion');}
    if(s.continuousAttack){damage.add(s.type);counters.add('shields');counters.add('shell');}
    if(abilities.has('healing-block'))counters.add('regeneration');
  }
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
  if(!s.melee&&!s.groundOnly)counters.add('flying');
  return {damage,abilities,counters};
}
export function recipeMatches(stats,{damage='',ability='',counter=''}={},context={}){
  const tags=recipeCapabilities(stats,context);
  return (!damage||tags.damage.has(damage))&&(!ability||tags.abilities.has(ability))&&(!counter||tags.counters.has(counter));
}
const select=(key,label)=>`<label>${label}<select data-recipe-filter="${key}" aria-label="${label}"><option value="">All</option>${RECIPE_FILTERS[key].map(([value,name])=>`<option value="${value}">${name}</option>`).join('')}</select></label>`;
export function recipeFilterControlsMarkup({compact=false,expanded=false,atlas=false}={}){
  const controls=`<div class="recipe-filter-controls">${select('damage','Damage type')}${select('ability','Ability')}${select('counter','Against defense')}<button class="text-button" type="button" data-recipe-filter-reset>Reset filters</button></div>`;
  const note='<p class="recipe-filter-note">Matches attacks, damaging abilities and ally support. On-hit poison and burning need an initial damaging hit; secondary attacks, support, air debuffs and chance effects have their stated conditions. Holy damage ignores both damage immunities; its companion effects respect their normal immunity categories. Armor, evasion, shields and shells still apply. Read the effects below. Filters combine.</p>';
  if(atlas)return `<section class="recipe-filters compact-recipe-filters atlas-recipe-filters" aria-label="Filter defenders"><div class="recipe-filter-controls">${select('damage','Damage type')}${select('ability','Ability')}${select('counter','Against defense')}</div><p class="recipe-filter-count" role="status" aria-live="polite"></p><p class="recipe-filter-empty" hidden>No defenders match these filters. Choose All in a filter to broaden the list.</p></section>`;
  return `<section class="recipe-filters ${compact?'compact-recipe-filters':''}" aria-label="Filter defenders">${compact?`<details data-catalog-disclosure="filters"${expanded?' open':''}><summary>Filters <span data-catalog-active-filters></span></summary>${controls}<details data-catalog-disclosure="filter-help"><summary>How filters work</summary>${note}</details></details>`:controls+note}<p class="recipe-filter-count" role="status" aria-live="polite"></p><p class="recipe-filter-empty" hidden>No defenders match these filters. Change a filter or reset them.</p></section>`;
}
export function connectRecipeFilters(host,data,{state={damage:'',ability:'',counter:''},matchCard=null,onApply=null,profileScope='all'}={}){
  const controls=[...host.querySelectorAll('[data-recipe-filter]')];
  const apply=()=>{
    let champions=0,championMatches=0,basics=0,basicMatches=0;
    const rows=[...host.querySelectorAll('.recipe-catalog-row[data-family]')],cards=rows.length?rows:[...host.querySelectorAll('.recipe-card[data-family]')];
    const query=String(state.query||'').trim().toLocaleLowerCase('en-US');
    for(const card of cards){
      const family=card.dataset.family,s=towerStats({family,tier:1},data);
      card.hidden=!recipeMatches(s,state,{family})||!s.name.toLocaleLowerCase('en-US').includes(query)||!!matchCard&&!matchCard(card,s);champions++;if(!card.hidden)championMatches++;
    }
    for(const entry of host.querySelectorAll('[data-filter-family]')){
      let ranks=0;
      for(const row of entry.querySelectorAll('[data-filter-tier]')){
        const stats=towerStats({family:entry.dataset.filterFamily,tier:Number(row.dataset.filterTier)},data);
        row.hidden=!recipeMatches(stats,state,{family:entry.dataset.filterFamily})||!stats.name.toLocaleLowerCase('en-US').includes(query);
        basics++;if(!row.hidden){basicMatches++;ranks++;}
      }
      entry.hidden=ranks===0;
    }
    const scope=typeof profileScope==='function'?profileScope():profileScope,matches=scope==='champions'?championMatches:scope==='basics'?basicMatches:championMatches+basicMatches,total=scope==='champions'?champions:scope==='basics'?basics:champions+basics;
    const count=host.querySelector('.recipe-filter-count');if(count)count.textContent=`${matches} of ${total} ${scope==='champions'?'champions':scope==='basics'?'basic rank profiles':'defender profiles'} match`;
    const empty=host.querySelector('.recipe-filter-empty');if(empty)empty.hidden=matches>0;
    const active=host.querySelector('[data-catalog-active-filters]'),activeCount=['damage','ability','counter'].filter(key=>state[key]).length;if(active)active.textContent=activeCount?`(${activeCount} active)`:'';
    onApply?.({matches,total,championMatches,basicMatches});
  };
  const change=event=>{const key=event.target.dataset.recipeFilter;if(key){state[key]=event.target.value;apply();}};
  const reset=()=>{for(const control of controls){state[control.dataset.recipeFilter]='';control.value='';}apply();};
  for(const control of controls){const key=control.dataset.recipeFilter;if(!RECIPE_FILTERS[key].some(([value])=>value===state[key]))state[key]='';control.value=state[key]||'';}
  host.addEventListener('change',change);const button=host.querySelector('[data-recipe-filter-reset]');button?.addEventListener('click',reset);apply();
  return {state,apply,dispose(){host.removeEventListener('change',change);button?.removeEventListener('click',reset);}};
}
