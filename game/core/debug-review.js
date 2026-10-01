import {GridManager} from './grid.js';

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
  const families=['druid','stormcaller','embercrown','mage','cleric','frostwarden','soldier','dawnspire'];
  let id=1;
  families.forEach((family,i)=>{
    const x=7+i*3,z=17;if(!game.grid.occupy(x,z,id).ok)return;
    game.towers.push({id:id++,family,tier:game.data.towers[family].advanced?1:4,state:'active',x,z,round:0,kills:0,priority:'first',cooldown:0});
  });
  game.nextId=id;game.startCombat();game.combat.spawnQueue=[{time:99999,type:'host_08',modifiers:{}}];
  for(let i=0;i<16;i++){
    const enemy=game.combat.spawn(i===15?'host_08':'host_06'),x=7+(i%8)*3,z=i<8?18:20;
    const index=enemy.route.findIndex(p=>p.x===x&&p.z===z);
    Object.assign(enemy,{x,z,pathIndex:Math.max(1,index+1),traveled:20+i,speed:0,hp:1e8,maxHp:1e8});
  }
  // A remote, permanently cloaked invader stays hidden outside reveal coverage.
  const hidden=game.combat.spawn('host_08');Object.assign(hidden,{x:18,z:7,speed:0,hp:1e8,maxHp:1e8});
  game.combat.total=18;game.emit('change');
}
