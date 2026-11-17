import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIFACT_CATALOG as C,ARTIFACTS,ARTIFACT_CAPS,ARTIFACT_VERSION,artifactBonuses,artifactRangeDelta,artifactModifierText,equipArtifactSet,usesArtifactRulesV3} from '../game/core/artifacts.js';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {artifactBreakdownMarkup,artifactConditionsMarkup} from '../ui/artifact-summary.js';
import {fieldArtifactMarkup} from '../ui/commander-vault.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`),gear=id=>equipArtifactSet({},id);
const oldGear=id=>{const result={};for(const a of C.artifacts.filter(a=>a.setId===id&&Object.hasOwn(C.compatibilityEffects['fr011-v2'].itemModifiers,a.id))){const slot=a.slot==='ring'?(result.ring1?'ring2':'ring1'):a.slot;result[slot]=a.id;}return result;};

test('five set rarities have distinct piece counts and expanded sets preserve approved complete effects',()=>{
 assert.equal(C.artifacts.length,92);assert.equal(C.sets.length,12);
 const counts={common:2,uncommon:4,rare:6,epic:8,legendary:10};
 for(const rarity of C.rarities){const sets=C.sets.filter(set=>set.rarity===rarity.id);assert.ok(sets.length>=2,rarity.id);for(const set of sets){assert.equal(set.pieceCount,counts[rarity.id]);assert.equal(C.artifacts.filter(a=>a.setId===set.id).length,counts[rarity.id]);assert.equal(Object.keys(gear(set.id)).length,counts[rarity.id]);}}
 const expected={'iron-legion':{damage:.37,bossDamage:.12},'stormwing-vanguard':{speed:.31,controlResistance:.15},'ashen-dragon':{damage:.02,conditionalBurn:.10,burnFraction:.20},'watchmans-vigil':{keepHealth:2,controlResistance:.05}};
 for(const[id,values]of Object.entries(expected))for(const[key,value]of Object.entries(values))near(artifactBonuses(gear(id)).effects[key],value);
 assert.equal(Object.keys(C.compatibilityEffects['fr011-v2'].itemModifiers).length,84);
 for(const id of ['LG-07','LG-08','ST-07','ST-08','AD-07','AD-08','WV-01','WV-02'])assert.ok(!Object.hasOwn(C.compatibilityEffects['fr011-v2'].itemModifiers,id));
 assert.throws(()=>artifactBonuses({neck:'LG-07'},'fr011-v2'),/not available/);
});

test('v3 item range budgets retain identity and complete sets exceed every single range item',()=>{
 assert.equal(ARTIFACT_VERSION,'fr011-v3');assert.equal(C.catalogRevision,4);assert.equal(ARTIFACT_CAPS.rangeTiles,3);
 const values={'WC-01':.25,'WC-03':.5,'WC-05':.5,'AD-03':.5,'N-02':.25,'N-04':.25,'N-12':.5,'CE-01':.25,'CE-05':.25,'CE-07':.25,'CE-10':.25,'SC-01':.125,'SC-02':.125,'SC-03':.125,'SC-04':.125,'N-15':.75,'N-16':-1,'N-18':-.5};
 for(const[id,value]of Object.entries(values))near(ARTIFACTS[id].modifiers.rangeTiles,value);
 const maximum=Math.max(...C.artifacts.map(a=>a.modifiers.rangeTiles||0));near(maximum,.75);
 for(const[id,value]of Object.entries({'stormwing-vanguard':1.5,'winter-court':3,'ashen-dragon':1.5,'celestial':2.5,'scouts-trail':1.25})){const effects=artifactBonuses(gear(id)).effects;near(effects.rangeTiles,value);assert.ok(value>maximum);}
});

test('positive range is capped before penalties and its breakdown exposes discarded bonuses',()=>{
 near(artifactRangeDelta(4,-1),2);near(artifactRangeDelta(4,-.5),2.5);near(artifactRangeDelta(1,-1.5),-.5);near(artifactRangeDelta(0,-3),-2);
 const summary=artifactBonuses({...gear('winter-court'),gloves:'N-04',feet:'SC-04',ring2:'CE-10'});
 near(summary.effects.rangeTiles,3);near(summary.breakdown.range.positive,3.625);near(summary.breakdown.range.discarded,.625);
 const html=artifactBreakdownMarkup(summary);assert.match(html,/Items/);assert.match(html,/Sets/);assert.match(html,/Penalties/);assert.match(html,/above the cap/);assert.match(html,/after the cap/);
});

test('set Slow is self-contained and artifact bases remain strongest-only',()=>{
 const winter={head:'WC-05',neck:'WC-03',cloak:'WC-01',offhand:'WC-04'};
 near(artifactBonuses(winter).effects.slow,.04);
 near(artifactBonuses({...winter,chest:'NE-03'}).effects.slow,.04);
 near(artifactBonuses({ring1:'VC-02',weapon:'VC-06'}).effects.poisonFraction,.1);
 near(artifactBonuses({neck:'AD-02',weapon:'AD-06'}).effects.burnFraction,.12);
 near(artifactBonuses(gear('venom-covenant')).effects.poisonFraction,.2);
 near(artifactBonuses(gear('ashen-dragon')).effects.burnFraction,.2);
 near(artifactBonuses(gear('necromancer')).effects.shred,8);
 near(artifactBonuses(gear('necromancer')).effects.slow,.25);
 near(artifactBonuses(gear('necromancer')).effects.immunityReduction,.3);
});

test('v1 and v2 saved defenses keep their original aggregates and replay bytes',()=>{
 for(const[id,range]of Object.entries({'stormwing-vanguard':5,'winter-court':6,'ashen-dragon':3,'celestial':6,'scouts-trail':2}))near(artifactBonuses(oldGear(id),'fr011-v2').effects.rangeTiles,range);
 near(artifactBonuses({head:'N-15'},'fr011-v2').effects.rangeTiles,2);
 const winter={head:'WC-05',neck:'WC-03',cloak:'WC-01',offhand:'WC-04'};
 near(artifactBonuses(winter,'fr011-v2').effects.slow,0);near(artifactBonuses({...winter,chest:'NE-03'},'fr011-v2').effects.slow,.04);
 assert.equal(usesArtifactRulesV3('fr011-v2'),false);assert.equal(usesArtifactRulesV3({artifactVersion:'fr011-v3'}),true);
 for(const version of ['fr011-v1','fr011-v2','fr011-v3']){
  const data=currentFactionData('crown'),equipment=version==='fr011-v3'?gear('winter-court'):oldGear('winter-court'),g=new Game(data,{seed:312,artifactVersion:version,artifactEquipment:equipment});
  g.place(18,18);const snapshot=serializeRun(g),h=restoreRun(data,JSON.parse(JSON.stringify(snapshot)));assert.equal(h.artifactVersion,version);assert.deepEqual(serializeRun(h),snapshot);
 }
});

test('inactive powers and version-specific healing conditions are visible',()=>{
 const poison=artifactBonuses({gloves:'VC-04'}),burn=artifactBonuses({offhand:'AD-04'});
 assert.match(artifactConditionsMarkup(poison),/inactive.*artifact poison source/is);assert.match(artifactConditionsMarkup(burn),/inactive.*artifact burn source/is);
 assert.ok(!artifactBonuses({gloves:'VC-04',ring1:'VC-02'}).diagnostics.some(row=>row.key==='poisonPower'));
 const oldText=artifactModifierText(artifactBonuses(oldGear('venom-covenant'),'fr011-v2').effects,{version:'fr011-v2'}).join(' '),newText=artifactModifierText(artifactBonuses(gear('venom-covenant')).effects).join(' ');
 assert.match(oldText,/while artifact-poisoned/);assert.doesNotMatch(oldText,/native- or artifact/);assert.match(newText,/native- or artifact-poisoned/);
 assert.match(fieldArtifactMarkup({artifactEquipment:oldGear('winter-court'),artifactVersion:'fr011-v2'}),/\+6 attack range tiles/);
 assert.match(fieldArtifactMarkup({artifactEquipment:gear('winter-court'),artifactVersion:'fr011-v3'}),/\+3 attack range tiles/);
 assert.match(fieldArtifactMarkup({artifactEquipment:oldGear('stormwing-vanguard'),artifactVersion:'fr011-v2'}),/Stormwing Vanguard 6 \/ 6/);
 assert.match(fieldArtifactMarkup({artifactEquipment:gear('stormwing-vanguard'),artifactVersion:'fr011-v3'}),/Stormwing Vanguard 8 \/ 8/);
});
