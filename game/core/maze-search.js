import {seededRandom} from './math.js';
import {PREPARED_MAZES} from './maze-seeds.js';
import {spiralCandidates} from './spiral-maze.js';
import {commanderWalls,COMMANDER_CORE} from './commander-maze.js';

export const mazeSnapshot=grid=>({size:grid.size,checkpoints:grid.checkpoints,terrain:[...grid.terrain],occupied:[...grid.occupied]});

// Allocation-light BFS, with exactly the game's E/S/W/N tie-breaking and all six legs.
export function mazeEvaluator(snapshot,budget){
  const n=snapshot.size,N=n*n,blocked=new Uint8Array(N),reserved=new Uint8Array(N),fixed=new Uint8Array(N);
  const id=p=>p.z*n+p.x,point=i=>({x:i%n,z:Math.floor(i/n)}),parse=k=>{const [x,z]=k.split(',').map(Number);return z*n+x;};
  for(const [key,type] of snapshot.terrain){const i=parse(key);reserved[i]=1;if(type==='blocked'||type==='decorative')blocked[i]=fixed[i]=1;}
  for(const [key] of snapshot.occupied)blocked[parse(key)]=fixed[parse(key)]=1;
  const cp=snapshot.checkpoints.map(id),queue=new Int32Array(N),seen=new Int32Array(N),prev=new Int32Array(N),neighbors=Array.from({length:N},(_,i)=>[i%n<n-1?i+1:-1,i+n<N?i+n:-1,i%n>0?i-1:-1,i>=n?i-n:-1]);
  const centre=new Uint8Array(N);for(let i=0;i<N;i++)centre[i]=Math.hypot(i%n-(n-1)/2,Math.floor(i/n)-(n-1)/2)<=10?1:0;
  let serial=0,evaluated=0;
  function evaluate(walls,full=false){
    const ids=[...new Set(walls)];let missing=0;
    for(const i of ids){if(i<0||i>=N||reserved[i])return null;if(!fixed[i])missing++;}
    if(missing>budget)return null;
    for(const i of ids)blocked[i]=1;
    let length=0,centralSteps=0;const route=[],segments=[];
    evaluated++;
    for(let leg=1;leg<cp.length;leg++){
      const start=cp[leg-1],end=cp[leg];let head=0,tail=1;queue[0]=start;seen[start]=++serial;prev[start]=-1;
      if(blocked[start]||blocked[end]){for(const i of ids)blocked[i]=fixed[i];return null;}
      while(head<tail&&seen[end]!==serial){const at=queue[head++];for(const next of neighbors[at])if(next>=0&&!blocked[next]&&seen[next]!==serial){seen[next]=serial;prev[next]=at;queue[tail++]=next;}}
      if(seen[end]!==serial){for(const i of ids)blocked[i]=fixed[i];return null;}
      let steps=0;const path=[];
      for(let at=end;at!==start;at=prev[at]){steps++;centralSteps+=centre[at];if(full)path.push(at);}
      length+=steps;segments.push(steps);
      if(full){path.push(start);path.reverse();route.push(...(leg===1?path:path.slice(1)));}
    }
    for(const i of ids)blocked[i]=fixed[i];
    return {ids,missing,length,centralSteps,segments,...(full?{route:route.map(point)}:{})};
  }
  return {evaluate,point,id,fixed,reserved,neighbors,get evaluated(){return evaluated;}};
}

export function describeMaze(snapshot,budget,walls,name='Custom maze'){
  const engine=mazeEvaluator(snapshot,budget),result=engine.evaluate(walls.map(engine.id),true);if(!result)return null;
  const occupied=new Set(snapshot.occupied.map(([k])=>k)),current=engine.evaluate([]).length;
  const cells=result.ids.map(engine.point),centre=(snapshot.size-1)/2;
  // Gold positions are real buildable wall cells near the middle, ranked by repeat exposure.
  const positions=cells.filter(p=>Math.hypot(p.x-centre,p.z-centre)<=6).map(p=>({...p,coverage:result.route.reduce((sum,q)=>sum+(Math.hypot(p.x-q.x,p.z-q.z)<=6?1:0),0)})).sort((a,b)=>b.coverage-a.coverage);
  const core=[];for(const p of positions)if(core.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>=2)){core.push(p);if(core.length===10)break;}
  const coverage=result.route.slice(1).filter(p=>core.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<=6)).length;
  return {name,walls:cells,missing:cells.filter(p=>!occupied.has(`${p.x},${p.z}`)),route:result.route,gates:[],core,coverage,centralSteps:result.centralSteps,segments:result.segments,currentLength:current,plannedLength:result.length};
}

// Search several topologies and improve candidates with legal path extensions.
// This is a bounded combinatorial search, not a mathematical optimality certificate.
export function searchMazeVariants(snapshot,budget,{effort=1,initialPlans=[],onProgress=()=>{}}={}){
  const n=snapshot.size,engine=mazeEvaluator(snapshot,budget),rng=seededRandom(6128+budget),archive=new Map();
  const score=(r,mode)=>mode===0?r.length*10000+r.centralSteps:mode===1?r.centralSteps*10+r.length*.15:(r.missing<=Math.min(budget,120)?r.length/(35+r.missing*.65):-Infinity);
  const leaders=[[],[],[]],seenLayouts=new Set();
  function offer(ids,label){
    const key=[...new Set(ids)].sort((a,b)=>a-b).join(',');if(seenLayouts.has(key))return null;seenLayouts.add(key);
    const r=engine.evaluate(ids);if(!r)return null;r.label=label;
    for(let mode=0;mode<3;mode++){const list=leaders[mode];if(!Number.isFinite(score(r,mode)))continue;if(list.length<12||score(r,mode)>score(list.at(-1),mode)){list.push(r);list.sort((a,b)=>score(b,mode)-score(a,mode));list.splice(12);}}
    return r;
  }
  offer([],'Open route');
  for(const plan of [...PREPARED_MAZES,...initialPlans]){const r=offer(plan.walls.map(engine.id),plan.topology||'Previous best');if(r)archive.set(r.ids.slice().sort((a,b)=>a-b).join(','),r);}
  const maxWalls=Math.min(13,Math.floor((budget+snapshot.occupied.length)/(n-2)));
  // Full sweeps, compressed central baffles, and interior-gate weaving lanes.
  for(const vertical of [false,true])for(let count=1;count<=Math.max(1,maxWalls);count++)for(const distribution of ['wide','core'])for(let shift=-4;shift<=4;shift++)for(const gapStyle of ['edge','inner','centre'])for(let phase=0;phase<2;phase++)for(const gapWidth of [1,2]){
    const ids=[];const start=distribution==='core'?Math.floor(n*.28):0,span=distribution==='core'?Math.ceil(n*.44):n;
    const rows=new Set();
    for(let k=0;k<count;k++){
      const cross=Math.round(start+(k+1)*span/(count+1))+shift;if(cross<1||cross>=n-1||rows.has(cross))continue;rows.add(cross);
      const side=(k+phase)%2,gap=gapStyle==='edge'?(side?n-1:0):gapStyle==='inner'?(side?n-8:7):(side?Math.round(n*.65):Math.round(n*.35));
      for(let j=0;j<n;j++)if(j!==gap&&!(gapWidth===2&&j===gap+(side?-1:1)))ids.push(vertical?j*n+cross:cross*n+j);
    }
    offer(ids,distribution==='core'?'Central weave':gapStyle==='edge'?'Grand switchback':'Crossfire lanes');
  }
  // Continuous spirals and their reflections provide topologies unlike parallel baffles.
  for(const spacing of [2,3,4,5])for(const reflect of [false,true])for(let rotation=0;rotation<4;rotation++){
    let left=0,right=n-1,top=0,bottom=n-1;const path=[];
    const push=(x,z)=>{for(let r=0;r<rotation;r++)[x,z]=[n-1-z,x];if(reflect)x=n-1-x;const i=z*n+x;if(!engine.reserved[i])path.push(i);};
    while(left<right&&top<bottom){for(let x=left;x<=right;x++)push(x,top);for(let z=top+1;z<=bottom;z++)push(right,z);for(let x=right-1;x>=left;x--)push(x,bottom);for(let z=bottom-1;z>=top+spacing;z--)push(left,z);left+=spacing;top+=spacing;right-=spacing;bottom-=spacing;}
    const ids=[];let missing=0;for(const i of [...new Set(path)]){if(!engine.fixed[i]&&++missing>budget)break;ids.push(i);}
    offer(ids,'Spiral gauntlet');
  }
  // Offset elbow chains: force turns in both axes, then let search improve endpoints.
  for(const vertical of [false,true])for(let count=2;count<=6;count++)for(const margin of [2,5,8])for(let shift=-2;shift<=2;shift++){
    const ids=[];
    for(let k=0;k<count;k++){const row=Math.round((k+1)*n/(count+1))+shift,side=k%2;for(let j=0;j<n-margin;j++){const x=side?n-1-j:j;ids.push(vertical?x*n+row:row*n+x);}const x=side?margin:n-1-margin;for(let d=1;d<=2;d++)ids.push(vertical?x*n+row+d:(row+d)*n+x);}
    offer(ids,'Hooked crossfire');
  }
  onProgress({evaluated:engine.evaluated,stage:'Extending routes'});
  // Keep several seeds per objective, retaining the strongest complete legal layout.
  const seeds=leaders.map(list=>list.slice(0,8));
  // Reclaim decorative dead-end pieces before spending more of the construction budget.
  // Preserve central firing foundations and the exact chosen path, including BFS ties.
  function prune(r){
    let current=engine.evaluate(r.ids,true);const route=current.route;
    for(const remove of r.ids){
      if(engine.fixed[remove]||Math.hypot(remove%n-(n-1)/2,Math.floor(remove/n)-(n-1)/2)<=6)continue;
      const trial=engine.evaluate(current.ids.filter(i=>i!==remove),true);
      if(trial&&trial.length===current.length&&trial.route.every((p,i)=>p.x===route[i].x&&p.z===route[i].z))current=trial;
    }
    return {...current,label:r.label};
  }
  for(let mode=0;mode<3;mode++)for(const initial of seeds[mode]){
    let best=prune(initial),current=best;const present=new Set(current.ids);
    // Greedy extension samples adjacent walls and the currently used shortest paths.
    const maxAdds=Math.min(budget-current.missing,80);
    for(let round=0;round<maxAdds&&current.missing<budget;round++){
      const detailed=engine.evaluate([...present],true),routeIds=detailed.route.map(engine.id);
      const candidates=[...new Set(routeIds)].filter(i=>!present.has(i)&&!engine.fixed[i]&&!engine.reserved[i]);
      // Prefer choke points, while deterministically covering the whole actual route.
      candidates.sort((a,b)=>engine.neighbors[b].filter(i=>present.has(i)||engine.fixed[i]).length-engine.neighbors[a].filter(i=>present.has(i)||engine.fixed[i]).length);
      let choice=null;
      for(const id of candidates.slice(0,Math.round(220*effort))){const r=engine.evaluate([...present,id]);if(r&&(!choice||score(r,mode)>score(choice,mode)))choice={...r,added:id,label:initial.label};}
      if(!choice||score(choice,mode)<=score(current,mode))break;
      present.add(choice.added);current=choice;if(score(current,mode)>score(best,mode))best=current;
    }
    // Relocate boundary pieces in pairs; these can move a gate without sealing it.
    for(let step=0;step<Math.round(900*effort);step++){
      const ids=current.ids,at=Math.floor(rng()*ids.length),remove=ids[at];if(remove===undefined||engine.fixed[remove])continue;
      const near=engine.neighbors[remove].filter(i=>i>=0&&!engine.reserved[i]&&!engine.fixed[i]&&!ids.includes(i));if(!near.length)continue;
      const add=near[Math.floor(rng()*near.length)],trial=ids.slice();trial[at]=add;
      const r=engine.evaluate(trial);if(!r)continue;r.label=initial.label;
      const gain=score(r,mode)-score(current,mode);
      const temperature=(1-step/Math.round(900*effort))*(mode===0?18000:1.5);
      if(gain>=0||(temperature>0&&rng()<Math.exp(gain/temperature))){current=r;if(score(r,mode)>score(best,mode))best=r;}
    }
    best=prune(best);const key=best.ids.slice().sort((a,b)=>a-b).join(',');archive.set(key,best);
    onProgress({evaluated:engine.evaluated,stage:'Comparing central firepower'});
  }
  for(const list of leaders)for(const r of list)archive.set(r.ids.slice().sort((a,b)=>a-b).join(','),r);
  const candidates=[...archive.values()],selected=[],names=['Longest found','Central stronghold','Lean crossfire'];
  for(let mode=0;mode<3;mode++){
    candidates.sort((a,b)=>score(b,mode)-score(a,mode));const choice=candidates.find(c=>Number.isFinite(score(c,mode))&&!selected.some(s=>s.ids.slice().sort((a,b)=>a-b).join(',')===c.ids.slice().sort((a,b)=>a-b).join(',')))||candidates[0];selected.push(choice);
  }
  const plans=selected.map((r,i)=>({...describeMaze(snapshot,budget,r.ids.map(engine.point),names[i]),id:['longest','central','early'][i],topology:r.label}));
  // Longest means longest actually measured; central exposure is only a tie-break.
  const absolute=candidates.sort((a,b)=>b.length-a.length||b.centralSteps-a.centralSteps)[0];
  plans[0]={...describeMaze(snapshot,budget,absolute.ids.map(engine.point),names[0]),id:'longest',topology:absolute.label};
  // Rank central finalists by actual union of firing circles, not just the search proxy.
  const centralFinalists=candidates.map(r=>({...describeMaze(snapshot,budget,r.ids.map(engine.point),names[1]),id:'central',topology:r.label})).filter(p=>p.coverage/Math.max(1,p.plannedLength)>=.6);
  centralFinalists.sort((a,b)=>b.coverage-a.coverage||b.plannedLength-a.plannedLength);
  if(centralFinalists.length)plans[1]=centralFinalists[0];
  // Preserve complete spiral topology instead of letting local edits turn it into baffles.
  // Two explicit alternatives expose the trade-off between total distance and core fire.
  const spirals=[];
  for(const candidate of spiralCandidates(n)){
    const result=engine.evaluate(candidate.walls.map(engine.id));
    if(result)spirals.push({...result,options:candidate.options});
  }
  spirals.sort((a,b)=>b.centralSteps*3+b.length-(a.centralSteps*3+a.length));
  const finalists=spirals.slice(0,40).map(r=>({...describeMaze(snapshot,budget,r.ids.map(engine.point)),options:r.options}));
  const crossfire=finalists.filter(p=>p.coverage/p.plannedLength>=.60).sort((a,b)=>b.coverage-a.coverage||b.plannedLength-a.plannedLength)[0]||finalists[0];
  if(crossfire)plans.push({...crossfire,id:'spiral',name:'Spiral crossfire',topology:'Interlocking spirals · central fire'});
  spirals.sort((a,b)=>b.length-a.length||b.centralSteps-a.centralSteps);
  const longestSpiral=spirals[0];
  if(longestSpiral){const p=describeMaze(snapshot,budget,longestSpiral.ids.map(engine.point),'Grand spiral');plans.push({...p,id:'spiral-long',topology:'Interlocking spirals · long approach'});}
  if(n===37){
    const drawn=describeMaze(snapshot,budget,commanderWalls(snapshot.checkpoints),"Commander's spiral");
    if(drawn){drawn.core=COMMANDER_CORE.map(p=>({...p}));drawn.coverage=drawn.route.slice(1).filter(p=>drawn.core.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<=6)).length;plans.push({...drawn,id:'commander',topology:'Your spiral · solid nine-defender central battery'});}
  }
  return {plans,evaluated:engine.evaluated,budget,provenOptimal:false};
}
