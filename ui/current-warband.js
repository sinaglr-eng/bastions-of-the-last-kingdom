import {enemyNumber} from '../game/core/enemy-rules.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Rows describe actual living and scheduled invaders, including a separate
// count and trait list for each variant present in the mixed warband.
export function currentWarbandContents(rows){
  return rows.map(enemy=>`<article><div class="section-label">${enemy.flying?'AIRBORNE':'GROUND'} · CURRENT WARBAND</div><strong>${enemyNumber(enemy.count)} × ${escape(enemy.name)}</strong><p>${Math.round(enemy.maxHp).toLocaleString()} HP · ${enemyNumber(enemy.armor)} armor</p>${enemyTraitsMarkup(enemy.traitDetails)}</article>`).join('');
}

const renderedContents=new WeakMap();
export function updateCurrentWarbandPanel(panel,rows){
  const content=currentWarbandContents(rows);
  if(renderedContents.get(panel)===content)return false;
  panel.innerHTML=content;renderedContents.set(panel,content);return true;
}
