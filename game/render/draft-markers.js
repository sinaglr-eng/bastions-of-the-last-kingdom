import * as THREE from 'three';
import {recipeFamily,recipeLabel} from '../core/recipes.js';
import {releaseAsset} from '../release.js';

// Independent world-space markers: aiming and recoil never move the round indicators.
export class DraftMarkers {
  constructor(scene,container){
    this.scene=scene;this.container=container;this.items=new Map();this.badges=new Map();this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.layer=document.createElement('div');this.layer.className='recipe-map-badges';container.append(this.layer);
    this.lines=document.createElementNS('http://www.w3.org/2000/svg','svg');this.lines.classList.add('recipe-map-links');this.layer.append(this.lines);
    this.legend=document.createElement('div');this.legend.className='recipe-map-legend';this.legend.hidden=true;container.append(this.legend);
  }
  create(number){
    const group=new THREE.Group(),orbit=new THREE.Group();group.add(orbit);
    const material=new THREE.MeshBasicMaterial({color:'#ffd570',depthTest:false,depthWrite:false,transparent:true});
    const arc=new THREE.Mesh(new THREE.TorusGeometry(.51,.062,6,36,Math.PI*1.65),material);
    arc.rotation.x=-Math.PI/2;orbit.add(arc);
    const angle=Math.PI*1.65,head=new THREE.Mesh(new THREE.ConeGeometry(.17,.34,3),material);
    head.position.set(.51*Math.cos(angle),0,-.51*Math.sin(angle));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-Math.sin(angle),0,-Math.cos(angle)));orbit.add(head);
    const pointer=new THREE.Mesh(new THREE.ConeGeometry(.14,.29,4),material);pointer.rotation.z=Math.PI;pointer.position.y=-.15;group.add(pointer);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');
    c.fillStyle='#172b2b';c.beginPath();c.arc(48,48,38,0,Math.PI*2);c.fill();c.strokeStyle='#ffe0a1';c.lineWidth=4;c.stroke();
    c.fillStyle='#fff0c2';c.font='bold 48px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(String(number),48,51);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));sprite.scale.set(.62,.62,1);sprite.position.y=.43;group.add(sprite);
    group.traverse(o=>o.renderOrder=20);group.userData={orbit,material,texture,sprite};this.scene.add(group);return group;
  }
  sync(game,models){
    const candidates=game.roundCandidates,ids=new Set(candidates.map(c=>c.tower.id)),hints=game.combinationHints,hintIds=new Set(hints.map(h=>h.tower.id));
    for(const [id,marker] of this.items)if(!ids.has(id)){this.release(marker);this.items.delete(id);}
    for(const {tower,number} of candidates){
      let marker=this.items.get(tower.id);if(!marker){marker=this.create(number);this.items.set(tower.id,marker);}
      const body=models.get(tower.id)?.object;
      const height=body?new THREE.Box3().setFromObject(body).max.y:2;
      marker.position.set(tower.x-18,height+.5,tower.z-18);marker.userData.height=height;
      marker.userData.material.color.set(tower.id===game.selected?'#fff1b2':'#f3ba48');
      marker.userData.sprite.visible=!hintIds.has(tower.id);
    }
    for(const [id,badge] of this.badges)if(!hintIds.has(id)){badge.el.remove();badge.line.remove();this.badges.delete(id);}
    for(const hint of hints){
      const {tower,recipe,role}=hint;let badge=this.badges.get(tower.id);
      if(!badge){const el=document.createElement('button'),line=document.createElementNS('http://www.w3.org/2000/svg','line');this.layer.append(el);this.lines.append(line);badge={el,line};this.badges.set(tower.id,badge);}
      const number=candidates.find(c=>c.tower.id===tower.id)?.number;
      const name=recipeLabel(recipe,game.data),label=role==='result'?`${name}: result here`:role==='consumed'?`${name}: this ingredient becomes a wall`:role==='discarded'?'Unchosen candidate becomes a wall':`${name}: combination available`;
      badge.el.className=`recipe-map-badge ${role}`;badge.line.setAttribute('stroke',role==='result'?'#ffdb83':role==='consumed'?'#e89479':'#b9d2c5');badge.el.setAttribute('aria-label',label);badge.el.title=label;
      badge.el.innerHTML=`${role==='discarded'?'<span class="wall-glyph">♜</span>':`<img src="${releaseAsset(`assets/army/${recipeFamily(recipe)}-t1.png`)}" alt="">`}<b>${role==='result'?'★':role==='consumed'?'−':role==='discarded'?'×':'+'}</b>${number?`<small>${number}</small>`:''}`;
      badge.el.onclick=()=>{game.select(tower.id);if(role!=='discarded')game.previewRecipe(recipe.id);};
      const body=models.get(tower.id)?.object;badge.height=body?new THREE.Box3().setFromObject(body).max.y:2;badge.tower=tower;
    }
    const preview=game.recipePreview;this.legend.hidden=!preview;
    if(preview)this.legend.textContent=`${recipeLabel(preview.recipe,game.data)} · ★ result here · − ingredients → walls${preview.discarded.length?' · × unchosen → walls':''}`;
  }
  update(time,camera,viewportHeight){
    for(const [id,marker] of this.items){
      // Keep the numeral legible even when the full 37 × 37 field is on screen.
      const unitsPerPixel=2*camera.position.distanceTo(marker.position)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.max(1,viewportHeight);
      const scale=Math.min(3.2,Math.max(1,unitsPerPixel*16/.62));marker.scale.setScalar(scale);
      marker.userData.orbit.rotation.y=this.reduced?0:time*1.7+id;
      marker.position.y=marker.userData.height+.42*scale+(this.reduced?0:Math.sin(time*2.6+id)*.065);
    }
    const occupied=[],width=this.container.clientWidth,small=width<580,bw=small?30:38,bh=small?34:44;
    for(const [id,badge] of this.badges){
      const marker=this.items.get(id),p=new THREE.Vector3(badge.tower.x-18,marker?marker.position.y+.43*marker.scale.y:badge.height+1,badge.tower.z-18).project(camera);
      badge.el.hidden=Math.abs(p.x)>1||Math.abs(p.y)>1||p.z>1;
      badge.line.style.display=badge.el.hidden?'none':'';if(badge.el.hidden)continue;
      const x=Math.max(bw/2+6,Math.min(width-bw/2-6,(p.x+1)*width/2)),desired=(1-p.y)*viewportHeight/2-bh*.2;
      let y=Math.max(bh/2+6,Math.min(viewportHeight-bh/2-6,desired));
      // Keep neighboring recipe portraits distinct; a thin leader retains the exact unit association.
      for(let step=0;step<24&&occupied.some(q=>Math.abs(q.x-x)<bw+10&&Math.abs(q.y-y)<bh+12);step++){
        const offset=Math.ceil((step+1)/2)*(bh+12)*(step%2?-1:1);
        y=Math.max(bh/2+6,Math.min(viewportHeight-bh/2-6,desired+offset));
      }
      occupied.push({x,y});badge.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
      const anchor=new THREE.Vector3(badge.tower.x-18,badge.height+.12,badge.tower.z-18).project(camera);
      for(const [key,value] of Object.entries({x1:x,y1:y+bh/2,x2:(anchor.x+1)*width/2,y2:(1-anchor.y)*viewportHeight/2}))badge.line.setAttribute(key,String(value));
    }
  }
  release(marker){this.scene.remove(marker);const materials=new Set();marker.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());marker.userData.texture.dispose();}
  dispose(){this.items.forEach(m=>this.release(m));this.items.clear();this.layer.remove();this.legend.remove();}
}
