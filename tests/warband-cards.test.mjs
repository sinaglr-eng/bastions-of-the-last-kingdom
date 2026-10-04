import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatManager} from '../game/core/combat.js';
import {warbandCardsMarkup,upcomingWarbandMarkup} from '../ui/warband-cards.js';
import {warbandTraitDetails} from '../game/core/warband-info.js';

const enemies=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))),waves=JSON.parse(readFileSync(new URL('../data/waves.json',import.meta.url)));
const images=Object.fromEntries(Object.keys(enemies).map(type=>['enemy:'+type,'/assets/geometric/portraits/'+type+'.png']));
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('all 50 actual guide cards preserve portraits/flavor while displaying every configured variant numerical ability visibly',()=>{
  const before=JSON.stringify({enemies,waves,images}),markup=warbandCardsMarkup(waves,enemies,images,{balance:{}});
  assert.equal((markup.match(/<article class="warband-card/g)||[]).length,50);
  for(const wave of waves)for(const group of wave.groups){
    const base=enemies[group.type];
    assert.ok(markup.includes(`src="${images['enemy:'+group.type]}"`));assert.ok(markup.includes(escape(base.appearance)));assert.ok(markup.includes(escape(base.name)));assert.ok(markup.includes(escape(base.threat)));
    if(base.counter)assert.ok(markup.includes(escape(base.counter)));
    const upcoming=upcomingWarbandMarkup(wave,enemies);
    for(const variant of base.variants||[{}])for(const row of warbandTraitDetails({...base,...variant})){
      assert.ok(markup.includes(escape(row.text)),base.name+' guide ability');assert.ok(upcoming.includes(escape(row.text)),base.name+' upcoming ability');
    }
  }
  assert.ok(!markup.includes(' (regenerates)')&&!markup.includes(' (stronger shell)'),'generic variant labels cannot replace actual values');
  assert.equal(JSON.stringify({enemies,waves,images}),before,'rendering guide cards never mutates authoritative data');
});

test('actual wave 17 dread, 12 disarm and 8 proportional regeneration details remain visible in guide and upcoming cards',()=>{
  for(const [index,expected]of [[16,/within 4 tiles lose 35% attack speed/],[11,/within 3 tiles for 5s every 8s/],[7,/Regenerates 5% maximum health\/s \(12\.8 HP\/s\)/]]){
    const wave=waves[index];for(const markup of [warbandCardsMarkup([wave],enemies,images),upcomingWarbandMarkup(wave,enemies)]){
      assert.match(markup,expected);assert.ok(!markup.includes('title='),'numbers are readable text, including on touch devices');
    }
  }
  assert.match(upcomingWarbandMarkup(waves[1],enemies),/52 HP · 1 armor · 2\.21 tiles\/s/);
  assert.match(upcomingWarbandMarkup(waves[2],enemies),/68 HP · 8 armor · 2\.37 tiles\/s/);
});

test('wave38 describes separate real Knifeman and Blood-Leech variants, not a fictional combined cloak/regen invader',()=>{
  const wave=waves[37];
  for(const markup of [warbandCardsMarkup([wave],enemies,images),upcomingWarbandMarkup(wave,enemies)]){
    const sections=[...markup.matchAll(/<section class="warband-variant"[^>]*>([\s\S]*?)<\/section>/g)].map(match=>match[1]);assert.equal(sections.length,2);
    assert.ok(sections[0].includes(escape(enemies.host_38.variants[0].name)));assert.match(sections[0],/Cloaked for 4s, visible for 2s, every 6s/);assert.match(sections[0],/Disarms defenders within 3 tiles for 5s every 8s/);assert.ok(!sections[0].includes('HP/s'));
    assert.ok(sections[1].includes('Blood-Leech Trolls'));assert.match(sections[1],/Regenerates 5% maximum health\/s \(1,568\.45 HP\/s\)/);assert.ok(!sections[1].includes('Cloaked')&&!sections[1].includes('Disarms'));
  }
});

test('guide health/speed/armor/resistance group overrides match actual spawn, and authored card values are escaped',()=>{
  const type='host_08',wave={name:'<Wave & title>',hp:2,speed:2,resists:{fire:.3},groups:[{type,count:2,interval:.6,hp:3,speed:.5,armor:9}]},base=enemies[type];
  const route=[{x:0,z:0},{x:10,z:0}],game={data:{enemies},grid:{route,checkpoints:route},emit(){}},combat=new CombatManager(game),enemy=combat.spawn(type,{...wave,...wave.groups[0]});
  const markup=upcomingWarbandMarkup(wave,enemies);
  assert.ok(markup.includes(enemy.maxHp+' HP'));assert.ok(markup.includes(enemy.armor+' armor'));assert.ok(markup.includes(enemy.speed+' tiles/s'));assert.ok(markup.includes('30% fire resistance'));
  const unsafe={...base,name:'<Name & "quote">',appearance:'<script>art</script>',counter:'<counter>',threat:'<threat>'},custom={...enemies,[type]:unsafe},safe=warbandCardsMarkup([wave],custom,{['enemy:'+type]:'" onerror="bad'});
  for(const field of ['name','appearance','counter','threat'])assert.ok(safe.includes(escape(unsafe[field])));
  assert.ok(!safe.includes('<script>')&&!safe.includes('src="" onerror='));assert.ok(safe.includes('src="&quot; onerror=&quot;bad"'));
  assert.equal(upcomingWarbandMarkup(null,enemies),'');
});

test('variant guide describes independent enemy choices and Zaruun has no inactive second variant',()=>{
  for(const index of [4,14,26,27,28,30,34,35,37,40,49])for(const markup of [warbandCardsMarkup([waves[index]],enemies,images),upcomingWarbandMarkup(waves[index],enemies)]){
    assert.match(markup,/Each enemy independently chooses a random variant; the wave may contain a mix/);
    assert.ok(!/One variant is chosen|This wave rolls either/.test(markup),'The guide never presents a group-wide single roll');
  }
  for(const markup of [warbandCardsMarkup([waves[29]],enemies,images),upcomingWarbandMarkup(waves[29],enemies)]){
    assert.ok(!markup.includes('Variant 2')&&!markup.includes('Moon Clan')&&!markup.includes('random variant'));assert.match(markup,/Zaruun, Lord of Storm Wings/);
    assert.equal((markup.match(/class="warband-variant"/g)||[]).length,1,'Only active normal Zaruun stats are rendered');
  }
  const scrap=upcomingWarbandMarkup(waves[27],enemies),sections=[...scrap.matchAll(/<section class="warband-variant"[^>]*>([\s\S]*?)<\/section>/g)].map(match=>match[1]);
  assert.match(sections[0],/Reactive armor[^]*\+8 armor per direct hit/);assert.ok(!sections[0].includes('Cloaked continuously'));
  assert.match(sections[1],/Cloaked continuously/);assert.ok(!sections[1].includes('Reactive armor'));
});
