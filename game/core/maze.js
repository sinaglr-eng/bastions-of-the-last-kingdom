// Legacy baseline retained for regression comparisons. The game uses maze-search.js.
import {GridManager,cellKey} from './grid.js';

// Compare buildable serpentine layouts using the same ordered BFS as actual enemies.
// A useful long-route blueprint, not an assertion of a globally optimal maze.
export function recommendMaze(grid,budget=140,preferred=null) {
  const currentLength=grid.route.length-1;
  function evaluate(walls,name,gates=[]){
    const seen=new Set(),cells=[];
    for(const p of walls){const key=cellKey(p.x,p.z);if(seen.has(key)||!grid.inside(p.x,p.z))continue;seen.add(key);
      if(grid.terrain.has(key))return null;cells.push(p);
    }
    const missing=cells.filter(p=>!grid.occupied.has(cellKey(p.x,p.z)));
    if(missing.length>budget)return null;
    const preview=new GridManager(grid.size,grid.checkpoints,false);preview.terrain=new Map(grid.terrain);preview.occupied=new Map(grid.occupied);
    for(const p of missing)preview.occupied.set(cellKey(p.x,p.z),'blueprint');
    const route=preview.findRoute();if(!route)return null;
    return {walls:cells,missing,gates:gates.filter(p=>grid.walkable(p.x,p.z)),route,name,currentLength,plannedLength:route.length-1};
  }
  if(preferred){const result=evaluate(preferred.walls,preferred.name,preferred.gates);if(result)return result;}
  let best=evaluate([],'Open route');
  // Offset and orientation matter because checkpoints force several return journeys.
  for(const vertical of [false,true])for(let count=1;count<=4;count++)for(let shift=-2;shift<=2;shift++)for(let phase=0;phase<2;phase++){
    const walls=[],gates=[];
    for(let i=0;i<count;i++){
      const cross=Math.round((i+1)*grid.size/(count+1))+shift;
      if(cross<1||cross>=grid.size-1)continue;
      const gapAtStart=(i+phase)%2===0;
      for(let j=0;j<grid.size;j++){
        const p=vertical?{x:cross,z:j}:{x:j,z:cross};
        if(gapAtStart?j<2:j>=grid.size-2)gates.push(p);else walls.push(p);
      }
    }
    const candidate=evaluate(walls,vertical?'Switchback columns':'Switchback rows',gates);
    if(candidate&&(candidate.plannedLength>best.plannedLength||(candidate.plannedLength===best.plannedLength&&candidate.missing.length<best.missing.length)))best=candidate;
  }
  return best;
}
