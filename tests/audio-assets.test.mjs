import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {campaignTowers} from '../game/core/campaign-roster.js';
import {ALLIED_VOICE_REVISION,ALLIED_VOICE_CATALOGUE} from '../game/audio/voice-assets.js';

const read=relative=>readFileSync(new URL(relative,import.meta.url));
const provenance=JSON.parse(read('../docs/audio/generated-allied-audio.json'));
const catalogue=JSON.parse(read('../public/assets/audio/selection/catalogue.json'));
const scripts=JSON.parse(read('../docs/audio/proposed-audio-manifest.json'));
const towers=campaignTowers(JSON.parse(read('../data/towers.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('all 92 unchanged exported MP3s match their recorded hashes, sizes and audio signatures',()=>{
  assert.equal(provenance.status,'completed');assert.equal(provenance.model,'eleven_v4');assert.equal(provenance.clip_count,92);
  assert.equal(provenance.clips.length,92);assert.equal(provenance.allied_count,46);assert.equal(provenance.takes_per_script,1);
  const digests=new Set();
  for(const clip of provenance.clips){
    assert.match(clip.path,/^public\/assets\/audio\/selection\/ally_[a-z0-9]+_select_[ab]\.mp3$/);
    const bytes=read('../'+clip.path),mp3=bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224;
    assert.ok(mp3,clip.id);assert.equal(bytes.length,clip.byte_size,clip.id);assert.equal(hash(bytes),clip.sha256,clip.id);
    assert.ok(clip.duration_seconds>0);assert.equal(clip.mime_type,'audio/mpeg');assert.ok(clip.generation_id);digests.add(hash(bytes));
  }
  assert.equal(digests.size,92,'each exported A/B recording is a distinct asset');
});

test('runtime catalogue has exactly two distinct clips for each live basic or champion family',()=>{
  assert.deepEqual(Object.keys(catalogue).sort(),Object.keys(towers).sort());
  assert.equal(Object.keys(catalogue).filter(family=>!towers[family].advanced).length,8);
  assert.equal(Object.keys(catalogue).filter(family=>towers[family].advanced).length,38);
  for(const [family,pair] of Object.entries(catalogue)){
    assert.equal(pair.length,2,family);assert.notEqual(pair[0].url,pair[1].url);
    for(let index=0;index<2;index++){
      const clip=pair[index],suffix=index?'b':'a';
      assert.equal(clip.id,`ally_${family}_select_${suffix}`);assert.equal(clip.url,clip.id+'.mp3');
      const record=provenance.clips.find(record=>record.id===clip.id);assert.ok(record);assert.equal(record.character_id,family);
    }
  }
  assert.ok(catalogue.runebreaker,'Engineer uses its stable runebreaker family ID');assert.equal(catalogue.engineer,undefined);
});

test('only the 92 generated allied recordings enter runtime; voice previews and planned enemy assets do not',()=>{
  const files=readdirSync(new URL('../public/assets/audio/selection/',import.meta.url)).sort();
  assert.equal(files.filter(file=>file.endsWith('.mp3')).length,92);
  assert.deepEqual(files,[...provenance.clips.map(clip=>clip.path.split('/').at(-1)),'catalogue.json'].sort());
  const allies=scripts.clips.filter(clip=>clip.event==='ally_selection');assert.equal(allies.length,92);
  assert.deepEqual(allies.map(clip=>clip.id).sort(),provenance.clips.map(clip=>clip.id).sort());
  assert.equal(scripts.clips.filter(clip=>clip.event==='wave_opening').length,50);
  assert.equal(scripts.clips.filter(clip=>clip.event==='wave_variant').length,11);
  assert.ok(!Object.keys(catalogue).some(family=>family.startsWith('host_')||family==='lordbernhard'));
});

test('audio cache revision derives from exact recording provenance independently of model releases',()=>{
  const digest=hash(read('../docs/audio/generated-allied-audio.json'));
  assert.equal(ALLIED_VOICE_REVISION,`allied-20261006-${digest.slice(0,12)}`);
  assert.equal(ALLIED_VOICE_CATALOGUE,`assets/audio/selection/catalogue.json?v=${ALLIED_VOICE_REVISION}`);
});
