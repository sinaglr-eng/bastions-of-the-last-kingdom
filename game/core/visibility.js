import {distance,towerStats} from './math.js';
import {ENEMY_RULES} from './enemy-rules.js';

// Checkpoint beacons, close defenders and detection towers reveal the same enemy
// to the battlefield and to every defender. Draft candidates never detect.
export function enemyRevealed(enemy,game,observer=null){
  if(!enemy.cloaked)return true;
  const r=ENEMY_RULES.reveal;
  if(game.grid.checkpoints.some(point=>distance(point,enemy)<=r.checkpointRadius))return true;
  if(observer&&distance(observer,enemy)<=r.defenderRadius)return true;
  return game.towers.some(tower=>tower.state==='active'&&distance(tower,enemy)<=Math.max(r.defenderRadius,tower.family==='cleric'?r.clericRadius:towerStats(tower,game.data).detectionRange||0));
}
