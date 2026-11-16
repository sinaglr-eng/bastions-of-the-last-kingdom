import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun} from '../game/core/run-state.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {MILITARY_RANKS,SKILL_LEVEL_GATES,skillGate} from '../game/core/account-progression.js';
import {generalPageMarkup,skillPurchaseState,skillRankMarkup,skillEffect} from '../ui/general-page.js';
import {generalView,warArt} from '../ui/war-table-view.js';
import {generalCommandState,generalControlsMarkup,promotionPreviewMarkup,updateGeneralControls} from '../ui/general-controls.js';
import {progressionArtwork} from '../ui/progression-art.js';
import {defenderEffectiveStats,defenderEffectiveStatsMarkup} from '../ui/defender-effective-stats.js';

const data=currentFactionData('crown'),newIds=['field-promotion','decisive-strike','fortified-keep','extended-range'];
test('every new skill rank uses the shared actual military gate even when the account has enough medals',()=>{
 assert.deepEqual(newIds.map(id=>SKILL_LEVEL_GATES[id]),[[7,10,14],[9,13,15],[2,6,11],[6,10,13]]);
 for(const id of newIds)for(let level=0;level<3;level++){
  const required=MILITARY_RANKS[SKILL_LEVEL_GATES[id][level]-1],p={xpTotal:required.xp-1,balance:100,skills:{[id]:level},equipped:[]};
  const state=skillPurchaseState(p,id);assert.equal(state.state,'rank-locked');assert.equal(state.canBuy,false);assert.equal(state.gate.allowed,skillGate(id,level+1,p).allowed);assert.match(state.reason,new RegExp(required.name));
  for(const html of [generalView(p,true,{selected:id}),generalPageMarkup(p)]){assert.match(html,new RegExp(`data-buy="${id}"[^>]*disabled`));assert.doesNotMatch(html,/0 more medals needed/);}
  p.xpTotal=required.xp;assert.equal(skillPurchaseState(p,id).canBuy,true,'The exact inclusive boundary unlocks the next purchase');
 }
});

test('rank requirements, current account, medal shortage, ownership and max ranks remain separate',()=>{
 for(const id of newIds){
  const p={xpTotal:1000,balance:0,skills:{},equipped:[]},html=skillRankMarkup(id,p);
  assert.equal((html.match(/data-skill-rank=/g)||[]).length,3);assert.equal((html.match(/Your account: King · Level 15/g)||[]).length,3);
  for(const level of SKILL_LEVEL_GATES[id])assert.ok(html.includes(`Requires ${MILITARY_RANKS[level-1].name} · Level ${level}`));
  assert.equal(skillPurchaseState(p,id).reason,'5 more medals needed');p.balance=5;assert.equal(skillPurchaseState(p,id).state,'available');
  p.skills[id]=3;p.equipped=[id];p.xpTotal=0;const original=JSON.stringify(p);assert.equal(skillPurchaseState(p,id).state,'max');const view=generalView(p,true,{selected:id});assert.match(view,/Fully upgraded/);assert.match(view,/Owned rank III · Equipped/);assert.match(view,/Permanently owned/);assert.equal(JSON.stringify(p),original,'Rendering never resets owned ranks or equipment');
 }
 const available=generalView({xpTotal:1000,balance:100,skills:{},equipped:[]},true,{selected:'field-promotion'});assert.match(available,/value="field-promotion"[^>]*>Buy to equip<\/label>/);assert.match(available,/class="commander-purchase-badge" data-state="available">Available to buy/);
 const locked=generalView({xpTotal:0,balance:100,skills:{},equipped:[]},true,{selected:'field-promotion'});assert.match(locked,/value="field-promotion"[^>]*>Rank locked<\/label>/);
 const ownedNextLocked=generalView({xpTotal:0,balance:100,skills:{'field-promotion':1},equipped:[]},true,{selected:'field-promotion'});assert.match(ownedNextLocked,/value="field-promotion"[^>]*>Equip<\/label>/);assert.match(ownedNextLocked,/Next rank locked/);const ownedClass=ownedNextLocked.match(/<article class="([^"]*war-skill[^"]*)" data-purchase-state="rank-locked"><button[^>]*data-select-skill="field-promotion"/)?.[1];assert.ok(ownedClass&&!ownedClass.includes('is-locked'),'Owned art keeps its owned presentation when the next upgrade is rank locked');
 const legacy={xpTotal:0,balance:100,skills:{'war-horn':1},equipped:['war-horn'],permanentUnlocks:{'war-horn':1}};assert.equal(skillGate('war-horn',1,legacy).allowed,true);assert.equal(skillPurchaseState(legacy,'war-horn').canBuy,false);assert.match(generalView(legacy,true,{selected:'war-horn'}),/Owned rank I · Equipped/);
});

test('all four new painterly illustrations use distinct shared raster paths and preserve original skill artwork',()=>{
 const icons=newIds.map(id=>progressionArtwork(id));assert.equal(new Set(icons).size,4);
 for(const [i,src]of icons.entries()){assert.equal(src,`/assets/ui/war-table/${newIds[i]}.webp`);assert.equal(warArt(newIds[i]),src);const bytes=fs.readFileSync(new URL('../public'+src,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.ok(bytes.length>10000,'Runtime artwork is the full painted raster, not a tiny placeholder');}
 assert.match(progressionArtwork('war-horn'),/war-horn\.webp$/);
});

test('promotion previews only the selected recruit and each one-click command upgrades just that target',()=>{
 const g=new Game(data,{loadout:{'field-promotion':2}}),unplaced=generalControlsMarkup(g);assert.match(unplaced,/Place all five, then select the recruit/);assert.doesNotMatch(unplaced,/data-promotion-tower="null"/);g.draft.forced={family:'archer',tier:5};g.draft.roll(0);
 for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.ok(g.place(x,z));
 const first=g.towers.find(t=>t.id===g.draft.draws[0].towerId),second=g.towers.find(t=>t.id===g.draft.draws[1].towerId);first.tier=4;g.draft.draws[0].tier=4;second.tier=3;g.draft.draws[1].tier=3;g.commandPoints.value=6;
 assert.equal(generalCommandState(g)[0].disabled,true,'The selected capped rank-V recruit stays blocked even when another candidate is eligible');assert.match(generalControlsMarkup(g),/Rank V is the limit/);
 g.select(first.id);const before=JSON.stringify(serializeRun(g)),row=generalCommandState(g)[0];assert.equal(row.action,'general-promotion');assert.equal(row.towerId,first.id);assert.equal(row.disabled,false);assert.equal(JSON.stringify(serializeRun(g)),before);
 const html=generalControlsMarkup(g);assert.equal((html.match(/data-promotion-tower=/g)||[]).length,1);assert.match(html,new RegExp(`data-promotion-tower="${first.id}"`));assert.match(html,/Only this recruit gains one rank/);assert.match(html,/Promote selected · 3 CP/);assert.doesNotMatch(html,/Promote all five/);assert.match(html,/2 \/ 2 uses remaining/);
 assert.ok(g.activateGeneral('field-promotion',first.id));assert.equal(first.tier,5);assert.equal(second.tier,3);assert.equal(g.commandPoints.value,3);assert.equal(generalCommandState(g)[0].disabled,true);assert.match(generalCommandState(g)[0].detail,/1 \/ 2/);
 g.select(second.id);assert.equal(generalCommandState(g)[0].disabled,false);assert.ok(g.activateGeneral('field-promotion',second.id));assert.equal(second.tier,4);assert.equal(first.tier,5);assert.equal(g.commandPoints.value,0);assert.match(generalCommandState(g)[0].detail,/0 \/ 2/);
 assert.equal(generalCommandState(g)[0].showPreview,true);g.keep();assert.equal(generalCommandState(g)[0].showPreview,false,'Resolved drafts hide the selected promotion preview');
 assert.match(promotionPreviewMarkup([]),/Select a current recruit/);
 const main=fs.readFileSync(new URL('../game/main.js',import.meta.url),'utf8');assert.match(main,/targetId===game.selected\)game.activateGeneral\('field-promotion',targetId\)/);
});

test('Extended Range commands show gold and wave scope, stay active through pause, and reopen next wave',()=>{
 for(let level=1;level<=3;level++){
  const g=new Game(data,{loadout:{'extended-range':level}});let row=generalCommandState(g)[0];assert.equal(row.action,'general-range');assert.equal(row.disabled,true);assert.match(row.label,/combat/);
  for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.ok(g.place(x,z));assert.ok(g.keep());assert.ok(g.startCombat());g.commandPoints.value=0;g.economy.gold=199;
  row=generalCommandState(g)[0];assert.equal(row.disabled,true);assert.equal(row.label,'Need 200 gold.');g.economy.gold=200;const before=JSON.stringify(serializeRun(g));row=generalCommandState(g)[0];assert.equal(row.disabled,false);assert.equal(row.label,'Extend all ranges · 200 gold');assert.match(row.detail,/Current wave only · 200 gold · 0 CP/);assert.match(generalControlsMarkup(g),/data-general-gold>200/);assert.equal(JSON.stringify(serializeRun(g)),before);
  assert.ok(g.activateGeneral('extended-range'));assert.equal(g.economy.gold,0);assert.equal(g.commandPoints.value,0);row=generalCommandState(g)[0];assert.equal(row.disabled,true);assert.equal(row.waveActive,true);assert.equal(row.label,`Active for wave 1 · +${GENERAL_SKILLS['extended-range'].values[level-1]} ${level===1?'tile':'tiles'}`);assert.match(generalControlsMarkup(g),/general-command-skill is-active/);
  g.paused=true;assert.equal(generalCommandState(g)[0].waveActive,true);g.completeWave();assert.equal(generalCommandState(g)[0].waveActive,false);assert.equal(generalCommandState(g)[0].disabled,true);
  for(const [x,z]of [[17,17],[19,17],[17,19],[19,19],[16,18]])assert.ok(g.place(x,z));assert.ok(g.keep());assert.ok(g.startCombat());g.economy.gold=200;assert.equal(generalCommandState(g)[0].disabled,false,'A fresh combat wave has a fresh gold purchase');
 }
 const main=fs.readFileSync(new URL('../game/main.js',import.meta.url),'utf8');assert.match(main,/action==='general-range'\)\{game.activateGeneral\('extended-range'\)/);
});

test('actual main command handler rejects a stale promotion target and dispatches the gold ability',()=>{
 const source=fs.readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),prefix=source.slice(source.indexOf('function handleCommand(e){'),source.indexOf("  if(action==='general-strike-prepare')"));
 const g=new Game(data,{loadout:{'field-promotion':2,'extended-range':2}});g.draft.forced={family:'archer',tier:2};g.draft.roll(0);for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.ok(g.place(x,z));
 const first=g.towers.find(t=>t.id===g.draft.draws[0].towerId),second=g.towers.find(t=>t.id===g.draft.draws[1].towerId);g.commandPoints.value=6;
 const handle=runInNewContext(prefix+'\n}\nhandleCommand',{game:g,audio:{unlock(){}},mainMenu:{visible:false}}),click=(action,towerId)=>handle({target:{closest:()=>({disabled:false,dataset:{action,towerId:String(towerId)}})}});
 g.select(second.id);click('general-promotion',first.id);assert.equal(first.tier,2);assert.equal(second.tier,2);assert.equal(g.commandPoints.value,6,'A stale rendered target cannot spend CP');
 click('general-promotion',second.id);assert.equal(second.tier,3);assert.equal(first.tier,2);assert.equal(g.commandPoints.value,3);
 assert.ok(g.keep());assert.ok(g.startCombat());g.economy.gold=200;click('general-range');assert.equal(g.economy.gold,0);assert.equal(g.commandPoints.value,3);assert.equal(g.general.rangeBonus,1.5);
});

test('inspected attack range separates the wave commander bonus from the unchanged support aura',()=>{
 const g=new Game(data,{loadout:{'extended-range':2}}),supportFamily=Object.entries(data.towers).find(([,u])=>u.aura?.rangeBonus>0)?.[0];assert.ok(supportFamily);
 const tower={id:1,family:'archer',tier:2,state:'active',x:12,z:12,mvpLevel:0},support={id:2,family:supportFamily,tier:1,state:'active',x:12,z:13,mvpLevel:0};g.towers.push(tower,support);g.phase='combat';g.economy.gold=200;
 const before=defenderEffectiveStats(g,tower);assert.ok(before.rangeParts.some(part=>part.key==='range-aura'));assert.ok(g.activateGeneral('extended-range'));const result=defenderEffectiveStats(g,tower),html=defenderEffectiveStatsMarkup(g,tower);
 assert.equal(result.range-before.range,1.5);assert.equal(result.rangeParts.find(part=>part.key==='commander-range').value,1.5);assert.equal(result.rangeParts.find(part=>part.key==='range-aura').value,before.rangeParts[0].value);assert.equal(result.base.range+result.rangeParts.reduce((total,part)=>total+part.value,0),result.range);
 assert.match(html,/data-contribution="range-aura"><dt>Range aura/);assert.match(html,/data-contribution="commander-range"><dt>Extended Range · current wave/);assert.doesNotMatch(defenderEffectiveStatsMarkup(g,tower,{view:{...tower,tier:3}}),/commander-range|current wave/);
 g.phase='ready';assert.equal(defenderEffectiveStats(g,tower).range,before.range);assert.doesNotMatch(defenderEffectiveStatsMarkup(g,tower),/commander-range/);
});

test('Berserker range reduction remains explicit before the flat Commander bonus and all displayed parts reconcile',()=>{
 const g=new Game(currentFactionData('forge'),{loadout:{'extended-range':2}});g.phase='combat';g.economy.gold=200;
 const tower={id:1,family:'dw_ironwarden',tier:1,state:'active',x:18,z:18,factionNow:10,mvpLevel:0};g.towers.push(tower);
 const before=defenderEffectiveStats(g,tower);assert.ok(Math.abs(before.range-3*.8)<1e-9);assert.ok(g.activateGeneral('extended-range'));let result=defenderEffectiveStats(g,tower);
 assert.ok(Math.abs(result.range-(3*.8+1.5))<1e-9,'The existing own reduction is applied first; Commander adds a flat1.5 tiles afterward');
 assert.ok(Math.abs(result.rangeParts.find(part=>part.key==='own-range').value-(-.6))<1e-9);assert.equal(result.rangeParts.find(part=>part.key==='commander-range').value,1.5);assert.ok(!result.rangeParts.some(part=>part.key==='range-aura'));
 assert.ok(Math.abs(result.base.range+result.rangeParts.reduce((total,part)=>total+part.value,0)-result.range)<1e-9);assert.match(defenderEffectiveStatsMarkup(g,tower),/Berserker −20% range/);
 tower.factionNow=13;result=defenderEffectiveStats(g,tower);assert.equal(result.range,4.5);assert.ok(!result.rangeParts.some(part=>part.key==='own-range'),'The negative contribution disappears when Berserker ends');
});

test('strike controls prepare, confirm, cancel and show the run-wide one-use budget without CP cost',()=>{
 const g=new Game(data,{loadout:{'decisive-strike':3}});g.phase='combat';g.combat.spawnQueue=[{time:1e9,type:'host_01'}];g.combat.spawn('host_01');g.combat.spawn('host_05');g.commandPoints.value=0;
 const first=generalCommandState(g)[0];assert.equal(first.action,'general-strike-prepare');assert.equal(first.disabled,false);assert.match(first.detail,/1 \/ 1 uses remaining · 2 live enemies/);
 assert.ok(g.general.prepareStrike());assert.equal(generalCommandState(g)[0].action,'general-strike-execute');assert.match(generalControlsMarkup(g),/Confirm strike · 2 enemies · 0 CP/);assert.match(generalControlsMarkup(g),/Cancel strike · keep use/);
 assert.ok(g.general.cancelStrike());assert.equal(g.general.remainingUses('decisive-strike'),1);assert.equal(g.commandPoints.value,0);
 assert.ok(g.general.prepareStrike());assert.ok(g.activateGeneral('decisive-strike'));assert.equal(g.general.remainingUses('decisive-strike'),0);const used=generalCommandState(g)[0];assert.equal(used.disabled,true);assert.match(used.detail,/0 \/ 1/);
});

test('Fortified Keep and action wiring expose fixed health, cancellation and new-run-only feedback',()=>{
 const g=new Game(data,{loadout:{'fortified-keep':3}});assert.equal(g.maxLives,45);assert.match(skillEffect('fortified-keep',3),/45\/45/);assert.match(generalCommandState(g)[0].label,/45 maximum keep health/);
 const main=fs.readFileSync(new URL('../game/main.js',import.meta.url),'utf8');assert.match(main,/game\.maxLives\?\?balance\.startingLives/);assert.match(main,/if\(game\.general\.strikePrepared\)game\.activateGeneral\('decisive-strike'\)/);assert.match(main,/general-strike-prepare/);assert.match(main,/general-strike-cancel/);assert.match(main,/function closeGeneralCommand\(\)\{game\?\.general\?\.cancelStrike/);assert.match(main,/if\(!restoring[^;]+game\.emit\('general-fortified'/);assert.equal((main.match(/game\.emit\('general-fortified'/g)||[]).length,1);
});
