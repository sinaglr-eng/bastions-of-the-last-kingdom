import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {achievementCatalog} from '../game/core/achievements.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementPictureUrls} from '../ui/progression-art.js';
import {achievementById,achievementsView} from '../ui/war-table-view.js';
import {achievementCardsMarkup} from '../ui/achievement-page.js';
import {AchievementNotices} from '../ui/achievement-notices.js';

test('each achievement has different image content, including hidden champions and new flawless milestones',()=>{
 const catalog=new Map();
 for(const faction of ['crown','forge','grove']){
  const data=currentFactionData(faction);
  for(const achievement of achievementCatalog(data,{streakBest:1500})){
   catalog.set(achievement.id,{achievement,data});
  }
 }
 for(const revealed of [false,true]){
  const owners=new Map();
  for(const [id,{achievement,data}] of catalog){
   const pictures=achievementPictureUrls(achievement,data,revealed);
   const hash=createHash('sha256');
   for(const src of pictures){
    assert.match(src,/\.(?:webp|png)(?:\?|$)/);
    hash.update(fs.readFileSync(new URL('../public'+src.split('?')[0],import.meta.url)));
   }
   const digest=hash.digest('hex');
   assert.equal(owners.has(digest),false,`${id} repeats the picture for ${owners.get(digest)}`);
   owners.set(digest,id);
  }
 }
});

test('late flawless milestones show the same painted route in the album, collection card and notification',()=>{
 const id='streak:global:1120', {data,row}=achievementById(id);
 const player={user:{id:'art-fixture'},online:true,profile:{eligible:[row],grants:[],progress:{crown:{streakBest:1120}}}};
 const urls=achievementPictureUrls(row,data);
 assert.equal(urls.length,3);
 const album=achievementsView(player,{faction:'all',focusId:id,status:'ready'});
 const cards=achievementCardsMarkup({data,rows:[row],owned:new Map(),pending:new Set(),progress:()=>1120});
 const notice=Object.assign(Object.create(AchievementNotices.prototype),{player,root:{innerHTML:''},owner:'art-fixture:initial',seen:new Set(),queue:[],resume(){}});
 notice.push({type:'ready',rows:[row]});
 for(const html of [album,cards,notice.root.innerHTML]){
  const strip=html.match(/<span class="[^"]*achievement-watch-panels"[^>]*>([\s\S]*?)<\/span>/);
  assert.ok(strip);
  assert.deepEqual([...strip[1].matchAll(/src="([^"]+)"/g)].map(match=>match[1]),urls);
  assert.match(html,/1120 consecutive flawless waves/);
 }
});
