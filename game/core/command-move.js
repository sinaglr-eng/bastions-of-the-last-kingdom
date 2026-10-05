import {cellKey} from './grid.js';

const constructionPhases=new Set(['build','select','ready','reward']);

// Move exchanges two existing occupants. No empty cell is created, so the
// exact maze route remains valid without removing and placing either tower.
export class CommandMove {
  constructor(game){this.game=game;this.active=false;this.defenderId=null;}
  get betweenWaves(){return constructionPhases.has(this.game.phase);}
  registered(tower){
    const {grid,towers}=this.game;
    if(!tower||!Number.isSafeInteger(tower.id)||!Number.isSafeInteger(tower.x)||!Number.isSafeInteger(tower.z)||!grid.inside(tower.x,tower.z))return false;
    const key=cellKey(tower.x,tower.z);
    return (grid.terrain.get(key)||'buildable')==='buildable'&&grid.occupied.get(key)===tower.id
      &&towers.filter(t=>t.id===tower.id).length===1
      &&towers.filter(t=>t.x===tower.x&&t.z===tower.z).length===1
      &&Array.isArray(grid.route)&&grid.route.length>0
      &&!grid.route.some(p=>p.x===tower.x&&p.z===tower.z);
  }
  get eligibleDefenders(){return this.betweenWaves?this.game.towers.filter(t=>t.state==='active'&&this.registered(t)):[];}
  get wallCandidates(){return this.betweenWaves?this.game.towers.filter(t=>t.state==='ruin'&&this.registered(t)):[];}
  get canBegin(){return !this.active&&this.eligibleDefenders.length>0&&this.wallCandidates.length>0;}
  get defender(){return this.active?this.eligibleDefenders.find(t=>t.id===this.defenderId)||null:null;}
  get validWalls(){return this.defender?this.wallCandidates:[];}
  begin(){if(!this.canBegin)return false;this.active=true;this.defenderId=null;return true;}
  cancel(){const changed=this.active||this.defenderId!==null;this.active=false;this.defenderId=null;return changed;}
  select(id){
    if(!this.active||!this.eligibleDefenders.some(t=>t.id===id))return false;
    this.defenderId=id;return true;
  }
  canTarget(id){return this.validWalls.some(t=>t.id===id);}
  execute(id,spend){
    const defender=this.defender,wall=this.validWalls.find(t=>t.id===id);
    if(!defender||!wall||typeof spend!=='function')return false;
    // The run owns CP. Its synchronous spend callback must succeed before any
    // board mutation; every invalid or cancelled destination costs nothing.
    if(spend()!==true)return false;
    const {x,z}=defender;defender.x=wall.x;defender.z=wall.z;wall.x=x;wall.z=z;
    this.game.grid.occupied.set(cellKey(defender.x,defender.z),defender.id);
    this.game.grid.occupied.set(cellKey(wall.x,wall.z),wall.id);
    this.game.grid.revision++;
    this.cancel();return true;
  }
}
