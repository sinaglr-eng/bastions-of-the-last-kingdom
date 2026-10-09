import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DraftCardActivation,DraftCardPointerInput,drawnTower,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {recipeProgress,recipesUsing,recipeLabel,rankLabel} from '../game/core/recipes.js';
import {builtTowerCount} from '../game/core/warband-info.js';
import {defenderCode} from '../game/core/unit-label.js';
import {championClassification} from '../game/render/champion-classification.js';
import {rankColor} from '../game/render/ranks.js';
import {ROMAN,abilityLines,baseAttackDps,formatTowerNumber,damageTypeName} from '../ui/grimoire.js';
import {selectedSupportMarkup} from '../ui/support-guide.js';
import {DefenderRankPreview,defenderRankPreviewMarkup} from '../ui/defender-rank-preview.js';
import {icon} from '../ui/icons.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
const between=(start,end)=>main.slice(main.indexOf(start),main.indexOf(end,main.indexOf(start)));
const compile=(source,name,scope)=>Function(...Object.keys(scope),`${source}\nreturn ${name};`)(...Object.values(scope));
const outside={closest:()=>null};
const card=index=>({dataset:{action:'draw',index:String(index)},disabled:false,isConnected:true,closest(){return this;}});
const finger=(target,id=1,x=100,y=100)=>({target,pointerId:id,pointerType:'touch',button:0,isPrimary:true,clientX:x,clientY:y});
const click=(target,detail=1,extra={})=>({target,detail,button:0,clientX:100,clientY:100,...extra});
class Surface{
  constructor(){this.listeners=new Map();}
  addEventListener(type,callback){this.listeners.set(type,callback);}
  emit(type,event){this.listeners.get(type)?.({...event,type});}
}
function setup({placed=true,distinct=false}={}){
  const game=new Game(data,{seed:42});if(placed)for(let index=0;index<5;index++){
    if(distinct)game.draft.roundForced={family:['archer','mage','cleric','soldier','druid'][index],tier:index+1};
    assert.ok(game.place(3+index,3));
  }game.draft.roundForced=null;
  let now=1000,hit=null,renders=0;const cards=game.draft.draws.map((_,index)=>card(index)),app=new Surface(),window=new Surface();
  const body={dataset:{},scrollTop:0,innerHTML:'',insertAdjacentHTML(){}},top={innerHTML:''},world={maze:{editing:false},sync(){}},audio={unlock(){}};
  const $=id=>id==='side-body'?body:id==='side-top'?top:null,rankPreview=new DefenderRankPreview();
  const images=Object.fromEntries(Object.keys(data.towers).flatMap(family=>ROMAN.map((_,index)=>[`${family}:${index+1}`,`approved-portrait:${family}:${index+1}`])));
  const panel=compile(between('function quality(t)','function notice(')+between('function towerPanel(t)','function enemyInspectionOptions'),'towerPanel',{
    game,rankPreview,data,towers:data.towers,balance:data.balance,images,roman:ROMAN,icon,towerStats,rankColor,defenderCode,championClassification,
    defenderRankPreviewMarkup,builtTowerCount,rankLabel,abilityLines,formatTowerNumber,baseAttackDps,damageTypeName,selectedSupportMarkup,recipeProgress,recipesUsing,recipeLabel
  });
  const sidebar=compile(between('function renderSidebar()','function previewRecipe()'),'renderSidebar',{
    game,$,icon,rankPreview,towerPanel:panel,
    commandPointsMarkup:()=>'',tutorial:()=>'',combatPanel:()=>'',selectedEnemyMarkup:()=>'',enemyInspectionOptions:()=>({})
  });
  const render=()=>{renders++;sidebar();};game.on(type=>{if(type==='change')render();});
  const activation=new DraftCardActivation(()=>now);
  const activate=compile(between('function activateDraw(','app.addEventListener(\'pointerdown\''),'activateDraw',{game,world,audio,draftCardActivation:activation,render});
  const input=new DraftCardPointerInput({now:()=>now,hitTest:()=>hit,activate,clearActivation:()=>activation.clear()});
  // Run the actual production bindings, not a second implementation of them.
  Function('app','window','game','draftPointerInput',between("app.addEventListener('pointerdown'","function handleCommand("))(app,window,game,input);
  const commandPrefix=between('function handleCommand(','  draftCardActivation.clear();world.doubleTap.clear();')+'\n}';
  const command=compile(commandPrefix,'handleCommand',{game,world,audio,draftPointerInput:input,debug:false});
  render();
  return {game,cards,app,window,input,activation,body,command,render,rankPreview,images,get renders(){return renders;},advance(ms){now+=ms;},hit(value){hit=value;},
    tap(index,id=1,releaseTarget=outside){const target=cards[index];hit=target;app.emit('pointerdown',finger(target,id));window.emit('pointerup',finger(releaseTarget,id));}
  };
}

test('captured iPad-style touch release hit-tests the visible card and immediately updates the actual sidebar binding',()=>{
  const view=setup();view.tap(0);assert.equal(view.game.selected,drawnTower(view.game,0).id);assert.match(view.body.innerHTML,new RegExp(data.towers[drawnTower(view.game,0).family].name));
  view.advance(100);view.tap(1,2);assert.equal(view.game.selected,drawnTower(view.game,1).id);assert.match(view.body.innerHTML,new RegExp(data.towers[drawnTower(view.game,1).family].name));
  assert.equal(view.game.phase,'select');
});

test('native touch compatibility clicks do not select twice or erase the first tap of a valid keeper pair',()=>{
  const view=setup();view.tap(0);const renders=view.renders;
  view.command(click(view.cards[0],1,{pointerType:'touch'}));assert.equal(view.renders,renders);assert.ok(view.activation.last);
  view.window.emit('lostpointercapture',finger(view.cards[0]));assert.ok(view.activation.last,'normal implicit capture release preserves the pair');
  view.advance(200);view.tap(0,2);assert.equal(view.game.phase,'ready');assert.equal(view.game.towers.filter(t=>t.state==='active').length,1);
  view.command(click(view.cards[0],2,{pointerType:'touch'}));assert.equal(view.game.towers.filter(t=>t.state==='active').length,1);
});

test('native click-only Safari/accessibility activation selects a newly tapped card without keeping it',()=>{
  const view=setup();view.command(click(view.cards[0],1));assert.equal(view.game.selected,drawnTower(view.game,0).id);
  view.advance(100);view.command(click(view.cards[1],1,{sourceCapabilities:{firesTouchEvents:true}}));assert.equal(view.game.selected,drawnTower(view.game,1).id);
  assert.match(view.body.innerHTML,new RegExp(data.towers[drawnTower(view.game,1).family].name));
  view.advance(100);view.command(click(view.cards[1],2));assert.equal(view.game.phase,'select','click-only fallback cannot form a keeper pair');
});

test('all five retargeted-touch and click-only cards update the actual portrait, name and on-field rank without stale previews',()=>{
  for(const mode of ['touch','click-only']){
    const view=setup({distinct:true});
    for(let index=0;index<5;index++){
      if(index)view.rankPreview.select(view.game.selection,6,data);
      view.advance(100);
      if(mode==='touch')view.tap(index,index+1,outside);else view.command(click(view.cards[index],1));
      const tower=drawnTower(view.game,index),html=view.body.innerHTML;
      assert.equal(view.game.selection,tower,`${mode}: card ${index+1}`);
      assert.ok(html.includes(`<div class="tower-portrait"><img src="${view.images[`${tower.family}:${tower.tier}`]}" alt="${data.towers[tower.family].name} model">`));
      assert.ok(html.includes(`<h2 class="tower-name">${data.towers[tower.family].name}</h2>`));
      assert.ok(html.includes(`<span>On field: ${ROMAN[tower.tier-1]}</span>`));
      assert.ok(html.includes('Current defender'));assert.equal(view.rankPreview.view(tower,data).tier,tower.tier);
    }
    assert.equal(view.game.phase,'select');
  }
});

test('a native click can finish an unchanged primary press when the browser omitted pointerup',()=>{
  const view=setup();view.app.emit('pointerdown',finger(view.cards[2]));
  view.command(click(view.cards[2],1,{pointerType:'touch'}));assert.equal(view.game.selected,drawnTower(view.game,2).id);assert.equal(view.input.origins.size,0);
  view.window.emit('pointerup',finger(view.cards[2]));assert.equal(view.game.phase,'select');
});

test('returning after horizontal scroll/drag never selects or keeps, even if a native click follows',()=>{
  const view=setup();view.tap(0);const selected=view.game.selected;
  view.advance(100);view.hit(view.cards[1]);view.app.emit('pointerdown',finger(view.cards[1],2));
  view.window.emit('pointermove',finger(view.cards[1],2,145));view.window.emit('pointermove',finger(view.cards[1],2));
  view.window.emit('pointerup',finger(view.cards[1],2));view.command(click(view.cards[1],1,{pointerType:'touch'}));
  assert.equal(view.game.selected,selected);assert.equal(view.game.phase,'select');assert.equal(view.activation.last,null);
  view.advance(100);view.tap(0,3);assert.equal(view.game.phase,'select','the interrupted first confirmation was consumed');
});

test('release outside the card cannot select it despite implicit capture keeping the old target',()=>{
  const view=setup();const selected=view.game.selected;view.hit(outside);
  view.app.emit('pointerdown',finger(view.cards[0]));view.window.emit('pointerup',finger(view.cards[0],1,500));
  view.command(click(view.cards[0],1));assert.equal(view.game.selected,selected);assert.equal(view.activation.last,null);
});

test('cancellation, unexpected lost capture, multi-touch and clear reject delayed ghost clicks',()=>{
  for(const kind of ['pointercancel','lostpointercapture','pinch','clear']){
    const view=setup(),selected=view.game.selected;view.hit(view.cards[0]);view.app.emit('pointerdown',finger(view.cards[0]));
    if(kind==='pinch'){view.app.emit('pointerdown',finger(view.cards[0],2));view.window.emit('pointerup',finger(view.cards[0],2));}
    else if(kind==='clear')view.input.clear();else view.window.emit(kind,finger(view.cards[0]));
    view.window.emit('pointerup',finger(view.cards[0]));view.command(click(view.cards[0],1,{pointerType:'touch'}));
    assert.equal(view.game.selected,selected,kind);assert.equal(view.game.phase,'select',kind);assert.equal(view.activation.last,null,kind);
  }
});

test('draft mutations during a press revalidate tower identity, rank, foundation, round, reserve and reroll state',()=>{
  for(const mutate of [g=>g.round++,g=>g.towers[0].id++,g=>g.towers[0].tier++,g=>g.towers[0].family='mage',g=>g.towers[0].x++,g=>g.draft.rerollsUsed++,g=>g.draft.draws[0].reservedForNextDraft=true]){
    const view=setup(),selected=view.game.selected;view.hit(view.cards[0]);view.app.emit('pointerdown',finger(view.cards[0]));mutate(view.game);
    view.window.emit('pointerup',finger(view.cards[0]));view.command(click(view.cards[0],1));assert.equal(view.game.selected,selected);assert.equal(view.game.phase,'select');
  }
});

test('rerendered card at the same unchanged identity accepts a tap, but a different or disabled card does not',()=>{
  const view=setup();view.app.emit('pointerdown',finger(view.cards[0]));view.cards[0].isConnected=false;const replacement=card(0);view.hit(replacement);
  view.window.emit('pointerup',finger(view.cards[0]));assert.equal(view.game.selected,drawnTower(view.game,0).id);
  for(const target of [card(2),Object.assign(card(1),{disabled:true})]){
    const selected=view.game.selected;view.advance(100);view.app.emit('pointerdown',finger(view.cards[1],2));view.hit(target);view.window.emit('pointerup',finger(view.cards[1],2));assert.equal(view.game.selected,selected);
  }
});

test('keyboard click selects and consumes pending keeper confirmation; mystery selection never reveals RNG',()=>{
  const view=setup();view.tap(0);view.command(click(view.cards[1],0));assert.equal(view.game.selected,drawnTower(view.game,1).id);assert.equal(view.activation.last,null);
  const mystery=setup({placed:false});let rngCalls=0;mystery.game.rng=()=>{rngCalls++;return .5;};mystery.tap(3);
  assert.equal(mystery.game.activeDraw,3);assert.equal(mystery.game.selected,null);assert.equal(mystery.game.towers.length,0);assert.equal(rngCalls,0);
  assert.ok(mystery.game.draft.draws.every(draw=>!draw.placed));
});

test('fresh mouse pointer releases retain their normal pair and right-button releases cannot select',()=>{
  const view=setup(),mouse=(target,id=1,button=0)=>({...finger(target,id),pointerType:'mouse',button});view.hit(view.cards[0]);
  view.app.emit('pointerdown',mouse(view.cards[0]));view.window.emit('pointerup',mouse(view.cards[0]));view.command(click(view.cards[0]));
  view.advance(200);view.app.emit('pointerdown',mouse(view.cards[0],2));view.window.emit('pointerup',mouse(view.cards[0],2));assert.equal(view.game.phase,'ready');
  const fresh=setup(),selected=fresh.game.selected;fresh.hit(fresh.cards[0]);fresh.app.emit('pointerdown',mouse(fresh.cards[0],1,2));fresh.window.emit('pointerup',mouse(fresh.cards[0],1,2));assert.equal(fresh.game.selected,selected);
});

test('touch selection preserves explicit merge foundation and stale merge guards',()=>{
  const view=setup();Object.assign(view.game.towers[0],{family:'soldier',tier:1});Object.assign(view.game.towers[1],{family:'soldier',tier:1});
  view.tap(1);const tower=drawnTower(view.game,1),key=mergeTowerKey(view.game,tower.id);assert.ok(key);
  assert.ok(mergeTowerFromBadge(view.game,tower.id,key));assert.equal(tower.tier,2);assert.equal(tower.state,'active');assert.equal(view.game.towers[0].state,'ruin');
  assert.equal(mergeTowerFromBadge(view.game,tower.id,key),false);assert.equal(tower.tier,2);
});
