import {supportArtwork,applyStatusTexture} from './status-art.js';
import * as THREE from 'three';
import {distance,readTowerStats as towerStats,offensiveAuraRange,damageDefenseBreakdown,combatTowerStats} from '../core/math.js';
import {enemyRulesFor,enemyDisarmActive,defenderDreadState} from '../core/enemy-rules.js';
import {statusEffectAllowed,slowAuraApplies,effectDamageType} from '../core/combat-rules.js';
import {immunityAuraCoverage} from '../core/immunity-auras.js';
import {skyHuntAura,skyHuntSlow} from '../core/sky-hunt.js';

// Read-only display of the actual rules in supportBonuses/CombatManager.
// A source includes itself in the current game. Maxima win inside each haste
// ordinary group; the Otomad group adds independently. Other auras use maxima.
export const SUPPORT_EFFECT_STYLES=Object.freeze({
  haste:Object.freeze({label:'Attack speed',color:'#53dcff',glyph:'clock'}),
  damage:Object.freeze({label:'Damage',color:'#ffc36b',glyph:'blade'}),
  range:Object.freeze({label:'Range',color:'#54e5c1',glyph:'arrows'}),
  controlResistance:Object.freeze({label:'Control protection',color:'#b393ff',glyph:'shield'}),
  trueStrike:Object.freeze({label:'Unfailing aim',color:'#fff8e4',glyph:'target'}),
  dread:Object.freeze({label:'Dread',color:'#dd71df',glyph:'spiral'}),
  disarm:Object.freeze({label:'Disarmed',color:'#ff514e',glyph:'brokenSword'}),
  weakened:Object.freeze({label:'Barricade disruption',color:'#e69b69',glyph:'crack'}),
  melancholy:Object.freeze({label:'Melancholy',color:'#9bb4ed',glyph:'moon'}),
});
export const ENEMY_EFFECT_STYLES=Object.freeze({
  slow:Object.freeze({label:'Slowed',color:'#71d1e6',glyph:'clock'}),
  freeze:Object.freeze({label:'Frozen',color:'#cef6ff',glyph:'snowflake'}),
  stun:Object.freeze({label:'Stunned',color:'#ffe08a',glyph:'brokenStar'}),
  root:Object.freeze({label:'Rooted',color:'#a9b775',glyph:'crack'}),
  petrify:Object.freeze({label:'Petrified',color:'#c5c0a1',glyph:'diamond'}),
  poison:Object.freeze({label:'Poison',color:'#a9e363',glyph:'drop'}),
  burn:Object.freeze({label:'Burning',color:'#ff9a51',glyph:'flame'}),
  heat:Object.freeze({label:'Fire aura',color:'#ffbb54',glyph:'flame'}),
  bleed:Object.freeze({label:'Bleeding',color:'#ff747c',glyph:'drop'}),
  armor:Object.freeze({label:'Armor reduced',color:'#ffd088',glyph:'brokenShield'}),
  healBlock:Object.freeze({label:'Healing blocked',color:'#ffc0d0',glyph:'cross'}),
  regenReduction:Object.freeze({label:'Healing reduced',color:'#ffc0d0',glyph:'cross'}),
  physicalPass:Object.freeze({label:'Physical immunity weakened',color:'#ffc86d',glyph:'brokenShield'}),
  magicalPass:Object.freeze({label:'Magical immunity weakened',color:'#bfa5ff',glyph:'diamond'}),
});
const positiveKeys=['haste','damage','range','controlResistance','trueStrike'];
const negativeKeys=['dread','disarm','weakened','melancholy'];
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
    const spec=stats.get(key),properties={'attack-speed-aura':['haste','bonusPercent',.01],'damage-aura':['damageBonus','bonusPercent',.01],'range-aura':['rangeBonus','rangeBonus',1],'protection-aura':['controlResistance','protectionPercent',.01],'true-strike-aura':['trueStrike','evasionIgnorePercent',.01]};
    const auras=spec.fr002&&spec.factionProfile?(spec.abilities||[]).filter(a=>properties[a.familyId]).map(a=>{const [field,param,scale]=properties[a.familyId];return {range:a.radius,[field]:scale===.01?a[param]/100:a[param]};}):[spec.aura];
    for(const aura of auras){if(!aura||!(aura.range>=0))continue;const source={tower,stats:spec,aura};sources.push(source);largest=Math.max(largest,aura.range);const bin=`${Math.floor(tower.x/8)}:${Math.floor(tower.z/8)}`;if(!bins.has(bin))bins.set(bin,[]);bins.get(bin).push(source);}
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
    if(a.haste){const key=a.stackKey==='otomad'?'otomad':'standard';maximize(groups,key,a.haste,source,key);}
    for(const [key,value]of Object.entries(a.hasteGroups||{})){const group=key==='otomad'?'otomad':'standard';maximize(groups,group,value,source,group);}
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
    const combat=options.combat,R=combat.rules||enemyRulesFor(data),resist=combatTowerStats(tower,towers,data).bonuses.controlResistance||0,disarm=[],ruins=[];
    for(const enemy of combat.enemies||[]){
      if(enemy.dead)continue;const d=distance(tower,enemy);
      if(d<R.disarm.radius&&enemyDisarmActive(enemy,combat.elapsed||0,resist,R))disarm.push({id:enemy.id,family:enemy.type,name:enemy.name||enemy.type||'Invader',value:true});
    }
    const fear=defenderDreadState(tower,combat.elapsed||0,resist);
    if(fear.amount){
      const source=fear.source,visible=source&&typeof combat.isRevealed==='function'?combat.isRevealed(source):tower.dread.visible!==false;
      state.effects.push(effect('dread',fear.amount,fear.amount,source?[{id:source.id,family:source.type,name:source.name||source.type||'Invader',value:fear.amount,visible}]:[],{remainingSeconds:fear.remaining,label:`Dread · attack speed −${percent(fear.amount)} · ${fear.remaining.toFixed(1)}s remaining`}));
    }
    if(disarm.length)state.effects.push(effect('disarm',true,1,disarm));
    const remaining=Math.max(0,(tower.melancholyUntil||0)-(combat.elapsed||0));
    if(remaining)state.effects.push(effect('melancholy',remaining,1,[{id:tower.id,family:tower.family,name:data.towers[tower.family].name,value:remaining}],{label:`Melancholy · cannot attack · ${remaining.toFixed(1)}s remaining`}));
    for(const ruin of towers)if(ruin.state==='ruin'&&ruin.weakened>0&&distance(tower,ruin)<R.sapper.defenderRadius)ruins.push({id:ruin.id,family:ruin.family,name:'Scorched barricade',value:R.sapper.attackPenalty});
    if(ruins.length){const penalty=1-Math.pow(1-R.sapper.attackPenalty,ruins.length);state.effects.push(effect('weakened',penalty,penalty,ruins));}
  }
  state.byKey=Object.fromEntries(state.effects.map(e=>[e.key,e]));return state;
}
export const supportLegend=(tower,towers,data,options={})=>towerSupportState(tower,towers,data,options).effects;

export function supportSourceAreas(tower,data,{towers=[]}={}){
  if(tower?.state!=='active'||!data.towers[tower.family])return [];
  const s=towerStats(tower,data),R=enemyRulesFor(data),areas=[];
  const sky=skyHuntAura(s);if(sky)areas.push({key:'slow',keys:['slow'],radius:sky.slowAuraRadius,label:`${sky.levelLabel} · ${sky.slowPercent}% movement slow · ${sky.slowAuraRadius} tiles · flying only`,color:'#71d1e6',glyph:ENEMY_EFFECT_STYLES.slow.glyph});
  if(data.fr003)for(const a of s.abilities||[])if(['cancel-physical-immunity-aura','cancel-magic-immunity-aura'].includes(a.familyId)){
    const key=a.immunity==='physical'?'physicalPass':'magicalPass',style=ENEMY_EFFECT_STYLES[key];
    areas.push({key,keys:[key],radius:a.radius,label:`${a.levelLabel} · ${percent(a.damageMultiplier)} normal ${a.immunity==='physical'?'Physical':'Magical'} damage · ${a.radius} tiles`,color:style.color,glyph:style.glyph});
  }
  if(s.aura){const a=s.aura,keys=positiveKeys.filter(k=>k==='haste'?a.haste||Object.values(a.hasteGroups||{}).some(v=>v>0):k==='damage'?a.damageBonus:k==='range'?a.rangeBonus:a[k]);if(keys.length)areas.push({key:'support',keys,radius:a.range,label:`Support reach · ${a.range} tiles`,color:'#86f0c9',glyph:'arrows'});}
  const debuffs=[['burnAura','burn','Burning aura','#ff9a51'],['slowAura','slow','Slowing aura','#71d1e6'],['armorShredAura','armor','Armor reduction aura','#ffd088']];
  for(const [prop,key,label,color]of debuffs)if(s[prop]&&!tower.attackPaused){
    const radius=offensiveAuraRange(s,key==='armor'?'armor':key);
    areas.push({key,keys:[key],radius,label:`${label} · ${radius} tiles${prop==='slowAura'&&s.slowAuraGroundOnly?' · ground only':''}`,color,glyph:ENEMY_EFFECT_STYLES[key].glyph});
  }
  const detection=tower.family==='cleric'?R.reveal.clericRadius:s.detectionRange||0;
  if(detection)areas.push({key:'detection',keys:['detection'],radius:Math.max(R.reveal.defenderRadius,detection),label:`Hidden-enemy detection · ${Math.max(R.reveal.defenderRadius,detection)} tiles`,color:'#fff8e4',glyph:'target'});
  if(s.bouncingFrostTrigger==='nearby-ally-magic-hit')areas.push({key:'reaction',keys:['reaction'],radius:s.bouncingFrostTriggerRange||6,label:`Reacts to allied magic hits · ${s.bouncingFrostTriggerRange||6} tiles`,color:'#a5ddff',glyph:'snowflake'});
  return areas;
}

// Persistent enemy markers fill the gap between one-shot attack/impact FX and
// the actual effects remaining on an enemy. They never reveal a cloaked enemy.
export function enemyStatusState(enemy,towers,data,options={}){
  if(enemy.dead)return [];
  const statuses=enemy.statuses||{},effects=new Map();
  const live=key=>statuses[key]?.time>0?statuses[key]:null;
  const add=(key,value)=>{if(value>0)effects.set(key,{key,...ENEMY_EFFECT_STYLES[key],value:Math.max(value,effects.get(key)?.value||0)});};
  if(live('artifactPoison')&&statusEffectAllowed(enemy,'poison'))add('poison',live('artifactPoison').amount);if(live('artifactBurn')&&statusEffectAllowed(enemy,'burn'))add('burn',live('artifactBurn').amount);
  let slow=statusEffectAllowed(enemy,'slow')?Math.max(live('slow')?.amount||0,live('gazeSlow')?.amount||0):0,armor=Math.max(live('shred')?.amount||0,live('artifactShred')?.amount||0);
  const immunity=immunityAuraCoverage(enemy,towers,data),skyContext={data,towers,immunityCoverage:immunity};
  for(const tower of towers){
    if(tower.state!=='active')continue;const s=options.statsFor?options.statsFor(tower):towerStats(tower,data),d=distance(tower,enemy);
    slow=Math.max(slow,skyHuntSlow(s,tower,enemy,skyContext));
    if(tower.attackPaused)continue;
    if(slowAuraApplies(s,enemy)&&d<=offensiveAuraRange(s,'slow'))slow=Math.max(slow,s.slowAura);
    if(d<=offensiveAuraRange(s,'armor'))armor=Math.max(armor,s.armorShredAura||0);
    // Fire auras are continuous damage, not an invented timed Burn status.
    // Use the same damage defenses and source visibility as the live combat.
    const fire=s.factionProfile?(s.abilities||[]).find(a=>a.familyId==='fire-aura'):null;
    const fireDps=fire?.dps||(!s.factionProfile?s.burnAura:0),fireRadius=fire?.radius??offensiveAuraRange(s,'burn');
    if(fireDps>0&&d<=fireRadius&&(!s.factionProfile||!tower.disarmed)&&(!options.combat?.canSee||options.combat.canSee(enemy,tower))){
      const type=fire?(fire.damageType==='profile'?s.type:fire.damageType==='magical-or-holy'?(s.type==='holy'?'holy':'magical'):fire.damageType):effectDamageType(s,'fire');
      if(damageDefenseBreakdown(fireDps,type,enemy,s,data.balance,immunity).afterArmor>0)add('heat',fireDps);
    }
  }
  if(enemy.boss)slow*=data.balance.bossSlowMultiplier??.5;
  add('slow',slow);add('armor',armor);
  if(immunity){if(enemy.physicalImmune)add('physicalPass',immunity.physical.multiplier);if(enemy.magicImmune)add('magicalPass',immunity.magical.multiplier);}
  if(enemy.physicalImmune&&live('breachPhysical'))add('physicalPass',statuses.breachPhysical.multiplier);
  if(enemy.magicImmune&&live('breachMagic'))add('magicalPass',statuses.breachMagic.multiplier);
  for(const key of ['freeze','stun','root','petrify','poison','burn','bleed','healBlock'])if(statusEffectAllowed(enemy,key)&&live(key))add(key,statuses[key].dps||statuses[key].time);
  if(statusEffectAllowed(enemy,'healBlock')&&statuses.regenReduction?.time>0)add('regenReduction',statuses.regenReduction.amount);
  return [...effects.values()];
}

const noPick=()=>{};
function geometryFor(glyph,{inner=.51,outer=.58,glyphRadius=.74,angle=.65}={}){
  const vertices=[],uvs=[];
  for(let i=0;i<16;i++){
    if(i%4===3)continue;
    const a=-Math.PI/2-angle/2+angle*i/16,b=a+angle/16;
    const at=(theta,r)=>[Math.cos(theta)*r,0,Math.sin(theta)*r];
    vertices.push(...at(a,inner),...at(a,outer),...at(b,inner),...at(a,outer),...at(b,outer),...at(b,inner));
    uvs.push(0,0,0,0,0,0,0,0,0,0,0,0);
  }
  const glyphStart=vertices.length/3;
  const half=.18,z=-glyphRadius;
  vertices.push(-half,0,z-half,-half,0,z+half,half,0,z-half,half,0,z-half,-half,0,z+half,half,0,z+half);
  uvs.push(0,1,0,0,1,1,1,1,0,0,1,0);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.addGroup(0,glyphStart,0);
  geometry.addGroup(glyphStart,6,1);
  geometry.computeBoundingSphere();
  geometry.userData.glyph=glyph;
  return geometry;
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
    this.group=new THREE.Group();this.group.name='Actual support and status overlays';scene.add(this.group);this.batches=new Map();this.symbolTextures=new Map();this.entries=new Map();this.states=new Map();this.enemyStates=new Map();this.time=0;this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.scale=new THREE.Vector3(1,1,1);this.up=new THREE.Vector3(0,1,0);
    for(const [key,style]of Object.entries(SUPPORT_EFFECT_STYLES))this.batch(key,style,maxTowers,negativeKeys.includes(key)?{inner:1.08,outer:1.14,glyphRadius:1.28}:{inner:.84,outer:.91,glyphRadius:1.05});
    // Keep Slow data and inspected source reach, but allocate no automatic
    // enemy Slow clock/halo. Other support and condition glyphs are unchanged.
    for(const [key,style]of Object.entries(ENEMY_EFFECT_STYLES))if(key!=='slow')this.batch(`enemy:${key}`,style,maxEnemies,{inner:.34,outer:.39,glyphRadius:.54,angle:.57});
    this.batch('disarm:orbit',SUPPORT_EFFECT_STYLES.disarm,maxTowers,null,new THREE.PlaneGeometry(.47,.66));
    const halo=new THREE.RingGeometry(.67,.73,48);halo.rotateX(-Math.PI/2);
    this.batch('disarm:aura',SUPPORT_EFFECT_STYLES.disarm,maxTowers,null,halo);
    this.batches.get('disarm:orbit').name='Active disarm hovering broken swords';
    this.batches.get('disarm:aura').name='Active disarm bounded red aura';
    const wallBand=new THREE.BoxGeometry(.97,.12,.97);
    this.tint=new THREE.InstancedMesh(wallBand,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.14,depthWrite:false,toneMapped:false}),maxTowers);this.tint.name='Owned wall-cap edge color bands';this.tint.count=0;this.tint.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.tint.raycast=noPick;this.tint.frustumCulled=false;this.tint.renderOrder=4;this.group.add(this.tint);
    const unitRadius=dashedRadius();this.radiusBase=Array.from(unitRadius.attributes.position.array);unitRadius.dispose();
    const radiusGeometry=new THREE.BufferGeometry(),radiusCapacity=this.radiusBase.length*8;
    radiusGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(radiusCapacity),3).setUsage(THREE.DynamicDrawUsage));radiusGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(radiusCapacity),3).setUsage(THREE.DynamicDrawUsage));radiusGeometry.setDrawRange(0,0);
    this.radius=new THREE.LineSegments(radiusGeometry,new THREE.LineBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,opacity:.68,depthWrite:false,toneMapped:false}));this.radius.name='Selected source actual aura reach';this.radius.visible=false;this.radius.raycast=noPick;this.radius.frustumCulled=false;this.radius.renderOrder=5;this.group.add(this.radius);
  }
  batch(key,style,capacity,shape,geometry){
    const options={transparent:true,opacity:.86,depthWrite:false,side:THREE.DoubleSide,toneMapped:false};
    const isOrbit=key==='disarm:orbit',hasArt=!geometry||isOrbit;
    const halo=isOrbit?null:new THREE.MeshBasicMaterial({...options,color:style.color});
    const art=hasArt?new THREE.MeshBasicMaterial({...options,alphaTest:.06}):null;
    const object=new THREE.InstancedMesh(geometry||geometryFor(style.glyph,shape),halo&&art?[halo,art]:art||halo,capacity);
    if(art){
      object.userData.art=art;
      object.userData.artwork=supportArtwork(style.glyph,key.replace(/^enemy:/,''));
      object.geometry.userData.glyph=style.glyph;
    }
    object.name=`${key} glyph and segmented halo`;object.count=0;object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.raycast=noPick;object.frustumCulled=false;object.renderOrder=6;this.group.add(object);this.batches.set(key,object);this.entries.set(key,[]);
  }
  sync(towers,data,{selected=null,combat=null,phase,time=this.time}={}){
    if(this.disposed)return;this.states.clear();this.enemyStates.clear();for(const values of this.entries.values())values.length=0;
    const context=prepared(towers,data),options={context,combat,phase},tints=[];
    for(const tower of towers){
      if(tower.state!=='active')continue;const state=towerSupportState(tower,towers,data,options);this.states.set(tower.id,state);
      for(const e of state.effects){const index=positiveKeys.includes(e.key)?positiveKeys.indexOf(e.key):negativeKeys.indexOf(e.key);this.entries.get(e.key).push({x:tower.x,z:tower.z,y:this.baseHeight+.015+(negativeKeys.includes(e.key)?.018:0),angle:index*Math.PI*2/(positiveKeys.includes(e.key)?positiveKeys.length:negativeKeys.length),id:tower.id});}
      if(state.byKey.disarm){
        this.entries.get('disarm:orbit').push({x:tower.x,z:tower.z,y:this.pedestalHeight+.92,id:tower.id});
        this.entries.get('disarm:aura').push({x:tower.x,z:tower.z,y:this.pedestalHeight+.035,id:tower.id});
      }
      const tintKey=supportTintKey(state);
      if(tintKey)tints.push({tower,color:new THREE.Color(SUPPORT_EFFECT_STYLES[tintKey].color)});
    }
    this.tint.count=Math.min(tints.length,this.maxTowers);
    // The band ends below the stone deck, leaving its paving and the defender's
    // soles unobstructed. Its side tint complements the independent glyphs.
    for(let i=0;i<this.tint.count;i++){const {tower,color}=tints[i];this.matrix.makeTranslation(...this.position(tower.x,this.pedestalHeight-.062,tower.z).toArray());this.tint.setMatrixAt(i,this.matrix);this.tint.setColorAt(i,color);}
    this.tint.instanceMatrix.needsUpdate=true;if(this.tint.instanceColor)this.tint.instanceColor.needsUpdate=true;
    if(combatActive(options)){
      const statCache=new Map(),statsFor=tower=>{const key=`${tower.family}:${tower.tier}:${tower.upgrades||0}`;if(!statCache.has(key))statCache.set(key,towerStats(tower,data));return statCache.get(key);};
      const auraTowers=towers.filter(t=>{if(t.state!=='active')return false;const s=statsFor(t);return !!skyHuntAura(s)||!t.attackPaused&&(['slowAura','armorShredAura','burnAura'].some(k=>s[k])||(s.abilities||[]).some(a=>a.familyId==='fire-aura'))||data.fr003&&(s.abilities||[]).some(a=>['cancel-physical-immunity-aura','cancel-magic-immunity-aura'].includes(a.familyId));});
      for(const enemy of combat.enemies||[]){
        if(enemy.dead||!this.isVisible(enemy))continue;const effects=enemyStatusState(enemy,auraTowers,data,{statsFor,combat});if(!effects.length)continue;this.enemyStates.set(enemy.id,effects);
        const ordered=Object.keys(ENEMY_EFFECT_STYLES);
        for(const e of effects)if(e.key!=='slow')this.entries.get(`enemy:${e.key}`).push({x:enemy.x,z:enemy.z,y:.10+(enemy.flying?.8:0),angle:ordered.indexOf(e.key)*Math.PI*2/ordered.length,id:enemy.id});
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
      const background=Array.isArray(object.material)?object.material[0]:object.material;
      background.opacity=still?.86:.79+.09*Math.sin(clock*2.3+(key.startsWith('enemy:')?1:0));
      if(object.visible&&object.userData.art)applyStatusTexture(object.userData.art,object.userData.artwork,this.symbolTextures);
      for(let i=0;i<object.count;i++){
        const e=values[i],pulse=still?1:1+.025*Math.sin(clock*3+e.id*.47),orbit=key==='disarm:orbit',aura=key==='disarm:aura',angle=orbit?clock*.9+e.id*.47:e.angle||0;
        this.rotation.setFromAxisAngle(this.up,angle);this.scale.set(pulse,1,pulse);
        const x=e.x+(orbit?Math.sin(angle)*.65:0),z=e.z+(orbit?Math.cos(angle)*.65:0),y=e.y+(orbit&&!still?.055*Math.sin(clock*2+e.id):0);
        this.matrix.compose(this.position(x,y,z),this.rotation,this.scale);object.setMatrixAt(i,this.matrix);
        if(aura)object.material.opacity=still?.48:.43+.07*Math.sin(clock*2.3);
        if(orbit)object.material.opacity=.97;
      }
      object.instanceMatrix.needsUpdate=true;
    }
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.group.traverse(object=>{object.geometry?.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material])m?.dispose();object.dispose?.();});this.group.removeFromParent();for(const texture of this.symbolTextures.values())texture.dispose();this.symbolTextures.clear();this.batches.clear();this.entries.clear();this.states.clear();this.enemyStates.clear();
  }
}
