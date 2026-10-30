import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createFactionData} from '../game/core/factions.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {Game} from '../game/core/game.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const root='output/releases/v0.6.2/fr001/',current=read('data/factions-v060.json');
const baseline=JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+root+'baseline-registry.json.gz',import.meta.url))));
const ledger=read(root+'implementation.json');
test('FR-001 implements exactly 492 approved numeric values and 18 recipe deltas, preserving all unrelated current data',()=>{
 const restored=structuredClone(current),abilityKeys=new Set();
 assert.equal(ledger.numeric.length,492);assert.equal(ledger.recipes.length,18);
 for(const c of ledger.numeric){const u=restored.factions.find(f=>f.id===c.factionId).units.find(u=>u.id===c.unitId);let owner=u.profiles[c.rank-1];for(const k of c.path.slice(0,-1))owner=owner[k];assert.equal(owner[c.path.at(-1)],c.after);owner[c.path.at(-1)]=c.before;if(c.path[0]==='abilities')abilityKeys.add([c.factionId,c.unitId,c.rank,c.path[1]].join('/'));}
 for(const key of abilityKeys){const [f,id,rank,index]=key.split('/'),get=r=>r.factions.find(v=>v.id===f).units.find(u=>u.id===id).profiles[rank-1].abilities[index],a=get(restored),old=get(baseline);for(const k of ['text','levelId','levelLabel'])a[k]=old[k];assert.match(get(current).levelId,/-fr001-/);assert.notEqual(get(current).text,old.text);}
 assert.equal(abilityKeys.size,65);
 for(const c of ledger.recipes){const u=restored.factions.find(f=>f.id===c.factionId).units.find(u=>u.id===c.id);assert.deepEqual(u.recipe,c.after.map(i=>({id:i.family,rank:i.tier})));u.recipe=c.before.map(i=>({id:i.family,rank:i.tier}));}
 assert.deepEqual(restored,baseline,'Only approved numeric fields, recipes and matching ability copy/identity may change');
 const approval=read(root+'authority/output/design/faction-balance-fr001-20261030/approval.json');
 for(const [file,hash]of Object.entries(approval.approvedPatchManifest.hashes)){const bytes=fs.readFileSync(new URL('../'+root+'inputs/'+file.split('/').at(-1),import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);}
});
test('every faction-local basic rank has useful ordinary recipes and Claire remains a rank-V current-draft secret',()=>{
 for(const f of current.factions){const recipes=f.units.filter(u=>u.kind!=='basic');assert.equal(recipes.length,38);for(const u of f.units.filter(u=>u.kind==='basic'))for(let rank=1;rank<=6;rank++){const destinations=recipes.filter(r=>r.recipe.some(i=>i.id===u.id&&i.rank===rank));const ordinary=destinations.filter(r=>r.id!=='ladyclaire');assert.ok(ordinary.length>=1&&ordinary.length<=3,`${f.id}/${u.id}/${rank}`);assert.ok(destinations.length<=3);}
 const claire=recipes.find(u=>u.id==='ladyclaire');assert.deepEqual(claire,baseline.factions.find(v=>v.id===f.id).units.find(u=>u.id==='ladyclaire'));assert.equal(claire.recipe.length,3);assert.equal(new Set(claire.recipe.map(i=>i.id)).size,3);for(const i of claire.recipe){assert.equal(i.rank,5);assert.ok(f.units.find(u=>u.id===i.id&&u.kind==='basic'));}
 const visiting=new Set(),done=new Set();const visit=u=>{assert.ok(!visiting.has(u.id),'Acyclic champion dependencies');if(done.has(u.id))return;visiting.add(u.id);for(const i of u.recipe||[]){const child=f.units.find(v=>v.id===i.id);assert.ok(child);if(child.kind!=='basic')visit(child);}visiting.delete(u.id);done.add(u.id);};recipes.forEach(visit);
 }
});
test('implemented weapon and continuous projections match actual approved attack parameters',()=>{
 for(const f of current.factions.filter(f=>f.id!=='crown'))for(const u of f.units)for(const p of u.profiles){
  if(p.weaponCycle){const w=p.weaponCycle,m=p.cycleMetrics,cycle=(w.spinUpSeconds||0)+w.magazine*w.fixedInterval+w.reload;assert.ok(Math.abs(m.primaryDps-p.damage*w.magazine/cycle)<=.00501);assert.ok(Math.abs(m.cycleSeconds-cycle)<.001);assert.equal(m.reloadSeconds,w.reload);}
  if(p.continuousAttack){const a=p.abilities.find(a=>a.familyId==='flame-cone');assert.equal(a.dps,p.continuousAttack.dps);assert.equal(a.range,p.continuousAttack.range);assert.match(a.text.replaceAll(',',''),new RegExp(String(a.dps)+' damage/s'));}
 }
});
test('defender abilities follow rank controls, metrics, targeting and measured statistics for candidates and keepers',()=>{
 const raw=Object.fromEntries(['balance','towers','recipes','enemies','waves'].map(k=>[k,read('data/'+k+'.json')]));
 for(const faction of ['forge','grove']){const d=createFactionData(raw,current,faction),g=new Game(d,{seed:1});const family=faction==='forge'?'dw_musketeer':'el_spark_adept';const t={id:1,family,tier:1,state:'active',x:18,z:17,kills:0,cooldown:0};g.towers.push(t);for(const state of ['active','draft']){t.state=state;const html=defenderPanelMarkup(g,t,{peak:{dps:3}}),slot=html.indexOf('tower-effects defender-abilities');assert.ok(slot>html.indexOf('data-effective-stats'));assert.ok(slot>html.indexOf('Compare ranks'));assert.ok(slot>html.indexOf('defender-measured'));assert.match(html,/<ul class="tower-effects defender-abilities[\s\S]*<\/ul><\/section>$/);}}
});
