import * as THREE from 'three';
import {distance,towerStats} from '../core/math.js';

// Read-only display of the actual rules in supportBonuses/CombatManager.
// A source includes itself in the current game. Maxima win inside each haste
// group, different groups add, and the remaining auras use their strongest value.
export const SUPPORT_EFFECT_STYLES=Object.freeze({
  haste:Object.freeze({label:'Attack speed',color:'#53dcff',glyph:'clock'}),
  damage:Object.freeze({label:'Damage',color:'#ffc36b',glyph:'blade'}),
  range:Object.freeze({label:'Range',color:'#54e5c1',glyph:'arrows'}),
  controlResistance:Object.freeze({label:'Control protection',color:'#b393ff',glyph:'shield'}),
  trueStrike:Object.freeze({label:'Unfailing aim',color:'#fff8e4',glyph:'target'}),
  dread:Object.freeze({label:'Dread',color:'#dd71df',glyph:'spiral'}),
  disarm:Object.freeze({label:'Disarmed',color:'#ff7976',glyph:'cross'}),
  weakened:Object.freeze({label:'Barricade disruption',color:'#e69b69',glyph:'crack'}),
});
export const ENEMY_EFFECT_STYLES=Object.freeze({
  slow:Object.freeze({label:'Slowed',color:'#71d1e6',glyph:'clock'}),
  freeze:Object.freeze({label:'Frozen / stunned',color:'#cef6ff',glyph:'snowflake'}),
  petrify:Object.freeze({label:'Petrified',color:'#c5c0a1',glyph:'diamond'}),
  poison:Object.freeze({label:'Poison',color:'#a9e363',glyph:'drop'}),
  burn:Object.freeze({label:'Burning',color:'#ff9a51',glyph:'flame'}),
  bleed:Object.freeze({label:'Bleeding',color:'#ff747c',glyph:'drop'}),
  armor:Object.freeze({label:'Armor reduced',color:'#ffd088',glyph:'crack'}),
  magic:Object.freeze({label:'Magic resistance reduced',color:'#c9a7ff',glyph:'brokenStar'}),
  healBlock:Object.freeze({label:'Healing blocked',color:'#ffc0d0',glyph:'cross'}),
});
const positiveKeys=['haste','damage','range','controlResistance','trueStrike'];
const negativeKeys=['dread','disarm','weakened'];
// One legible wall hue, in the same stable order as the effect legend. Every
// simultaneous effect retains its own independent glyph and halo segment.
export const SUPPORT_TINT_PRIORITY=Object.freeze([...positiveKeys,...negativeKeys]);
export const supportTintKey=state=>SUPPORT_TINT_PRIORITY.find(key=>state.byKey[key])||null;
const percent=n=>`${Math.round(n*100)}%`;
const unique=values=>[...new Set(values)];
const combatActive=options=>!!options.combat&&(options.phase??options.combat.game?.phase??'combat')==='combat';
function prepared(towers,data){
  const stats=new Map(),sources=[],bins=new Map();let largest=0;
  for(const tower of towers){
    if(tower.state!=='active'||!data.towers[tower.family])continue;
    const key=`${tower.family}:${tower.tier}:${tower.upgrades||0}`;
    if(!stats.has(key))stats.set(key,towerStats(tower,data));
    const spec=stats.get(key),aura=spec.aura;
    if(!aura||!(aura.range>=0))continue;
    const source={tower,stats:spec,aura};sources.push(source);largest=Math.max(largest,aura.range);
    const bin=`${Math.floor(tower.x/8)}:${Math.floor(tower.z/8)}`;
    if(!bins.has(bin))bins.set(bin,[]);bins.get(bin).push(source);
  }
  return {sources,stats,bins,largest,data};
}
function nearby(tower,context){
  const found=[],r=context.largest;
  for(let x=Math.floor((tower.x-r)/8);x<=Math.floor((tower.x+r)/8);x++)for(let z=Math.floor((tower.z-r)/8);z<=Math.floor((tower.z+r)/8);z++){
    for(const source of context.bins.get(`${x}:${z}`)||[])if(distance(tower,source.tower)<=source.aura.range)found.push(source);
  }
  return found;
}
function contributor(source,value,group){return {id:source.tower.id,family:source.tower.family,name:source.stats.name,value,...(group?{group}:{})};}
function maximize(record,key,value,source,group){
  if(!(value>0))return;
  const previous=record.get(key);
  if(!previous||value>previous.amount)record.set(key,{amount:value,sources:[contributor(source,value,group)]});
  else if(value===previous.amount&&!previous.sources.some(s=>s.id===source.tower.id))previous.sources.push(contributor(source,value,group));
}
function effect(key,value,amount,sources=[],extra={}){
  const style=SUPPORT_EFFECT_STYLES[key];
  const label=key==='haste'?`Attack speed +${percent(amount)}`:key==='damage'?`Damage +${percent(amount)}`:key==='range'?`Range +${value} tiles`:key==='controlResistance'?`Control protection ${percent(value)}`:key==='trueStrike'?'Unfailing aim · ignores evasion':key==='dread'?`Dread · attack speed −${percent(amount)}`:key==='weakened'?`Barricade disruption · attack speed −${percent(amount)}`:'Disarmed · cannot attack';
  return {key,...style,label,value,amount,sourceIds:unique(sources.map(s=>s.id)),sources,...extra};
}
export function towerSupportState(tower,towers,data,options={}){
  const state={towerId:tower?.id,active:tower?.state==='active',bonuses:{haste:1,damage:1,range:0},effects:[],byKey:{}};
  if(!state.active)return state;
  const context=options.context||prepared(towers,data),groups=new Map(),other=new Map();
  for(const source of nearby(tower,context)){
    const a=source.aura;
    if(a.haste)maximize(groups,a.stackKey||'strongest',a.haste,source,a.stackKey||'strongest');
    for(const [key,value]of Object.entries(a.hasteGroups||{}))maximize(groups,key,value,source,key);
    maximize(other,'damage',a.damageBonus,source);maximize(other,'range',a.rangeBonus,source);
    maximize(other,'trueStrike',a.trueStrike?1:0,source);maximize(other,'controlResistance',a.controlResistance,source);
  }
  const haste=[...groups.values()].reduce((total,g)=>total+g.amount,0);
  state.bonuses.haste=1+haste;state.bonuses.damage=1+(other.get('damage')?.amount||0);state.bonuses.range=other.get('range')?.amount||0;
  if(haste)state.effects.push(effect('haste',1+haste,haste,[...groups.values()].flatMap(g=>g.sources),{groups:[...groups].map(([key,g])=>({key,amount:g.amount,sourceIds:g.sources.map(s=>s.id)}))}));
  for(const key of positiveKeys.slice(1)){
    const entry=other.get(key);if(!entry)continue;
    const value=key==='damage'?1+entry.amount:key==='trueStrike'?true:entry.amount;
    if(key==='trueStrike'||key==='controlResistance')state.bonuses[key]=value;
    state.effects.push(effect(key,value,entry.amount,entry.sources));
  }
  if(combatActive(options)){
    const combat=options.combat,resist=state.bonuses.controlResistance||0,dread=[],disarm=[],ruins=[];
    for(const enemy of combat.enemies||[]){
      if(enemy.dead)continue;const d=distance(tower,enemy);
      const amount=(enemy.untouchable||0)*(1-resist);
      if(amount>0&&d<4)dread.push({id:enemy.id,family:enemy.type,name:enemy.name||enemy.type||'Invader',value:amount});
      if(enemy.disarm&&d<3&&((combat.elapsed||0)+enemy.id*.37)%8<1.25*(1-resist))disarm.push({id:enemy.id,family:enemy.type,name:enemy.name||enemy.type||'Invader',value:true});
    }
    if(dread.length){const strongest=Math.max(...dread.map(s=>s.value));state.effects.push(effect('dread',strongest,strongest,dread.filter(s=>s.value===strongest)));}
    if(disarm.length)state.effects.push(effect('disarm',true,1,disarm));
    for(const ruin of towers)if(ruin.state==='ruin'&&ruin.weakened>0&&distance(tower,ruin)<2)ruins.push({id:ruin.id,family:ruin.family,name:'Scorched barricade',value:.15});
    if(ruins.length){const penalty=1-Math.pow(.85,ruins.length);state.effects.push(effect('weakened',penalty,penalty,ruins));}
  }
  state.byKey=Object.fromEntries(state.effects.map(e=>[e.key,e]));return state;
}
export const supportLegend=(tower,towers,data,options={})=>towerSupportState(tower,towers,data,options).effects;

export function supportSourceAreas(tower,data,{towers=[]}={}){
  if(tower?.state!=='active'||!data.towers[tower.family])return [];
  const s=towerStats(tower,data),areas=[];
  if(s.aura){const a=s.aura,keys=positiveKeys.filter(k=>k==='haste'?a.haste||Object.values(a.hasteGroups||{}).some(v=>v>0):k==='damage'?a.damageBonus:k==='range'?a.rangeBonus:a[k]);if(keys.length)areas.push({key:'support',keys,radius:a.range,label:`Support reach · ${a.range} tiles`,color:'#86f0c9',glyph:'arrows'});}
  const debuffs=[['burnAura','burn','Burning aura','#ff9a51'],['slowAura','slow','Slowing aura','#71d1e6'],['armorShredAura','armor','Armor reduction aura','#ffd088'],['magicShredAura','magic','Magic vulnerability aura','#c9a7ff']];
  for(const [prop,key,label,color]of debuffs)if(s[prop]){
    const radius=prop==='burnAura'?s.range+towerSupportState(tower,towers,data).bonuses.range:(prop==='slowAura'?s.range:s.effectRange??s.range);
    areas.push({key,keys:[key],radius,label:`${label} · ${radius} tiles`,color,glyph:ENEMY_EFFECT_STYLES[key].glyph});
  }
  const detection=tower.family==='cleric'?6:s.detectionRange||0;
  if(detection)areas.push({key:'detection',keys:['detection'],radius:Math.max(2,detection),label:`Hidden-enemy detection · ${Math.max(2,detection)} tiles`,color:'#fff8e4',glyph:'target'});
  if(s.bouncingFrostTrigger==='nearby-ally-magic-hit')areas.push({key:'reaction',keys:['reaction'],radius:s.bouncingFrostTriggerRange||6,label:`Reacts to allied magic hits · ${s.bouncingFrostTriggerRange||6} tiles`,color:'#a5ddff',glyph:'snowflake'});
  return areas;
}

// Persistent enemy markers fill the gap between one-shot attack/impact FX and
// the actual effects remaining on an enemy. They never reveal a cloaked enemy.
export function enemyStatusState(enemy,towers,data,options={}){
  if(enemy.dead)return [];
  const statuses=enemy.statuses||{},effects=new Map();
  const add=(key,value)=>{if(value>0)effects.set(key,{key,...ENEMY_EFFECT_STYLES[key],value:Math.max(value,effects.get(key)?.value||0)});};
  let slow=Math.max(statuses.slow?.amount||0,statuses.gazeSlow?.amount||0),armor=statuses.shred?.amount||0,magic=statuses.shredMagic?.amount||0;
  for(const tower of towers){
    if(tower.state!=='active')continue;const s=options.statsFor?options.statsFor(tower):towerStats(tower,data),d=distance(tower,enemy);
    if(!enemy.magicImmune&&s.slowAura&&d<=s.range)slow=Math.max(slow,s.slowAura);
    if((!enemy.magicImmune||s.auraPiercesImmunity)&&d<=(s.effectRange??s.range)){armor=Math.max(armor,s.armorShredAura||0);magic=Math.max(magic,s.magicShredAura||0);}
  }
  if(enemy.boss)slow*=data.balance.bossSlowMultiplier??.5;
  add('slow',slow);add('armor',armor);add('magic',magic);
  for(const key of ['freeze','petrify','poison','burn','bleed','healBlock'])if(statuses[key]?.time>0)add(key,statuses[key].dps||statuses[key].time);
  return [...effects.values()];
}

const noPick=()=>{};
function geometryFor(glyph,{inner=.51,outer=.58,glyphRadius=.74,angle=.65}={}){
  const vertices=[];
  const triangle=(a,b,c)=>vertices.push(...a,0,...b,0,...c,0); // remapped below to XZ
  const strip=(a,b,width=.014)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,n=[-dz/length*width,dx/length*width];
    const p=[a[0]+n[0],a[1]+n[1]],q=[a[0]-n[0],a[1]-n[1]],r=[b[0]+n[0],b[1]+n[1]],s=[b[0]-n[0],b[1]-n[1]];triangle(p,q,r);triangle(q,s,r);
  };
  const line=(points,width)=>{for(let i=1;i<points.length;i++)strip(points[i-1],points[i],width);};
  const circle=(radius,cx=0,cy=0,segments=16)=>line(Array.from({length:segments+1},(_,i)=>[cx+Math.cos(i/segments*Math.PI*2)*radius,cy+Math.sin(i/segments*Math.PI*2)*radius]),.009);
  for(let i=0;i<16;i++){
    if(i%4===3)continue;
    const a=-Math.PI/2-angle/2+angle*i/16,b=a+angle/16;
    const p=[Math.cos(a)*inner,Math.sin(a)*inner],q=[Math.cos(a)*outer,Math.sin(a)*outer],r=[Math.cos(b)*inner,Math.sin(b)*inner],s=[Math.cos(b)*outer,Math.sin(b)*outer];triangle(p,q,r);triangle(q,s,r);
  }
  const offset=vertices.length,sy=-glyphRadius;
  if(glyph==='clock'){circle(.095,0,sy);line([[0,sy-.058],[0,sy],[.055,sy+.032]],.012);}
  else if(glyph==='blade'){line([[-.075,sy+.08],[.075,sy-.08]],.022);line([[-.085,sy+.01],[-.01,sy+.075]],.013);line([[-.07,sy+.075],[-.11,sy+.115]],.018);}
  else if(glyph==='arrows'){for(const sign of [-1,1]){line([[0,sy],[sign*.10,sy]],.014);line([[sign*.065,sy-.04],[sign*.105,sy],[sign*.065,sy+.04]],.014);}}
  else if(glyph==='shield'){line([[-.09,sy-.09],[.09,sy-.09],[.07,sy+.035],[0,sy+.105],[-.07,sy+.035],[-.09,sy-.09]],.015);}
  else if(glyph==='target'){circle(.086,0,sy);circle(.035,0,sy);line([[-.115,sy],[.115,sy]],.008);line([[0,sy-.115],[0,sy+.115]],.008);}
  else if(glyph==='spiral'){line(Array.from({length:22},(_,i)=>{const a=i*.48,r=.018+i*.004;return[Math.cos(a)*r,sy+Math.sin(a)*r];}),.013);}
  else if(glyph==='cross'){line([[-.085,sy-.085],[.085,sy+.085]],.023);line([[-.085,sy+.085],[.085,sy-.085]],.023);}
  else if(glyph==='crack'){line([[-.075,sy-.09],[0,sy-.025],[-.027,sy+.025],[.075,sy+.09]],.018);line([[-.1,sy+.02],[-.1,sy+.09],[.1,sy+.09],[.1,sy+.025]],.010);}
  else if(glyph==='snowflake'){for(let i=0;i<3;i++){const a=i*Math.PI/3;line([[-Math.cos(a)*.11,sy-Math.sin(a)*.11],[Math.cos(a)*.11,sy+Math.sin(a)*.11]],.012);}}
  else if(glyph==='diamond')line([[0,sy-.12],[.09,sy],[0,sy+.12],[-.09,sy],[0,sy-.12]],.019);
  else if(glyph==='drop')line([[0,sy-.115],[.075,sy+.025],[.05,sy+.082],[-.05,sy+.082],[-.075,sy+.025],[0,sy-.115]],.014);
  else if(glyph==='flame')line([[-.085,sy+.08],[-.065,sy-.04],[0,sy-.12],[.012,sy-.015],[.07,sy-.06],[.085,sy+.08],[-.085,sy+.08]],.015);
  else if(glyph==='brokenStar'){line([[-.09,sy-.045],[.03,sy-.045],[0,sy-.12],[.09,sy+.05],[-.03,sy+.05],[0,sy+.12],[-.09,sy-.045]],.013);}
  // Glyph triangles were generated in a 2D plane (x,z,0).
  for(let i=0;i<vertices.length;i+=3){vertices[i+2]=vertices[i+1];vertices[i+1]=0;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();geometry.userData.glyph=glyph;geometry.userData.glyphVertexStart=offset/3;return geometry;
}
function dashedRadius(){
  const values=[];
  for(let i=0;i<120;i++){if(i%3===2)continue;const a=i/120*Math.PI*2,b=(i+1)/120*Math.PI*2;values.push(Math.cos(a),0,Math.sin(a),Math.cos(b),0,Math.sin(b));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return geometry;
}
const defaultPosition=(x,y,z)=>new THREE.Vector3(x,y,z);
export class SupportEffects{
  constructor(scene,{position=defaultPosition,baseHeight=.15,pedestalHeight=.74,reducedMotion=()=>false,isVisible=enemy=>!enemy.cloaked,maxTowers=250,maxEnemies=256}={}){
    this.scene=scene;this.position=position;this.baseHeight=baseHeight;this.pedestalHeight=pedestalHeight;this.reducedMotion=reducedMotion;this.isVisible=isVisible;this.maxTowers=maxTowers;this.maxEnemies=maxEnemies;this.disposed=false;
    this.group=new THREE.Group();this.group.name='Actual support and status overlays';scene.add(this.group);this.batches=new Map();this.entries=new Map();this.states=new Map();this.enemyStates=new Map();this.time=0;this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.scale=new THREE.Vector3(1,1,1);this.up=new THREE.Vector3(0,1,0);
    for(const [key,style]of Object.entries(SUPPORT_EFFECT_STYLES))this.batch(key,style,maxTowers,negativeKeys.includes(key)?{inner:.83,outer:.90,glyphRadius:1.04}:{});
    for(const [key,style]of Object.entries(ENEMY_EFFECT_STYLES))this.batch(`enemy:${key}`,style,maxEnemies,{inner:.34,outer:.39,glyphRadius:.54,angle:.57});
    const wallBand=new THREE.BoxGeometry(.97,.12,.97);
    this.tint=new THREE.InstancedMesh(wallBand,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.32,depthWrite:false,toneMapped:false}),maxTowers);this.tint.name='Owned wall-cap top and side color bands';this.tint.count=0;this.tint.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.tint.raycast=noPick;this.tint.frustumCulled=false;this.tint.renderOrder=4;this.group.add(this.tint);
    const unitRadius=dashedRadius();this.radiusBase=Array.from(unitRadius.attributes.position.array);unitRadius.dispose();
    const radiusGeometry=new THREE.BufferGeometry(),radiusCapacity=this.radiusBase.length*8;
    radiusGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(radiusCapacity),3).setUsage(THREE.DynamicDrawUsage));radiusGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(radiusCapacity),3).setUsage(THREE.DynamicDrawUsage));radiusGeometry.setDrawRange(0,0);
    this.radius=new THREE.LineSegments(radiusGeometry,new THREE.LineBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:.68,depthWrite:false,toneMapped:false}));this.radius.name='Selected source actual aura reach';this.radius.visible=false;this.radius.raycast=noPick;this.radius.frustumCulled=false;this.radius.renderOrder=5;this.group.add(this.radius);
  }
  batch(key,style,capacity,shape){
    const object=new THREE.InstancedMesh(geometryFor(style.glyph,shape),new THREE.MeshBasicMaterial({color:style.color,transparent:true,opacity:.86,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),capacity);
    object.name=`${key} glyph and segmented halo`;object.count=0;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.raycast=noPick;object.frustumCulled=false;object.renderOrder=6;this.group.add(object);this.batches.set(key,object);this.entries.set(key,[]);
  }
  sync(towers,data,{selected=null,combat=null,phase,time=this.time}={}){
    if(this.disposed)return;this.states.clear();this.enemyStates.clear();for(const values of this.entries.values())values.length=0;
    const context=prepared(towers,data),options={context,combat,phase},tints=[];
    for(const tower of towers){
      if(tower.state!=='active')continue;const state=towerSupportState(tower,towers,data,options);this.states.set(tower.id,state);
      for(const e of state.effects){const index=positiveKeys.includes(e.key)?positiveKeys.indexOf(e.key):negativeKeys.indexOf(e.key);this.entries.get(e.key).push({x:tower.x,z:tower.z,y:this.baseHeight+.015+(negativeKeys.includes(e.key)?.018:0),angle:index*Math.PI*2/(positiveKeys.includes(e.key)?5:3),id:tower.id});}
      const tintKey=supportTintKey(state);
      if(tintKey)tints.push({tower,color:new THREE.Color(SUPPORT_EFFECT_STYLES[tintKey].color)});
    }
    this.tint.count=Math.min(tints.length,this.maxTowers);
    for(let i=0;i<this.tint.count;i++){const {tower,color}=tints[i];this.matrix.makeTranslation(...this.position(tower.x,this.pedestalHeight-.04,tower.z).toArray());this.tint.setMatrixAt(i,this.matrix);this.tint.setColorAt(i,color);}
    this.tint.instanceMatrix.needsUpdate=true;if(this.tint.instanceColor)this.tint.instanceColor.needsUpdate=true;
    if(combatActive(options)){
      const statCache=new Map(),statsFor=tower=>{const key=`${tower.family}:${tower.tier}:${tower.upgrades||0}`;if(!statCache.has(key))statCache.set(key,towerStats(tower,data));return statCache.get(key);};
      // Only the handful of actual aura sources need checking against enemies.
      const auraTowers=towers.filter(t=>t.state==='active'&&['slowAura','armorShredAura','magicShredAura'].some(k=>statsFor(t)[k]));
      for(const enemy of combat.enemies||[]){
        if(enemy.dead||!this.isVisible(enemy))continue;const effects=enemyStatusState(enemy,auraTowers,data,{statsFor});if(!effects.length)continue;this.enemyStates.set(enemy.id,effects);
        const ordered=Object.keys(ENEMY_EFFECT_STYLES);
        for(const e of effects)this.entries.get(`enemy:${e.key}`).push({x:enemy.x,z:enemy.z,y:.10+(enemy.flying?.8:0),angle:ordered.indexOf(e.key)*Math.PI*2/ordered.length,id:enemy.id});
      }
    }
    const areas=selected?supportSourceAreas(selected,data,{towers}):[];this.selectedAreas=areas;
    this.radius.visible=areas.length>0;
    if(areas.length){
      // All selected radii share one resource; alternate rings are separate
      // static line segments rather than one misleading attack-range circle.
      const positions=this.radius.geometry.attributes.position,colors=this.radius.geometry.attributes.color;let cursor=0;
      for(let areaIndex=0;areaIndex<Math.min(8,areas.length);areaIndex++){const area=areas[areaIndex],color=new THREE.Color(area.color);for(let i=0;i<this.radiusBase.length;i+=3){positions.setXYZ(cursor,this.radiusBase[i]*area.radius,.025+areaIndex*.004,this.radiusBase[i+2]*area.radius);colors.setXYZ(cursor,color.r,color.g,color.b);cursor++;}}
      this.radius.geometry.setDrawRange(0,cursor);positions.needsUpdate=true;colors.needsUpdate=true;this.radius.position.copy(this.position(selected.x,.10,selected.z));
    }
    this.update(time);
  }
  update(time,{reducedMotion}={}){
    if(this.disposed)return;this.time=Number.isFinite(time)?time:0;const still=reducedMotion??(typeof this.reducedMotion==='function'?this.reducedMotion():this.reducedMotion),clock=still?0:this.time;
    for(const [key,object]of this.batches){const values=this.entries.get(key);object.count=Math.min(values.length,object.instanceMatrix.count);object.visible=object.count>0;
      object.material.opacity=still?.86:.79+.09*Math.sin(clock*2.3+(key.startsWith('enemy:')?1:0));
      for(let i=0;i<object.count;i++){const e=values[i],pulse=still?1:1+.025*Math.sin(clock*3+e.id*.47);this.rotation.setFromAxisAngle(this.up,e.angle);this.scale.set(pulse,1,pulse);this.matrix.compose(this.position(e.x,e.y,e.z),this.rotation,this.scale);object.setMatrixAt(i,this.matrix);}
      object.instanceMatrix.needsUpdate=true;
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();object.dispose?.();});this.group.removeFromParent();this.batches.clear();this.entries.clear();this.states.clear();this.enemyStates.clear();
  }
}
