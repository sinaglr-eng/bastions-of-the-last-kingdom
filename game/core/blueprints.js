import {GridManager,SIZE,CHECKPOINTS,cellKey} from './grid.js';
import {describeMaze,mazeSnapshot} from './maze-search.js';
import {commanderWalls,COMMANDER_CORE} from './commander-maze.js';

export const BLUEPRINT_KEY='bastions.blueprints.v1';
export function measureCoreFire(route,core,range=6,speed=2){
  let steps=0,passes=0,inside=false,batterySteps=0;
  for(const p of route.slice(1)){
    const guns=core.filter(q=>Math.hypot(p.x-q.x,p.z-q.z)<=range).length;
    const covered=guns>0;
    if(covered){steps++;batterySteps+=guns;if(!inside)passes++;}
    inside=covered;
  }
  return {steps,passes,seconds:steps/speed,batterySeconds:batterySteps/speed,range,speed};
}
const reserved=new Set(CHECKPOINTS.map(p=>cellKey(p.x,p.z)));
export const validPlanCell=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.z)&&p.x>=0&&p.z>=0&&p.x<SIZE&&p.z<SIZE&&!reserved.has(cellKey(p.x,p.z));
export function validateBlueprint(walls,name='Custom maze'){
  if(!Array.isArray(walls)||walls.some(p=>!validPlanCell(p)))return {error:'Keep checkpoints and the entrance clear.'};
  const cells=[...new Map(walls.map(p=>[cellKey(p.x,p.z),{x:p.x,z:p.z}])).values()];
  if(cells.length>250)return {error:'A 50-wave campaign provides at most 250 building positions.'};
  const plan=describeMaze(mazeSnapshot(new GridManager()),250,cells,String(name).trim().slice(0,48)||'Custom maze');
  if(plan)plan.fire=measureCoreFire(plan.route,plan.core);
  return plan?{plan}:{error:'This wall layout seals a checkpoint. Erase a cell to reopen the route.'};
}
export function preparedBlueprints(presets){
  const useCore=(plan,core)=>{
    plan.core=core.map(({x,z})=>({x,z}));
    plan.coverage=plan.route.slice(1).filter(p=>plan.core.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<=6)).length;
    plan.fire=measureCoreFire(plan.route,plan.core);
    return plan;
  };
  const commander=validateBlueprint(commanderWalls(CHECKPOINTS),"Commander's spiral").plan;
  useCore(commander,COMMANDER_CORE);
  return [{...commander,id:'commander',topology:'Your spiral · solid nine-defender central battery'},...presets.map(p=>{
    const plan=validateBlueprint(p.walls,p.name).plan;
    if(p.core)useCore(plan,p.core);
    return {...plan,id:p.id,topology:p.topology,origin:p.origin||'reference'};
  })];
}
export function loadBlueprintLibrary(storage){
  try{
    const raw=JSON.parse(storage.getItem(BLUEPRINT_KEY)||'{}');
    const plans=Array.isArray(raw.plans)?raw.plans.slice(0,20).filter(p=>typeof p.id==='string'&&/^custom-[a-z0-9-]+$/.test(p.id)&&typeof p.name==='string').flatMap(p=>{
      const result=validateBlueprint(p.walls,p.name);return result.plan?[{...result.plan,id:p.id,topology:'Your saved blueprint'}]:[];
    }):[];
    return {plans,selected:typeof raw.selected==='string'?raw.selected:null};
  }catch{return {plans:[],selected:null};}
}
export function saveBlueprintLibrary(storage,plans,selected){
  try{storage.setItem(BLUEPRINT_KEY,JSON.stringify({version:1,selected,plans:plans.map(p=>({id:p.id,name:p.name,walls:p.walls.map(({x,z})=>({x,z}))}))}));return true;}catch{return false;}
}
export function blueprintProgress(plan,grid,budget,limit=250){
  const walls=plan.walls.map(p=>({...p})),keys=new Set(walls.map(p=>cellKey(p.x,p.z)));
  const missing=walls.filter(p=>!grid.occupied.has(cellKey(p.x,p.z)));
  // Only report progress and conflicts. Never relocate a chosen blueprint cell.
  const union=new GridManager();union.occupied=new Map(grid.occupied);
  for(const p of walls)union.occupied.set(cellKey(p.x,p.z),'plan');
  const route=union.findRoute();
  return {walls,missing,route,built:walls.length-missing.length,projected:union.occupied.size,limit,overBudget:missing.length>budget||union.occupied.size>limit,conflict:!route,offPlan:[...grid.occupied.keys()].filter(k=>!keys.has(k)).length};
}
export class BlueprintEditor {
  constructor(walls=[]){this.cells=new Map(walls.filter(validPlanCell).map(p=>[cellKey(p.x,p.z),{...p}]));this.undoStack=[];this.redoStack=[];this.stroke=null;}
  get walls(){return [...this.cells.values()].map(p=>({...p}));}
  begin(){if(!this.stroke)this.stroke=this.walls;}
  paint(x,z,erase=false){if(!validPlanCell({x,z}))return false;this.begin();const key=cellKey(x,z);if(erase){return this.cells.delete(key);}if(this.cells.has(key))return false;this.cells.set(key,{x,z});return true;}
  end(){if(!this.stroke)return;if(JSON.stringify(this.stroke)!==JSON.stringify(this.walls)){this.undoStack.push(this.stroke);this.undoStack=this.undoStack.slice(-100);this.redoStack=[];}this.stroke=null;}
  restore(walls){this.cells=new Map(walls.map(p=>[cellKey(p.x,p.z),{...p}]));}
  undo(){this.end();if(!this.undoStack.length)return false;this.redoStack.push(this.walls);this.restore(this.undoStack.pop());return true;}
  redo(){this.end();if(!this.redoStack.length)return false;this.undoStack.push(this.walls);this.restore(this.redoStack.pop());return true;}
  clear(){this.begin();this.cells.clear();this.end();}
  validate(name){return validateBlueprint(this.walls,name);}
}
