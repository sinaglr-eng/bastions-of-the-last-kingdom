import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {createFolioLayout,combinationPreviewMarkup} from '../ui/cartographer-folio.js';
import {craftingDockModel,updateCraftingDock,craftRecipeFromDock,craftRecipeKey} from '../ui/crafting-dock.js';
import {recipeNavigationVisit} from '../ui/recipe-navigation.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {PhaseUiState,endedPhase} from '../ui/phase-ui.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {icon} from '../ui/icons.js';
import {towerStats} from '../game/core/math.js';
import {recipeFamily,recipeTier} from '../game/core/recipes.js';
import {baseAttackDps,formatTowerNumber,damageTypeName} from '../ui/grimoire.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {commandPointsMarkup} from '../ui/command-points.js';
import {DraftCardActivation,DraftCardPointerInput,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';

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
    matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return attr?Object.hasOwn(this.attributes,attr[1])&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]):this.tagName===selector.toUpperCase();}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
    get innerHTML(){return this._html;}
    set innerHTML(html){this.replaceChildren();this._html=html;this.writes++;const stack=[this];for(const token of html.match(/<[^>]+>/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attrs={};for(const item of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[item[1]]=item[2]??'';const child=new Element(tag,attrs);stack.at(-1).append(child);if(!['img','input','br','hr','path','circle','line','polyline','rect'].includes(tag)&&!token.endsWith('/>'))stack.push(child);}}
    focus(){document.activeElement=this;}
    addEventListener(){}
  }
  const app=new Element('main',{id:'app'});document.root=app;document.activeElement=app;
  document.getElementById=id=>app.id===id?app:app.querySelector('#'+id);document.createComment=text=>new Element('#comment',{'data-comment':text});
  const add=(id,parent=app,tag='div')=>{const node=new Element(tag,{id});parent.append(node);return node;};
  const sidebar=add('sidebar'),body=add('side-body',sidebar),browser=add('recipe-browser',sidebar);add('side-top',sidebar);add('inspector-tabs',sidebar);
  const folio=add('preparation-folio');for(const id of ['folio-inspection','folio-actions','folio-plan','folio-preview'])add(id,folio);add('folio-recipes',document.getElementById('folio-plan'));
  const layout=createFolioLayout(document);return {document,app,body,browser,sidebar,folio,layout,get:document.getElementById,Element};
}

function mainFixture(game,{subscriber=false}={}){
  const dom=documentFixture(),rankPreview=new DefenderRankPreview(),phaseUi=new PhaseUiState();phaseUi.sync(game);
  const context={...dom,game,data,images:{},rankPreview,phaseUi,folioLayout:dom.layout,folioRecipeId:null,folioRecipeSelection:null,previewPrevious:null,recipeFocus:null,recipeNavigation:{history:[],index:-1},recipeNavigationVisit,craftingDockModel,updateCraftingDock,defenderPanelMarkup,DpsMeasurement,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),icon,endedPhase,panelDetails:new Map(),stampCraftButtons:noop,world:{sync:noop,resize:noop},$:dom.get,tutorial:()=>'<p>Build</p>'};
  const source=[singleLine('syncFolio'),singleLine('cancelRecipePreview'),singleLine('towerPanel'),declaration('renderSidebar'),declaration('renderRecipeBrowser'),singleLine('openRecipePreview')].join('\n');
  const methods=runInNewContext(source+'\n({syncFolio,cancelRecipePreview,renderSidebar,renderRecipeBrowser,openRecipePreview})',context);
  context.render=()=>{methods.renderSidebar();methods.renderRecipeBrowser();methods.syncFolio();};
  if(subscriber){Object.assign(context,{resultFacts:{event:noop},guidance:{event:noop},audio:{play:noop},draftCardActivation:{clear:noop},dpsWave:null,profile:{discoveries:[],bestWave:0,bestScore:0,wins:0},statistics:{tracker:{id:'layout-subscriber-fixture',version:'0.4.0'}},recordRunResult:noop,saveProfile:noop,showResult:noop,notice:noop,towers:data.towers,balance:data.balance});context.world.doubleTap={clear:noop};const actualSubscriber=main.split('\n').find(line=>line.trimStart().startsWith('game.on((type,payload)=>{'));assert.ok(actualSubscriber);runInNewContext(actualSubscriber,context);}
  else game.on(type=>{if(type==='change')context.render();});
  context.render();return {...dom,...methods,game,rankPreview,phaseUi,context,render:context.render};
}

test('repeated sync moves the same action/recipe nodes once and restores them to inspector across actual phases',()=>{
  const game=place(new Game(data,{seed:904}),Array.from({length:5},()=>({family:'archer',tier:2}))),view=documentFixture();view.body.innerHTML=defenderPanelMarkup(game,game.selection);
  const actions=view.body.querySelector('.folio-actions'),recipes=view.body.querySelector('.folio-recipes'),keep=actions.querySelector('[data-action="keep-draw"]');
  for(let pass=0;pass<12;pass++){view.layout.sync(game);assert.equal(view.body.parentNode,view.get('folio-inspection'));assert.equal(actions.parentNode,view.get('folio-actions'));assert.equal(recipes.parentNode,view.get('folio-recipes'));assert.equal(view.app.querySelectorAll('.folio-actions').length,1);assert.equal(view.app.querySelectorAll('.folio-recipes').length,1);assert.equal(actions.querySelector('[data-action="keep-draw"]'),keep);}
  view.layout.restoreParts();assert.equal(actions.parentNode,view.body);assert.equal(recipes.parentNode,view.body);game.keep();view.body.innerHTML=defenderPanelMarkup(game,game.selection);view.layout.sync(game);assert.equal(view.folio.hidden,true);assert.equal(view.body.parentNode,view.sidebar);assert.equal(keep.isConnected,false);
  assert.equal(game.startCombat(),true);view.layout.sync(game);assert.equal(view.body.parentNode,view.sidebar);assert.equal(view.app.querySelectorAll('.folio-actions').length,1);
});

test('restore plus actual rerender never leaves old or duplicate commands connected; explicit recipe browser returns to original anchor',()=>{
  const view=mainFixture(recipeGame());let old=null;
  for(let pass=0;pass<8;pass++){old=view.get('folio-actions').querySelector('[data-action="keep-draw"]');view.render();assert.equal(old.isConnected,false);assert.equal(view.app.querySelectorAll('.folio-actions').length,1);assert.equal(view.app.querySelectorAll('.folio-recipes').length,1);assert.equal(view.get('folio-actions').querySelectorAll('[data-action="keep-draw"]').length,1);}
  const unavailable=data.recipes.find(recipe=>!view.game.availableRecipes().some(actual=>actual.id===recipe.id));view.openRecipePreview(unavailable.id);assert.equal(view.browser.hidden,false);assert.equal(view.browser.parentNode,view.get('folio-plan'));assert.equal(view.get('folio-recipes').hidden,true);
  view.phaseUi.open('unit');view.render();assert.equal(view.browser.hidden,true);assert.equal(view.browser.parentNode,view.sidebar);assert.equal(view.get('folio-recipes').hidden,false);
});

for(const kind of ['draft','mixed','retained'])test(`exact ${kind} preview is read-only, uses the chosen physical foundation and retains guarded confirmation`,()=>{
  const game=recipeGame(kind),control=recipeGame(kind),before=snapshot(game),context=craftingDockModel(game,{recipeId:ranger.id,anchorId:game.selected}).context;assert.ok(context);
  const html=combinationPreviewMarkup(game,{},ranger.id);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.match(html,new RegExp(`Result at \\(${context.anchor.x+1}, ${context.anchor.z+1}\\)`));
  for(const tower of context.pieces)assert.match(html,new RegExp(`Foundation \\(${tower.x+1}, ${tower.z+1}\\)`));assert.equal(context.pieces.length,3);assert.equal(context.consumed.length,2);assert.equal(context.discarded.length,kind==='retained'?0:kind==='mixed'?3:2);
  assert.match(html,/data-action="craft-cancel"/);const tag=html.match(/<button[^>]*data-action="craft-dock"[^>]*>/)[0];assert.match(tag,new RegExp(`data-tower-id="${context.anchor.id}"`));assert.ok(tag.includes(`data-craft-key="${context.key}"`));
  if(kind==='retained'){assert.match(html,/The current draft stays available/);assert.equal(game.draft.draws.filter(draw=>!draw.placed).length,5);}
  else assert.match(html,/Unchosen recruits → castle walls/);
  const anchor=context.anchor,key=context.key;assert.equal(craftRecipeFromDock(game,ranger.id,anchor.id,key),true);assert.equal(anchor.family,ranger.id);assert.equal(craftRecipeFromDock(game,ranger.id,anchor.id,key),false);
});

test('retained Build preview never reads five hidden identities or falls back to rank-I art for an unavailable higher-rank picture',()=>{
  const game=recipeGame('retained');for(const draw of game.draft.draws)for(const key of ['family','tier'])Object.defineProperty(draw,key,{get(){throw Error('Latent identity read');},configurable:true});
  assert.match(combinationPreviewMarkup(game,{},ranger.id),/The current draft stays available/);
  const recipe=data.recipes.find(recipe=>recipe.ingredients.some(piece=>!data.towers[piece.family].advanced&&piece.tier>1)),other=new Game(data,{seed:904});recipe.ingredients.forEach((piece,index)=>retained(other,piece,index));other.select(other.towers[0].id);
  const high=recipe.ingredients.find(piece=>!data.towers[piece.family].advanced&&piece.tier>1),html=combinationPreviewMarkup(other,{[high.family]:'/rank-I-fallback-forbidden.png'},recipe.id);assert.ok(html);assert.doesNotMatch(html,/rank-I-fallback-forbidden|src="(?:undefined|null|)"/);
});

test('an invalidated exact context cannot leave an empty preview that hides normal folio columns',()=>{
  const game=recipeGame(),view=documentFixture();view.body.innerHTML=defenderPanelMarkup(game,game.selection);assert.equal(game.previewRecipe(ranger.id),true);view.layout.sync(game,{preview:true});assert.equal(view.folio.dataset.preview,'true');assert.match(view.get('folio-preview').innerHTML,/Combine Elven Ranger/);
  game.towers.find(tower=>tower.family===ranger.ingredients[1].family).tier=6;assert.equal(combinationPreviewMarkup(game), '');const before=snapshot(game);view.layout.sync(game,{preview:true});assert.equal(view.folio.dataset.preview,'false');assert.equal(view.get('folio-preview').hidden,true);assert.equal(view.app.dataset.combinationPreview,'false');assert.equal(view.get('folio-preview').innerHTML,'');assert.equal(snapshot(game),before);
});

test('production preview/cancel restores compared rank and actual selection without changing inventory, draw, pin, resources or RNG',()=>{
  const view=mainFixture(recipeGame()),control=recipeGame(),tower=view.game.selection;view.rankPreview.select(tower,4,data);view.context.folioRecipeId=ranger.id;view.render();const before=snapshot(view.game),identity=view.rankPreview.identity;
  view.openRecipePreview(ranger.id);assert.equal(view.game.previewRecipeId,ranger.id);assert.equal(view.folio.dataset.preview,'true');assert.match(view.get('folio-preview').innerHTML,/Exact ingredients/);assert.equal(snapshot(view.game),before);
  view.rankPreview.tier=6;view.cancelRecipePreview();assert.equal(view.game.previewRecipeId,null);assert.equal(view.rankPreview.identity,identity);assert.equal(view.rankPreview.tier,4);assert.equal(view.context.folioRecipeId,ranger.id);assert.equal(view.phaseUi.view,'unit');assert.equal(view.folio.dataset.preview,'false');assert.equal(snapshot(view.game),before);assert.equal(view.game.rng(),control.rng());
});

test('actual Ready retained recipe preview opens a temporary folio and Cancel restores hidden preparation with the same foundation',()=>{
  const ready=()=>{const game=recipeGame('retained'),anchor=game.selection;place(game,Array.from({length:5},()=>({family:'soldier',tier:2})));assert.equal(game.keep(),true);game.select(anchor.id);assert.equal(game.phase,'ready');assert.ok(game.availableRecipes().some(recipe=>recipe.id===ranger.id));return game;};
  const game=ready(),control=ready(),view=mainFixture(game),anchor=game.selection,before=snapshot(game),position=[anchor.x,anchor.z];assert.equal(view.folio.hidden,true);assert.equal(view.body.parentNode,view.sidebar);assert.equal(game.draft.resolved,true);
  view.openRecipePreview(ranger.id);assert.equal(game.phase,'ready');assert.equal(view.folio.hidden,false);assert.equal(view.folio.dataset.preview,'true');assert.equal(view.app.dataset.combinationPreview,'true');assert.equal(view.app.dataset.folioInspector,'false');assert.equal(view.body.parentNode,view.sidebar);assert.match(view.get('folio-preview').innerHTML,/Combine Elven Ranger/);assert.equal(snapshot(game),before);
  view.cancelRecipePreview();assert.equal(view.folio.hidden,true);assert.equal(view.folio.dataset.preview,'false');assert.equal(view.app.dataset.combinationPreview,'false');assert.equal(view.get('folio-preview').hidden,true);assert.equal(view.get('folio-preview').innerHTML,'');assert.equal(view.body.parentNode,view.sidebar);assert.equal(game.selection,anchor);assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.previewRecipeId,null);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
});

test('actual main combine subscriber replaces recipe receipts with the new defender after Ready craft or guarded merge',()=>{
  for(const action of ['craft','merge']){
    const game=action==='craft'?recipeGame('retained'):new Game(data,{seed:904});if(action==='merge'){retained(game,{family:'archer',tier:5},0);retained(game,{family:'archer',tier:5},1);}
    const anchor=game.towers[0],position=[anchor.x,anchor.z],id=anchor.id;place(game,Array.from({length:5},()=>({family:'soldier',tier:2})));assert.equal(game.keep(),true);game.select(id);game.pinned=data.recipes.find(recipe=>recipe.id!==ranger.id).id;
    const view=mainFixture(game,{subscriber:true}),pin=game.pinned;view.rankPreview.select(anchor,6,data);view.openRecipePreview(ranger.id);assert.equal(view.context.recipeFocus,ranger.id);assert.ok(view.context.previewPrevious);
    if(action==='craft'){assert.equal(game.previewRecipeId,ranger.id);assert.equal(craftRecipeFromDock(game,ranger.id,id,craftRecipeKey(game,ranger.id,id)),true);}
    else assert.equal(mergeTowerFromBadge(game,id,mergeTowerKey(game,id)),true);
    assert.equal(game.phase,'ready');assert.equal(game.selection,anchor);assert.equal(anchor.id,id);assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.pinned,pin);assert.equal(view.context.recipeFocus,null);assert.equal(view.context.previewPrevious,null);assert.equal(game.previewRecipeId,null);assert.equal(view.phaseUi.view,'unit');assert.equal(view.folio.hidden,true);assert.equal(view.get('folio-preview').innerHTML,'');assert.ok(view.body.innerHTML.includes(`<h2 class="tower-name">${data.towers[anchor.family].name}</h2>`));
    if(action==='craft'){assert.equal(anchor.family,ranger.id);assert.equal(anchor.tier,1);}else{assert.equal(anchor.family,'archer');assert.equal(anchor.tier,6);}
  }
});

test('all current combination results expose exactly four canonical base metrics and damage metadata without altering actual ingredients',()=>{
  const original=JSON.stringify(data);assert.equal(data.recipes.length,38);
  for(const recipe of data.recipes){
    const game=new Game(data,{seed:904});game.economy.xp=100000;place(game,[...recipe.ingredients,{family:'soldier',tier:2},{family:'mage',tier:2}]);game.selection.mvpLevel=10;const before=snapshot(game),stats=towerStats({family:recipeFamily(recipe),tier:recipeTier(recipe)},data),html=combinationPreviewMarkup(game,{},recipe.id),result=html.match(/<section class="combination-result">([\s\S]*?)<\/section>/)?.[1];assert.ok(result,recipe.id);
    const metrics=[...result.matchAll(/<div><span>([^<]+)<\/span><strong>([^<]+)<\/strong><\/div>/g)].map(match=>[match[1],match[2]]);assert.deepEqual(metrics,[['Damage / hit',formatTowerNumber(stats.damage)],['Base direct DPS',formatTowerNumber(baseAttackDps(stats))],['Range',formatTowerNumber(stats.range)],['Interval',formatTowerNumber(stats.interval)+'s']],recipe.id);assert.ok(result.includes(`<span class="damage-tag">${damageTypeName(stats.type)}</span>`));assert.equal((result.match(/class="stat-grid"/g)||[]).length,1);assert.equal(snapshot(game),before,recipe.id+' result markup cannot change the MVP-10 actual ingredient');
  }
  assert.equal(JSON.stringify(data),original);
});

test('production unavailable inspection after a legal preview clears the old combination and shows only the explicitly requested recipe',()=>{
  const view=mainFixture(recipeGame()),before=snapshot(view.game);view.openRecipePreview(ranger.id);assert.equal(view.folio.dataset.preview,'true');const unavailable=data.recipes.find(recipe=>!view.game.availableRecipes().some(actual=>actual.id===recipe.id));view.openRecipePreview(unavailable.id);
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
    const game=create(phase),control=create(phase),dom=documentFixture();for(const id of ['draft','compact-draft-actions','folio-command-actions','dialog'])dom.app.append(new dom.Element(id==='dialog'?'dialog':'div',{id}));
    const world={keys:new Set(),maze:{editing:false},sync:noop},audio={unlock:noop},callbacks=new Map(),context={game,data,images:{},world,audio,$:dom.get,document:dom.document,window:{addEventListener:(type,callback)=>callbacks.set(type,callback)},phaseUi:new PhaseUiState(),mode:50,intelligenceKey:null,draftCardsMarkup,commandPointsMarkup,icon,render:noop,draftCardActivation:new DraftCardActivation()};
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
