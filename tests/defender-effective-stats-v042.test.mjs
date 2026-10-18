import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,combatTowerStats} from '../game/core/math.js';
import {defenderEffectiveStats,defenderEffectiveStatsMarkup} from '../ui/defender-effective-stats.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {formatTowerNumber} from '../ui/grimoire.js';
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
function unit(game,family='archer',extra={}){const tower={id:game.nextId++,family,tier:1,state:'active',x:12,z:12,priority:'first',cooldown:0,mvpLevel:0,...extra};game.towers.push(tower);return tower;}
function arena(){const game=new Game(data,{seed:471});game.phase='combat';game.combat.start(game.wave);game.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];return game;}
const sum=parts=>parts.reduce((total,part)=>total+part.value,0);

test('actual MVP plus Priest damage and speed buffs match real projectile damage and attack cadence',()=>{
  const game=arena(),tower=unit(game,'archer',{tier:3,mvpLevel:4}),priest=unit(game,'archbishop'),ally=unit(game,'soldier',{mvpLevel:10});
  const target=game.combat.spawn('host_01',{variant:{hp:100000,armor:0,speed:0}});target.x=12;target.z=13;
  const before=JSON.stringify(game.towers),result=defenderEffectiveStats(game,tower),base=towerStats(tower,game.data),combat=combatTowerStats(tower,game.towers,game.data);
  assert.equal(JSON.stringify(game.towers),before);assert.ok(combat.bonuses.damage>1);assert.ok(combat.bonuses.haste>1);
  close(result.damage,combat.stats.damage);close(result.dps,combat.stats.damage/base.interval*combat.bonuses.haste);close(result.interval,base.interval/combat.bonuses.haste);
  close(result.damage,base.damage+sum(result.damageParts));close(result.dps,base.damage/base.interval+sum(result.dpsParts));
  assert.deepEqual(result.damageParts.map(p=>p.key),['mvp','aura']);
  const shots=[];game.on((type,payload)=>{if(type==='shot'&&payload.source===tower)shots.push({time:game.combat.elapsed,damage:payload.stats.damage});});
  for(let i=0;i<100;i++)game.tick(.001);
  assert.ok(shots.length>=1);close(shots[0].damage,result.damage);
  for(let i=0;i<Math.ceil(result.interval*1000)+1;i++)game.tick(.001);
  assert.ok(shots.length>=2);assert.ok(Math.abs((shots[1].time-shots[0].time)-result.interval)<.002);
  assert.equal(priest.state,'active');assert.equal(ally.mvpLevel,10);
});

test('current Dread and multiple disrupted barricades lower the same actual cooldown rate, with additive DPS contributions',()=>{
  const game=arena(),tower=unit(game,'archer',{cooldown:100,mvpLevel:2});unit(game,'cleric',{tier:2});
  const enemy=game.combat.spawn('host_01',{variant:{hp:100000,armor:0,speed:0}});enemy.x=12;enemy.z=13;
  tower.dread={amount:.4,until:3,source:enemy};unit(game,'soldier',{state:'ruin',weakened:3,x:11});unit(game,'soldier',{state:'ruin',weakened:3,x:13});
  const result=defenderEffectiveStats(game,tower),combat=combatTowerStats(tower,game.towers,game.data),rate=combat.bonuses.haste*.6*.85*.85;
  close(result.interval,result.base.interval/rate);close(result.dps,combat.stats.damage/result.interval);close(result.dps,result.base.damage/result.base.interval+sum(result.dpsParts));
  game.tick(.01);close(100-tower.cooldown,.01*rate);
  assert.deepEqual(result.dpsParts.slice(-2).map(p=>p.key),['dread','weakened']);
  game.combat.elapsed=4;for(const ruin of game.towers.filter(t=>t.state==='ruin'))ruin.weakened=0;
  const recovered=defenderEffectiveStats(game,tower);close(recovered.interval,recovered.base.interval/combat.bonuses.haste);assert.ok(recovered.dps>result.dps);
});

test('paused, melancholy and real disarm report zero current direct DPS without destroying their damage bonus',()=>{
  const game=arena(),tower=unit(game,'archer',{mvpLevel:5,attackPaused:true}),base=towerStats(tower,game.data);
  const paused=defenderEffectiveStats(game,tower);close(paused.damage,base.damage*1.25);assert.equal(paused.dps,0);assert.equal(paused.interval,null);assert.equal(paused.stopped,'Attacks paused');
  close(base.damage/base.interval+sum(paused.dpsParts),0);tower.attackPaused=false;tower.melancholyUntil=5;
  assert.equal(defenderEffectiveStats(game,tower).stopped,'Melancholy · cannot attack');tower.melancholyUntil=0;
  const enemy=game.combat.spawn('host_01',{variant:{hp:100000,armor:0,speed:0,disarm:true}});enemy.x=12;enemy.z=13;
  const result=defenderEffectiveStats(game,tower);assert.equal(result.dps,0);assert.equal(result.stopped,'Disarmed · cannot attack');
  game.phase='ready';assert.ok(defenderEffectiveStats(game,tower).dps>0,'Expired combat effects do not pollute preparation');
});

test('candidates and different-rank comparisons remain base only and never borrow active MVP, aura or enemy penalties',()=>{
  const game=arena(),tower=unit(game,'archer',{tier:2,mvpLevel:10}),support=unit(game,'archbishop');
  const preview={...tower,tier:6},before=JSON.stringify(game.towers),result=defenderEffectiveStats(game,tower,{view:preview}),base=towerStats(preview,game.data);
  assert.equal(result.live,false);close(result.damage,base.damage);close(result.dps,base.damage/base.interval);assert.equal(result.damageParts.length,0);assert.equal(result.dpsParts.length,0);
  tower.state='draft';const candidate=defenderEffectiveStats(game,tower);assert.equal(candidate.live,false);close(candidate.damage,towerStats(tower,game.data).damage);assert.equal(candidate.damageParts.length,0);
  tower.state='active';assert.equal(JSON.stringify(game.towers),before);assert.equal(support.state,'active');
});

test('current profile renders readable base and bonus lines, and permanent MVP/support appear directly after Move',()=>{
  const game=arena(),tower=unit(game,'archer',{mvpLevel:3});unit(game,'archbishop');game.phase='ready';
  const html=defenderPanelMarkup(game,tower),move=html.indexOf('data-action="move"'),mvp=html.indexOf('class="mvp-details"'),support=html.indexOf('class="selected-support"'),core=html.indexOf('class="defender-core"');
  assert.ok(move>=0&&move<mvp&&mvp<support&&support<core);assert.doesNotMatch(html,/data-detail-key="mvp"|<summary>MVP/);
  assert.match(html,/data-effective-stats="" data-stats-scope="current"/);assert.match(html,/Direct DPS/);assert.match(html,/Base \d/);assert.match(html,/Own MVP \+15%/);assert.match(html,/Damage aura/);assert.match(html,/Attack-speed aura/);assert.doesNotMatch(html,/Base direct DPS<\/span>/);
  const preview=new DefenderRankPreview();preview.select(tower,4,game.data);const rankHtml=defenderPanelMarkup(game,tower,{rankPreview:preview});
  assert.doesNotMatch(rankHtml,/folio-base-note|data-effective-note/);assert.match(rankHtml,/data-stats-scope="base-preview"/);
  assert.doesNotMatch(defenderEffectiveStatsMarkup(game,tower,{view:{...tower,tier:4}}),/data-contribution/);
});
test('draft candidate detail omits inactive support filler and clearly distinguishes its actual base profile from a rank preview',()=>{
  const game=arena(),tower=unit(game,'archer',{state:'draft'});game.phase='select';
  const html=defenderPanelMarkup(game,tower);assert.match(html,/Actual rank I · Base profile/);assert.doesNotMatch(html,/Retain this defender to receive support effects|class="selected-support"|class="mvp-details"|folio-base-note|data-effective-note/);
  const preview=new DefenderRankPreview();preview.select(tower,4,game.data);const compared=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(compared,/Preview rank IV · Actual rank I unchanged/);assert.match(compared,/data-stats-scope="base-preview"/);assert.doesNotMatch(compared,/folio-base-note|class="selected-support"/);
});
test('actual HUD refresh uses run-local defender/support rules and leaves an unchanged metric node mounted',()=>{
  const approved=JSON.stringify(data),game=new Game(structuredClone(data),{seed:471}),tower=unit(game,'archer',{mvpLevel:3});unit(game,'archbishop');game.phase='ready';game.selected=tower.id;
  game.data.towers.archer.levels[0].damage=37;game.data.towers.archer.levels[0].interval=.4;game.data.towers.archbishop.aura.damageBonus=.25;
  const before=JSON.stringify(game.towers),metrics={_html:defenderEffectiveStatsMarkup(game,tower,{data}),writes:0,get outerHTML(){return this._html;},set outerHTML(value){this._html=value.replace(/data-effective-stats(?=[ >])/,'data-effective-stats=""');this.writes++;}};
  const noop=()=>{},nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',classList:{add:noop,remove:noop},parentElement:{parentElement:{classList:{add:noop,remove:noop}}}});return nodes.get(id);};
  const get=id=>['selected-enemy-panel','current-wave-panel','selected-support-effects'].includes(id)?null:id==='side-body'?{querySelector:()=>metrics}:node(id);
  const main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),start=main.indexOf('function hud(){'),end=main.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);
  const context={game,data,balance:data.balance,app:{},images:{},$:get,phaseUi:{apply:noop,view:'unit'},updateCurrentWaveSummaryPanel:noop,updateCombatStatus:noop,craftingDockModel:()=>({pinned:null}),updatePinnedGoal:noop,contextGuidanceMarkup:()=>'',guidance:null,formatRunDuration:()=>'',audio:{syncGameState:noop},modalPaused:false,developerConnection:null,updateHeaderCombatControls:noop,dpsMeasurement:{view:()=>({rows:[],options:{}})},dpsTracker:{},updateTowerDpsPanel:noop,profile:{bestScore:0},renderWarbandsOverview:noop,rankPreview:new DefenderRankPreview(),defenderEffectiveStatsMarkup};
  const hud=runInNewContext(main.slice(start,end)+'\nhud',context),value=label=>metrics.outerHTML.match(new RegExp(`<span>${label}</span><strong>([^<]+)</strong>`))?.[1];
  hud();const effective=combatTowerStats(tower,game.towers,game.data);assert.equal(value('Damage / hit'),formatTowerNumber(effective.stats.damage));assert.equal(value('Direct DPS'),formatTowerNumber(effective.stats.damage/effective.stats.interval*effective.bonuses.haste));assert.equal(metrics.writes,1);
  hud();assert.equal(metrics.writes,1,'Stable serialized markup does not replace the mounted metrics every HUD tick');
  game.data.towers.archer.levels[0].damage=49;hud();assert.equal(value('Damage / hit'),formatTowerNumber(combatTowerStats(tower,game.towers,game.data).stats.damage));assert.equal(metrics.writes,2,'A real run-local change refreshes displayed values');
  hud();assert.equal(metrics.writes,2);assert.equal(JSON.stringify(game.towers),before);assert.equal(JSON.stringify(data),approved,'Approved global data remains unchanged');
});
