import {configuredWarbandInfo} from './warband-info.js';
import {ENEMY_RULES} from './enemy-rules.js';

const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const countOf=group=>Math.max(0,Math.ceil(finite(group.count)));
const freeze=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
};
const median=values=>{
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

// These labels describe mechanics the combat engine actually implements.
// Free-form enemy lore/reference tags are intentionally not classifications.
const categories={
  boss:['Boss','crown','A boss invader carries special pressure and reduced susceptibility to slowing.',1000],
  magicImmune:['Magic Immunity','spark','Magic-immune invaders reject magical damage and most magical effects.',125],
  physicalImmune:['Physical Immunity','shield','Physical-immune invaders reject physical and piercing damage.',125],
  highHealth:['High Health','shield','These invaders have unusually high health compared with nearby regular waves.',110],
  flying:['Flying','bow','Flying invaders follow the checkpoint route and cannot be struck by melee defenders.',100],
  stealth:['Stealth','pin','Cloaked invaders need proximity or detection before defenders can target them.',95],
  blink:['Blink','path','Periodic teleports advance invaders along their route.',95],
  heavyArmor:['Heavy Armor','shield','High armor reduces physical and piercing damage.',90],
  debuffer:['Defender Disruption','snow','These invaders can interrupt or slow nearby defender attacks.',90],
  shell:['Damage Block','shield','Shells subtract damage from non-pure direct hits.',88],
  shield:['Hit-blocking Shields','shield','Refreshing shields absorb direct hits; damage over time and auras bypass them.',85],
  buffer:['Enemy Support','spark','Support invaders strengthen nearby invaders with movement speed or a magic ward.',85],
  reactiveArmor:['Reactive Armor','shield','Direct hits build armor stacks that decay over time.',83],
  regeneration:['Regeneration','sun','Invaders continuously recover maximum-health-based healing unless healing is blocked.',80],
  recharge:['Health Recharge','sun','Invaders periodically restore a portion of missing health unless healing is blocked.',80],
  evasion:['Evasion','target','Invaders can evade physical and piercing direct hits; True Strike bypasses evasion.',78],
  magicResistance:['Magic Resistance','spark','Resistance reduces damage from one or more magical damage types.',75],
  fast:['High Speed','bolt','Fast movement or speed bursts leave less time for defenders to attack.',70],
  swarm:['Swarm','grid','A large number of invaders increases pressure on single-target defenses.',65],
  thief:['Gold Theft','coin','Surviving thieves steal gold when they reach the keep.',60],
};
const partialThreat=({id,label,icon,description,possible})=>({id,label,icon,description,possible});

export class WaveThreatAnalyzer {
  constructor(data){
    this.data=data;
    const settings=data.balance?.wavePreview||{};
    this.config=freeze({
      fullPreviewWavesAhead:Math.max(1,Math.floor(finite(settings.fullPreviewWavesAhead,1))),
      partialPreviewWavesAhead:Math.max(2,Math.floor(finite(settings.partialPreviewWavesAhead,2))),
      maxPrimaryThreats:Math.max(1,Math.floor(finite(settings.maxPrimaryThreats,3))),
      maxComplexPrimaryThreats:Math.max(1,Math.floor(finite(settings.maxComplexPrimaryThreats,5))),
      complexThreatCount:Math.max(1,Math.floor(finite(settings.complexThreatCount,4))),
      classification:{minimumPopulationShare:.25,heavyArmor:30,fastSpeed:2.5,swarmCount:24,resistance:.2,highHealthRatio:2.5,healthBaselineRadius:4,...settings.classification},
      bossForecast:{markerDistance:10,identityDistance:4,traitsDistance:2,...settings.bossForecast},
    });
    this.cache=new Map();
    this.healthCache=new Map();
    this.magicTypes=new Set(['magic','arcane','holy','frost','fire','poison',...Object.values(data.towers||{}).map(tower=>tower.type)].filter(type=>type&&!['physical','piercing','pure'].includes(type)));
  }

  effectiveGroups(index){
    const wave=this.data.waves?.[index];
    if(!wave)return [];
    return (wave.groups||[]).filter(group=>countOf(group)>0).map(group=>{
      const unknown=!this.data.enemies?.[group.type];
      const definition=this.data.enemies?.[group.type]||{name:group.type||'Unknown invader',hp:0,armor:0,speed:0};
      const modifiers={...wave,...group};
      const choices=Object.hasOwn(modifiers,'variant')?[modifiers.variant]:definition.variants?.length?definition.variants:[undefined];
      const variants=choices.map(variant=>{
        // Preserve CombatManager's shallow variant merge, multiplicative health/
        // speed, additive armor and resist override. No variant roll is made.
        const selected={...definition,...variant,type:group.type};
        const safe={...selected,hp:finite(selected.hp),armor:finite(selected.armor),speed:finite(selected.speed)};
        const info=configuredWarbandInfo(safe,{...modifiers,variant:undefined});
        const enemy=structuredClone({...safe,hp:info.maxHp,maxHp:info.maxHp,armor:info.armor,speed:info.speed,resists:{...safe.resists,...modifiers.resists}});
        return {...info,enemy};
      });
      return {type:group.type,name:definition.name||group.type||'Unknown invader',count:countOf(group),unknown,variants};
    });
  }

  regularHealth(index){
    if(this.healthCache.has(index))return this.healthCache.get(index);
    const samples=[];
    if(!this.data.waves[index]?.boss)for(const group of this.effectiveGroups(index)){
      const regular=group.variants.filter(variant=>!variant.enemy.boss&&variant.maxHp>0);
      for(const variant of regular)samples.push({hp:variant.maxHp,weight:group.count/group.variants.length});
    }
    samples.sort((a,b)=>a.hp-b.hp);
    const midpoint=samples.reduce((sum,sample)=>sum+sample.weight,0)/2;
    let accumulated=0,result=0;
    for(const sample of samples){accumulated+=sample.weight;if(accumulated>=midpoint){result=sample.hp;break;}}
    this.healthCache.set(index,result);
    return result;
  }

  healthBaseline(index){
    const radius=Math.max(1,Math.floor(finite(this.config.classification.healthBaselineRadius,4)));
    const values=[];
    for(let offset=1;offset<=radius;offset++)for(const neighbor of [index-offset,index+offset]){
      if(neighbor<0||neighbor>=(this.data.waves?.length||0))continue;
      const health=this.regularHealth(neighbor);if(health>0)values.push(health);
    }
    // An isolated scenario can still compare against known regular definitions.
    if(!values.length)for(const [type,enemy] of Object.entries(this.data.enemies||{})){
      if(!enemy.boss&&finite(enemy.hp)>0&&!this.effectiveGroups(index).some(group=>group.type===type))values.push(enemy.hp);
    }
    return median(values);
  }

  classify(enemy,baseline,swarm){
    const ids=[],c=this.config.classification;
    const add=(id,condition)=>{if(condition)ids.push(id);};
    add('boss',!!enemy.boss);
    add('magicImmune',!!enemy.magicImmune);
    add('physicalImmune',!!enemy.physicalImmune);
    add('highHealth',baseline>0&&enemy.maxHp>=baseline*c.highHealthRatio);
    add('flying',!!enemy.flying);
    add('stealth',!!(enemy.stealth||enemy.cloakDaggers));
    add('blink',enemy.blink>0);
    add('heavyArmor',enemy.armor>=c.heavyArmor);
    add('debuffer',!!enemy.disarm||enemy.untouchable>0||enemy.type==='sapper');
    add('shell',enemy.krakenShell>0);
    add('shield',enemy.refraction>0);
    add('buffer',enemy.hasteAura>1||['shaman','warlock'].includes(enemy.type));
    add('reactiveArmor',enemy.reactiveArmor>0);
    add('regeneration',enemy.regen>0);
    add('recharge',enemy.recharge>0);
    add('evasion',enemy.evasion>0);
    const magicalResistance=Object.entries(enemy.resists||{}).some(([type,value])=>this.magicTypes.has(type)&&value>=c.resistance);
    add('magicResistance',!enemy.magicImmune&&magicalResistance);
    const frenzy=enemy.rush>1?enemy.rush:enemy.type==='berserker'?ENEMY_RULES.rush.berserkerSpeed:1;
    add('fast',enemy.speed*frenzy>=c.fastSpeed);
    add('swarm',swarm);
    add('thief',enemy.thief>0);
    return ids;
  }

  analyze(index){
    if(!Number.isInteger(index)||index<0||index>=(this.data.waves?.length||0))return null;
    if(this.cache.has(index))return this.cache.get(index);
    const wave=this.data.waves[index],groups=this.effectiveGroups(index),baseline=this.healthBaseline(index);
    const totalCount=groups.reduce((sum,group)=>sum+group.count,0),swarm=totalCount>=this.config.classification.swarmCount;
    const hasDefinedBoss=groups.some(group=>group.variants.some(variant=>variant.enemy.boss));
    const rows=new Map(),tags=new Map();
    let boss=!!wave.boss;
    for(const group of groups){
      if(!rows.has(group.type))rows.set(group.type,{type:group.type,name:group.name,count:0,flying:false,boss:false,unknown:group.unknown,variants:[]});
      const row=rows.get(group.type);row.count+=group.count;
      const groupTags=new Map();
      for(const variant of group.variants){
        variant.threatIds=this.classify(variant.enemy,baseline,swarm);
        const isBoss=!!variant.enemy.boss;boss||=isBoss;row.boss||=isBoss;row.flying||=variant.flying;
        const key=JSON.stringify(variant);
        if(!row.variants.some(existing=>JSON.stringify(existing)===key))row.variants.push(variant);
        for(const id of variant.threatIds){
          if(!groupTags.has(id))groupTags.set(id,{count:0,bossRelated:false});
          const tag=groupTags.get(id);tag.count++;tag.bossRelated||=isBoss||!!wave.boss&&!hasDefinedBoss;
        }
      }
      for(const [id,tag] of groupTags){
        if(!tags.has(id))tags.set(id,{population:0,possible:false,bossRelated:false});
        const aggregate=tags.get(id);
        // This is a classification weight across possible profiles, never a
        // predicted variant count or a promise about the actual random mix.
        aggregate.population+=group.count*tag.count/group.variants.length;
        aggregate.possible||=tag.count<group.variants.length;
        aggregate.bossRelated||=tag.bossRelated;
      }
    }
    if(boss&&!tags.has('boss'))tags.set('boss',{population:totalCount,possible:false,bossRelated:true});
    const threats=[...tags].flatMap(([id,tag])=>{
      const populationShare=totalCount?tag.population/totalCount:0;
      if(id!=='boss'&&!tag.bossRelated&&populationShare<this.config.classification.minimumPopulationShare)return [];
      const [label,icon,description,priority]=categories[id];
      const bossAbility=tag.bossRelated&&!['boss','highHealth','flying','heavyArmor','fast','swarm'].includes(id);
      const weight=id==='boss'?priority:tag.bossRelated?500+priority+(bossAbility?100:0):priority*(.5+.5*populationShare);
      return [{id,label,icon,description,possible:tag.possible,bossRelated:tag.bossRelated,populationShare,weight}];
    }).sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
    const complex=boss||threats.length>=this.config.complexThreatCount;
    const primaryThreats=threats.slice(0,complex?this.config.maxComplexPrimaryThreats:this.config.maxPrimaryThreats);
    const ids=new Set(threats.map(threat=>threat.id));
    const profile=boss?'Boss Wave':threats.length>=this.config.complexThreatCount?'Mixed Threat':ids.has('heavyArmor')?'Armored Assault':ids.has('swarm')?'Swarm':ids.has('regeneration')||ids.has('recharge')?'Sustained Pressure':ids.has('fast')||ids.has('blink')?'Fast Raid':ids.has('highHealth')?'Elite Wave':'Standard Wave';
    const result=freeze({index,number:index+1,name:wave.name||`Wave ${index+1}`,profile,special:boss?'boss':null,totalCount,enemies:[...rows.values()],threats,primaryThreats});
    this.cache.set(index,result);
    return result;
  }

  outlook(index,waveLimit=this.data.waves?.length||0){
    const limit=Math.min(this.data.waves?.length||0,Math.max(0,Math.floor(finite(waveLimit))));
    if(!Number.isInteger(index)||index<0||index>=limit)return freeze({next:null});
    // index is the forthcoming wave: during draft/build this is round-1;
    // during combat callers pass round. Thus ahead=1 never skips preparation.
    const nextIndex=index+this.config.fullPreviewWavesAhead-1;
    const result={next:nextIndex<limit?this.analyze(nextIndex):null};
    const afterIndex=index+Math.max(this.config.partialPreviewWavesAhead,this.config.fullPreviewWavesAhead+1)-1;
    if(afterIndex<limit){
      const after=this.analyze(afterIndex);
      result.after={index:after.index,number:after.number,name:after.name,profile:after.profile,special:after.special,primaryThreats:after.primaryThreats.map(partialThreat)};
    }
    const forecast=this.config.bossForecast;
    for(let bossIndex=index;bossIndex<limit&&bossIndex-index<=forecast.markerDistance;bossIndex++){
      const wave=this.analyze(bossIndex);if(wave.special!=='boss')continue;
      const distance=bossIndex-index;
      const visibility=distance===0?'full':distance<=forecast.traitsDistance?'traits':distance<=forecast.identityDistance?'identity':'marker';
      result.boss={index:bossIndex,number:wave.number,distance,visibility,special:'boss'};
      if(visibility!=='marker'){result.boss.name=wave.name;result.boss.profile=wave.profile;}
      if(['traits','full'].includes(visibility))result.boss.primaryThreats=wave.primaryThreats.map(partialThreat);
      if(visibility==='full')result.boss.preview=wave;
      break;
    }
    return freeze(result);
  }
}
