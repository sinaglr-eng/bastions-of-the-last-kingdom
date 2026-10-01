import * as THREE from 'three';
import presets from '../../data/maze-blueprints.json';
import {preparedBlueprints,loadBlueprintLibrary,saveBlueprintLibrary,blueprintProgress,BlueprintEditor} from '../core/blueprints.js';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export class MazePlanner {
  constructor(world){
    this.world=world;this.game=world.game;this.presets=preparedBlueprints(presets);
    const library=loadBlueprintLibrary(localStorage);this.saved=library.plans;this.plan=[...this.presets,...this.saved].find(p=>p.id===library.selected)||null;
    this.panelOpen=false;this.visible=!!this.plan;this.editor=null;this.revision='';this.brush='draw';
    this.group=new THREE.Group();world.scene.add(this.group);
    this.panel=document.createElement('div');this.panel.className='maze-guide';this.panel.hidden=true;this.panel.setAttribute('aria-label','Maze planner');
    const sidebar=world.container.parentElement.querySelector('.sidebar');sidebar.insertBefore(this.panel,sidebar.querySelector('.side-body'));
    this.chip=document.createElement('button');this.chip.className='maze-chip';this.chip.hidden=true;world.container.append(this.chip);this.chip.addEventListener('click',()=>this.togglePanel());
    this.panel.addEventListener('click',e=>{const b=e.target.closest('[data-maze]');if(!b)return;e.stopPropagation();this.action(b.dataset.maze,b.dataset.id);});
  }
  get editing(){return !!this.editor;}
  get budget(){return this.game.constructionBudget.remaining;}
  togglePanel(){if(this.editing){this.panelOpen=true;}else this.panelOpen=!this.panelOpen;this.renderPanel();this.sync();}
  choose(id){
    const plan=[...this.presets,...this.saved].find(p=>p.id===id);if(!plan)return;
    this.plan=structuredClone(plan);this.visible=true;this.panelOpen=false;this.revision='';
    if(!saveBlueprintLibrary(localStorage,this.saved,id))this.game.message('Blueprint selected for this game. Browser storage is unavailable.');
    this.sync();
  }
  action(action,id){
    if(action==='choose')this.choose(id);
    if(action==='close'&&!this.editing){this.panelOpen=false;this.sync();}
    if(action==='new')this.startEditor();
    if(action==='edit')this.startEditor(this.plan);
    if(action==='cancel')this.finishEditor();
    if(action==='save')this.saveEditor();
    if(action==='draw'||action==='erase'){this.brush=action;this.updateEditor();}
    if(action==='undo'||action==='redo'||action==='clear'){this.editor?.[action]();this.updateEditor();}
    if(action==='visibility'){this.visible=!this.visible;this.revision='';this.sync();this.renderPanel();}
  }
  sync(){
    this.panel.hidden=!this.panelOpen;
    const button=document.querySelector('[data-action="maze"]');button?.classList.toggle('active',this.panelOpen);button?.setAttribute('aria-pressed',String(this.panelOpen));
    this.chip.hidden=!this.plan||this.editing;this.group.visible=this.visible||this.editing;
    if(this.editing)return;
    if(!this.plan){this.clear();return;}
    const revision=`${this.game.grid.revision}:${this.game.round}:${this.budget}:${this.plan.id}`;
    if(revision!==this.revision){
      this.revision=revision;this.progress=blueprintProgress(this.plan,this.game.grid,this.budget,this.game.constructionBudget.limit);this.draw(this.plan,this.progress.missing);
      this.chip.textContent=`${this.visible?'▧':'◇'} ${this.plan.name} · ${this.progress.built}/${this.plan.walls.length} · M`;
      this.chip.title='Fixed blueprint. Click or press M to change it.';
      if(this.panelOpen)this.renderPanel();
    }
  }
  renderPanel(){
    this.panel.hidden=!this.panelOpen;if(this.editing)return;
    const plans=[...this.presets,...this.saved],p=this.plan;
    const options=group=>group.map(plan=>`<button data-maze="choose" data-id="${escape(plan.id)}" class="maze-option ${p?.id===plan.id?'active':''}"><b>${escape(plan.name)}</b><span>${plan.plannedLength} steps · ${plan.walls.length} cells · ${Math.round(plan.coverage/plan.plannedLength*100)}% core fire</span><span class="maze-core-metrics">${plan.fire.passes} firing passes · ${plan.fire.seconds.toFixed(0)}s in range*</span></button>`).join('');
    const reference=plans.filter(plan=>!plan.id.startsWith('custom-')&&plan.origin!=='curated'),curated=plans.filter(plan=>plan.origin==='curated'),custom=plans.filter(plan=>plan.id.startsWith('custom-'));
    this.panel.innerHTML=`<div class="maze-panel-heading"><span class="eyebrow">MAZE PLANS</span><button class="text-button" data-maze="close">Close · M</button></div><p>Fixed blueprints · ${this.game.constructionBudget.limit} placements total. Walls and defenders both count.</p><p class="maze-reference-label">YOUR REFERENCE LAYOUTS</p><div class="maze-options">${options(reference)}</div><p class="maze-reference-label">CENTRAL CROSSFIRE · UP TO 150 CELLS</p><div class="maze-options">${options(curated)}</div>${custom.length?`<p class="maze-reference-label">YOUR SAVED PLANS</p><div class="maze-options">${options(custom)}</div>`:''}${p?`<p class="maze-topology">Selected: ${escape(p.name)}</p><p>${this.progress?.built||0} / ${p.walls.length} built · ${p.plannedLength} planned steps</p><div class="maze-performance"><b>${p.fire.passes} passes through central fire</b><span>${p.coverage} route steps · ${p.fire.seconds.toFixed(1)}s in range*<br>${p.fire.batterySeconds.toFixed(0)} combined firing-position seconds*</span></div><p>${this.progress?.projected||p.walls.length} / ${this.game.constructionBudget.limit} occupied or planned cells · ${this.budget} placements left${this.progress?.offPlan?` · ${this.progress.offPlan} outside this plan`:""}</p>${this.progress?.conflict?'<p class="maze-error">Existing defenses block the completed route. Your plan is unchanged; edit it or choose another.</p>':''}${this.progress?.overBudget?'<p class="maze-error">This layout exceeds the construction budget. Choose or edit a smaller plan. Demolition does not refund a draw.</p>':''}<button class="text-button" data-maze="visibility">${this.visible?'Hide blueprint':'Show blueprint'}</button> <button class="text-button" data-maze="edit">${p.id.startsWith('custom-')?'Edit selected':'Edit a copy'}</button>`:''}<button class="secondary-button maze-new" data-maze="new">＋ Create your own maze</button><small>*Measured at 2 cells/s in six-cell firing circles around gold positions, without slows. Combined seconds sum every position's exposure. Flying enemies follow checkpoints directly. M reopens this panel.</small>`;
  }
  startEditor(plan=null){
    this.world.pathGroup.visible=false;this.wasPaused=this.game.paused;this.game.paused=true;this.world.keys.clear();this.world.edgePointer=null;
    this.editor=new BlueprintEditor(plan?.walls||[]);this.editId=plan?.id.startsWith('custom-')?plan.id:null;this.brush='draw';this.panelOpen=true;
    this.panel.innerHTML=`<div class="eyebrow">BLUEPRINT EDITOR · GAME PAUSED</div><h3>Draw your own route.</h3><label for="maze-name">Plan name</label><input id="maze-name" maxlength="48" value="${escape(plan?plan.name+(this.editId?'':' copy'):'My spiral')}" autocomplete="off"><div class="maze-brushes"><button class="text-button" data-maze="draw">Draw walls</button><button class="text-button" data-maze="erase">Erase</button></div><p>Click or drag on the field. You are drawing a plan; no defenders or gold are spent.</p><strong id="maze-editor-stats"></strong><p id="maze-editor-error" class="maze-error" role="status"></p><div class="maze-brushes"><button class="text-button" data-maze="undo">Undo</button><button class="text-button" data-maze="redo">Redo</button><button class="text-button" data-maze="clear">Clear plan</button></div><button class="primary-button maze-new" data-maze="save">Save & use blueprint</button><button class="text-button maze-new" data-maze="cancel">Cancel editing · Esc</button><small>Saved in this browser for future games. Keep all checkpoints reachable. Camera: WASD, Q/E, wheel.</small>`;
    this.updateEditor();this.sync();
  }
  paint(x,z){
    if(!this.editor)return;
    const previous=this.strokePoint||{x,z},steps=Math.max(Math.abs(x-previous.x),Math.abs(z-previous.z),1);
    for(let i=1;i<=steps;i++)this.editor.paint(Math.round(previous.x+(x-previous.x)*i/steps),Math.round(previous.z+(z-previous.z)*i/steps),this.brush==='erase');
    this.strokePoint={x,z};this.updateEditor();
  }
  endStroke(){this.editor?.end();this.strokePoint=null;if(this.editor)this.updateEditor();}
  updateEditor(){
    if(!this.editor)return;
    const result=this.editor.validate();this.editorResult=result;
    this.panel.querySelector('#maze-editor-stats').textContent=`${this.editor.walls.length} / 250 cells${result.plan?' · '+result.plan.plannedLength+' steps':''}`;
    this.panel.querySelector('#maze-editor-error').textContent=result.error||'All checkpoints remain reachable.';
    this.panel.querySelector('[data-maze="save"]').disabled=!!result.error;
    for(const mode of ['draw','erase'])this.panel.querySelector(`[data-maze="${mode}"]`).setAttribute('aria-pressed',String(this.brush===mode));
    this.panel.querySelector('[data-maze="undo"]').disabled=!this.editor.undoStack.length;
    this.panel.querySelector('[data-maze="redo"]').disabled=!this.editor.redoStack.length;
    this.draw(result.plan||{walls:this.editor.walls,core:[],route:[]},this.editor.walls,!!result.error);
  }
  saveEditor(){
    const name=this.panel.querySelector('#maze-name').value,result=this.editor.validate(name);
    if(!result.plan)return this.game.message(result.error);
    if(!this.editId&&this.saved.length>=20)return this.game.message('Twenty saved plans available. Edit an existing saved plan.');
    const plan={...result.plan,id:this.editId||`custom-${Date.now().toString(36)}`,topology:'Your saved blueprint'};
    const saved=[...this.saved.filter(p=>p.id!==plan.id),plan];
    if(!saveBlueprintLibrary(localStorage,saved,plan.id))return this.game.message('Could not save in browser storage. Your drawing is still open.');
    this.saved=saved;this.finishEditor();this.choose(plan.id);this.game.message(`Saved ${plan.name} · ${plan.plannedLength} steps`);
  }
  finishEditor(){
    if(!this.editor)return;this.editor=null;this.strokePoint=null;this.world.pathGroup.visible=this.world.showPath;this.game.paused=this.wasPaused;this.panelOpen=false;this.revision='';this.world.hover=null;this.sync();
  }
  clear(){for(const o of [...this.group.children]){this.group.remove(o);o.geometry?.dispose();o.material?.dispose();}}
  draw(plan,missing=plan.walls,invalid=false){
    this.clear();const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0));
    for(const [cells,color,opacity] of [[missing,invalid?'#ef806b':'#65dce9',.65],[plan.core||[],'#ffcf69',.94]]){
      if(!cells.length)continue;
      const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(.86,.86),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false}),cells.length);
      cells.forEach((p,i)=>{matrix.compose(new THREE.Vector3(p.x-18,.096,p.z-18),rotation,new THREE.Vector3(1,1,1));mesh.setMatrixAt(i,matrix);});this.group.add(mesh);
    }
    if(plan.route?.length&&(this.editing||!this.progress?.conflict)){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(plan.route.map(p=>new THREE.Vector3(p.x-18,.11,p.z-18))),new THREE.LineDashedMaterial({color:'#eefee4',transparent:true,opacity:.7,dashSize:.16,gapSize:.2}));line.computeLineDistances();this.group.add(line);}
    this.group.visible=this.visible||this.editing;
  }
  dispose(){this.clear();this.world.scene.remove(this.group);this.panel.remove();this.chip.remove();}
}
