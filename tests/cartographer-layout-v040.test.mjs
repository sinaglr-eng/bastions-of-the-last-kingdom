import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {createFolioLayout} from '../ui/cartographer-folio.js';
import {craftingDockModel,craftingDockMarkup,updateCraftingDock,craftRecipeFromDock,craftRecipeKey} from '../ui/crafting-dock.js';
import {recipeNavigationVisit} from '../ui/recipe-navigation.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {PhaseUiState,endedPhase} from '../ui/phase-ui.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {icon} from '../ui/icons.js';
import {recipeFamily,recipeTier} from '../game/core/recipes.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {DraftCardActivation,DraftCardPointerInput,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {PreparationRecipeNavigation} from '../ui/preparation-recipe-navigation.js';
import {actualAvailableRecipeActionsMarkup} from '../ui/preparation-folio.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const ranger=data.recipes.find(recipe=>recipe.id==='thornwarden'),noop=()=>{};
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,resolved:game.draft.resolved,selected:game.selected,phase:game.phase,round:game.round,gold:game.economy.gold,cp:game.commandPoints.value,pin:game.pinned,discoveries:[...game.discoveries],occupied:[...game.grid.occupied]});
const declaration=name=>{const from=main.indexOf(`function ${name}(`);assert.ok(from>=0,name);const end=main.indexOf('\nfunction ',from+1);return main.slice(from,end);};
const singleLine=name=>{const source=main.split('\n').find(line=>line.startsWith(`function ${name}(`));assert.ok(source,name);return source;};
function place(game,pieces){for(const [index,piece]of pieces.entries()){game.draft.roundForced=piece;assert.equal(game.place(3+index,3),true);}game.select(game.roundCandidates[0].tower.id);return game;}
function retained(game,piece,index){const tower={id:game.nextId++,...piece,state:'active',round:0,x:12+index,z:12,kills:0,mvpLevel:0,priority:'first',cooldown:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);return tower;}
function recipeGame(kind='draft'){
  const game=new Game(data,{seed:904});
  if(kind==='retained'){ranger.ingredients.forEach((piece,index)=>retained(game,piece,index));game.select(game.towers[0].id);}
  else if(kind==='mixed'){retained(game,ranger.ingredients[0],0);place(game,[...ranger.ingredients.slice(1),...Array.from({length:3},()=>({family:'soldier',tier:2}))]);game.select(game.towers[0].id);}
  else place(game,[...ranger.ingredients,{family:'soldier',tier:2},{family:'mage',tier:2}]);
  return game;
}

// Only DOM ownership, connectivity, focus and markup are modeled. Geometry and
// browser layout remain native QA. Moves deliberately blur focused descendants.
function documentFixture(){
  const document={activeElement:null,root:null};
  class Element{
    constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.parentNode=null;this.children=[];this.attributes={};this.dataset={};this.hidden=false;this.disabled=false;this.scrollTop=0;this.open=false;this._html='';this.writes=0;Object.entries(attrs).forEach(([key,value])=>this.setAttribute(key,value));this.classList={toggle:(name,on)=>{const classes=new Set(this.className.split(/\s+/).filter(Boolean));if(on)classes.add(name);else classes.delete(name);this.setAttribute('class',[...classes].join(' '));}};}
    setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);if(key==='class')this.className=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);if(key==='hidden')this.hidden=true;if(key==='disabled')this.disabled=true;if(key==='open')this.open=true;}
    get id(){return this.attributes.id||'';}set id(value){this.attributes.id=value;}
    get className(){return this.attributes.class||'';}set className(value){this.attributes.class=value;}
    get isConnected(){return this===document.root||!!this.parentNode?.isConnected;}
    get previousSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)-1]||null;}
    contains(node){return !!node&&(node===this||this.children.some(child=>child.contains(node)));}
    detach(){if(this.contains(document.activeElement))document.activeElement=document.root;if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
    append(...nodes){for(const node of nodes){node.detach();node.parentNode=this;this.children.push(node);}}
    before(node){const parent=this.parentNode;node.detach();const index=parent.children.indexOf(this);parent.children.splice(index,0,node);node.parentNode=parent;}
    after(node){const parent=this.parentNode;node.detach();const index=parent.children.indexOf(this);parent.children.splice(index+1,0,node);node.parentNode=parent;}
    replaceChildren(...nodes){for(const child of [...this.children])child.detach();this._html='';this.append(...nodes);}
    matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));if(/^(?:\[[^\]]+\])+$/.test(selector))return [...selector.matchAll(/\[([^=\]]+)(?:=(?:"([^"]*)"|([^\]]+)))?\]/g)].every(([,key,quoted,plain])=>Object.hasOwn(this.attributes,key)&&((quoted??plain)===undefined||this.attributes[key]===(quoted??plain)));return this.tagName===selector.toUpperCase();}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
    get innerHTML(){return this._html;}
    set innerHTML(html){this.replaceChildren();this._html=html;this.writes++;const stack=[this];for(const token of html.match(/<[^>]+>/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attrs={};for(const item of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[item[1]]=item[2]??'';const child=new Element(tag,attrs);stack.at(-1).append(child);if(!['img','input','br','hr','path','circle','line','polyline','rect'].includes(tag)&&!token.endsWith('/>'))stack.push(child);}}
    focus(){document.activeElement=this;}
    addEventListener(type,listener){this.listeners??=new Map();if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(listener);}
    dispatchEvent(event){for(const listener of this.listeners?.get(event.type)||[])listener(event);}
  }
  const app=new Element('main',{id:'app'});document.root=app;document.activeElement=app;
  document.getElementById=id=>app.id===id?app:app.querySelector('#'+id);document.createComment=text=>new Element('#comment',{'data-comment':text});
  const add=(id,parent=app,tag='div')=>{const node=new Element(tag,{id});parent.append(node);return node;};
  const sidebar=add('sidebar'),body=add('side-body',sidebar),browser=add('recipe-browser',sidebar);add('side-top',sidebar);add('inspector-tabs',sidebar);
  const folio=add('preparation-folio');folio.innerHTML=main.match(/<nav class="folio-page-tabs"[^\n]+?<\/nav>/)[0];app.dataset.folioPage='draft';for(const id of ['draft-history','folio-inspection','folio-actions','folio-plan','folio-preview'])add(id,folio);add('folio-recipes',document.getElementById('folio-plan'));
  const layout=createFolioLayout(document);return {document,app,body,browser,sidebar,folio,layout,get:document.getElementById,Element};
}

function mainFixture(game,{subscriber=false}={}){
  const dom=documentFixture(),rankPreview=new DefenderRankPreview(),phaseUi=new PhaseUiState();phaseUi.sync(game);
  const context={...dom,game,data,images:{},rankPreview,preparationNavigation:new PreparationRecipeNavigation(),phaseUi,folioLayout:dom.layout,folioRecipeId:null,folioRecipeSelection:null,previewPrevious:null,recipeFocus:null,recipeNavigation:{history:[],index:-1},recipeNavigationVisit,craftingDockModel,updateCraftingDock,defenderPanelMarkup,DpsMeasurement,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),icon,endedPhase,panelDetails:new Map(),stampCraftButtons:noop,world:{sync:noop,resize:noop},$:dom.get,tutorial:()=>'<p>Build</p>'};
  const source=[singleLine('syncFolio'),singleLine('cancelRecipePreview'),singleLine('towerPanel'),declaration('renderSidebar'),declaration('renderRecipeBrowser'),singleLine('openRecipePreview')].join('\n');
  const methods=runInNewContext(source+'\n({syncFolio,cancelRecipePreview,renderSidebar,renderRecipeBrowser,openRecipePreview})',context);
  context.render=()=>{methods.renderSidebar();methods.renderRecipeBrowser();methods.syncFolio();};
  if(subscriber){Object.assign(context,{resultFacts:{event:noop},guidance:{event:noop},audio:{play:noop},draftCardActivation:{clear:noop},dpsWave:null,profile:{discoveries:[],bestWave:0,bestScore:0,wins:0},statistics:{tracker:{id:'layout-subscriber-fixture',version:'0.4.0'}},recordRunResult:noop,saveProfile:noop,showResult:noop,notice:noop,towers:data.towers,balance:data.balance});context.world.doubleTap={clear:noop};const actualSubscriber=main.split('\n').find(line=>line.trimStart().startsWith('game.on((type,payload)=>{'));assert.ok(actualSubscriber);runInNewContext(actualSubscriber,context);}
  else game.on(type=>{if(type==='change')context.render();});
  context.render();return {...dom,...methods,game,rankPreview,phaseUi,context,render:context.render};
}

function productionTabCommands(view){
  Object.assign(view.context,{audio:{unlock:noop},draftCardActivation:{clear:noop},debug:false,codex:noop,warbands:noop,help:noop,sendWave:noop,closeDialog:noop,debugPanel:noop});
  Object.assign(view.context.world,{maze:{editing:false},doubleTap:{clear:noop}});
  const handle=runInNewContext(declaration('handleCommand')+'\nhandleCommand',view.context);
  return page=>{const button=view.app.querySelectorAll('[data-action="folio-tab"]').find(button=>button.dataset.page===page);assert.ok(button,page);handle({target:button});return button;};
}

test('native Potential combinations stays closed initially and preserves deliberate disclosure across folio moves and rank refreshes',()=>{
  const game=recipeGame(),control=recipeGame(),view=mainFixture(game),tower=game.selection;
  const disclosure=()=>view.app.querySelector('[data-detail-key="potential-combinations"]');
  assert.equal(disclosure().open,false);assert.equal(disclosure().parentNode.parentNode.id,'folio-recipes');
  assert.equal(view.app.querySelector('.folio-recipe-detail'),null);
  const before=snapshot(game);
  disclosure().open=true;view.render();assert.equal(disclosure().open,true);
  view.context.preparationNavigation.toggle(game.recipes.find(recipe=>recipe.id==='thornwarden').id);view.render();
  assert.ok(view.app.querySelector('.folio-recipe-detail'));assert.equal(disclosure().open,true);
  view.rankPreview.select(tower,4,data);view.render();assert.equal(disclosure().open,true);assert.equal(view.app.querySelector('.folio-recipe-detail'),null,'Changing viewed rank does not select a recipe');
  disclosure().open=false;view.rankPreview.select(tower,1,data);view.render();assert.equal(disclosure().open,false);
  for(let pass=0;pass<3;pass++){view.render();assert.equal(disclosure().open,false);}
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('one compact attack toggle beside the name runs the real command in both global pause states and disappears after the run',()=>{
  const game=recipeGame(),control=recipeGame();assert.equal(game.keep(),true);assert.equal(control.keep(),true);assert.equal(game.startCombat(),true);assert.equal(control.startCombat(),true);
  const view=mainFixture(game),tower=game.selection;
  Object.assign(view.context,{audio:{unlock:noop},draftCardActivation:{clear:noop},debug:false,codex:noop,warbands:noop,help:noop,sendWave:noop,closeDialog:noop,debugPanel:noop});
  Object.assign(view.context.world,{maze:{editing:false},doubleTap:{clear:noop}});
  const handle=runInNewContext(declaration('handleCommand')+'\nhandleCommand',view.context);
  for(const globalPause of [false,true]){
    game.paused=globalPause;view.render();
    let buttons=view.app.querySelectorAll('[data-action="tower-pause"]');assert.equal(buttons.length,1);
    const button=buttons[0];assert.equal(button.parentNode.className,'defender-name-row');assert.equal(button.attributes['aria-label'],'Pause unit attacks');assert.equal(button.attributes.title,'Pause unit attacks');assert.equal(button.attributes['aria-pressed'],'false');
    handle({target:button});assert.equal(tower.attackPaused,true);assert.equal(game.paused,globalPause);
    buttons=view.app.querySelectorAll('[data-action="tower-pause"]');assert.equal(buttons.length,1);assert.equal(buttons[0].attributes['aria-label'],'Resume unit attacks');assert.equal(buttons[0].attributes['aria-pressed'],'true');
    handle({target:buttons[0]});assert.equal(tower.attackPaused,false);assert.equal(game.paused,globalPause);
  }
  for(const phase of ['won','lost']){game.phase=phase;view.render();assert.equal(view.app.querySelector('[data-action="tower-pause"]'),null);}
  assert.equal(game.rng(),control.rng());
});

test('production responsive folio tabs switch the shared panes without changing real selection, rank, action nodes or RNG',()=>{
  const game=recipeGame(),control=recipeGame(),view=mainFixture(game),activate=productionTabCommands(view),tower=game.selection;
  view.rankPreview.select(tower,4,data);view.render();const before=snapshot(game),keep=view.get('folio-actions').querySelector('[data-action="keep-draw"]'),tabs=view.app.querySelectorAll('[data-action="folio-tab"]');
  assert.deepEqual(tabs.map(tab=>tab.dataset.page),['draft','defender','recipes']);
  for(const [page,pane]of [['draft','draft-history'],['defender','folio-inspection'],['recipes','folio-plan']])assert.equal(tabs.find(tab=>tab.dataset.page===page).attributes['aria-controls'],pane);
  for(const page of ['defender','recipes','draft','recipes']){
    const tab=tabs.find(tab=>tab.dataset.page===page);tab.focus();activate(page);
    assert.equal(view.app.dataset.folioPage,page);assert.equal(tab.disabled,false);assert.equal(view.document.activeElement,tab);assert.equal(tabs.filter(tab=>tab.attributes['aria-pressed']==='true').length,1);assert.equal(tab.attributes['aria-pressed'],'true');
    assert.equal(view.get('side-body').parentNode,view.get('folio-inspection'));assert.equal(view.get('folio-actions').querySelector('[data-action="keep-draw"]'),keep);assert.equal(game.selection,tower);assert.equal(view.rankPreview.view(tower,data).tier,4);assert.equal(snapshot(game),before);
  }
  assert.equal(game.rng(),control.rng());
});

test('production folio falls back to Recruits when selection disappears or a new draft leaves the selected page unavailable',()=>{
  for(const transition of ['selection-cleared','next-draft']){
    const game=recipeGame(),control=recipeGame(),view=mainFixture(game),activate=productionTabCommands(view);activate('defender');assert.equal(view.app.dataset.folioPage,'defender');
    if(transition==='selection-cleared')game.select(null);
    else for(const current of [game,control]){assert.equal(current.keep(),true);assert.equal(current.startCombat(),true);current.completeWave();assert.equal(current.phase,'build');assert.equal(current.selection,null);}
    view.render();const tabs=view.app.querySelectorAll('[data-action="folio-tab"]'),draft=tabs.find(tab=>tab.dataset.page==='draft');
    assert.equal(view.app.dataset.folioPage,'draft');assert.equal(draft.attributes['aria-pressed'],'true');assert.equal(draft.disabled,false);assert.equal(tabs.filter(tab=>tab.attributes['aria-pressed']==='true').length,1);
    for(const page of ['defender','recipes']){const tab=tabs.find(tab=>tab.dataset.page===page);assert.equal(tab.disabled,true);assert.equal(tab.attributes['aria-pressed'],'false');activate(page);assert.equal(view.app.dataset.folioPage,'draft');}
    assert.equal(game.rng(),control.rng());
  }
});

test('production Recipes availability follows real plan content for walls, pins, unpinning and cleared inspection context',()=>{
  const game=recipeGame();assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.completeWave();const wall=game.towers.find(tower=>tower.state==='ruin');game.select(wall.id);
  const view=mainFixture(game),activate=productionTabCommands(view),tabs=view.app.querySelectorAll('[data-action="folio-tab"]'),recipes=tabs.find(tab=>tab.dataset.page==='recipes');
  assert.equal(view.get('folio-plan').hidden,true);assert.equal(recipes.disabled,true,'A castle wall cannot enable an empty Recipes pane.');activate('recipes');assert.equal(view.app.dataset.folioPage,'draft');activate('defender');assert.equal(view.app.dataset.folioPage,'defender','Wall inspection still has real content.');
  game.select(null);game.pinned=ranger.id;view.render();assert.equal(recipes.disabled,false);activate('recipes');assert.equal(view.app.dataset.folioPage,'recipes');assert.equal(view.get('folio-plan').hidden,false);
  view.openRecipePreview(ranger.id);game.pinned=null;view.render();assert.equal(recipes.disabled,false);assert.equal(view.app.dataset.folioPage,'recipes','Unpinning keeps an explicitly inspected recipe readable.');
  view.context.recipeFocus=null;view.render();assert.equal(recipes.disabled,true);assert.equal(view.app.dataset.folioPage,'draft');assert.equal(recipes.attributes['aria-pressed'],'false');assert.equal(tabs.find(tab=>tab.dataset.page==='draft').attributes['aria-pressed'],'true');
});

test('repeated sync moves the same action/recipe nodes once and restores them to inspector across actual phases',()=>{
  const game=place(new Game(data,{seed:904}),Array.from({length:5},()=>({family:'archer',tier:2}))),view=documentFixture();view.body.innerHTML=defenderPanelMarkup(game,game.selection);
  const actions=view.body.querySelector('.folio-actions'),recipes=view.body.querySelector('.folio-recipes'),keep=actions.querySelector('[data-action="keep-draw"]');
  for(let pass=0;pass<12;pass++){view.layout.sync(game);assert.equal(view.body.parentNode,view.get('folio-inspection'));assert.equal(actions.parentNode,view.get('folio-actions'));assert.equal(recipes.parentNode,view.get('folio-recipes'));assert.equal(view.app.querySelectorAll('.folio-actions').length,1);assert.equal(view.app.querySelectorAll('.folio-recipes').length,1);assert.equal(actions.querySelector('[data-action="keep-draw"]'),keep);}
  view.layout.restoreParts();assert.equal(actions.parentNode,view.body);assert.equal(recipes.parentNode,view.body);game.keep();view.body.innerHTML=defenderPanelMarkup(game,game.selection);view.layout.sync(game);assert.equal(view.folio.hidden,true);assert.equal(view.body.parentNode,view.sidebar);assert.equal(keep.isConnected,false);
  assert.equal(game.startCombat(),true);view.layout.sync(game);assert.equal(view.body.parentNode,view.sidebar);assert.equal(view.app.querySelectorAll('.folio-actions').length,1);
});

test('native pinned-recipe collapse moves the same dock outside the folio and immediately frees its planning pane',()=>{
  const game=recipeGame(),view=documentFixture(),recipe=data.recipes.find(recipe=>!game.availableRecipes().some(actual=>actual.id===recipe.id));
  game.pinned=recipe.id;view.body.innerHTML=defenderPanelMarkup(game,game.selection);updateCraftingDock(view.browser,game,{}, {recipeId:recipe.id});
  view.layout.sync(game,{view:'recipe',inspectedRecipeId:recipe.id});
  const dock=view.browser.querySelector('.crafting-dock-disclosure'),summary=view.browser.querySelector('.crafting-dock-summary'),before=snapshot(game);
  assert.equal(view.browser.parentNode,view.get('folio-plan'));assert.equal(view.get('folio-recipes').hidden,true);
  summary.focus();dock.open=false;view.browser.dispatchEvent({type:'toggle',target:dock});
  assert.equal(view.browser.parentNode,view.app);assert.equal(view.browser.previousSibling,view.folio);assert.match(view.browser.className,/is-compact-external/);
  assert.equal(view.get('folio-recipes').hidden,false);assert.equal(view.get('folio-plan').hidden,false);assert.equal(view.document.activeElement,summary);
  assert.equal(view.app.querySelectorAll('.crafting-dock-disclosure').length,1,'The compact strip reuses the physical controls.');
  dock.open=true;view.browser.dispatchEvent({type:'toggle',target:dock});
  assert.equal(view.browser.parentNode,view.get('folio-plan'));assert.doesNotMatch(view.browser.className,/is-compact-external/);assert.equal(view.get('folio-recipes').hidden,true);
  assert.equal(view.browser.querySelector('.crafting-dock-disclosure'),dock);assert.equal(view.document.activeElement,summary);assert.equal(snapshot(game),before);
});

test('restore plus actual rerender never leaves old or duplicate commands connected; explicit recipe browser returns to original anchor',()=>{
  const view=mainFixture(recipeGame());let old=null;
  for(let pass=0;pass<8;pass++){old=view.get('folio-actions').querySelector('[data-action="keep-draw"]');view.render();assert.equal(old.isConnected,false);assert.equal(view.app.querySelectorAll('.folio-actions').length,1);assert.equal(view.app.querySelectorAll('.folio-recipes').length,1);assert.equal(view.get('folio-actions').querySelectorAll('[data-action="keep-draw"]').length,1);}
  const unavailable=data.recipes.find(recipe=>!view.game.availableRecipes().some(actual=>actual.id===recipe.id));view.openRecipePreview(unavailable.id);assert.equal(view.browser.hidden,false);assert.equal(view.browser.parentNode,view.get('folio-plan'));assert.equal(view.get('folio-recipes').hidden,true);
  view.phaseUi.open('unit');view.render();assert.equal(view.browser.hidden,true);assert.equal(view.browser.parentNode,view.sidebar);assert.equal(view.get('folio-recipes').hidden,false);
});

for(const kind of ['draft','mixed','retained'])test(`exact ${kind} recipe details are read-only and the direct Create action preserves physical foundation guards`,()=>{
  const game=recipeGame(kind),control=recipeGame(kind),before=snapshot(game),context=craftingDockModel(game,{recipeId:ranger.id,anchorId:game.selected}).context;assert.ok(context);
  const html=craftingDockMarkup(game,{}, {recipeId:ranger.id});assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.match(html,/Exact combination outcome/);
  assert.equal(context.pieces.length,3);assert.equal(context.consumed.length,2);assert.equal(context.discarded.length,kind==='retained'?0:kind==='mixed'?3:2);
  assert.doesNotMatch(html,/combination-preview|craft-cancel|Combination preview/);const tag=html.match(/<button[^>]*data-action="craft-dock"[^>]*>/)[0];assert.match(tag,new RegExp(`data-tower-id="${context.anchor.id}"`));assert.ok(tag.includes(`data-craft-key="${context.key}"`));
  if(kind==='retained'){assert.match(html,/This combination preserves the current draft/);assert.equal(game.draft.draws.filter(draw=>!draw.placed).length,5);}
  else assert.match(html,/Unchosen current recruits → walls/);
  const anchor=context.anchor,key=context.key;assert.equal(craftRecipeFromDock(game,ranger.id,anchor.id,key),true);assert.equal(anchor.family,ranger.id);assert.equal(craftRecipeFromDock(game,ranger.id,anchor.id,key),false);
});

test('retained Build recipe inspection never reads hidden identities or falls back to rank-I art for an unavailable higher-rank picture',()=>{
  const game=recipeGame('retained');for(const draw of game.draft.draws)for(const key of ['family','tier'])Object.defineProperty(draw,key,{get(){throw Error('Latent identity read');},configurable:true});
  assert.match(craftingDockMarkup(game,{}, {recipeId:ranger.id}),/This combination preserves the current draft/);
  const recipe=data.recipes.find(recipe=>recipe.ingredients.some(piece=>!data.towers[piece.family].advanced&&piece.tier>1)),other=new Game(data,{seed:904});recipe.ingredients.forEach((piece,index)=>retained(other,piece,index));other.select(other.towers[0].id);
  const high=recipe.ingredients.find(piece=>!data.towers[piece.family].advanced&&piece.tier>1),html=craftingDockMarkup(other,{[high.family]:'/rank-I-fallback-forbidden.png'}, {recipeId:recipe.id});assert.ok(html);assert.doesNotMatch(html,/rank-I-fallback-forbidden|src="(?:undefined|null|)"/);
});

test('retired preview state cannot replace or hide the normal preparation folio',()=>{
  const game=recipeGame(),view=documentFixture();view.body.innerHTML=defenderPanelMarkup(game,game.selection);assert.equal(game.previewRecipe(ranger.id),true);view.get('folio-preview').innerHTML='<p>Stale preview receipt</p>';
  const before=snapshot(game);view.layout.sync(game,{preview:true});assert.equal(view.folio.hidden,false);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.get('folio-preview').hidden,true);assert.equal(view.get('folio-preview').innerHTML,'');assert.equal(view.app.dataset.combinationPreview,'false');assert.ok(view.get('folio-actions').querySelector('[data-action="keep-draw"]'));assert.equal(snapshot(game),before);
  game.phase='ready';view.layout.sync(game,{preview:true});assert.equal(view.folio.hidden,true,'Ready cannot reopen a replacement combination sheet.');
});

test('production recipe inspection preserves compared rank and physical selection without a replacement preview step',()=>{
  const view=mainFixture(recipeGame()),control=recipeGame(),tower=view.game.selection;view.rankPreview.select(tower,4,data);view.context.folioRecipeId=ranger.id;view.render();const before=snapshot(view.game),identity=view.rankPreview.identity;
  view.openRecipePreview(ranger.id);assert.equal(view.game.previewRecipeId,null);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.get('folio-preview').innerHTML,'');assert.match(view.browser.innerHTML,/Exact recipe ingredients/);assert.equal(snapshot(view.game),before);assert.equal(view.rankPreview.view(tower,data).tier,4);
  view.cancelRecipePreview();assert.equal(view.game.previewRecipeId,null);assert.equal(view.rankPreview.identity,identity);assert.equal(view.rankPreview.tier,4);assert.equal(view.context.folioRecipeId,ranger.id);assert.equal(view.phaseUi.view,'unit');assert.equal(view.folio.dataset.preview,'false');assert.equal(snapshot(view.game),before);assert.equal(view.game.rng(),control.rng());
});

test('actual Ready retained recipe inspection keeps preparation hidden and preserves the same direct-creation foundation',()=>{
  const ready=()=>{const game=recipeGame('retained'),anchor=game.selection;place(game,Array.from({length:5},()=>({family:'soldier',tier:2})));assert.equal(game.keep(),true);game.select(anchor.id);assert.equal(game.phase,'ready');assert.ok(game.availableRecipes().some(recipe=>recipe.id===ranger.id));return game;};
  const game=ready(),control=ready(),view=mainFixture(game),anchor=game.selection,before=snapshot(game),position=[anchor.x,anchor.z];assert.equal(view.folio.hidden,true);assert.equal(view.body.parentNode,view.sidebar);assert.equal(game.draft.resolved,true);
  view.openRecipePreview(ranger.id);assert.equal(game.phase,'ready');assert.equal(view.folio.hidden,true);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.app.dataset.combinationPreview,'false');assert.equal(view.app.dataset.folioInspector,'false');assert.equal(view.body.parentNode,view.sidebar);assert.equal(view.get('folio-preview').innerHTML,'');assert.match(view.browser.innerHTML,/Exact recipe ingredients/);assert.equal(snapshot(game),before);
  view.cancelRecipePreview();assert.equal(view.folio.hidden,true);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.app.dataset.combinationPreview,'false');assert.equal(view.get('folio-preview').hidden,true);assert.equal(view.get('folio-preview').innerHTML,'');assert.equal(view.body.parentNode,view.sidebar);assert.equal(game.selection,anchor);assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.previewRecipeId,null);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('actual main combine subscriber replaces recipe receipts with the new defender after Ready craft or guarded merge',()=>{
  for(const action of ['craft','merge']){
    const game=action==='craft'?recipeGame('retained'):new Game(data,{seed:904});if(action==='merge'){retained(game,{family:'archer',tier:5},0);retained(game,{family:'archer',tier:5},1);}
    const anchor=game.towers[0],position=[anchor.x,anchor.z],id=anchor.id;place(game,Array.from({length:5},()=>({family:'soldier',tier:2})));assert.equal(game.keep(),true);game.select(id);game.pinned=data.recipes.find(recipe=>recipe.id!==ranger.id).id;
    const view=mainFixture(game,{subscriber:true}),pin=game.pinned;view.rankPreview.select(anchor,6,data);view.openRecipePreview(ranger.id);assert.equal(view.context.recipeFocus,ranger.id);assert.equal(game.previewRecipeId,null);
    if(action==='craft'){assert.equal(craftRecipeFromDock(game,ranger.id,id,craftRecipeKey(game,ranger.id,id)),true);}
    else assert.equal(mergeTowerFromBadge(game,id,mergeTowerKey(game,id)),true);
    assert.equal(game.phase,'ready');assert.equal(game.selection,anchor);assert.equal(anchor.id,id);assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.pinned,pin);assert.equal(view.context.recipeFocus,null);assert.equal(view.context.previewPrevious,null);assert.equal(game.previewRecipeId,null);assert.equal(view.phaseUi.inspectorOpen,false,'A completed combination leaves the battlefield clear.');assert.equal(view.folio.hidden,true);assert.equal(view.get('folio-preview').innerHTML,'');assert.ok(view.body.innerHTML.includes(`<h2 class="tower-name">${data.towers[anchor.family].name}</h2>`));
    if(action==='craft'){assert.equal(anchor.family,ranger.id);assert.equal(anchor.tier,1);}else{assert.equal(anchor.family,'archer');assert.equal(anchor.tier,6);}
    const result=snapshot(game);game.select(id);assert.equal(view.phaseUi.inspectorOpen,true,'Explicitly selecting the result opens its details.');assert.equal(view.phaseUi.view,'unit');assert.equal(snapshot(game),result);
  }
});

test('all current recipes create directly from exact real allocations and reject the completed action without an intermediate preview',()=>{
  const original=JSON.stringify(data);assert.equal(data.recipes.length,38);
  for(const recipe of data.recipes){
    const game=new Game(data,{seed:904});game.economy.xp=100000;place(game,[...recipe.ingredients,{family:'soldier',tier:2},{family:'mage',tier:2}]);game.selection.mvpLevel=10;const before=snapshot(game),anchor=game.selection,position=[anchor.x,anchor.z],html=actualAvailableRecipeActionsMarkup(game),tag=html.match(new RegExp(`<button[^>]*data-id="${recipe.id}"[^>]*>`))?.[0];assert.ok(tag,recipe.id);
    assert.equal(snapshot(game),before);assert.equal(game.previewRecipeId,null);assert.doesNotMatch(html,/combination-preview|craft-preview|craft-cancel/);const key=tag.match(/data-craft-key="([^"]+)"/)[1];assert.equal(craftRecipeFromDock(game,recipe.id,anchor.id,key),true);assert.equal(anchor.family,recipeFamily(recipe));assert.equal(anchor.tier,recipeTier(recipe));assert.deepEqual([anchor.x,anchor.z],position);assert.equal(anchor.mvpLevel,10);assert.equal(craftRecipeFromDock(game,recipe.id,anchor.id,key),false);
  }
  assert.equal(JSON.stringify(data),original);
});

test('production inspection shows only the explicitly requested recipe without opening any combination preview',()=>{
  const view=mainFixture(recipeGame()),before=snapshot(view.game);view.openRecipePreview(ranger.id);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.game.previewRecipeId,null);const unavailable=data.recipes.find(recipe=>!view.game.availableRecipes().some(actual=>actual.id===recipe.id));view.openRecipePreview(unavailable.id);
  assert.equal(view.game.previewRecipeId,null);assert.equal(view.context.recipeFocus,unavailable.id);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.browser.hidden,false);assert.equal(view.browser.parentNode,view.get('folio-plan'));assert.equal(view.get('folio-preview').innerHTML,'');assert.equal(craftingDockModel(view.game,{recipeId:view.context.recipeFocus}).context,null);assert.equal(snapshot(view.game),before);
});

test('a new actual selection starts a fresh cancel snapshot instead of inheriting the previous preview comparison',()=>{
  const view=mainFixture(recipeGame()),first=view.game.selection;view.rankPreview.select(first,4,data);view.render();view.openRecipePreview(ranger.id);
  const second=view.game.towers.find(tower=>tower.id!==first.id&&ranger.ingredients.some(piece=>piece.family===tower.family&&piece.tier===tower.tier));assert.ok(second);view.game.select(second.id);assert.equal(view.game.previewRecipeId,null);
  view.rankPreview.select(second,6,data);view.render();const before=snapshot(view.game);view.openRecipePreview(ranger.id);view.cancelRecipePreview();assert.equal(view.game.selection,second);assert.equal(view.rankPreview.view(second,data).tier,6);assert.equal(snapshot(view.game),before);
});

test('production sidebar restores focus to portaled Keep/Merge/downgrade and retained Move after actual replacement',()=>{
  const game=place(new Game(data,{seed:904}),Array.from({length:5},()=>({family:'archer',tier:2})));game.economy.gold=500;const view=mainFixture(game);
  for(const action of ['keep-draw','merge','downgrade']){const old=view.get('folio-actions').querySelector(`[data-action="${action}"]`);assert.ok(old?.id);old.focus();view.body.scrollTop=137;view.render();const current=view.get('folio-actions').querySelector(`[data-action="${action}"]`);assert.notEqual(current,old);assert.equal(old.isConnected,false);assert.equal(view.document.activeElement,current,action);assert.equal(view.body.scrollTop,137);}
  const recipeRow=view.get('folio-recipes').querySelectorAll('[data-action="folio-recipe"]').at(-1),rowId=recipeRow.id;recipeRow.focus();view.render();assert.equal(recipeRow.isConnected,false);assert.equal(view.document.activeElement,view.get(rowId),'A portaled nonfirst recipe row keeps its own identity and focus');
  assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.completeWave();const kept=game.towers.find(tower=>tower.state==='active');game.select(kept.id);const move=view.get('folio-actions').querySelector('[data-action="move"]');assert.ok(move?.id);move.focus();view.render();assert.equal(view.document.activeElement,view.get('folio-actions').querySelector('[data-action="move"]'));
});

test('actual draft renderer removes Ready/Combat history controls and production 1–5 keys act only in Build/Select',()=>{
  const create=phase=>{const game=new Game(data,{seed:906});if(phase!=='build')place(game,Array.from({length:5},()=>({family:'archer',tier:2})));if(['ready','combat'].includes(phase))assert.equal(game.keep(),true);if(phase==='combat')assert.equal(game.startCombat(),true);assert.equal(game.phase,phase);return game;};
  const keyboard=main.split('\n').find(line=>line.startsWith("window.addEventListener('keydown',e=>{if(e.key==='Escape'"));assert.ok(keyboard);
  const from=main.indexOf('function activateDraw('),to=main.indexOf("app.addEventListener('pointerdown'",from);assert.ok(from>=0&&to>from);const activateSource=main.slice(from,to);
  for(const phase of ['build','select','ready','combat']){
    const game=create(phase),control=create(phase),dom=documentFixture();for(const id of ['draft','compact-draft-actions','folio-command-actions','folio-create-actions','dialog'])dom.app.append(new dom.Element(id==='dialog'?'dialog':'div',{id}));
    const world={keys:new Set(),maze:{editing:false},sync:noop},audio={unlock:noop},callbacks=new Map(),context={game,data,app:dom.app,images:{},world,audio,$:dom.get,document:dom.document,window:{addEventListener:(type,callback)=>callbacks.set(type,callback)},phaseUi:new PhaseUiState(),rankPreview:new DefenderRankPreview(),mode:50,intelligenceKey:null,draftCardsMarkup,commandPointsMarkup,actualAvailableRecipeActionsMarkup,icon,render:noop,draftCardActivation:new DraftCardActivation()};
    const methods=runInNewContext(declaration('renderDraft')+'\n'+activateSource+'\n'+keyboard+'\n({renderDraft,activateDraw})',context),input=new DraftCardPointerInput({activate:(index,event)=>methods.activateDraw(index,event)});let queries=0;
    dom.document.querySelector=selector=>{queries++;const index=selector.match(/data-index="(\d+)"/)?.[1],card=dom.get('draft').querySelectorAll('[data-action="draw"]').find(card=>card.dataset.index===index);if(card)card.click=()=>input.click(game,{target:card,detail:0});return card;};
    const before=snapshot(game);methods.renderDraft();assert.equal(snapshot(game),before,'Rendering '+phase+' cannot mutate Game');
    if(['build','select'].includes(phase))assert.equal(dom.get('draft').querySelectorAll('[data-action="draw"]').length,5);
    else{assert.equal(dom.get('draft').innerHTML,'');assert.equal(dom.get('folio-command-actions').innerHTML,'');assert.equal(dom.get('draft').querySelectorAll('[data-action]').length,0);dom.get('draft').append(new dom.Element('button',{'data-action':'draw','data-index':'1',hidden:''}));}
    callbacks.get('keydown')({key:'2',preventDefault:noop,repeat:false});
    if(phase==='build'){assert.equal(queries,1);assert.equal(game.activeDraw,1);assert.equal(game.selection,null);}
    else if(phase==='select'){assert.equal(queries,1);assert.equal(game.selected,game.draft.draws[1].towerId);}
    else{assert.equal(queries,0,'Even a retained stale hidden card must never be queried in '+phase);assert.equal(snapshot(game),before);}
    assert.equal(game.rng(),control.rng(),phase+' keyboard/renderer consumes no RNG');
  }
});

test('production map tools keep Suggested maze separate from the Start action, which remains exclusive to Ready',()=>{
  const commandDock=main.match(/<div class="command-dock"[^\n]+/)[0],mapTools=main.match(/<details class="map-tools"[^\n]+/)[0];
  assert.doesNotMatch(commandDock,/data-action="maze"|Maze plans/);assert.match(mapTools,/data-action="maze"[^>]+aria-label="Suggested maze"/);
  for(const phase of ['build','select','ready','combat']){
    const game=new Game(data,{seed:906});if(phase!=='build')place(game,Array.from({length:5},()=>({family:'archer',tier:2})));if(['ready','combat'].includes(phase))assert.equal(game.keep(),true);if(phase==='combat')assert.equal(game.startCombat(),true);
    const dom=documentFixture(),map=new dom.Element('div',{id:'map-start'}),start=new dom.Element('button',{id:'start-wave'});dom.app.append(map);map.append(start);
    const render=runInNewContext(declaration('renderMapAction')+'\nrenderMapAction',{game,$:dom.get,icon}),before=snapshot(game);render();
    assert.equal(map.hidden,phase!=='ready',`The Start container is exclusive to Ready during ${phase}.`);assert.equal(start.hidden,phase!=='ready');assert.equal(snapshot(game),before);
  }
});

test('production rank command removes a legal Lady Claire Create action for preview VI and restores it at actual V without changing the draft or RNG',()=>{
  const recipe=data.recipes.find(recipe=>recipe.id==='ladyclaire');assert.ok(recipe);
  const create=()=>{const game=new Game(data,{seed:9402});game.economy.xp=100000;return place(game,[...recipe.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}]);};
  const game=create(),control=create(),view=mainFixture(game),tower=game.selection;assert.equal(tower.tier,5);assert.ok(game.availableRecipes(tower).some(candidate=>candidate.id===recipe.id));
  for(const id of ['draft','compact-draft-actions','folio-command-actions','folio-create-actions'])view.folio.append(new view.Element('div',{id}));
  Object.assign(view.context,{actualAvailableRecipeActionsMarkup,draftCardsMarkup,commandPointsMarkup,mode:50,intelligenceKey:null,audio:{unlock:noop},draftCardActivation:{clear:noop},debug:false,codex:noop,warbands:noop,help:noop,sendWave:noop,closeDialog:noop,debugPanel:noop});
  Object.assign(view.context.world,{maze:{editing:false},doubleTap:{clear:noop}});
  const commands=runInNewContext(declaration('renderDraft')+'\n'+declaration('handleCommand')+'\n({renderDraft,handleCommand})',view.context);
  commands.renderDraft();
  const footer=view.get('folio-create-actions'),initial=footer.querySelectorAll('[data-action="craft-dock"]').find(button=>button.dataset.id===recipe.id),before=snapshot(game);
  assert.ok(initial);assert.match(footer.innerHTML,/Create Lady Claire/);assert.equal(Number(initial.dataset.towerId),tower.id);assert.ok(initial.dataset.craftKey);
  for(const tier of [6,5]){
    const button=view.body.querySelectorAll('[data-action="preview-rank"]').find(button=>Number(button.dataset.tier)===tier);assert.ok(button);
    commands.handleCommand({target:button});
    assert.equal(view.rankPreview.view(tower,data).tier,tier);assert.equal(tower.tier,5);assert.equal(game.selection,tower);assert.equal(snapshot(game),before);
    const creation=footer.querySelectorAll('[data-action="craft-dock"]').find(button=>button.dataset.id===recipe.id);
    if(tier===6){assert.equal(footer.innerHTML,'');assert.equal(creation,undefined,'A hypothetical rank must remove every physical creation token.');}
    else{assert.ok(creation);assert.notEqual(creation,initial);assert.equal(creation.dataset.craftKey,initial.dataset.craftKey);assert.match(footer.innerHTML,/Create Lady Claire/);}
    const focused=view.body.querySelectorAll('[data-action="preview-rank"]').find(button=>Number(button.dataset.tier)===tier);assert.equal(view.document.activeElement,focused,'The refreshed rank control keeps keyboard focus.');
  }
  assert.equal(game.rng(),control.rng(),'Rank commands and footer refresh consume no draw or combat randomness.');
});
