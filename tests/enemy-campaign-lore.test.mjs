import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {ENEMY_CAMPAIGN_LORE,enemyCampaignLore} from '../ui/enemy-campaign-lore.js';
import {warbandCardsMarkup} from '../ui/warband-cards.js';

const enemies=campaignEnemies(JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url))));
const waves=campaignWaves(JSON.parse(readFileSync(new URL('../data/waves.json',import.meta.url))));

test('every campaign enemy has its own complete English chronicle while unrelated profiles retain their source description',()=>{
  assert.equal(ENEMY_CAMPAIGN_LORE.length,50);assert.equal(new Set(ENEMY_CAMPAIGN_LORE).size,50);
  for(const [index,wave] of waves.entries())for(const group of wave.groups){const lore=enemyCampaignLore(group.type);assert.equal(lore,ENEMY_CAMPAIGN_LORE[index]);assert.ok(lore.split(/\s+/).length>=32,`Wave ${index+1} has a developed story`);assert.doesNotMatch(lore,/[<>]/);}
  assert.match(enemyCampaignLore('host_01'),/orc slaves/);assert.match(enemyCampaignLore('host_01'),/Bernhard/);assert.match(enemyCampaignLore('host_01'),/disposable/);
  assert.match(enemyCampaignLore('host_49'),/last oath-bound barrier/);assert.match(enemyCampaignLore('host_50'),/Lord Bernhard.*Wyvern Queen/);
  assert.equal(enemyCampaignLore('host_00'),null);assert.equal(enemyCampaignLore('host_51'),null);assert.equal(enemyCampaignLore('other-enemy'),null);
});

test('both enemy presentation modes use the chronicle without changing source lore, names, group counts or effective rules',()=>{
  const before=JSON.stringify({waves,enemies});
  for(const index of [0,9,29,37,49]){
    const wave=waves[index],type=wave.groups[0].type;
    for(const compact of [false,true]){const html=warbandCardsMarkup([wave],enemies,{}, {startWave:index+1,compact,expanded:true});assert.ok(html.includes(enemyCampaignLore(type)));assert.ok(html.includes(enemies[type].name));if(compact)assert.match(html,/<details class="warband-lore"[^>]* open>/);}
  }
  assert.equal(JSON.stringify({waves,enemies}),before);
});
