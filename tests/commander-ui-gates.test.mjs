import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun} from '../game/core/run-state.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {MILITARY_RANKS,SKILL_LEVEL_GATES,skillGate} from '../game/core/account-progression.js';
import {generalPageMarkup,skillPurchaseState,skillRankMarkup,skillEffect} from '../ui/general-page.js';
import {generalView,warArt} from '../ui/war-table-view.js';
import {generalCommandState,generalControlsMarkup,promotionPreviewMarkup} from '../ui/general-controls.js';
import {progressionArtwork} from '../ui/progression-art.js';

const data=currentFactionData('crown'),newIds=['field-promotion','decisive-strike','fortified-keep'];
test('every new skill rank uses the shared actual military gate even when the account has enough medals',()=>{
 assert.deepEqual(newIds.map(id=>SKILL_LEVEL_GATES[id]),[[7,10,14],[9,13,15],[2,6,11]]);
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

test('all three new coded illustrations are distinct and preserve original skill artwork',()=>{
 const icons=newIds.map(id=>progressionArtwork(id));assert.equal(new Set(icons).size,3);
 for(const [i,src]of icons.entries()){assert.match(src,/^data:image\/svg\+xml/);assert.match(decodeURIComponent(src.split(',')[1]),/<svg/);assert.equal(warArt(newIds[i]),src);}
 assert.match(progressionArtwork('war-horn'),/war-horn\.webp$/);
});

test('promotion presentation renders all five rows including caps and follows authoritative one-click eligibility',()=>{
 const g=new Game(data,{loadout:{'field-promotion':2}});const unplaced=generalControlsMarkup(g);assert.equal((unplaced.match(/Place this recruit to preview/g)||[]).length,5);assert.doesNotMatch(unplaced,/data-promotion-tower="null"/);g.draft.forced={family:'archer',tier:5};g.draft.roll(0);
 for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.ok(g.place(x,z));
 const first=g.towers.find(t=>t.id===g.draft.draws[0].towerId);first.tier=4;g.draft.draws[0].tier=4;g.commandPoints.value=3;
 const before=JSON.stringify(serializeRun(g)),row=generalCommandState(g)[0];assert.equal(row.action,'general-promotion');assert.equal(row.disabled,false);assert.equal(row.preview.length,5);assert.equal(row.preview.filter(r=>r.eligible).length,1);assert.equal(JSON.stringify(serializeRun(g)),before);
 const html=generalControlsMarkup(g);assert.equal((html.match(/data-promotion-tower=/g)||[]).length,5);assert.match(html,/Rank V is the limit/);assert.match(html,/Promote all five · 3 CP/);assert.match(html,/2 \/ 2 uses remaining/);
 assert.ok(g.activateGeneral('field-promotion'));assert.equal(g.commandPoints.value,0);assert.equal(generalCommandState(g)[0].disabled,true);assert.match(generalCommandState(g)[0].detail,/1 \/ 2/);assert.equal(generalCommandState(g)[0].showPreview,true);g.keep();assert.equal(generalCommandState(g)[0].showPreview,false,'Resolved drafts do not push combat commands down with stale preview rows');
 assert.equal((promotionPreviewMarkup([]).match(/Place this recruit to preview/g)||[]).length,5,'Unknown future recruits remain placeholders');
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
