import {GAME_VERSION} from '../release.js';
import {supportBonuses,towerStats,distance} from './math.js';

const number=n=>Math.round((Number(n)||0)*100)/100;
const unit=t=>({id:t.id,family:t.family,tier:t.tier,x:t.x,z:t.z});
export class RunStatistics {
  constructor(game,{id=crypto.randomUUID(),clock=()=>Date.now(),version=GAME_VERSION}={}){
    this.game=game;this.clock=clock;this.id=id;this.startedAt=clock();this.version=version;this.sequence=0;this.waves=[];this.draws=[];this.decisions=[];this.current=null;this.outcome='playing';this.lastSources=new Map();this.sampleClock=0;this.unsubscribe=game.on((type,payload)=>this.event(type,payload));
  }
  event(type,p){
    const g=this.game,t=p.tower;
    if(type==='place')this.draws.push({...unit(t),wave:g.round});
    if(type==='keep'||type==='combine')this.decisions.push({...unit(t),wave:g.round,action:type,rank:t.tier});
    if(type==='wave'){
      this.current={index:g.round,boss:!!g.wave.boss,completed:false,startHealth:g.lives,endHealth:g.lives,healthLost:0,kills:0,bossKills:0,leaks:0,spawned:0,durationMs:0,routeLength:g.grid.route.length-1,kingdomLevel:g.economy.level,mastery:g.economy.mastery,enemyTypes:{},towers:g.towers.filter(t=>t.state==='active').map(t=>({...unit(t),damage:0,hits:0,shots:0,kills:0,controlSeconds:0,supportSeconds:0})),effects:{}};
      this.waveUnits=new Map(this.current.towers.map(t=>[t.id,t]));
    }
    const w=this.current;
    if(w&&type==='spawn'){w.spawned++;const key=p.enemy.type;w.enemyTypes[key]??={spawned:0,kills:0,leaks:0};w.enemyTypes[key].spawned++;}
    if(w&&type==='shot'){const row=this.waveUnits.get(p.source?.id);if(row)row.shots++;}
    if(w&&type==='melancholy')w.effects.melancholyTriggers=(w.effects.melancholyTriggers||0)+1;
    if(w&&type==='hit'){const row=this.waveUnits.get(p.source?.id);if(row){row.damage+=Math.min(p.damage,Math.max(0,p.enemy.hp+p.damage));row.hits++;}}
    if(w&&type==='death'){w.kills++;if(p.enemy.boss)w.bossKills++;if(w.enemyTypes[p.enemy.type])w.enemyTypes[p.enemy.type].kills++;const row=this.waveUnits.get(this.lastSources.get(p.enemy.id));if(row)row.kills++;this.lastSources.delete(p.enemy.id);}
    // hit precedes death in CombatManager; remember the actual finishing source.
    if(w&&type==='hit')this.lastSources.set(p.enemy.id,p.source?.id);
    if(w&&type==='leak'){w.leaks++;w.healthLost+=p.enemy.leak||1;if(w.enemyTypes[p.enemy.type])w.enemyTypes[p.enemy.type].leaks++;}
    if(type==='reward')this.finishWave(true);
    if(type==='won'){this.finishWave(true);this.outcome='won';this.finishedAt=this.clock();}
    if(type==='lost'){this.finishWave(false);this.outcome='lost';this.finishedAt=this.clock();}
  }
  sample(dt){
    if(!this.current||this.game.phase!=='combat'||this.game.paused||dt<=0)return;
    this.sampleClock+=dt*this.game.speed;if(this.sampleClock<.25)return;
    const w=this.current,slice=this.sampleClock;this.sampleClock=0;
    const auras=this.game.towers.filter(t=>t.state==='active').map(t=>({tower:t,stats:towerStats(t,this.game.data)})).filter(t=>t.stats.slowAura);
    for(const enemy of this.game.combat.enemies){if(enemy.dead)continue;
      for(const [key,status] of Object.entries(enemy.statuses||{}))if(status.time>0){const seconds=Math.min(slice,status.time);w.effects[key]=(w.effects[key]||0)+seconds;}
      let effect=enemy.statuses.petrify||enemy.statuses.freeze;
      if(!effect){effect=[enemy.statuses.slow,enemy.statuses.gazeSlow].filter(s=>s?.time>0).sort((a,b)=>b.amount-a.amount)[0];
        for(const {tower,stats} of auras)if(!enemy.magicImmune&&distance(tower,enemy)<=stats.range&&stats.slowAura>(effect?.amount||0))effect={amount:stats.slowAura,time:slice,source:tower,aura:true};
      }
      const row=this.waveUnits.get(effect?.source?.id);if(row){const seconds=Math.min(slice,effect.time);row.controlSeconds+=seconds;if(effect.aura)w.effects.slowAura=(w.effects.slowAura||0)+seconds;}
    }
    for(const tower of this.game.towers){
      const row=this.waveUnits.get(tower.id);if(!row)continue;
      const bonus=supportBonuses(tower,this.game.towers,this.game.data);if(bonus.haste>1||bonus.damage>1||bonus.range>0||bonus.trueStrike||bonus.controlResistance)row.supportSeconds+=slice;
      const until=tower.melancholyUntil||0,duration=towerStats(tower,this.game.data).melancholyDuration||0,elapsed=this.game.combat.elapsed;
      const seconds=duration?Math.max(0,Math.min(elapsed,until)-Math.max(elapsed-slice,until-duration)):0;
      if(seconds)w.effects.melancholy=(w.effects.melancholy||0)+seconds;
    }
  }
  finishWave(completed){if(!this.current)return;this.current.completed=completed;this.current.endHealth=this.game.lives;this.current.durationMs=Math.round(this.game.combat.elapsed*1000);this.waves.push(this.current);this.current=null;this.lastSources.clear();this.sampleClock=0;}
  snapshot({abandoned=false}={}){
    const g=this.game;let waves=this.waves.map(w=>structuredClone(w));
    if(this.current)waves.push({...structuredClone(this.current),endHealth:g.lives,durationMs:Math.round(g.combat.elapsed*1000)});
    waves=waves.map(w=>({...w,effects:Object.fromEntries(Object.entries(w.effects).map(([k,v])=>[k,number(v)])),towers:w.towers.map(t=>({...t,damage:number(t.damage),controlSeconds:number(t.controlSeconds),supportSeconds:number(t.supportSeconds)}))}));
    // durationMs retains its historical browser-wall-time interpretation.
    // The optional elapsed-run clock comes only from Game, never from an
    // old timestamp or a sum of speed-scaled combat waves.
    const duration=Number.isFinite(g.elapsedSeconds)&&g.elapsedSeconds>=0?{durationSeconds:g.elapsedSeconds}:{};
    return {id:this.id,version:this.version,mode:g.waveLimit,seed:g.seed,sequence:++this.sequence,outcome:abandoned&&this.outcome==='playing'?'abandoned':this.outcome,score:g.score,wavesSurvived:waves.filter(w=>w.completed).length,durationMs:Math.max(0,(this.finishedAt??this.clock())-this.startedAt),...duration,kingdomLevel:g.economy.level,health:g.lives,gold:g.economy.gold,draws:structuredClone(this.draws),decisions:structuredClone(this.decisions),waves};
  }
  dispose(){this.unsubscribe();}
}
