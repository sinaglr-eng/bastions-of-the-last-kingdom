import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {towerDpsContents,updateTowerDpsPanel} from '../ui/tower-dps.js';
import {nextWaveSummaryMarkup,updateNextWaveSummaryPanel} from '../ui/next-wave-summary.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';
import {Game} from '../game/core/game.js';
import {campaignEnemies,campaignWaves,campaignTowers,campaignRecipes} from '../game/core/campaign-roster.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const campaign={...data,enemies:campaignEnemies(data.enemies),waves:campaignWaves(data.waves),towers:campaignTowers(data.towers),recipes:campaignRecipes(data.recipes)};
const hpNumber=value=>new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(value);
const row=(id,dps=10,family='soldier')=>({id,dps,family,tier:1,state:'active'});
const sample=()=>({next:{number:14,name:'Armored assault',totalCount:12,enemies:[{type:'orc',name:'Armored Orc',count:12,variants:[{name:'Armored Orc',armor:8,maxHp:98765,speed:2.345,traitDetails:[{kind:'magic',text:'20% magic resistance'}]}]}]},after:{name:'Hidden following wave'},boss:{name:'Hidden boss forecast'},readiness:{score:999,label:'Hidden readiness'}});

// A small HTML fixture exercises the real updater's element ownership,
// replacement, captured scroll and focus behavior without a browser renderer.
function panelFixture(){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tagName=tag.toUpperCase();this.attributes={...attributes};this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));this.ownerDocument=document;this.parentNode=null;this.children=[];this.listeners=new Map();this._html='';this._open=Object.hasOwn(attributes,'open');this._scroll=0;this.writes=0;this.hidden=false;}
    matches(selector){if(selector.startsWith('.'))return (this.attributes.class||'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('['))return Object.hasOwn(this.attributes,selector.slice(1,-1));return this.tagName.toLowerCase()===selector;}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    closest(selector){for(let current=this;current;current=current.parentNode)if(current.matches(selector))return current;return null;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    get innerHTML(){return this._html;}
    set innerHTML(html){
      this._html=html;this.writes++;this.children.forEach(child=>child.parentNode=null);this.children=[];const stack=[this];
      for(const token of html.match(/<[^>]+>/g)||[]){
        if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
        const tag=token.match(/^<([a-z][\w-]*)/i)?.[1];if(!tag)continue;const attributes={};
        for(const match of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attributes[match[1]]=match[2]??'';
        const element=new Element(tag,attributes),parent=stack.at(-1);element.parentNode=parent;parent.children.push(element);
        if(!['img','input','br','hr','meta','link'].includes(tag)&&!token.endsWith('/>'))stack.push(element);
      }
    }
    addEventListener(type,listener,options={}){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push({listener,capture:!!options.capture});}
    dispatch(type,{target=this}={}){const event={type,target,stopped:false,defaultPrevented:false,stopPropagation(){this.stopped=true;},preventDefault(){this.defaultPrevented=true;}};for(let node=this;node;node=node.parentNode)for(const entry of node.listeners.get(type)||[]){if(node===this||entry.capture||type!=='scroll')entry.listener(event);}return event;}
    focus(options){document.activeElement=this;this.focusOptions=options;}
    get open(){return this._open;}
    set open(value){this._open=!!value;if(!value){for(const child of this.querySelectorAll('.tower-dps-list'))child._scroll=0;for(const child of this.querySelectorAll('.next-wave-summary-body'))child._scroll=0;}this.dispatch('toggle');}
    get scrollTop(){return this._scroll;}
    set scrollTop(value){this._scroll=this.closest('details')?.open?value:0;}
  }
  const panel=new Element('aside');return {panel,document};
}

test('DPS is a native expanded disclosure with a stable accessible summary and unchanged peak ordering',()=>{
  const html=towerDpsContents([row(2,21),row(1,10)],data,{}, {wave:7,phase:'combat',paused:true});
  assert.match(html,/^<details class="battlefield-overlay-disclosure tower-dps-disclosure" open><summary/);
  assert.match(html,/Peak DPS this wave/);assert.match(html,/Wave 7 · Paused/);assert.match(html,/21\.0 peak DPS this wave/);
  assert.ok(html.indexOf('data-id="2"')<html.indexOf('data-id="1"'));assert.doesNotMatch(html,/role="button"|aria-expanded/);
});

test('DPS collapse and focused summary survive frequent damage refreshes and a new wave without replacing the native controls',()=>{
  const {panel,document}=panelFixture();updateTowerDpsPanel(panel,[row(1)],data,{}, {wave:7});
  const disclosure=panel.querySelector('details'),summary=panel.querySelector('summary');disclosure.open=false;summary.focus();
  for(let index=0;index<50;index++)updateTowerDpsPanel(panel,[row(1,index)],data,{}, {wave:index<25?7:8});
  assert.equal(panel.querySelector('details'),disclosure);assert.equal(panel.querySelector('summary'),summary);assert.equal(disclosure.open,false);assert.equal(document.activeElement,summary);assert.equal(panel.writes,1);
  assert.equal(panel.listeners.get('wheel').length,1);assert.equal(panel.listeners.get('touchmove').length,1);
});

test('DPS scroll and defender focus follow identity through sorted row updates and fall back to the summary if removed',()=>{
  const {panel,document}=panelFixture();updateTowerDpsPanel(panel,[row(1,20),row(2,10)],data,{});
  const list=panel.querySelector('.tower-dps-list'),selected=panel.querySelectorAll('[data-overlay-focus]')[1];list.scrollTop=43;list.dispatch('scroll');selected.focus();
  updateTowerDpsPanel(panel,[row(2,30),row(1,20)],data,{});
  assert.equal(panel.querySelector('.tower-dps-list').scrollTop,43);assert.equal(document.activeElement.dataset.overlayFocus,'2');assert.deepEqual(document.activeElement.focusOptions,{preventScroll:true});
  updateTowerDpsPanel(panel,[row(1,20)],data,{});assert.equal(document.activeElement,panel.querySelector('summary'));
});

test('a collapsed DPS list remembers the last actual scroll and restores it on reopen after multiple refreshes',()=>{
  const {panel}=panelFixture();updateTowerDpsPanel(panel,[row(1)],data,{});const list=panel.querySelector('.tower-dps-list'),details=panel.querySelector('details');
  list.scrollTop=79;list.dispatch('scroll');details.open=false;
  for(let index=0;index<10;index++)updateTowerDpsPanel(panel,[row(1,index)],data,{}, {wave:2});
  assert.equal(panel.querySelector('.tower-dps-list').scrollTop,0);details.open=true;assert.equal(panel.querySelector('.tower-dps-list').scrollTop,79);
});

test('unchanged damage contents leave real row and summary nodes alone',()=>{
  const {panel}=panelFixture(),rows=[row(1)];assert.equal(updateTowerDpsPanel(panel,rows,data,{}),true);
  const body=panel.querySelector('.battlefield-overlay-content'),button=panel.querySelector('[data-overlay-focus]');
  assert.equal(updateTowerDpsPanel(panel,rows,data,{}),false);assert.equal(body.writes,0);assert.equal(panel.querySelector('[data-overlay-focus]'),button);
});

test('the next-wave summary puts its wave number in the heading and shows individual effective HP without forecast details',()=>{
  const html=nextWaveSummaryMarkup(sample(),data,{});
  assert.match(html,/^<details class="battlefield-overlay-disclosure next-wave-summary-disclosure" open>/);assert.match(html,/<strong>Next wave 14<\/strong><small>12 invaders<\/small>/);
  assert.match(html,/Armored assault/);assert.match(html,/12 × Armored Orc/);assert.match(html,/8 armor/);assert.match(html,/20% magic resistance/);assert.match(html,/data-defense="magic"/);
  assert.match(html,/98,765 HP each/);assert.doesNotMatch(html,/1,185,180|2\.345|tiles\/s|Hidden following wave|Hidden boss forecast|Hidden readiness|999|readiness|army|profile/i);
});

test('identical HP across possible variants is stated once and varying HP stays tied to named possible profiles',()=>{
  const model=sample(),enemy=model.next.enemies[0];enemy.variants=[{name:'Ashen',maxHp:400,traitDetails:[]},{name:'Spectral',maxHp:400,traitDetails:[]}];
  const common=nextWaveSummaryMarkup(model,data,{});assert.equal((common.match(/400 HP each/g)||[]).length,1);assert.doesNotMatch(common,/Possible · Ashen|Possible · Spectral|4,800 HP/);
  enemy.variants.push({name:'<Heavy> & "Chief"',maxHp:600.125,traitDetails:[]});
  const different=nextWaveSummaryMarkup(model,data,{});assert.match(different,/400 HP each<small>Possible · Ashen, Spectral<\/small>/);assert.match(different,/600\.125 HP each<small>Possible · &lt;Heavy&gt; &amp; &quot;Chief&quot;<\/small>/);
  assert.doesNotMatch(different,/6 × Ashen|6 × Spectral|50%|7,201\.5 HP|<Heavy>/);
});

test('effective variant and group HP overrides match actual individual spawns instead of base health or group totals',()=>{
  const local=structuredClone(campaign);local.enemies.probe={name:'Probe',hp:111,armor:0,speed:1,variants:[{name:'Light',hp:222},{name:'Heavy',hp:333}]};
  local.waves=[{name:'Modifier test',hp:2,groups:[{type:'probe',count:8,hp:3,interval:.1}]}];
  const game=new Game(local,{seed:406}),analyzer=new WaveThreatAnalyzer(local),next=analyzer.analyze(0),before=JSON.stringify(local),html=nextWaveSummaryMarkup(next,local,{});
  assert.match(html,/8 × Probe/);assert.match(html,/666 HP each<small>Possible · Light/);assert.match(html,/999 HP each<small>Possible · Heavy/);
  assert.doesNotMatch(html,/111 HP|222 HP|333 HP|444 HP|5,328 HP|7,992 HP/);
  for(const variant of local.enemies.probe.variants){const spawned=game.combat.spawn('probe',{...local.waves[0],...local.waves[0].groups[0],variant});assert.equal(spawned.maxHp,variant.hp*3);assert.ok(html.includes(`${hpNumber(spawned.maxHp)} HP each`));}
  assert.equal(JSON.stringify(local),before);
});

test('explicit group variants retain their actual HP when the analyzer combines multiple groups of one enemy type',()=>{
  const local=structuredClone(campaign);local.enemies.probe={name:'Probe',hp:111,armor:0,speed:1,variants:[{name:'Unselected',hp:98765}]};
  local.waves=[{name:'Explicit profiles',hp:4,groups:[{type:'probe',count:3,hp:2,interval:.1,variant:{name:'Scout',hp:100}},{type:'probe',count:5,hp:3,interval:.1,variant:{name:'Captain',hp:300}}]}];
  const game=new Game(local,{seed:474}),next=new WaveThreatAnalyzer(local).analyze(0),html=nextWaveSummaryMarkup(next,local,{});assert.equal(next.enemies.length,1);
  assert.match(html,/8 × Probe/);assert.match(html,/200 HP each<small>Possible · Scout/);assert.match(html,/900 HP each<small>Possible · Captain/);assert.doesNotMatch(html,/98,765|3 × Scout|5 × Captain|4,?\d+ HP/);
  for(const group of local.waves[0].groups){const spawned=game.combat.spawn('probe',{...local.waves[0],...group});assert.equal(spawned.maxHp,group.variant.hp*group.hp);assert.ok(html.includes(`${hpNumber(spawned.maxHp)} HP each`));}
});

test('unavailable individual HP remains explicit and invalid values cannot become a fabricated health value',()=>{
  const model=sample(),enemy=model.next.enemies[0];enemy.variants=[{name:'Known',maxHp:25,traitDetails:[]},{name:'Unknown',traitDetails:[]},{name:'Invalid',maxHp:NaN},{name:'Infinite',maxHp:Infinity},{name:'Negative',maxHp:-2},{name:'Text',maxHp:'100'}];
  const partial=nextWaveSummaryMarkup(model,data,{});assert.match(partial,/25 HP each<small>Possible · Known/);assert.match(partial,/HP per invader unavailable<small>Possible · Other variants/);assert.doesNotMatch(partial,/NaN|Infinity|-2 HP|100 HP/);
  enemy.unknown=true;assert.doesNotMatch(nextWaveSummaryMarkup(model,data,{}),/25 HP each/);
  enemy.unknown=false;enemy.variants=[];assert.match(nextWaveSummaryMarkup(model,data,{}),/HP per invader unavailable/);
  model.next.number=1;model.next.totalCount=1;assert.match(nextWaveSummaryMarkup(model,data,{}),/<strong>Next wave 1<\/strong><small>1 invader<\/small>/);
});

test('common variant abilities are deduplicated and variant-only defenses are explicitly possible with no invented split',()=>{
  const model=sample(),enemy=model.next.enemies[0];enemy.variants=[{name:'Ashen',armor:8,traitDetails:[{text:'Common resistance',kind:'magic'},{text:'Magic immunity',kind:'magicImmune'},{text:'Magic immunity',kind:'magicImmune'}]},{name:'Spectral',armor:8,traitDetails:[{text:'Common resistance',kind:'magic'},{text:'Physical immunity',kind:'physicalImmune'}]}];
  const html=nextWaveSummaryMarkup(model,data,{});assert.equal((html.match(/Common resistance/g)||[]).length,1);assert.equal((html.match(/Magic immunity/g)||[]).length,1);
  assert.match(html,/Possible · Ashen/);assert.match(html,/Possible · Spectral/);assert.match(html,/Variants may mix/);assert.equal((html.match(/8 armor/g)||[]).length,1);
  assert.doesNotMatch(html,/6 × Ashen|6 × Spectral|50%|half the wave/);
});

test('independent next-wave collapse and scroll persist across new wave models, while DPS stays open',()=>{
  const next=panelFixture(),dps=panelFixture();updateNextWaveSummaryPanel(next.panel,sample(),data,{});updateTowerDpsPanel(dps.panel,[row(1)],data,{});
  const details=next.panel.querySelector('details'),summary=next.panel.querySelector('summary'),body=next.panel.querySelector('.next-wave-summary-body');body.scrollTop=37;body.dispatch('scroll');details.open=false;summary.focus();
  const changed=sample();changed.next.number=15;changed.next.name='New incoming wave';changed.next.enemies[0].variants[0].maxHp=123;updateNextWaveSummaryPanel(next.panel,changed,data,{});
  assert.equal(next.panel.querySelector('details'),details);assert.equal(details.open,false);assert.equal(next.document.activeElement,summary);assert.equal(dps.panel.querySelector('details').open,true);
  assert.match(next.panel.querySelector('.next-wave-summary-body').innerHTML,/123 HP each/);assert.doesNotMatch(next.panel.querySelector('.next-wave-summary-body').innerHTML,/98,765 HP each/);
  details.open=true;assert.equal(next.panel.querySelector('.next-wave-summary-body').scrollTop,37);
});

test('no upcoming wave hides the host without clearing its disclosure preference or recreating it on a later run',()=>{
  const {panel}=panelFixture();updateNextWaveSummaryPanel(panel,sample(),data,{});const details=panel.querySelector('details');details.open=false;
  assert.equal(nextWaveSummaryMarkup({next:null},data,{}),'');updateNextWaveSummaryPanel(panel,{next:null},data,{});assert.equal(panel.hidden,true);assert.equal(panel.querySelector('details'),details);
  updateNextWaveSummaryPanel(panel,sample(),data,{});assert.equal(panel.hidden,false);assert.equal(panel.querySelector('details'),details);assert.equal(details.open,false);
});

test('foreground scrolling is contained without canceling native scroll or action clicks',()=>{
  for(const updater of [panel=>updateTowerDpsPanel(panel,[row(1)],data,{}),panel=>updateNextWaveSummaryPanel(panel,sample(),data,{})]){
    const {panel}=panelFixture();updater(panel);for(const type of ['wheel','touchmove']){const event=panel.dispatch(type);assert.equal(event.stopped,true);assert.equal(event.defaultPrevented,false);}
    assert.equal(panel.dispatch('click').stopped,false);
  }
});

test('unknown and incomplete enemy entries remain safe and all text and image attributes are escaped',()=>{
  const model=sample();model.next.name='<Wave> "chief"';model.next.enemies=[null,{type:'mystery',name:'<Unknown>',count:1,unknown:true,variants:[null,{name:'<Profile>',traitDetails:[null,{text:'<Trait>',kind:'constructor'}]}]}];
  const html=nextWaveSummaryMarkup(model,{}, {'enemy:mystery':'portrait.png" onerror="bad()'});
  assert.match(html,/&lt;Wave&gt; &quot;chief&quot;/);assert.match(html,/1 × &lt;Unknown&gt;/);assert.match(html,/&lt;Trait&gt;/);assert.match(html,/portrait\.png&quot; onerror=&quot;bad\(\)/);
  assert.doesNotMatch(html,/<Wave>|<Trait>| onerror="|undefined|NaN|data-defense="constructor"/);assert.match(html,/HP per invader unavailable/);
  assert.match(nextWaveSummaryMarkup({number:1,totalCount:1,enemies:[{name:'Unknown',count:1,unknown:true}]},{},{}),/Enemy ability information unavailable/);
});

test('real campaign mixed immunity wave reports actual possible defenses with full group count and consumes no game RNG',()=>{
  const analyzer=new WaveThreatAnalyzer(data),before=JSON.stringify(data),outlook=analyzer.outlook(34,50),wave=outlook.next,html=nextWaveSummaryMarkup(outlook,data,{});
  assert.match(html,/Immune to magic and magical effects/);assert.match(html,/Immune to physical and piercing damage/);assert.match(html,/Possible · Ashen/);assert.match(html,/Possible · Spectral/);
  assert.ok(html.includes(`${wave.enemies[0].count} × ${wave.enemies[0].name}`));assert.match(html,/21,640 HP each/);assert.equal((html.match(/21,640 HP each/g)||[]).length,1);assert.doesNotMatch(html,/tiles\/s|Army readiness|Boss in|After ·/);
  assert.equal(JSON.stringify(data),before);assert.equal(nextWaveSummaryMarkup(outlook,data,{}),html);assert.strictEqual(analyzer.outlook(34,50).next,wave);
});

test('all 50 real campaign summaries show each effective individual HP and trait without exposing base speed',()=>{
  const analyzer=new WaveThreatAnalyzer(campaign);assert.equal(campaign.waves.length,50);for(let index=0;index<campaign.waves.length;index++){
    const next=analyzer.analyze(index),html=nextWaveSummaryMarkup(next,campaign,{});assert.ok(html.includes(next.name));assert.ok(html.includes(`<strong>Next wave ${index+1}</strong><small>${next.totalCount} ${next.totalCount===1?'invader':'invaders'}</small>`));
    for(const enemy of next.enemies)for(const variant of enemy.variants)for(const trait of variant.traitDetails)assert.ok(html.includes(trait.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),`Wave ${index+1}: ${trait.text}`);
    const articles=html.match(/<article class="next-wave-group">[\s\S]*?<\/article>/g)||[];assert.equal(articles.length,next.enemies.length);
    next.enemies.forEach((enemy,group)=>{for(const variant of enemy.variants)assert.ok(articles[group].includes(`${hpNumber(variant.maxHp)} HP each`),`Wave ${index+1} ${variant.name}: ${variant.maxHp} individual HP`);});
    assert.doesNotMatch(html,/tiles\/s|Army readiness|Boss in|After ·/);
  }
});

test('all 50 campaign HP previews agree with every possible and actually queued spawn without consuming variant RNG',()=>{
  const game=new Game(campaign,{seed:951}),control=new Game(campaign,{seed:951}),analyzer=new WaveThreatAnalyzer(campaign),sourceBefore=JSON.stringify(campaign);let checkedProfiles=0,checkedSpawns=0;
  for(let index=0;index<campaign.waves.length;index++){
    game.round=control.round=index+1;const wave=campaign.waves[index],next=analyzer.analyze(index),html=nextWaveSummaryMarkup({next},campaign,{});
    assert.equal(nextWaveSummaryMarkup({next},campaign,{}),html);
    for(const group of wave.groups){
      const modifiers={...wave,...group},definition=campaign.enemies[group.type],choices=Object.hasOwn(modifiers,'variant')?[modifiers.variant]:definition.variants?.length?definition.variants:[undefined];
      for(const variant of choices){
        const spawned=game.combat.spawn(group.type,{...modifiers,variant}),profiles=next.enemies.find(enemy=>enemy.type===group.type).variants;
        assert.ok(profiles.some(profile=>profile.name===spawned.name&&profile.maxHp===spawned.maxHp),`Wave ${index+1}: ${spawned.name} must have actual spawn HP ${spawned.maxHp}`);
        assert.ok(html.includes(`${hpNumber(spawned.maxHp)} HP each`));checkedProfiles++;
      }
    }
    game.combat.start(wave);control.combat.start(wave);assert.deepEqual(game.combat.spawnQueue,control.combat.spawnQueue,`Wave ${index+1}: preview must not change any seeded variant choice`);
    for(const queued of game.combat.spawnQueue.splice(0)){
      const spawned=game.combat.spawn(queued.type,queued.modifiers),profiles=next.enemies.find(enemy=>enemy.type===queued.type).variants;
      assert.ok(profiles.some(profile=>profile.name===spawned.name&&profile.maxHp===spawned.maxHp),`Wave ${index+1}: actual queued spawn HP`);checkedSpawns++;
    }
  }
  assert.ok(checkedProfiles>=50);assert.ok(checkedSpawns>50);assert.equal(game.rng(),control.rng());assert.equal(JSON.stringify(campaign),sourceBefore);
  const goblins=nextWaveSummaryMarkup(analyzer.analyze(1),campaign,{});assert.match(goblins,/8 × Goblin Thornstriders/);assert.match(goblins,/52 HP each/);assert.doesNotMatch(goblins,/416 HP each/);
});

test('shared stack CSS owns position and responsive height limits, collapsed content is hidden, and scroll cannot chain',()=>{
  const stack=readFileSync(new URL('../ui/battlefield-overlays.css',import.meta.url),'utf8'),dps=readFileSync(new URL('../ui/tower-dps.css',import.meta.url),'utf8');
  assert.match(stack,/\.battlefield-overlays\{[^}]*position:absolute[^}]*display:flex[^}]*flex-direction:column/);assert.match(stack,/min-height:30px/);assert.match(stack,/44dvh/);assert.match(stack,/max-height:/);
  assert.match(stack,/overscroll-behavior:contain/);assert.match(dps,/overscroll-behavior:contain/);assert.doesNotMatch(dps,/position:absolute;top:|\.tower-dps\{[^}]*position:absolute/);
  assert.match(stack,/\.battlefield-overlay-disclosure:not\(\[open\]\)>\.battlefield-overlay-content\{display:none\}/);
});
