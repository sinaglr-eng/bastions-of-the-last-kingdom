import test from 'node:test';
import assert from 'node:assert/strict';
import {CommanderVault} from '../ui/commander-vault.js';
import {filteredArtifacts} from '../ui/commander-vault-layout.js';
import {ARTIFACT_CATALOG as C,equipArtifactSet,artifactBonuses} from '../game/core/artifacts.js';
import {generalView} from '../ui/war-table-view.js';
import {commanderImageUrl} from '../ui/commander-art.js';
test('FR012 catalog and resolved utility images retain exactly one public game prefix',()=>{
 for(const base of ['/','/play/','/bastions-of-the-last-kingdom/']){const raw='assets/ui/commander-v080/silhouette-armed.webp',url=commanderImageUrl(raw,base);assert.equal(url,base+raw);assert.equal(commanderImageUrl(url,base),url);assert.equal(commanderImageUrl('/assets/ui/ornate/commander.webp',base),'/assets/ui/ornate/commander.webp');}
});
const fixture=()=>new CommanderVault({player:{online:true,profile:{artifacts:{owned:C.artifacts.map(i=>i.id),equipment:{},counts:[],chests:[],pity:{},dust:1000,highestTier:5}}},render:async()=>{},status:()=>{}});
test('FR012 backpack pages are bounded, searchable and preserve real rarity',()=>{
 const v=fixture();assert.equal(filteredArtifacts(v).length,106);assert.equal([...v.equipment().matchAll(/data-vault-item=/g)].length,12);v.page=6;assert.equal([...v.equipment().matchAll(/data-vault-item=/g)].length,12);v.search='crown';assert.ok(filteredArtifacts(v).every(i=>/crown/i.test(i.name)));v.search='';v.ownership='missing';assert.equal(filteredArtifacts(v).length,0);v.player.profile.artifacts.owned=[];assert.equal(filteredArtifacts(v).length,106);v.set='celestial';assert.equal(filteredArtifacts(v).length,10);v.rarity='legendary';assert.equal(filteredArtifacts(v).length,3);
});
test('FR012 all sets render one focused composition with their actual threshold count',()=>{
 const v=fixture();for(const s of C.sets){v.selectedSet=s.id;const html=v.sets();assert.equal([...html.matchAll(/class="vault-set-detail/g)].length,1);assert.match(html,new RegExp('id="vault-set-'+s.id+'"'));assert.equal([...html.matchAll(/data-vault-item=/g)].length,s.pieceCount);const thresholds=html.match(/<ol class="vault-set-thresholds">([\s\S]*?)<\/ol>/)[1];assert.equal([...thresholds.matchAll(/<li class=/g)].length,Object.keys(s.bonuses).length);assert.match(html,/collected/);assert.match(html,/equipped/);assert.doesNotMatch(html,/equipped Commander|commander-.*-equipped/);}
});
test('FR012 partial set never creates missing pieces and preserves non-conflicting items and both rings',()=>{
 const owned=['CE-01','CE-09','CE-10','N-01'];const e=equipArtifactSet({weapon:'N-01',ring2:'CE-09'},'celestial',owned,{ownedOnly:true});assert.deepEqual(e,{head:'CE-01',weapon:'N-01',ring1:'CE-10',ring2:'CE-09'});assert.equal(artifactBonuses(e).sets.celestial,3);assert.throws(()=>equipArtifactSet({},'celestial',[],{ownedOnly:true}),/own any/);assert.deepEqual(equipArtifactSet(e,'celestial',owned,{ownedOnly:true}),e);
});
test('FR012 chest selector shows one selected stage and current guarantee without opening anything',()=>{
 const v=fixture();v.chestTier=2;v.player.profile.artifacts.pity[2]=2;const html=v.chests();assert.equal([...html.matchAll(/data-vault-chest=/g)].length,5);assert.equal([...html.matchAll(/class="chest-hero/g)].length,1);assert.match(html,/Within 1 more chest/);assert.match(html,/Rare every 3 chests/);assert.match(html,/data-count="5" disabled/);v.chestTier=3;assert.match(v.chests(),/Epic every 7 chests/);assert.equal(v.reveal,null);
});
test('FR012 skills expose all 11 entries over two pages and no unreachable rank purchase',()=>{
 const profile={xpTotal:0,balance:100,skills:{},equipped:[]};const first=generalView(profile),second=generalView(profile,true,{skillPage:1});assert.equal([...first.matchAll(/<article class="war-skill /g)].length,6);assert.equal([...second.matchAll(/<article class="war-skill /g)].length,5);assert.equal([...generalView(profile,true,{filter:'equipped'}).matchAll(/<article class="war-skill /g)].length,0);assert.doesNotMatch(first,/commander-progression|war-table\/deep-refit/);assert.match(first,/Unlock at Level 3/);
});
