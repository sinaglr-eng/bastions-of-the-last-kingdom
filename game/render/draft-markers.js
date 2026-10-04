import * as THREE from 'three';
import {recipeFamily,recipeLabel,rankLabel} from '../core/recipes.js';
import {defenderPortrait} from '../release.js';
import {RecipeMarkerActivation} from '../../ui/recipe-marker-input.js';
import {mergeTowerKey,mergeTowerFromBadge} from '../../ui/draft-input.js';
import {PointerTapGesture} from './touch-input.js';

// Independent world-space markers: aiming and recoil never move the round indicators.
export class DraftMarkers {
  constructor(scene,container){
    this.scene=scene;this.container=container;this.items=new Map();this.badges=new Map();this.mergeBadges=new Map();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.layer=document.createElement('div');this.layer.className='recipe-map-badges';container.append(this.layer);
    this.activation=new RecipeMarkerActivation();this.gesture=new PointerTapGesture();this.pointers=new Map();
    this.layer.addEventListener('pointerdown',event=>{const button=event.target.closest?.('.recipe-map-badge');if(!button)return;this.gesture.start(event);this.pointers.set(event.pointerId,{button,mergeKey:button.dataset.mergeKey});});
    this.layer.addEventListener('pointermove',event=>this.gesture.move(event));
    this.layer.addEventListener('pointerup',event=>{
      const origin=this.pointers.get(event.pointerId),button=origin?.button;this.pointers.delete(event.pointerId);
      if(!this.gesture.end(event)||button!==event.target.closest?.('.recipe-map-badge')){this.activation.clear();return;}
      if(button?.dataset.role==='merge'){this.activation.clear();mergeTowerFromBadge(this.game,Number(button.dataset.tower),origin.mergeKey);return;}
      if(button?.dataset.role==='discarded'){this.activation.clear();this.game.select(Number(button.dataset.tower));return;}
      if(button)this.activation.activate(this.game,Number(button.dataset.tower),button.dataset.recipe,event);
    });
    this.cancel=()=>{this.activation.clear();this.gesture.clear();this.pointers.clear();};
    this.layer.addEventListener('pointercancel',this.cancel);window.addEventListener('blur',this.cancel);
    this.lines=document.createElementNS('http://www.w3.org/2000/svg','svg');this.lines.classList.add('recipe-map-links');this.layer.append(this.lines);
    this.legend=document.createElement('div');this.legend.className='recipe-map-legend';this.legend.hidden=true;container.append(this.legend);
  }
  create(number){
    const group=new THREE.Group();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');
    c.fillStyle='#172b2b';c.beginPath();c.arc(48,48,38,0,Math.PI*2);c.fill();c.strokeStyle='#ffe0a1';c.lineWidth=4;c.stroke();
    c.fillStyle='#fff0c2';c.font='bold 48px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(String(number),48,51);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));sprite.scale.set(.62,.62,1);sprite.position.y=.43;group.add(sprite);
    group.traverse(o=>o.renderOrder=20);group.userData={texture,sprite};this.scene.add(group);return group;
  }
  sync(game,models){
    this.game=game;
    const candidates=game.roundCandidates,ids=new Set(candidates.map(c=>c.tower.id)),hints=game.combinationHints,hintIds=new Set(hints.map(h=>h.tower.id));
    const merges=candidates.flatMap(({tower,number})=>{const key=mergeTowerKey(game,tower.id);return key?[{tower,number,key}]:[];}),mergeIds=new Set(merges.map(merge=>merge.tower.id));
    for(const [id,marker] of this.items)if(!ids.has(id)){this.release(marker);this.items.delete(id);}
    for(const {tower,number} of candidates){
      let marker=this.items.get(tower.id);if(!marker){marker=this.create(number);this.items.set(tower.id,marker);}
      const body=models.get(tower.id)?.object;
      const height=body?new THREE.Box3().setFromObject(body).max.y:2;
      marker.position.set(tower.x-18,height+.5,tower.z-18);marker.userData.height=height;
      marker.userData.sprite.material.color.set(tower.id===game.selected?'#fff1b2':'#ffffff');
      marker.userData.sprite.visible=!hintIds.has(tower.id)&&!mergeIds.has(tower.id);
    }
    for(const [id,badge] of this.badges)if(!hintIds.has(id)){badge.el.remove();badge.line.remove();this.badges.delete(id);}
    for(const hint of hints){
      const {tower,recipe,role}=hint;let badge=this.badges.get(tower.id);
      if(!badge){const el=document.createElement('button'),line=document.createElementNS('http://www.w3.org/2000/svg','line');this.layer.append(el);this.lines.append(line);badge={el,line};this.badges.set(tower.id,badge);}
      const number=candidates.find(c=>c.tower.id===tower.id)?.number;
      const name=recipeLabel(recipe,game.data),label=role==='result'?`${name}: result here`:role==='consumed'?`${name}: this ingredient becomes a wall`:role==='discarded'?'Unchosen candidate becomes a wall':`${name}: combination available`;
      badge.el.className=`recipe-map-badge ${role==='result'?'recipe-result':role}`;badge.line.setAttribute('stroke',role==='result'?'#ffdb83':role==='consumed'?'#e89479':'#b9d2c5');badge.el.setAttribute('aria-label',label);badge.el.title=label;
      badge.el.dataset.tower=String(tower.id);badge.el.dataset.recipe=recipe.id;badge.el.dataset.role=role;
      if(role!=='discarded')badge.el.title+=' · Double-click or double-tap to create here';
      badge.el.innerHTML=`<span class="recipe-map-portrait">${role==='discarded'?'<span class="wall-glyph">♜</span>':`<img src="${defenderPortrait(recipeFamily(recipe),1)}" alt="">`}</span><b>${role==='result'?'★':role==='consumed'?'−':role==='discarded'?'×':'+'}</b>${number?`<small>${number}</small>`:''}`;
      badge.el.onclick=event=>{
        if(event.detail>0||this.gesture.suppressClick(event))return;
        if(role==='discarded'){this.activation.clear();game.select(tower.id);}
        else this.activation.activate(game,tower.id,recipe.id);
      };
      const body=models.get(tower.id)?.object;badge.height=body?new THREE.Box3().setFromObject(body).max.y:2;badge.tower=tower;
    }
    for(const [id,badge]of this.mergeBadges)if(!mergeIds.has(id)){badge.el.remove();badge.line.remove();this.mergeBadges.delete(id);}
    for(const {tower,number,key}of merges){
      let badge=this.mergeBadges.get(tower.id);
      if(!badge){const el=document.createElement('button'),line=document.createElementNS('http://www.w3.org/2000/svg','line');this.layer.append(el);this.lines.append(line);badge={el,line};this.mergeBadges.set(tower.id,badge);}
      const label=`Merge ${game.data.towers[tower.family].name} into rank ${rankLabel(tower.tier+1)} here`;
      badge.el.className='recipe-map-badge merge-map-badge';badge.el.type='button';badge.el.setAttribute('aria-label',label);
      badge.el.title=label+' · Click or tap; the matching defender becomes a wall';badge.line.setAttribute('stroke','#ffdb83');
      badge.el.dataset.tower=String(tower.id);badge.el.dataset.role='merge';badge.el.dataset.mergeKey=key;
      badge.el.innerHTML=`<span class="recipe-map-portrait"><img src="${defenderPortrait(tower.family,tower.tier+1)}" alt=""></span><span class="merge-map-label">MERGE</span><b>↑</b><small>${number}</small>`;
      badge.el.onclick=event=>{
        if(event.detail>0||this.gesture.suppressClick(event))return;
        this.activation.clear();mergeTowerFromBadge(game,tower.id,key);
      };
      const body=models.get(tower.id)?.object;badge.height=body?new THREE.Box3().setFromObject(body).max.y:2;badge.tower=tower;
    }
    const preview=game.recipePreview;this.legend.hidden=!preview;
    if(preview)this.legend.textContent=`${recipeLabel(preview.recipe,game.data)} · Double-click ★ to create here · − ingredients → walls${preview.discarded.length?' · × unchosen → walls':''}`;
  }
  update(time,camera,viewportHeight){
    for(const [id,marker] of this.items){
      // Keep the numeral legible even when the full 37 × 37 field is on screen.
      const unitsPerPixel=2*camera.position.distanceTo(marker.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewportHeight);
      const scale=Math.min(3.2,Math.max(1,unitsPerPixel*16/.62));marker.scale.setScalar(scale);
      marker.position.y=marker.userData.height+.42*scale;
    }
    const occupied=[],width=this.container.clientWidth,small=width<580;
    for(const [id,badge] of [...this.badges,...this.mergeBadges]){
      const merge=badge.el.dataset.role==='merge',bw=small?(merge?44:36):48,bh=small?(merge?50:42):54;
      const marker=this.items.get(id),p=new THREE.Vector3(badge.tower.x-18,marker?marker.position.y+.43*marker.scale.y:badge.height+1,badge.tower.z-18).project(camera);
      badge.el.hidden=Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1;
      badge.line.style.display=badge.el.hidden?'none':'';if(badge.el.hidden)continue;
      const x=Math.max(bw/2+6,Math.min(width-bw/2-6,(p.x+1)*width/2)),desired=(1-p.y)*viewportHeight/2-bh*.2;
      let y=Math.max(bh/2+6,Math.min(viewportHeight-bh/2-6,desired));
      // Keep neighboring recipe portraits distinct; a thin leader retains the exact unit association.
      for(let step=0;step<24&&occupied.some(q=>Math.abs(q.x-x)<(q.bw+bw)/2+10&&Math.abs(q.y-y)<(q.bh+bh)/2+12);step++){
        const offset=Math.ceil((step+1)/2)*(bh+12)*(step%2?-1:1);
        y=Math.max(bh/2+6,Math.min(viewportHeight-bh/2-6,desired+offset));
      }
      occupied.push({x,y,bw,bh});badge.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
      const anchor=new THREE.Vector3(badge.tower.x-18,badge.height+.12,badge.tower.z-18).project(camera);
      for(const [key,value] of Object.entries({x1:x,y1:y+bh/2,x2:(anchor.x+1)*width/2,y2:(1-anchor.y)*viewportHeight/2}))badge.line.setAttribute(key,String(value));
    }
  }
  release(marker){this.scene.remove(marker);const materials=new Set();marker.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());marker.userData.texture.dispose();}
  dispose(){this.cancel();window.removeEventListener('blur',this.cancel);this.items.forEach(m=>this.release(m));this.items.clear();this.badges.clear();this.mergeBadges.clear();this.layer.remove();this.legend.remove();}
}
