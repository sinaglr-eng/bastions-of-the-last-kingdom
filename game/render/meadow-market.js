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
      angle:2*Math.atan2(node.quaternion.y,node.quaternion.w),stride:random()*8,
      cycleDistance:node.userData.stepCycleDistance||.89,walking:0,turnTime:0};
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
    w.direction=Math.atan2(w.toX-w.x,w.fromY-w.toY);
    w.turnTime=Math.abs(Math.atan2(Math.sin(w.direction-w.angle),Math.cos(w.direction-w.angle)))/5;
    w.duration=Math.hypot(w.toX-w.x,w.toY-w.y)/(.50+.43*random());
    w.remaining=w.duration+w.turnTime;
  }
  return dt=>{
    for(const w of walkers){
      w.remaining-=dt;
      if(w.duration){
        const t=Math.max(0,Math.min(1,1-w.remaining/w.duration));
        // Start and end gently, then cover the bulk of the aisle at a steady pace.
        const ramp=.14, v=1/(1-ramp);
        const s=t<ramp?v*t*t/(2*ramp):t>1-ramp?1-v*(1-t)*(1-t)/(2*ramp):v*(t-ramp*.5);
        const x=w.fromX+(w.toX-w.fromX)*s,y=w.fromY+(w.toY-w.fromY)*s;
        w.stride=(w.stride+Math.hypot(x-w.x,y-w.y)*8/w.cycleDistance)%8;
        w.walking=Math.min(1,t/ramp,(1-t)/ramp);
        w.x=x;w.y=y;
        const yaw=w.direction-w.angle;
        w.angle+=Math.max(-5*dt,Math.min(5*dt,Math.atan2(Math.sin(yaw),Math.cos(yaw))));
        if(t===1){w.duration=0;w.reserved=[w.cell];w.remaining=random()<.30?1+random()*3:.12;}
      }else if(w.remaining<=0)depart(w);
      w.node.position.x=w.baseX+w.x;w.node.position.z=w.baseZ-w.y;
      w.node.rotation.set(0,w.angle,0);
      const pose=Math.floor(w.stride),f=w.stride-pose;
      for(const part of w.limbs){
        const weights=part.morphTargetInfluences;weights.fill(0);
        weights[pose]=(1-f)*w.walking;weights[(pose+1)%8]=f*w.walking;
      }
    }
  };
}
