import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {selectedEnemyView,selectedEnemyMarkup,updateSelectedEnemyPanel} from '../ui/selected-enemy.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function arena(){const game=new Game(data,{seed:42});game.phase='combat';game.combat.spawnQueue=[{time:1e6,type:'host_01'}];return game;}
const options=game=>({data,combat:game.combat,images:{'enemy:host_28':'actual-enemy-28.png'},paused:game.paused,speed:game.speed});

test('inspection uses the actual variant, modified maximum HP, live HP and individual portrait rather than a configured wave profile',()=>{
  const game=arena(),enemy=game.combat.spawn('host_28',{hp:2.5,armor:7,speed:.5,variant:data.enemies.host_28.variants[1]});
  enemy.hp=enemy.maxHp*.4;
  const view=selectedEnemyView(enemy,options(game)),html=selectedEnemyMarkup(enemy,options(game));
  assert.equal(view.maxHp,data.enemies.host_28.hp*2.5);assert.equal(view.hp,enemy.hp);assert.equal(view.baseArmor,enemy.armor);assert.equal(view.baseSpeed,enemy.speed);
  assert.ok(html.includes(enemy.name));assert.ok(html.includes(`INDIVIDUAL #${enemy.id}`));assert.ok(html.includes('src="actual-enemy-28.png"'));
  assert.ok(html.includes(`aria-valuemax="${enemy.maxHp}"`)&&html.includes(`aria-valuenow="${enemy.hp}"`));assert.ok(html.includes('width:40%'));
  assert.ok(html.includes('Cloaked continuously'));assert.ok(!html.includes('Reactive armor ·'));
  assert.ok(!html.includes('POTENTIAL COMBINATIONS')&&!html.includes('ON THE HORIZON'));
  assert.ok(html.includes('data-action="enemy-inspect-close"'));assert.doesNotMatch(html,/data-action="(?:pause|speed)"/);
  enemy.hp-=1;const changed=selectedEnemyMarkup(enemy,options(game));assert.notEqual(changed,html);assert.ok(changed.includes(`aria-valuenow="${enemy.hp}"`));
});

test('actual alternate immunity and reactive-armor abilities are never mixed together in the individual view',()=>{
  const game=arena();
  const normal=game.combat.spawn('host_28',{variant:data.enemies.host_28.variants[0]}),moon=game.combat.spawn('host_28',{variant:data.enemies.host_28.variants[1]});
  assert.ok(selectedEnemyMarkup(normal,options(game)).includes('Reactive armor · +8 armor'));
  assert.ok(!selectedEnemyMarkup(moon,options(game)).includes('Reactive armor · +8 armor'));
  for(const variant of data.enemies.host_31.variants){
    const enemy=game.combat.spawn('host_31',{variant}),view=selectedEnemyView(enemy,options(game));
    assert.equal(view.magicImmune,!!variant.magicImmune);assert.equal(view.physicalImmune,!!variant.physicalImmune);
    assert.equal(view.traitDetails.some(row=>row.text==='Immune to magic and magical effects'),!!variant.magicImmune);
    assert.equal(view.traitDetails.some(row=>row.text==='Immune to physical and piercing damage'),!!variant.physicalImmune);
  }
});

test('current armor and effective resistance match actual applied damage including reactive stacks, ward and cached shred',()=>{
  const game=arena(),enemy=game.combat.spawn('host_28',{armor:5,resists:{magic:.3,fire:.4}});
  enemy.reactiveStacks=4;enemy.armorShred=7;enemy.ward=.2;enemy.magicShred=.1;
  const view=selectedEnemyView(enemy,options(game));assert.equal(view.reactive,32);assert.equal(view.shred,7);
  const physical=game.combat.damage(enemy,100,'physical',{}),arcane=game.combat.damage(enemy,100,'arcane',{}),fire=game.combat.damage(enemy,100,'fire',{});
  close(physical,100*data.balance.armorConstant/(data.balance.armorConstant+view.armor));
  close(arcane,100*(1-view.resistances.find(row=>row.name==='Magic').value));close(fire,100*(1-view.resistances.find(row=>row.name==='Fire').value));
  enemy.armorShred=999;assert.equal(selectedEnemyView(enemy,options(game)).armor,0,'Actual effective armor has the same zero floor as damage');
});

test('current movement matches actual traveled distance at 1×/3× through rush, allied haste, slow, control and pause, with no guessed pre-tick value',()=>{
  for(const speed of [1,3]){
    const game=arena(),enemy=game.combat.spawn('host_42');game.speed=speed;
    assert.equal(selectedEnemyView(enemy,options(game)).currentSpeed,null);assert.ok(!selectedEnemyMarkup(enemy,options(game)).includes('<dt>Current speed</dt>'));
    const traveled=enemy.traveled;game.tick(.1);const view=selectedEnemyView(enemy,options(game));
    close(enemy.traveled-traveled,view.currentSpeed*.1*speed);assert.equal(view.currentSpeed,enemy.speed*2,'Game speed is not an extra multiplier inside the per-game-second rate');
    enemy.statuses.petrify={time:1};game.tick(.1);assert.equal(selectedEnemyView(enemy,options(game)).currentSpeed,0);
    enemy.currentSpeed=Infinity;assert.equal(selectedEnemyView(enemy,options(game)).currentSpeed,null,'Invalid snapshots must not display an invented current rate');
    const supported=arena();supported.speed=speed;const wolf=supported.combat.spawn('host_19'),drummer=supported.combat.spawn('host_45');
    drummer.x=wolf.x;drummer.z=wolf.z;drummer.speed=0;
    const measuredSpeed=()=>{
      const before=wolf.traveled,clock=supported.combat.elapsed;supported.tick(.05);
      const current=selectedEnemyView(wolf,options(supported)).currentSpeed;
      close(wolf.traveled-before,current*(supported.combat.elapsed-clock));return current;
    };
    const hasted=measuredSpeed();close(hasted,wolf.speed*5*drummer.hasteAura);
    supported.combat.applyEffects(wolf,{slow:.4,slowDuration:3});close(measuredSpeed(),hasted*.6);
    supported.combat.applyEffects(wolf,{freeze:1,freezeDuration:.8});assert.equal(measuredSpeed(),0);
    supported.paused=true;const before=wolf.traveled,freezeTime=wolf.statuses.freeze.time,clock=supported.combat.elapsed;supported.tick(2);
    assert.equal(wolf.traveled,before);assert.equal(wolf.statuses.freeze.time,freezeTime);assert.equal(supported.combat.elapsed,clock);assert.equal(selectedEnemyView(wolf,options(supported)).currentSpeed,0);
  }
});

test('active status durations and healing-block state update with real combat while regeneration descriptions use modified HP',()=>{
  const game=arena(),enemy=game.combat.spawn('host_15',{hp:3});enemy.hp=enemy.maxHp*.5;
  game.combat.applyEffects(enemy,{freeze:1,freezeDuration:.8,slow:.35,slowDuration:2,healingBlockDuration:1.25});game.tick(.1);
  const html=selectedEnemyMarkup(enemy,options(game)),view=selectedEnemyView(enemy,options(game));
  close(view.effects.find(effect=>effect.name==='Healing blocked').time,1.15);assert.ok(html.includes('Healing blocked'));assert.ok(html.includes('35% movement slow'));
  assert.ok(html.includes(`${(enemy.maxHp*.05).toLocaleString('en-US',{maximumFractionDigits:3})} HP/s`));assert.equal(view.currentSpeed,0);
  game.tick(2);const expired=selectedEnemyView(enemy,options(game));assert.equal(expired.effects.length,0);assert.ok(selectedEnemyMarkup(enemy,options(game)).includes('No active status effects'));
});

test('hidden, defeated, removed, stale-clone and postcombat actors cannot render through the panel API',()=>{
  const game=arena(),enemy=game.combat.spawn('host_28',{variant:data.enemies.host_28.variants[1]});
  assert.ok(selectedEnemyMarkup(enemy,options(game)),'Real checkpoint reveal initially permits inspection');
  enemy.x=-100;enemy.z=-100;assert.equal(game.combat.isRevealed(enemy),false);assert.equal(selectedEnemyMarkup(enemy,options(game)),'');
  enemy.cloaked=false;assert.equal(selectedEnemyMarkup({...enemy},options(game)),'','A same-id copy is not the actual live actor');
  enemy.dead=true;assert.equal(selectedEnemyMarkup(enemy,options(game)),'');enemy.dead=false;
  game.combat.enemies=[];assert.equal(selectedEnemyMarkup(enemy,options(game)),'');game.combat.enemies=[enemy];
  game.phase='lost';assert.equal(selectedEnemyMarkup(enemy,options(game)),'');
});

test('health/progress and presentation values stay finite and clamped, positive fractional HP never displays zero, and content is escaped',()=>{
  const game=arena(),enemy=game.combat.spawn('host_01');enemy.hp=.0001;enemy.name='<img src=x onerror="bad"> & "name"';
  enemy.statuses['<script>bad</script>']={time:.5};
  const opts={...options(game),images:{'enemy:host_01':'portrait.png" onerror="bad'}};let html=selectedEnemyMarkup(enemy,opts);
  assert.ok(html.includes('1 / 9 HP'));assert.ok(html.includes('aria-valuenow="0.0001"'));assert.ok(html.includes('&lt;img src=x onerror=&quot;bad&quot;&gt; &amp; &quot;name&quot;'));
  assert.ok(html.includes('src="portrait.png&quot; onerror=&quot;bad"'));assert.ok(html.includes('&lt;script&gt;bad&lt;/script&gt;'));assert.ok(!html.includes('<script>'));
  enemy.hp=999;assert.equal(selectedEnemyView(enemy,opts).healthPercent,100);enemy.hp=-4;assert.equal(selectedEnemyView(enemy,opts).healthPercent,0);
  enemy.hp=NaN;enemy.maxHp=Infinity;enemy.armor=-20;enemy.armorShred=100;enemy.resists={magic:4,fire:4};
  html=selectedEnemyMarkup(enemy,opts);assert.ok(!html.includes('NaN')&&!html.includes('Infinity'));assert.ok(html.includes('width:0%'));assert.equal(selectedEnemyView(enemy,opts).armor,0);
  assert.ok(selectedEnemyView(enemy,opts).resistances.every(row=>row.value===data.balance.maxResistance));
});

test('dynamic refresh caches source markup and preserves sidebar scroll plus the focused command through real value changes',()=>{
  const game=arena(),enemy=game.combat.spawn('host_42'),body={scrollTop:240,scrollLeft:0},document={activeElement:null};
  const panel={writes:0,buttons:[],ownerDocument:document,closest:()=>body,contains(node){return this.buttons.includes(node);},querySelectorAll(){return this.buttons;},
    set innerHTML(value){this.writes++;if(this.contains(document.activeElement))document.activeElement=null;body.scrollTop=0;this.markup=value.replaceAll('/>','></path>');
      this.buttons=[...value.matchAll(/data-action="([^"]+)"/g)].map(match=>({action:match[1],getAttribute(){return this.action;},focus(opts){assert.equal(opts.preventScroll,true);document.activeElement=this;}}));},get innerHTML(){return this.markup;}};
  assert.equal(updateSelectedEnemyPanel(panel,enemy,options(game)),true);assert.equal(panel.writes,1);assert.equal(body.scrollTop,240);
  assert.ok(panel.markup.includes('</path>'),'A real immunity SVG has browser-like serialization different from the source string');
  assert.equal(updateSelectedEnemyPanel(panel,enemy,options(game)),false);assert.equal(panel.writes,1);
  const focused=panel.buttons.find(button=>button.action==='enemy-inspect-close');document.activeElement=focused;body.scrollTop=360;
  enemy.hp-=1;game.paused=true;assert.equal(updateSelectedEnemyPanel(panel,enemy,options(game)),true);
  assert.equal(body.scrollTop,360);assert.notEqual(document.activeElement,focused);assert.equal(document.activeElement.action,'enemy-inspect-close');assert.doesNotMatch(panel.markup,/data-action="(?:pause|speed)"|>Resume<|3× speed/);
  game.paused=false;game.speed=3;assert.equal(updateSelectedEnemyPanel(panel,enemy,options(game)),false,'global controls no longer require rewriting unchanged individual enemy data');assert.equal(body.scrollTop,360);
  enemy.dead=true;assert.equal(updateSelectedEnemyPanel(panel,enemy,options(game)),true);assert.equal(panel.markup,'');
});
