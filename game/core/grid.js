export const SIZE = 37;
// The fifth tile from the edge is index 4 (four full tiles before the checkpoint).
export const CHECKPOINTS = [
  {x:0,z:4}, // Warcamp entrance
  {x:4,z:18}, {x:32,z:18}, {x:32,z:4}, {x:18,z:4}, {x:18,z:32},
  {x:36,z:32} // Keep gate; only reaching the final route step costs lives.
];
export const cellKey = (x, z) => `${x},${z}`;
export class GridManager {
  constructor(size = SIZE, checkpoints = CHECKPOINTS, handcrafted = true) {
    this.size = size;
    this.checkpoints = checkpoints.map(p => ({...p}));
    this.terrain = new Map();
    this.occupied = new Map();
    this.revision = 0;
    if (handcrafted) this.createTerrain();
    this.route = this.findRoute();
  }
  createTerrain() {
    this.checkpoints.forEach((p,i) => this.terrain.set(cellKey(p.x,p.z), i === 0 ? 'spawn' : i === this.checkpoints.length-1 ? 'exit' : 'checkpoint'));
  }
  type(x,z) { return this.occupied.has(cellKey(x,z)) ? 'occupied' : this.terrain.get(cellKey(x,z)) || 'buildable'; }
  inside(x,z) { return x>=0 && z>=0 && x<this.size && z<this.size; }
  walkable(x,z,extra = null) {
    const key = cellKey(x,z), type = this.terrain.get(key);
    return this.inside(x,z) && type !== 'blocked' && type !== 'decorative' && !this.occupied.has(key) && key !== extra;
  }
  path(start,end,extra = null) {
    if (!this.walkable(start.x,start.z,extra) || !this.walkable(end.x,end.z,extra)) return null;
    const n=this.size, queue=new Int32Array(n*n), prev=new Int32Array(n*n).fill(-1);
    const source=start.z*n+start.x, target=end.z*n+end.x;
    let head=0,tail=1; queue[0]=source; prev[source]=source;
    while(head<tail) {
      const current=queue[head++];
      if(current===target) break;
      const x=current%n,z=Math.floor(current/n);
      for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1]]) {
        const nx=x+dx,nz=z+dz,index=nz*n+nx;
        if(this.walkable(nx,nz,extra) && prev[index]===-1) { prev[index]=current; queue[tail++]=index; }
      }
    }
    if(prev[target]===-1) return null;
    const result=[];
    for(let at=target;;at=prev[at]) {result.push({x:at%n,z:Math.floor(at/n)}); if(at===source)break;}
    return result.reverse();
  }
  findRoute(extra = null) {
    const route=[];
    for(let i=1;i<this.checkpoints.length;i++) {
      const path=this.path(this.checkpoints[i-1],this.checkpoints[i],extra);
      if(!path) return null;
      route.push(...(i===1?path:path.slice(1)));
    }
    return route;
  }
  canPlace(x,z) {
    if(!this.inside(x,z)) return {ok:false,reason:'Outside the battlefield'};
    if(this.type(x,z)!=='buildable') return {ok:false,reason:'Choose an empty grass tile'};
    const route=this.findRoute(cellKey(x,z));
    return route ? {ok:true,route} : {ok:false,reason:'Leave a path through every checkpoint'};
  }
  occupy(x,z,id) {
    const check=this.canPlace(x,z);
    if(!check.ok) return check;
    this.occupied.set(cellKey(x,z),id); this.route=check.route; this.revision++;
    return {ok:true};
  }
  remove(x,z) {this.occupied.delete(cellKey(x,z));this.route=this.findRoute();this.revision++;}
}
