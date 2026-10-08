import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {remainingWarbands,warbandsOverviewMarkup,updateWarbandsOverviewPanel} from '../ui/warbands-overview.js';
import {warbandCardsMarkup} from '../ui/warband-cards.js';
import {Game} from '../game/core/game.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';
import {currentWarbandInfo,bossHealth,warbandVariantInfo,configuredWarbandInfo} from '../game/core/warband-info.js';
import {enemyNumber} from '../game/core/enemy-rules.js';
import {campaignEnemies,campaignWaves,campaignTowers,campaignRecipes} from '../game/core/campaign-roster.js';

const raw=Object.fromEntries(['balance','enemies','waves','towers','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves),towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes)},images=Object.fromEntries(Object.keys(data.enemies).map(id=>['enemy:'+id,'/assets/geometric/portraits/'+id+'.png']));
const options=extra=>({balance:data.balance,data,round:1,phase:'build',waveLimit:50,...extra}),render=extra=>warbandsOverviewMarkup(data.waves,data.enemies,images,options(extra));
const cardNumbers=markup=>[...markup.matchAll(/<article class="warband-card[^>]* data-wave="(\d+)"/g)].map(match=>Number(match[1]));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const analyzer=new WaveThreatAnalyzer(data),army=new ArmyReadiness(data);
const intelligence=(index,towers=[],limit=50)=>{const outlook=analyzer.outlook(index,limit);return {...outlook,readiness:army.evaluate(outlook.next,towers)};};

test('all preparing, combat and loss phases keep the current wave and hide only completed waves',()=>{
 for(const phase of ['build','select','ready','combat','lost'])for(const round of [1,2,14,31,49,50]){
  const result=remainingWarbands(data.waves,{round,phase,waveLimit:50});assert.equal(result.completed,round-1);assert.equal(result.firstWave,round);assert.strictEqual(result.waves[0],data.waves[round-1]);assert.deepEqual(cardNumbers(render({round,phase})),Array.from({length:51-round},(_,i)=>round+i));
 }
 assert.match(render({round:14,phase:'lost'}),/13 waves completed · 37 waves remaining/);assert.match(render({round:14,phase:'lost'}),/Run ended · wave not completed/);assert.doesNotMatch(render({round:14,phase:'lost'}),/data-wave="13"/);
});

test('reward hides the just-completed wave, victory hides the final wave, and 10-wave caps are exact',()=>{
 assert.deepEqual(cardNumbers(render({round:31,phase:'reward'})),Array.from({length:19},(_,i)=>32+i));
 for(const waveLimit of [10,50]){
  assert.deepEqual(cardNumbers(render({waveLimit,round:waveLimit,phase:'ready'})),[waveLimit]);assert.deepEqual(cardNumbers(render({waveLimit,round:waveLimit,phase:'combat'})),[waveLimit]);assert.deepEqual(cardNumbers(render({waveLimit,round:waveLimit,phase:'lost'})),[waveLimit]);
  const won=render({waveLimit,round:waveLimit,phase:'won',intelligence:intelligence(0)});assert.deepEqual(cardNumbers(won),[]);assert.match(won,new RegExp(`${waveLimit} waves completed · 0 waves remaining`));assert.match(won,/All waves completed/);assert.doesNotMatch(won,/wave-intelligence|warband-grid|data-wave=/);
 }
 assert.deepEqual(cardNumbers(render({waveLimit:10,round:1})),[1,2,3,4,5,6,7,8,9,10]);assert.doesNotMatch(render({waveLimit:10,round:1}),/data-wave="11"|host_11/);assert.deepEqual(remainingWarbands(data.waves,{waveLimit:0}).waves,[]);
});

test('real Game completion and nextRound transitions retain original global wave numbers for both campaigns',()=>{
 for(const waveLimit of [10,50]){
  const game=new Game(data,{seed:307,waveLimit});
  for(let round=1;round<=waveLimit;round++){
   assert.equal(game.round,round);assert.equal(remainingWarbands(data.waves,game).firstWave,round);game.phase='ready';assert.equal(game.startCombat(),true);assert.equal(remainingWarbands(data.waves,game).firstWave,round);
   game.completeWave();const result=remainingWarbands(data.waves,game);
   if(round===waveLimit){assert.equal(game.phase,'won');assert.deepEqual(result.waves,[]);assert.equal(result.completed,waveLimit);}
   else{assert.equal(game.phase,'build');assert.equal(game.round,round+1);assert.equal(result.firstWave,round+1);assert.equal(result.completed,round);assert.strictEqual(result.waves[0],data.waves[round]);}
  }
 }
});

test('every remaining actual campaign card contains count, exact effective variant stats, numerical traits and original artwork',()=>{
 const markup=render(),cards=cardNumbers(markup);assert.equal(cards.length,50);
 for(const wave of data.waves)for(const group of wave.groups){
  const definition=data.enemies[group.type];assert.ok(markup.includes(`src="${images['enemy:'+group.type]}"`));assert.ok(markup.includes(escape(definition.appearance)));assert.ok(markup.includes(escape(definition.counter||'Focus your damage along the route.')));assert.ok(markup.includes(`${enemyNumber(group.count)} ${wave.boss?'warlord':'invaders'}`));
  for(const info of warbandVariantInfo({...definition,type:group.type},{...wave,...group})){
   assert.ok(markup.includes(`${enemyNumber(info.maxHp)} HP · ${enemyNumber(info.armor)} armor · ${enemyNumber(info.speed)} tiles/s`),definition.name+' exact configured stats');for(const trait of info.traitDetails)assert.ok(markup.includes(escape(trait.text)),definition.name+' numerical '+trait.kind);
  }
 }
 assert.match(markup,/Each enemy independently chooses a random variant; the wave may contain a mix/);assert.ok(markup.includes(escape(data.enemies.host_50.name)));
});

test('existing intelligence moves intact into the overview header with army readiness, next/after and boss forecast',()=>{
 const towers=[{family:'mage',tier:6,state:'active'},{family:'archer',tier:6,state:'active'},{family:'cleric',tier:3,state:'reserved'}],model=intelligence(34,towers),markup=render({round:35,phase:'ready',intelligence:model});
 assert.match(markup,/aria-labelledby="warbands-intelligence-title"/);assert.match(markup,/Next · Wave 35/);assert.match(markup,/After · Wave 36/);assert.match(markup,/aria-label="Boss forecast"/);assert.match(markup,/Your army/);assert.match(markup,/2 active defenders/);
 for(const row of model.readiness.rows){assert.ok(markup.includes(escape(row.label)));assert.ok(markup.includes(escape(row.response)));assert.match(markup,new RegExp('readiness-level '+row.level));}
 for(const enemy of model.next.enemies)for(const variant of enemy.variants){assert.ok(markup.includes(enemyNumber(variant.maxHp)+' HP'));for(const trait of variant.traitDetails)assert.ok(markup.includes(escape(trait.text)));}
 const header=markup.slice(markup.indexOf('warbands-overview-intelligence'),markup.indexOf('<section class="warbands-remaining"'));assert.match(header,/Immune to magic and magical effects/);assert.match(header,/Immune to physical and piercing damage/);assert.match(header,/Composition only/);
 assert.match(render({round:10,phase:'combat',intelligence:intelligence(10),waveLimit:50}),/Next · Wave 11/);assert.doesNotMatch(render({round:10,phase:'combat',intelligence:intelligence(10),waveLimit:10}),/warbands-overview-intelligence/);
 assert.doesNotMatch(render({round:35,phase:'ready',intelligence:intelligence(33)}),/warbands-overview-intelligence/);assert.doesNotMatch(render({round:35,phase:'lost',intelligence:model}),/warbands-overview-intelligence/);
});

test('actual mixed combat profiles show separate live and queued counts next to the current card',()=>{
 const game=new Game(data,{seed:212});game.round=38;game.phase='ready';assert.equal(game.startCombat(),true);
 const queued=game.combat.spawnQueue.shift();const first=game.combat.spawn(queued.type,queued.modifiers),rows=currentWarbandInfo(game),markup=render({round:38,phase:'combat',liveWarband:rows});
 assert.match(markup,/WAVE 38/);assert.equal((markup.match(/class="warband-live"/g)||[]).length,1);assert.match(markup,/In combat/);const live=markup.slice(markup.indexOf('<section class="warband-live"'),markup.indexOf('<div class="warband-group"'));
 assert.match(live,new RegExp(`${rows.reduce((sum,row)=>sum+row.count,0)} remaining · 1 on the field · ${game.combat.spawnQueue.length} approaching`));
 for(const row of rows){assert.ok(live.includes(`${enemyNumber(row.count)} × ${escape(row.name)}`));assert.ok(live.includes(`${enemyNumber(row.liveCount)} on the field · ${enemyNumber(row.queuedCount)} approaching`));assert.ok(live.includes(enemyNumber(row.speed)+' tiles/s'));for(const trait of row.traitDetails)assert.ok(live.includes(escape(trait.text)));}
 first.dead=true;const changed=render({round:38,phase:'combat',liveWarband:currentWarbandInfo(game)});assert.notEqual(changed,markup);assert.match(changed,/0 on the field/);
 game.combat.spawnQueue=[];assert.deepEqual(currentWarbandInfo(game),[]);assert.match(render({round:38,phase:'combat',liveWarband:[]}),/0 remaining · 0 on the field · 0 approaching/);assert.match(render({round:38,phase:'combat',liveWarband:[]}),/No invaders remain/);
 assert.doesNotMatch(render({round:38,phase:'ready',liveWarband:rows}),/warband-live"/);
});

test('actual boss health includes scheduled health and tracks live damage only on the current boss card',()=>{
 const game=new Game(data,{seed:931});game.round=10;game.phase='ready';game.startCombat();let health=bossHealth(game);let markup=render({round:10,phase:'combat',liveWarband:currentWarbandInfo(game),liveBossHealth:health});
 assert.match(markup,/class="warband-boss-health"/);assert.ok(markup.includes(`${enemyNumber(health.hp)} / ${enemyNumber(health.maxHp)} HP · Approaching`));
 const queued=game.combat.spawnQueue.shift(),boss=game.combat.spawn(queued.type,queued.modifiers);boss.hp-=123;health=bossHealth(game);markup=render({round:10,phase:'combat',liveWarband:currentWarbandInfo(game),liveBossHealth:health});assert.ok(markup.includes(`${enemyNumber(health.hp)} / ${enemyNumber(health.maxHp)} HP`));assert.ok(markup.includes(`value="${health.hp}" max="${health.maxHp}"`));assert.equal((markup.match(/class="warband-boss-health"/g)||[]).length,1);
 assert.doesNotMatch(render({round:9,phase:'combat',liveBossHealth:health}),/class="warband-boss-health"/);assert.doesNotMatch(render({round:10,phase:'ready',liveBossHealth:health}),/class="warband-boss-health"/);assert.doesNotMatch(render({round:10,phase:'combat',liveBossHealth:{hp:NaN,maxHp:100}}),/class="warband-boss-health"/);
});

test('explicit configured variant and group modifier overrides agree with actual effective spawn stats',()=>{
 const base=data.enemies.host_38,variant=base.variants[1],wave={name:'Modifier test',hp:2,speed:2,armor:3,groups:[{type:'host_38',count:4,interval:1,hp:3,speed:.5,armor:9,variant}]},expected=configuredWarbandInfo({...base,type:'host_38'},{...wave,...wave.groups[0]});
 const markup=warbandCardsMarkup([wave],data.enemies,images,{startWave:38});assert.match(markup,/data-wave="38"/);assert.ok(markup.includes(`${enemyNumber(expected.maxHp)} HP · ${enemyNumber(expected.armor)} armor · ${enemyNumber(expected.speed)} tiles/s`));assert.equal((markup.match(/class="warband-variant"/g)||[]).length,1);assert.doesNotMatch(markup,/Cloaked for|independently chooses/);assert.ok(markup.includes(escape(expected.traitDetails.find(trait=>trait.kind==='regen').text)));
});

test('wave names, live profiles, traits, URLs and intelligence copy are escaped without changing authored data',()=>{
 const wave={...data.waves[0],name:'<Wave & "name">'},enemies={...data.enemies,host_01:{...data.enemies.host_01,name:'<Enemy>',appearance:'<script>bad()</script>',counter:'<Counter>'}},pictures={...images,'enemy:host_01':'" onerror="bad()'},row={type:'<type>',name:'<Live & name>',count:1,liveCount:1,queuedCount:0,maxHp:50,armor:1,speed:2,traitDetails:[{text:'<Trait & details>',kind:'unknown'}]},before=JSON.stringify({wave,enemies,pictures,row});
 const markup=warbandsOverviewMarkup([wave],enemies,pictures,{round:1,phase:'combat',liveWarband:[row]});for(const text of [wave.name,enemies.host_01.name,enemies.host_01.appearance,enemies.host_01.counter,row.name,row.traitDetails[0].text])assert.ok(markup.includes(escape(text)));assert.ok(!markup.includes('<script>'));assert.ok(!markup.includes('src="" onerror='));assert.equal(JSON.stringify({wave,enemies,pictures,row}),before);
});

test('overview generation is deterministic and cannot roll draft identities, variants or spend Command Points',()=>{
 const game=new Game(data,{seed:482}),control=new Game(data,{seed:482}),before=JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints,data});const model=intelligence(0,game.towers),first=render({intelligence:model});
 for(let i=0;i<8;i++)assert.equal(render({intelligence:model}),first);assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints,data}),before);assert.equal(game.rng(),control.rng());assert.doesNotMatch(first,/data-action="(?:reroll|craft|keep|reserve)"/);
});

function disclosureHost(){
 const document={activeElement:null},scroll={scrollTop:174},host={ownerDocument:document,details:[],writes:0,stored:'',closest:selector=>selector==='.dialog-body'?scroll:null,contains:detail=>host.details.includes(detail),querySelectorAll:()=>host.details};
 Object.defineProperty(host,'innerHTML',{get:()=>host.stored,set:markup=>{host.writes++;host.stored=markup;scroll.scrollTop=0;const number=markup.match(/data-intelligence-wave="(\d+)"/)?.[1],scope=number?{dataset:{intelligenceWave:number}}:null;host.details=[...markup.matchAll(/<details class="([^"]+)"/g)].map(()=>{const detail={open:false,closest:selector=>selector==='[data-intelligence-wave]'?scope:null};detail.summary={closest:selector=>selector==='details'?detail:null,focus:options=>{assert.deepEqual(options,{preventScroll:true});document.activeElement=detail.summary;}};detail.querySelector=()=>detail.summary;return detail;});}});
 return {host,document,scroll};
}

test('overview refresh preserves nested disclosures, keyboard focus and dialog scroll while leaving unchanged panels intact',()=>{
 const {host,document,scroll}=disclosureHost(),outlook=intelligence(0);outlook.next={...outlook.next,enemies:Array.from({length:5},(_,i)=>({...outlook.next.enemies[0],type:'example'+i,name:'Example '+i}))};
 const args=[data.waves,data.enemies,images,options({intelligence:outlook})];assert.equal(updateWarbandsOverviewPanel(host,...args),true);assert.ok(host.details.length>5);host.details[0].open=true;host.details[3].open=true;document.activeElement=host.details[3].summary;scroll.scrollTop=174;const old=host.details[3];
 const changed={...outlook,readiness:{...outlook.readiness,activeCount:1,empty:false}};assert.equal(updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({intelligence:changed})),true);assert.notStrictEqual(host.details[3],old);assert.equal(host.details[0].open,true);assert.equal(host.details[3].open,true);assert.equal(host.details[1].open,false);assert.strictEqual(document.activeElement,host.details[3].summary);assert.equal(scroll.scrollTop,174);
 const writes=host.writes;assert.equal(updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({intelligence:changed})),false);assert.equal(host.writes,writes);assert.equal(host.details[3].open,true);
 assert.equal(updateWarbandsOverviewPanel(host,data.waves,data.enemies,images,options({round:2,intelligence:intelligence(1)})),true);assert.ok(host.details.every(detail=>!detail.open),'a different preview wave does not inherit previous enemy disclosure choices');assert.equal(scroll.scrollTop,174);
});
