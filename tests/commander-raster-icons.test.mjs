import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {GENERAL_SKILLS} from '../game/core/general.js';
import {commanderSkillArt,commanderUtilityArt} from '../ui/commander-art.js';
import {ornateIcon} from '../ui/icons.js';

test('all Commander skill, subtab, dust and header icons share verified generated raster assets',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/assets/ui/commander-generated/manifest.json','utf8'));
 const required=[...Object.keys(GENERAL_SKILLS).map(id=>'skill-'+id),'equipment','skills','chests','sets','relic-dust','commander'];
 assert.equal(manifest.mode,'built-in image_gen');assert.deepEqual(manifest.icons.map(i=>i.id).sort(),required.sort());
 assert.equal(new Set(manifest.icons.map(i=>i.originalSha256)).size,required.length,'Each icon has its own generated original');
 for(const i of manifest.icons){const bytes=fs.readFileSync('public/'+i.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),i.sha256);assert.equal(bytes.length,i.bytes);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(i.width,256);assert.equal(i.height,256);assert.equal(i.transparent,true);}
 for(const id of Object.keys(GENERAL_SKILLS))assert.equal(commanderSkillArt(id),'/assets/ui/commander-generated/skill-'+id+'.webp'+(id==='field-logistics'?'?v=wood-v082':''));
 for(const id of ['equipment','skills','chests','sets','dust','damage','speed','range'])assert.match(commanderUtilityArt(id),/^\/assets\/ui\/commander-generated\/[^/]+\.webp$/);
 assert.match(ornateIcon('commander'),/commander-generated\/commander\.webp/);assert.doesNotMatch(ornateIcon('commander'),/\.svg|<svg/);
});
