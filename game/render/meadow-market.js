// The authored aisle graph follows the open ground between the castle's stalls.
// Reserve the corners of diagonal shortcuts as well as their endpoints.
export function meadowMarket(people,random=Math.random){
  if(!people.length)return ()=>{};
  const [points,links]=JSON.parse(people[0].userData.marketAisles);
  const walkers=people.map(node=>{
    const cell=node.userData.marketStart,[x,y]=points[cell],limbs=[];
    node.traverse(part=>{if(part.morphTargetInfluences?.length===8)limbs.push(part);});
    return {node,limbs,cell,x,y,baseX:node.position.x-x,baseZ:node.position.z+y,
      remaining:random()*1.7,duration:0,reserved:[cell],
      angle:2*Math.atan2(node.quaternion.y,node.quaternion.w),stride:random()*8};
  });
  function depart(w){
    const busy=new Set(walkers.filter(p=>p!==w).flatMap(p=>p.reserved));
    const options=[];
    for(const mid of links[w.cell]){
      if(busy.has(mid))continue;
      options.push([mid]);
      for(const end of links[mid]){
        if(end===w.cell||busy.has(end))continue;
        const corner=links[w.cell].find(other=>other!==mid&&links[other].includes(end));
        const diagonal=points[end][0]!==points[w.cell][0]&&points[end][1]!==points[w.cell][1];
        if(diagonal&&corner===undefined||busy.has(corner))continue;
        options.push(corner===undefined?[mid,end]:[mid,corner,end]);
      }
    }
    if(!options.length){w.remaining=.25+random()*.4;return;}
    const path=options[Math.floor(random()*options.length)],end=path.at(-1);
    w.reserved=[w.cell,...path];w.cell=end;w.fromX=w.x;w.fromY=w.y;
    w.toX=points[end][0]+.12*(random()-.5);w.toY=points[end][1]+.12*(random()-.5);
    w.duration=Math.hypot(w.toX-w.x,w.toY-w.y)/(.50+.43*random());
    w.remaining=w.duration;
  }
  return dt=>{
    for(const w of walkers){
      w.remaining-=dt;
      if(w.duration){
        const t=Math.min(1,1-w.remaining/w.duration),s=t*t*(3-2*t);
        const x=w.fromX+(w.toX-w.fromX)*s,y=w.fromY+(w.toY-w.fromY)*s;
        w.stride=(w.stride+Math.hypot(x-w.x,y-w.y)*9)%8;
        w.x=x;w.y=y;
        const yaw=Math.atan2(w.toX-w.fromX,w.fromY-w.toY)-w.angle;
        w.angle+=Math.max(-5*dt,Math.min(5*dt,Math.atan2(Math.sin(yaw),Math.cos(yaw))));
        if(t===1){w.duration=0;w.reserved=[w.cell];w.remaining=random()<.30?1+random()*3:.12;}
      }else if(w.remaining<=0)depart(w);
      w.node.position.x=w.baseX+w.x;w.node.position.z=w.baseZ-w.y;
      w.node.rotation.set(0,w.angle,0);
      const pose=Math.floor(w.stride),f=w.stride-pose;
      for(const part of w.limbs){
        const weights=part.morphTargetInfluences;weights.fill(0);weights[pose]=1-f;weights[(pose+1)%8]=f;
      }
    }
  };
}
