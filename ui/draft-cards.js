import {rankLabel,expandRecipeToBasics} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';
import {rankColor} from '../game/render/ranks.js';
import {championClassification} from '../game/render/champion-classification.js';
import {eligibleDrawKeeper,drawKeeperKey,mergeTowerKey} from './draft-input.js';
import {icon} from './icons.js';

const reservationBadge=pending=>`<span class="draw-reservation ${pending?'pending':''}">${icon('pin')}<span>${pending?'Reserved for next draft':'Reserved from previous draft'}<small>${pending?'Inactive · blocks path':'Fixed position'}</small></span></span>`;
function reservedCard(draw,index,game,data,images,{pending=false}={}){
  const defender=pending?game.draft.reserveSelection?.defender||draw.identity||draw:draw.identity||draw;
  const family=defender.family||draw.family,tier=defender.tier||draw.tier,stats=data.towers[family];
  const name=stats.name,quality=stats.advanced?`${championClassification(family)} champion`:`${defenderCode(stats,tier)} · ${data.balance.tiers[tier-1]}`;
  const description=pending?'Reserved for next draft. Inactive this wave at its fixed position; blocks the path.':'Reserved from previous draft. Already placed at its fixed position.';
  return `<div class="draw-slot"><button class="draw-card ${pending?'reserved-pending':'reserved-return'} ${!pending&&game.activeDraw===index?'active':''}" style="--tower-color:${stats.advanced?stats.color:rankColor(tier)}" ${pending?'disabled':`data-action="draw" data-index="${index}" aria-pressed="${game.activeDraw===index}"`} aria-label="${index+1}: ${quality}, ${name}. ${description}" title="${description}"><span class="index">0${index+1}</span><span class="tier-pips">${stats.advanced?rankLabel(tier):defenderCode(stats,tier)}</span><img src="${images[`${family}:${tier}`]||images[family]||''}" alt="" draggable="false"><span class="draw-name">${name}</span>${reservationBadge(pending)}</button></div>`;
}

export function draftCardsMarkup(game,data,images){
  const pinned=game.recipes.find(recipe=>recipe.id===game.pinned);
  const basics=pinned?expandRecipeToBasics(pinned,data):[];
  return `<div class="draws">${game.draft.draws.map((draw,index)=>{
    if(draw.reservedForNextDraft)return reservedCard(draw,index,game,data,images,{pending:true});
    if(!draw.placed)return `<div class="draw-slot"><button class="draw-card mystery-card ${game.activeDraw===index?'active':''}" data-action="draw" data-index="${index}" aria-label="${index+1}: Unrevealed defender. Build on an empty tile to reveal." aria-pressed="${game.activeDraw===index}"><span class="index">0${index+1}</span><span class="mystery-sigil">?</span><span class="draw-name">Unrevealed defender</span></button></div>`;
    const tower=game.towers.find(tower=>tower.id===draw.towerId);
    if(!tower)return `<div class="draw-slot"><button class="draw-card cleared-card" disabled aria-label="${index+1}: Cleared position"><span class="index">0${index+1}</span><span class="cleared-sigil">◇</span><span class="draw-name">Position cleared</span></button></div>`;
    const ruin=tower.state==='ruin',stats=data.towers[ruin?draw.family:tower.family];
    const selected=game.selected===tower.id,mergeKey=mergeTowerKey(game,tower.id);
    const highlighted=!ruin&&!stats.advanced&&basics.some(piece=>piece.family===tower.family&&piece.tier===tower.tier);
    const name=ruin?'Castle wall':stats.name,keeper=selected&&eligibleDrawKeeper(game,index,tower.id),carried=!ruin&&draw.origin==='reserve'&&draw.protectedFromReroll;
    const quality=ruin?'Castle wall':stats.advanced?`${championClassification(tower.family)} champion`:`${defenderCode(stats,tower.tier)} · ${data.balance.tiers[tower.tier-1]}`;
    return `<div class="draw-slot ${keeper?'has-keep':''}"><button class="draw-card ${selected?'active':''} placed ${carried?'reserved-return':''} ${mergeKey?'mergeable':''} ${highlighted?'pinned':''}" style="--tower-color:${ruin?'#a3af9b':stats.advanced?stats.color:rankColor(tower.tier)}" data-action="draw" data-index="${index}" aria-label="${index+1}: ${quality}, ${name}, placed${carried?'. Reserved from previous draft. Already placed at its fixed position':''}" aria-pressed="${selected}" ${eligibleDrawKeeper(game,index,tower.id)?`title="${carried?'Fixed position. ':''}Double-click or double-tap to keep this defender"`:carried?'title="Already placed at its fixed position. Place the other four defenders before choosing a keeper."':''}><span class="index">0${index+1}</span><span class="tier-pips">${ruin?'':stats.advanced?rankLabel(tower.tier):defenderCode(stats,tower.tier)}</span><img src="${ruin?images.ruin:images[`${tower.family}:${tower.tier}`]||images[tower.family]}" alt="" draggable="false"><span class="draw-name">${name}</span>${carried?reservationBadge(false):''}</button>${mergeKey?`<button type="button" class="draw-merge" data-action="merge-tower" data-tower-id="${tower.id}" data-merge-key="${mergeKey}" aria-label="Merge ${name} into rank ${rankLabel(tower.tier+1)} here" title="Merge into rank ${rankLabel(tower.tier+1)} here; the matching defender becomes a wall">${icon('spark')}<span>MERGE</span></button>`:''}${keeper?`<button class="primary-button draw-keep" data-action="keep-draw" data-index="${index}" data-tower-id="${tower.id}" data-keeper-key="${drawKeeperKey(game,index)}" aria-label="Keep ${name}">${icon('shield')} Keep</button>`:''}</div>`;
  }).join('')}</div>`;
}
