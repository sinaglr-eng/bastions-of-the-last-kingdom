import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTIFACT_CATALOG as C,ARTIFACTS,rollArtifactChest} from '../game/core/artifacts.js';
import {CommanderVault} from '../ui/commander-vault.js';
import {homeMenuMarkup} from '../ui/home-menu.js';
import {PlayerClient} from '../game/player-client.js';
import {RunStore} from '../game/run-store.js';
import {IDBFactory} from 'fake-indexeddb';

test('every chest always grants Dust, can miss its artifact, and matches its advertised chance above 50 percent',()=>{
 assert.deepEqual(C.chests.map(c=>c.artifactChance),[60,70,80,90,95]);
 for(const chest of C.chests){let drops=0,misses=0;for(let seed=0;seed<4000;seed++){
  const r=rollArtifactChest({},chest.tier,seed);assert.ok(r.dustGained>=chest.baseDust);assert.equal(r.dust,r.dustGained);assert.equal(r.baseDust,chest.baseDust);
  if(r.items.length){drops++;assert.equal(r.items.length,chest.draws);assert.ok(r.items.every(i=>chest.weights[ARTIFACTS[i.id].rarity]>0));}else{misses++;assert.deepEqual(r.owned,[]);assert.equal(r.dustGained,chest.baseDust);}
 }assert.ok(misses>0);assert.ok(Math.abs(drops/40-chest.artifactChance)<3,`${chest.name}: observed ${drops/40}%`);}
});

test('the existing pity guarantee includes an artifact even after Dust-only openings',()=>{
 for(const chest of C.chests)for(let seed=0;seed<30;seed++){
  const r=rollArtifactChest({pity:{_rules:C.pityRulesVersion,[chest.tier]:chest.pityEvery-1}},chest.tier,seed);
  assert.equal(r.items.length,chest.draws);assert.ok(r.items.some(i=>C.rarities.findIndex(v=>v.id===ARTIFACTS[i.id].rarity)>=C.rarities.findIndex(v=>v.id===chest.pityRarity)));assert.equal(r.pity[chest.tier],0);
 }
});

test('Dust-only rewards have their own honest reward card and no artifact equip action',()=>{
 const v=new CommanderVault({player:{online:true,profile:{artifacts:{owned:[],equipment:{},counts:[],pity:{},dust:8}}},render(){},status(){}});
 const html=v.rewards({action:'open',tier:1,baseDust:3,dustGained:3,items:[]});assert.match(html,/vault-dust-reward/);assert.match(html,/\+3 Relic Dust/);assert.match(html,/No artifact this time/);assert.doesNotMatch(html,/data-vault-action="equip"/);
 v.chestTier=1;const page=v.chests();assert.ok(page.includes(`Always ${C.chests[0].baseDust} Relic Dust`));assert.match(page,/60% chance/);assert.match(page,/Dust only: 40%/);
});

test('an unverified terminal save is hidden even while its matching cloud snapshot still says playing',async()=>{
 const store=new RunStore({indexedDB:new IDBFactory()}),owner='finished-owner',id=crypto.randomUUID();
 try{await store.put(owner,{revision:0,meta:{runId:id,accountId:owner,progressionEpoch:'initial',phase:'lost'},snapshot:{},sync:{sequence:0,nextSequence:1}},[{runId:id,accountId:owner,sequence:0,batchId:crypto.randomUUID(),commands:[]}]);
  const p=new PlayerClient({store,fetcher:async()=>Response.json({run:{id,outcome:'playing',sequence:0}})});p.user={id:owner};
  assert.equal(await p.continuation(),null);assert.ok(await store.batch(id,1));assert.ok(await store.get(owner));
  const markup=homeMenuMarkup({player:p,saved:await store.get(owner)});assert.doesNotMatch(markup,/data-menu="continue"/);assert.match(markup,/No saved game/);
 }finally{store.close();}
});
