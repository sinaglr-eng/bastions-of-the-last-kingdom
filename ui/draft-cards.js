import {rankLabel,expandRecipeToBasics} from '../game/core/recipes.js';
import {defenderCode} from '../game/core/unit-label.js';
import {rankColor} from '../game/render/ranks.js';
import {championClassification} from '../game/render/champion-classification.js';
import {eligibleDrawKeeper,mergeTowerKey} from './draft-input.js';
import {icon} from './icons.js';

export function draftCardsMarkup(game,data,images){
  const pinned=game.recipes.find(recipe=>recipe.id===game.pinned);
  const basics=pinned?expandRecipeToBasics(pinned,data):[];
  return `<div class="draws">${game.draft.draws.map((draw,index)=>{
    if(!draw.placed)return `<div class="draw-slot"><button class="draw-card mystery-card ${game.activeDraw===index?'active':''}" data-action="draw" data-index="${index}" aria-label="${index+1}: Unrevealed defender. Build on an empty tile to reveal." aria-pressed="${game.activeDraw===index}"><span class="index">0${index+1}</span><span class="mystery-sigil">?</span><span class="draw-name">Unrevealed defender</span></button></div>`;
    const tower=game.towers.find(tower=>tower.id===draw.towerId);
    if(!tower)return `<div class="draw-slot"><button class="draw-card cleared-card" disabled aria-label="${index+1}: Cleared position"><span class="index">0${index+1}</span><span class="cleared-sigil">◇</span><span class="draw-name">Position cleared</span></button></div>`;
    const ruin=tower.state==='ruin',stats=data.towers[ruin?draw.family:tower.family];
    const selected=game.selected===tower.id,mergeKey=mergeTowerKey(game,tower.id);
    const highlighted=!ruin&&!stats.advanced&&basics.some(piece=>piece.family===tower.family&&piece.tier===tower.tier);
    const name=ruin?'Castle wall':stats.name,keeper=selected&&eligibleDrawKeeper(game,index,tower.id);
    const quality=ruin?'Castle wall':stats.advanced?`${championClassification(tower.family)} champion`:`${defenderCode(stats,tower.tier)} · ${data.balance.tiers[tower.tier-1]}`;
    return `<div class="draw-slot ${keeper?'has-keep':''}"><button class="draw-card ${selected?'active':''} placed ${mergeKey?'mergeable':''} ${highlighted?'pinned':''}" style="--tower-color:${ruin?'#a3af9b':stats.advanced?stats.color:rankColor(tower.tier)}" data-action="draw" data-index="${index}" aria-label="${index+1}: ${quality}, ${name}, placed" aria-pressed="${selected}" ${eligibleDrawKeeper(game,index,tower.id)?'title="Double-click or double-tap to keep this defender"':''}><span class="index">0${index+1}</span><span class="tier-pips">${ruin?'':stats.advanced?rankLabel(tower.tier):defenderCode(stats,tower.tier)}</span><img src="${ruin?images.ruin:images[`${tower.family}:${tower.tier}`]||images[tower.family]}" alt="" draggable="false"><span class="draw-name">${name}</span></button>${mergeKey?`<button type="button" class="draw-merge" data-action="merge-tower" data-tower-id="${tower.id}" data-merge-key="${mergeKey}" aria-label="Merge ${name} into rank ${rankLabel(tower.tier+1)} here" title="Merge into rank ${rankLabel(tower.tier+1)} here; the matching defender becomes a wall">${icon('spark')}<span>MERGE</span></button>`:''}${keeper?`<button class="primary-button draw-keep" data-action="keep-draw" data-index="${index}" data-tower-id="${tower.id}" aria-label="Keep ${name}">${icon('shield')} Keep</button>`:''}</div>`;
  }).join('')}</div>`;
}
