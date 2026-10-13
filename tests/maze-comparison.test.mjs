import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Scene,Group} from 'three';
import {Game} from '../game/core/game.js';
import {GridManager,CHECKPOINTS} from '../game/core/grid.js';
import {preparedBlueprints,validateBlueprint,blueprintProgress} from '../game/core/blueprints.js';
import {campaignTowers,campaignEnemies,campaignWaves,campaignRecipes} from '../game/core/campaign-roster.js';
import {mazePlanThumbnail,mazeComparisonMarkup,updateMazeComparison} from '../ui/maze-comparison.js';

const hook=registerHooks({load(url,context,next){if(url.endsWith('/data/maze-blueprints.json'))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')};`,shortCircuit:true};return next(url,context);}});
const {MazePlanner}=await import('../game/render/maze-planner.js');hook.deregister();
const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves),recipes:campaignRecipes(raw.recipes)};
const plans=preparedBlueprints(JSON.parse(readFileSync(new URL('../data/maze-blueprints.json',import.meta.url))));
const options=extra=>({plans,budget:250,limit:250,...extra});
const cells=(svg,kind)=>[...svg.matchAll(new RegExp(`data-maze-${kind}="(\\d+),(\\d+)"`,'g'))].map(match=>({x:Number(match[1]),z:Number(match[2])}));
const route=svg=>svg.match(/<polyline[^>]*points="([^"]*)"/)[1].split(' ').filter(Boolean).map(point=>{const [x,z]=point.split(',').map(Number);return {x:x-.5,z:z-.5};});

test('all six shipped thumbnails show the complete actual blueprint walls, firing positions, ordered checkpoints and legal ground route',()=>{
  assert.equal(plans.length,6);const before=JSON.stringify(plans),thumbnails=new Set();
  for(const plan of plans){
    const svg=mazePlanThumbnail(plan);assert.match(svg,/viewBox="0 0 37 37"/);assert.match(svg,/role="img" aria-label=/);
    assert.deepEqual(cells(svg,'wall'),plan.walls);assert.deepEqual(cells(svg,'core'),plan.core);assert.deepEqual(route(svg),plan.route);
    const marks=[...svg.matchAll(/data-maze-checkpoint="(\d+)" cx="([\d.]+)" cy="([\d.]+)"/g)].map(match=>({x:Number(match[2])-.5,z:Number(match[3])-.5}));assert.deepEqual(marks,CHECKPOINTS);
    const grid=new GridManager();for(const cell of cells(svg,'wall'))grid.occupied.set(`${cell.x},${cell.z}`,1);
    assert.deepEqual(grid.findRoute(),route(svg),'Thumbnail route agrees with the actual cardinal six-leg BFS');
    assert.equal(route(svg).length-1,plan.plannedLength);thumbnails.add(svg);
  }
  assert.equal(thumbnails.size,6,'Existing distinct plans have distinct actual geometry');assert.equal(JSON.stringify(plans),before);
});

test('comparison gives each plan one primary ground-route metric, with exposure/assumptions expandable and flight warning beside selection',()=>{
  const html=mazeComparisonMarkup(options());
  assert.equal((html.match(/class="maze-plan-primary"/g)||[]).length,6);assert.equal((html.match(/<details class="maze-plan-details"/g)||[]).length,6);
  assert.equal((html.match(/aria-describedby="maze-flight-warning"/g)||[]).length,6);assert.ok(html.indexOf('Flying enemies ignore the maze')<html.indexOf('data-maze="choose"'));
  for(const plan of plans){
    const start=html.indexOf(`data-id="${plan.id}"`),end=html.indexOf('</article>',start),card=html.slice(start,end);
    const button=card.slice(0,card.indexOf('</button>'));
    assert.ok(button.includes(`<b>${plan.plannedLength}</b> ground route steps`));assert.doesNotMatch(button,/Firing passes|Time in firing circles|Combined position exposure|%/);
    assert.ok(card.includes(`${plan.fire.speed} cells/s, ${plan.fire.range}-cell firing circles`));assert.ok(card.includes(plan.segments.join(' + ')+' steps'));
    assert.ok(card.includes('without slows'));assert.ok(card.includes('Repeated route visits count'));
  }
  assert.match(html,/not damage predictions, campaign win probabilities or globally optimal solutions/);assert.match(html,/type="button"[^>]*data-maze="close"[^>]*aria-label="Close maze plans"/);
});

test('custom plan previews use their own validated geometry, and names/identities cannot inject markup',()=>{
  const custom={...validateBlueprint([{x:10,z:10},{x:11,z:10}],'Custom <maze> & "test"').plan,id:'custom-test'};
  const html=mazeComparisonMarkup(options({plans:[...plans,custom],selected:custom,detailsOpen:new Map([[custom.id,true]])}));
  assert.deepEqual(cells(mazePlanThumbnail(custom),'wall'),custom.walls);assert.deepEqual(route(mazePlanThumbnail(custom)),custom.route);
  assert.match(html,/Your saved plans/);assert.match(html,/Custom &lt;maze&gt; &amp; &quot;test&quot;/);assert.doesNotMatch(html,/<maze>|<img src=x/);
  assert.match(html,/data-maze-details="custom-test" open/);assert.match(html,/aria-pressed="true"/);
});

function hostFixture(){
  const document={activeElement:null};
  const host={innerHTML:'',scrollTop:0,writes:0,details:[],controls:[],ownerDocument:document,
    contains(node){return this.controls.includes(node);},
    querySelectorAll(selector){return selector==='[data-maze-details]'?this.details:this.controls;},
    querySelector(){return this.controls.find(node=>node.dataset.mazeFocus==='close');},
    set innerHTML(html){this.html=html;this.writes++;this.details=[...html.matchAll(/<details[^>]*data-maze-details="([^"]+)"([^>]*)>/g)].map(match=>({dataset:{mazeDetails:match[1]},open:/\bopen\b/.test(match[2])}));this.controls=[...html.matchAll(/data-maze-focus="([^"]+)"/g)].map(match=>({dataset:{mazeFocus:match[1]},closest(){return this;},focus(options){document.activeElement=this;this.focusOptions=options;}}));},
    get innerHTML(){return this.html||'';},
  };
  return {host,document};
}

test('comparison preserves independently expanded detail, scroll and focused control through live placement progress refreshes',()=>{
  const {host,document}=hostFixture();updateMazeComparison(host,options({selected:plans[0]}));
  host.details.find(node=>node.dataset.mazeDetails==='commander').open=true;
  host.scrollTop=112;host.controls.find(node=>node.dataset.mazeFocus==='details:commander').focus();
  const grid=new GridManager(),first=plans[0].walls[0];assert.ok(grid.occupy(first.x,first.z,1).ok);
  const progress=blueprintProgress(plans[0],grid,249);assert.equal(updateMazeComparison(host,options({selected:plans[0],progress,budget:249})),true);
  assert.equal(host.details.find(node=>node.dataset.mazeDetails==='commander').open,true);assert.ok(host.details.filter(node=>node.dataset.mazeDetails!=='commander').every(node=>!node.open));
  assert.equal(host.scrollTop,112);assert.equal(document.activeElement.dataset.mazeFocus,'details:commander');assert.deepEqual(document.activeElement.focusOptions,{preventScroll:true});
  const writes=host.writes;assert.equal(updateMazeComparison(host,options({selected:plans[0],progress,budget:249})),false);assert.equal(host.writes,writes);
});

function environment(callback){
  const prior={document:globalThis.document,localStorage:globalThis.localStorage},storage=new Map(),nodes=new Map(),document={activeElement:null};
  const element=()=>({innerHTML:'',dataset:{},hidden:false,listeners:new Map(),attributes:new Map(),scrollTop:0,classList:{toggle(){}},ownerDocument:document,
    setAttribute(key,value){this.attributes.set(key,value);},addEventListener(event,listener){this.listeners.set(event,listener);},remove(){},querySelectorAll(){return [];},
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',value:'Saved maze',disabled:false,setAttribute(){},focus(options){document.activeElement=this;this.focusOptions=options;}});return nodes.get(selector);},
  });
  const tools={open:true,querySelector(){return summary;}},summary={focus(options){document.activeElement=this;this.focusOptions=options;}},opener={classList:{toggle(){}},setAttribute(){},closest(){return tools;},focus(options){document.activeElement=this;this.focusOptions=options;}};
  const sidebar={insertBefore(panel){this.panel=panel;},querySelector:()=>({})};
  document.createElement=element;document.querySelector=selector=>selector==='[data-action="maze"]'?opener:summary;
  globalThis.document=document;globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
  const game=new Game(data,{seed:42}),world={game,scene:new Scene(),pathGroup:new Group(),showPath:true,keys:new Set(),container:{parentElement:{querySelector:()=>sidebar}}},planner=new MazePlanner(world);
  try{return callback({game,world,planner,opener,tools,summary,document});}finally{planner.dispose();for(const [key,value]of Object.entries(prior)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
}

test('real planner compares and selects two unchanged plans through its native button handler without affecting game legality, resources or RNG',()=>environment(({game,planner,document,opener})=>{
  const before=JSON.stringify({towers:game.towers,grid:[...game.grid.occupied],route:game.grid.route,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,phase:game.phase}),original=JSON.stringify(planner.presets);
  game.rng=()=>assert.fail('Maze comparison never consumes gameplay RNG');
  for(const id of ['commander','compact-crossfire']){
    planner.togglePanel();assert.equal(planner.panelOpen,true);assert.match(planner.panel.innerHTML,/maze-plan-thumbnail/);assert.ok(document.activeElement);
    let stopped=false;planner.panel.listeners.get('click')({target:{closest:()=>({dataset:{maze:'choose',id}})},stopPropagation(){stopped=true;}});
    assert.equal(stopped,true);assert.equal(planner.plan.id,id);assert.equal(planner.panelOpen,false);assert.equal(planner.panel.hidden,true);assert.equal(document.activeElement,opener);
    assert.deepEqual(planner.plan.walls,plans.find(plan=>plan.id===id).walls);assert.equal(planner.progress.conflict,false);
  }
  assert.equal(JSON.stringify(planner.presets),original);assert.equal(JSON.stringify({towers:game.towers,grid:[...game.grid.occupied],route:game.grid.route,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,phase:game.phase}),before);
}));

test('Escape closes comparison and returns keyboard focus to collapsed map tools without ending an active blueprint edit',()=>environment(({planner,tools,summary,document})=>{
  tools.open=false;planner.togglePanel();let prevented=false,stopped=false;
  planner.panel.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  assert.equal(prevented,true);assert.equal(stopped,true);assert.equal(planner.panelOpen,false);assert.equal(document.activeElement,summary);assert.deepEqual(summary.focusOptions,{preventScroll:true});
  planner.startEditor();const editing=planner.editor;planner.panel.listeners.get('keydown')({key:'Escape',preventDefault(){assert.fail('Existing editor Escape is handled by the map tools');},stopPropagation(){assert.fail('Do not block existing editor Escape');}});
  assert.equal(planner.editor,editing);assert.equal(planner.panelOpen,true);planner.finishEditor();
}));

test('selected-plan conflict and budget warnings retain actual validation, and changing field occupancy never replaces blueprint geometry',()=>environment(({game,planner})=>{
  planner.choose('commander');const initial=JSON.stringify(planner.plan);planner.panelOpen=true;
  const union=new GridManager();for(const cell of planner.plan.walls)union.occupied.set(`${cell.x},${cell.z}`,1);
  const choke=planner.plan.route.find(cell=>game.grid.canPlace(cell.x,cell.z).ok&&!union.findRoute(`${cell.x},${cell.z}`));assert.ok(choke);assert.ok(game.grid.occupy(choke.x,choke.z,1).ok);planner.sync();
  assert.equal(planner.progress.conflict,true);assert.match(planner.panel.innerHTML,/Existing defenses block the completed route/);assert.equal(JSON.stringify(planner.plan),initial);
  const html=mazeComparisonMarkup(options({selected:planner.plan,progress:{...planner.progress,overBudget:true},budget:0,limit:50}));assert.match(html,/exceeds the construction budget/);assert.match(html,/Demolition does not refund a draw/);assert.match(html,/0 placements left/);
}));

test('selection, close and every native detail control have visible focus treatment and touch targets of at least 44 pixels',()=>{
  const css=readFileSync(new URL('../ui/maze-comparison.css',import.meta.url),'utf8');
  assert.match(css,/maze-panel-heading button\{[^}]*min-height:44px/);assert.match(css,/maze-plan-select\{[^}]*min-height:84px/);assert.match(css,/maze-plan-details>summary\{[^}]*min-height:44px/);
  assert.match(css,/maze-comparison button:focus-visible/);assert.match(css,/maze-plan-details>summary:focus-visible/);assert.match(css,/max-height:540px/);
});
