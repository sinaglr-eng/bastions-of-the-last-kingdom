import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {loadCurrentDatasets} from './current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {attackVisualStyle} from '../game/render/combat-effects.js';
import {recordedCatalogue} from '../game/audio/recorded-attacks.js';

export const NEW_COMBAT_EFFECT_IDS=Object.freeze(['electric_arc','storm_spear','musket','gatling','mortar','cannon','grenade_throw','explosive_impact','axe','pickaxe','war_drum','ent_slam','web_spit','claw','fire_breath']);
const root=fileURLToPath(new URL('../',import.meta.url)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const primary={arrow:'arrow',venomArrow:'arrow',melee:'sword',thrust:'spear',axe:'axe',pick:'pickaxe',hammer:'hammer',runic:'runic_bolt',forge:'hammer',bullet:'musket',bulletRapid:'gatling',shell:'mortar',cannon:'cannon',grenade:'grenade_throw',drum:'war_drum',treeSlam:'ent_slam',web:'web_spit',claw:'claw',flame:'fire_breath',lightning:'electric_arc',stormSpear:'storm_spear',moon:'arcane',roots:'nature',frost:'frost',holy:'holy',arcane:'arcane',stone:'stone',dart:'toxic_canister'};
const channel=(type,s)=>type==='profile'?s.type:type==='magical-or-holy'?(s.type==='holy'?'holy':'magical'):type;
export function currentCombatBindings(datasets=loadCurrentDatasets()){
  const rows=new Map();let rankBindings=0;
  for(const [factionId,data]of Object.entries(datasets))for(const [family,definition]of Object.entries(data.towers)){
    const cues=[];
    for(let tier=1;tier<=(definition.advanced?1:6);tier++){
      const stats=towerStats({family,tier},data),style=attackVisualStyle(family,stats),shot=style.kind==='siege'?(style.motion==='catapult-shot'?'stone':'heavy_bolt'):primary[style.kind];
      assert.ok(shot,`Unmapped authored attack kind ${family}:${tier}:${style.kind}`);
      const abilities=stats.abilities||[],has=id=>abilities.some(a=>a.familyId===id),fire=abilities.find(a=>a.familyId==='fire-aura');
      const cue={ranks:[tier],shot,kind:style.kind,weapon:style.weapon,motion:style.motion,element:style.element};
      cue.chain={};if(style.element==='lightning'||['lightning','forked-lightning','spark'].some(has)||family==='ladyclaire')cue.chain.lightning='electric_arc';
      if(has('bouncing-frost')||stats.bouncingFrost||family==='archangel')cue.chain.frost='frost';
      if(!Object.keys(cue.chain).length)delete cue.chain;
      if(['shell','cannon','grenade'].includes(style.kind))cue.impact='explosive_impact';
      if(stats.burned||family==='elvenking')cue.burnProc='fire';
      if(style.kind==='flame'||fire)cue.auraAttack='fire_breath';
      if(fire?.dps>0)cue.fireAura={radius:fire.radius,damageType:channel(fire.damageType,stats),effect:'fire_breath',requiresAttackEnabled:!!stats.factionProfile};
      else if(stats.burnAura>0)cue.fireAura={radius:stats.burnAuraRange??stats.range,damageType:stats.type==='holy'?'holy':'magical',effect:'fire_breath',requiresAttackEnabled:false};
      cues.push(cue);rankBindings++;
    }
    if(rows.has(family)){
      assert.equal(family,'ladyclaire','Only the shared secret character may appear in multiple factions');
      assert.deepEqual(rows.get(family).cues,cues,'Shared Claire must use one stable weapon/voice identity');rows.get(family).factions.push(factionId);continue;
    }
    const effects=[...new Set(cues.flatMap(c=>[c.shot,c.impact,c.burnProc,c.auraAttack,...Object.values(c.chain||{}),c.fireAura?.effect]).filter(Boolean))];
    rows.set(family,{character_id:family,factions:[factionId],effects,cues});
  }
  assert.equal(rows.size,136);assert.equal(rankBindings,258);
  return [...rows.values()];
}

/** Validate real selections and all preserved bytes before replacing any output. */
export async function buildCurrentCombatAudio({workspace=root,selectionFile=path.join(workspace,'output/implementation/combat-effects-current/audio/selected-clips.json')}={}){
  const directory=path.join(workspace,'public/assets/audio/combat-effects-current'),legacyFile=path.join(workspace,'public/assets/audio/approved-20261011/catalogue.json');
  const selected=JSON.parse(await fs.readFile(selectionFile,'utf8')),clips=selected.clips;
  assert.ok(Array.isArray(clips),'The selected-clip receipt must contain a clips array');
  assert.deepEqual(clips.map(c=>c.id).sort(),[...NEW_COMBAT_EFFECT_IDS].sort(),'All fifteen selected identities are required exactly once');
  const legacyBytes=await fs.readFile(legacyFile),legacy=JSON.parse(legacyBytes),verified=[],copies=[];
  for(const clip of clips){
    assert.match(clip.sha256||'',/^[a-f0-9]{64}$/);assert.ok(typeof clip.prompt==='string'&&clip.prompt.trim(),'Keep the exact generation prompt');
    assert.ok(Number.isFinite(clip.durationSeconds)&&clip.durationSeconds>0&&clip.durationSeconds<=8,'Require a short real selected SFX duration');
    assert.ok(Number.isFinite(clip.gain)&&clip.gain>0&&clip.gain<=16,'Require the measured finite mix gain without rewriting source audio');
    assert.equal(typeof clip.file,'string');const file=path.resolve(workspace,clip.file),expected=path.join(directory,`attack_${clip.id}.mp3`),relative=path.relative(workspace,file);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&path.extname(file).toLowerCase()==='.mp3','Selected original must be an MP3 inside this workspace');
    const bytes=await fs.readFile(file);assert.ok(bytes.length>1000);assert.equal(clip.bytes,bytes.length);assert.equal(sha(bytes),clip.sha256);
    assert.ok(bytes.subarray(0,3).toString()==='ID3'||bytes[0]===255&&(bytes[1]&224)===224,'Selected file must have an MP3 signature');
    verified.push({...clip,sourceFile:relative.replaceAll('\\','/'),url:path.basename(expected),file:path.relative(workspace,expected).replaceAll('\\','/'),approved:false,status:'generated'});copies.push({file:expected,bytes});
  }
  for(const clip of [...legacy.effects,...legacy.music]){
    const bytes=await fs.readFile(fileURLToPath(new URL(clip.url,pathToFileURL(legacyFile))));assert.equal(sha(bytes),clip.sha256,'Original approved recording changed: '+clip.id);
  }
  const defenders=currentCombatBindings(),revision='combat-effects-20261110-'+sha(Buffer.from(JSON.stringify({legacy:sha(legacyBytes),clips:verified.map(c=>[c.id,c.sha256]),defenders}))).slice(0,12);
  // Both catalogue folders share the same parent; exact legacy relative URLs
  // and every original metadata field remain valid without copying originals.
  const catalogue={schemaVersion:1,revision,music:legacy.music,effects:[...legacy.effects,...verified.map(({file,...clip})=>clip)],defenders,policy:legacy.policy};
  recordedCatalogue(catalogue,pathToFileURL(path.join(directory,'catalogue.json')).href);
  assert.equal(catalogue.effects.length,30);assert.equal(catalogue.music.length,6);
  const module=`// Current combat bank. Approved original recordings and music remain exact.\nexport const CURRENT_ATTACK_REVISION=${JSON.stringify(revision)};\nexport const CURRENT_ATTACK_CATALOGUE=\`assets/audio/combat-effects-current/catalogue.json?v=\${CURRENT_ATTACK_REVISION}\`;\nexport const CURRENT_ATTACK_TYPE_COUNT=30;\nexport const CURRENT_ATTACK_REVIEW=Object.freeze({revision:CURRENT_ATTACK_REVISION,expectedEffects:CURRENT_ATTACK_TYPE_COUNT,expectedMusic:6});\n`;
  await fs.mkdir(directory,{recursive:true});for(const copy of copies)await fs.writeFile(copy.file,copy.bytes);await fs.writeFile(path.join(directory,'catalogue.json'),JSON.stringify(catalogue,null,2)+'\n');await fs.writeFile(path.join(workspace,'game/audio/current-attack-assets.js'),module);
  const report={status:'passed',revision,effects:30,newEffects:15,preservedEffects:15,music:6,characterFamilies:defenders.length,factionRankBindings:258,uniqueRankBindings:defenders.reduce((n,row)=>n+row.cues.length,0),legacyCatalogueSha256:sha(legacyBytes),catalogueSha256:sha(await fs.readFile(path.join(directory,'catalogue.json'))),selected:verified.map(({id,file,sha256,bytes,durationSeconds})=>({id,file,sha256,bytes,durationSeconds})),originalRecordingsUnchanged:true,newRecordingsHumanApproved:false};
  await fs.mkdir(path.join(workspace,'output/implementation/combat-effects-current/audio'),{recursive:true});await fs.writeFile(path.join(workspace,'output/implementation/combat-effects-current/audio/bank-build-report.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await buildCurrentCombatAudio(),null,2));
