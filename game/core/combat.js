import {distance, damageAfterDefense, towerStats,supportBonuses} from './math.js';

export class CombatManager {
  constructor(game) {this.game=game;this.enemies=[];this.projectiles=[];this.spawnQueue=[];this.elapsed=0;this.serial=0;this.shotSerial=0;this.spawned=0;this.total=0;}
  start(wave) {
    this.enemies=[];this.projectiles=[];this.spawnQueue=[];this.elapsed=0;this.spawned=0;
    let time=0.25;
    for(const group of wave.groups) {
      const variants=this.game.data.enemies[group.type].variants;
      const variant=variants?.[Math.floor(this.game.rng()*variants.length)];
      for(let i=0;i<group.count;i++){this.spawnQueue.push({time,type:group.type,modifiers:{...wave,...group,variant}});time+=group.interval;}
    }
    this.total=this.spawnQueue.length;
    for(const t of this.game.towers)t.cooldown=0;
  }
  spawn(type,modifiers={}) {
    const base={...this.game.data.enemies[type],...modifiers.variant};
    const route=(base.flying?this.game.grid.checkpoints:this.game.grid.route).map(p=>({...p}));
    let pathLength=0;for(let i=1;i<route.length;i++)pathLength+=distance(route[i-1],route[i]);
    const enemy={...structuredClone(base),id:++this.serial,type,maxHp:base.hp*(modifiers.hp||1),hp:base.hp*(modifiers.hp||1),speed:base.speed*(modifiers.speed||1),armor:base.armor+(modifiers.armor||0),resists:{...base.resists,...modifiers.resists},...route[0],route,pathLength,pathIndex:1,traveled:0,statuses:{},dead:false,hit:0,shields:base.refraction||0,shieldClock:8,rechargeClock:8,blinkClock:6,reactiveStacks:0,cloaked:!!(base.stealth||base.cloakDaggers)};
    this.enemies.push(enemy);this.spawned++;this.game.emit('spawn',{enemy});return enemy;
  }
  canSee(enemy,tower) {
    if(!enemy.cloaked)return true;
    if(distance(tower,enemy)<=2 || this.game.grid.checkpoints.some(p=>distance(p,enemy)<=1.5))return true;
    return this.game.towers.some(t=>t.state==='active'&&t.family==='cleric'&&distance(t,enemy)<=6);
  }
  targetList(tower,stats) {
    const candidates=this.enemies.filter(e=>!e.dead&&this.canSee(e,tower)&&(!stats.melee||!e.flying)&&distance(tower,e)<=stats.range);
    const priority=tower.priority||'first';
    const sorters={first:(a,b)=>b.traveled/b.pathLength-a.traveled/a.pathLength,last:(a,b)=>a.traveled/a.pathLength-b.traveled/b.pathLength,strongest:(a,b)=>b.hp-a.hp,weakest:(a,b)=>a.hp-b.hp,fastest:(a,b)=>b.speed-a.speed,slowest:(a,b)=>a.speed-b.speed};
    return candidates.sort(sorters[priority]||sorters.first);
  }
  damage(enemy,amount,type,stats,source) {
    if(enemy.dead)return 0;
    if(stats.directHit){
      if(enemy.evasion&&['physical','piercing'].includes(type)&&this.game.rng()<enemy.evasion)return 0;
      if(enemy.shields>0){enemy.shields--;this.game.emit('deflect',{enemy});return 0;}
    }
    const frozen=enemy.statuses.freeze && type==='physical' ? 1.25:1;
    let bonus=1;
    if(stats.beastBonus && enemy.beast)bonus*=stats.beastBonus;
    if(stats.bossBonus && (enemy.boss||enemy.type==='shaman'))bonus*=stats.bossBonus;
    let dealt=damageAfterDefense(amount*frozen*bonus,type,enemy,stats,this.game.data.balance);
    if(stats.directHit&&type!=='pure')dealt=Math.max(0,dealt-(enemy.krakenShell||0));
    if(stats.directHit&&enemy.reactiveArmor)enemy.reactiveStacks=Math.min(12,enemy.reactiveStacks+1);
    if(dealt<=0)return 0;
    enemy.hp-=dealt;enemy.hit=0.16;
    if(enemy.hp<=0) {
      enemy.dead=true;this.game.economy.reward(enemy.gold,enemy.xp);this.game.kills++;
      this.game.awardScore(this.game.round*(enemy.boss?500:10));
      if(source)source.kills++;
      this.game.emit('death',{enemy,type});
    }
    return dealt;
  }
  applyEffects(enemy,stats,source) {
    if(enemy.dead)return;
    if(enemy.magicImmune){stats={...stats,slow:0,freeze:0,burn:0,poison:0,poisonDps:0,shredMagic:0};}
    if(stats.slow)enemy.statuses.slow={amount:Math.max(stats.slow,enemy.statuses.slow?.amount||0),time:stats.slowDuration||2};
    if(stats.freeze && this.game.rng()<stats.freeze)enemy.statuses.freeze={time:0.8};
    for(const key of ['burn','poison','bleed'])if(stats[key]||(key==='poison'&&stats.poisonDps)) {
      const previous=enemy.statuses[key];
      const dps=key==='poison'&&stats.poisonDps?stats.poisonDps:stats.damage*stats[key];
      enemy.statuses[key]={dps:Math.max(dps,previous?.dps||0),time:stats.dotDuration||3,source:dps>=(previous?.dps||0)?source:previous.source};
    }
    if(stats.shred)enemy.statuses.shred={amount:Math.max(stats.shred,enemy.statuses.shred?.amount||0),time:4};
    if(stats.shredMagic)enemy.statuses.shredMagic={amount:stats.shredMagic,time:4};
  }
  impact(shot) {
    const {target,stats,source}=shot;
    const victims=stats.splash ? this.enemies.filter(e=>!e.dead&&(!stats.melee||(!e.flying&&distance(e,source)<=stats.range+.25))&&distance(e,target)<=stats.splash) : target.dead||(stats.melee&&(target.flying||distance(source,target)>stats.range+.25))?[]:[target];
    const hitDamage=stats.damage*(stats.critChance&&this.game.rng()<stats.critChance?stats.critMultiplier:1);
    for(const enemy of victims) {if(this.damage(enemy,hitDamage,stats.type,{...stats,directHit:true},source)>0)this.applyEffects(enemy,stats,source);}
    if(stats.cleave&&victims.length)for(const e of this.enemies)if(e!==target&&!e.dead&&distance(e,target)<=stats.cleaveRadius)this.damage(e,hitDamage*stats.cleave,stats.cleaveType||stats.type,stats,source);
    if(stats.effectsRadius)for(const e of this.enemies)if(!e.dead&&distance(e,target)<=stats.effectsRadius)this.applyEffects(e,stats,source);
    if(stats.chain&&(!stats.chainChance||this.game.rng()<stats.chainChance)) {
      const chained=this.enemies.filter(e=>!e.dead&&!victims.includes(e)&&distance(e,target)<4).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,stats.chain);
      for(const e of chained){if(this.damage(e,stats.chainDamage||stats.damage*0.55,stats.type,{...stats,directHit:true},source)>0)this.applyEffects(e,stats,source);this.game.emit('chain',{from:target,to:e,color:stats.color});}
    }
    this.game.emit('impact',{x:target.x,z:target.z,color:stats.color,heavy:stats.damage>160,radius:stats.splash||stats.cleaveRadius||0.4,melee:stats.melee});
  }
  update(dt) {
    this.elapsed+=dt;
    while(this.spawnQueue.length && this.spawnQueue[0].time<=this.elapsed) {const item=this.spawnQueue.shift();this.spawn(item.type,item.modifiers);}
    for(const enemy of this.enemies) {
      if(enemy.dead)continue;
      enemy.hit=Math.max(0,enemy.hit-dt);
      enemy.ward=0;
      enemy.cloaked=!!(enemy.stealth||(enemy.cloakDaggers&&this.elapsed%6<4));
      enemy.reactiveStacks=Math.max(0,enemy.reactiveStacks-dt*.7);
      if(enemy.refraction){enemy.shieldClock-=dt;while(enemy.shieldClock<=0){enemy.shields=enemy.refraction;enemy.shieldClock+=8;}}
      if(enemy.recharge){enemy.rechargeClock-=dt;while(enemy.rechargeClock<=0){enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.maxHp*enemy.recharge);enemy.rechargeClock+=8;}}
      let blinkTravel=0;
      if(enemy.blink){enemy.blinkClock-=dt;while(enemy.blinkClock<=0){blinkTravel+=enemy.blink;enemy.blinkClock+=6;}}

      let haste=1;
      for(const supporter of this.enemies)if(!supporter.dead&&distance(enemy,supporter)<3.5) {
        if(supporter.type==='shaman')haste=Math.max(haste,1.15);
        if(supporter.hasteAura&&this.elapsed%6<3)haste=Math.max(haste,supporter.hasteAura);
        if(supporter.type==='warlock')enemy.ward=0.18;
      }
      enemy.armorShred=enemy.statuses.shred?.amount||0;enemy.magicShred=enemy.statuses.shredMagic?.amount||0;
      for(const [key,status] of Object.entries(enemy.statuses)) {
        if(status.dps)this.damage(enemy,status.dps*Math.min(dt,status.time),key==='burn'?'fire':key==='bleed'?'physical':'poison',{},status.source);
        status.time-=dt;if(status.time<=0)delete enemy.statuses[key];
      }
      if(enemy.dead)continue;
      if(enemy.regen)enemy.hp=Math.min(enemy.maxHp,enemy.hp+enemy.regen*dt);
      if(enemy.type==='sapper')for(const ruin of this.game.towers)if(ruin.state==='ruin'&&distance(ruin,enemy)<1.5)ruin.weakened=3;
      const frenzy=enemy.rush&&this.elapsed%6<2?enemy.rush:enemy.type==='berserker'&&enemy.hp<enemy.maxHp*0.5?1.65:1;
      let slow=enemy.statuses.slow?.amount||0;
      for(const t of this.game.towers)if(t.state==='active'){const s=towerStats(t,this.game.data);if(!enemy.magicImmune&&s.slowAura&&distance(t,enemy)<=s.range)slow=Math.max(slow,s.slowAura);}
      let travel=enemy.speed*dt*haste*frenzy*(enemy.statuses.freeze?0:1-slow)+blinkTravel;
      while(travel>0 && enemy.pathIndex<enemy.route.length) {
        const to=enemy.route[enemy.pathIndex],length=distance(enemy,to);
        if(length<=travel){enemy.x=to.x;enemy.z=to.z;enemy.pathIndex++;enemy.traveled+=length;travel-=length;}
        else {enemy.x+=(to.x-enemy.x)/length*travel;enemy.z+=(to.z-enemy.z)/length*travel;enemy.traveled+=travel;travel=0;}
      }
      if(enemy.pathIndex>=enemy.route.length){enemy.dead=true;this.game.lives=Math.max(0,this.game.lives-(enemy.leak||1));this.game.leaks++;if(enemy.thief)this.game.economy.gold=Math.max(0,this.game.economy.gold-enemy.thief);this.game.emit('leak',{enemy});}
    }
    for(const tower of this.game.towers) {
      tower.weakened=Math.max(0,(tower.weakened||0)-dt);
      if(tower.state!=='active')continue;
      const bonuses=supportBonuses(tower,this.game.towers,this.game.data),stats=towerStats(tower,this.game.data);
      stats.range+=bonuses.range;stats.damage*=bonuses.damage;
      let boost=bonuses.haste,dread=0;
      tower.disarmed=false;
      for(const enemy of this.enemies)if(!enemy.dead){
        const range=distance(tower,enemy);
        if(enemy.untouchable&&range<4)dread=Math.max(dread,enemy.untouchable);
        if(enemy.disarm&&range<3&&(this.elapsed+enemy.id*.37)%8<1.25)tower.disarmed=true;
      }
      boost*=1-dread;
      for(const other of this.game.towers) {
        // Sapper-scorched barricades briefly disrupt adjacent defensive positions.
        if(other.state==='ruin'&&other.weakened>0&&distance(tower,other)<2)boost*=0.85;
      }
      if(stats.burnAura){
        const victims=this.enemies.filter(e=>!e.dead&&distance(e,tower)<=stats.range);
        for(const e of victims)this.damage(e,stats.burnAura*dt,'fire',stats,tower);
        tower.auraPulse=(tower.auraPulse||0)-dt;
        if(victims.length&&tower.auraPulse<=0){this.game.emit('aura-attack',{source:tower,target:victims[0]});this.game.emit('impact',{x:tower.x,z:tower.z,color:stats.color,radius:stats.range});tower.auraPulse=.7;}
      }
      if(stats.damage<=0||tower.disarmed)continue;
      tower.cooldown-=dt*boost;
      // Preserve overshoot: Mythic rapid fire and stacked blessings must survive 3× speed.
      while(tower.cooldown<=0) {
        const targets=this.targetList(tower,stats).slice(0,stats.multishot||1);
        if(!targets.length){tower.cooldown=0;break;}
        tower.cooldown+=stats.interval;
        for(const target of targets) {
          const shot={id:++this.shotSerial,source:tower,target,stats,start:{x:tower.x,z:tower.z},x:tower.x,z:tower.z,progress:0,duration:stats.melee ? .14 : Math.max(0.08,distance(tower,target)/stats.projectileSpeed)};
          this.projectiles.push(shot);this.game.emit('shot',shot);
        }
      }
    }
    for(const shot of this.projectiles) {
      shot.progress+=dt/shot.duration;
      shot.x=shot.start.x+(shot.target.x-shot.start.x)*Math.min(1,shot.progress);
      shot.z=shot.start.z+(shot.target.z-shot.start.z)*Math.min(1,shot.progress);
      if(shot.progress>=1)this.impact(shot);
    }
    this.projectiles=this.projectiles.filter(s=>s.progress<1);
    this.enemies=this.enemies.filter(e=>!e.dead);
    if(this.game.lives<=0)this.game.end(false);
    else if(!this.spawnQueue.length&&!this.enemies.length)this.game.completeWave();
  }
  get remaining(){return this.spawnQueue.length+this.enemies.filter(e=>!e.dead).length;}
}
