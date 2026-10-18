import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {craftingDockModel} from '../ui/crafting-dock.js';
import {updatePinnedGoal} from '../ui/pinned-goal.js';
import {connectApprovedPortraitVisibility} from '../ui/portrait-visibility.js';

const flush=()=>new Promise(resolve=>setImmediate(resolve)),portrait=id=>`/project/assets/ui/reference-cutouts/${id}.png?v=reference-cutouts-20261016-v1`;
function fixture(){
  const document={baseURI:'https://example.test/project/index.html',observers:[]};
  class Observer{
    constructor(callback){this.callback=callback;this.records=[];this.active=false;document.observers.push(this);}
    observe(root,options){this.root=root;this.options=options;this.active=true;}
    record(record){if(!this.active||!this.root.contains(record.target)||record.type==='attributes'&&!this.options.attributeFilter.includes(record.attributeName))return;this.records.push(record);if(!this.queued){this.queued=true;queueMicrotask(()=>{this.queued=false;const records=this.records.splice(0);if(this.active&&records.length)this.callback(records);});}}
    disconnect(){this.active=false;this.records=[];}
  }
  document.defaultView={MutationObserver:Observer};document.notify=record=>document.observers.forEach(observer=>observer.record(record));
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.attributes=new Map();this.children=[];this.parentNode=null;this.dataset={};this.hidden=false;this.textContent='';this.replacements=0;}
    getAttribute(name){return this.attributes.get(name)??null;}
    hasAttribute(name){return this.attributes.has(name);}
    setAttribute(name,value){if(name==='src'){this.complete=false;this.naturalWidth=0;}this.attributes.set(name,String(value));document.notify({type:'attributes',target:this,attributeName:name});}
    removeAttribute(name){if(this.attributes.delete(name))document.notify({type:'attributes',target:this,attributeName:name});}
    append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}document.notify({type:'childList',target:this,addedNodes:children,removedNodes:[]});}
    replaceChildren(...children){const removedNodes=this.children;for(const child of removedNodes)child.parentNode=null;this.children=[];this.replacements++;document.notify({type:'childList',target:this,addedNodes:[],removedNodes});this.append(...children);}
    contains(node){for(let current=node;current;current=current.parentNode)if(current===this)return true;return false;}
    querySelectorAll(selector){assert.equal(selector,'img');return this.children.flatMap(child=>[...(child.tagName==='IMG'?[child]:[]),...child.querySelectorAll(selector)]);}
  }
  class Image extends Element{
    constructor(){super('img');this.requests=[];this.naturalWidth=0;this.complete=false;}
    get src(){const value=this.getAttribute('src');return value?new URL(value,document.baseURI).href:'';}
    decode(){const source=this.src;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});this.requests.push({source,resolve:()=>{if(this.src===source){this.naturalWidth=200;this.complete=true;}resolve();},reject:()=>reject(Error('Obsolete decode'))});return promise;}
  }
  document.createElement=tag=>tag==='img'?new Image():new Element(tag);
  const root=new Element('main'),host=new Element('aside');root.append(host);const connection=connectApprovedPortraitVisibility(root);return {root,host,connection};
}
const plan=()=>({family:'kingsrangerguard',tier:1,name:"King's Ranger Guard",recipe:{id:'kingsrangerguard'},counts:{built:0,draft:1,missing:2},missingBasics:{summary:'Archer I · Soldier III'}});

test('native decode attributes and HUD count updates never replace or redecode a pinned approved portrait',async()=>{
  const {host,connection}=fixture(),current=plan(),images={kingsrangerguard:portrait('kingsrangerguard')};
  try{
    assert.equal(updatePinnedGoal(host,current,images),true);await flush();const image=host.querySelectorAll('img')[0],open=host.children[0],unpin=host.children[1];
    assert.equal(image.requests.length,1);assert.equal(image.getAttribute('data-approved-portrait-state'),'loading');image.requests[0].resolve();await flush();assert.equal(image.getAttribute('data-approved-portrait-state'),'ready');
    for(let tick=0;tick<100;tick++)assert.equal(updatePinnedGoal(host,current,images),false);
    current.counts={built:1,draft:0,missing:2};current.missingBasics.summary='Archer I & Soldier III';assert.equal(updatePinnedGoal(host,current,images),true);await flush();
    assert.equal(host.querySelectorAll('img')[0],image);assert.equal(host.children[0],open);assert.equal(host.children[1],unpin);assert.equal(host.replacements,1);assert.equal(image.requests.length,1);assert.equal(image.getAttribute('data-approved-portrait-state'),'ready');
    assert.equal(open.children[1].children[0].textContent,"King's Ranger Guard");assert.equal(open.children[1].children[1].textContent,'✓ 1 built · ◆ 0 this round · ○ 2 missing');assert.equal(open.children[1].children[2].textContent,'Missing basics: Archer I & Soldier III');
    updatePinnedGoal(host,current,images,{visible:false});assert.equal(host.hidden,true);updatePinnedGoal(host,null,images);updatePinnedGoal(host,current,images);await flush();assert.equal(host.hidden,false);assert.equal(host.querySelectorAll('img')[0],image);assert.equal(image.requests.length,1);
  }finally{connection.dispose();}
});

test('changing the pinned identity reuses its image node while the native guard rejects an obsolete decode',async()=>{
  const {host,connection}=fixture(),current=plan(),images={kingsrangerguard:portrait('kingsrangerguard'),rimewatch:portrait('rimewatch')};
  try{
    updatePinnedGoal(host,current,images);await flush();const image=host.querySelectorAll('img')[0];
    const next={...current,family:'rimewatch',name:'Frostsword Watchmen',recipe:{id:'rimewatch'}};updatePinnedGoal(host,next,images);await flush();assert.equal(image.requests.length,2);assert.equal(image.getAttribute('data-approved-portrait-state'),'loading');
    image.requests[0].resolve();await flush();assert.equal(image.getAttribute('data-approved-portrait-state'),'loading');image.requests[1].resolve();await flush();assert.equal(image.getAttribute('data-approved-portrait-state'),'ready');
    assert.equal(host.querySelectorAll('img')[0],image);assert.equal(host.replacements,1);assert.equal(host.children[1].getAttribute('data-id'),'rimewatch');assert.equal(host.children[0].getAttribute('aria-label'),'Open pinned Frostsword Watchmen');
  }finally{connection.dispose();}
});

test('empty and unavailable pinned goals issue no image request and never substitute another rank',async()=>{
  const {host,connection}=fixture();try{
    updatePinnedGoal(host,null,{});assert.equal(host.hidden,true);assert.equal(host.children.length,0);
    const current={...plan(),family:'archer',tier:4,name:'Archer IV'};updatePinnedGoal(host,current,{archer:portrait('archer-1')});await flush();const image=host.querySelectorAll('img')[0];assert.equal(image.hidden,true);assert.equal(image.getAttribute('src'),null);assert.equal(image.requests.length,0);
    updatePinnedGoal(host,current,{'archer:4':portrait('archer-4')});await flush();assert.equal(image.requests.length,1);assert.equal(image.getAttribute('src'),portrait('archer-4'));
  }finally{connection.dispose();}
});

test('actual production HUD retains the decoded pinned image across 100 refreshes without revealing draws or consuming RNG',async()=>{
  const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))])),game=new Game(data,{seed:181}),control=new Game(data,{seed:181}),{host,connection}=fixture(),noop=()=>{};
  game.pinned=control.pinned='kingsrangerguard';const before=JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold}),nodes=new Map();
  const get=id=>{if(id==='pinned-goal')return host;if(['selected-enemy-panel','current-wave-panel','selected-support-effects'].includes(id))return null;if(!nodes.has(id))nodes.set(id,{innerHTML:'',textContent:'',open:false,querySelector:()=>null,parentElement:{parentElement:{classList:{add:noop,remove:noop}}}});return nodes.get(id);};
  const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),start=source.indexOf('function hud(){'),end=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);
  const hud=runInNewContext(source.slice(start,end)+'\nhud',{game,data,balance:data.balance,app:{},images:{kingsrangerguard:portrait('kingsrangerguard')},$:get,phaseUi:{apply:noop},updateCurrentWaveSummaryPanel:noop,updateCombatStatus:noop,craftingDockModel,updatePinnedGoal,contextGuidanceMarkup:()=>'',guidance:null,formatRunDuration:()=>'',audio:{syncGameState:noop},modalPaused:false,developerConnection:null,updateHeaderCombatControls:noop,dpsMeasurement:{view:()=>({rows:[],options:{}})},dpsTracker:{},updateTowerDpsPanel:noop,profile:{bestScore:0},renderWarbandsOverview:noop});
  try{
    hud();await flush();const image=host.querySelectorAll('img')[0];assert.ok(image);image.requests[0].resolve();await flush();assert.equal(image.getAttribute('data-approved-portrait-state'),'ready');
    for(let tick=0;tick<100;tick++)hud();await flush();assert.equal(host.replacements,1);assert.equal(host.querySelectorAll('img')[0],image);assert.equal(image.requests.length,1);assert.equal(image.getAttribute('data-approved-portrait-state'),'ready');assert.equal(JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold}),before);assert.equal(game.rng(),control.rng());
  }finally{connection.dispose();}
});
