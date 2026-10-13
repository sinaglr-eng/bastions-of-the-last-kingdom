import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {campaignTowers,campaignEnemies,campaignWaves,campaignRecipes} from '../game/core/campaign-roster.js';
import {warbandTraitDetails} from '../game/core/warband-info.js';
import {currentWarbandInfo,bossHealth} from '../game/core/warband-info.js';
import {enemyRulesFor} from '../game/core/enemy-rules.js';
import {warbandVariantComparison,warbandCardsMarkup} from '../ui/warband-cards.js';
import {warbandsOverviewMarkup,updateWarbandsOverviewPanel} from '../ui/warbands-overview.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves),recipes:campaignRecipes(raw.recipes)};
const images=Object.fromEntries(Object.keys(data.enemies).map(type=>['enemy:'+type,'/approved/'+type+'.png']));
const options=extra=>({balance:data.balance,data,round:1,phase:'build',waveLimit:50,...extra});

test('all 62 effective campaign profiles reconstruct shared/different stats and abilities exactly as actual spawned enemies',()=>{
  const game=new Game(data,{seed:42}),before=JSON.stringify(data);let profiles=0;
  game.rng=()=>assert.fail('Comparison and explicit spawning never roll variants');
  for(const wave of data.waves)for(const group of wave.groups){
    const definition=data.enemies[group.type],model=warbandVariantComparison(wave,group,definition,{balance:data.balance});
    for(const [index,variant]of (definition.variants||[undefined]).entries()){
      const enemy=game.combat.spawn(group.type,{...wave,...group,variant}),difference=model.differences[index],values={...model.commonStats,...difference.stats};profiles++;
      assert.deepEqual(values,{maxHp:enemy.maxHp,armor:enemy.armor,speed:enemy.speed,flying:!!enemy.flying});
      assert.deepEqual([...model.commonTraits,...difference.traits].sort((a,b)=>a.text.localeCompare(b.text)),warbandTraitDetails(enemy,enemyRulesFor(game)).sort((a,b)=>a.text.localeCompare(b.text)));
    }
  }
  assert.equal(profiles,62);assert.equal(JSON.stringify(data),before);
});

test('wave31 comparison shows shared HP/armor/speed/shields once and keeps mutually exclusive immunity differences side by side',()=>{
  const html=warbandCardsMarkup([data.waves[30]],data.enemies,images,{startWave:31,compact:true,balance:data.balance});
  assert.equal((html.match(/12,443 HP · 20 armor · 2\.05 tiles\/s/g)||[]).length,1);
  assert.equal((html.match(/3 hit-blocking shields/g)||[]).length,1);
  const forms=[...html.matchAll(/<section class="warband-variant"[^>]*>([\s\S]*?)<\/section>/g)].map(match=>match[1]);assert.equal(forms.length,2);
  assert.match(forms[0],/Immune to Magical damage/);assert.doesNotMatch(forms[0],/Immune to Physical damage/);
  assert.match(forms[1],/Immune to Physical damage/);assert.doesNotMatch(forms[1],/Immune to Magical damage/);
  assert.match(html,/Each enemy independently chooses a random variant; the wave may contain a mix/);assert.match(html,/class="warband-variant-columns"/);
});

test('only the still-identical wave29 pair receives identical-gameplay copy; Moon evasion and other real variant differences stay visible',()=>{
  const identical=[];
  for(const [index,wave]of data.waves.entries())for(const group of wave.groups){
    const definition=data.enemies[group.type];if(!definition.variants?.length)continue;
    const model=warbandVariantComparison(wave,group,definition);if(model.identical)identical.push(index+1);
  }
  assert.deepEqual(identical,[29]);
  const html=warbandCardsMarkup([data.waves[28]],data.enemies,images,{startWave:29,compact:true});assert.match(html,/identical gameplay statistics and abilities/);
  assert.equal((html.match(/25% chance to evade Physical, Magical and Holy direct hits/g)||[]).length,1);
  const moon=warbandVariantComparison(data.waves[4],data.waves[4].groups[0],data.enemies.host_05);assert.equal(moon.identical,false);assert.equal(moon.differences[0].traits.length,0);assert.equal(moon.differences[1].traits[0].kind,'evasion');
});

test('explicit variants, group modifier precedence, empty variant arrays and run-local timing overrides match the engine without guessed stats',()=>{
  const local=structuredClone(data);local.balance.enemyRules={disarm:{duration:2,period:7,radius:2.5}};
  const definition=local.enemies.host_38,wave={hp:2,speed:2,armor:3,groups:[{type:'host_38',count:4,hp:3,speed:.5,armor:9,variant:definition.variants[0]}]},group=wave.groups[0],model=warbandVariantComparison(wave,group,definition,{balance:local.balance});
  const game=new Game(local,{seed:2}),enemy=game.combat.spawn(group.type,{...wave,...group});assert.equal(model.variants.length,1);
  assert.equal(model.variants[0].maxHp,enemy.maxHp);assert.equal(model.variants[0].armor,enemy.armor);assert.equal(model.variants[0].speed,enemy.speed);assert.deepEqual(model.variants[0].traitDetails,warbandTraitDetails(enemy,enemyRulesFor(game)));
  assert.ok(model.variants[0].traitDetails.some(trait=>trait.text.includes('within 2.5 tiles for 2s every 7s')));
  const base={...data.enemies.host_01,variants:[]};assert.equal(warbandVariantComparison(data.waves[0],data.waves[0].groups[0],base).variants.length,1);
  const modified={...data.enemies.host_01,variants:[{name:'Light',hp:100},{name:'Heavy',hp:200}]},changes=warbandVariantComparison(data.waves[0],data.waves[0].groups[0],modified);
  assert.equal(changes.commonStats.maxHp,undefined);assert.deepEqual(changes.differences.map(row=>row.stats.maxHp),[100,200]);assert.equal(changes.commonStats.armor,0);
});

function catalogHost(){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag.toLowerCase();this.attributes=attributes;this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));this.children=[];this.parentNode=null;this.listeners=new Map();this.ownerDocument=document;this.open=Object.hasOwn(attributes,'open');this.disabled=Object.hasOwn(attributes,'disabled');this.scrollTop=0;this._value=null;this.writes=0;}
    matches(selector){if(selector[0]==='.')return (this.attributes.class||'').split(/\s+/).includes(selector.slice(1));const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return attr?Object.hasOwn(this.attributes,attr[1])&&(attr[2]===undefined||this.attributes[attr[1]]===attr[2]):this.tagName===selector;}
    closest(selector){for(let node=this;node;node=node.parentNode)if(node.matches(selector))return node;return null;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    get value(){return this._value??this.querySelectorAll('option').find(node=>Object.hasOwn(node.attributes,'selected'))?.attributes.value??this.querySelector('option')?.attributes.value??'';}
    set value(value){this._value=String(value);}
    get innerHTML(){return this.html||'';}
    set innerHTML(html){
      if(this.contains(document.activeElement))document.activeElement=null;this.html=html;this.writes++;this.children=[];const stack=[this];
      for(const token of html.match(/<[^>]+>/g)||[]){
        if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attributes={};
        for(const match of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[match[1]]=match[2]??'';
        const node=new Element(tag,attributes),parent=stack.at(-1);node.parentNode=parent;parent.children.push(node);if(!['img','input','br','hr','meta','link'].includes(tag)&&!token.endsWith('/>'))stack.push(node);
      }
    }
    addEventListener(type,listener){this.listeners.set(type,listener);}
    focus(options){if(!this.disabled){document.activeElement=this;this.focusOptions=options;}}
    scrollIntoView(options){this.scrollOptions=options;}
  }
  const host=new Element('aside');host.click=target=>host.listeners.get('click')({target,preventDefault(){},stopPropagation(){}});return {host,document};
}

test('native quick jump reaches distant normal, boss and completed waves, with exact wave limits and no game/RNG/resource mutation',()=>{
  const {host,document}=catalogHost(),game=new Game(data,{seed:807}),control=new Game(data,{seed:807}),before=JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,data});
  updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({round:31}));
  const select=host.querySelector('[data-warband-jump-select]');select.value='45';host.click(host.querySelector('[data-warband-jump]'));
  let card=host.querySelector('[data-wave="45"]');assert.equal(card.querySelector('.warband-wave-details').open,true);assert.equal(document.activeElement,card.querySelector('summary'));assert.deepEqual(card.scrollOptions,{block:'start',behavior:'auto'});
  host.click(host.querySelectorAll('[data-warband-jump]').find(button=>button.dataset.warbandJump==='50'));card=host.querySelector('[data-wave="50"]');assert.equal(card.querySelector('.warband-wave-details').open,true);assert.match(card.innerHTML||host.innerHTML,/Lord Bernhard/);
  host.querySelector('[data-warband-jump-select]').value='10';host.click(host.querySelector('[data-warband-jump]'));assert.match(host.innerHTML,/Completed wave 10/);assert.equal(host.querySelector('[data-wave="10"]').querySelector('.warband-wave-details').open,true);
  const prior=host.innerHTML;host.querySelector('[data-warband-jump-select]').value='51';host.click(host.querySelector('[data-warband-jump]'));assert.equal(host.innerHTML,prior);
  assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,data}),before);assert.equal(game.rng(),control.rng());
  const capped=catalogHost().host;updateWarbandsOverviewPanel(capped,data.waves,data.enemies,images,options({waveLimit:10}));assert.ok(capped.querySelectorAll('option').every(option=>Number(option.attributes.value)<=10));assert.equal(capped.querySelector('[data-wave="11"]'),null);
});

test('wave detail, lore, quick-jump focus and scroll choices survive live/phase updates without forced expansion',()=>{
  const {host,document}=catalogHost();updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({round:31}));
  host.querySelector('[data-warband-jump-select]').value='45';host.click(host.querySelector('[data-warband-jump]'));
  const detail=host.querySelector('[data-wave="45"]').querySelector('.warband-wave-details');detail.open=false;
  host.querySelector('[data-wave="38"]').querySelector('.warband-wave-details').open=true;host.querySelector('[data-wave="38"]').querySelector('.warband-lore').open=true;
  host.scrollTop=134;host.querySelector('[data-warband-jump-select]').focus();
  updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({round:31,phase:'combat'}));
  assert.equal(host.querySelector('[data-wave="45"]').querySelector('.warband-wave-details').open,false);
  assert.equal(host.querySelector('[data-wave="38"]').querySelector('.warband-wave-details').open,true);assert.equal(host.querySelector('[data-wave="38"]').querySelector('.warband-lore').open,true);
  assert.equal(document.activeElement,host.querySelector('[data-warband-jump-select]'));assert.equal(host.querySelector('[data-warband-jump-select]').value,'45');assert.equal(host.scrollTop,134);
  updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({round:32,phase:'build'}));assert.equal(host.querySelector('[data-wave="38"]').querySelector('.warband-wave-details').open,true);
});

test('catalog defaults to compact closed rows and secondary lore, with 44px navigation and responsive side-by-side comparison',()=>{
  const html=warbandsOverviewMarkup(data.waves,data.enemies,images,options());assert.equal((html.match(/class="warband-wave-details"/g)||[]).length,50);assert.doesNotMatch(html,/<details class="warband-wave-details"[^>]* open/);
  assert.match(html,/data-warband-jump-select/);assert.match(html,/Boss waves/);assert.match(html,/Lore and guidance/);
  const css=readFileSync(new URL('../ui/warbands-overview.css',import.meta.url),'utf8');assert.match(css,/warband-wave-row\{[^}]*min-height:62px/);assert.match(css,/warband-quick-jump>select\{[^}]*min-height:44px/);assert.match(css,/warband-quick-jump>button\{[^}]*min-height:44px/);assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/warband-wave-row:focus-visible/);
  assert.match(css,/warband-card\.compact\{min-height:0/,'Compact rows override the historical 165px catalog card minimum');assert.match(css,/warband-wave-row \.warband-row-portrait\{float:none/,'Compact portraits override historical floated artwork');
});

test('catalog previews preserve seeded independent enemy variants instead of inventing a wave-wide form',()=>{
  const game=new Game(data,{seed:42}),control=new Game(data,{seed:42});game.round=31;control.round=31;
  for(let i=0;i<8;i++)warbandsOverviewMarkup(data.waves,data.enemies,images,options({round:31}));
  game.combat.start(game.wave);control.combat.start(control.wave);assert.deepEqual(game.combat.spawnQueue,control.combat.spawnQueue);
  assert.equal(new Set(game.combat.spawnQueue.map(row=>row.modifiers.variant.name)).size,2);
});

test('a real Sandbox jump after two completed waves labels the current guide and prior rows without invented completion',async()=>{
  const game=new Game(data,{seed:807}),session=new DeveloperConsoleSession(game),{host}=catalogHost();
  await session.activate();session.setResources({lives:1000});
  for(const round of [1,2]){
    assert.equal(session.runWave(round),true);
    for(let frames=0;game.phase==='combat'&&frames<10000;frames++)game.tick(.1);
    assert.equal(game.phase,'build');
  }
  assert.deepEqual(session.results.filter(result=>result.completed).map(result=>result.wave),[1,2]);
  assert.ok(session.results.every(result=>result.leaks>0),'Actual invaders spawn, move and finish the early test waves');
  assert.equal(session.runWave(10),true);assert.equal(game.round,10);assert.equal(game.phase,'combat');
  const before=JSON.stringify({data:game.data,towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,lives:game.lives,gold:game.economy.gold,cp:game.commandPoints.value,results:session.results});
  const renderer=readFileSync(new URL('../game/main.js',import.meta.url),'utf8').match(/function renderWarbandsOverview\(\)\{[\s\S]*?\n\}/)?.[0];assert.ok(renderer);
  runInNewContext(renderer+';renderWarbandsOverview();',{$:id=>id==='warbands-overview'?host:{open:true},game,images,intelligenceModel:null,updateWarbandsOverviewPanel,currentWarbandInfo,bossHealth});
  assert.match(host.innerHTML,/Wave 10 · current and upcoming waves/);assert.match(host.innerHTML,/Sandbox guide · earlier waves may have been skipped/);
  assert.doesNotMatch(host.innerHTML,/9 waves completed|Selected completed wave|Completed wave/);
  assert.match(host.innerHTML,/<option value="3"[^>]*>Wave 3 · Prior wave<\/option>/);
  assert.equal(host.querySelector('[data-wave="9"]'),null);assert.ok(host.querySelector('[data-wave="10"]'));
  host.querySelector('[data-warband-jump-select]').value='3';host.click(host.querySelector('[data-warband-jump]'));
  assert.match(host.innerHTML,/aria-label="Selected prior wave"/);assert.match(host.innerHTML,/Prior wave 3/);assert.doesNotMatch(host.innerHTML,/Completed wave 3/);
  assert.equal(host.querySelector('[data-wave="3"]').querySelector('.warband-wave-details').open,true);
  assert.equal(JSON.stringify({data:game.data,towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,lives:game.lives,gold:game.economy.gold,cp:game.commandPoints.value,results:session.results}),before);
  session.dispose();
});

test('developer final-wave and empty-guide copy avoid campaign completion claims while ordinary campaign labels stay intact',()=>{
  const developer=warbandsOverviewMarkup(data.waves,data.enemies,images,options({round:50,phase:'won',developerMode:true,selectedWave:3}));
  assert.match(developer,/Wave 50 · end of wave guide/);assert.match(developer,/No later waves in this guide/);assert.match(developer,/Prior wave 3/);
  assert.doesNotMatch(developer,/50 waves completed|All waves completed|Completed wave/);
  const ordinary=warbandsOverviewMarkup(data.waves,data.enemies,images,options({round:50,phase:'won',selectedWave:3}));
  assert.match(ordinary,/50 waves completed · 0 waves remaining/);assert.match(ordinary,/All waves completed/);assert.match(ordinary,/Completed wave 3/);assert.doesNotMatch(ordinary,/Sandbox guide|Prior wave/);
  const empty=warbandsOverviewMarkup(data.waves,data.enemies,images,options({waveLimit:0,developerMode:true}));assert.match(empty,/No waves in this guide/);assert.doesNotMatch(empty,/Wave 0/);
});
