import test from 'node:test';
import assert from 'node:assert/strict';
import {currentFactionData} from '../game/core/current-data.js';
import {Game} from '../game/core/game.js';
import {achievementCatalog} from '../game/core/achievements.js';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {generalControlsMarkup,recruitmentClassOptions} from '../ui/general-controls.js';
import {skillSummary} from '../ui/general-page.js';
import {wallPanelMarkup} from '../ui/wall-panel.js';
import {AchievementNotices} from '../ui/achievement-notices.js';

test('TOP and Basic rewards agree between discovery and catalog in every faction',()=>{
 for(const faction of ['crown','forge','grove']){
  const data=currentFactionData(faction),g=new Game(data,{seed:10}),catalog=achievementCatalog(data);
  for(const [id,unit] of Object.entries(data.towers))if(unit.advanced)g.progress.champions.add(id);
  for(const row of g.progress.grants().filter(r=>r.id.startsWith('champion:'))){const unit=data.towers[row.id.split(':').at(-1)];assert.equal(row.reward,unit.classification.toLowerCase()==='top'?3:1);assert.equal(row.reward,catalog.find(c=>c.id===row.id).reward);if(unit.classification.toLowerCase()==='basic'){assert.equal(row.reward,1);assert.equal(catalog.find(c=>c.id===row.id).xp,1);}}
 }
});

test('field recruitment options preserve A–H command codes and explain the actual faction defender',()=>{
 for(const faction of ['crown','forge','grove']){
  const data=currentFactionData(faction),g=new Game(data,{seed:10,loadout:{'recruitment-focus':2}}),rows=recruitmentClassOptions(g);
  assert.deepEqual(rows.map(r=>r.code),[...'ABCDEFGH']);
  for(const row of rows){const unit=Object.values(data.towers).find(u=>!u.advanced&&u.unitCode===row.code);assert.equal(row.label,`${row.code} — ${unit.name}`);}
  assert.match(generalControlsMarkup(g),/value="A" selected>A — /);assert.match(generalControlsMarkup(g),/Add 8%.*20% becomes 28%.*1 CP/);
 }
 for(const id of Object.keys(GENERAL_SKILLS))for(let rank=1;rank<=3;rank++)assert.ok(skillSummary(id,rank).length>20);
 assert.match(wallPanelMarkup({phase:'build'}),/src="\/assets\/ui\/ipad-polish\/castle-wall.webp"/);assert.doesNotMatch(wallPanelMarkup(),/src="undefined"/);
});

test('unlocked notice is a single discreet acknowledgement, never a claim action',()=>{
 const n=Object.create(AchievementNotices.prototype);Object.assign(n,{player:{user:{id:'fixture'},profile:{}},owner:'fixture:initial',seen:new Set(),queue:[],current:null,root:{innerHTML:''},resume(){},timer:null});
 n.push({type:'pending',rows:[{id:'boss:crown:host_10',reward:2}]});assert.match(n.root.innerHTML,/ACHIEVEMENT UNLOCKED/);assert.doesNotMatch(n.root.innerHTML,/Claim reward|data-notice-claim|data-notice-view/);
 n.push({type:'ready',rows:[{id:'boss:crown:host_10',reward:2}]});assert.equal(n.queue.length,0,'Verification must not duplicate the pending notification');
 n.push({type:'claimed',id:'boss:crown:host_10',reward:2});assert.equal(n.queue.length,0);assert.equal(n.remaining,4500);n.current=null;n.push({type:'summary',count:1});assert.match(n.root.innerHTML,/>1 achievement<\/h2>/);assert.doesNotMatch(n.root.innerHTML,/1 achievements/);
});
