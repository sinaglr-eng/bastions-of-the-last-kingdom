import {craftingDockModel} from './crafting-dock.js';
import {recipeFamily,recipeTier,recipeLabel,rankLabel} from '../game/core/recipes.js';
import {preparationEffects} from './preparation-folio.js';
import {towerStats} from '../game/core/math.js';
import {baseAttackDps,formatTowerNumber,damageTypeName} from './grimoire.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const position=t=>`(${t.x+1}, ${t.z+1})`;
const name=(t,data)=>`${data.towers[t.family].name}${data.towers[t.family].advanced?'':` ${rankLabel(t.tier)}`}`;
const portrait=(family,tier,images)=>images[`${family}:${tier}`]||(tier===1?images[family]:null);
const unit=(t,data,images)=>`<li>${portrait(t.family,t.tier,images)?`<img src="${escape(portrait(t.family,t.tier,images))}" alt="">`:''}<span><strong>${escape(name(t,data))}</strong><small>Foundation ${position(t)}</small></span></li>`;

// A preview is a presentation of the existing allocator's exact physical pieces.
// It never chooses another foundation or changes the draft, resources or RNG.
export function combinationPreviewMarkup(game,images={},recipeId=game.previewRecipeId){
  const {context}=craftingDockModel(game,{recipeId,anchorId:game.selected});
  if(!context)return '';
  const recipe=context.recipe,family=recipeFamily(recipe),tier=recipeTier(recipe),label=recipeLabel(recipe,game.data);
  const stats=towerStats({family,tier},game.data),effects=preparationEffects(stats);
  const metrics=`<div class="stat-grid"><div><span>Damage / hit</span><strong>${formatTowerNumber(stats.damage)}</strong></div><div><span>Base direct DPS</span><strong>${formatTowerNumber(baseAttackDps(stats))}</strong></div><div><span>Range</span><strong>${formatTowerNumber(stats.range)}</strong></div><div><span>Interval</span><strong>${formatTowerNumber(stats.interval)}s</strong></div></div>`;
  return `<section class="combination-preview" aria-label="Exact combination preview">
    <header><div class="eyebrow">Combination preview · Result at ${position(context.anchor)}</div><h2>${escape(label)}</h2><p>Review the foundations before combining.</p></header>
    <div class="combination-flow"><section><h3>Exact ingredients</h3><ul class="combination-pieces">${context.pieces.map(t=>unit(t,game.data,images)).join('')}</ul></section><span class="combination-arrow" aria-hidden="true">→</span>
    <section class="combination-result">${portrait(family,tier,images)?`<img src="${escape(portrait(family,tier,images))}" alt="${escape(label)}">`:''}<h3>${escape(label)}</h3><span class="damage-tag">${damageTypeName(stats.type)}</span>${metrics}<p>Result on ${escape(name(context.anchor,game.data))} foundation ${position(context.anchor)}</p><ul>${effects.map(line=>`<li>${escape(line)}</li>`).join('')}</ul></section>
    <section class="combination-walls"><h3>After combining</h3><p><strong>Consumed → castle walls</strong></p><ul>${context.consumed.map(t=>`<li>${escape(name(t,game.data))} · ${position(t)}</li>`).join('')}</ul>${context.draftUsed?`<p><strong>Unchosen recruits → castle walls</strong></p><ul>${context.discarded.map(t=>`<li>${escape(name(t,game.data))} · ${position(t)}</li>`).join('')||'<li>None</li>'}</ul>`:'<p>The current draft stays available.</p>'}</section></div>
    <footer><button class="text-button" data-action="craft-cancel">Cancel preview</button><button class="primary-button" data-action="craft-dock" data-id="${escape(recipe.id)}" data-tower-id="${context.anchor.id}" data-craft-key="${context.key}">Combine ${escape(label)}</button></footer></section>`;
}

// The same nodes move between the folio and the map inspector. No duplicate
// actionable controls or second draft roster are left behind the visible layout.
export function createFolioLayout(document){
  const get=id=>document.getElementById(id),body=get('side-body'),browser=get('recipe-browser');
  const bodyAnchor=document.createComment('map-inspector-body'),browserAnchor=document.createComment('map-inspector-recipes');
  body.before(bodyAnchor);browser.before(browserAnchor);
  let action=null,recipes=null,lastSync=null;
  const restoreParts=()=>{if(action){body.append(action);action=null;}if(recipes){body.append(recipes);recipes=null;}};
  const sync=(game,options={})=>{
    lastSync={game,options};
    const focusedBrowserControl=browser.contains(document.activeElement)?document.activeElement:null;
    let {images={},preview=false,view='unit',inspectedRecipeId=null}=options;
    const preparing=['build','select'].includes(game.phase),constructing=['build','select','ready','reward'].includes(game.phase),folio=get('preparation-folio');
    const html=constructing&&preview?combinationPreviewMarkup(game,images):'';
    preview=!!html;
    folio.hidden=!preparing&&!preview;folio.dataset.preview=String(preview);
    get('folio-preview').hidden=!preview;
    if(preview){if(get('folio-preview').innerHTML!==html)get('folio-preview').innerHTML=html;}
    else get('folio-preview').replaceChildren();
    const inFolio=preparing&&view!=='maze'&&!game.enemySelection;
    if(inFolio){if(body.parentNode!==get('folio-inspection'))get('folio-inspection').append(body);}
    else if(body.previousSibling!==bodyAnchor)bodyAnchor.after(body);
    if(preparing&&!preview){
      action=body.querySelector('.folio-actions')||action;if(action&&action.parentNode!==get('folio-actions'))get('folio-actions').append(action);
      recipes=body.querySelector('.folio-recipes')||recipes;if(recipes&&recipes.parentNode!==get('folio-recipes'))get('folio-recipes').append(recipes);
      const showBrowser=(!recipes||view==='recipe')&&!!(inspectedRecipeId||game.pinned);
      const collapsed=showBrowser&&browser.querySelector('.crafting-dock-disclosure')?.open===false;
      browser.classList.toggle('is-compact-external',collapsed);
      get('folio-recipes').hidden=showBrowser&&!collapsed;
      browser.hidden=!showBrowser;
      if(collapsed){if(browser.previousSibling!==folio)folio.after(browser);}
      else if(showBrowser&&browser.parentNode!==get('folio-plan'))get('folio-plan').append(browser);
      else if(!showBrowser&&browser.previousSibling!==browserAnchor)browserAnchor.after(browser);
      get('folio-plan').hidden=!recipes&&(!showBrowser||collapsed);
    }else{
      browser.classList.toggle('is-compact-external',false);
      if(browser.previousSibling!==browserAnchor)browserAnchor.after(browser);
      get('folio-plan').hidden=preparing&&!preview&&!recipes&&!game.pinned&&!inspectedRecipeId;
    }
    get('app').dataset.folioInspector=String(inFolio);
    get('app').dataset.combinationPreview=String(preview);
    if(focusedBrowserControl&&document.activeElement!==focusedBrowserControl)focusedBrowserControl.focus?.({preventScroll:true});
  };
  // Native details toggles do not bubble. Keep the same disclosure and move its
  // node on collapse, so the plan pane immediately becomes usable again.
  browser.addEventListener('toggle',event=>{if(event.target.matches?.('.crafting-dock-disclosure')&&lastSync)sync(lastSync.game,lastSync.options);},true);
  return {restoreParts,sync};
}
