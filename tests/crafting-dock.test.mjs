import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipeTreeProgress} from '../game/core/recipes.js';
import {craftingDockModel,craftingDockMarkup,updateCraftingDock,pinnedRecipeHighlightIds,recipePlanningInventory,craftRecipeKey,craftRecipeFromDock} from '../ui/crafting-dock.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';

const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const ranger=data.recipes.find(recipe=>recipe.id==='thornwarden');
const fresh=local=>new Game(local||data,{seed:731});
function retained(game,piece){
  const index=game.towers.length,tower={id:game.nextId++,...piece,state:'active',round:0,x:12+index%12,z:12+Math.floor(index/12),kills:0,cooldown:0,priority:'first',mvpLevel:0};
  assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);return tower;
}
function place(game,pieces){
  for(let index=0;index<pieces.length;index++){
    assert.equal(game.place(3+index,3),true);
    const draw=game.draft.draws[index],tower=game.towers.find(t=>t.id===draw.towerId);
    Object.assign(tower,pieces[index]);Object.assign(draw,pieces[index]);
  }
  return game.draft.draws.filter(draw=>draw.placed).map(draw=>game.towers.find(t=>t.id===draw.towerId));
}
const filler={family:'soldier',tier:2};
function complete(recipe=ranger){
  const game=fresh();place(game,[...recipe.ingredients,filler,filler]);game.select(game.towers[0].id);return game;
}
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,selected:game.selected,activeDraw:game.activeDraw,gold:game.economy.gold,cp:game.commandPoints.value,grid:[...game.grid.occupied],discoveries:[...game.discoveries],resolved:game.draft.resolved});
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);

test('all 38 campaign recipes expose only core-authorized exact pieces, foundations and outcomes',()=>{
  assert.equal(data.recipes.length,38);
  for(const recipe of data.recipes){
    const game=recipe.currentRoundOnly?complete(recipe):fresh();
    if(!recipe.currentRoundOnly)recipe.ingredients.forEach(piece=>retained(game,piece));
    for(const anchor of game.towers.slice(0,3)){
      game.select(anchor.id);
      const before=snapshot(game),model=craftingDockModel(game,{recipeId:recipe.id}),context=model.context;
      assert.ok(context,recipe.id);assert.equal(context.recipe.id,recipe.id);assert.equal(context.anchor,anchor);
      assert.deepEqual(context.pieces,game.recipePieces(recipe,anchor));
      assert.deepEqual(context.rows.map(row=>({family:row.family,tier:row.tier})),recipe.ingredients);
      assert.equal(context.consumed.length,2);assert.equal(context.counts.missing,0);
      assert.equal(context.draftUsed,!!recipe.currentRoundOnly);assert.equal(context.discarded.length,recipe.currentRoundOnly?2:0);
      assert.equal(snapshot(game),before,'model must be a read-only projection');
      assert.match(craftingDockMarkup(game,{[context.family]:'/approved-portrait.png'},{recipeId:recipe.id}),/Recruit champion/);
    }
  }
});

test('retained-only ordinary craft remains enabled before any current placement and preserves the five-slot draft',()=>{
  const game=fresh(),pieces=ranger.ingredients.map(piece=>retained(game,piece)),unrelated=retained(game,filler);game.select(pieces[0].id);
  const context=craftingDockModel(game,{recipeId:ranger.id}).context;
  assert.ok(context);assert.equal(game.phase,'build');assert.equal(context.draftUsed,false);assert.deepEqual(context.discarded,[]);
  assert.equal(craftRecipeFromDock(game,ranger.id,pieces[0].id,context.key),true);
  assert.equal(game.phase,'build');assert.equal(game.draft.resolved,false);assert.equal(game.draft.draws.length,5);assert.ok(game.draft.draws.every(draw=>!draw.placed));
  assert.equal(unrelated.state,'active');assert.equal(pieces[0].family,ranger.id);assert.ok(pieces.slice(1).every(piece=>piece.state==='ruin'));
});

test('mixed draft craft shows the selected foundation, consumed units and only discarded current candidates',()=>{
  const game=fresh(),built=retained(game,ranger.ingredients[0]),unrelated=retained(game,filler);
  place(game,[ranger.ingredients[1],ranger.ingredients[2],filler,filler,filler]);game.select(built.id);
  const model=craftingDockModel(game,{recipeId:ranger.id}),before=snapshot(game),context=model.context;
  assert.deepEqual(context.counts,{built:1,draft:2,missing:0});assert.equal(context.discarded.length,3);assert.ok(context.discarded.every(t=>t.state==='draft'));
  assert.ok(!context.discarded.includes(unrelated));assert.equal(snapshot(game),before);
  const html=craftingDockMarkup(game,{}, {recipeId:ranger.id});assert.match(html,/Result here/);assert.match(html,/Consumed → wall/);assert.match(html,/Unchosen current recruits → walls/);
  assert.equal(craftRecipeFromDock(game,ranger.id,built.id,context.key),true);assert.equal(game.phase,'ready');assert.equal(game.draft.resolved,true);assert.equal(unrelated.state,'active');
  assert.equal(game.towers.filter(t=>t.state==='ruin').length,5);
});

test('context statuses follow exact selected recipe pieces when an unused retained duplicate exists',()=>{
  const game=fresh();retained(game,ranger.ingredients[0]);ranger.ingredients.slice(1).forEach(piece=>retained(game,piece));
  const draws=place(game,[ranger.ingredients[0],filler,filler,filler,filler]);game.select(draws[0].id);
  const context=craftingDockModel(game,{recipeId:ranger.id}).context;
  assert.equal(context.rows[0].towerId,draws[0].id);assert.equal(context.rows[0].state,'draft');assert.deepEqual(context.counts,{built:2,draft:1,missing:0});
});

test('three placed recruits distinguish Built, This round and Missing without leaking two hidden slots',()=>{
  const game=fresh();retained(game,ranger.ingredients[0]);
  const [needed,surplus]=place(game,[ranger.ingredients[1],ranger.ingredients[1],filler]);game.pinned=ranger.id;
  // A latent fixture must remain hidden even if its eventual family happens to match.
  Object.assign(game.draft.draws[3],ranger.ingredients[2]);Object.assign(game.draft.draws[4],ranger.ingredients[2]);
  const before=snapshot(game),model=craftingDockModel(game),html=craftingDockMarkup(game,{}),cards=draftCardsMarkup(game,data,{});
  assert.equal(model.phaseText,'Place recruits · 3/5');assert.equal(model.context,null);assert.deepEqual(model.plan.counts,{built:1,draft:1,missing:1});
  assert.deepEqual([...model.highlightIds],[needed.id]);assert.ok(!model.highlightIds.has(surplus.id));
  assert.match(html,/✓/);assert.match(html,/◆/);assert.match(html,/○/);assert.match(html,/Missing Archer I/);assert.match(html,/Place all five recruits first/);
  assert.equal((cards.match(/class="draw-slot/g)||[]).length,5);assert.equal((cards.match(/mystery-card/g)||[]).length,2);assert.equal((cards.match(/draw-recipe-ingredient/g)||[]).length,1);
  assert.doesNotMatch(cards,/Archer/);assert.equal(snapshot(game),before);
});

test('nested components cover their subtree once and only still-needed allocated candidates are highlighted',()=>{
  const recipe=data.recipes.find(r=>r.id==='highking'),game=fresh();
  const component=retained(game,recipe.ingredients[1]),empty=recipeTreeProgress(recipe,[],data),coveredBranch=empty[1];
  const coveredLeaf=walk([coveredBranch]).find(node=>!node.children.length),neededLeaf=walk([empty[0]]).find(node=>!node.children.length&&!(node.family===coveredLeaf.family&&node.tier===coveredLeaf.tier));
  const candidates=place(game,[{family:coveredLeaf.family,tier:coveredLeaf.tier},{family:neededLeaf.family,tier:neededLeaf.tier},filler]);game.pinned=recipe.id;
  const plan=craftingDockModel(game).plan,branch=plan.tree[1],actual=walk(plan.tree).filter(node=>node.towerId!==null);
  assert.equal(branch.towerId,component.id);assert.equal(branch.ownedCount,1);assert.ok(walk(branch.children).every(node=>node.towerId===null&&node.coveredBy?.family===component.family));
  assert.equal(new Set(actual.map(node=>node.towerId)).size,actual.length);
  assert.ok(plan.highlightIds.has(candidates[1].id));
  const html=craftingDockMarkup(game,{});assert.match(html,/Included in built Frost Knight/);assert.match(html,/Full ingredient chain/);
});

test('duplicate immediate ingredients allocate distinct identities and do not highlight surplus matching recruits',()=>{
  const local=structuredClone(data),recipe=local.recipes.find(r=>r.id===ranger.id);recipe.ingredients=Array.from({length:3},()=>({family:'druid',tier:1}));
  const game=fresh(local);retained(game,{family:'druid',tier:1});const draws=place(game,Array.from({length:4},()=>({family:'druid',tier:1})));game.pinned=recipe.id;
  const model=craftingDockModel(game);assert.deepEqual(model.plan.counts,{built:1,draft:2,missing:0});assert.deepEqual([...model.highlightIds],draws.slice(0,2).map(t=>t.id));
  assert.match(model.reason,/Place all five/);assert.equal(model.context,null);
});

test('secret planning excludes old retained, stray draft, hidden, stale, ruins and inactive reserve identities',()=>{
  const recipe=data.recipes.find(r=>r.currentRoundOnly),game=complete(recipe);game.pinned=recipe.id;
  const old=retained(game,recipe.ingredients[0]);
  const stray={...game.towers[0],id:game.nextId++,state:'draft'};game.towers.push(stray);game.select(game.towers[0].id);
  assert.ok(!recipePlanningInventory(game,recipe).includes(old));assert.ok(!recipePlanningInventory(game,recipe).includes(stray));
  assert.equal(game.reserve(),true);
  const model=craftingDockModel(game);assert.equal(model.context,null);assert.deepEqual(model.plan.counts,{built:0,draft:2,missing:1});assert.ok(!model.highlightIds.has(game.towers[0].id));
  for(const corrupt of [candidateGame=>{candidateGame.draft.draws[1].placed=false;},candidateGame=>{candidateGame.towers[1].round--;},candidateGame=>{candidateGame.towers[1].state='ruin';}]){
    const testGame=complete(recipe);testGame.pinned=recipe.id;
    // Apply the same corrupt state to the real candidate fixture independently.
    corrupt(testGame);assert.ok(!pinnedRecipeHighlightIds(testGame).has(testGame.towers[1].id));
  }
});

test('unrelated reserve preserves a legal secret craft while a returning reserve follows current Game rules',()=>{
  const recipe=data.recipes.find(r=>r.currentRoundOnly),game=complete(recipe);game.select(game.towers[4].id);assert.equal(game.reserve(),true);game.select(game.towers[0].id);
  const context=craftingDockModel(game,{recipeId:recipe.id}).context;assert.ok(context);assert.equal(context.discarded.length,1);assert.ok(context.discarded.every(t=>t.state==='draft'));
  assert.equal(craftRecipeFromDock(game,recipe.id,context.anchor.id,context.key),true);assert.equal(game.towers[4].state,'reserved');
  game.phase='reward';assert.equal(game.nextRound(),true);game.pinned=recipe.id;
  const carried=game.towers[4];assert.equal(carried.state,'draft');assert.equal(carried.round,game.round);assert.equal(game.draft.draws.length,5);
  assert.equal(craftingDockModel(game).context,null);assert.ok(!pinnedRecipeHighlightIds(game).has(carried.id));
});

test('a matching returning reserve stays provisional and its eventual secret eligibility matches Game exactly',()=>{
  const recipe=data.recipes.find(r=>r.currentRoundOnly),game=complete(recipe),carried=game.towers[0];game.select(carried.id);assert.equal(game.reserve(),true);game.select(game.towers[3].id);assert.equal(game.keep(),true);
  game.phase='reward';assert.equal(game.nextRound(),true);game.pinned=recipe.id;
  assert.deepEqual([...pinnedRecipeHighlightIds(game)],[carried.id]);assert.deepEqual(craftingDockModel(game).plan.counts,{built:0,draft:1,missing:2});
  for(const piece of [recipe.ingredients[1],recipe.ingredients[2],filler,filler]){
    const index=game.activeDraw;assert.equal(game.place(3+index,5),true);const tower=game.towers.find(t=>t.id===game.draft.draws[index].towerId);Object.assign(tower,piece);Object.assign(game.draft.draws[index],piece);
  }
  game.select(carried.id);const legal=game.availableRecipes().some(r=>r.id===recipe.id),context=craftingDockModel(game,{recipeId:recipe.id}).context;
  assert.equal(!!context,legal);assert.equal(legal,true);assert.deepEqual(context.pieces,game.recipePieces(recipe,carried));
});

test('previews and pins consume no RNG, currency, inventory or draw commitment',()=>{
  const game=complete(),control=complete(),before=snapshot(game);game.pinned=ranger.id;control.pinned=ranger.id;
  for(let index=0;index<12;index++){
    craftingDockModel(game);craftingDockMarkup(game,{});draftCardsMarkup(game,data,{});pinnedRecipeHighlightIds(game);assert.equal(game.previewRecipe(ranger.id),true);
  }
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());assert.equal(game.commandPoints.value,control.commandPoints.value);
});

test('explicit action tokens reject changed selection, phase, recipe, inventory, reroll, reserve and a different run',()=>{
  const modifications=[game=>{game.selected=game.towers[1].id;},game=>{game.phase='ready';},game=>{game.previewRecipeId='other';},game=>{game.towers[4].tier++;},game=>{game.draft.rerollsUsed++;},game=>{game.draft.draws[3].reservedForNextDraft=true;},game=>{game.towers[1].state='reserved';},game=>{game.data=structuredClone(game.data);game.data.recipes.find(r=>r.id===ranger.id).ingredients[0].tier++;}];
  for(const modify of modifications){
    const game=complete(),id=game.selected,key=craftRecipeKey(game,ranger.id,id);assert.ok(key);modify(game);const before=snapshot(game);
    assert.equal(craftRecipeFromDock(game,ranger.id,id,key),false);assert.equal(snapshot(game),before);
  }
  const game=complete(),key=craftRecipeKey(game,ranger.id);assert.equal(craftRecipeFromDock(complete(),ranger.id,game.selected,key),false);
  assert.equal(craftRecipeFromDock(game,ranger.id,game.selected,null),false);
  const rerolled=complete(),rerollKey=craftRecipeKey(rerolled,ranger.id);assert.equal(rerolled.reroll(),true);assert.equal(craftRecipeFromDock(rerolled,ranger.id,rerolled.selected,rerollKey),false);
});

test('pinned goal stays visible while another recipe is inspected',()=>{
  const game=fresh();game.pinned=ranger.id;const other=data.recipes.find(r=>r.id!==ranger.id&&!r.currentRoundOnly);
  const model=craftingDockModel(game,{recipeId:other.id}),html=craftingDockMarkup(game,{}, {recipeId:other.id});
  assert.equal(model.pinned.recipe.id,ranger.id);assert.equal(model.plan.recipe.id,other.id);assert.match(html,/Pinned · Elven Ranger/);assert.match(html,/Recipe details/);assert.match(html,/Unpin/);
});

test('explicit unavailable recipe inspection never silently changes to another available combination',()=>{
  const game=complete(),other=data.recipes.find(r=>r.id!==ranger.id&&!r.currentRoundOnly),model=craftingDockModel(game,{recipeId:other.id});game.pinned=ranger.id;
  assert.ok(game.availableRecipes().some(recipe=>recipe.id===ranger.id));assert.equal(model.context,null);assert.equal(model.plan.recipe.id,other.id);
  const {host}=panelFixture();updateCraftingDock(host,game,{}, {recipeId:other.id,open:false});
  assert.match(host.querySelector('.crafting-dock-pinned-goal').innerHTML,/Pinned · Elven Ranger/);assert.equal(host.querySelector('.crafting-dock-disclosure').open,false);
  assert.doesNotMatch(host.querySelector('.crafting-dock-actions').innerHTML,/data-action="craft-dock"/);
});

function panelFixture(){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag.toUpperCase();this.attributes=attributes;this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));this.ownerDocument=document;this.parentNode=null;this.children=[];this._html='';this.open=Object.hasOwn(attributes,'open');this.scrollTop=0;this.writes=0;this.hidden=false;this.disabled=Object.hasOwn(attributes,'disabled');}
    matches(selector){if(selector.startsWith('.'))return (this.attributes.class||'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('['))return Object.hasOwn(this.attributes,selector.slice(1,-1));return this.tagName.toLowerCase()===selector;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    get innerHTML(){return this._html;}
    set innerHTML(html){
      this._html=html;this.writes++;this.children.forEach(child=>child.parentNode=null);this.children=[];const stack=[this];
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
  return {host:new Element('aside'),document};
}

test('dock and chain disclosures, scroll and semantic focus survive selection refreshes within the same run',()=>{
  const game=complete(),{host,document}=panelFixture();game.pinned=ranger.id;updateCraftingDock(host,game,{});
  const dock=host.querySelector('.crafting-dock-disclosure'),summary=host.querySelector('.crafting-dock-summary');
  host.querySelector('.crafting-chain').open=true;host.querySelector('.crafting-dock-body').scrollTop=27;
  const recruit=host.querySelectorAll('[data-crafting-focus]').find(element=>element.dataset.craftingFocus===`recruit:${ranger.id}`);recruit.focus();
  game.select(game.towers[1].id);updateCraftingDock(host,game,{});
  assert.equal(host.querySelector('.crafting-dock-disclosure'),dock);assert.equal(host.querySelector('.crafting-chain').open,true);assert.equal(host.querySelector('.crafting-dock-body').scrollTop,27);
  assert.equal(document.activeElement.dataset.craftingFocus,`recruit:${ranger.id}`);assert.deepEqual(document.activeElement.focusOptions,{preventScroll:true});
  dock.open=false;summary.focus();game.select(game.towers[2].id);updateCraftingDock(host,game,{}, {open:true});
  assert.equal(host.querySelector('.crafting-dock-summary'),summary);assert.equal(dock.open,false);assert.equal(document.activeElement,summary);
  assert.ok(host.querySelector('.crafting-dock-actions').querySelectorAll('[data-crafting-focus]').some(element=>element.dataset.craftingFocus===`recruit:${ranger.id}`),'collapsed dock keeps the explicit action outside its disclosure');
  updateCraftingDock(host,complete(),{});assert.notEqual(host.querySelector('.crafting-dock-disclosure'),dock);assert.equal(host.querySelector('.crafting-dock-disclosure').open,true);
});
