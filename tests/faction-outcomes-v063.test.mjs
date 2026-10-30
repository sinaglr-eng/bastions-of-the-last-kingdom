import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {FACTION_OUTCOME_ART_SCENES,createOutcomeArtSelector} from '../ui/outcome-art.js';
const bytes=f=>fs.readFileSync(new URL('../'+f,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
test('each faction has at least five distinct victories and defeats; all 30 new originals and native-size deliveries retain exact provenance',()=>{
 const manifest=JSON.parse(bytes('public/assets/ui/results/v063/manifest.json'));assert.equal(manifest.assets.length,30);
 for(const [id,group]of Object.entries(FACTION_OUTCOME_ART_SCENES))for(const [outcome,scenes]of Object.entries(group)){assert.ok(scenes.length>=5);assert.equal(new Set(scenes.map(s=>s.path)).size,scenes.length);for(const s of scenes){assert.equal(s.factionId,id);assert.equal(s.outcome,outcome);assert.ok(s.alt.length>50);assert.ok(bytes('public/'+s.path).length>10000);}}
 for(const a of manifest.assets){const original=bytes(a.original),delivery=bytes(a.file);assert.equal(sha(original),a.originalSha256);assert.equal(sha(delivery),a.sha256);assert.equal(sha(bytes(a.reference)),a.referenceSha256);assert.deepEqual([original.readUInt32BE(16),original.readUInt32BE(20)],a.dimensions);assert.equal(delivery.toString('ascii',8,12),'WEBP');assert.ok(a.prompt.includes('No lettering'));}
});
test('six independent random bags exhaust each faction and outcome before repeating, without consuming simulation RNG',()=>{
 let samples=0;const select=createOutcomeArtSelector({random:()=>{samples++;return 0;}});
 for(const factionId of ['crown','forge','grove'])for(const phase of ['won','lost']){const expected=FACTION_OUTCOME_ART_SCENES[factionId][phase],seen=new Set();let last;
  for(let i=0;i<expected.length;i++){const game={factionId,phase,rng:()=>{throw Error('Simulation RNG must not be read');}},art=select(game),before=samples;assert.equal(art.factionId,factionId);assert.equal(art.outcome,phase);assert.equal(select(game),art);assert.equal(samples,before);assert.ok(!seen.has(art.id));seen.add(art.id);last=art.id;}
  assert.equal(seen.size,expected.length);assert.notEqual(select({factionId,phase}).id,last);
 }
});
test('replayed waves and a changed faction refresh an attempt while ordinary result inspection stays stable',()=>{
 const select=createOutcomeArtSelector({random:()=>.5}),listeners=[],game={factionId:'forge',phase:'lost',on:f=>listeners.push(f)};
 const first=select(game);assert.equal(select(game),first);listeners[0]('wave');assert.notEqual(select(game).id,first.id);game.factionId='grove';assert.equal(select(game).factionId,'grove');game.phase='build';assert.equal(select(game),null);game.phase='won';assert.equal(select(game).outcome,'won');
});
