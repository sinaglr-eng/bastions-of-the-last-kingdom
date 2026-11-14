import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {serializeRun} from '../game/core/run-state.js';
import {achievementArtwork,progressionArtwork,medalAmount} from '../ui/progression-art.js';
import {achievementCardsMarkup} from '../ui/achievement-page.js';
import {generalPageMarkup} from '../ui/general-page.js';
import {generalCommandState,generalControlsMarkup,updateGeneralControls} from '../ui/general-controls.js';
import {homeMenuMarkup} from '../ui/home-menu.js';

const data=currentFactionData('crown');
const place=g=>{for(const [x,z]of [[18,18],[17,18],[19,18],[18,17],[18,19]])assert.equal(g.place(x,z),true);};
function combat(){const g=new Game(data,{seed:4,loadout:{'morale-boost':2,'war-horn':3,'field-logistics':3}});place(g);g.keep();g.startCombat();return g;}

test('Every achievement has an image, and every champion/boss portrait resolves to an existing approved runtime asset',()=>{
 let portraits=0,bosses=0;
 for(const faction of ['crown','forge','grove']){
  const d=currentFactionData(faction),catalog=achievementCatalog(d,{streakBest:90});
  for(const achievement of catalog){
   const src=achievementArtwork(achievement,d,true);assert.ok(src,achievement.id);
   if(src.startsWith('data:')){assert.match(decodeURIComponent(src.split(',')[1]),/^<svg/);}
   else{assert.equal(fs.existsSync(new URL('../public/'+src.split('?')[0].replace(/^\//,''),import.meta.url)),true,src);if(achievement.kind==='champion')portraits++;if(achievement.kind==='boss')bosses++;}
  }
 }
 assert.equal(portraits,114);assert.equal(bosses,15);
});
test('Secret champion achievements preserve their hidden identity until earned',()=>{
 for(const faction of ['crown','forge','grove']){const d=currentFactionData(faction),secret=achievementCatalog(d).find(a=>a.secret);assert.ok(secret);assert.equal(achievementArtwork(secret,d,false),progressionArtwork('secret'));assert.notEqual(achievementArtwork(secret,d,true),achievementArtwork(secret,d,false));}
});
test('Achievement cards distinguish earned, pending and undiscovered states with accessible progress and medal rewards',()=>{
 const rows=achievementCatalog(data).slice(0,3),owned=new Map([[rows[0].id,{createdAt:1}]]),pending=new Set([rows[1].id]);
 const html=achievementCardsMarkup({data,rows,owned,pending,progress:a=>a===rows[2]?0:1});assert.equal((html.match(/<img /g)||[]).length,3);assert.equal((html.match(/class="medal-icon /g)||[]).length,3);for(const state of ['earned','pending','undiscovered'])assert.match(html,new RegExp('is-'+state));assert.equal((html.match(/role="progressbar"/g)||[]).length,3);assert.match(html,/Awaiting verification/);
 const exact=medalAmount('9007199254740993');assert.match(exact,/9,007,199,254,740,993/);
});
test('General upgrades expose all ranks, current rank, equipment and exact next purchase cost',()=>{
 const html=generalPageMarkup({skills:{'morale-boost':2},equipped:['morale-boost'],balance:19});assert.match(html,/Rank II unlocked/);assert.match(html,/\+60%/);assert.match(html,/Upgrade to III/);assert.match(html,/1 more medals needed/);assert.match(html,/data-buy="morale-boost" disabled/);assert.match(html,/<input[^>]*name="equipped"[^>]*value="morale-boost" checked/);assert.equal((html.match(/class="general-loadout-slot[ "]/g)||[]).length,3);
});
test('Combat command presentation follows authoritative activation, CP and paused combat time without changing the run',()=>{
 const g=combat(),before=JSON.stringify(serializeRun(g));const initial=generalCommandState(g);assert.equal(JSON.stringify(serializeRun(g)),before);assert.equal(initial.find(r=>r.id==='morale-boost').disabled,false);assert.equal(initial.find(r=>r.id==='field-logistics').action,null);
 assert.equal(g.activateGeneral('morale-boost'),true);assert.equal(g.commandPoints.value,10);let row=generalCommandState(g).find(r=>r.id==='morale-boost');assert.equal(row.disabled,true);assert.equal(row.remaining,20);assert.equal(row.detail,'+60% · 20s');g.advanceTicks(60);g.paused=true;const remaining=g.general.remaining('morale-boost');for(let i=0;i<60;i++)g.tick(1/60,1/60);assert.equal(g.general.remaining('morale-boost'),remaining);g.commandPoints.value=2;assert.equal(generalCommandState(g).find(r=>r.id==='war-horn').label,'Need 3 CP');
});
test('Focus queue, contextual two-rank refit, and ended runs expose the same eligibility as game commands',()=>{
 const focus=new Game(data,{loadout:{'recruitment-focus':2}});assert.equal(generalCommandState(focus,'B')[0].disabled,false);focus.activateGeneral('recruitment-focus','B');let row=generalCommandState(focus,'C')[0];assert.equal(row.disabled,true);assert.match(row.detail,/Class B/);assert.match(row.label,/draft 2/);
 const refit=new Game(data,{loadout:{'deep-refit':1}});refit.draft.forced={family:'archer',tier:3};refit.draft.roll(0);place(refit);refit.economy.gold=600;row=generalCommandState(refit)[0];assert.equal(row.disabled,false);assert.equal(row.towerId,refit.selected);assert.equal(refit.downgrade(2),true);assert.equal(refit.selection.tier,1);assert.equal(generalCommandState(refit)[0].disabled,true);
 const g=combat();g.phase='lost';for(const r of generalCommandState(g).filter(r=>r.action))assert.equal(r.disabled,true);
});
test('General command updates preserve mounted controls across countdown ticks and CP changes',()=>{
 const g=combat(),cards=new Map(),cp={textContent:''};let writes=0;
 const host={dataset:{},querySelector:selector=>selector==='[data-general-cp]'?cp:cards.get(selector.match(/data-command-skill="([^"]+)"/)?.[1])};
 Object.defineProperty(host,'innerHTML',{set(){writes++;for(const row of generalCommandState(g)){const label={textContent:''},detail={textContent:''},bar={style:{}},timer={hidden:false,querySelector:()=>bar},button=row.action?{disabled:false,dataset:{},setAttribute(){}}:null;cards.set(row.id,{button,label,timer,classList:{toggle(){}},querySelector:selector=>selector==='button'?button:selector==='[data-command-label]'?label:selector==='[data-command-detail]'?detail:selector==='.general-active-timer'?timer:null});}}});
 updateGeneralControls(host,g);const button=cards.get('morale-boost').button;g.activateGeneral('morale-boost');updateGeneralControls(host,g);g.advanceTicks(60);updateGeneralControls(host,g);assert.equal(writes,1);assert.equal(cards.get('morale-boost').button,button);assert.equal(button.disabled,true);assert.match(cards.get('morale-boost').label.textContent,/Active/);assert.equal(cp.textContent,'10');
});
test('Menu omits navigation arrows and numbered eyebrow labels; General is mounted before Recipes',()=>{
 const html=homeMenuMarkup({player:{user:{id:'example'}},saved:null});assert.doesNotMatch(html,/[↗→]|01 \/ Your alliance|02 \/ Your command/);
 const source=fs.readFileSync(new URL('../game/main.js',import.meta.url),'utf8');assert.ok(source.indexOf('id="general-command"')<source.indexOf('data-action="codex"'));assert.equal((source.match(/id="general-controls"/g)||[]).length,1);
 assert.match(generalControlsMarkup(new Game(data)),/No skills equipped/);
});
