import {towerStats} from '../game/core/math.js';
import {rankLabel} from '../game/core/recipes.js';
import {rankColor} from '../game/render/ranks.js';
import {recipeMatches} from './recipe-filters.js';
import {abilityLines,baseAttackDps,BASE_DPS_NOTE,damageTypeName,formatTowerNumber,runtimeDefenderDescription} from './grimoire.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(family,tier,images)=>images[`${family}:${tier}`]||(tier===1?images[family]:null);
export const basicCatalogKey=profile=>`${profile.family}:${profile.tier}`;

export function basicCatalogProfiles(data,filters={}){
  return Object.entries(data.towers).filter(([,tower])=>!tower.advanced).flatMap(([family,tower])=>tower.levels.map((_,index)=>{
    const tier=index+1,stats=towerStats({family,tier},data);
    return {family,tier,name:tower.name,stats,matches:recipeMatches(stats,filters,{family})};
  }));
}

export function basicCatalogIndexMarkup(data,images={}){
  return `<div class="catalog-basic-list" aria-label="Basic defender ranks">${Object.entries(data.towers).filter(([,tower])=>!tower.advanced).map(([family,tower])=>{
    const src=portrait(family,1,images);
    return `<section class="catalog-basic-family" data-filter-family="${escape(family)}"><div class="catalog-basic-family-heading">${src?`<img src="${escape(src)}" alt="" draggable="false">`:''}<span><strong>${escape(tower.name)}</strong><small>${escape(family==='mage'?'Magical cleave':tower.role||damageTypeName(tower.type))}</small></span></div><div class="catalog-basic-ranks" role="group" aria-label="${escape(tower.name)} ranks">${tower.levels.map((_,index)=>`<button type="button" class="catalog-basic-rank" data-filter-tier="${index+1}" data-catalog-basic-family="${escape(family)}" data-catalog-basic-tier="${index+1}" aria-label="Read ${escape(tower.name)} rank ${rankLabel(index+1)}" aria-pressed="false" style="--basic-rank-color:${rankColor(index+1)}">${rankLabel(index+1)}</button>`).join('')}</div></section>`;
  }).join('')}</div>`;
}

export function basicCatalogDetailMarkup(profile,data,images={},profiles=[]){
  if(!profile)return '';
  const {family,tier,name,stats}=profile,src=portrait(family,tier,images),matching=profiles.filter(row=>row.matches),index=matching.findIndex(row=>basicCatalogKey(row)===basicCatalogKey(profile));
  const order=`<nav class="catalog-recipe-order catalog-basic-order" aria-label="Filtered basic defender ranks"><button type="button" class="text-button" data-catalog-basic-order="previous" ${index>0?'':'disabled'}>‹ Previous rank</button><span>${index>=0?`${index+1} / ${matching.length}`:'Outside current filters'}</span><button type="button" class="text-button" data-catalog-basic-order="next" ${index>=0&&index<matching.length-1?'':'disabled'}>Next rank ›</button></nav>`;
  const description=runtimeDefenderDescription(stats,{family}),effects=abilityLines(stats).map(line=>line.replace(/\b(physical|magical|holy)\b/g,type=>damageTypeName(type)));
  return `<header class="catalog-selected-heading"><h3 tabindex="-1" data-catalog-basic-heading>${escape(name)} <span class="catalog-basic-rank-name">${rankLabel(tier)}</span></h3></header>${order}<div class="catalog-basic-content"><article class="catalog-basic-profile" data-basic-profile="${escape(family)}:${tier}"><div class="catalog-basic-portrait">${src?`<img src="${escape(src)}" alt="${escape(name)}, rank ${rankLabel(tier)}" draggable="false">`:''}</div><div class="catalog-basic-statistics"><div class="eyebrow">${escape(data.balance.tiers[tier-1])} · Rank ${rankLabel(tier)} · ${damageTypeName(stats.type)}</div><dl class="recipe-stat-grid"><div><dt>Damage / hit</dt><dd>${formatTowerNumber(stats.damage)}</dd></div><div><dt>Base direct DPS</dt><dd>${formatTowerNumber(baseAttackDps(stats))}</dd></div><div><dt>Interval</dt><dd>${formatTowerNumber(stats.interval)}s</dd></div><div><dt>Range</dt><dd>${formatTowerNumber(stats.range)}</dd></div></dl></div></article>${description?`<p class="catalog-basic-description">${escape(description)}</p>`:''}<section class="catalog-basic-effects" aria-label="${escape(name)} rank ${rankLabel(tier)} abilities"><h4>${damageTypeName(stats.type)} · Effects</h4><ul class="recipe-effects">${effects.map(line=>`<li>${escape(line)}</li>`).join('')}</ul></section><details class="catalog-guide-explanation" data-catalog-disclosure="basic-dps"><summary>About Base direct DPS</summary><p>${BASE_DPS_NOTE}</p></details><details class="catalog-guide-explanation" data-catalog-disclosure="basic-explanation"><summary>How ranks and damage work</summary><p>Physical, Magical and Holy damage all face armor. Magical immunity blocks Magical damage, poison, burning and healing block; Physical immunity blocks Physical damage, slowing and freezing. Only Holy damage ignores these immunities; companion effects retain their normal immunity categories. Evasion, shields and direct-hit shells still apply to all three types. ${stats.factionProfile?'Poison and burning follow the selected profile’s stated duration and strongest-effect rule.':'Poison stacks independently for 5s per successful hit.'}</p><p>Ranks I–IV merge matching recruits among the current round’s five placed candidates. Mythic VI requires two matching Royal V defenders freshly drawn and placed in the current draft. Previously retained or reserved defenders cannot form this pair. Place all five recruits before merging; the result becomes this round’s keeper.</p></details></div>`;
}

export function basicCatalogFrontispieceMarkup(){
  return `<span class="catalog-frontispiece-emblem" aria-hidden="true">✦</span><span class="eyebrow">Bastions of the Last Kingdom</span><h3>A field book<br>of defenders</h3><p>Choose a defender and rank on the facing page to study its portrait, attacks and abilities.</p><div class="catalog-frontispiece-rule" aria-hidden="true">◆</div><small>Eight defenders.<br>Six ranks to master.</small>`;
}
