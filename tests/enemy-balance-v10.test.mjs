import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {ENEMY_RULES as R,enemyNumber} from '../game/core/enemy-rules.js';
import {configuredWarbandInfo,currentWarbandInfo,warbandTraitDetails,warbandVariantInfo} from '../game/core/warband-info.js';
import {towerSupportState} from '../game/render/support-effects.js';
import {enemyDefenseDescriptions} from '../game/render/enemy-defense-symbols.js';
import {waveDefenseLegendMarkup,enemyTraitsMarkup} from '../ui/enemy-trait-symbols.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const close=(actual,expected,why)=>assert.ok(Math.abs(actual-expected)<1e-8,`${why}: ${actual} != ${expected}`);
function arena(resistance=0){
  const scenario={...data,towers:{...data.towers,observer:{name:'Observer',advanced:true,damage:0,range:0},protection:{name:'Protection',advanced:true,damage:0,range:0,aura:{range:5,controlResistance:resistance}}}};
  const game=new Game(scenario,{seed:7});game.phase='combat';game.combat.spawnQueue=[{time:9999,type:'host_01'}];
  return game;
}
const observer=(id=1,family='observer')=>({id,family,tier:1,state:'active',x:10,z:10,cooldown:0,kills:0});
function spawn(game,type,variant){const enemy=game.combat.spawn(type,{variant});enemy.x=11;enemy.z=10;enemy.speed=0;return enemy;}
const configured=()=>Object.entries(data.enemies).flatMap(([type,base])=>[
  {type,key:type,base},...(base.variants||[]).map((variant,index)=>({type,key:`${type}.variants[${index}]`,base:{...base,...variant},variant}))
]);

test('all explicit regeneration rates rise exactly 50%, inherited variants actually heal at those rates and healing block still works',()=>{
  const before=JSON.stringify(data),expected={troll:[5,7.5],host_08:[1.024,1.536],host_15:[3.9,5.85],host_21:[10.732,16.098],'host_38.variants[1]':[125.476,188.214]};
  const ownRates=Object.fromEntries(Object.entries(data.enemies).flatMap(([type,base])=>[
    ...(base.regen>0?[[type,base.regen]]:[]),...(base.variants||[]).flatMap((variant,index)=>variant.regen>0?[[`${type}.variants[${index}]`,variant.regen]]:[])
  ]));
  assert.deepEqual(ownRates,Object.fromEntries(Object.entries(expected).map(([key,[old,rate]])=>{close(rate,old*1.5,key);return [key,rate];})));
  const cases=configured().filter(row=>row.base.regen>0);assert.equal(cases.length,7,'two actual Blood Bat variants inherit the rate, and the Blood-Leech variant adds its own');
  for(const row of cases){
    const game=arena(),enemy=spawn(game,row.type,row.variant),initial=enemy.maxHp/2;enemy.hp=initial;
    game.combat.update(.5);close(enemy.hp-initial,row.base.regen*.5,row.key+' effective healing');
    game.combat.applyEffects(enemy,{healingBlockDuration:.5});const blocked=enemy.hp;
    game.combat.update(.25);assert.equal(enemy.hp,blocked,row.key+' healing block');
    game.combat.update(.25);close(enemy.hp-blocked,row.base.regen*.25,row.key+' recovery after block expiry');
    enemy.hp=enemy.maxHp-.01;game.combat.update(1);assert.equal(enemy.hp,enemy.maxHp,row.key+' cap');
    const text=warbandTraitDetails(row.base).find(trait=>trait.kind==='regen').text;
    assert.ok(text.includes(enemyNumber(row.base.regen)+' HP/s'));assert.ok(!/Regenerates 2 HP/.test(text),'1.536 HP/s must not be rounded to2');
  }
  assert.equal(JSON.stringify(data),before,'spawns, healing and descriptions preserve definitions');
});

test('every real disarming enemy uses a 3s staggered 8s window, exact 3-tile range and actual control-resistance shortening',()=>{
  const rows=configured().filter(row=>row.base.disarm);assert.ok(rows.length>=5);
  for(const row of rows)for(const resistance of [0,.5,1]){
    const game=arena(resistance),target=observer(),protector=observer(2,'protection'),enemy=spawn(game,row.type,row.variant);
    game.towers=[target,protector];
    const sample=(phase,range=1,cycle=0,appliedResistance=resistance)=>{
      enemy.x=target.x+range;game.combat.elapsed=(8+phase-enemy.id*.37)%8+8*cycle;game.combat.update(0);
      const expected=range<3&&phase<3*(1-appliedResistance);
      assert.equal(target.disarmed,expected,`${row.key}, phase=${phase}, range=${range}, resistance=${resistance}`);
      assert.equal(!!towerSupportState(target,game.towers,game.data,{combat:game.combat}).byKey.disarm,expected,'visible defender state follows real combat');
    };
    for(const phase of [.01,1.25,1.499,1.501,2.999,3.001,7.999])sample(phase);
    sample(.01,2.999);sample(.01,3);sample(.01,3.001);sample(.01,1,1);
    if(resistance===.5){protector.state='ruin';sample(2,1,0,0);assert.equal(target.disarmed,true,'consuming protection restores the full actual window');}
  }
  assert.deepEqual(R.disarm,{duration:3,period:8,radius:3,phasePerId:.37});
  const game=arena(),target=observer(),enemy=spawn(game,'host_12');game.towers=[target];game.combat.elapsed=2;game.combat.update(0);assert.equal(target.disarmed,true);
  game.paused=true;game.tick(10);assert.equal(game.combat.elapsed,2);assert.equal(target.disarmed,true,'pause does not consume the real window');
  game.paused=false;game.tick(.64);assert.equal(target.disarmed,false,'normal combat resumes and expires the3s phase');
});

test('real wave-start queues/spawns ease only waves 2/3 HP by about 15%, preserving wave 1 and all counts, movement, armor and intervals',()=>{
  const expected=[[9,0,1.3,8,2.4],[52,1,2.21,8,.6],[68,8,2.05+2*.16,9,.6]];
  for(let index=0;index<3;index++){
    const game=arena();game.round=index+1;const wave=game.wave,[hp,armor,speed,count,interval]=expected[index];
    game.combat.start(wave);const queue=[...game.combat.spawnQueue];assert.equal(queue.length,count);
    for(let i=0;i<count;i++){close(queue[i].time,.25+i*interval,'schedule');assert.equal(queue[i].modifiers.hp,1);assert.equal(queue[i].modifiers.speed,undefined);}
    const first=game.combat.spawn(queue[0].type,queue[0].modifiers);assert.equal(first.hp,hp);assert.equal(first.maxHp,hp);assert.equal(first.armor,armor);assert.equal(first.speed,speed);
    const info=currentWarbandInfo(game)[0];assert.equal(info.maxHp,hp);assert.equal(info.armor,armor);assert.equal(info.count,count);
    if(index>0){const old=index===1?61:80;assert.ok(hp/old>=.84&&hp/old<=.86);}
  }
});

test('guide variants and queued/current cards follow actual spawn modifiers and never conflate mutually exclusive abilities',()=>{
  const before=JSON.stringify(data),game=arena();
  for(const [type,base]of Object.entries(data.enemies))for(const variant of base.variants||[{}]){
    const modifiers={hp:1.25,speed:.9,armor:5,resists:{fire:.35},variant},enemy=game.combat.spawn(type,modifiers),info=configuredWarbandInfo({...base,type},modifiers);
    assert.equal(info.name,enemy.name);assert.equal(info.maxHp,enemy.maxHp);assert.equal(info.armor,enemy.armor);assert.equal(info.speed,enemy.speed);assert.equal(info.flying,!!enemy.flying);
    assert.deepEqual(info.traitDetails,warbandTraitDetails(enemy));
    assert.ok(!('x' in info)&&!('z' in info),'guide does not expose concealed locations');
  }
  const leeches=warbandVariantInfo(data.enemies.host_38);
  assert.ok(leeches[0].traits.some(text=>text.includes('Disarms')&&text.includes('3s every 8s')));
  assert.ok(leeches[0].traits.some(text=>text.includes('Cloaked for 4s')));
  assert.ok(!leeches[1].traits.some(text=>/Cloaked|Disarms/.test(text)));assert.ok(leeches[1].traits.some(text=>text.includes('188.214 HP/s')));
  const seals=warbandVariantInfo(data.enemies.host_31);
  assert.ok(seals[0].traits.includes('Immune to magic and magical effects'));assert.ok(!seals[0].traits.includes('Immune to physical and piercing damage'));
  assert.ok(seals[1].traits.includes('Immune to physical and piercing damage'));assert.ok(!seals[1].traits.includes('Immune to magic and magical effects'));
  const pending={wave:{hp:2,groups:[{type:'host_15',count:2,hp:3,speed:.5,armor:9}]},data,combat:{enemies:[],spawnQueue:[]}};
  const info=currentWarbandInfo(pending)[0];assert.equal(info.maxHp,data.enemies.host_15.hp*3);assert.equal(info.speed,data.enemies.host_15.speed*.5);assert.equal(info.armor,data.enemies.host_15.armor+9,'group overrides wave exactly as combat.start');
  assert.equal(JSON.stringify(data),before);
});

test('all 50 base/variant legends visibly include numerical rules and ability text rather than tooltip-only numbers',()=>{
  for(const wave of data.waves){
    const base=data.enemies[wave.groups[0].type];
    for(const variant of base.variants||[{}]){
      const enemy={...base,...variant},traits=warbandTraitDetails(enemy),markup=waveDefenseLegendMarkup(enemy),selected=enemyTraitsMarkup(traits);
      for(const trait of traits){
        const escaped=trait.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        assert.ok(markup.includes(escaped),wave.name+' visible configured detail');assert.ok(selected.includes(escaped));
      }
      assert.ok(!markup.includes('title='),'numeric detail must be visible');
    }
  }
  assert.match(waveDefenseLegendMarkup(data.enemies.host_17),/within 4 tiles lose 35% attack speed/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_12),/within 3 tiles for 3s every 8s/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_08),/1\.536 HP\/s/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_14),/3 hit-blocking shields[^]*every 8s/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_24),/maximum 12 stacks \(36 armor\)[^]*0\.7 stacks\/s/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_32),/12% maximum health every 8s/);
  assert.match(waveDefenseLegendMarkup(data.enemies.host_45),/within 3\.5 tiles gain 18%[^]*3s every 6s/);
  assert.match(waveDefenseLegendMarkup({...data.enemies.host_38,...data.enemies.host_38.variants[0]}),/Cloaked for 4s, visible for 2s, every 6s/);
  assert.ok(waveDefenseLegendMarkup(data.enemies.host_16).includes('Magic immunity')&&waveDefenseLegendMarkup(data.enemies.host_16).includes('16.8% magic resistance'),'immunity does not hide the configured resistance');
  assert.equal(waveDefenseLegendMarkup({armor:999}),'','ordinary armor does not gain an invented special ability');
  assert.ok(enemyDefenseDescriptions(data.enemies.host_08).find(row=>row.kind==='regen').detail.startsWith('1.536 HP/s'));
});

test('numeric shields, cloak, recharge, blink, rush and dread details use the same effective combat rules',()=>{
  const game=arena(),mirror=spawn(game,'host_14'),cloak=spawn(game,'host_38',data.enemies.host_38.variants[0]),healer=spawn(game,'host_32'),blinker=spawn(game,'host_37'),runner=spawn(game,'host_19'),dread=spawn(game,'host_17'),target=observer();game.towers=[target];
  healer.hp=healer.maxHp/2;
  for(let hit=0;hit<3;hit++)assert.equal(game.combat.damage(mirror,10,'physical',{directHit:true}),0);
  assert.equal(mirror.shields,0);game.combat.update(3.999);assert.equal(mirror.shields,0);assert.equal(cloak.cloaked,true);
  game.combat.update(.002);assert.equal(cloak.cloaked,false);
  game.combat.update(1.998);assert.equal(blinker.traveled,0);game.combat.update(.002);assert.equal(cloak.cloaked,true);close(blinker.traveled,3,'actual6s blink');
  assert.equal(healer.hp,healer.maxHp/2);game.combat.update(1.998);assert.equal(mirror.shields,0);game.combat.update(.002);assert.equal(mirror.shields,3);close(healer.hp,healer.maxHp*.62,'actual8s recharge');
  const movement=arena(),rush=spawn(movement,'host_19');rush.speed=data.enemies.host_19.speed;
  movement.combat.update(1);close(rush.traveled,rush.speed*1.7,'rush first2s');const traveled=rush.traveled;movement.combat.elapsed=2;movement.combat.update(1);close(rush.traveled-traveled,rush.speed,'ordinary speed after2s');
  const slowed=arena(),guard={...observer(),family:'archer',cooldown:100},aura=spawn(slowed,'host_17');slowed.towers=[guard];slowed.combat.update(.1);close(guard.cooldown,100-.1*.65,'35% dread');
  aura.x=14;guard.cooldown=100;slowed.combat.update(.1);close(guard.cooldown,99.9,'strict4tile outside dread');
});
