import {ARTIFACTS,ARTIFACT_SETS,ARTIFACT_GEMS,CHESTS,RARITIES,validateArtifactEquipment,rollArtifactChest,chestTier,craftUnlockTier,equipArtifactSet,normalizeArtifactPity,artifactCraftGem,bossChestHasGem} from '../game/core/artifacts.js';
import {accountRank,promotionChestTier} from '../game/core/account-progression.js';
import {settleCompletedSeasons} from './season-rewards.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const parse=JSON.parse;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const uuid=value=>typeof value==='string'&&/^[a-f\d-]{36}$/i.test(value);
async function account(db,user){await db.prepare('INSERT OR IGNORE INTO artifact_accounts(user_id) VALUES(?)').bind(user).run();const r=await db.prepare('SELECT * FROM artifact_accounts WHERE user_id=?').bind(user).first();return {revision:r.revision,dust:r.dust,gems:{aquamarine:0,emerald:0,...parse(r.gems_json)},owned:parse(r.owned_json),equipment:parse(r.equipment_json),presets:parse(r.presets_json),pity:normalizeArtifactPity(parse(r.pity_json)),highestTier:r.highest_tier};}
async function ensureRankChests(db,user){
 const progress=await db.prepare(`SELECT xp_total AS xpTotal,
  (SELECT COALESCE(MAX(rank_level),1) FROM rank_chests WHERE user_id=?) AS lastLevel
  FROM account_progression WHERE user_id=? AND migrated=1`).bind(user,user).first();
 if(!progress)return;
 const upper=accountRank(progress.xpTotal).level,now=Date.now(),grants=[];
 for(let level=progress.lastLevel+1;level<=upper;level++){
  const tier=promotionChestTier(level);
  grants.push(db.prepare(`INSERT INTO rank_chests
   (id,user_id,rank_level,ordinal,tier,seed,earned_at) VALUES(?,?,?,1,?,?,?)
   ON CONFLICT(user_id,rank_level,ordinal) DO NOTHING`).bind(crypto.randomUUID(),user,level,tier,crypto.getRandomValues(new Uint32Array(1))[0],now));
 }
 if(grants.length)await db.batch(grants);
}
const unopenedChests=`SELECT id,run_id AS runId,boss_spawn_id AS bossSpawnId,boss_id AS bossId,wave,
 tier,seed,status,earned_at AS earnedAt,NULL AS rankLevel,NULL AS season FROM artifact_chests WHERE user_id=? AND status!='opened'
 UNION ALL SELECT id,NULL,NULL,NULL,NULL,tier,seed,'ready',earned_at,rank_level,NULL
 FROM rank_chests WHERE user_id=? AND opened_at IS NULL
 UNION ALL SELECT id,NULL,NULL,NULL,NULL,tier,seed,'ready',earned_at,NULL,season
 FROM season_chests WHERE user_id=? AND opened_at IS NULL`;
export async function artifactProfile(db,user,attempt=0){
 await settleCompletedSeasons(db);
 await ensureRankChests(db,user);
 const a=await account(db,user);
 const chests=(await db.prepare(`SELECT id,runId,bossSpawnId,bossId,wave,tier,status,earnedAt,rankLevel,season FROM (${unopenedChests}) ORDER BY earnedAt,id LIMIT 1000`).bind(user,user,user).all()).results;
 const counts=(await db.prepare(`SELECT tier,status,COUNT(*) AS count FROM (${unopenedChests}) GROUP BY tier,status`).bind(user,user,user).all()).results;
 const active=await db.prepare('SELECT run_id AS id FROM fr010_active WHERE user_id=?').bind(user).first(),confirmedBosses=active?{runId:active.id,ids:(await db.prepare('SELECT boss_spawn_id AS id FROM artifact_chests WHERE user_id=? AND run_id=?').bind(user,active.id).all()).results.map(r=>r.id)}:null;
 const r=await db.prepare('SELECT revision FROM artifact_accounts WHERE user_id=?').bind(user).first();if(r.revision!==a.revision){if(attempt>=5)fail('Artifact vault is busy. Please retry.',409);return artifactProfile(db,user,attempt+1);}
 const last=await db.prepare("SELECT receipt_json FROM artifact_receipts WHERE user_id=? AND json_extract(receipt_json,'$.action') IN ('open','craft') ORDER BY created_at DESC,request_id DESC LIMIT 1").bind(user).first();return {...a,chests,counts,confirmedBosses,lastOpening:last?parse(last.receipt_json):null};
}
export function artifactRewardStatements(db,user,runId,game,kills,guard,args){
 const statements=[],ended=['lost','won','abandoned'].includes(game.phase),now=Date.now();
 if(game.developerMode)return statements;
 for(const kill of kills){const tier=chestTier(kill.bossId,kill.wave);if(!tier)continue;const status=ended||game.completedWaves>=kill.wave?'ready':'locked',seed=crypto.getRandomValues(new Uint32Array(1))[0];
  statements.push(db.prepare(`INSERT OR IGNORE INTO artifact_chests(id,user_id,run_id,boss_spawn_id,boss_id,wave,tier,seed,status,earned_at) SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${guard}`).bind(crypto.randomUUID(),user,runId,kill.spawnId,kill.bossId,kill.wave,tier,seed,status,now,...args));
  statements.push(db.prepare(`INSERT INTO artifact_accounts(user_id,highest_tier) SELECT ?,? WHERE ${guard} ON CONFLICT(user_id) DO UPDATE SET highest_tier=MAX(highest_tier,excluded.highest_tier)`).bind(user,tier,...args));
 }
 statements.push(db.prepare(`UPDATE artifact_chests SET status='ready' WHERE user_id=? AND run_id=? AND status='locked' AND (wave<=? OR ?=1) AND ${guard}`).bind(user,runId,game.completedWaves||0,ended?1:0,...args));
 return statements;
}
export async function unlockArtifactChests(db,user,runId){await db.prepare("UPDATE artifact_chests SET status='ready' WHERE user_id=? AND run_id=? AND status='locked'").bind(user,runId).run();}
export async function artifactMutation(db,user,action,body){
 if(!uuid(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0)fail('Invalid artifact request.');
 const signature=JSON.stringify({action,tier:body.tier??null,count:body.count??null,equipment:body.equipment??null,artifactId:body.artifactId??null,preset:body.preset??null,index:body.index??null,...(body.ownedOnly!==undefined?{ownedOnly:body.ownedOnly}:{})});
 const old=await db.prepare('SELECT signature,receipt_json FROM artifact_receipts WHERE user_id=? AND request_id=?').bind(user,body.requestId).first();
 if(old){if(old.signature!==signature)fail('Request identity cannot change.',409);return {artifacts:await artifactProfile(db,user),receipt:parse(old.receipt_json)};}
 const a=await account(db,user);if(a.revision!==body.revision)fail('Artifact vault changed. Refresh and retry.',409);
 const next={...a,gems:{...a.gems},owned:[...a.owned],equipment:{...a.equipment},presets:[...a.presets],pity:{...a.pity}},receipt={id:body.requestId,action,items:[],dustGained:0,baseDust:0,newSets:[]},opened=[];
 if(action==='open'){
  if(!Number.isInteger(body.tier)||!CHESTS[body.tier]||![1,5].includes(body.count))fail('Choose one chest or five chests of the same tier.');
  await ensureRankChests(db,user);
  const selected=(await db.prepare(`SELECT id,seed,season,rankLevel,bossId,wave FROM (${unopenedChests}) WHERE tier=? AND status='ready' ORDER BY earnedAt,id LIMIT ?`).bind(user,user,user,body.tier,body.count).all()).results;if(selected.length!==body.count)fail('Not enough ready chests.',409);
  receipt.gemsGained={aquamarine:0,emerald:0};
  for(const chest of selected){
   const rolled=rollArtifactChest(next,body.tier,chest.seed);
   Object.assign(next,{owned:rolled.owned,pity:rolled.pity,dust:rolled.dust});
   receipt.items.push(...rolled.items.map(item=>({...item,chestId:chest.id})));
   receipt.dustGained+=rolled.dustGained;
   receipt.baseDust+=rolled.baseDust;
   // The persisted uniform 32-bit seed fixes the 50/50 reward across retries.
   if(bossChestHasGem(chest.bossId,chest.wave)){
    const gem=chest.seed%2===0?'aquamarine':'emerald';
    next.gems[gem]++;
    receipt.gemsGained[gem]++;
   }
   opened.push(chest);
  }
  receipt.tier=body.tier;receipt.chestIds=opened.map(chest=>chest.id);
 }else if(action==='equipment')next.equipment=validateArtifactEquipment(body.equipment,a.owned);
 else if(action==='craft'){
  const item=ARTIFACTS[body.artifactId];
  if(!item)fail('Unknown artifact.');
  if(a.owned.includes(item.id))fail('You already own this artifact.');
  if(a.highestTier<craftUnlockTier(item.rarity))fail('Earn a higher-tier boss chest to unlock this crafting rarity.');
  const cost=RARITIES[item.rarity].craft,gem=artifactCraftGem(item);
  if(a.dust<cost)fail('Not enough Relic Dust.');
  if(gem&&a.gems[gem]<1)fail(`You need 1 ${ARTIFACT_GEMS[gem]} to craft this artifact.`);
  if(gem){
   next.gems[gem]--;
   receipt.gemSpent=gem;
  }
  next.dust-=cost;
  next.owned.push(item.id);
  receipt.items=[{id:item.id,duplicate:false,dust:0}];
  receipt.dustSpent=cost;
 }else if(action==='salvage'){
  const id=body.artifactId;
  if(typeof id!=='string'||!Object.hasOwn(ARTIFACTS,id)||!a.owned.includes(id))fail('You do not own this artifact.');
  if(Object.values(a.equipment).includes(id))fail('Unequip this artifact before dismantling it.');
  const dust=RARITIES[ARTIFACTS[id].rarity].dust;
  next.owned=next.owned.filter(ownedId=>ownedId!==id);
  next.presets=next.presets.map(preset=>preset&&{
   ...preset,
   equipment:Object.fromEntries(Object.entries(preset.equipment).filter(([,artifactId])=>artifactId!==id)),
  });
  next.dust+=dust;
  receipt.artifactId=id;
  receipt.dustGained=dust;
 }else if(action==='save-preset'){
  if(!Number.isInteger(body.index)||body.index<0||body.index>2||!object(body.preset)||typeof body.preset.name!=='string'||body.preset.name.trim().length<1||body.preset.name.trim().length>32)fail('Choose a preset name of 1–32 characters.');
  next.presets[body.index]={name:body.preset.name.trim(),equipment:validateArtifactEquipment(body.preset.equipment,a.owned)};
 }else if(action==='equip-set'){
  const set=ARTIFACT_SETS[body.artifactId];if(!set)fail('Unknown artifact set.');if(body.ownedOnly!==undefined&&typeof body.ownedOnly!=='boolean')fail('Invalid set equipment mode.');const {ARTIFACT_CATALOG}=await import('../game/core/artifacts.js');const pieces=ARTIFACT_CATALOG.artifacts.filter(item=>item.setId===set.id);if(!body.ownedOnly&&pieces.some(item=>!a.owned.includes(item.id)))fail(`Collect all ${pieces.length} set pieces first.`);
  next.equipment=equipArtifactSet(a.equipment,set.id,a.owned,{ownedOnly:body.ownedOnly===true});
 }else fail('Unknown artifact action.');
 const {ARTIFACT_CATALOG}=await import('../game/core/artifacts.js');receipt.newSets=ARTIFACT_CATALOG.sets.filter(set=>{const ids=ARTIFACT_CATALOG.artifacts.filter(item=>item.setId===set.id).map(item=>item.id);return ids.every(id=>next.owned.includes(id))&&!ids.every(id=>a.owned.includes(id));}).map(s=>s.id);
 const now=Date.now(),guard='EXISTS(SELECT 1 FROM artifact_accounts WHERE user_id=? AND revision=?)',request='EXISTS(SELECT 1 FROM artifact_receipts WHERE user_id=? AND request_id=?)';
 // Receipt insertion is the transaction guard. Competing devices cannot consume
 // the same chest, Dust or vault revision; retries return the durable receipt.
 const statements=[db.prepare(`INSERT OR IGNORE INTO artifact_receipts(user_id,request_id,signature,receipt_json,created_at) SELECT ?,?,?,?,? WHERE ${guard}`).bind(user,body.requestId,signature,JSON.stringify(receipt),now,user,a.revision)];
 for(const chest of opened){
  let update="UPDATE artifact_chests SET status='opened',opened_at=? WHERE id=? AND user_id=? AND status='ready'";
  if(chest.season)update='UPDATE season_chests SET opened_at=? WHERE id=? AND user_id=? AND opened_at IS NULL';
  else if(chest.rankLevel!==null)update='UPDATE rank_chests SET opened_at=? WHERE id=? AND user_id=? AND opened_at IS NULL';
  statements.push(db.prepare(`${update} AND ${guard} AND ${request}`).bind(now,chest.id,user,user,a.revision,user,body.requestId));
 }
 statements.push(db.prepare(`UPDATE artifact_accounts SET dust=?,gems_json=?,owned_json=?,equipment_json=?,presets_json=?,pity_json=?,revision=revision+1 WHERE user_id=? AND revision=? AND ${request}`).bind(next.dust,JSON.stringify(next.gems),JSON.stringify([...new Set(next.owned)].sort()),JSON.stringify(next.equipment),JSON.stringify(next.presets),JSON.stringify(next.pity),user,a.revision,user,body.requestId));
 await db.batch(statements);const committed=await db.prepare('SELECT signature,receipt_json FROM artifact_receipts WHERE user_id=? AND request_id=?').bind(user,body.requestId).first();if(!committed)fail('Artifact vault changed. Refresh and retry.',409);if(committed.signature!==signature)fail('Request identity cannot change.',409);
 return {artifacts:await artifactProfile(db,user),receipt:parse(committed.receipt_json)};
}
