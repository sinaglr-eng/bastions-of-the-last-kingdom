import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {recordedCatalogue,recordedAttackCue,RECORDED_ATTACK_TYPES} from '../game/audio/recorded-attacks.js';
import {ALLIED_VOICE_CATALOGUE,ALLIED_VOICE_REVISION} from '../game/audio/voice-assets.js';
import {AUDIO_BANK_CATALOGUE} from '../game/audio/audio-assets.js';
import {siteUrl} from '../game/site-url.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
const json=path=>JSON.parse(read(path));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const proof=json('docs/audio/approved-audio-integration-20261011.json');
const raw=json('public/assets/audio/approved-20261011/catalogue.json');

test('113 approved audio recordings and ten source receipts retain exact approved bytes',()=>{
  const entries=[...proof.voices,...proof.music,...proof.effects];
  assert.equal(entries.length,113);assert.equal(new Set(entries.map(row=>row.runtimePath||row.path)).size,113);
  for(const row of entries){
    const bytes=read(row.runtimePath||row.path);
    assert.equal(bytes.length,row.byte_size,row.id);assert.equal(sha(bytes),row.sha256,row.id);
    assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224,`${row.id} is MP3`);
  }
  for(const [path,row]of Object.entries(proof.sourceReceipts)){
    const bytes=read(path);assert.equal(bytes.length,row.bytes,path);assert.equal(sha(bytes),row.sha256,path);
  }
  assert.equal(sha(read(proof.runtimeBank.file)),proof.runtimeBank.sha256);
  assert.equal(sha(read('docs/audio/generated-allied-audio.json')),proof.preservedLegacyReceiptSha256);
});

test('current 46 stable defender identities use distinct voices and exactly two approved A/B clips',()=>{
  const voices=new Map();for(const row of proof.voices){const pair=voices.get(row.character_id)||[];pair.push(row);voices.set(row.character_id,pair);}
  assert.equal(voices.size,46);
  assert.equal(new Set([...voices.values()].map(pair=>pair[0].voice_id)).size,46);
  const catalogue=json('public/assets/audio/allied-recast-20261011/catalogue.json');
  for(const [family,pair]of voices){
    assert.equal(pair.length,2,family);assert.equal(pair[0].voice_id,pair[1].voice_id,family);
    assert.equal(catalogue[family].length,2);assert.deepEqual(new Set(catalogue[family].map(x=>x.id)),new Set(pair.map(x=>x.id)));
    for(const clip of catalogue[family])assert.equal(sha(read(`public/assets/audio/allied-recast-20261011/${clip.url}`)),pair.find(x=>x.id===clip.id).sha256);
  }
  assert.match(ALLIED_VOICE_REVISION,/20261011/);assert.match(ALLIED_VOICE_CATALOGUE,/allied-recast-20261011/);
  const plan=json('docs/audio/voice-recast-plan-20261011.json');
  assert.deepEqual(new Set(plan.dwarf_ids),new Set(['runebreaker','royalmarshal','griffinbomber','mechanicalgolem']));
  assert.equal(voices.get('stormcaller')[0].voice_name,'ThunderBlade - Heroic Characters - Anime');
  assert.match(voices.get('crownofages')[0].voice_name,/Maverick/);
  // These are approved casting records, not an automated accent certification.
});

test('only final two build, three battle and one shared celebration enter runtime',()=>{
  assert.deepEqual(new Set(raw.music.map(x=>x.id)),new Set(['iron_build','wilds_build','iron_battle','wilds_battle','fallen_battle','fallen_victory_celebration']));
  assert.equal(raw.music.filter(x=>x.phase==='build').length,2);
  assert.equal(raw.music.filter(x=>x.phase==='battle').length,3);
  assert.deepEqual(raw.music.filter(x=>x.phase==='victory').map(x=>x.id),['fallen_victory_celebration']);
  // Review directories may retain historical alternatives. Only the six approved
  // catalogue entries can enter the runtime bank; preserve unreferenced originals.
  const reviewFiles=new Set(readdirSync(new URL('../public/assets/audio/music/review-20261011/',import.meta.url)));
  for(const track of raw.music){
    assert.equal(track.url,`../music/review-20261011/${track.id}.mp3`);
    assert.ok(reviewFiles.has(track.id+'.mp3'),track.id);
  }
  assert.equal(raw.effects.length,15);assert.deepEqual(new Set(raw.effects.map(x=>x.id)),RECORDED_ATTACK_TYPES);
  assert.equal(raw.defenders.length,46);assert.equal(raw.policy.crossfadeSeconds,1.5);
});

test('root, GitHub project and portable catalogues resolve current 113 MP3s with revision',()=>{
  for(const base of ['/','/tower-defense/','./']){
    const document='https://example.test/portable/index.html';
    const bankUrl=new URL(siteUrl(AUDIO_BANK_CATALOGUE,base),document).href;
    const bank=recordedCatalogue(raw,bankUrl);assert.equal(bank.music.length,6);assert.equal(bank.effects.size,15);assert.equal(bank.defenders.size,46);
    for(const asset of [...bank.music,...bank.effects.values()]){
      const url=new URL(asset.url);assert.equal(url.searchParams.get('v'),new URL(bankUrl).searchParams.get('v'));
      assert.ok(url.pathname.includes('/assets/audio/'));assert.ok(!url.pathname.includes('/approved-20261011/music/'));
    }
    const voiceUrl=new URL(siteUrl(ALLIED_VOICE_CATALOGUE,base),document).href;
    assert.equal(new URL('ally_soldier_select_a.mp3',voiceUrl).pathname,new URL(voiceUrl).pathname.replace('catalogue.json','ally_soldier_select_a.mp3'));
  }
});

test('all 86 approved ranked/champion identities route primary cues by stable ID and actual tier',()=>{
  const bank=recordedCatalogue(raw,'https://example.test/assets/audio/approved-20261011/catalogue.json');
  const expected={soldier:'sword',archer:'arrow',druid:'nature',mage:'arcane',cleric:'holy',runebreaker:'runic_bolt',frostwarden:'frost',stormcaller:'lightning',rimewatch:'frost',frostblade:'spear',roseguard:'spear',highking:'sword',crownofages:'sword',thornwarden:'arrow',verdantguard:'arrow',tempest:'lightning',stormcitadel:'lightning',embercrown:'fire',worldfire:'fire',starfall:'lightning',thunderheart:'lightning',phoenix:'fire',greenheart:'nature',eldergrove:'nature',kingsreach:'heavy_bolt',sunward:'holy',winterhold:'frost',dawnspire:'holy',royalmarshal:'charge',stonewarden:'stone',wyvernhunter:'arrow',royalarsenal:'nature',rangermentor:'nature',kingdomprotector:'hammer',mothernature:'nature',royalranger:'arrow',kingsrangerguard:'arrow',elvenking:'arrow',fireballista:'heavy_bolt',emeraldgolem:'stone',griffinbomber:'charge',mechanicalgolem:'toxic_canister',monk:'holy',archbishop:'holy',archangel:'frost',ladyclaire:'arcane'};
  const basics=new Set(['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller']);
  let count=0;for(const [family,primary]of Object.entries(expected))for(let tier=1;tier<=(basics.has(family)?6:1);tier++){
    assert.equal(recordedAttackCue('shot',{source:{family,tier,level:99}},bank.defenders),family==='soldier'&&tier===1?'spear':primary,`${family}:${tier}`);count++;
  }
  assert.equal(count,86);
});

test('malformed or ambiguous recorded catalogue fails atomically',()=>{
  for(const mutate of [x=>x.music.push(x.music[0]),x=>x.music.push({...x.music.at(-1),id:'extra_victory'}),x=>x.effects.push(x.effects[0]),x=>x.defenders.push(x.defenders[0]),x=>x.defenders[0].effects=['missing']]){
    const candidate=structuredClone(raw);mutate(candidate);assert.throws(()=>recordedCatalogue(candidate,'https://example.test/catalogue.json'));
  }
});
