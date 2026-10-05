import {enemyNumber} from '../game/core/enemy-rules.js';
import {warbandTraitDetails} from '../game/core/warband-info.js';
import {enemyTraitsMarkup} from './enemy-trait-symbols.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const number=value=>enemyNumber(finite(value));
const percent=value=>number(value*100)+'%';
const statusNames={slow:'Slowed',gazeSlow:'Stone Gaze slow',freeze:'Frozen',petrify:'Petrified',burn:'Burning',poison:'Poisoned',bleed:'Bleeding',shred:'Armor shred',shredMagic:'Magic resistance shred',healBlock:'Healing blocked'};

// Accept the actual combat object only. A stale clone, defeated actor or hidden
// invader must not leave a second source of position/stat information in the UI.
export function selectedEnemyView(enemy,{data,combat}={}){
  if(!enemy||enemy.dead||!Number.isSafeInteger(enemy.id)||enemy.id<=0||!combat?.enemies?.includes(enemy)||combat.game&&combat.game.phase!=='combat'||typeof combat.isRevealed!=='function'||!combat.isRevealed(enemy))return null;
  const maxHp=Math.max(0,finite(enemy.maxHp)),hp=clamp(finite(enemy.hp),0,maxHp);
  const baseArmor=finite(enemy.armor),reactive=Math.max(0,finite(enemy.reactiveArmor)*finite(enemy.reactiveStacks)),shred=finite(enemy.armorShred);
  const armor=Math.max(0,baseArmor+reactive-shred),maxResistance=clamp(finite(data?.balance?.maxResistance,.85),0,1);
  const common=finite(enemy.resists?.magic)+finite(enemy.ward)-finite(enemy.magicShred);
  const resistances=[{name:'Magic',value:clamp(common,-.3,maxResistance)}];
  for(const [kind,value] of Object.entries(enemy.resists||{})){
    if(['magic','physical','piercing','pure'].includes(kind)||!Number.isFinite(value)||value===0)continue;
    resistances.push({name:kind[0]?.toUpperCase()+kind.slice(1),value:clamp(common+value,-.3,maxResistance)});
  }
  const effects=Object.entries(enemy.statuses||{}).filter(([,status])=>Number.isFinite(status?.time)&&status.time>0).map(([kind,status])=>{
    let detail='';
    if(['slow','gazeSlow'].includes(kind)&&Number.isFinite(status.amount))detail=percent(clamp(status.amount,0,1))+' movement slow';
    if(kind==='shred'&&Number.isFinite(status.amount))detail='−'+number(Math.max(0,status.amount))+' armor';
    if(kind==='shredMagic'&&Number.isFinite(status.amount))detail='−'+percent(Math.max(0,status.amount))+' magic resistance';
    return {name:statusNames[kind]||kind,time:status.time,detail};
  });
  const abilities={...enemy,hp:maxHp,maxHp,resists:Object.fromEntries(Object.entries(enemy.resists||{}).filter(([kind,value])=>kind!=='__proto__'&&kind!=='constructor'&&Number.isFinite(value)))};
  for(const key of ['regen','evasion','refraction','krakenShell','reactiveArmor','recharge','rush','hasteAura','untouchable','thief'])abilities[key]=finite(enemy[key]);
  return {id:enemy.id,type:enemy.type,name:enemy.name||'Invader',flying:!!enemy.flying,boss:!!enemy.boss,hp,maxHp,healthPercent:maxHp>0?hp/maxHp*100:0,
    baseArmor,reactive,shred,armor,resistances,physicalImmune:!!enemy.physicalImmune,magicImmune:!!enemy.magicImmune,
    baseSpeed:Math.max(0,finite(enemy.speed)),currentSpeed:Number.isFinite(enemy.currentSpeed)?Math.max(0,enemy.currentSpeed):null,
    effects,traitDetails:warbandTraitDetails(abilities),shields:Math.max(0,finite(enemy.shields)),shieldCapacity:Math.max(0,finite(enemy.refraction)),
    rechargeRemaining:enemy.recharge>0&&Number.isFinite(enemy.rechargeClock)?Math.max(0,enemy.rechargeClock):null};
}

export function selectedEnemyMarkup(enemy,{data,images={},combat,paused=false,speed=1}={}){
  const view=selectedEnemyView(enemy,{data,combat});if(!view)return '';
  const hpText=Math.ceil(view.hp),maxHpText=Math.ceil(view.maxHp),portrait=images['enemy:'+view.type];
  const resistanceRows=view.resistances.map(row=>`<div><dt>${escape(row.name)} resistance</dt><dd>${percent(row.value)}</dd></div>`).join('');
  const effects=view.effects.map(effect=>`<li><span>${escape(effect.name)}${effect.detail?' · '+escape(effect.detail):''}</span><strong>${number(effect.time)}s</strong></li>`).join('');
  return `<section class="enemy-inspection" aria-label="Selected enemy inspection" data-inspected-enemy="${view.id}">
    <div class="enemy-inspection-heading"><span class="section-label">${view.boss?'WARLORD':'ENEMY'} INSPECTION</span><button type="button" class="text-button" data-action="enemy-inspect-close">Close inspection</button></div>
    ${portrait?`<div class="enemy-inspection-portrait"><img src="${escape(portrait)}" alt="${escape(view.name)} portrait"></div>`:''}
    <p class="enemy-inspection-identity">${view.flying?'AIRBORNE':'GROUND'} · INDIVIDUAL #${view.id}</p><h2>${escape(view.name)}</h2>
    <div class="enemy-inspection-health"><div><span>Health</span><strong>${number(hpText)} / ${number(maxHpText)} HP</strong></div><div class="enemy-inspection-health-bar" role="progressbar" aria-label="Remaining enemy health" aria-valuemin="0" aria-valuemax="${view.maxHp||1}" aria-valuenow="${view.hp}" aria-valuetext="${number(hpText)} of ${number(maxHpText)} HP"><span style="width:${view.healthPercent}%"></span></div></div>
    <div class="enemy-inspection-commands"><button type="button" class="text-button" data-action="pause" aria-pressed="${!!paused}">${paused?'Resume':'Pause'}</button><button type="button" class="text-button gold" data-action="speed">${number(Math.max(1,finite(speed,1)))}× speed</button></div>
    <dl class="enemy-inspection-stats"><div><dt>Current armor</dt><dd>${number(view.armor)}</dd></div><div><dt>Base speed</dt><dd>${number(view.baseSpeed)} tiles/s</dd></div>${view.currentSpeed!==null?`<div><dt>Current speed</dt><dd>${number(view.currentSpeed)} tiles/s</dd></div>`:''}${resistanceRows}</dl>
    <p class="enemy-inspection-armor">Base ${number(view.baseArmor)} · Reactive +${number(view.reactive)}${view.shred?' · Shred −'+number(view.shred):''}</p>
    <p class="enemy-inspection-live-note">Speeds and effect durations use game time.</p>
    ${view.physicalImmune||view.magicImmune?`<p class="enemy-inspection-immunities">${[view.physicalImmune?'Physical / piercing immunity':'',view.magicImmune?'Magic / magical effect immunity':''].filter(Boolean).join(' · ')}</p>`:''}
    ${view.shieldCapacity>0?`<p class="enemy-inspection-live-note">Active shields: ${number(view.shields)} / ${number(view.shieldCapacity)}</p>`:''}${view.rechargeRemaining!==null?`<p class="enemy-inspection-live-note">Next recharge: ${number(view.rechargeRemaining)} game seconds${view.effects.some(effect=>effect.name==='Healing blocked')?' · healing blocked':''}</p>`:''}
    <div class="section-label">ACTIVE EFFECTS</div><ul class="enemy-inspection-effects">${effects||'<li><span>No active status effects</span></li>'}</ul>
    <div class="section-label">ABILITIES</div>${enemyTraitsMarkup(view.traitDetails)}
  </section>`;
}

const renderedContents=new WeakMap();
export function updateSelectedEnemyPanel(panel,enemy,options){
  const markup=selectedEnemyMarkup(enemy,options);if(renderedContents.get(panel)===markup)return false;
  const body=panel.closest?.('.side-body, #side-body')||panel,scrollTop=body.scrollTop,scrollLeft=body.scrollLeft;
  const focused=panel.ownerDocument?.activeElement,action=focused&&panel.contains?.(focused)?focused.getAttribute?.('data-action'):null;
  panel.innerHTML=markup;renderedContents.set(panel,markup);
  if(action){const replacement=[...(panel.querySelectorAll?.('[data-action]')||[])].find(button=>button.getAttribute('data-action')===action);replacement?.focus({preventScroll:true});}
  if(Number.isFinite(scrollTop))body.scrollTop=scrollTop;if(Number.isFinite(scrollLeft))body.scrollLeft=scrollLeft;
  return true;
}
