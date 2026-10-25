import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Game} from '../game/core/game.js';
import {GuidedTutorial,TUTORIAL_STEPS,TutorialInvitation,tutorialInvitationMarkup,tutorialStepComplete} from '../ui/tutorial.js';
const mazeHook=registerHooks({load(url,context,next){if(url.endsWith('/data/maze-blueprints.json'))return {format:'module',source:`export default ${readFileSync(new URL(url),'utf8')};`,shortCircuit:true};return next(url,context);}});
const {MazePlanner}=await import('../game/render/maze-planner.js');mazeHook.deregister();

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const state=game=>JSON.stringify({phase:game.phase,round:game.round,paused:game.paused,speed:game.speed,draws:game.draft.draws,towers:game.towers,cp:game.commandPoints.value,gold:game.economy.gold,clock:game.elapsedSeconds,combatClock:game.combat.elapsed});
function fixture({width=1024,height=768,cardHeight=250}={}){
  const previous=Object.fromEntries(['document','window','innerWidth','innerHeight'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const node=()=>({style:{},dataset:{},hidden:false,disabled:false,textContent:'',isConnected:true,listeners:new Map(),addEventListener(type,callback){this.listeners.set(type,callback);},removeEventListener(type,callback){if(this.listeners.get(type)===callback)this.listeners.delete(type);},focus(){document.activeElement=this;},closest(){return null;}});
  const highlight=node(),card=node(),layer=node(),fields=new Map(['h2','.tutorial-copy','.tutorial-instructions','.tutorial-progress','.tutorial-task','[data-tour="skip"]','[data-tour="maze"]','[data-tour="next"]'].map(selector=>[selector,node()]));
  card.querySelector=selector=>fields.get(selector);Object.defineProperty(card,'offsetHeight',{get:()=>card.dataset.compact==='true'?Math.min(cardHeight,128):cardHeight});card.contains=element=>element===card||[...fields.values()].includes(element);
  fields.get('[data-tour="skip"]').dataset.tour='skip';fields.get('[data-tour="next"]').dataset.tour='next';
  fields.get('[data-tour="maze"]').dataset.tour='maze';
  layer.querySelector=selector=>selector==='.tutorial-card'?card:highlight;
  const targets=new Map(),rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
  const target=(selector,box,visible=true)=>{const element={...node(),getClientRects:()=>visible?[box]:[],getBoundingClientRect:()=>box};targets.set(selector,element);return element;};
  target('#battlefield',rect(0,70,width,height-70));target('#draft',rect(10,height-180,width-20,160));target('#folio-actions',rect(15,height-70,350,48));
  target('#map-start',rect(width/2-90,80,180,48));target('#command-dock',rect(width/2-100,80,200,48));
  target('#header-combat-controls',rect(width/2-100,80,200,48));target('#header-combat-controls [data-action="pause"]',rect(width/2-100,80,95,48));target('#header-combat-controls [data-action="speed"]',rect(width/2,80,95,48));
  target('.header-actions [data-action="codex"]',rect(width-300,10,110,44));target('.header-actions [data-action="warbands"]',rect(width-180,10,140,44));
  target('.map-tools > summary',rect(width-52,78,44,44));
  const panelHeight=Math.min(height*.46,350),maze={plan:null,panelOpen:false,editing:false,panel:target('.maze-guide',width<=620?rect(8,height-148-panelHeight,width-16,panelHeight):rect(width-280,70,280,height-70))};
  const document={activeElement:null,body:{append(value){assert.equal(value,layer);}},createElement:()=>layer,querySelector:selector=>selector==='dialog[open]'?(document.dialogOpen?{}:null):targets.get(selector)||null,dialogOpen:false};
  document.activeElement=target('return',rect(10,10,44,44));const focusReturn=node();
  const window={listeners:new Map(),addEventListener(type,callback){this.listeners.set(type,callback);},removeEventListener(type,callback){if(this.listeners.get(type)===callback)this.listeners.delete(type);}};
  Object.assign(globalThis,{document,window,innerWidth:width,innerHeight:height});
  return {layer,card,highlight,fields,document,window,target,rect,focusReturn,maze,tour(options={}){return new GuidedTutorial({getMaze:()=>maze,openMaze:()=>{maze.panelOpen=true;},...options});},chooseMaze(tour){assert.equal(tour.index,index('maze'));maze.plan={id:'chosen-real-shape'};maze.panelOpen=false;tour.refresh();},click(action){const button=fields.get(`[data-tour="${action}"]`);layer.listeners.get('click')({target:{closest:()=>button}});},restore(){for(const [key,descriptor]of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
const index=id=>TUTORIAL_STEPS.findIndex(step=>step.id===id);
function realMaze(view,game){
  const originalCreate=view.document.createElement,previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),panel=view.maze.panel,events=new Map(),controls=new Map(),storage=new Map();
  panel.addEventListener=(type,listener)=>{if(!events.has(type))events.set(type,new Set());events.get(type).add(listener);};panel.removeEventListener=(type,listener)=>events.get(type)?.delete(listener);
  panel.setAttribute=()=>{};panel.remove=()=>{};panel.innerHTML='';panel.querySelector=selector=>{if(!controls.has(selector))controls.set(selector,{textContent:'',value:'My saved shape',disabled:false,setAttribute(){},focus(){}});return controls.get(selector);};
  view.document.createElement=()=>panel;Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)}});
  const sidebar={insertBefore(){},querySelector:()=>null},world={game,scene:{add(){},remove(){}},container:{parentElement:{querySelector:()=>sidebar}},pathGroup:{visible:true},showPath:true,keys:new Set()},planner=new MazePlanner(world);view.document.createElement=originalCreate;
  return {planner,world,events,tour:()=>view.tour({getMaze:()=>planner,openMaze:()=>planner.togglePanel()}),click(action,id){for(const listener of [...events.get('click')||[]])listener({target:{closest:()=>({dataset:{maze:action,id}})},stopPropagation(){}});},restore(){planner.dispose();if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;}};
}

test('every fresh run gets an explicit invitation despite any historical saved decision; replacements and duplicate render offers do not repeat it',()=>{
  for(const tutorialDecision of [undefined,'accepted','skipped','complete']){
    const invitation=new TutorialInvitation(),profile={tutorialDecision},first=new Game(data,{seed:48}),next=new Game(data,{seed:48});
    assert.equal(invitation.offer(first,profile),true);assert.equal(invitation.pending,true);assert.equal(invitation.offer(first,profile),false);
    assert.equal(invitation.decide('accepted'),true);assert.equal(invitation.decide('skipped'),false);assert.equal(invitation.pending,false);
    assert.equal(invitation.offer(next,profile),true);assert.equal(invitation.decide('skipped'),true);assert.equal(invitation.offer(next,profile),false);
    assert.equal(invitation.offer(new Game(data)),true);assert.equal(invitation.pending,true);assert.equal(invitation.offer(new Game(data),{replacement:true}),false);assert.equal(invitation.pending,false,'a replacement cannot inherit an old pending welcome choice');const developer=new Game(data);developer.developerMode=true;assert.equal(invitation.offer(developer),false);
  }
  const html=tutorialInvitationMarkup();assert.match(html,/data-action="tutorial-start" autofocus>Start tutorial/);assert.match(html,/data-action="tutorial-skip">Skip tutorial/);assert.match(html,/aria-labelledby="tutorial-welcome-title"/);assert.doesNotMatch(html,/data-action="close"|Don't show|Never show/);
});

test('real placements and a legal keeper advance the tour; invalid placement and waiting Next do not; observation never consumes RNG',()=>{
  const view=fixture(),game=new Game(data,{seed:48}),control=new Game(data,{seed:48}),finished=[];
  try{
    const tour=view.tour({onFinish:value=>finished.push(value)});const before=state(game);assert.equal(tour.start(game),true);assert.equal(tour.index,index('camera'));assert.equal(view.document.activeElement,view.card);
    for(let refresh=0;refresh<40;refresh++)tour.refresh(game);assert.equal(state(game),before);
    view.document.activeElement=view.fields.get('[data-tour="next"]');view.click('next');assert.equal(view.document.activeElement,view.card,'hiding Next returns keyboard focus to the safe guide region');view.chooseMaze(tour);assert.equal(tour.index,index('place'));assert.equal(view.fields.get('[data-tour="next"]').disabled,true);assert.equal(view.fields.get('[data-tour="next"]').hidden,true);view.click('next');assert.equal(tour.index,index('place'));
    assert.equal(game.place(-100,-100),false);tour.refresh();assert.equal(tour.index,index('place'));assert.equal(view.fields.get('.tutorial-task').textContent,'0 / 5 recruits placed');
    for(let slot=0;slot<5;slot++){
      assert.equal(game.place(3+slot,3),true);assert.equal(control.place(3+slot,3),true);tour.refresh(game);
      assert.equal(tour.index,index(slot===4?'keeper':'place'));
    }
    assert.deepEqual(game.towers,control.towers);assert.equal(game.rng(),control.rng());
    assert.equal(game.keep(),true);assert.equal(control.keep(),true);tour.refresh(game);assert.equal(tour.index,index('recipes'));assert.equal(view.fields.get('[data-tour="next"]').disabled,false);
    assert.equal(state(game),state(control));assert.deepEqual(finished,[]);view.click('skip');assert.equal(tour.active,false);assert.deepEqual(finished,[{reason:'skipped',completed:false}]);
  }finally{view.restore();}
});

test('a legal merge completes the keeper step without the guide prescribing the random draft',()=>{
  const view=fixture(),game=new Game(data,{seed:48});
  try{const tour=view.tour();tour.start(game);view.click('next');view.chooseMaze(tour);game.draft.roundForced={family:'soldier',tier:1};for(let slot=0;slot<5;slot++)game.place(3+slot,3);game.draft.roundForced=null;tour.refresh();assert.equal(tour.index,index('keeper'));assert.equal(game.merge(),true);tour.refresh();assert.equal(tour.index,index('recipes'));assert.equal(game.phase,'ready');assert.equal(game.selection.tier,2);}
  finally{view.restore();}
});

test('Start, real Pause and real Speed are observed separately; a book modal pause cannot complete the Pause task',()=>{
  const view=fixture(),game=new Game(data,{seed:48}),finished=[];
  try{
    for(let slot=0;slot<5;slot++)game.place(3+slot,3);game.keep();const tour=view.tour({onFinish:value=>finished.push(value)});tour.start(game);
    view.click('next');view.chooseMaze(tour);assert.equal(tour.index,index('recipes'),'already completed placement and keeper skip without repeating actions');view.click('next');assert.equal(tour.index,index('waves'));view.click('next');assert.equal(tour.index,index('start'));
    assert.equal(game.startCombat(),true);tour.refresh();assert.equal(tour.index,index('pause'));assert.equal(game.paused,false);assert.equal(game.speed,1);
    view.document.dialogOpen=true;game.paused=true;tour.refresh();assert.equal(tour.layer.hidden,true);assert.equal(tour.index,index('pause'));
    view.document.dialogOpen=false;game.paused=false;tour.refresh();assert.equal(tour.layer.hidden,false);assert.equal(tour.index,index('pause'));
    game.paused=true;tour.refresh();assert.equal(tour.index,index('speed'));assert.equal(view.fields.get('[data-tour="next"]').disabled,true);
    for(let refresh=0;refresh<20;refresh++)tour.refresh();assert.equal(tour.index,index('speed'),'merely showing the guide cannot choose a speed');
    game.speed=2;tour.refresh();assert.equal(tour.index,index('finish'));assert.equal(game.paused,true);assert.equal(game.speed,2,'the guide preserves the exact user transport selection');
    view.click('next');assert.equal(tour.active,false);assert.deepEqual(finished,[{reason:'complete',completed:true}]);assert.equal(view.document.activeElement.getBoundingClientRect().width,44,'End restores visible original focus');
    assert.equal(tour.start(game),true);assert.equal(tour.index,index('camera'),'Help can replay without a new run');tour.finish({reason:'reset',restoreFocus:false});assert.equal(finished.at(-1).reason,'reset');
  }finally{view.restore();}
});

test('Escape yields to an active native dialog and cancels the guide once afterward; hidden old focus gets a visible game fallback',()=>{
  const view=fixture(),game=new Game(data),finished=[];let prevented=0,stopped=0;
  try{
    const prior=view.document.activeElement,tour=view.tour({onFinish:value=>finished.push(value),focusReturn:()=>view.focusReturn}),key={key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;}};
    tour.start(game);prior.isConnected=false;view.document.dialogOpen=true;view.window.listeners.get('keydown')(key);assert.equal(tour.active,true);assert.equal(prevented,0);assert.equal(stopped,0);
    view.document.dialogOpen=false;view.window.listeners.get('keydown')(key);assert.equal(tour.active,false);assert.equal(prevented,1);assert.equal(stopped,1);assert.equal(view.document.activeElement,view.focusReturn);assert.deepEqual(finished,[{reason:'skipped',completed:false}]);
    view.window.listeners.get('keydown')(key);assert.equal(finished.length,1);
  }finally{view.restore();}
});

test('new Game identity, defeat and victory remove the old guide without recording tutorial completion',()=>{
  for(const phase of ['lost','won','replacement']){const view=fixture(),game=new Game(data),finished=[];
    try{const tour=view.tour({onFinish:value=>finished.push(value)});tour.start(game);const before=state(game);if(phase==='replacement')tour.refresh(new Game(data));else{game.phase=phase;tour.refresh(game);}assert.equal(tour.active,false);assert.equal(view.layer.hidden,true);assert.deepEqual(finished,[{reason:'reset',completed:false}]);if(phase==='replacement')assert.equal(state(game),before);}
    finally{view.restore();}
  }
});

test('tutorial cards stay inside tablet, phone and short landscape viewports and leave controls outside the card where space allows',()=>{
  for(const [width,height,cardHeight]of [[1180,820,250],[1024,768,250],[390,844,320],[768,400,310]]){
    const view=fixture({width,height,cardHeight}),game=new Game(data);
    try{const tour=view.tour();tour.start(game);view.click('next');view.chooseMaze(tour);const card=view.card.style,highlight=view.highlight.style;
      assert.ok(parseFloat(card.left)>=12);assert.ok(parseFloat(card.top)>=12);assert.ok(parseFloat(card.left)+parseFloat(card.width)<=width-12);assert.ok(parseFloat(card.top)+Math.min(view.card.offsetHeight,parseFloat(card.maxHeight))<=height-12);
      assert.ok(parseFloat(card.top)+Math.min(view.card.offsetHeight,parseFloat(card.maxHeight))<=parseFloat(highlight.top),'placement cards do not block the recruit strip, even on a short viewport');
      view.target('#draft',view.rect(0,0,width,0),false);tour.refresh();assert.equal(parseFloat(highlight.width),width-4,'hidden folio target falls back to actual battlefield');
      view.window.visualViewport={width:width-20,height:height-30,offsetLeft:10,offsetTop:15};tour.refresh();assert.ok(parseFloat(card.left)>=22);assert.ok(parseFloat(card.top)>=27);assert.ok(parseFloat(card.left)+parseFloat(card.width)<=width-22);
    }finally{view.restore();}
  }
});

test('phone coaching leaves the real exposed map strip and every keeper control usable, with optional native instructions',()=>{
  const view=fixture({width:390,height:844,cardHeight:270}),game=new Game(data);
  try{
    view.target('#battlefield',view.rect(0,106,390,738));view.target('#preparation-folio',view.rect(8,418,374,426));view.target('#draft',view.rect(15,463,360,302));view.target('#folio-actions',view.rect(15,780,360,48));
    const tour=view.tour();tour.start(game);view.click('next');view.chooseMaze(tour);const card=view.card.style,instructions=view.fields.get('.tutorial-instructions');
    assert.equal(view.card.dataset.compact,'true');assert.equal(instructions.open,false);assert.equal(parseFloat(card.top),118);assert.ok(parseFloat(card.top)+view.card.offsetHeight<300,'the exposed map grid from y300 to418 stays free');assert.equal(view.fields.get('[data-tour="next"]').hidden,true);
    instructions.open=true;instructions.listeners.get('toggle')();tour.refresh();assert.equal(instructions.open,true,'normal placement refreshes preserve a deliberately expanded explanation');assert.ok(parseFloat(card.top)+parseFloat(card.maxHeight)<310,'expanded coaching retains a map strip and scrolls its long copy');
    tour.show(index('keeper'));assert.equal(instructions.open,false,'each new small-screen task starts compact');assert.ok(parseFloat(card.top)+view.card.offsetHeight<418,'the card covers neither the recruit strip nor Keep');
    tour.show(index('start'));assert.ok(parseFloat(card.top)>=140,'Start remains above its explanation');
  }finally{view.restore();}
  const desktop=fixture({width:1180,height:820});try{const tour=desktop.tour();tour.start(new Game(data));assert.equal(desktop.card.dataset.compact,'false');assert.equal(desktop.fields.get('.tutorial-instructions').open,true,'desktop instructions remain expanded');}finally{desktop.restore();}
});

test('copy and CSS keep the walkthrough nonmodal, touch targets usable and fields accessible',()=>{
  const view=fixture();try{let interactions=0;const tour=view.tour({onInteract:()=>interactions++});view.card.listeners.get('pointerenter')();view.card.listeners.get('focusin')();assert.equal(interactions,2);assert.match(tour.layer.innerHTML,/role="region" aria-labelledby="tutorial-step-title" tabindex="-1"/);assert.match(tour.layer.innerHTML,/role="status" aria-live="polite"/);assert.doesNotMatch(tour.layer.innerHTML,/aria-modal="true"|data-action="(?:pause|speed|keep|start)"/);}
  finally{view.restore();}
  const css=readFileSync(new URL('../ui/tutorial.css',import.meta.url),'utf8');assert.match(css,/\.tutorial-layer\{[^}]*pointer-events:none/);assert.match(css,/\.tutorial-card\{[^}]*pointer-events:auto/);assert.match(css,/min-height:44px/);assert.match(css,/touch-action:manipulation/);assert.match(css,/body:has\(dialog\[open\]\)>\.tutorial-layer/);
  assert.equal(tutorialStepComplete('pause',{round:1,phase:'combat',paused:false}),false);assert.equal(tutorialStepComplete('speed',{round:1,phase:'combat',speed:1},{round:1,speed:1}),false);
});

test('step two requires a real Maze plans selection, including reselecting a saved shape, before recruits',async()=>{
  const view=fixture(),game=new Game(data,{seed:505}),control=new Game(data,{seed:505}),field=realMaze(view,game);
  try{
    const {planner}=field;planner.choose(planner.presets[0].id);const saved=planner.plan,before=state(game),tour=field.tour();tour.start(game);view.click('next');
    assert.equal(index('maze'),1);assert.ok(index('maze')<index('place'));assert.equal(tour.index,index('maze'));assert.equal(view.fields.get('[data-tour="next"]').hidden,true);view.click('next');assert.equal(tour.index,index('maze'));
    for(let i=0;i<20;i++)tour.refresh();assert.strictEqual(planner.plan,saved);assert.equal(tour.index,index('maze'),'a previously saved selection is not a new action');
    view.click('maze');assert.equal(planner.panelOpen,true);assert.equal(view.fields.get('[data-tour="maze"]').hidden,true);assert.match(planner.panel.innerHTML,/Maze plans/);assert.match(planner.panel.innerHTML,/data-maze="choose"/);
    field.click('choose','invalid-shape');await Promise.resolve();assert.equal(tour.index,index('maze'));field.click('close');await Promise.resolve();assert.equal(planner.panelOpen,false);assert.equal(tour.index,index('maze'),'closing the picker is not choosing');
    view.click('maze');field.click('choose',saved.id);await Promise.resolve();assert.equal(planner.panelOpen,false);assert.notStrictEqual(planner.plan,saved);assert.equal(planner.plan.id,saved.id);assert.equal(tour.index,index('place'));assert.equal(state(game),before);assert.equal(game.rng(),control.rng(),'shape choice and observation consume no gameplay RNG');
    tour.finish();assert.equal(field.events.get('click').size,1,'only the original picker listener remains');assert.equal(field.events.get('keydown').size,1);
  }finally{field.restore();view.restore();}
});

test('active editor keeps its real controls and Escape; canceling does not fake a chosen shape',async()=>{
  const view=fixture({width:390,height:844}),game=new Game(data),field=realMaze(view,game);
  try{
    const tour=field.tour();tour.start(game);view.click('next');view.click('maze');field.click('new');await Promise.resolve();
    assert.equal(field.planner.editing,true);assert.equal(tour.layer.hidden,true);assert.equal(tour.active,true);const original=JSON.stringify(field.planner.editor.walls);let prevented=0;
    view.window.listeners.get('keydown')({key:'Escape',preventDefault(){prevented++;},stopImmediatePropagation(){prevented++;}});assert.equal(prevented,0);assert.equal(JSON.stringify(field.planner.editor.walls),original,'the tutorial does not cancel or change the editor');
    field.planner.finishEditor();await Promise.resolve();assert.equal(tour.layer.hidden,false);assert.equal(tour.index,index('maze'));assert.equal(tour.active,true);assert.equal(game.paused,false);
    tour.finish({reason:'reset'});assert.equal(field.events.get('click').size,1);assert.equal(field.events.get('keydown').size,1);
    tour.start(game);assert.equal(field.events.get('click').size,2,'replay adds exactly one scoped observer');tour.finish();assert.equal(field.events.get('click').size,1);
  }finally{field.restore();view.restore();}
});

test('maze coaching leaves the complete real picker outside its card on phone, tablet and short landscape',async()=>{
  for(const [width,height]of [[390,844],[1024,768],[768,400],[390,400]]){
    const view=fixture({width,height}),game=new Game(data),field=realMaze(view,game);
    try{
      const tour=field.tour();tour.start(game);view.click('next');view.click('maze');const card=view.card.style,panel=field.planner.panel.getBoundingClientRect(),left=parseFloat(card.left),top=parseFloat(card.top),right=left+parseFloat(card.width),bottom=top+Math.min(view.card.offsetHeight,parseFloat(card.maxHeight));
      assert.ok(left>=12&&top>=12&&right<=width-12&&bottom<=height-12,`${width}×${height}: card stays in viewport`);assert.ok(right<=panel.left||left>=panel.right||bottom<=panel.top||top>=panel.bottom,`${width}×${height}: no card/picker overlap`);
      assert.equal(view.fields.get('[data-tour="next"]').hidden,true);assert.equal(view.fields.get('.tutorial-instructions').open,width>750&&height>500);field.click('choose',field.planner.presets[0].id);await Promise.resolve();assert.equal(tour.index,index('place'));tour.finish();
    }finally{field.restore();view.restore();}
  }
});

test('ordinary Map tools and M openings reposition the guide after the existing action without replacing controls',async()=>{
  const view=fixture(),game=new Game(data),field=realMaze(view,game);
  try{
    const tour=field.tour();tour.start(game);view.click('next');const before=state(game);
    field.planner.togglePanel();view.window.listeners.get('click')({target:{closest:selector=>selector.includes('[data-action="maze"]')?{}:null}});await Promise.resolve();
    assert.equal(tour.index,index('maze'));assert.ok(parseFloat(view.card.style.left)+parseFloat(view.card.style.width)<field.planner.panel.getBoundingClientRect().left,'native map-tools opening leaves the drawer free');
    field.planner.action('close');tour.refresh();view.window.listeners.get('keydown')({key:'m'});field.planner.togglePanel();await Promise.resolve();assert.equal(view.fields.get('[data-tour="maze"]').hidden,true);assert.ok(parseFloat(view.card.style.left)+parseFloat(view.card.style.width)<field.planner.panel.getBoundingClientRect().left);assert.equal(state(game),before);
    tour.finish();assert.equal(view.window.listeners.has('click'),false,'the scoped launcher observer is removed on End');
  }finally{field.restore();view.restore();}
});
