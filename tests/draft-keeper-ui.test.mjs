import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DraftCardActivation,drawnTower,eligibleDrawKeeper,keepDrawKeeper} from '../ui/draft-input.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function gameWithFive(){
  const game=new Game(data,{seed:42});
  for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);
  return game;
}
const pointer=(type='mouse',x=100,y=100)=>({pointerType:type,button:0,clientX:x,clientY:y});

test('mouse double-click and touch double-tap select first, then keep that exact candidate once',()=>{
  for(const type of ['mouse','touch']){
    const game=gameWithFive();let now=1000;const input=new DraftCardActivation(()=>now);
    assert.equal(input.activate(game,0,pointer(type)),false);
    assert.equal(game.selected,drawnTower(game,0).id);assert.equal(game.phase,'select');
    now+=200;assert.equal(input.activate(game,0,pointer(type,104,102)),true);
    assert.equal(game.phase,'ready');assert.equal(game.towers.filter(tower=>tower.state==='active').length,1);
    assert.equal(game.towers.filter(tower=>tower.state==='ruin').length,4);assert.equal(game.grid.occupied.size,5);
    now+=100;assert.equal(input.activate(game,0,pointer(type)),false,'the completed pair cannot keep again');
  }
});

test('changing cards, keyboard selection and mixed pointers cannot confirm a previous click',()=>{
  const game=gameWithFive();let now=1000;const input=new DraftCardActivation(()=>now);
  input.activate(game,0,pointer());now+=100;assert.equal(input.activate(game,1,pointer()),false);
  assert.equal(game.selected,drawnTower(game,1).id);
  now+=100;assert.equal(input.activate(game,1),false,'keyboard selection never forms a pointer pair');
  now+=100;assert.equal(input.activate(game,1,pointer()),false);
  now+=100;assert.equal(input.activate(game,1,pointer('touch')),false);
  assert.equal(game.phase,'select');
  now+=100;assert.equal(input.activate(game,1,pointer('touch')),true);
});

test('late taps, distant releases and interrupted gestures require a fresh pair',()=>{
  const game=gameWithFive();let now=1000;const input=new DraftCardActivation(()=>now);
  input.activate(game,0,pointer('touch'));now+=451;assert.equal(input.activate(game,0,pointer('touch')),false);
  now+=100;assert.equal(input.activate(game,0,pointer('touch',130)),false);
  input.clear();now+=100;assert.equal(input.activate(game,0,pointer('touch',130)),false);
  now+=100;assert.equal(input.activate(game,0,pointer('touch',130)),true);
});

test('adjacent Keep controls reject stale identity, hidden draws, old rounds and non-draft towers',()=>{
  const game=gameWithFive(),tower=drawnTower(game,0),id=tower.id;game.select(id);
  assert.equal(keepDrawKeeper(game,0,id+1),false);
  game.selected=null;assert.equal(keepDrawKeeper(game,0,id),false);game.select(id);
  game.draft.draws[0].placed=false;assert.equal(keepDrawKeeper(game,0,id),false);game.draft.draws[0].placed=true;
  tower.round=0;assert.equal(eligibleDrawKeeper(game,0,id),false);tower.round=game.round;
  for(const state of ['active','ruin']){tower.state=state;assert.equal(keepDrawKeeper(game,0,id),false);}
  tower.state='draft';
  for(const phase of ['build','ready','combat','won','lost']){game.phase=phase;assert.equal(keepDrawKeeper(game,0,id),false);}
  game.phase='select';assert.equal(keepDrawKeeper(game,0,id),true);
  assert.equal(drawnTower(game,-1),null);assert.equal(drawnTower(game,1.5),null);
});

test('five rendered cards have one adjacent Keep control and never contain nested buttons',()=>{
  const game=gameWithFive();game.select(drawnTower(game,1).id);
  const html=draftCardsMarkup(game,data,{});
  assert.equal((html.match(/class="draw-slot/g)||[]).length,5);
  assert.equal((html.match(/data-action="draw"/g)||[]).length,5);
  assert.equal((html.match(/data-action="keep-draw"/g)||[]).length,1);
  assert.match(html,/data-action="keep-draw" data-index="1"/);
  let open=false;
  for(const tag of html.matchAll(/<button\b[^>]*>|<\/button>/g)){
    if(tag[0].startsWith('</')){assert.equal(open,true);open=false;}
    else{assert.equal(open,false,'interactive cards and Keep must be sibling buttons');open=true;}
  }
  assert.equal(open,false);
  game.keep();assert.doesNotMatch(draftCardsMarkup(game,data,{}),/data-action="keep-draw"/);
});

test('unplaced cards expose no family or rank and cannot show a Keep action',()=>{
  const game=new Game(data,{seed:1});game.draft.draws[0].family='highking';game.draft.draws[0].tier=6;
  const html=draftCardsMarkup(game,data,{});
  assert.equal((html.match(/Unrevealed defender\. Build/g)||[]).length,5);
  assert.doesNotMatch(html,/Kingslayer|VI|keep-draw|<img/);
  assert.equal(keepDrawKeeper(game,0),false);
});
