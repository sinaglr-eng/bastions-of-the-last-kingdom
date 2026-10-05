import {GridManager} from './grid.js';

// DEV-only preview scenes retain campaign wave data and real draft/combat paths.
export function prepareWavePreviewReview(game,round){
  if(!Number.isInteger(round)||round<1||round>game.waveLimit)return false;
  game.commandMove.cancel();game.commandPoints.reset();game.draft.discardReserve();
  game.grid=new GridManager();game.towers=[];game.selected=null;game.selectedEnemy=null;game.previewRecipeId=null;
  game.round=round;game.phase='build';game.nextId=1;game.activeDraw=0;game.paused=false;game.speed=1;game.lives=30;
  game.combat.enemies=[];game.combat.spawnQueue=[];
  game.economy.setConstructionRound(round);game.draft.roll(game.economy.mastery);
  const guards=[['archer',3,16,17],['mage',3,18,17],['runebreaker',2,20,17],['cleric',2,17,19]];
  if(round>1)for(const [family,tier,x,z] of guards){
    const id=game.nextId++;if(!game.grid.occupy(x,z,id).ok)throw Error('Preview review tile unavailable');
    game.towers.push({id,family,tier,x,z,state:'active',round:0,kills:0,priority:'first',cooldown:0});
  }
  game.emit('change');return true;
}

// DEV-only deterministic choices exercise the real CP actions and boss death.
export function prepareCommandPointsReview(game){
  game.commandMove.cancel();game.commandPoints.reset();game.draft.discardReserve();
  game.grid=new GridManager();game.towers=[];game.selected=null;game.selectedEnemy=null;game.previewRecipeId=null;game.round=10;game.phase='build';game.nextId=1;game.activeDraw=0;game.paused=false;game.speed=1;game.lives=30;
  game.economy.setConstructionRound(game.round);game.draft.roll(game.economy.mastery);
  const choices=[['soldier',3],['archer',2],['mage',2],['druid',1],['cleric',1]],tiles=[[16,17],[18,17],[20,17],[17,19],[19,19]];
  choices.forEach(([family,tier],i)=>{game.draft.roundForced={family,tier};game.place(...tiles[i]);});game.draft.roundForced=null;
  for(const [x,z,state] of [[14,17,'active'],[22,17,'ruin']]){const id=game.nextId++;if(!game.grid.occupy(x,z,id).ok)throw new Error('CP review tile unavailable');game.towers.push({id,family:'soldier',tier:1,x,z,state,round:0,kills:0,priority:'first',cooldown:0});}
  game.select(game.draft.draws[0].towerId);game.emit('change');return true;
}

// DEV review reaches the actual construction transition into wave 25.
export function prepareConstructionTimingReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.selectedEnemy=null;game.previewRecipeId=null;game.round=24;game.phase='ready';game.lives=30;game.speed=1;game.paused=false;
  game.economy.setConstructionRound(game.round);game.startCombat();game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();game.emit('change');return true;
}

// Paused, explicit DEV scene for clicking real airborne invaders above a wall.
// Real damage creates inspectable missing HP; movement and regeneration keep
// their campaign values when the commander resumes the scene.
export function prepareEnemyInspectionReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.previewRecipeId=null;game.round=15;game.phase='ready';game.lives=30;game.speed=1;game.paused=false;
  for(const [id,family,tier,x,z,state] of [[1,'archer',2,13,17,'active'],[2,'cleric',3,22,17,'active'],[3,'soldier',1,15,20,'ruin']]){
    if(!game.grid.occupy(x,z,id).ok)throw new Error('Inspection review tile is unavailable');
    game.towers.push({id,family,tier,x,z,state,round:0,kills:0,priority:'first',cooldown:0});
  }
  game.nextId=4;game.startCombat();game.combat.spawnQueue=[{time:99999,type:'host_15',modifiers:{}}];game.combat.enemies=[];
  for(const [type,x,variant] of [['host_15',15,game.data.enemies.host_15.variants?.[0]],['host_15',22,game.data.enemies.host_15.variants?.[1]],['host_24',28,null]]){
    const enemy=game.combat.spawn(type,variant?{variant}:{});
    Object.assign(enemy,{x,z:20,route:[{x,z:20},{x:x+200,z:20}],pathIndex:1,pathLength:200});
    game.combat.damage(enemy,enemy.maxHp*.35,'pure',{},null);
  }
  game.combat.total=4;game.paused=true;game.emit('change');return true;
}

export function prepareSecretDraftReview(game,family='ladyclaire'){
  const recipe=game.recipes.find(r=>r.id===family&&r.currentRoundOnly);if(!recipe)return false;
  game.grid=new GridManager();game.towers=[];game.selected=null;game.round=16;game.phase='build';game.nextId=1;game.activeDraw=0;game.previewRecipeId=null;game.paused=false;
  game.draft.roll(15);
  const ingredients=[...recipe.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}];
  const tiles=[[17,18],[18,19],[19,18],[17,20],[19,20]];
  ingredients.forEach((ingredient,i)=>{game.draft.roundForced={...ingredient};game.place(...tiles[i]);});
  game.draft.roundForced=null;game.select(game.towers[0].id);game.previewRecipe(recipe.id);game.emit('change');return true;
}

// Explicit developer-only defense inspection. All defenses and guard stats
// come from real campaign entries; only layout, HP and movement are held.
export function prepareDefenseReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.previewRecipeId=null;game.round=14;game.phase='ready';game.lives=30;game.speed=1;game.paused=false;
  let id=1;
  for(const [family,x] of [['soldier',12],['soldier',17],['griffinbomber',22],['rimewatch',27]]){
    if(!game.grid.occupy(x,17,id).ok)throw new Error('Defense review guard tile is unavailable');
    game.towers.push({id:id++,family,tier:1,state:'active',x,z:17,round:0,kills:0,priority:'first',cooldown:0});
  }
  game.nextId=id;game.startCombat();game.combat.spawnQueue=[];game.combat.enemies=[];
  const wraith=game.data.enemies.host_31.variants.find(variant=>variant.physicalImmune&&!variant.magicImmune);
  if(!wraith)throw new Error('Defense review requires the actual physical-immune wraith variant');
  for(const [type,x,variant] of [['host_14',12],['host_14',17],['host_31',22,wraith],['host_16',27]]){
    const enemy=game.combat.spawn(type,variant?{variant}:{});
    Object.assign(enemy,{x,z:20,speed:0,hp:1e8,maxHp:1e8,route:[{x,z:20},{x,z:19}],pathIndex:1,pathLength:1});
  }
  // The first mirror remains a stable three-charge comparison. The second is
  // inside the real griffin range and loses/recharges shields through combat.
  game.combat.total=4;game.paused=true;game.emit('change');return true;
}

// Explicit development fixtures use the same importer and world renderer as
// play, with analytics disabled by the existing ?debug gate in main.js.
export function prepareEnemyReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.round=50;game.phase='ready';game.lives=30;game.paused=false;game.speed=1;
  game.startCombat();game.combat.spawnQueue=[];game.combat.enemies=[];
  for(const [i,type]of ['host_05','host_15','host_25','host_35','host_45','host_50'].entries()){
    const enemy=game.combat.spawn(type);enemy.x=i===5?18:6+i*6;enemy.z=i===5?23:14;
    enemy.route=[{x:enemy.x,z:enemy.z},{x:enemy.x,z:enemy.z-1}];enemy.pathIndex=1;
    // Hold the lineup in view while the real renderer animates its flying rigs.
    enemy.speed=0;
  }
  game.paused=true;game.emit('change');
}
export function prepareRecipeMarkerReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.round=1;game.phase='build';game.nextId=1;game.activeDraw=0;game.previewRecipeId=null;
  game.draft.roll(0);
  const families=['frostwarden','soldier','stormcaller','druid','archer'];
  families.forEach((family,i)=>{game.draft.roundForced={family,tier:1};game.place(15+i,18);});
  game.select(game.towers[0].id);
  const recipe=game.data.recipes.find(r=>game.data.towers[r.id].name==='Frostbolt Watchmen');
  if(recipe)game.previewRecipe(recipe.id);game.emit('change');
}

// Repeatable development-only scene for reviewing imported rigs and the combat panel.
export function prepareBattleReview(game,boss=false){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.score=0;game.kills=0;game.leaks=0;game.lives=30;game.round=boss?10:6;game.phase='ready';game.speed=1;game.paused=false;
  const families=['highking','verdantguard','embercrown','dawnspire','roseguard','greenheart','sunward'];
  let id=1;
  for(let x=6;x<=30;x++){
    if(!game.grid.occupy(x,17,id).ok)continue;
    const family=families[Math.floor((x-6)/4)],active=(x-6)%4===0;
    game.towers.push({id:id++,family:active?family:'soldier',tier:1,state:active?'active':'ruin',x,z:17,round:0,kills:0,priority:'first',cooldown:0});
  }
  game.nextId=id;game.startCombat();game.combat.spawnQueue=[];
  for(let i=0;i<(boss?1:10);i++){
    const enemy=game.combat.spawn(boss?'host_10':'host_06');
    const index=enemy.route.findIndex(p=>p.x===10+i&&p.z===18);
    enemy.pathIndex=Math.max(1,index+1);enemy.x=10+i;enemy.z=18;enemy.traveled=25+i;
    if(!boss)enemy.hp=enemy.maxHp=450;
  }
  game.combat.total=boss?1:11;
  // Keep the round open so corpses can be inspected before end-of-wave cleanup.
  if(!boss)game.combat.spawnQueue=[{time:99999,type:'host_06',modifiers:{}}];
  game.emit('change');
}

// An explicit developer tool exercises spell families and a veiled target.
// Production builds never expose the action that invokes this fixture.
export function prepareSpellReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.lives=30;game.round=8;game.phase='ready';game.speed=1;game.paused=false;
  const families=['archer','soldier','mage','druid','stormcaller','embercrown','cleric','frostwarden','dawnspire'];
  let id=1;
  families.forEach((family,i)=>{
    const x=6+i*3,z=17;if(!game.grid.occupy(x,z,id).ok)return;
    game.towers.push({id:id++,family,tier:game.data.towers[family].advanced?1:4,state:'active',x,z,round:0,kills:0,priority:'first',cooldown:0});
  });
  game.nextId=id;game.startCombat();game.combat.spawnQueue=[{time:99999,type:'host_08',modifiers:{}}];
  for(let i=0;i<families.length*2;i++){
    const enemy=game.combat.spawn(i===families.length*2-1?'host_08':'host_06'),x=6+(i%families.length)*3,z=i<families.length?18:20;
    const index=enemy.route.findIndex(p=>p.x===x&&p.z===z);
    Object.assign(enemy,{x,z,pathIndex:Math.max(1,index+1),traveled:20+i,speed:0,hp:1e8,maxHp:1e8});
  }
  // A remote, permanently cloaked invader stays hidden outside reveal coverage.
  const hidden=game.combat.spawn('host_08');Object.assign(hidden,{x:18,z:7,speed:0,hp:1e8,maxHp:1e8});
  game.combat.total=families.length*2+2;game.emit('change');
}

// Real aura providers and enemy suppression, using unchanged campaign data.
export function prepareSupportReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.lives=30;game.round=17;game.phase='ready';game.speed=1;game.paused=false;
  const placements=[['monk',11,14,1],['mothernature',15,14,1],['mage',13,16,4],['archer',12,18,3],['cleric',10,18,4],['soldier',26,17,3],['frostwarden',27,20,3],['soldier',29,17,1]];
  let id=1;
  placements.forEach(([family,x,z,tier],index)=>{
    if(!game.grid.occupy(x,z,id).ok)return;
    game.towers.push({id:id++,family,tier,state:index===7?'ruin':'active',x,z,round:0,kills:0,priority:'first',cooldown:0,...(index===7?{weakened:99999}:{})});
  });
  game.nextId=id;game.startCombat();game.combat.spawnQueue=[{time:99999,type:'host_17',modifiers:{}}];
  for(const [type,x,z]of [['host_06',13,19],['host_17',25,18],['host_12',26,19]]){
    const enemy=game.combat.spawn(type),index=enemy.route.findIndex(p=>p.x===x&&p.z===z);
    Object.assign(enemy,{x,z,pathIndex:Math.max(1,index+1),traveled:20,speed:0,hp:1e8,maxHp:1e8});
  }
  game.combat.total=4;game.selected=3;game.emit('change');
}

// DEV-only caller: a real stealth/disarm invader walks through two ordinary
// soldiers' shared reveal coverage, with its authored movement and abilities.
export function prepareConcealmentReview(game){
  game.grid=new GridManager();game.towers=[];game.selected=null;game.round=18;game.phase='ready';game.lives=30;game.nextId=1;game.previewRecipeId=null;game.paused=false;game.speed=1;
  for(const [x,z]of [[12,17],[25,17]]){
    const id=game.nextId++;game.grid.occupy(x,z,id);
    game.towers.push({id,family:'soldier',tier:1,state:'active',x,z,round:0,kills:0,priority:'first',cooldown:0});
  }
  game.startCombat();game.combat.spawnQueue=[];
  const enemy=game.combat.spawn('host_18');
  const route=[[12,18.5],[12,24],[25,24],[25,19],[25,14],[12,14],[12,18.5]].map(([x,z])=>({x,z}));
  const pathLength=route.slice(1).reduce((length,p,i)=>length+Math.hypot(p.x-route[i].x,p.z-route[i].z),0);
  Object.assign(enemy,{x:12,z:18.5,route,pathLength,pathIndex:1,traveled:0,hp:1e8,maxHp:1e8});
  game.combat.total=1;game.selected=1;game.emit('change');return enemy;
}

// DEV-only caller: five real placements, exactly one available rank-merge pair.
// Forcing a reveal uses the same draft path as the existing review tools.
export function prepareMergeReview(game,family='archer',tier=3){
  const stats=game.data.towers[family];
  if(!stats||stats.advanced||!Number.isInteger(tier)||tier<1||tier>=game.data.balance.tiers.length)return false;
  const others=Object.entries(game.data.towers).filter(([id,entry])=>id!==family&&!entry.advanced).slice(0,3).map(([family])=>({family,tier:1}));
  if(others.length!==3)return false;
  game.grid=new GridManager();game.towers=[];game.selected=null;game.round=1;game.phase='build';game.nextId=1;game.activeDraw=0;game.previewRecipeId=null;game.paused=false;game.speed=1;
  game.combat.enemies=[];game.combat.projectiles=[];game.combat.spawnQueue=[];
  game.draft.roll(0);
  const recruits=[{family,tier},{family,tier},...others];
  recruits.forEach((recruit,index)=>{
    game.draft.roundForced={...recruit};
    if(!game.place(15+index,18))throw new Error('Merge review placement failed');
  });
  game.draft.roundForced=null;game.select(game.towers[0].id);return true;
}
