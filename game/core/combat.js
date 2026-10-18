import {distance,damageDefenseBreakdown,towerStats,combatTowerStats,offensiveAuraRange} from './math.js';
import {enemyRevealed} from './visibility.js';
import {enemyRulesFor,enemyDisarmActive} from './enemy-rules.js';
import {damageType,effectDamageType,statusEffectAllowed,attackTargetAllowed,slowAuraApplies} from './combat-rules.js';

const poisonStatus=applications=>{
  return {dps:applications.reduce((sum,application)=>sum+application.dps,0),time:Math.max(...applications.map(application=>application.time)),stacks:applications.length,applications};
};

export class CombatManager {
  constructor(game) {this.game=game;this.enemies=[];this.projectiles=[];this.spawnQueue=[];this.elapsed=0;this.serial=0;this.shotSerial=0;this.spawned=0;this.total=0;}
  get rules(){return enemyRulesFor(this.game);}
  start(wave) {
    this.enemies=[];this.projectiles=[];this.spawnQueue=[];this.elapsed=0;this.spawned=0;
    this.game.mvp?.startWave();
    let time=0.25;
    for(const group of wave.groups) {
      const variants=this.game.data.enemies[group.type].variants;
      const modifiers={...wave,...group};
      for(let i=0;i<group.count;i++){
        // Each queued invader gets its own seeded choice. An explicit preview
        // or scenario variant is preserved without consuming another roll.
        const variant=Object.hasOwn(modifiers,'variant')?modifiers.variant:variants?.[Math.floor(this.game.rng()*variants.length)];
        this.spawnQueue.push({time,type:group.type,modifiers:{...modifiers,variant:variant?structuredClone(variant):variant}});time+=group.interval;
      }
    }
    this.total=this.spawnQueue.length;
    for(const t of this.game.towers){t.cooldown=0;t.melancholy=0;t.melancholyUntil=0;delete t.dread;}
  }
  spawn(type,modifiers={}) {
    const base={...this.game.data.enemies[type],...modifiers.variant};
    const route=(base.flying?this.game.grid.checkpoints:this.game.grid.route).map(p=>({...p}));
    let pathLength=0;for(let i=1;i<route.length;i++)pathLength+=distance(route[i-1],route[i]);
    const enemy={...structuredClone(base),id:++this.serial,type,maxHp:base.hp*(modifiers.hp||1),hp:base.hp*(modifiers.hp||1),speed:base.speed*(modifiers.speed||1),armor:base.armor+(modifiers.armor||0),...route[0],route,pathLength,pathIndex:1,traveled:0,statuses:{},dead:false,hit:0,shields:base.refraction||0,shieldReadyAt:null,shieldClock:null,rechargeClock:this.rules.recharge.period,blinkClock:this.rules.blink.period,reactiveStacks:0,cloaked:!!(base.stealth||base.cloakDaggers)};
    delete enemy.resists;
    this.enemies.push(enemy);this.spawned++;this.game.emit('spawn',{enemy});return enemy;
  }
  isRevealed(enemy){return enemyRevealed(enemy,this.game);}
  canSee(enemy,tower){return enemyRevealed(enemy,this.game,tower);}
  targetList(tower,stats) {
    const candidates=this.enemies.filter(e=>!e.dead&&this.canSee(e,tower)&&attackTargetAllowed(stats,e)&&distance(tower,e)<=stats.range);
    const priority=tower.priority||'first';
    const sorters={first:(a,b)=>b.traveled/b.pathLength-a.traveled/a.pathLength,last:(a,b)=>a.traveled/a.pathLength-b.traveled/b.pathLength,strongest:(a,b)=>b.hp-a.hp,weakest:(a,b)=>a.hp-b.hp,fastest:(a,b)=>b.speed-a.speed,slowest:(a,b)=>a.speed-b.speed};
    const ordered=candidates.sort(sorters[priority]||sorters.first),effect=stats.spreadEffect;
    if(!effect)return ordered;
    // Pending projectiles reserve their effect so rapid or allied shots spread first.
    const unmarked=ordered.filter(e=>!(e.statuses?.[effect]?.time>0)&&!(effect==='poison'&&!statusEffectAllowed(e,'poison')));
    const untouched=unmarked.filter(e=>!this.projectiles.some(s=>s.progress<1&&s.target===e&&(effect==='poison'?(s.stats.poisonDps||s.stats.poison):s.stats.shred)));
    if(untouched.length)return [...untouched,...ordered.filter(e=>!untouched.includes(e))];
    // Wait for the last unmarked targets' shots to land before ordinary targeting.
    return unmarked.length?[]:ordered;
  }
  prepareArmor(enemy){
    enemy.armorShred=enemy.statuses.shred?.amount||0;
    for(const tower of this.game.towers)if(tower.state==='active'){
      const stats=towerStats(tower,this.game.data);
      if(!tower.attackPaused&&stats.armorShredAura&&distance(tower,enemy)<=offensiveAuraRange(stats,'armor'))enemy.armorShred=Math.max(enemy.armorShred,stats.armorShredAura);
    }
    // Old test setups or integrations cannot restore the removed MVP armor aura.
    delete enemy.mvpArmorReduction;
  }
  damage(enemy,amount,type,stats={},source){return this.resolveDamage(enemy,amount,type,stats,source).appliedDamage;}
  resolveDamage(enemy,amount,type,stats={},source){
    type=damageType(type,stats.type);
    const result={enemy,source,type,effect:stats.effect||stats.projectileEffect||type,requestedDamage:amount,beforeDefense:0,effectiveArmor:0,armorMultiplier:1,afterArmor:0,shellBlock:0,afterShell:0,appliedDamage:0,effectiveDamage:0,blockReason:null,directHit:!!stats.directHit,critical:!!stats.critical,visible:this.isRevealed(enemy),contact:false};
    const finish=()=>{this.game.emit('damage-trace',result);return result;};
    if(enemy.dead){result.blockReason='dead';return finish();}
    if(!Number.isFinite(amount)||amount<=0){result.blockReason='invalid';return finish();}
    if(stats.directHit){
      if(enemy.evasion&&!stats.trueStrike&&this.game.rng()<enemy.evasion){result.blockReason='evasion';return finish();}
      if(enemy.shields>0){
        enemy.shields--;
        if(enemy.shields===0){enemy.shieldClock=this.rules.refraction.period;enemy.shieldReadyAt=this.elapsed+enemy.shieldClock;}
        this.game.emit('deflect',{enemy,source,visible:result.visible});result.blockReason='shield';return finish();
      }
    }
    result.contact=true;
    const frozen=enemy.statuses.freeze&&type==='physical'?1.25:1;
    let bonus=1;if(stats.beastBonus&&enemy.beast)bonus*=stats.beastBonus;
    if(stats.bossBonus&&(enemy.boss||enemy.type==='shaman'))bonus*=stats.bossBonus;
    const petrified=enemy.statuses.petrify&&type==='physical'?1+(enemy.statuses.petrify.physicalBonus||0):1;
    result.beforeDefense=amount*frozen*bonus*petrified;
    this.prepareArmor(enemy);
    Object.assign(result,damageDefenseBreakdown(result.beforeDefense,type,enemy,stats,this.game.data.balance));
    result.shellBlock=stats.directHit?Math.min(result.afterArmor,Math.max(0,enemy.krakenShell||0)):0;
    result.afterShell=Math.max(0,result.afterArmor-result.shellBlock);
    if(!result.blockReason&&result.afterShell<=0)result.blockReason='shell';
    if(stats.directHit&&enemy.reactiveArmor)enemy.reactiveStacks=Math.min(this.rules.reactive.maxStacks,enemy.reactiveStacks+1);
    if(result.afterShell<=0)return finish();
    result.appliedDamage=result.afterShell;result.effectiveDamage=Math.min(result.appliedDamage,Math.max(0,enemy.hp));
    enemy.hp-=result.appliedDamage;enemy.hit=.16;
    // Every real, owned HP loss can provoke Dread, including DOT, auras and
    // in-flight/secondary hits. A block or mere proximity never triggers it.
    if(result.effectiveDamage>0&&enemy.untouchable>0&&source?.state==='active'&&this.game.towers.includes(source)){
      const previous=source.dread?.until>this.elapsed?source.dread:null,amount=Math.max(0,Math.min(1,enemy.untouchable));
      source.dread={amount:Math.max(amount,previous?.amount||0),until:this.elapsed+this.rules.dread.duration,source:previous?.amount>amount?previous.source:enemy,visible:previous?.amount>amount?previous.visible:result.visible};
    }
    this.game.emit('hit',{enemy,source,type,effect:result.effect,damage:result.appliedDamage,effectiveDamage:result.effectiveDamage,directHit:result.directHit,visible:result.visible});
    if(stats.critical&&result.effectiveDamage>0)this.game.emit('critical-hit',{enemy,source,type,effect:result.effect,amount:result.appliedDamage,effectiveDamage:result.effectiveDamage,multiplier:stats.critMultiplier,directHit:result.directHit,visible:result.visible});
    finish();
    if(enemy.hp<=0){
      enemy.dead=true;this.game.economy.reward(0,enemy.xp);this.game.kills++;this.game.rewardBossCommandPoints(enemy);
      this.game.awardScore(this.game.round*(enemy.boss?500:10));if(source)source.kills++;
      this.game.emit('death',{enemy,type,visible:result.visible});
    }
    return result;
  }
  applyEffects(enemy,stats,source,{landedDamage=true}={}) {
    if(enemy.dead)return;
    if(enemy.flying)stats={...stats,shred:Math.max(stats.shred||0,stats.antiAirShred||0),slow:Math.max(stats.slow||0,stats.antiAirSlow||0)};
    if(!statusEffectAllowed(enemy,'slow'))stats={...stats,slow:0,freeze:0};
    if(!statusEffectAllowed(enemy,'poison'))stats={...stats,burn:0,burnDps:0,poison:0,poisonDps:0,healingBlockDuration:0};
    if(!landedDamage)stats={...stats,burn:0,burnDps:0,poison:0,poisonDps:0};
    if(stats.slow){const previous=enemy.statuses.slow;enemy.statuses.slow={amount:Math.max(stats.slow,previous?.amount||0),time:stats.slowDuration||2,source:stats.slow>=(previous?.amount||0)?source:previous.source};}
    if(stats.freeze&&this.elapsed>=(enemy.stunRecoveryUntil||0)&&this.game.rng()<stats.freeze){enemy.statuses.freeze={time:(stats.freezeDuration||.8)*(enemy.boss ? .5 : 1),source};enemy.stunRecoveryUntil=this.elapsed+(stats.stunRecovery||0);}
    for(const key of ['burn','poison','bleed'])if(stats[key]||(key==='poison'&&stats.poisonDps)||(key==='burn'&&stats.burnDps)) {
      const previous=enemy.statuses[key];
      const dps=key==='poison'&&stats.poisonDps?stats.poisonDps:key==='burn'&&stats.burnDps?stats.burnDps:stats.damage*stats[key];
      if(key==='poison'){
        // Every successful hit is a separate five-second stack. It cannot
        // refresh any previous hit, including hits from this same defender.
        const applications=(previous?.applications||(previous?.time>0?[previous]:[])).filter(application=>application.time>0);
        const application={dps,time:5,source,damageType:effectDamageType(stats,key)};
        enemy.statuses.poison=poisonStatus([...applications,application]);
      }else enemy.statuses[key]={dps:Math.max(dps,previous?.dps||0),time:stats.dotDuration||3,source:dps>=(previous?.dps||0)?source:previous.source,damageType:effectDamageType(stats,key)};
    }
    if(stats.shred){const previous=enemy.statuses.shred;enemy.statuses.shred={amount:Math.max(stats.shred,previous?.amount||0),time:4,source:stats.shred>=(previous?.amount||0)?source:previous.source};}
    this.prepareArmor(enemy);
    if(stats.healingBlockDuration)enemy.statuses.healBlock={time:stats.healingBlockDuration,source};
  }
  updatePoison(enemy,status,dt){
    let applications=status.applications,remaining=dt;
    // Split at actual expiry boundaries, including when one coarse tick spans
    // the transition from a stronger poison to a still-active weaker source.
    while(remaining>0&&applications.length&&!enemy.dead){
      const slice=Math.min(remaining,...applications.map(application=>application.time));
      for(const application of applications){if(enemy.dead)break;this.damage(enemy,application.dps*slice,application.damageType||'magical',{effect:'poison'},application.source);}
      for(const application of applications)application.time-=slice;
      applications=applications.filter(application=>application.time>1e-9);remaining-=slice;
    }
    if(applications.length&&!enemy.dead)enemy.statuses.poison=poisonStatus(applications);
    else delete enemy.statuses.poison;
  }
  landedProcs(stats,source,{landedDamage=true}={}) {
    if(landedDamage&&stats.recoverChance&&this.game.rng()<stats.recoverChance){const before=this.game.lives;this.game.lives=Math.min(this.game.data.balance.startingLives,this.game.lives+(stats.recoverLives||1));const amount=this.game.lives-before;if(amount>0)this.game.emit('recover',{source,amount});}
    if(stats.stoneGazeChance&&this.game.rng()<stats.stoneGazeChance)source.stoneGaze={remaining:stats.stoneGazeDuration||6,facing:new Map(),petrified:new Set(),stats};
  }
  updateStoneGazes(dt) {
    for(const tower of this.game.towers){
      const gaze=tower.stoneGaze;if(!gaze)continue;
      if(tower.state!=='active'){delete tower.stoneGaze;continue;}
      const slice=Math.min(dt,gaze.remaining),s=gaze.stats;
      for(const e of this.enemies){
        if(e.dead||(!s.petrifyIgnoresImmunity&&e.magicImmune)||!this.canSee(e,tower)||distance(tower,e)>(s.stoneGazeRange||10)){gaze.facing.delete(e.id);continue;}
        if(statusEffectAllowed(e,'gazeSlow'))e.statuses.gazeSlow={amount:s.stoneGazeSlow||.8,time:slice+.05,source:tower};
        if(gaze.petrified.has(e.id))continue;
        const next=e.route[e.pathIndex],dx=(next?.x??e.x)-e.x,dz=(next?.z??e.z)-e.z;
        const toward=dx*(tower.x-e.x)+dz*(tower.z-e.z)>0;
        const facing=toward?(gaze.facing.get(e.id)||0)+slice:0;gaze.facing.set(e.id,facing);
        if(facing>=(s.stoneGazeFacingTime||2)){e.statuses.petrify={time:s.petrifyDuration||3,physicalBonus:s.petrifyPhysicalBonus??1,source:tower};gaze.petrified.add(e.id);}
      }
      gaze.remaining-=dt;if(gaze.remaining<=0)delete tower.stoneGaze;
    }
  }
  bounceFrost(target,stats,source) {
    let previous=target;
    for(let i=0;i<stats.bouncingFrost;i++){
      const next=this.enemies.filter(e=>!e.dead&&this.canSee(e,source)&&e!==previous&&distance(e,previous)<=(stats.bouncingFrostRange||10)).sort((a,b)=>distance(a,previous)-distance(b,previous))[0];
      if(!next)break;
      if(this.damage(next,stats.bouncingFrostDamage||stats.damage,effectDamageType(stats,'frost'),{...stats,effect:'frost',directHit:true},source)>0)this.applyEffects(next,stats,source);
      this.game.emit('chain',{from:previous,to:next,color:stats.color,effect:'frost',source,visible:this.canSee(previous,source)&&this.canSee(next,source)});previous=next;
    }
  }
  nearbyMagicProcs(caster,target,stats) {
    if(damageType(stats.type)==='physical')return;
    for(const ally of this.game.towers){
      if(ally===caster||ally.state!=='active'||ally.attackPaused)continue;
      const {stats:s}=combatTowerStats(ally,this.game.towers,this.game.data);
      if(s.bouncingFrostTrigger!=='nearby-ally-magic-hit'||distance(ally,caster)>(s.bouncingFrostTriggerRange||6))continue;
      if(this.game.rng()<s.bouncingFrostChance)this.bounceFrost(target,s,ally);
    }
  }
  impact(shot) {
    const {target,stats,source}=shot;
    // A target that recloaks before impact cannot be struck or disclose its
    // hidden position through impact particles. Existing damage-over-time stays.
    if(!this.canSee(target,source)||!attackTargetAllowed(stats,target))return;
    const victims=stats.splash ? this.enemies.filter(e=>!e.dead&&attackTargetAllowed(stats,e)&&(!stats.melee||distance(e,source)<=stats.range+.25)&&distance(e,target)<=stats.splash) : target.dead||(stats.melee&&(target.flying||distance(source,target)>stats.range+.25))?[]:[target];
    const critical=!!(stats.critChance&&this.game.rng()<stats.critChance);
    const hitDamage=stats.damage*(critical?stats.critMultiplier:1),hitStats={...stats,directHit:true,critical};
    const landed=[],contacted=[];
    for(const enemy of victims)if(this.canSee(enemy,source)){
      const result=this.resolveDamage(enemy,hitDamage,stats.type,hitStats,source);
      if(result.contact){contacted.push(enemy);this.applyEffects(enemy,stats,source,{landedDamage:result.appliedDamage>0});}
      if(result.appliedDamage>0)landed.push(enemy);
    }
    for(const enemy of landed)this.nearbyMagicProcs(source,enemy,stats);
    if(landed.length||(contacted.length&&stats.petrifyIgnoresImmunity))this.landedProcs(stats,source,{landedDamage:landed.length>0});
    if(stats.cleave&&victims.length)for(const e of this.enemies)if(e!==target&&!e.dead&&this.canSee(e,source)&&distance(e,target)<=stats.cleaveRadius)this.damage(e,hitDamage*stats.cleave,stats.cleaveType||stats.type,{...stats,critical},source);
    if(landed.length&&stats.effectsRadius)for(const e of this.enemies)if(!e.dead&&this.canSee(e,source)&&distance(e,target)<=stats.effectsRadius)this.applyEffects(e,{type:stats.type,slow:stats.slow,slowDuration:stats.slowDuration,healingBlockDuration:stats.healingBlockDuration},source);
    if(stats.chain&&(!stats.chainSequential||landed.length)&&(!stats.chainChance||this.game.rng()<stats.chainChance)) {
      if(stats.chainSequential){
        const used=new Set(victims);let previous=target;
        for(let i=0;i<stats.chain;i++){
          const next=this.enemies.filter(e=>!e.dead&&this.canSee(e,source)&&!used.has(e)&&distance(e,previous)<=(stats.chainRange||4)).sort((a,b)=>distance(a,previous)-distance(b,previous))[0];
          if(!next)break;
          used.add(next);
          if(this.damage(next,stats.chainDamage||stats.damage*.55,stats.type,{...stats,effect:'lightning',directHit:true},source)>0)this.applyEffects(next,stats,source);
          this.game.emit('chain',{from:previous,to:next,color:stats.color,effect:'lightning',source,visible:this.canSee(previous,source)&&this.canSee(next,source)});previous=next;
        }
      }else{
        const chained=this.enemies.filter(e=>!e.dead&&this.canSee(e,source)&&!victims.includes(e)&&distance(e,target)<(stats.chainRange||4)).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,stats.chain);
        for(const e of chained){if(this.damage(e,stats.chainDamage||stats.damage*0.55,stats.type,{...stats,directHit:true},source)>0)this.applyEffects(e,stats,source);this.game.emit('chain',{from:target,to:e,color:stats.color,effect:'lightning',source,visible:this.canSee(target,source)&&this.canSee(e,source)});}
      }
    }
    if(landed.length&&stats.forkedTargets&&this.game.rng()<(stats.forkedChance||1)){
      const forked=this.enemies.filter(e=>!e.dead&&this.canSee(e,source)&&distance(e,target)<=(stats.forkedRange||10)).sort((a,b)=>distance(a,target)-distance(b,target)).slice(0,stats.forkedTargets);
      for(const e of forked){this.damage(e,stats.forkedDamage,effectDamageType(stats,'lightning'),{...stats,effect:'lightning'},source);this.game.emit('chain',{from:source,to:e,color:stats.color,effect:'lightning',source,visible:this.canSee(e,source)});}
    }
    if(landed.length&&stats.bouncingFrost&&stats.bouncingFrostTrigger!=='nearby-ally-magic-hit'&&this.game.rng()<(stats.bouncingFrostChance||1))this.bounceFrost(target,stats,source);
    if(landed.length&&stats.burnedChance&&this.game.rng()<stats.burnedChance){
      const victims=[],type=effectDamageType(stats,'fire');let amount=0;
      for(const e of this.enemies)if(!e.dead&&this.canSee(e,source)&&distance(e,target)<=stats.burnedRadius){const damage=this.damage(e,stats.damage*stats.burnedMultiplier,type,{...stats,effect:'fire'},source);if(damage>0){victims.push(e);amount+=damage;}}
      if(victims.length)this.game.emit('burn-proc',{source,target,victims,amount,type,effect:'fire',visible:this.canSee(target,source)});
    }
    this.game.emit('impact',{source,target,stats,effect:stats.projectileEffect,x:target.x,z:target.z,color:stats.color,heavy:stats.damage>160,radius:stats.splash||stats.cleaveRadius||0.4,melee:stats.melee});
  }
  update(dt) {
    const R=this.rules;
    const frameStart=this.elapsed,dreadAtStart=new Map(this.game.towers.filter(t=>t.dread?.until>frameStart).map(t=>[t,{...t.dread}]));
    this.elapsed+=dt;
    while(this.spawnQueue.length && this.spawnQueue[0].time<=this.elapsed) {const item=this.spawnQueue.shift();this.spawn(item.type,item.modifiers);}
    this.updateStoneGazes(dt);
    for(const enemy of this.enemies) {
      if(enemy.dead)continue;
      for(const key of ['slow','freeze','gazeSlow','poison','burn','healBlock'])if(!statusEffectAllowed(enemy,key))delete enemy.statuses[key];
      enemy.hit=Math.max(0,enemy.hit-dt);
      enemy.cloaked=!!(enemy.stealth||(enemy.cloakDaggers&&this.elapsed%R.cloak.period<R.cloak.hiddenDuration));
      enemy.reactiveStacks=Math.max(0,enemy.reactiveStacks-dt*R.reactive.decayPerSecond);
      if(enemy.refraction&&enemy.shields===0&&Number.isFinite(enemy.shieldReadyAt)){
        enemy.shieldClock=Math.max(0,enemy.shieldReadyAt-this.elapsed);
        if(this.elapsed+1e-9>=enemy.shieldReadyAt){enemy.shields=enemy.refraction;enemy.shieldClock=null;enemy.shieldReadyAt=null;}
      }
      let blinkTravel=0;
      if(enemy.blink){enemy.blinkClock-=dt;while(enemy.blinkClock<=1e-9){blinkTravel+=enemy.blink;enemy.blinkClock+=R.blink.period;}}

      let haste=1;
      for(const supporter of this.enemies)if(!supporter.dead&&distance(enemy,supporter)<R.support.radius) {
        if(supporter.type==='shaman')haste=Math.max(haste,R.support.shamanHaste);
        if(supporter.hasteAura&&this.elapsed%R.support.hastePeriod<R.support.hasteDuration)haste=Math.max(haste,supporter.hasteAura);
      }
      this.prepareArmor(enemy);
      const healingBlockedFor=Math.max(0,enemy.statuses.healBlock?.time||0);
      for(const [key,status] of Object.entries(enemy.statuses)) {
        if(key==='poison'&&status.applications){this.updatePoison(enemy,status,dt);continue;}
        if(status.dps)this.damage(enemy,status.dps*Math.min(dt,status.time),status.damageType||(key==='bleed'?'physical':'magical'),{effect:key==='burn'?'fire':key},status.source);
        status.time-=dt;if(status.time<=0)delete enemy.statuses[key];
      }
      if(enemy.dead)continue;
      this.updateEnemyHealing(enemy,dt,healingBlockedFor);
      if(enemy.type==='sapper')for(const ruin of this.game.towers)if(ruin.state==='ruin'&&distance(ruin,enemy)<R.sapper.radius)ruin.weakened=R.sapper.duration;
      const frenzy=enemy.rush&&this.elapsed%R.rush.period<R.rush.duration?enemy.rush:enemy.type==='berserker'&&enemy.hp<enemy.maxHp*R.rush.berserkerThreshold?R.rush.berserkerSpeed:1;
      let slow=Math.max(enemy.statuses.slow?.amount||0,enemy.statuses.gazeSlow?.amount||0);
      this.prepareArmor(enemy);
      for(const t of this.game.towers)if(t.state==='active'&&!t.attackPaused){const s=towerStats(t,this.game.data);if(slowAuraApplies(s,enemy)&&distance(t,enemy)<=offensiveAuraRange(s,'slow'))slow=Math.max(slow,s.slowAura);}
      if(enemy.boss)slow*=this.game.data.balance.bossSlowMultiplier??.5;
      const move=amount=>{
        let travel=amount;
        while(travel>0 && enemy.pathIndex<enemy.route.length) {
          const to=enemy.route[enemy.pathIndex],length=distance(enemy,to);
          if(length<=travel){enemy.x=to.x;enemy.z=to.z;enemy.pathIndex++;enemy.traveled+=length;travel-=length;}
          else {enemy.x+=(to.x-enemy.x)/length*travel;enemy.z+=(to.z-enemy.z)/length*travel;enemy.traveled+=travel;travel=0;}
        }
      };
      if(blinkTravel&&!enemy.statuses.petrify){
        const from={x:enemy.x,z:enemy.z},visible=this.isRevealed(enemy);
        move(blinkTravel);
        if(enemy.x!==from.x||enemy.z!==from.z)this.game.emit('teleport',{enemy,from,to:{x:enemy.x,z:enemy.z},visible:visible&&this.isRevealed(enemy)});
      }
      // Inspection reports the movement rate actually used in this game tick.
      enemy.currentSpeed=enemy.statuses.petrify?0:enemy.speed*haste*frenzy*(enemy.statuses.freeze?0:1-slow);
      move(enemy.statuses.petrify?0:enemy.speed*dt*haste*frenzy*(enemy.statuses.freeze?0:1-slow));
      if(enemy.pathIndex>=enemy.route.length){enemy.dead=true;this.game.lives=Math.max(0,this.game.lives-(enemy.leak||1));this.game.leaks++;if(enemy.thief)this.game.economy.gold=Math.max(0,this.game.economy.gold-enemy.thief);this.game.emit('leak',{enemy});}
    }
    for(const tower of this.game.towers) {
      tower.weakened=Math.max(0,(tower.weakened||0)-dt);
      if(tower.state!=='active')continue;
      const melancholySlice=Math.min(dt,Math.max(0,(tower.melancholyUntil||0)-(this.elapsed-dt)));
      tower.melancholy=Math.max(0,(tower.melancholyUntil||0)-this.elapsed);
      const {stats,bonuses}=combatTowerStats(tower,this.game.towers,this.game.data);
      let boost=bonuses.haste;
      const fear=dreadAtStart.get(tower),dreadSlice=Math.min(dt,Math.max(0,(fear?.until||0)-frameStart));
      const dread=Math.max(0,Math.min(1,fear?.amount||0))*(1-Math.max(0,Math.min(1,bonuses.controlResistance||0)));
      if(tower.dread?.until<=this.elapsed)delete tower.dread;
      tower.disarmed=tower.melancholy>0;
      for(const enemy of this.enemies)if(!enemy.dead){
        const range=distance(tower,enemy);
        if(range<R.disarm.radius&&enemyDisarmActive(enemy,this.elapsed,bonuses.controlResistance||0,R))tower.disarmed=true;
      }
      for(const other of this.game.towers) {
        // Sapper-scorched barricades briefly disrupt adjacent defensive positions.
        if(other.state==='ruin'&&other.weakened>0&&distance(tower,other)<R.sapper.defenderRadius)boost*=1-R.sapper.attackPenalty;
      }
      if(tower.attackPaused)continue;
      if(stats.burnAura){
        const victims=this.enemies.filter(e=>!e.dead&&this.canSee(e,tower)&&distance(e,tower)<=offensiveAuraRange(stats,'burn'));
        for(const e of victims)this.damage(e,stats.burnAura*dt,effectDamageType(stats,'fire'),{...stats,effect:'fire'},tower);
        tower.auraPulse=(tower.auraPulse||0)-dt;
        if(victims.length&&tower.auraPulse<=0){this.game.emit('aura-attack',{source:tower,target:victims[0],stats,effect:'fire'});this.game.emit('impact',{source:tower,target:victims[0],stats,effect:'fire',aura:true,x:tower.x,z:tower.z,color:stats.color,radius:offensiveAuraRange(stats,'burn')});tower.auraPulse=.7;}
      }
      if(stats.damage<=0||tower.disarmed)continue;
      tower.cooldown-=((dt-melancholySlice)-Math.max(0,dreadSlice-melancholySlice)*dread)*boost;
      // Preserve overshoot: Mythic rapid fire and stacked blessings must survive 3× speed.
      while(tower.cooldown<=0) {
        const targets=this.targetList(tower,stats).slice(0,stats.multishot||1);
        if(!targets.length){tower.cooldown=0;break;}
        // Melancholy triggers at attack start, cancelling this attack. Its
        // combat-time deadline is independent of attack-speed blessings.
        if(stats.melancholyChance&&this.game.rng()<stats.melancholyChance){
          tower.melancholy=stats.melancholyDuration||5;tower.melancholyUntil=this.elapsed+tower.melancholy;tower.disarmed=true;tower.cooldown=0;
          this.game.emit('melancholy',{source:tower,duration:tower.melancholy});break;
        }
        tower.cooldown+=stats.interval;
        for(const target of targets) {
          const shot={id:++this.shotSerial,source:tower,target,stats,effect:stats.projectileEffect,start:{x:tower.x,z:tower.z},x:tower.x,z:tower.z,progress:0,duration:stats.melee ? .14 : Math.max(0.08,distance(tower,target)/stats.projectileSpeed)};
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
  updateEnemyHealing(enemy,dt,blockedFor){
    const R=this.rules;
    const clockEpsilon=1e-9;
    const heal=(value,cause)=>{
      const before=enemy.hp;enemy.hp=Math.min(enemy.maxHp,enemy.hp+value);
      const amount=enemy.hp-before;
      if(amount>0)this.game.emit('enemy-heal',{enemy,cause,amount,visible:this.isRevealed(enemy)});
    };
    const regenerate=(from,to)=>{
      const active=Math.max(0,to-Math.max(from,blockedFor));
      if(enemy.regen>0&&active>0)heal(enemy.maxHp*enemy.regen*active,'regeneration');
    };
    let cursor=0;
    if(enemy.recharge>0){
      let deadline=enemy.rechargeClock??R.recharge.period;
      while(deadline<=dt+clockEpsilon){
        const at=Math.min(dt,Math.max(0,deadline));regenerate(cursor,at);
        // Compare each real deadline with expiry, instead of sampling a block
        // at the beginning/end of a large tick and losing eligible pulses.
        if(at+clockEpsilon>=blockedFor)heal(Math.max(0,enemy.maxHp-enemy.hp)*enemy.recharge,'recharge');
        cursor=at;deadline+=R.recharge.period;
      }
      enemy.rechargeClock=deadline-dt;
    }
    regenerate(cursor,dt);
  }
  get remaining(){return this.spawnQueue.length+this.enemies.filter(e=>!e.dead).length;}
}
