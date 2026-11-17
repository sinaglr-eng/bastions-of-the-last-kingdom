import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIFACT_SETS,artifactBonuses,equipArtifactSet} from '../game/core/artifacts.js';
import {ARTIFACT_SET_STORIES,artifactSetExplanation,artifactSetStoryMarkup,artifactSetExplanationMarkup} from '../ui/artifact-set-stories.js';

test('every current set has a distinct English chronicle and a complete-set explanation',()=>{
 const stories=[];
 for(const set of Object.values(ARTIFACT_SETS)){
  const story=ARTIFACT_SET_STORIES[set.id],summary=artifactBonuses(equipArtifactSet({},set.id)),copy=artifactSetExplanation(set,summary);
  assert.ok(story?.length>100,`${set.id} needs a story`);stories.push(story);
  assert.ok(copy.length>70,`${set.id} needs an explanation`);
  assert.doesNotMatch(copy,/Disarm|Dread|percentage points|\bpp\b/);
  assert.ok(artifactSetStoryMarkup(set).includes('From the chronicles'));
  assert.ok(artifactSetExplanationMarkup(set,summary).includes('vault-set-explanation'));
 }
 assert.equal(new Set(stories).size,Object.keys(ARTIFACT_SETS).length);
});

test('poison explanation connects cumulative power, total budget and actual HP example',()=>{
 const set=ARTIFACT_SETS['venom-covenant'],summary=artifactBonuses(equipArtifactSet({},set.id)),copy=artifactSetExplanation(set,summary);
 assert.match(copy,/\+100% artifact poison damage/);
 assert.match(copy,/20% total poison budget/);
 assert.match(copy,/100 HP creates 20 poison damage before the target’s Magical defenses/);
 assert.match(copy,/3 seconds/);
});

test('Vampire explanation promises capped recovery only after successful waves',()=>{
 const set=ARTIFACT_SETS['crimson-covenant'],summary=artifactBonuses(equipArtifactSet({},set.id)),copy=artifactSetExplanation(set,summary);
 assert.match(copy,/successfully completed wave/);
 assert.match(copy,/restore 1 missing keep health up to its existing maximum/);
 assert.match(copy,/does not increase maximum health/);
});

test('lore markup escapes external set identifiers and never interpolates HTML from names',()=>{
 assert.equal(artifactSetStoryMarkup({id:'<script>'}), '');
 assert.equal(artifactSetExplanationMarkup({id:'<script>'},{effects:{}}),'<p class="vault-set-explanation"></p>');
});
