import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyFr002Registry} from '../game/core/fr002-registry.js';import {loadFr002Datasets} from '../tools/fr002-validation/datasets.mjs';import {towerStats} from '../game/core/math.js';
import {supportBonuses} from '../game/core/math.js';import {towerSupportState} from '../game/render/support-effects.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url))),base=read('data/factions-v060.json'),approved=read('data/fr002-approved.json'),next=applyFr002Registry(base),baseline=loadFr002Datasets({baseline:true}),data=loadFr002Datasets();
test('FR-002 applies all 570 exact approved assignments and 43 reviewed recipe deltas without mutating the FR-001 source or models',()=>{
 const before=JSON.stringify(base);applyFr002Registry(base);assert.equal(JSON.stringify(base),before);let occurrences=0,profiles=0;
 for(const f of next.factions){assert.equal(f.units.filter(u=>u.kind==='basic').length,8);assert.equal(f.units.filter(u=>u.kind!=='basic').length,38);assert.deepEqual(f.assets,base.factions.find(x=>x.id===f.id).assets);for(const u of f.units)for(const [i,p]of u.profiles.entries()){profiles++;const ids=approved.assignments[`${f.id}/${u.id}/${i+1}`]||[];assert.deepEqual(p.abilities.map(a=>a.levelId),ids);assert.ok(p.abilities.every(a=>a.text&&a.levelLabel));occurrences+=p.abilities.length;}}
 assert.equal(profiles,258);assert.equal(occurrences,570);assert.equal(approved.recipes.length,43);assert.equal(approved.levels.length,160);
});
test('Human primary attacks and recipes and every effective Claire field remain equal to the implementation baseline',()=>{
 for(const [id,d]of Object.entries(data)){assert.deepEqual(d.recipes.find(r=>r.id==='ladyclaire'),baseline[id].recipes.find(r=>r.id==='ladyclaire'));const trim=s=>Object.fromEntries(Object.entries(s).filter(([k])=>!['abilities','description','abilityCatalogue','fr002'].includes(k)));assert.deepEqual(trim(towerStats({family:'ladyclaire',tier:1},d)),trim(towerStats({family:'ladyclaire',tier:1},baseline[id])));}
 assert.deepEqual(data.crown.recipes,baseline.crown.recipes);
 for(const [family,u]of Object.entries(data.crown.towers))for(let tier=1;tier<=(u.advanced?1:6);tier++){const a=towerStats({family,tier},data.crown),b=towerStats({family,tier},baseline.crown);for(const k of ['damage','interval','range','type'])assert.equal(a[k],b[k],`${family}/${tier}/${k}`);}
 assert.equal(Object.values(approved.humanChanges).flat().length,14);
 assert.equal(towerStats({family:'starfall',tier:1},data.crown).chainRange,6);assert.equal(towerStats({family:'starfall',tier:1},data.crown).chain,5);assert.equal(towerStats({family:'fireballista',tier:1},data.crown).burnDps,240);
});
test('all terminal premiums and continuous cone mirrors use the approved combined values once',()=>{
 for(const row of approved.terminalStats){const s=towerStats({family:row.unitId,tier:1},data[row.factionId]);assert.equal(row.unitId==='dw_emberanvil'?s.continuousAttack.dps:s.damage,row.after,row.unitId);}
 for(const f of next.factions)for(const u of f.units)for(const p of u.profiles){const a=p.abilities.find(a=>a.familyId==='flame-cone');if(a){assert.equal(p.range,a.range);assert.equal(p.continuousAttack.range,a.range);assert.equal(p.continuousAttack.angleDegrees,a.coneDegrees);assert.equal(p.continuousAttack.dps,a.dps);}}
});
test('all 144 basic rank profiles retain one to three ordinary recipe destinations and all recipe graphs remain local and acyclic',()=>{
 for(const [id,d]of Object.entries(data)){assert.equal(d.recipes.length,38);for(const [family,u]of Object.entries(d.towers))if(!u.advanced)for(let tier=1;tier<=6;tier++){const uses=d.recipes.filter(r=>r.ingredients.some(i=>i.family===family&&i.tier===tier)),ordinary=uses.filter(r=>r.id!=='ladyclaire');assert.ok(ordinary.length>=1&&ordinary.length<=3,`${id}/${family}/${tier}: ${ordinary.length}`);assert.ok(uses.length<=3);}
  function visit(family,path=[]){assert.ok(!path.includes(family),'cycle '+path);const r=d.recipes.find(r=>r.id===family);if(!r)return;assert.equal(r.ingredients.length,3);for(const i of r.ingredients){assert.ok(d.towers[i.family]);assert.ok(i.tier>=1&&i.tier<=(d.towers[i.family].advanced?1:6));visit(i.family,[...path,family]);}}
  for(const r of d.recipes)visit(r.id);
 }
});
test('shared potency labels, owner-specific Bonded partners, new assignments and Claire Holy lightning resolve precisely',()=>{
 const levels=id=>approved.levels.filter(a=>a.familyId===id);assert.deepEqual([...new Set(levels('burn').map(a=>a.dps))],[4,8,32,64,240,600]);assert.deepEqual([...new Set(levels('lightning').map(a=>a.damage))],[24,96,250,1200,2500,7500]);
 for(const id of ['cleave-physical','cleave-magical','slow','slow-aura','anti-regeneration'])for(const group of Map.groupBy(levels(id),a=>a.level).values())assert.equal(group.length,1,id);
 const bonds=next.factions.find(f=>f.id==='forge').units.flatMap(u=>u.profiles.map(p=>({u,p,a:p.abilities.find(a=>a.familyId==='bonded-formation')}))).filter(x=>x.a);assert.equal(bonds.length,10);assert.equal(bonds.reduce((n,x)=>n+x.a.partnerIds.length,0),28);
 for(const f of next.factions){const claire=f.units.find(u=>u.id==='ladyclaire'),a=claire.profiles[0].abilities.find(a=>a.familyId==='lightning'&&a.level===3);assert.equal(a.damage,250);assert.equal(a.damageType,'profile');assert.equal(claire.profiles[0].type,'holy');}
 const hunt=towerStats({family:'el_twilight_huntress',tier:1},data.grove);assert.equal(hunt.abilities.filter(a=>a.familyId==='execution').length,1);assert.equal(hunt.multishot,5);
});
test('every current support glyph agrees with actual attributed bonuses inside and outside each radius',()=>{
 for(const d of Object.values(data)){d.towers.recipient={advanced:true,fr002:true,factionProfile:true,damage:1,range:1,interval:1,type:'physical',abilities:[]};for(const [family,u]of Object.entries(d.towers).filter(([id])=>id!=='recipient'))for(let tier=1;tier<=(u.advanced?1:6);tier++)for(const radius of [2,4,5.1,6.1]){const source={id:1,family,tier,state:'active',x:5,z:5},target={id:2,family:'recipient',tier:1,state:'active',x:5+radius,z:5},army=[source,target],actual=supportBonuses(target,army,d),visible=towerSupportState(target,army,d);assert.deepEqual(visible.bonuses,actual,`${family}/${tier}/${radius}`);for(const effect of visible.effects)assert.ok(effect.sourceIds.includes(source.id));}delete d.towers.recipient;}
});
