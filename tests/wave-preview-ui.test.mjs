import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wavePreviewMarkup,wavePreviewGateMarkup} from '../ui/wave-preview.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {ArmyReadiness} from '../game/core/army-readiness.js';

const threat=(id,label,extra={})=>({id,label,icon:'shield',description:`${label} affects the approaching wave.`,...extra});
const enemy=(name,count,extra={})=>({type:name.toLowerCase().replaceAll(' ','_'),name,count,flying:false,boss:false,variants:[{name,maxHp:1876,armor:17,speed:2.3,flying:false,traitDetails:[{text:'18% magic resistance',kind:'magic'}]}],...extra});
function model(){
  return {next:{number:14,name:'Armored assault',profile:'ARMORED ASSAULT',special:null,totalCount:26,enemies:[enemy('Armored Orc',18),enemy('Wolf Rider',8)],primaryThreats:[threat('heavyArmor','Heavy Armor'),threat('fast','Fast')]},after:{number:15,name:'A coming raid',profile:'FAST RAID',special:null,primaryThreats:[threat('fast','Fast')]},boss:{number:20,distance:6,visibility:'marker',special:'boss'},readiness:{activeCount:3,empty:false,scope:'Composition only; placement, range coverage and maze length are not evaluated.',rows:[{threatId:'heavyArmor',label:'Anti-armor',response:'Magic damage / armor penetration',level:'good',ordinal:2},{threatId:'fast',label:'Control',response:'Slow / stun',level:'weak',ordinal:0}]}};
}
const subsection=(html,cls)=>html.match(new RegExp(`<section class="${cls}"[\\s\\S]*?<\\/section>`))?.[0]||'';
const summaries=html=>[...html.matchAll(/<summary\b[^>]*>([\s\S]*?)<\/summary>/g)].map(match=>match[1]);

test('immediate preview shows real composition, full counts, profile and primary threats without main-summary stats',()=>{
  const html=wavePreviewMarkup(model(),{},{});
  assert.match(html,/Next · Wave 14/);assert.match(html,/ARMORED ASSAULT/);assert.match(html,/26 invaders/);
  assert.match(html,/18 × Armored Orc/);assert.match(html,/8 × Wolf Rider/);assert.match(html,/Heavy Armor/);assert.match(html,/Fast/);
  for(const summary of summaries(html))assert.doesNotMatch(summary,/HP|tiles\/s|18% magic resistance|17 armor/);
});

test('optional native enemy details contain actual configured variants and reusable defense glyphs',()=>{
  const m=model();m.next.enemies=[enemy('Twin Riders',10,{variants:[{name:'Ashen Riders',maxHp:2100,armor:12,speed:2.5,flying:true,traitDetails:[{kind:'magicImmune',text:'Immune to magic and magical effects'}]},{name:'Spectral Riders',maxHp:2100,armor:12,speed:2.5,flying:true,traitDetails:[{kind:'physicalImmune',text:'Immune to physical and piercing damage'}]}]})];
  const html=wavePreviewMarkup(m,{},{});
  assert.match(html,/<details class="wave-enemy-details"><summary>/);assert.match(html,/Each enemy independently chooses a variant/);
  assert.match(html,/Variant 1 · Ashen Riders/);assert.match(html,/Variant 2 · Spectral Riders/);assert.match(html,/2,100 HP · 12 armor · 2.5 tiles\/s · Air/);
  assert.match(html,/data-defense="magicImmune"/);assert.match(html,/data-defense="physicalImmune"/);assert.match(html,/Immune to physical and piercing damage/);
});

test('wave after next projects only partial intelligence even if the caller passes a full analysis',()=>{
  const m=model();m.after={...m.next,number:15,name:'Future elite wave',profile:'ELITE',totalCount:77777,enemies:[enemy('Secret Unit',65432)],hiddenStats:'999999 HP'};
  const html=subsection(wavePreviewMarkup(m,{},{}),'wave-after-preview');
  assert.match(html,/After · Wave 15/);assert.match(html,/Future elite wave/);assert.match(html,/ELITE/);assert.match(html,/Heavy Armor/);
  assert.doesNotMatch(html,/77777|77,777|65432|65,432|Secret Unit|999999|HP|armor ·|tiles\/s|enemy-details/);
});

test('distant boss marker suppresses identity, category, traits and full preview payloads',()=>{
  const m=model();m.boss={number:30,distance:16,visibility:'marker',name:'Hidden Warlord',profile:'HIDDEN CATEGORY',primaryThreats:[threat('secret','Secret mechanic')],preview:m.next};
  const html=subsection(wavePreviewMarkup(m,{},{}),'wave-boss-forecast');
  assert.match(html,/Boss in 16 waves/);assert.match(html,/Wave 30/);assert.doesNotMatch(html,/Hidden Warlord|HIDDEN CATEGORY|Secret mechanic|Armored Orc|HP/);
});

test('boss identity forecast reveals name and category while keeping its later traits hidden',()=>{
  const m=model();m.boss={number:17,distance:3,visibility:'identity',name:'Storm Warlord',profile:'BOSS',primaryThreats:[threat('enrage','Enrage')]};
  const html=subsection(wavePreviewMarkup(m,{},{}),'wave-boss-forecast');
  assert.match(html,/Boss in 3 waves/);assert.match(html,/Storm Warlord/);assert.match(html,/BOSS/);assert.doesNotMatch(html,/Enrage|HP|tiles\/s/);
});

test('near boss forecast shows key traits and singular distance without a numeric stat sheet',()=>{
  const m=model();m.boss={number:15,distance:1,visibility:'traits',name:'Iron Warlord',profile:'BOSS',primaryThreats:[threat('highHealth','High Health'),threat('heavyArmor','Heavy Armor')],maxHp:123456,armor:999};
  const html=subsection(wavePreviewMarkup(m,{},{}),'wave-boss-forecast');
  assert.match(html,/Boss in 1 wave/);assert.match(html,/Iron Warlord/);assert.match(html,/High Health/);assert.match(html,/Heavy Armor/);
  assert.doesNotMatch(html,/123456|123,456|999|HP|tiles\/s/);
});

test('immediate boss has a clear boss hierarchy and full optional details',()=>{
  const m=model();m.next.special='boss';m.next.profile='BOSS';m.next.enemies=[enemy('Iron Warlord',1,{boss:true})];m.next.totalCount=1;
  m.boss={number:14,distance:0,visibility:'full',special:'boss',preview:m.next};
  const html=wavePreviewMarkup(m,{},{});assert.match(html,/class="wave-intelligence boss"/);assert.match(html,/Iron Warlord/);assert.match(html,/Boss wave now/);assert.match(html,/1,876 HP/);
  assert.match(wavePreviewGateMarkup(m,{},{}),/class="wave-preview-gate boss"/);
});

test('primary tags are deduplicated and a standard wave stays readable',()=>{
  const m=model();m.after=null;m.boss=null;m.next.primaryThreats=[threat('heavyArmor','Heavy Armor'),threat('heavyArmor','Duplicate Armor'),null,{id:'incomplete'}];
  let html=wavePreviewMarkup(m,{},{});assert.equal((html.match(/data-threat="heavyArmor"/g)||[]).length,1);assert.doesNotMatch(html,/Duplicate Armor/);
  m.next.primaryThreats=[];html=wavePreviewMarkup(m,{},{});assert.match(html,/Standard wave/);
});

test('possible variant threats are visibly qualified without inventing an exact variant split',()=>{
  const m=model();m.next.primaryThreats=[threat('magicImmunity','Magic Immunity',{possible:true})];
  const html=wavePreviewMarkup(m,{},{});assert.match(html,/<small>Possible<\/small>/);assert.match(html,/Possible in a random variant/);assert.doesNotMatch(html,/50%|half the wave|variant count/i);
});

test('readiness shows four human levels and capabilities, never internal numeric scores or predictions',()=>{
  const m=model();m.readiness.rows=['weak','fair','good','strong'].map((level,ordinal)=>({threatId:level,label:`Response ${level}`,response:'Actual attack capability',level,ordinal,score:72.43}));
  const html=wavePreviewMarkup(m,{},{});
  for(const level of ['Weak','Fair','Good','Strong'])assert.match(html,new RegExp(`>${level}<`));
  assert.match(html,/Actual attack capability/);assert.match(html,/3 active defenders/);assert.match(html,/Composition only/);
  assert.doesNotMatch(html,/72\.43|ordinal|score:|guaranteed|will win|will lose|Pick Mage|BEST CHOICE/);
});

test('empty army and missing readiness display safely without false capability recommendations',()=>{
  const m=model();m.readiness={activeCount:0,empty:true,rows:[],scope:'Scope'};
  let html=wavePreviewMarkup(m,{},{});assert.match(html,/0 active defenders/);assert.match(html,/No active defenders yet/);assert.doesNotMatch(html,/readiness-level/);
  delete m.readiness;html=wavePreviewMarkup(m,{},{});assert.match(html,/Army readiness is unavailable/);
});

test('empty waves, missing future waves and final-wave boundaries create no phantom preview',()=>{
  assert.equal(wavePreviewMarkup({next:null}, {}, {}),'');assert.equal(wavePreviewMarkup(null,{},{}),'');
  const m=model();delete m.after;delete m.boss;m.next.enemies=[];
  const html=wavePreviewMarkup(m,{},{});assert.match(html,/No enemy composition is available/);assert.doesNotMatch(html,/wave-after-preview|wave-boss-forecast|After ·/);
  assert.match(wavePreviewGateMarkup({next:null},{},{}),/No upcoming wave is available/);assert.doesNotMatch(wavePreviewGateMarkup({next:null},{},{}),/data-action=/);
});

test('unknown enemies, unavailable portraits and unfamiliar trait glyphs never crash or display broken images',()=>{
  const m=model();m.next.enemies=[{type:'unknown',name:'Unknown invader',count:4,unknown:true,variants:[{name:'Unknown profile',traitDetails:[{kind:'constructor',text:'Unfamiliar trait'}]}]}];m.next.primaryThreats=[threat('unknown','Unfamiliar threat',{icon:'constructor'})];
  const html=wavePreviewMarkup(m,{},{});assert.match(html,/wave-enemy-placeholder/);assert.match(html,/Enemy information unavailable/);assert.match(html,/Unfamiliar trait/);
  assert.doesNotMatch(html,/<img|undefined|NaN|function Object|data-defense="constructor"/);
});

test('enemy names, URLs, wave names, labels and heading identifiers are escaped in every context',()=>{
  const m=model();m.next.name='<script>bad()</script>';m.next.enemies=[enemy('<Orc> "chief"',1)];m.next.primaryThreats=[threat('x" data-bad="1','<Unsafe>')];
  const images={[`enemy:${m.next.enemies[0].type}`]:'portrait.png" onerror="bad()'};
  const html=wavePreviewMarkup(m,{},images,{headingId:'title" onclick="bad()'});
  assert.match(html,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.match(html,/&lt;Orc&gt; &quot;chief&quot;/);assert.match(html,/&lt;Unsafe&gt;/);
  assert.match(html,/portrait\.png&quot; onerror=&quot;bad\(\)/);assert.doesNotMatch(html,/<script>| onerror="| onclick="| data-bad="/);
});

test('compact preview remains available as a native keyboard-accessible details control during the draft',()=>{
  const html=wavePreviewMarkup(model(),{}, {},{compact:true,headingId:'persistent-wave-preview'});
  assert.match(html,/^<details class="wave-intelligence/);assert.match(html,/<summary class="wave-intelligence-summary">/);assert.match(html,/id="persistent-wave-preview"/);assert.match(html,/Threats & army/);
  assert.doesNotMatch(html,/<dialog|role="dialog"|data-action="close"/);
  const expanded=wavePreviewMarkup(model(),{}, {},{compact:false,headingId:'expanded-wave'});assert.match(expanded,/^<section/);assert.match(expanded,/aria-labelledby="expanded-wave"/);
  assert.match(wavePreviewMarkup(model(),{}, {},{open:true}),/class="wave-intelligence " open>/);
});

test('gate offers one immediate draft action and keeps standard numeric stats behind sidebar details',()=>{
  const html=wavePreviewGateMarkup(model(),{}, {},{headingId:'gate-wave'});
  assert.match(html,/aria-labelledby="gate-wave"/);assert.match(html,/Before the defender draft/);assert.match(html,/18 × Armored Orc/);assert.match(html,/Anti-armor/);assert.match(html,/>Good</);
  assert.equal((html.match(/<button\b/g)||[]).length,1);assert.match(html,/data-action="open-defender-draft"/);assert.match(html,/Open defender draft/);assert.match(html,/The preview stays beside the draft/);
  assert.doesNotMatch(html,/1,876 HP|17 armor|tiles\/s|18% magic resistance|<dialog|data-action="draw"|Best choice/i);
});

test('large enemy variety remains summarized with all additional types accessible through native details',()=>{
  const m=model();m.next.enemies=Array.from({length:12},(_,index)=>enemy(`Type ${index+1}`,index+1));
  const html=wavePreviewMarkup(m,{},{});assert.match(html,/9 more enemy types/);assert.match(html,/<details class="wave-more-enemies">/);
  for(let index=1;index<=12;index++)assert.match(html,new RegExp(`${index} × Type ${index}`));
});

test('all markup is read-only and cannot reveal hidden defenders or spend Command Points',()=>{
  const m=model();m.hiddenDraft=[{family:'SECRET_MAGE',tier:6}];m.commandPoints=3;const before=JSON.stringify(m);
  const first=wavePreviewMarkup(m,{},{}),gate=wavePreviewGateMarkup(m,{},{}),second=wavePreviewMarkup(m,{},{});
  assert.equal(JSON.stringify(m),before);assert.equal(first,second);assert.doesNotMatch(first+gate,/SECRET_MAGE|tier.?6|commandPoints|data-action="reroll"/);
});

test('the actual campaign analyzer and army evaluator render the same configured variants without future-stat leaks',()=>{
  const data=Object.fromEntries(['balance','enemies','waves','towers'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
  const before=JSON.stringify(data),analyzer=new WaveThreatAnalyzer(data),outlook=analyzer.outlook(34,50);
  const readiness=new ArmyReadiness(data).evaluate(outlook.next,[{family:'engineer',tier:1,state:'active'},{family:'mage',tier:6,state:'reserved'}]);
  const full=wavePreviewMarkup({...outlook,readiness},data,{}),gate=wavePreviewGateMarkup({...outlook,readiness},data,{});
  const current=outlook.next.enemies[0];
  assert.match(full,new RegExp(`${current.count} × ${current.name}`));
  assert.match(full,/Immune to magic and magical effects/);assert.match(full,/Immune to physical and piercing damage/);
  assert.match(full,/Each enemy independently chooses a variant/);assert.match(full,/1 active defender/);
  assert.ok(full.includes(new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(current.variants[0].maxHp)+' HP'));
  assert.doesNotMatch(gate,/ HP| armor|tiles\/s|Immune to magic and magical effects/);
  const partial=full.match(/<section class="wave-after-preview"[\s\S]*?<\/section>/)?.[0];
  assert.ok(partial);assert.ok(partial.includes(outlook.after.name));assert.doesNotMatch(partial,/\d[\d,.]* (?:invaders|HP|armor|tiles\/s)| × |wave-enemy-details/);
  assert.equal(JSON.stringify(data),before);assert.strictEqual(analyzer.outlook(34,50).next,outlook.next);
});

test('incomplete imported lists safely omit invalid entries while retaining usable information',()=>{
  const m=model();m.next.enemies=[null,{type:'mystery',name:'Mystery invader',count:2,variants:[null,undefined,{name:'Incomplete profile',traitDetails:[null,{text:'Known trait',kind:'unknown'}]}]}];
  m.readiness.rows=[null,undefined,{label:'Known response',level:'fair',response:'Known ability'}];
  const full=wavePreviewMarkup(m,{},{}),gate=wavePreviewGateMarkup(m,{},{});
  assert.match(full,/2 × Mystery invader/);assert.match(full,/Incomplete profile/);assert.match(full,/Known trait/);assert.match(full,/Known response/);
  assert.match(gate,/Known response/);assert.doesNotMatch(full+gate,/undefined|NaN|Variant 2|function Object/);
});
