import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {TowerDpsTracker,effectiveHitDamage} from '../game/core/tower-dps.js';
import {towerDpsContents} from '../ui/tower-dps.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

function builtGame(family='archer',tier=1){
  const game=new Game(data,{seed:42});
  game.draft.roundForced={family,tier};
  for(let i=0;i<5;i++)assert.equal(game.place(15+i,18),true);
  game.select(game.towers[0].id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
  game.combat.spawnQueue=[{time:1e9,type:'goblin',modifiers:{}}];
  return game;
}
function foe(game,type='goblin',x=15,z=19){
  const enemy=game.combat.spawn(type);Object.assign(enemy,{x,z,speed:0,hp:1e8,maxHp:1e8});return enemy;
}
function attach(game){
  const tracker=new TowerDpsTracker(),hits=[];
  const off=game.on((event,hit)=>{if(event==='wave')tracker.reset(game.combat.elapsed);if(event==='hit'){tracker.recordHit(hit,game.combat.elapsed);hits.push({time:game.combat.elapsed,id:hit.source?.id,type:hit.type,damage:effectiveHitDamage(hit)});}});
  return {tracker,hits,off};
}
function actor(game,family,tier=1,x=15,z=18){
  const tower={id:game.nextId++,family,tier,state:'active',x,z,kills:0,cooldown:999,priority:'first'};game.towers.push(tower);return tower;
}

test('real combat hits count health removed after armor/resistance and overkill, with shields, immunity and anonymous damage excluded',()=>{
  assert.equal(effectiveHitDamage({damage:1000,enemy:{hp:-997}}),3,'Legacy synchronous hit events still cap overkill');
  assert.equal(effectiveHitDamage({damage:1000,effectiveDamage:3,enemy:{get hp(){throw new Error('Explicit applied damage must not sample enemy state');}}}),3);
  const game=builtGame('mage'),source=game.towers[0],{tracker,off}=attach(game),before=JSON.stringify(data);
  try{
    game.combat.elapsed=1;
    const plated=foe(game,'host_14');plated.shields=0;plated.resists={arcane:.4};
    const hp=plated.hp,stats=towerStats(source,data);
    game.combat.damage(plated,stats.damage,stats.type,{...stats,directHit:true},source);
    assert.ok(hp-plated.hp>0&&hp-plated.hp<stats.damage);
    let applied=hp-plated.hp;
    const soldier=actor(game,'soldier',6),physical=towerStats(soldier,data),beforePhysical=plated.hp;
    game.combat.damage(plated,physical.damage,physical.type,{...physical,directHit:true},soldier);
    const physicalApplied=beforePhysical-plated.hp;assert.ok(physicalApplied>0&&physicalApplied<physical.damage,'Actual plated armor reduces the actual soldier strike');
    const low=foe(game);low.hp=3;
    game.combat.damage(low,1000,'pure',{directHit:true},source);assert.equal(low.dead,true);applied+=3;
    const shield=foe(game,'host_14'),immune=foe(game,'host_26');
    assert.equal(game.combat.damage(shield,1000,'arcane',{directHit:true},source),0);
    assert.equal(game.combat.damage(immune,1000,'arcane',{directHit:true},source),0);
    game.combat.damage(foe(game),1000,'pure',{},null);
    const rows=tracker.snapshot(game.towers,game.combat.elapsed),row=rows.find(r=>r.id===source.id);
    close(row.damage,applied);close(row.dps,applied/5);close(rows.find(r=>r.id===soldier.id).damage,physicalApplied);
    close(rows.reduce((sum,r)=>sum+r.damage,0),applied+physicalApplied);assert.equal(JSON.stringify(data),before);
  }finally{off();}
});

test('actual DOT ownership, whole multi-target aura, pure splash and ally-triggered frost reactions credit their real sources',()=>{
  const game=builtGame('druid'),weak=game.towers[0],strong=actor(game,'druid',2),dragon=actor(game,'thunderheart'),mage=actor(game,'mage'),angel=actor(game,'archangel'),king=actor(game,'crownofages');
  for(const t of game.towers)t.cooldown=999;
  const a=foe(game),b=foe(game,'goblin',15.5,19),{tracker,hits,off}=attach(game);
  const hpBefore=a.hp+b.hp,before=JSON.stringify(data);game.rng=()=>0;
  try{
    game.combat.applyEffects(a,towerStats(strong,data),strong);
    game.combat.applyEffects(a,towerStats(weak,data),weak);
    assert.equal(a.statuses.poison.source,strong);
    game.tick(.25);
    game.combat.impact({source:mage,target:a,stats:towerStats(mage,data)});
    game.combat.impact({source:dragon,target:a,stats:towerStats(dragon,data)});
    game.combat.impact({source:king,target:a,stats:towerStats(king,data)});
    const rows=tracker.snapshot(game.towers,game.combat.elapsed),byId=new Map(rows.map(r=>[r.id,r]));
    close(rows.reduce((sum,r)=>sum+r.damage,0),hpBefore-a.hp-b.hp);
    const poison=hits.filter(h=>h.type==='poison');assert.ok(poison.length>0);assert.ok(poison.every(h=>h.id===strong.id));assert.equal(byId.get(weak.id).damage,0);
    const fire=hits.filter(h=>h.type==='fire');assert.equal(fire.length,2);assert.ok(fire.every(h=>h.id===dragon.id));
    const frost=hits.filter(h=>h.type==='frost');assert.ok(frost.length>=10);assert.ok(frost.every(h=>h.id===angel.id));
    assert.ok(hits.some(h=>h.type==='pure'&&h.id===mage.id),'Pure splash belongs to its actual caster');
    assert.ok(hits.some(h=>h.id===dragon.id&&h.damage===data.towers.thunderheart.forkedDamage),'Forked secondary damage belongs to its source');
    const kingStats=towerStats(king,data);
    assert.ok(hits.some(h=>h.id===king.id&&h.type==='physical'&&h.damage===kingStats.damage*kingStats.critMultiplier),'Actual critical damage is counted with its applied multiplier');
    assert.equal(JSON.stringify(data),before);
  }finally{off();}
});

test('a hidden enemy DOT still contributes source damage without retaining its identity or location',()=>{
  const game=builtGame('druid'),source=game.towers[0],enemy=foe(game,'host_18',30,30),{tracker,off}=attach(game);
  source.cooldown=999;game.combat.applyEffects(enemy,towerStats(source,data),source);
  const hp=enemy.hp;assert.equal(game.combat.isRevealed(enemy),false);
  try{
    game.tick(.1);const [row]=tracker.snapshot(game.towers,game.combat.elapsed);
    close(row.damage,hp-enemy.hp);assert.ok(row.damage>0);
    assert.deepEqual(Object.keys(row),['id','family','tier','state','x','z','damage','dps','currentDps','peakDamage']);
    assert.equal(row.x,source.x);assert.equal(row.z,source.z);
    const before=JSON.stringify({source,enemy}),first=JSON.stringify(tracker.snapshot(game.towers,game.combat.elapsed));
    assert.equal(JSON.stringify({source,enemy}),before);
    enemy.x=1;enemy.z=1;enemy.name='changed hidden identity';
    assert.equal(JSON.stringify(tracker.snapshot(game.towers,game.combat.elapsed)),first);
  }finally{off();}
});

test('real 1× and 3× combat have identical current and peak DPS at equal game time; pause and preparation preserve both',()=>{
  function play(speed){
    const game=builtGame('archer',6),enemy=foe(game),{tracker,hits,off}=attach(game);game.speed=speed;
    try{
      for(let frame=0;frame<243;frame++){
        game.tick(.025/speed);
        if(frame===59){
          const elapsed=game.combat.elapsed,frozen=tracker.snapshot(game.towers,elapsed);
          game.paused=true;game.tick(60);assert.equal(game.combat.elapsed,elapsed);assert.deepEqual(tracker.snapshot(game.towers,game.combat.elapsed),frozen);game.paused=false;
        }
      }
      const rows=tracker.snapshot(game.towers,game.combat.elapsed),sum=hits.filter(h=>h.time>game.combat.elapsed-5).reduce((total,h)=>total+h.damage,0);
      close(rows[0].damage,sum);close(rows[0].currentDps,sum/5);close(rows[0].dps,rows[0].peakDamage/5);assert.ok(rows[0].dps>=rows[0].currentDps&&rows[0].dps>0);
      const frozen=structuredClone(rows),elapsed=game.combat.elapsed;game.completeWave();game.tick(60);
      assert.equal(game.combat.elapsed,elapsed);assert.deepEqual(tracker.snapshot(game.towers,elapsed),frozen);
      assert.equal(game.place(15,20),true);const withDraft=tracker.snapshot(game.towers,elapsed);
      assert.equal(withDraft.find(r=>r.state==='draft').dps,0);assert.deepEqual(tracker.snapshot(game.towers,elapsed,{includeDraft:false}),frozen);
      const controls={towers:structuredClone(game.towers),data:JSON.stringify(data),gold:game.economy.gold,draws:structuredClone(game.draft.draws)};
      for(let i=0;i<10;i++)tracker.snapshot(game.towers,elapsed);
      assert.deepEqual(game.towers,controls.towers);assert.equal(JSON.stringify(data),controls.data);assert.equal(game.economy.gold,controls.gold);assert.deepEqual(game.draft.draws,controls.draws);
      tracker.reset();assert.equal(tracker.snapshot(game.towers,0)[0].dps,0);
      return {elapsed,rows:frozen,hp:enemy.hp,hits:hits.map(h=>[h.id,h.type,h.damage])};
    }finally{off();}
  }
  const normal=play(1),fast=play(3);close(fast.elapsed,normal.elapsed);close(fast.hp,normal.hp);assert.deepEqual(fast.rows,normal.rows);assert.deepEqual(fast.hits,normal.hits);
});

test('built peak rows omit ruins/walls and transformed-ID damage while only current DPS expires at the exact five-game-second boundary',()=>{
  const tracker=new TowerDpsTracker(),a={id:4,family:'archer',tier:1,state:'active',x:1,z:1},b={id:2,family:'mage',tier:1,state:'active',x:2,z:2},draft={id:1,family:'soldier',tier:1,state:'draft'},ruin={id:3,family:'archer',tier:1,state:'ruin'},wall={id:5,family:'wall',tier:1,state:'active'};
  const towers=[a,ruin,wall,draft,b],before=JSON.stringify(towers);
  for(const source of [a,b,draft,ruin,wall])tracker.recordHit({source,damage:50,effectiveDamage:50},1);
  let rows=tracker.snapshot(towers,1);assert.deepEqual(rows.map(r=>r.id),[2,4,1]);assert.deepEqual(rows.map(r=>r.dps),[10,10,0]);assert.equal(JSON.stringify(towers),before);
  a.family='druid';assert.equal(tracker.snapshot(towers,1).find(r=>r.id===a.id).dps,0);
  b.tier=2;assert.equal(tracker.snapshot(towers,1).find(r=>r.id===b.id).dps,0);
  tracker.recordHit({source:b,damage:10,effectiveDamage:10},1.5);assert.equal(tracker.snapshot(towers,1.5)[0].dps,2);
  b.tier=1;assert.equal(tracker.snapshot(towers,6)[0].currentDps,0,'Damage exactly five seconds old has expired');assert.equal(tracker.snapshot(towers,6)[0].dps,10);
  b.tier=2;assert.equal(tracker.snapshot(towers,6)[0].dps,2);assert.equal(tracker.snapshot(towers,6.5)[0].currentDps,0);assert.equal(tracker.snapshot(towers,6.5)[0].dps,2);
  tracker.recordHit({source:b,damage:50,effectiveDamage:50},8);assert.equal(tracker.snapshot(towers,0)[0].dps,0,'A new combat clock cannot retain last-wave samples');
  assert.equal(tracker.recordHit({source:b,damage:Infinity,effectiveDamage:5},1),false);assert.equal(tracker.recordHit({source:b,damage:1,effectiveDamage:1},NaN),false);
  assert.equal(tracker.recordHit({source:null,damage:1,effectiveDamage:1},1),false);assert.equal(tracker.snapshot(towers,1)[0].dps,0);
});

test('real hit-event maxima survive entirely between HUD samples, inactivity and preparation, then reset only at the next real wave',()=>{
  const game=builtGame('mage'),source=game.towers[0],other=actor(game,'soldier'),enemy=foe(game),{tracker,off}=attach(game);
  source.cooldown=999;
  try{
    assert.ok(tracker.snapshot(game.towers,0).every(r=>r.dps===0));
    game.tick(.1);game.combat.damage(enemy,20,'pure',{},source);
    game.tick(.1);game.combat.damage(enemy,80,'pure',{},source);
    // No snapshot sees this 100 HP window. By the next HUD sample it is gone.
    for(let i=0;i<60;i++)game.tick(.1);
    game.combat.damage(enemy,50,'pure',{},other);
    let rows=tracker.snapshot(game.towers,game.combat.elapsed);
    assert.equal(rows[0].id,source.id);assert.equal(rows[0].damage,0);assert.equal(rows[0].currentDps,0);
    assert.equal(rows[0].peakDamage,100);assert.equal(rows[0].dps,20);
    assert.equal(rows[1].currentDps,10);assert.equal(rows[1].dps,10,'Peak ordering outranks a larger current reading');
    // A later smaller hit does not lower the peak; another hit can raise it
    // using precisely the current five-second total.
    game.combat.damage(enemy,30,'pure',{},source);
    const smaller=tracker.snapshot(game.towers,game.combat.elapsed).find(r=>r.id===source.id);
    assert.equal(smaller.currentDps,6);assert.equal(smaller.dps,20);
    game.tick(.1);game.combat.damage(enemy,90,'pure',{},source);
    rows=tracker.snapshot(game.towers,game.combat.elapsed);
    assert.equal(rows[0].peakDamage,120);assert.equal(rows[0].dps,24);
    game.completeWave();const completed=tracker.snapshot(game.towers,game.combat.elapsed);game.tick(30);
    assert.deepEqual(tracker.snapshot(game.towers,game.combat.elapsed),completed);
    game.draft.roundForced={family:'archer',tier:1};
    for(let i=0;i<5;i++)assert.equal(game.place(15+i,20),true);
    assert.equal(tracker.snapshot(game.towers,game.combat.elapsed)[0].dps,24);
    game.select(game.roundCandidates[0].tower.id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
    assert.equal(game.combat.elapsed,0);assert.ok(tracker.snapshot(game.towers,0).every(r=>r.dps===0&&r.currentDps===0&&r.peakDamage===0));
  }finally{off();}
});

test('the peak UI names the actual five-game-second maximum and wave, with an accessible selection label and paused state',()=>{
  const tracker=new TowerDpsTracker(),source={id:1,family:'mage',tier:1,state:'active',x:12,z:12};
  tracker.recordHit({source,damage:100,effectiveDamage:100},.1);
  const rows=tracker.snapshot([source],6),html=towerDpsContents(rows,data,{}, {phase:'combat',paused:true,wave:7});
  assert.equal(rows[0].currentDps,0);assert.equal(rows[0].dps,20);
  assert.match(html,/<h2 title="Highest actual DPS over a 5-game-second window in this wave">Peak DPS this wave<\/h2>/);
  assert.match(html,/Wave 7 · Paused/);assert.match(html,/aria-label="Defenders ordered by peak actual DPS this wave"/);
  assert.match(html,/aria-label="Select Mage, rank I, defender 1, 20\.0 peak DPS this wave"/);
  assert.match(html,/<strong class="tower-dps-value">20\.0<\/strong>/);assert.doesNotMatch(html,/Last 5 game seconds/);
  assert.match(towerDpsContents(rows,data,{}, {phase:'build',paused:true,wave:7}),/Wave 7<\/p>/);
  assert.doesNotMatch(towerDpsContents(rows,data,{}, {phase:'build',paused:true,wave:7}),/Paused/);
  assert.match(towerDpsContents([],data,{}, {phase:'build'}),/Measured during combat/);
});
