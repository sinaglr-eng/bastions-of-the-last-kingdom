import {icon} from './icons.js';
import {enemyDefenseGlyph} from './enemy-trait-symbols.js';
import {ENEMY_DEFENSE_SYMBOLS} from '../game/render/enemy-defense-symbols.js';
import {battlefieldDisclosureMarkup,updateBattlefieldDisclosure} from './tower-dps.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(value);
const quantity=value=>Number.isFinite(value)&&value>=0?number(value):'?';
const nextOf=model=>model&&Object.hasOwn(model,'next')?model.next:model;

function defenses(enemy){
  const variants=(Array.isArray(enemy.variants)?enemy.variants:[]).filter(variant=>variant&&typeof variant==='object'),traits=new Map();
  variants.forEach((variant,index)=>{
    const seen=new Set(),add=(text,kind=null)=>{
      const key=JSON.stringify([kind,text]);if(!text||seen.has(key))return;seen.add(key);
      if(!traits.has(key))traits.set(key,{text,kind,variants:[]});traits.get(key).variants.push(index);
    };
    if(Number.isFinite(variant.armor)&&variant.armor>0)add(`${number(variant.armor)} armor`);
    for(const trait of Array.isArray(variant.traitDetails)?variant.traitDetails:[])if(trait?.text)add(trait.text,trait.kind);
  });
  if(!traits.size)return `<p class="next-wave-no-traits">${enemy.unknown?'Enemy ability information unavailable':'No special resistances or abilities'}</p>`;
  return `<ul class="next-wave-traits">${[...traits.values()].map(trait=>{
    const possible=trait.variants.length<variants.length,profiles=trait.variants.map(index=>variants[index].name||`Variant ${index+1}`).join(', ');
    return `<li${possible?' class="possible"':''}>${Object.hasOwn(ENEMY_DEFENSE_SYMBOLS,trait.kind)?enemyDefenseGlyph(trait.kind):''}<span>${escape(trait.text)}${possible?`<small>Possible · ${escape(profiles)}</small>`:''}</span></li>`;
  }).join('')}</ul>`;
}

function summaryParts(model,images={},options={}){
  const next=nextOf(model);if(!next)return null;
  const numberLabel=Number.isSafeInteger(next.number)&&next.number>0?next.number:'?',enemies=(Array.isArray(next.enemies)?next.enemies:[]).filter(enemy=>enemy&&typeof enemy==='object');
  const summary=`<span class="next-wave-heading"><strong>Next wave</strong><small>${escape(numberLabel)} · ${quantity(next.totalCount)} ${next.totalCount===1?'invader':'invaders'}</small></span>`;
  const body=`<h2 class="next-wave-name">${escape(next.name||'Upcoming wave')}</h2>${enemies.some(enemy=>enemy.variants?.length>1)?'<p class="next-wave-variant-note">Variants may mix. Abilities marked Possible depend on the variant.</p>':''}${enemies.length?enemies.map(enemy=>{
    const portrait=images['enemy:'+enemy.type],heading=`${portrait?`<img src="${escape(portrait)}" alt="" draggable="false">`:`<span class="next-wave-placeholder" aria-hidden="true">${icon(enemy.boss?'crown':'shield')}</span>`}<h3>${quantity(enemy.count)} × ${escape(enemy.name||'Unknown invader')}</h3>`;
    return `<article class="next-wave-group"><header>${heading}</header>${defenses(enemy)}</article>`;
  }).join(''):'<p class="next-wave-no-traits">Enemy composition unavailable.</p>'}`;
  return {summary,body,kind:'next-wave-summary',scrollSelector:'.next-wave-summary-body',open:options.open!==false};
}

// Only the immediate authored composition enters this compact panel. Outlook,
// army, forecast fields and the random variant roll are outside its scope.
export function nextWaveSummaryMarkup(model,data={},images={},options={}){
  const parts=summaryParts(model,images,options);return parts?battlefieldDisclosureMarkup(parts):'';
}

export function updateNextWaveSummaryPanel(panel,model,data={},images={},options={}){
  const parts=summaryParts(model,images,options);panel.hidden=!parts;
  return parts?updateBattlefieldDisclosure(panel,parts):false;
}
