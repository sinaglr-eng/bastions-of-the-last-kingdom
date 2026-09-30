import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {currentWarbandInfo,bossHealth,builtTowerCount,warbandTraits} from '../game/core/warband-info.js';
import {defenderGuide,ingredientName} from '../ui/grimoire.js';
import {loadProfile,saveProfile} from '../game/core/save.js';

test('combat guide describes the chosen queued variant and actual wave modifiers',()=>{
  const enemy={name:'Ash dragon',boss:true,hp:100,armor:8,magicImmune:true,resists:{magic:.2}};
  const game={wave:{boss:true,groups:[{type:'dragon',count:1}]},data:{enemies:{dragon:enemy}},combat:{enemies:[],spawnQueue:[{type:'dragon',modifiers:{hp:2,armor:5,resists:{fire:.35},variant:{name:'Pale dragon',magicImmune:false,physicalImmune:true,regen:5}}}]}};
  const [info]=currentWarbandInfo(game);
  assert.equal(info.name,'Pale dragon');assert.equal(info.maxHp,200);assert.equal(info.armor,13);
  assert.ok(info.traits.includes('Immune to physical and piercing damage'));
  assert.ok(!info.traits.some(s=>s.startsWith('Immune to magic')));
  assert.ok(info.traits.includes('35% fire resistance'));
  assert.deepEqual(bossHealth(game),{hp:200,maxHp:200,approaching:true});
  game.combat.spawnQueue=[];game.combat.enemies=[{...enemy,type:'dragon',hp:42.2,maxHp:200,armor:13,dead:false}];
  assert.deepEqual(bossHealth(game),{hp:43,maxHp:200,approaching:false});
  assert.equal(enemy.magicImmune,true,'describing a variant never changes the base enemy');
});

test('built counts exclude unretained candidates and consumed foundations',()=>{
  const towers=[{family:'mage',tier:2,state:'active'},{family:'mage',tier:1,state:'active'},{family:'mage',tier:2,state:'draft'},{family:'mage',tier:2,state:'ruin'},{family:'cleric',tier:2,state:'active'}];
  assert.equal(builtTowerCount(towers,'mage',2),1);assert.equal(builtTowerCount(towers,'mage'),2);
});

test('guide uses own unit codes and advanced ingredient ranks remain explicit',()=>{
  const data=Object.fromEntries(['balance','towers'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
  const html=defenderGuide(data,{});
  assert.ok(!/Diamond|Aquamarine|Emerald|Ruby|Opal|Amethyst|Sapphire|Topaz/.test(html));
  assert.ok(html.includes('UNIT SG'));
  const family=Object.keys(data.towers).find(id=>data.towers[id].advanced);
  assert.equal(ingredientName({family,tier:7},data),`VII · ${data.towers[family].name}`);
  assert.ok(warbandTraits({hasteAura:1.18}).includes('Nearby invaders gain 18% movement speed for 3s every 6s'));
});

test('best score persists while old profiles receive a zero record',()=>{
  const previous=globalThis.localStorage;let raw=JSON.stringify({bestWave:10,muted:true});
  globalThis.localStorage={getItem:()=>raw,setItem:(_,value)=>{raw=value;}};
  try{
    const profile=loadProfile();assert.equal(profile.bestScore,0);assert.equal(profile.bestWave,10);
    profile.bestScore=4600;assert.ok(saveProfile(profile));assert.equal(loadProfile().bestScore,4600);
    raw='{';assert.equal(loadProfile().bestScore,0);
  }finally{globalThis.localStorage=previous;}
});
