import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {updateHeaderCombatControls} from '../ui/header-combat-controls.js';
import {icon} from '../ui/icons.js';

const source=readFileSync(new URL('../game/main.js',import.meta.url),'utf8'),data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const state=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,cp:game.commandPoints.value,gold:game.economy.gold,round:game.round,phase:game.phase,occupied:[...game.grid.occupied],route:game.grid.route});
function headerFixture(){
 const document={activeElement:null},host={hidden:true,writes:0,buttons:[],markup:''};
 const button=(action,label)=>({tagName:'BUTTON',dataset:{action},disabled:false,textContent:label,title:'',isContentEditable:false,attributes:new Map(),getAttribute(name){return this.attributes.get(name)||null;},setAttribute(name,value){this.attributes.set(name,String(value));},closest(selector){return selector==='[data-action]'?this:null;},focus(){document.activeElement=this;},querySelector(){return null;}});
 Object.defineProperty(host,'innerHTML',{get:()=>host.markup,set:value=>{host.writes++;host.markup=value;host.buttons=[...value.matchAll(/<button[^>]*data-action="([^"]+)"[^>]*>/g)].map(match=>{const node=button(match[1],match[1]==='speed'?'1×':'');for(const attribute of match[0].matchAll(/([\w-]+)="([^"]*)"/g))node.setAttribute(attribute[1],attribute[2]);if(match[1]==='pause'){node.label={textContent:'Pause'};node.glyph={innerHTML:''};node.querySelector=selector=>selector==='.header-pause-label'?node.label:node.glyph;}return node;});}});
 host.querySelector=selector=>host.buttons.find(node=>selector===`[data-action="${node.dataset.action}"]`)||null;
 return {host,document,get pause(){return host.querySelector('[data-action="pause"]');},get speed(){return host.querySelector('[data-action="speed"]');}};
}
function declaration(name){const start=source.indexOf(`function ${name}(`),next=source.indexOf('\nfunction ',start+1);assert.ok(start>=0&&next>start,'saved production '+name+' is available');return source.slice(start,next);}
function compile(names,bindings,prefix=''){return new Function(...Object.keys(bindings),prefix+'\n'+names.map(declaration).join('\n')+`\nreturn {${names.join(',')}};`)(...Object.values(bindings));}
function actionBoundary(game,header){
 const callbacks=new Map(),world={keys:new Set(),maze:{editing:false},doubleTap:{clear(){}}},dialog={open:false},document=header.document,noop=()=>{},app={addEventListener:(type,fn)=>callbacks.set(type,fn)};let renders=0,unlocks=0;
 const render=()=>{renders++;updateHeaderCombatControls(header.host,game);},bindings={game,world,document,app,render,sendWave:()=>game.startCombat(),audio:{unlock(){unlocks++;}},draftCardActivation:{clear(){}},debug:false,codex:noop,warbands:noop,help:noop,closeDialog:noop,debugPanel:noop};
 const functions=compile(['mainAction','handleCommand'],bindings);
 const keyboardLine=source.split('\n').find(line=>line.startsWith("window.addEventListener('keydown'"));assert.ok(keyboardLine);
 new Function('window','document','game','world','$','audio','mainAction',keyboardLine)({addEventListener:(type,fn)=>callbacks.set(type,fn)},document,game,world,()=>dialog,bindings.audio,functions.mainAction);
 return {world,dialog,functions,get renders(){return renders;},get unlocks(){return unlocks;},click(button){callbacks.get('click')({target:{closest:()=>button},detail:1});},keydown(event){callbacks.get('keydown')(event);}};
}

test('production header mounts combat controls inside the right action group immediately before Enemy Waves and leaves TIME in stats',()=>{
 const start=source.indexOf('app.innerHTML=`'),end=source.indexOf('\nconst $=',start);assert.ok(start>=0&&end>start);
 const app={innerHTML:''};new Function('app','icon','profile','balance',source.slice(start,end))(app,icon,{muted:false},data.balance);
 const header=app.innerHTML.slice(0,app.innerHTML.indexOf('</header>')),actions=header.slice(header.indexOf('class="header-actions"'));
 assert.ok(actions.indexOf('id="header-combat-controls"')<actions.indexOf('data-action="warbands"'));assert.ok(actions.indexOf('id="header-combat-controls"')<actions.indexOf('data-action="codex"'));
 assert.match(actions,/role="group" aria-label="Combat controls"/);assert.doesNotMatch(header.slice(0,header.indexOf('class="header-actions"')),/id="header-combat-controls"/);
 assert.match(header.slice(0,header.indexOf('class="header-actions"')),/hud-stat run-time[\s\S]*<small>TIME<\/small>/);
});

test('header creates exactly two native buttons once and preserves their identity and focus across combat updates',()=>{
 const game=new Game(data,{seed:92}),header=headerFixture();game.phase='combat';updateHeaderCombatControls(header.host,game);const pause=header.pause,speed=header.speed;pause.focus();
 assert.equal(header.host.buttons.length,2);assert.equal(header.host.writes,1);assert.match(header.host.markup,/type="button"/);assert.equal(pause.getAttribute('aria-label'),'Pause game');assert.equal(pause.getAttribute('aria-pressed'),'false');assert.equal(header.host.hidden,false);
 for(let frame=0;frame<100;frame++){game.paused=frame%2===0;game.speed=frame%3+1;updateHeaderCombatControls(header.host,game);assert.strictEqual(header.pause,pause);assert.strictEqual(header.speed,speed);assert.strictEqual(header.document.activeElement,pause);assert.equal(pause.getAttribute('aria-pressed'),String(game.paused));assert.equal(pause.label.textContent,game.paused?'Resume':'Pause');assert.equal(speed.textContent,game.speed+'×');assert.equal(speed.getAttribute('aria-label'),'Game speed '+game.speed+'×');}
 assert.equal(header.host.writes,1);assert.match(pause.title,/Space/);assert.equal(pause.disabled,false);assert.equal(speed.disabled,false);
});

test('noncombat phases hide and disable mounted controls and reuse them after the next assault',()=>{
 const game=new Game(data,{seed:172}),header=headerFixture();updateHeaderCombatControls(header.host,game);const pause=header.pause,speed=header.speed;
 for(const phase of ['build','select','ready','reward','won','lost']){game.phase=phase;updateHeaderCombatControls(header.host,game);assert.equal(header.host.hidden,true,phase);assert.equal(pause.disabled,true);assert.equal(speed.disabled,true);assert.strictEqual(header.pause,pause);}
 game.phase='combat';game.paused=true;game.speed=2;updateHeaderCombatControls(header.host,game);assert.equal(header.host.hidden,false);assert.equal(pause.disabled,false);assert.equal(speed.disabled,false);assert.equal(pause.label.textContent,'Resume');assert.equal(speed.textContent,'2×');assert.equal(header.host.writes,1);
});

test('actual delegated main clicks toggle pause and cycle 1→2→3→1 without altering authoritative inventory or RNG',()=>{
 const game=new Game(data,{seed:591}),control=new Game(data,{seed:591}),header=headerFixture();game.phase=control.phase='combat';updateHeaderCombatControls(header.host,game);const boundary=actionBoundary(game,header),before=state(game);
 boundary.click(header.pause);assert.equal(game.paused,true);assert.equal(header.pause.label.textContent,'Resume');boundary.click(header.pause);assert.equal(game.paused,false);assert.equal(header.pause.label.textContent,'Pause');
 for(const rate of [2,3,1]){boundary.click(header.speed);assert.equal(game.speed,rate);assert.equal(header.speed.textContent,rate+'×');assert.equal(game.paused,false);}
 assert.equal(boundary.renders,5);assert.equal(boundary.unlocks,5);assert.equal(state(game),before);assert.equal(game.rng(),control.rng());assert.equal(header.host.writes,1);
 game.phase='ready';updateHeaderCombatControls(header.host,game);const rendered=boundary.renders,unlocks=boundary.unlocks;boundary.click(header.pause);boundary.click(header.speed);assert.equal(boundary.renders,rendered);assert.equal(boundary.unlocks,unlocks);assert.equal(game.paused,false);assert.equal(game.speed,1);
});

test('real Game clock and movement stop while paused and use the selected speed after resuming',()=>{
 const game=new Game(data,{seed:773}),header=headerFixture();game.phase='combat';game.combat.spawnQueue=[{time:1e6,type:'host_01'}];const enemy=game.combat.spawn('host_01');updateHeaderCombatControls(header.host,game);const boundary=actionBoundary(game,header);
 boundary.click(header.pause);const paused={elapsed:game.combat.elapsed,traveled:enemy.traveled,hp:enemy.hp};game.tick(.25);assert.equal(game.combat.elapsed,paused.elapsed);assert.equal(enemy.traveled,paused.traveled);assert.equal(enemy.hp,paused.hp);
 boundary.click(header.speed);boundary.click(header.speed);assert.equal(game.speed,3);boundary.click(header.pause);game.tick(.1);assert.ok(Math.abs(game.combat.elapsed-paused.elapsed-.3)<1e-9);assert.ok(Math.abs(enemy.traveled-paused.traveled-enemy.speed*.3)<1e-9);
});

test('actual Space shortcut toggles once from the battlefield and does not leak through native header buttons or open dialogs',()=>{
 const game=new Game(data,{seed:114}),header=headerFixture();game.phase='combat';updateHeaderCombatControls(header.host,game);const boundary=actionBoundary(game,header);let prevented=0;const event=()=>({key:' ',preventDefault(){prevented++;}});
 header.document.activeElement={tagName:'BODY',isContentEditable:false,closest:()=>null};boundary.keydown(event());assert.equal(game.paused,true);assert.equal(prevented,1);assert.equal(boundary.renders,1);
 boundary.world.keys.clear();header.speed.focus();boundary.keydown(event());assert.equal(prevented,1);assert.equal(boundary.world.keys.size,0);assert.equal(boundary.renders,1);boundary.click(header.speed);assert.equal(game.speed,2);assert.equal(game.paused,true,'native speed-button activation does not also pause through the global shortcut');
 boundary.world.keys.clear();header.pause.focus();boundary.keydown(event());assert.equal(boundary.renders,2);assert.equal(boundary.world.keys.size,0);boundary.click(header.pause);assert.equal(game.paused,false);assert.equal(boundary.renders,3,'native pause-button activation changes state exactly once');
 header.document.activeElement={tagName:'BODY',isContentEditable:false,closest:()=>null};boundary.dialog.open=true;boundary.world.keys.clear();boundary.keydown(event());assert.equal(game.paused,false);assert.equal(boundary.renders,3);assert.equal(boundary.world.keys.size,0);assert.equal(prevented,1);
});

test('actual modal open and close restore the previous pause state while keeping header buttons and game resources intact',()=>{
 for(const initiallyPaused of [false,true]){
  const game=new Game(data,{seed:880}),control=new Game(data,{seed:880}),header=headerFixture();game.phase=control.phase='combat';game.paused=initiallyPaused;game.speed=3;updateHeaderCombatControls(header.host,game);header.speed.focus();const pause=header.pause,speed=header.speed,callbacks=new Map();
  const dialog={open:false,shows:0,showModal(){this.open=true;this.shows++;},close(){this.open=false;callbacks.get('close')();},addEventListener:(type,fn)=>callbacks.set(type,fn)},content={innerHTML:''},world={keys:new Set(['w'])},noop=()=>{},before=state(game);let renders=0;
  const functions=compile(['openDialog','closeDialog'],{game,$:id=>id==='dialog'?dialog:content,world,draftCardActivation:{clear:noop},draftPointerInput:{clear:noop},debug:false,render(){renders++;updateHeaderCombatControls(header.host,game);}},'let modalPaused=false,recipeFilterConnection=null;');
  functions.openDialog('<p>Wave overview</p>');assert.equal(game.paused,true);assert.equal(dialog.open,true);assert.equal(world.keys.size,0);updateHeaderCombatControls(header.host,game);assert.equal(header.pause.label.textContent,'Resume');
  functions.openDialog('<p>Another overview</p>');assert.equal(dialog.shows,1,'replacing an open modal must not overwrite the saved pre-modal pause state');functions.closeDialog();assert.equal(game.paused,initiallyPaused);assert.equal(game.speed,3);assert.equal(dialog.open,false);assert.equal(renders,1);assert.strictEqual(header.pause,pause);assert.strictEqual(header.speed,speed);assert.strictEqual(header.document.activeElement,speed);assert.equal(header.host.writes,1);assert.equal(state(game),before);assert.equal(game.rng(),control.rng());
 }
});
