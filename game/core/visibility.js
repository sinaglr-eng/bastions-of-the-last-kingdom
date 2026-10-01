import {distance,towerStats} from './math.js';

// Checkpoint beacons, close defenders and detection towers reveal the same enemy
// to the battlefield and to every defender. Draft candidates never detect.
export function enemyRevealed(enemy,game,observer=null){
  if(!enemy.cloaked)return true;
  if(game.grid.checkpoints.some(point=>distance(point,enemy)<=1.5))return true;
  if(observer&&distance(observer,enemy)<=2)return true;
  return game.towers.some(tower=>tower.state==='active'&&distance(tower,enemy)<=Math.max(2,tower.family==='cleric'?6:towerStats(tower,game.data).detectionRange||0));
}
