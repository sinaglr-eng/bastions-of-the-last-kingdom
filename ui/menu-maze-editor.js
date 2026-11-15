import {BlueprintEditor,loadBlueprintLibrary,saveBlueprintLibrary} from '../game/core/blueprints.js';
import {SIZE,CHECKPOINTS} from '../game/core/grid.js';
import {ornateIcon as icon} from './icons.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mazeEditorMarkup(){return `<section class="home-maze-workshop"><div class="maze-workspace"><svg data-maze-board viewBox="0 0 ${SIZE} ${SIZE}" tabindex="0" role="application" aria-label="Maze drawing board. Arrow keys move, Space draws, Delete erases." aria-describedby="maze-help"></svg><div class="maze-board-legend"><span>■ Planned walls</span><span>— Ground route</span><span>◆ Checkpoints</span></div></div><aside class="maze-workshop-tools"><h2>${icon('maze')}Your war table</h2><p id="maze-help">Draw or drag to plan walls. Keep the entrance, exit and every numbered checkpoint connected.</p><label>Blueprint name<input data-maze-name maxlength="48" autocomplete="off" value="My maze"></label><div class="maze-editor-brushes"><button data-editor="draw" aria-pressed="true">Draw walls</button><button data-editor="erase" aria-pressed="false">Erase</button></div><div class="maze-editor-history"><button data-editor="undo">Undo</button><button data-editor="redo">Redo</button><button data-editor="clear">Clear</button></div><strong data-maze-stats></strong><p class="maze-editor-feedback" data-maze-feedback role="status" aria-live="polite"></p><button class="war-primary" data-editor="save">Save & use in game</button><p class="war-helper">Blueprints stay in this browser and appear in the in-game Maze plans panel. Your drawing guides construction; defenders are placed during normal play.</p><h3>Your saved blueprints</h3><div data-maze-library></div></aside></section>`;}

export class MenuMazeEditor{
 constructor({storage,onSaved=()=>{}}){this.storage=storage;this.onSaved=onSaved;const library=loadBlueprintLibrary(storage),plan=library.plans.find(p=>p.id===library.selected);this.editor=new BlueprintEditor(plan?.walls||[]);this.id=plan?.id||null;this.name=plan?.name||'My maze';this.brush='draw';this.cursor={x:1,z:1};this.dirty=false;}
 mount(host){
  this.unmount();this.host=host;this.abort=new AbortController();const opts={signal:this.abort.signal};
  host.querySelector('[data-maze-name]').value=this.name;
  host.addEventListener('input',e=>{if(e.target.matches('[data-maze-name]')){this.name=e.target.value;this.dirty=true;}},opts);
  host.addEventListener('click',e=>{const b=e.target.closest('[data-editor]');if(b&&!b.disabled)this.action(b.dataset.editor,b.dataset.plan);},opts);
  const board=host.querySelector('[data-maze-board]');
  const point=e=>{const r=board.getBoundingClientRect();return {x:Math.floor((e.clientX-r.left)/r.width*SIZE),z:Math.floor((e.clientY-r.top)/r.height*SIZE)};};
  board.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();board.focus({preventScroll:true});board.setPointerCapture(e.pointerId);this.drawing=true;this.last=null;this.editor.begin();this.paint(point(e));},opts);
  board.addEventListener('pointermove',e=>{if(this.drawing)this.paint(point(e));},opts);
  const end=()=>{this.editor.end();this.drawing=false;this.last=null;this.update();};
  board.addEventListener('pointerup',end,opts);board.addEventListener('pointercancel',end,opts);board.addEventListener('lostpointercapture',()=>{if(this.drawing)end();},opts);
  board.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();e.stopPropagation();this.cursor={x:Math.max(0,Math.min(SIZE-1,this.cursor.x+delta[0])),z:Math.max(0,Math.min(SIZE-1,this.cursor.z+delta[1]))};this.update();}else if([' ','Enter','Delete','Backspace'].includes(e.key)){e.preventDefault();e.stopPropagation();this.editor.paint(this.cursor.x,this.cursor.z,['Delete','Backspace'].includes(e.key)||this.brush==='erase');this.editor.end();this.dirty=true;this.update();}},opts);
  this.update();this.library();
 }
 unmount(){if(this.drawing)this.editor.end();this.drawing=false;this.last=null;this.abort?.abort();this.host=null;}
 paint(p){if(p.x<0||p.z<0||p.x>=SIZE||p.z>=SIZE){this.last=null;return;}const prev=this.last||p,steps=Math.max(1,Math.abs(p.x-prev.x),Math.abs(p.z-prev.z));for(let i=1;i<=steps;i++)this.editor.paint(Math.round(prev.x+(p.x-prev.x)*i/steps),Math.round(prev.z+(p.z-prev.z)*i/steps),this.brush==='erase');this.cursor=p;this.last=p;this.dirty=true;this.update();}
 action(action,id){
  if(action==='save')return this.save();
  if(action==='draw'||action==='erase')this.brush=action;
  if(['undo','redo','clear'].includes(action)){this.editor[action]();this.dirty=true;}
  if(action==='load'){const p=loadBlueprintLibrary(this.storage).plans.find(p=>p.id===id);if(!p)return;this.editor=new BlueprintEditor(p.walls);this.id=p.id;this.name=p.name;this.dirty=false;this.host.querySelector('[data-maze-name]').value=p.name;}
  if(action==='new'){this.editor=new BlueprintEditor();this.id=null;this.name='My maze';this.dirty=false;this.host.querySelector('[data-maze-name]').value=this.name;}
  this.update();
 }
 save(){
  this.editor.end();const result=this.editor.validate(this.name);if(!result.plan){this.feedback(result.error,true);return false;}
  const library=loadBlueprintLibrary(this.storage);if(!this.id&&library.plans.length>=20){this.feedback('You have 20 blueprints. Load and update one of your saved plans.',true);return false;}
  const id=this.id||`custom-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`,plan={...result.plan,id,topology:'Your saved blueprint'},plans=[...library.plans.filter(p=>p.id!==id),plan];
  if(!saveBlueprintLibrary(this.storage,plans,id)){this.feedback('Browser storage is unavailable. Your drawing is still here; try saving again.',true);return false;}
  this.id=id;this.name=plan.name;this.dirty=false;this.onSaved(plan);this.library();this.update();this.feedback(`Saved ${plan.name}. This blueprint is selected for your defense.`,false);return true;
 }
 feedback(text,error=false){const el=this.host?.querySelector('[data-maze-feedback]');if(el){el.textContent=text;el.classList.toggle('is-error',error);}}
 library(){const library=loadBlueprintLibrary(this.storage);this.host.querySelector('[data-maze-library]').innerHTML=`<button data-editor="new">New blank blueprint</button>${library.plans.map(p=>`<button data-editor="load" data-plan="${esc(p.id)}"><strong>${esc(p.name)}</strong><small>${p.walls.length} cells · ${p.plannedLength} route steps${library.selected===p.id?' · Selected':''}</small><small>Load saved drawing${this.dirty?' · replaces unsaved drawing':''}</small></button>`).join('')||'<p>No custom blueprints saved yet.</p>'}`;}
 update(){
  if(!this.host)return;const result=this.editor.validate(this.name),plan=result.plan,grid=Array.from({length:SIZE+1},(_,i)=>`M${i} 0V${SIZE}M0 ${i}H${SIZE}`).join('');
  this.host.querySelector('[data-maze-board]').innerHTML=`<rect class="workshop-field" width="${SIZE}" height="${SIZE}"/><path class="workshop-grid" d="${grid}"/><polyline class="workshop-route" points="${(plan?.route||[]).map(p=>`${p.x+.5},${p.z+.5}`).join(' ')}"/>${this.editor.walls.map(p=>`<rect class="workshop-wall" x="${p.x+.08}" y="${p.z+.08}" width=".84" height=".84"/>`).join('')}${CHECKPOINTS.map((p,i)=>`<g><circle class="workshop-checkpoint" cx="${p.x+.5}" cy="${p.z+.5}" r=".48"/><text x="${p.x+.5}" y="${p.z+.72}">${i===0?'S':i===CHECKPOINTS.length-1?'E':i}</text></g>`).join('')}<rect class="workshop-cursor" x="${this.cursor.x+.03}" y="${this.cursor.z+.03}" width=".94" height=".94"/>`;
  this.host.querySelector('[data-maze-board]').setAttribute('aria-label',`Maze drawing board, cell ${this.cursor.x+1}, ${this.cursor.z+1}. Arrow keys move, Space draws, Delete erases.`);
  this.host.querySelector('[data-maze-stats]').textContent=`${this.editor.walls.length} / 250 planned cells${plan?` · ${plan.plannedLength} ground route steps`:''}`;
  this.feedback(result.error||`${this.dirty?'Unsaved drawing · ':''}Every checkpoint is reachable.`,!!result.error);
  for(const action of ['draw','erase'])this.host.querySelector(`[data-editor="${action}"]`).setAttribute('aria-pressed',String(action===this.brush));
  for(const action of ['undo','redo'])this.host.querySelector(`[data-editor="${action}"]`).disabled=!this.editor[action+'Stack'].length;
  this.host.querySelector('[data-editor="save"]').disabled=!!result.error;
 }
}
