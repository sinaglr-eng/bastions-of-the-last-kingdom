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
    const {view='unit',inspectedRecipeId=null}=options;
    const preparing=['build','select'].includes(game.phase),folio=get('preparation-folio');
    folio.hidden=!preparing;folio.dataset.preview='false';
    const retiredPreview=get('folio-preview');
    if(retiredPreview){retiredPreview.hidden=true;retiredPreview.replaceChildren();}
    const inFolio=preparing&&view!=='maze'&&!game.enemySelection;
    if(inFolio){if(body.parentNode!==get('folio-inspection'))get('folio-inspection').append(body);}
    else if(body.previousSibling!==bodyAnchor)bodyAnchor.after(body);
    if(preparing){
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
      get('folio-plan').hidden=!recipes&&!game.pinned&&!inspectedRecipeId;
    }
    get('app').dataset.folioInspector=String(inFolio);
    get('app').dataset.combinationPreview='false';
    if(focusedBrowserControl&&document.activeElement!==focusedBrowserControl)focusedBrowserControl.focus?.({preventScroll:true});
  };
  // Native details toggles do not bubble. Keep the same disclosure and move its
  // node on collapse, so the plan pane immediately becomes usable again.
  browser.addEventListener('toggle',event=>{if(event.target.matches?.('.crafting-dock-disclosure')&&lastSync)sync(lastSync.game,lastSync.options);},true);
  return {restoreParts,sync};
}
