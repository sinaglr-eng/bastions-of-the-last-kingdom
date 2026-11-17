import test from 'node:test';
import assert from 'node:assert/strict';
import {CommanderVault} from '../ui/commander-vault.js';
import {ARTIFACT_CATALOG as C,ARTIFACTS,rollArtifactChest} from '../game/core/artifacts.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {MILITARY_RANKS,SKILL_LEVEL_GATES,skillGate,isSharedAchievement} from '../game/core/account-progression.js';
import {commanderMasteryAchievements,achievementCatalog} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementData,achievementsView} from '../ui/war-table-view.js';
import {rankSkillUnlocks,rankOverviewMarkup} from '../ui/account-progression.js';
import {bootToMenu} from '../ui/game-boot.js';

test('compact chest receipts retain Dust, equip and inspect actions, with bounded scrolling only for batch rewards',()=>{
 const v=new CommanderVault({player:{online:true,profile:{artifacts:{owned:C.artifacts.map(a=>a.id),equipment:{},counts:[],pity:{},dust:500,highestTier:5}}},render(){},status(){}});
 for(const count of [0,1,2,10]){
  const html=v.rewards({tier:4,dustGained:20,items:C.artifacts.slice(0,count).map(a=>({id:a.id}))});
  assert.match(html,/vault-reveal-compact/);assert.match(html,/\+20 Relic Dust/);assert.equal((html.match(/data-vault-action="equip"/g)||[]).length,count);assert.equal((html.match(/Inspect in backpack/g)||[]).length,count);assert.equal(html.includes('has-many-rewards'),count>2);assert.doesNotMatch(html,/reveal-dust/);
 }
 v.skip=true;assert.doesNotMatch(v.rewards({tier:4,dustGained:20,items:[{id:'LG-01'}]}),/Skip animation/);
});

test('set artifact inspection and close preserve the same Sets page and selected set',async()=>{
 const v=new CommanderVault({player:{online:true,profile:{artifacts:{owned:['CE-01'],equipment:{},counts:[],pity:{},dust:0,highestTier:0}}},render:async()=>{},status(){}});
 v.tab='sets';v.selectedSet='celestial';v.setRarity='legendary';v.focusDetail=()=>{};
 const click=dataset=>v.click({target:{closest:()=>({dataset})}});
 await click({vaultItem:'CE-01'});assert.equal(v.tab,'sets');assert.equal(v.selectedSet,'celestial');assert.equal(v.setRarity,'legendary');
 const html=v.sets();assert.match(html,/vault-set-inspector/);assert.match(html,/Artifact details/);assert.ok(html.includes(ARTIFACTS['CE-01'].description));assert.match(html,/Cumulative set bonuses/);
 await click({vaultAction:'close-detail'});assert.equal(v.tab,'sets');assert.equal(v.selected,null);assert.doesNotMatch(v.sets(),/vault-set-inspector/);
 await click({vaultItem:'CE-01'});await click({vaultInspectSet:'necromancer'});assert.equal(v.selected,null);assert.equal(v.selectedSet,'necromancer');
});

test('every Legendary artifact is reachable in every chest with a Legendary weight, independently of UI previews',()=>{
 const legendary=C.artifacts.filter(a=>a.rarity==='legendary').map(a=>a.id);
 for(const chest of C.chests.filter(c=>c.weights.legendary>0)){
  const missing=new Set(legendary);
  for(let seed=0;seed<25000&&missing.size;seed++)for(const item of rollArtifactChest({},chest.tier,seed).items)missing.delete(item.id);
  assert.deepEqual([...missing],[],`${chest.name} missing Legendary items`);
 }
 const v=new CommanderVault({player:{profile:{artifacts:{owned:[],equipment:{},counts:[],pity:{},dust:0}},online:true},render(){},status(){}});
 for(const chest of C.chests){v.chestTier=chest.tier;assert.doesNotMatch(v.chests(),/Possible rewards|vault-possible|Inspect possible reward/);}
});

test('all skill ranks have consistent purchase gates and appear once at their actual Commander rank',()=>{
 for(const id of Object.keys(GENERAL_SKILLS)){
  assert.equal(SKILL_LEVEL_GATES[id].length,3);
  SKILL_LEVEL_GATES[id].forEach((level,i)=>{assert.ok(rankSkillUnlocks(level).some(s=>s.id===id&&s.rank===i+1));const xp=MILITARY_RANKS[level-1].xp;if(level>1)assert.equal(skillGate(id,i+1,{xpTotal:xp-1}).allowed,false);assert.equal(skillGate(id,i+1,{xpTotal:xp}).allowed,true);});
 }
 for(const id of ['deep-refit','recruitment-focus','field-logistics','quartermaster'])assert.deepEqual(SKILL_LEVEL_GATES[id],[1,3,5]);
 const html=rankOverviewMarkup({xpTotal:0},{expanded:true});assert.match(html,/Available to purchase/);assert.match(html,/Deep Refit <b>II/);assert.match(html,/War Horn <b>III/);
});

test('skill mastery achievements are account-wide, manual, and use the generated skill artwork',()=>{
 const mastery=commanderMasteryAchievements();assert.equal(mastery.length,11);assert.equal(commanderMasteryAchievements({'deep-refit':2}).length,0);assert.equal(commanderMasteryAchievements({'deep-refit':3}).length,1);
 for(const a of mastery){assert.ok(isSharedAchievement(a.id));assert.equal(a.reward,3);assert.equal(a.xp,5);}
 assert.equal(isSharedAchievement('skill-mastery:global:invented'),false);
 const player={online:true,profile:{skills:{'deep-refit':2},grants:[],eligible:[]}};
 let view=achievementData(player,'all');assert.equal(view.catalog.filter(a=>a.kind==='skill-mastery').length,11);assert.equal(view.progress(mastery[0]),2);assert.equal(view.state(mastery[0]),'progress');
 player.profile.eligible=[{...mastery[0],verifiedAt:1}];view=achievementData(player,'all');assert.equal(view.state(mastery[0]),'ready');
 const html=achievementsView(player,{faction:'all',kind:'skill-mastery'});assert.match(html,/skill-deep-refit.webp/);assert.match(html,/data-claim/);
 assert.equal(achievementCatalog(currentFactionData('forge')).find(a=>a.id===mastery[0].id).xp,5);
});

test('the loading cover stays in place through delayed account initialization and menu rendering',async()=>{
 const events=[],doc={body:{removeAttribute:key=>events.push(key)},getElementById:()=>({remove:()=>events.push('removed')})};
 let authenticated,painted;const initialization=new Promise(r=>authenticated=r),menu=new Promise(r=>painted=r);
 const pending=bootToMenu(()=>initialization,()=>{events.push('menu');return menu;},doc);assert.deepEqual(events,[]);
 authenticated();await Promise.resolve();await Promise.resolve();assert.deepEqual(events,['menu']);painted();await pending;assert.deepEqual(events,['menu','data-game-booting','removed']);
 const failed=[];await assert.rejects(bootToMenu(async()=>{throw Error('offline')},()=>failed.push('menu'),{body:{removeAttribute:()=>failed.push('exposed')}}));assert.deepEqual(failed,[]);
});
