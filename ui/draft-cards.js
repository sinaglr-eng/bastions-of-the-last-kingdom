import {siteUrl} from '../game/site-url.js';
import {castleWallPortrait} from './wall-panel.js';
import {rankLabel} from '../game/core/recipes.js';
import {pinnedRecipeHighlightIds} from './crafting-dock.js';
import {displayDefenderCode as defenderCode} from './recipe-navigation.js';
import {rankColor} from '../game/render/ranks.js';
import {championClassification} from '../game/render/champion-classification.js';
import {eligibleDrawKeeper,drawKeeperKey,mergeTowerKey} from './draft-input.js';
import {icon} from './icons.js';
import {damageTypeName} from './grimoire.js';

const reservationBadge=pending=>`<span class="draw-reservation ${pending?'pending':''}"><span>${pending?'Reserved for next draft':'Reserved from previous draft'}<small>${pending?'Inactive · blocks path':'Fixed position'}</small></span></span>`;
const portrait=(family,tier,data,images)=>images[`${family}:${tier}`]||((tier===1||data.towers[family]?.advanced)?images[family]:null);
const portraitMarkup=src=>src?`<span class="draw-portrait"><img src="${src}" alt="" draggable="false"></span>`:'<span class="draw-portrait-empty" aria-hidden="true"></span>';
const damageRow=stats=>`<span class="draw-damage" data-damage-type="${stats.type}"><span>${damageTypeName(stats.type)}</span></span>`;
// An outlined unknown recruit stays independent of the hidden draw identity.
// Its scalable question mark shares the card surface with the map instruction.
const mysteryPlacement=`<span class="mystery-sigil" aria-hidden="true"><img class="mystery-placement mystery-recruit-art" src="${siteUrl('assets/ui/ipad-polish/unknown-recruit.webp')}" width="256" height="256" alt="" draggable="false"></span>`;
function reservedCard(draw,index,game,data,images,{pending=false}={}){
  const defender=pending?game.draft.reserveSelection?.defender||draw.identity||draw:draw.identity||draw;
  const family=defender.family||draw.family,tier=defender.tier||draw.tier,stats=data.towers[family];
  const name=stats.name,quality=stats.advanced?`${championClassification(family)} champion`:`${defenderCode(stats,tier)} · ${data.balance.tiers[tier-1]}`;
  const description=pending?'Reserved for next draft. Inactive this wave at its fixed position; blocks the path.':'Reserved from previous draft. Already placed at its fixed position.';
  return `<div class="draw-slot"><button class="draw-card ${pending?'reserved-pending':'reserved-return'} ${!pending&&game.activeDraw===index?'active':''}" style="--tower-color:${stats.advanced?stats.color:rankColor(tier)}" ${pending?'disabled':`data-action="draw" data-index="${index}" aria-pressed="${game.activeDraw===index}"`} aria-label="${index+1}: ${quality}, ${name}. ${description}" title="${description}"><span class="tier-pips">${stats.advanced?rankLabel(tier):defenderCode(stats,tier)}</span>${portraitMarkup(portrait(family,tier,data,images))}<span class="draw-name">${name}${stats.advanced?'':` ${rankLabel(tier)}`}</span>${damageRow(stats)}${reservationBadge(pending)}</button></div>`;
}

export function draftCardsMarkup(game,data,images,{actions=true}={}){
  const pinnedIds=pinnedRecipeHighlightIds(game);
  return `<div class="draws">${game.draft.draws.map((draw,index)=>{
    if(draw.reservedForNextDraft)return reservedCard(draw,index,game,data,images,{pending:true});
    if(!draw.placed)return `<div class="draw-slot"><button class="draw-card mystery-card ${game.activeDraw===index?'active':''}" data-action="draw" data-index="${index}" aria-label="${index+1}: Place a defender on the map. Build on an empty tile to reveal." aria-pressed="${game.activeDraw===index}">${mysteryPlacement}<span class="draw-name">Place a defender on the map</span></button></div>`;
    const tower=game.towers.find(tower=>tower.id===draw.towerId);
    if(!tower)return `<div class="draw-slot"><button class="draw-card cleared-card" disabled aria-label="${index+1}: Cleared position"><span class="cleared-sigil" aria-hidden="true"></span><span class="draw-name">Position cleared</span></button></div>`;
    const ruin=tower.state==='ruin',stats=data.towers[ruin?draw.family:tower.family];
    const selected=game.selected===tower.id,mergeKey=mergeTowerKey(game,tower.id);
    const highlighted=!ruin&&pinnedIds.has(tower.id);
    const name=ruin?'Castle wall':stats.name,keeper=actions&&selected&&eligibleDrawKeeper(game,index,tower.id),carried=!ruin&&draw.origin==='reserve'&&draw.protectedFromReroll;
    const quality=ruin?'Castle wall':stats.advanced?`${championClassification(tower.family)} champion`:`${defenderCode(stats,tower.tier)} · ${data.balance.tiers[tower.tier-1]}`;
    return `<div class="draw-slot ${keeper?'has-keep':''}"><button class="draw-card ${selected?'active':''} placed ${carried?'reserved-return':''} ${actions&&mergeKey?'mergeable':''} ${highlighted?'pinned':''}" style="--tower-color:${ruin?'#a3af9b':stats.advanced?stats.color:rankColor(tower.tier)}" data-action="draw" data-index="${index}" aria-label="${index+1}: ${quality}, ${name}, placed${highlighted?'. Pinned recipe ingredient':''}${carried?'. Reserved from previous draft. Already placed at its fixed position':''}" aria-pressed="${selected}" ${eligibleDrawKeeper(game,index,tower.id)?`title="${carried?'Fixed position. ':''}Double-click or double-tap to keep this defender"`:carried?'title="Already placed at its fixed position. Place the other four defenders before choosing a keeper."':''}><span class="tier-pips">${ruin?'':stats.advanced?rankLabel(tower.tier):defenderCode(stats,tower.tier)}</span>${portraitMarkup(ruin?(images.ruin||castleWallPortrait()):portrait(tower.family,tower.tier,data,images))}<span class="draw-name">${name}${ruin||stats.advanced?'':` ${rankLabel(tower.tier)}`}</span>${ruin?'':damageRow(stats)}${highlighted?`<span class="draw-recipe-ingredient" title="Pinned recipe ingredient" aria-label="Pinned recipe ingredient">${icon('pin')}<span>Recipe ingredient</span></span>`:''}${carried?reservationBadge(false):''}</button>${actions&&mergeKey?`<button type="button" class="draw-merge" data-action="merge-tower" data-tower-id="${tower.id}" data-merge-key="${mergeKey}" aria-label="Merge ${name} into rank ${rankLabel(tower.tier+1)} here" title="Merge into rank ${rankLabel(tower.tier+1)} here; the matching defender becomes a wall">${icon('merge')}<span>MERGE</span></button>`:''}${keeper?`<button class="primary-button draw-keep" data-action="keep-draw" data-index="${index}" data-tower-id="${tower.id}" data-keeper-key="${drawKeeperKey(game,index)}" aria-label="Keep ${name}">Keep</button>`:''}</div>`;
  }).join('')}</div>`;
}
