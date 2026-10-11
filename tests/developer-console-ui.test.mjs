import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {developerConsoleMarkup,connectDeveloperConsole} from '../ui/developer-console.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
async function session(options={}){const console=new DeveloperConsoleSession(new Game(data,{seed:42}),{onReset:replacement=>replacement,...options});await console.activate();return console;}
const flush=()=>new Promise(resolve=>setImmediate(resolve));

// A native-event boundary double: the real console/Game methods run; only DOM
// storage, selector lookup and bubbling form events are represented here.
class Node{
  constructor(){this.textContent='';this.value='';this.disabled=false;this.writes=0;this.tables=[];this.options=[];this.listeners=new Map();this._html='';}
  get innerHTML(){return this._html;}
  set innerHTML(value){this.writes++;this._html=value;this.tables=Array.from({length:(value.match(/class="developer-table"/g)||[]).length},()=>({scrollTop:0,scrollLeft:0}));this.options=[...value.matchAll(/<option value="([^"]*)"/g)].map(match=>({value:match[1]}));}
  querySelectorAll(selector){return selector==='.developer-table'?this.tables:[];}
  matches(){return false;}
  addEventListener(type,callback){this.listeners.set(type,callback);}
  removeEventListener(type,callback){if(this.listeners.get(type)===callback)this.listeners.delete(type);}
}
function dom(){
  const root=new Node(),nodes=Object.fromEntries(['status','setup','live','results','traces','log'].map(key=>[key,new Node()])),wave=new Node(),select=new Node(),sandboxControl=new Node(),button=new Node(),mode=new Node(),seed=new Node(),paused=new Node(),speed=new Node();
  const controls={wave,mode,seed,paused,speed};
  button.matches=selector=>selector==='button';root.querySelector=selector=>selector==='.developer-console'?root:selector.includes('[name="')?controls[selector.match(/\[name="([^"]+)"\]/)?.[1]]:selector.startsWith('[data-console-')?nodes[selector.slice(14,-1)]:null;
  root.querySelectorAll=selector=>selector==='[data-console-defenders]'?[select]:selector==='[data-sandbox-only]'?[button]:selector==='[data-sandbox-control]'?[sandboxControl]:[];
  const ownerDocument={createElement:()=>{const wrapper=new Node();wrapper.querySelector=()=>{const found=new Node();found.innerHTML=wrapper.innerHTML.match(/<select[^>]*>([\s\S]*?)<\/select>/)?.[1]||'';return found;};return wrapper;}};
  root.ownerDocument=ownerDocument;return {root,nodes,wave,select,sandboxControl,button,mode,seed,paused,speed};
}
function selectedValue(html,command,name){
  const form=html.match(new RegExp(`<form data-console-command="${command}"[^>]*>([\\s\\S]*?)</form>`))?.[1];assert.ok(form);
  const select=form.match(new RegExp(`<select name="${name}"[^>]*>([\\s\\S]*?)</select>`))?.[1];assert.ok(select);
  const options=[...select.matchAll(/<option value="([^"]+)"([^>]*)>/g)];assert.ok(options.length);assert.equal(options.filter(option=>/\bselected\b/.test(option[2])).length,1,'Exactly one current option is selected');
  return options.find(option=>/\bselected\b/.test(option[2]))[1];
}
function nativeForms(t){t.mock.method(globalThis,'FormData',function(form){return Object.entries(form.values);});}
async function submit(view,command,values){const form={dataset:{consoleCommand:command},values,closest:()=>form};let prevented=false;view.root.listeners.get('submit')({target:form,preventDefault(){prevented=true;}});await flush();assert.equal(prevented,true);}
async function click(view,action,disabled=false){const button={dataset:{consoleAction:action},disabled,closest:()=>button};view.root.listeners.get('click')({target:button});await flush();}

test('English console markup uses native accessible forms, numeric bounds, two honest modes and the permanent statistics notice',async()=>{
  const console=await session(),html=developerConsoleMarkup(console);
  assert.match(html,/aria-label="Developer Console"/);assert.match(html,/Developer Mode — statistics disabled/);assert.match(html,/Activation excludes this entire run permanently/);assert.match(html,/role="status" aria-live="polite"/);
  assert.match(html,/Campaign Test · approved rules and normal progression/);assert.match(html,/Sandbox · custom lineup and wave/);assert.match(html,/a Sandbox victory is not a campaign completion/);
  assert.match(html,/name="mvpLevel"[^>]*min="0" max="10"/);assert.match(html,/name="tier"[^>]*min="1" max="6"/);assert.match(html,/name="wave"[^>]*min="1" max="50"/);assert.match(html,/data-sandbox-control/);
  for(const command of ['reset','run-wave','simulation','add-defender','defender','remove-defender','resources','spawn','enemy-rules','timing-rules'])assert.ok(html.includes(`data-console-command="${command}"`));
  assert.match(html,/<option value="refraction.period">Refraction delay after depletion<\/option>/);assert.match(html,/<option value="dread.duration">Dread duration<\/option>/);assert.doesNotMatch(html,/dread.radius|Dread radius|Refraction interval/);
  for(const [family,stats]of Object.entries(console.game.data.towers)){assert.ok(html.includes(`value="${family}"`));assert.ok(html.includes(stats.name));}
  assert.match(html,/Test setup JSON/);assert.doesNotMatch(html,/onclick=|onchange=|eval\(|javascript:/);
});

test('authored or unexpected names are escaped in options instead of entering HTML or script attributes',async()=>{
  const console=await session();console.game.data.towers.soldier.name='<img src=x onerror="evil()">';console.game.data.enemies.host_01.name="Enemy & <script>evil()</script>";
  const html=developerConsoleMarkup(console);assert.match(html,/&lt;img src=x onerror=&quot;evil\(\)&quot;&gt;/);assert.match(html,/Enemy &amp; &lt;script&gt;/);assert.doesNotMatch(html,/<script>evil|<img src=x/);
});

test('actual Sandbox/Campaign and paused/running state plus speed are selected in the initial native form markup',async()=>{
  const console=await session();console.setPaused(true);console.setSpeed(3);
  let html=developerConsoleMarkup(console);assert.equal(selectedValue(html,'reset','mode'),'sandbox');assert.equal(selectedValue(html,'simulation','paused'),'true');assert.equal(selectedValue(html,'simulation','speed'),'3');
  await console.resetTest({mode:'campaign',seed:7});html=developerConsoleMarkup(console);assert.equal(selectedValue(html,'reset','mode'),'campaign');assert.equal(selectedValue(html,'simulation','paused'),'false');assert.equal(selectedValue(html,'simulation','speed'),'1');
});

test('native connector captures a modal pause after markup and reset synchronizes new state while ordinary refresh preserves unsubmitted choices',async t=>{
  nativeForms(t);const console=await session(),view=dom();const markup=developerConsoleMarkup(console);assert.equal(selectedValue(markup,'simulation','paused'),'false');
  console.game.paused=true;const connected=connectDeveloperConsole(view.root,console);assert.equal(view.mode.value,'sandbox');assert.equal(view.paused.value,'true');assert.equal(view.speed.value,'1');assert.match(view.nodes.live.textContent,/Sandbox.*Paused/);
  view.mode.value='campaign';view.paused.value='false';view.speed.value='3';console.game.emit('change');await flush();assert.equal(view.mode.value,'campaign');assert.equal(view.paused.value,'false');assert.equal(view.speed.value,'3','Live refresh never overwrites a pending form choice');
  await submit(view,'reset',{mode:'campaign',seed:'9'});assert.equal(view.mode.value,'campaign');assert.equal(view.seed.value,9);assert.equal(view.paused.value,'false');assert.equal(view.speed.value,'1');assert.match(view.nodes.live.textContent,/Campaign Test.*1× speed/);
  connected.dispose();
});

test('actual simulation submission identifies the successful action after updating pause and speed, so dialog close can preserve the explicit choice',async t=>{
  nativeForms(t);const console=await session(),view=dom(),actions=[];let restorePaused=false;
  console.game.paused=true;
  const connected=connectDeveloperConsole(view.root,console,{onMutation:action=>{actions.push(action);if(action==='simulation')restorePaused=console.game.paused;}});
  await submit(view,'simulation',{paused:'true',speed:'3'});assert.deepEqual(actions,['simulation']);assert.equal(restorePaused,true);assert.equal(console.game.speed,3);
  console.game.paused=restorePaused;assert.equal(console.game.paused,true,'The close hook retains an explicitly chosen pause');
  await submit(view,'simulation',{paused:'false',speed:'2'});assert.deepEqual(actions,['simulation','simulation']);assert.equal(restorePaused,false);assert.equal(console.game.speed,2);
  console.game.paused=restorePaused;assert.equal(console.game.paused,false,'The close hook retains an explicitly chosen running state');
  await submit(view,'resources',{gold:'123',lives:'50',cp:'5'});assert.deepEqual(actions,['simulation','simulation','resources']);assert.equal(restorePaused,false,'Other interventions do not change the close-state decision');
  connected.dispose();
});

test('native add-defender form adds an actual rank VI/MVP tower and updates the existing live lineup UI without rerendering forms',async t=>{
  nativeForms(t);const console=await session(),view=dom();let changed=0;const connected=connectDeveloperConsole(view.root,console,{onMutation:()=>changed++});const rootWrites=view.root.writes;
  await submit(view,'add-defender',{family:'soldier',tier:'6',x:'18',z:'17',mvpLevel:'4'});
  assert.equal(console.game.towers.length,1);assert.equal(console.game.towers[0].tier,6);assert.equal(console.game.towers[0].mvpLevel,4);assert.equal(changed,1);assert.match(view.select.innerHTML,/Rank 6 · MVP 4/);assert.match(view.nodes.results.innerHTML,/Soldier/);assert.equal(view.root.writes,rootWrites);
  assert.match(view.nodes.status.textContent,/Statistics remain disabled/);connected.dispose();assert.equal(view.root.listeners.size,0);
});

test('native forms apply real resources, timing, MVP and attack pause with safe error status on invalid input',async t=>{
  nativeForms(t);const console=await session(),view=dom();connectDeveloperConsole(view.root,console);
  await submit(view,'add-defender',{family:'soldier',tier:'1',x:'18',z:'17',mvpLevel:'0'});await submit(view,'defender',{id:'1',mvpLevel:'10',attackPaused:'true'});
  await submit(view,'resources',{gold:'1234',lives:'60',cp:'19'});await submit(view,'timing-rules',{rule:'disarm.duration',value:'2'});
  assert.equal(console.game.towers[0].attackPaused,true);assert.equal(console.game.towers[0].mvpLevel,10);assert.equal(console.game.economy.gold,1234);assert.equal(console.game.combat.rules.disarm.duration,2);
  const before=console.game.towers.length;await submit(view,'add-defender',{family:'soldier',tier:'7',x:'19',z:'17',mvpLevel:'0'});assert.equal(console.game.towers.length,before);assert.match(view.nodes.status.textContent,/Rank must/);
});

test('run/restart native buttons close the modal only after actual successful combat and never on validation failure',async t=>{
  nativeForms(t);const console=await session(),view=dom();let ran=0;connectDeveloperConsole(view.root,console,{onRun:()=>ran++});
  await submit(view,'run-wave',{wave:'51',variant:'random'});assert.equal(ran,0);assert.equal(console.game.phase,'build');assert.match(view.nodes.status.textContent,/Wave must/);
  await submit(view,'run-wave',{wave:'1',variant:'random'});assert.equal(console.game.phase,'combat');assert.equal(ran,1);await click(view,'restart');assert.equal(ran,2);assert.equal(console.game.combat.elapsed,0);
});

test('Campaign reset disables Sandbox controls, synchronizes the new Game and unsubscribes old live refresh events',async t=>{
  nativeForms(t);const console=await session(),old=console.game,view=dom(),connected=connectDeveloperConsole(view.root,console);const oldListeners=old.listeners.size;
  console.game.round=15;await submit(view,'reset',{mode:'campaign',seed:'9'});
  assert.notEqual(console.game,old);assert.equal(old.listeners.size,oldListeners-2,'both session and connector subscriptions leave the old Game');assert.equal(view.wave.value,1);assert.equal(view.button.disabled,true);assert.equal(view.sandboxControl.disabled,true);assert.match(view.nodes.live.textContent,/Campaign Test · Wave 1/);
  const writes=view.nodes.results.writes;old.emit('hit',{});await flush();assert.equal(view.nodes.results.writes,writes);
  await submit(view,'resources',{gold:'9999',lives:'30',cp:'99'});assert.match(view.nodes.status.textContent,/requires Sandbox/);assert.equal(console.game.economy.gold,data.balance.startingGold);
  connected.dispose();
});

test('save/load uses only a separate console storage key and validates imported setups before updating the real Game',async t=>{
  nativeForms(t);const console=await session(),view=dom(),saved=new Map([['bastions.profile','untouched']]);const store={setItem:(key,value)=>saved.set(key,value),getItem:key=>saved.get(key)};connectDeveloperConsole(view.root,console,{store});
  await submit(view,'add-defender',{family:'archer',tier:'3',x:'18',z:'17',mvpLevel:'2'});await click(view,'export');assert.equal(JSON.parse(view.nodes.setup.value).towers[0].family,'archer');await click(view,'save');
  await submit(view,'remove-defender',{id:'1'});assert.equal(console.game.towers.length,0);await click(view,'load');assert.equal(console.game.towers[0].family,'archer');assert.equal(saved.get('bastions.profile'),'untouched');assert.equal(saved.size,2);
  view.nodes.setup.value='globalThis.executed=true';await click(view,'import');assert.equal(console.game.towers.length,1);assert.equal(globalThis.executed,undefined);assert.ok(view.nodes.status.textContent.length>0);
});

test('storage failure and disabled buttons show bounded errors without silently recording ordinary results',async()=>{
  const console=await session(),view=dom();let mutations=0;connectDeveloperConsole(view.root,console,{store:null,onMutation:()=>mutations++});await click(view,'save');assert.match(view.nodes.status.textContent,/storage is unavailable/);assert.equal(mutations,0);
  await click(view,'restore',true);assert.equal(mutations,0);assert.equal(console.game.developerMode,true);
});

test('frequent actual damage refresh preserves form selections, unchanged table nodes and changed table scroll positions',async()=>{
  const console=await session(),tower=console.addDefender({family:'soldier',x:18,z:17}),view=dom(),connected=connectDeveloperConsole(view.root,console);view.select.value=String(tower.id);
  const resultsWrites=view.nodes.results.writes;connected.refresh();connected.refresh();assert.equal(view.nodes.results.writes,resultsWrites);assert.equal(view.select.value,String(tower.id));
  const traceTable=view.nodes.traces.tables[0];traceTable.scrollTop=81;traceTable.scrollLeft=33;console.runWave(1);const enemy=console.spawnEnemy('host_01');enemy.hp=1000;enemy.maxHp=1000;console.game.combat.damage(enemy,1,'holy',{},tower);await flush();
  assert.equal(view.nodes.traces.tables[0].scrollTop,81);assert.equal(view.nodes.traces.tables[0].scrollLeft,33);assert.equal(view.select.value,String(tower.id));assert.match(view.nodes.traces.innerHTML,/host_01/);assert.doesNotMatch(view.nodes.traces.innerHTML,/undefined/);
  connected.dispose();
});

test('actual hit breakdown renders armor, Shell, blocked reasons and effective HP contribution as escaped read-only table cells',async()=>{
  const console=await session(),tower=console.addDefender({family:'soldier',x:18,z:17}),view=dom();connectDeveloperConsole(view.root,console);console.runWave(1);const enemy=console.spawnEnemy('host_01');enemy.shields=1;
  console.game.combat.damage(enemy,100,'physical',{directHit:true},tower);await flush();assert.match(view.nodes.traces.innerHTML,/<td>shield<\/td>/);assert.match(view.nodes.traces.innerHTML,/<th scope="col">HP removed<\/th>/);
  enemy.physicalImmune=true;console.game.combat.damage(enemy,100,'physical',{directHit:true},tower);await flush();assert.match(view.nodes.traces.innerHTML,/physical-immunity/);assert.doesNotMatch(view.nodes.traces.innerHTML,/data-enemy-id|enemy\.x|enemy\.hp/);
});

test('disposing the connector cancels listeners and queued refresh without touching the permanently excluded Game',async()=>{
  const console=await session(),view=dom();const connected=connectDeveloperConsole(view.root,console),before=console.game.listeners.size;console.game.emit('change');connected.dispose();await flush();
  assert.equal(console.game.listeners.size,before-1);assert.equal(view.root.listeners.size,0);assert.equal(console.game.developerMode,true);const writes=view.nodes.results.writes;console.game.emit('change');await flush();assert.equal(view.nodes.results.writes,writes);
});

test('asynchronous reset completion after a modal closes cannot mutate disposed UI or issue an extra refresh callback',async t=>{
  nativeForms(t);let release;const pending=new Promise(resolve=>release=resolve),console=await session({onReset:async replacement=>{await pending;return replacement;}}),view=dom();let mutations=0;
  const connected=connectDeveloperConsole(view.root,console,{onMutation:()=>mutations++});const form={dataset:{consoleCommand:'reset'},values:{mode:'sandbox',seed:'7'},closest:()=>form};view.root.listeners.get('submit')({target:form,preventDefault(){}});connected.dispose();const text=view.nodes.live.textContent;release();await flush();
  assert.equal(view.nodes.live.textContent,text);assert.equal(mutations,0);assert.equal(console.game.developerMode,true);
});

test('production timestamp seed input is valid unsigned32 and Sandbox wave input exposes all fifty waves even from mode ten',async()=>{
  const timestamp=Date.UTC(2026,9,11),console=new DeveloperConsoleSession(new Game(data,{seed:timestamp,waveLimit:10}),{onReset:replacement=>replacement});await console.activate();
  const html=developerConsoleMarkup(console);assert.ok(html.includes(`name="seed" value="${timestamp>>>0}"`));assert.match(html,/name="wave"[^>]*max="50"/);
  await console.resetTest({mode:'campaign'});const view=dom();connectDeveloperConsole(view.root,console);assert.equal(view.wave.max,10);assert.equal(view.sandboxControl.disabled,true);
});
