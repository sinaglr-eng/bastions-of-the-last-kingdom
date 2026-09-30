// Interlocking square spirals inspired by the supplied stone-and-cross layout.
// Boundary feeders split the outer field so traversals must wind through the centre.
// Coordinates are only suggestions: the caller validates every checkpoint with BFS.
export function spiralWalls(size,{radius,pitch,arms,inner,angle,mirror=false}){
  const centre=(size-1)/2,cells=new Map();
  const put=(x,z)=>{x=Math.round(mirror?size-1-x:x);z=Math.round(z);if(x>=0&&x<size&&z>=0&&z<size)cells.set(`${x},${z}`,{x,z});};
  for(let arm=0;arm<arms;arm++){
    const phase=arm*Math.PI*2/arms+angle;
    const place=(r,a)=>{const x=Math.cos(a),z=Math.sin(a),d=Math.max(Math.abs(x),Math.abs(z));put(centre+r*x/d,centre+r*z/d);};
    for(let r=centre;r>=radius;r-=.1)place(r,phase);
    const end=(radius-inner)/pitch*Math.PI*2;
    for(let t=0;t<=end;t+=.012)place(radius-pitch*t/(2*Math.PI),t+phase);
    place(inner,end+phase);
  }
  return [...cells.values()];
}

export function* spiralCandidates(size){
  for(const radius of [6,8,10,12,14])for(const pitch of [8,10,12])for(const arms of [2,4])for(const inner of [2,3])for(let rotation=0;rotation<12;rotation++)for(const mirror of [false,true]){
    const options={radius,pitch,arms,inner,angle:rotation*Math.PI/6+.24,mirror};
    yield {walls:spiralWalls(size,options),options};
  }
}
