import {GENERAL_SKILLS} from '../game/core/general.js';
import {skillGate} from '../game/core/account-progression.js';
import {rankLabel} from '../game/core/recipes.js';
import {commanderSkillArt} from './commander-art.js';
import {skillEffect,skillKindLabel,skillPurchaseState} from './general-page.js';
import {escapeProgression as esc,medalAmount,medalIcon} from './progression-art.js';

const formatMedals = value => value.toLocaleString('en-US');
const skillImage = id => `<img src="${commanderSkillArt(id)}" alt="" width="64" height="64">`;

export function editSkillLoadout(loadout, owned, slot, skill) {
 if (!Number.isInteger(slot) || slot < 0 || slot > loadout.length || slot >= 3) return null;
 if (skill === null) return slot < loadout.length ? loadout.filter((_, index) => index !== slot) : null;
 if (!Object.hasOwn(GENERAL_SKILLS, skill) || !(owned[skill] > 0) || loadout.includes(skill)) return null;
 const next = [...loadout];
 next[slot] = skill;
 return next;
}

function slotCard(id, index, owned, enabled) {
 const title = id ? GENERAL_SKILLS[id].name : `Open slot ${index + 1}`;
 const action = id ? 'Replace' : 'Add skill';
 return `<div class="skills-slot ${id ? 'is-filled' : ''}">
  ${id ? skillImage(id) : '<span class="skills-slot-empty" aria-hidden="true">+</span>'}
  <div><strong>${esc(title)}</strong>${id ? `<small class="skills-rank-chip" aria-label="Rank ${rankLabel(owned[id])}">${rankLabel(owned[id])}</small>` : ''}</div>
  <button type="button" data-skill-slot="${index}" aria-label="${id ? 'Replace ' + esc(title) : 'Add skill to slot ' + (index + 1)}" ${enabled ? '' : 'disabled'}>${action}</button>
 </div>`;
}

function rankTiles(id, profile, purchase) {
 return `<div class="skills-rank-track" aria-label="Skill ranks">${[1, 2, 3].map(rank => {
  const gate = skillGate(id, rank, profile);
  const owned = rank <= purchase.level;
  const upcoming = rank === purchase.next;
  const available = upcoming && purchase.canBuy;
  let state = 'Unlock the previous rank first';
  if (owned) state = rank === purchase.level ? '✓ Owned · Current' : '✓ Owned';
  else if (!gate.allowed) state = `${gate.rank.name} · Level ${gate.required}`;
  else if (upcoming) state = available ? (purchase.level ? 'Next upgrade' : 'Ready to unlock') : purchase.reason;
  return `<div class="skills-rank-tile" data-skill-rank="${rank}" data-state="${owned ? 'owned' : available ? 'next' : 'locked'}" ${rank === purchase.level ? 'aria-current="true"' : ''}>
   <b aria-label="Rank ${rankLabel(rank)}">${rankLabel(rank)}</b>
   <strong>${esc(skillEffect(id, rank))}</strong>
   <small>${esc(state)}</small>
  </div>`;
 }).join('')}</div>`;
}

function libraryState(item, equipped) {
 const {level, canBuy, state, reason} = item;
 const parts = level ? [`Rank ${rankLabel(level)}`] : [];
 if (equipped) parts.push('Equipped');
 if (canBuy) parts.push(level ? 'Upgrade available' : 'Unlock available');
 else if (state === 'rank-locked' || state === 'medal-shortfall') parts.push(reason);
 else if (!level) parts.push('Not unlocked');
 return parts.join(' · ');
}

function skillDetail(id, profile, purchase, equipped, enabled, feedback) {
 if (!id) return '<article class="skills-detail skills-panel"><h2>No skills match this filter</h2><p>Choose another filter to browse the library.</p></article>';
 const skill = GENERAL_SKILLS[id];
 const buttonText = purchase.level ? `Upgrade to Rank ${rankLabel(purchase.next)}` : 'Unlock Rank I';
 const rankLocked = purchase.state === 'rank-locked';
 return `<article class="skills-detail skills-panel" data-purchase-state="${purchase.state}" aria-labelledby="skills-detail-title">
  <button type="button" class="skills-back" data-skill-library-back>‹ Skill library</button>
  <header class="skills-detail-header">${skillImage(id)}<div>
   <h2 id="skills-detail-title" tabindex="-1">${esc(skill.name)}</h2>
   <span class="skills-kind">${esc(skillKindLabel(id))}</span>
   <p>${esc(skill.description)}</p>
  </div></header>
  ${rankTiles(id, profile, purchase)}
  <div class="skills-purchase">
   ${purchase.next ? `<button type="button" class="war-primary" data-buy="${id}" ${purchase.canBuy ? '' : 'disabled'}>
    ${medalIcon()}<span>${buttonText} · ${purchase.cost} medals</span>
   </button>
   ${rankLocked ? `<p class="skills-purchase-lock"><span>Unlock at Level ${purchase.gate.required}</span><small>${esc(purchase.reason)}</small></p>` : `<small>${purchase.canBuy ? `${formatMedals(purchase.balance - purchase.cost)} medals after ${purchase.level ? 'upgrade' : 'unlock'}` : esc(purchase.reason)}</small>`}` : '<strong>Fully upgraded</strong>'}
   ${purchase.state === 'rank-locked' && purchase.shortfall ? `<small>${formatMedals(purchase.shortfall)} more medals needed</small>` : ''}
   <p class="skills-feedback" data-skill-feedback role="status" ${feedback ? '' : 'hidden'}>${esc(feedback)}</p>
  </div>
  ${purchase.level ? `<footer class="skills-equip">
   ${equipped.includes(id) ? '<strong>✓ Equipped</strong>' : `<button type="button" data-equip-skill="${id}" ${enabled ? '' : 'disabled'}>Equip skill${equipped.length === 3 ? '…' : ''}</button>
   <span>${equipped.length === 3 ? 'Choose a slot to replace.' : 'Add to your next defense.'}</span>`}
  </footer>` : ''}
 </article>`;
}

export function generalView(profile = {}, enabled = true, options = {}) {
 const current = profile || {};
 const owned = current.skills || {};
 const saved = current.equipped || [];
 const {selected, filter = 'all', equipped = saved, feedback = '', loadoutFeedback = ''} = options;
 const dirty = equipped.length !== saved.length || equipped.some((id, index) => saved[index] !== id);
 const priority = state => {
  if (state.canBuy) return state.level ? 0 : 1;
  if (state.level) return 2;
  return state.state === 'rank-locked' ? 4 : 3;
 };
 const catalogue = Object.keys(GENERAL_SKILLS).map(id => ({id, purchase: skillPurchaseState(current, id, enabled)}));
 catalogue.sort((a, b) => priority(a.purchase) - priority(b.purchase) || a.purchase.gate.required - b.purchase.gate.required);
 const visible = catalogue.filter(({purchase}) => filter === 'owned' ? purchase.level > 0 : filter === 'available' ? purchase.canBuy : true);
 const active = catalogue.find(row => row.id === selected) || visible[0];
 return `<div class="commander-skills">
  <header class="skills-heading"><h2>Commander Skills</h2><span data-skills-wallet>${medalAmount(current.balance)}</span></header>
  <form data-form="equipment" class="skills-loadout skills-panel">
   <header><h2>Next Defense</h2><strong>${equipped.length} / 3 equipped</strong></header>
   <div class="skills-slots">${Array.from({length: 3}, (_, index) => slotCard(equipped[index], index, owned, enabled)).join('')}</div>
   <footer>
    <span data-loadout-feedback role="status">${esc(loadoutFeedback || (dirty ? 'Unsaved changes · Applies to your next defense.' : 'Applies to your next defense.'))}</span>
    <button type="submit" class="${dirty ? 'war-primary' : ''}" ${enabled && dirty ? '' : 'disabled'}>Save Loadout</button>
   </footer>
  </form>
  <div class="skills-layout">
   <section class="skills-library skills-panel" aria-labelledby="skills-library-title">
    <h2 id="skills-library-title" tabindex="-1">Skill Library</h2>
    <div class="skills-filters" role="group" aria-label="Skill filter">${[['all','All'],['owned','Owned'],['available','Can buy']].map(([id, label]) => `<button type="button" data-skill-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>
    <ul class="skills-list" aria-label="Available skills">${visible.map(({id, purchase}) => {
     const locked = !purchase.level && purchase.state === 'rank-locked';
     return `<li><button type="button" data-select-skill="${id}" ${locked ? 'class="skills-locked-row"' : ''} aria-pressed="${id === active?.id}">
      ${skillImage(id)}<span><strong>${esc(GENERAL_SKILLS[id].name)}</strong>${locked ? '' : `<small>${esc(libraryState(purchase, equipped.includes(id)))}</small>`}</span>
      ${locked ? `<span class="skills-lock-badge">Unlock at Level ${purchase.gate.required}</span>` : ''}
     </button></li>`;
    }).join('') || '<li class="skills-empty">No skills match this filter.</li>'}</ul>
   </section>
   ${skillDetail(active?.id, current, active?.purchase, equipped, enabled, feedback)}
  </div>
 </div>`;
}

export function skillPickerMarkup(loadout, owned, {slot, skill}) {
 const previous = loadout[slot];
 const title = skill ? `Equip ${GENERAL_SKILLS[skill].name}` : previous ? `Replace ${GENERAL_SKILLS[previous].name}` : 'Add a skill';
 const choices = skill ? loadout.map((id, index) => ({id, index})) :
  Object.keys(GENERAL_SKILLS).filter(id => owned[id] > 0 && !loadout.includes(id)).map(id => ({id, index: slot}));
 return `<h2 id="skill-picker-title">${esc(title)}</h2>
  ${choices.length ? `<div class="skills-picker-options">${choices.map(({id,index}) => `<button type="button" data-picker-slot="${index}" data-picker-skill="${skill || id}">
   ${skillImage(id)}<span>${skill ? 'Replace ' : ''}${esc(GENERAL_SKILLS[id].name)} <small>Rank ${rankLabel(owned[id])}</small></span>
  </button>`).join('')}</div>` : '<p>No other unlocked skills are available.</p>'}
  <footer>${!skill && previous ? `<button type="button" data-picker-slot="${slot}" data-picker-skill="">Clear slot</button>` : ''}<button type="button" data-picker-cancel autofocus>Cancel</button></footer>`;
}
