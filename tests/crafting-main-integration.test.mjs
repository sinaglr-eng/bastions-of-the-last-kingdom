import test from 'node:test';
import {recipeNavigationVisit,recipeNavigationStep} from '../ui/recipe-navigation.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {craftingDockModel,updateCraftingDock,craftRecipeKey,craftRecipeFromDock} from '../ui/crafting-dock.js';
import {icon} from '../ui/icons.js';
import {PhaseUiState} from '../ui/phase-ui.js';
import {CommandPointerInput} from '../ui/command-pointer-input.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const recipe=data.recipes.find(r=>r.id==='thornwarden');
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
function section(start,end){const from=main.indexOf(start),to=main.indexOf(end,from);assert.ok(from>=0&&to>from,`${start} has an explicit source boundary`);return main.slice(from,to);}
const stampSource=section('function stampCraftButtons(','$(\'battlefield-overlays\')');
const handlerSource=section('function handleCommand(','function toggleWorld(');
const browserSource=section('function renderRecipeBrowser(','function renderEconomy(');
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,phase:game.phase,selected:game.selected,gold:game.economy.gold,cp:game.commandPoints.value,occupied:[...game.grid.occupied],discoveries:[...game.discoveries]});
const noop=()=>{};
function actualGame({retained=false}={}){
  const game=new Game(data,{seed:731});
  if(retained){recipe.ingredients.forEach((piece,index)=>{const tower={id:game.nextId++,...piece,state:'active',round:0,x:10+index,z:10,kills:0,cooldown:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);});}
  else for(let index=0;index<5;index++){
    game.draft.roundForced=index<3?recipe.ingredients[index]:{family:'soldier',tier:2};assert.equal(game.place(3+index,3),true);
  }
  game.select(game.towers[0].id);return game;
}
function productionCommands(game){
  const callbacks=new Map(),captureCallbacks=new Map(),calls={render:0,close:0,unlock:0},world={maze:{editing:false},doubleTap:{clear:noop}},app={addEventListener:(type,callback,options)=>((options===true||options?.capture)?captureCallbacks:callbacks).set(type,callback)};
  const methods=runInNewContext(`${stampSource}\n${handlerSource}\n({stampCraftButtons,handleCommand})`,{
    game,app,world,audio:{unlock:()=>calls.unlock++},draftCardActivation:{clear:noop},debug:false,
    CommandPointerInput,window:{addEventListener:noop},document:{addEventListener:noop,elementFromPoint:()=>null},
    craftRecipeKey,craftRecipeFromDock,render:()=>calls.render++,closeDialog:()=>calls.close++,
    codex:noop,warbands:noop,help:noop,sendWave:noop,debugPanel:noop,toggleAudioSettings:noop,
  });
  const click=button=>{let stopped=false;const event={target:{closest:()=>button},detail:1,preventDefault:noop,stopImmediatePropagation:()=>{stopped=true;}};captureCallbacks.get('click')?.(event);if(!stopped)callbacks.get('click')(event);};
  return {...methods,calls,world,click};
}
const buttonFor=(game,action='craft-dock')=>({disabled:false,dataset:{action,id:recipe.id,towerId:String(game.selected),craftKey:craftRecipeKey(game,recipe.id)}});

for(const retained of [false,true])test(`production explicit craft handler uses the selected foundation for ${retained?'retained-only build':'completed mixed draft'} and commits once`,()=>{
  const game=actualGame({retained}),commands=productionCommands(game),anchor=game.selection,position=[anchor.x,anchor.z],button=buttonFor(game),before=snapshot(game);
  assert.ok(button.dataset.craftKey);assert.equal(snapshot(game),before);commands.click(button);
  assert.equal(anchor.family,recipe.id);assert.equal(anchor.state,'active');assert.deepEqual([anchor.x,anchor.z],position);assert.equal(game.phase,retained?'build':'ready');assert.equal(game.draft.resolved,!retained);assert.equal(commands.calls.render,1);
  const completed=snapshot(game);commands.click(button);assert.equal(snapshot(game),completed);assert.equal(commands.calls.render,1);
});

test('production legacy craft stamping binds a new button once and delegates the same guarded action',()=>{
  const game=actualGame(),commands=productionCommands(game),button={disabled:false,dataset:{action:'craft',id:recipe.id}};
  commands.stampCraftButtons({querySelectorAll:()=>[button]});assert.equal(Number(button.dataset.towerId),game.selected);assert.equal(button.dataset.craftKey,craftRecipeKey(game,recipe.id));
  commands.click(button);assert.equal(game.selection.family,recipe.id);assert.equal(game.phase,'ready');assert.equal(commands.calls.close,1);
});

test('production handlers reject changed selection, phase, inventory, reserve and reroll tokens without rebinding the result',()=>{
  for(const action of ['craft','craft-dock'])for(const change of [game=>game.select(game.towers[1].id),game=>{game.phase='ready';},game=>{game.towers[4].tier++;},game=>{game.draft.rerollsUsed++;},game=>{game.draft.draws[1].reservedForNextDraft=true;}]){
    const game=actualGame(),commands=productionCommands(game),button=buttonFor(game,action);change(game);const before=snapshot(game);
    commands.click(button);assert.equal(snapshot(game),before);assert.equal(commands.calls.close,0);assert.equal(commands.calls.render,0);
  }
});

test('production legacy restamping cannot silently authorize an existing visible button after selection changes',()=>{
  const game=actualGame(),commands=productionCommands(game),button={disabled:false,dataset:{action:'craft',id:recipe.id}},container={querySelectorAll:()=>[button]};
  commands.stampCraftButtons(container);const shown={...button.dataset};game.select(game.towers[1].id);commands.stampCraftButtons(container);
  assert.equal(button.dataset.towerId,shown.towerId,'Existing presentation keeps its original result foundation.');assert.equal(button.dataset.craftKey,shown.craftKey,'A rerender cannot reauthorize stale presentation.');
  const before=snapshot(game);commands.click(button);assert.equal(snapshot(game),before);assert.equal(commands.calls.close,0);
});

test('production blueprint-edit guard blocks crafting even with an otherwise current valid token',()=>{
  const game=actualGame(),commands=productionCommands(game),button=buttonFor(game),before=snapshot(game);commands.world.maze.editing=true;
  commands.click(button);assert.equal(snapshot(game),before);assert.equal(commands.calls.render,0);
});

function panelFixture(){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag.toUpperCase();this.attributes=attributes;this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));this.ownerDocument=document;this.parentNode=null;this.children=[];this._html='';this.open=Object.hasOwn(attributes,'open');this.scrollTop=0;this.hidden=false;this.disabled=Object.hasOwn(attributes,'disabled');this.classList={toggle:noop};}
    matches(selector){if(selector.startsWith('.'))return (this.attributes.class||'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('['))return Object.hasOwn(this.attributes,selector.slice(1,-1));return this.tagName.toLowerCase()===selector;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    get innerHTML(){return this._html;}
    set innerHTML(html){
      this._html=html;this.children.forEach(child=>child.parentNode=null);this.children=[];const stack=[this];
      for(const token of html.match(/<[^>]+>/g)||[]){
        if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
        const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attributes={};
        for(const match of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[match[1]]=match[2]??'';
        const element=new Element(tag,attributes),parent=stack.at(-1);element.parentNode=parent;parent.children.push(element);
        if(!['img','input','br','hr'].includes(tag)&&!token.endsWith('/>'))stack.push(element);
      }
    }
    focus(options){document.activeElement=this;this.focusOptions=options;}
  }
  return new Element('aside');
}
function productionBrowser(game){
  const host=panelFixture(),tabs=panelFixture(),phaseUi=new PhaseUiState(),app={dataset:{}},context={game,images:{},previewPrevious:null,rankPreview:{identity:null,tier:null},syncFolio:noop,recipeFocus:null,recipeNavigation:{history:[],index:-1},recipeNavigationVisit,recipeNavigationStep,craftingDockModel,updateCraftingDock,icon,phaseUi,app,world:{resize(){}},$:id=>id==='recipe-browser'?host:tabs};
  const methods=runInNewContext(`${browserSource}\n({renderRecipeBrowser,openRecipePreview,getFocus:()=>recipeFocus})`,context);
  // Production Game's change listener calls render(), including this renderer.
  game.on(type=>{if(type==='change')methods.renderRecipeBrowser();});
  return {...methods,host};
}

test('production browser captures dock and chain choices before replacing them during a phase transition',()=>{
  const game=actualGame(),browser=productionBrowser(game);game.pinned=recipe.id;browser.renderRecipeBrowser();
  browser.host.querySelector('.crafting-dock-disclosure').open=false;browser.host.querySelector('.crafting-chain').open=true;
  game.phase='combat';browser.renderRecipeBrowser();assert.equal(browser.host.innerHTML,'');assert.equal(browser.host.hidden,true,'Combat leaves catalog access in the single top register');
  game.phase='select';browser.renderRecipeBrowser();assert.equal(browser.host.querySelector('.crafting-dock-disclosure').open,false);assert.equal(browser.host.querySelector('.crafting-chain').open,true);
});

test('production inspection shows the exact recipe without an intermediate preview and keeps an unavailable recipe explicit',()=>{
  const game=actualGame(),control=actualGame(),browser=productionBrowser(game),before=snapshot(game);game.previewRecipe=()=>{throw Error('The retired preview step cannot be called.');};browser.openRecipePreview(recipe.id);
  assert.equal(game.previewRecipeId,null);assert.equal(browser.getFocus(),recipe.id);assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
  const unavailable=data.recipes.find(r=>r.id!==recipe.id&&!game.availableRecipes().some(available=>available.id===r.id));browser.openRecipePreview(unavailable.id);
  assert.equal(browser.getFocus(),unavailable.id);assert.equal(snapshot(game),before);assert.equal(craftingDockModel(game,{recipeId:browser.getFocus()}).context,null);assert.doesNotMatch(browser.host.querySelector('.crafting-dock-actions').innerHTML,/data-action="craft-dock"/);
});
