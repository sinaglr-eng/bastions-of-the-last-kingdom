import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {CriticalHitLabels} from '../game/render/critical-hit-labels.js';
function fixture(){const document={createElement(){return {ownerDocument:document,children:[],style:{},setAttribute(){},append(child){child.parent=this;this.children.push(child);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}};}};const container=document.createElement();return new CriticalHitLabels(container,{half:0,maxLabels:2});}
const payload={enemy:{x:0,z:-5,flying:false},effectiveDamage:100,visible:true};
test('only genuine visible positive-damage critical events create labels; hidden targets never reveal themselves',()=>{
  const fx=fixture();for(const [type,p]of [['hit',payload],['critical-hit',{...payload,effectiveDamage:0}],['critical-hit',{...payload,visible:false}]])fx.event(type,p);
  assert.equal(fx.items.length,0);fx.event('critical-hit',payload);assert.equal(fx.items.length,1);assert.equal(fx.items[0].el.textContent,'Crit!');
  fx.update(0,new PerspectiveCamera(60,1,.1,100),500,500,{isRevealed:()=>false});assert.equal(fx.items[0].el.hidden,true);
});
test('labels hold on pause, expire on battle time, cap simultaneous impacts and clear at wave/end/disposal',()=>{
  const fx=fixture(),camera=new PerspectiveCamera(60,1,.1,100);for(let i=0;i<3;i++)fx.event('critical-hit',payload);assert.equal(fx.items.length,2);assert.equal(fx.host.children.length,2);
  fx.update(0,camera,500,500);assert.equal(fx.items[0].life,.85);const transform=fx.items[0].el.style.transform;fx.update(0,camera,500,500);assert.equal(fx.items[0].el.style.transform,transform);
  fx.update(1,camera,500,500);assert.equal(fx.items.length,0);assert.equal(fx.host.children.length,0);
  fx.event('critical-hit',payload);fx.event('wave-complete',{});assert.equal(fx.items.length,1,'the last killing critical remains visible after construction opens');fx.update(1,camera,500,500);assert.equal(fx.items.length,0);
  for(const type of ['wave','won','lost']){fx.event('critical-hit',payload);fx.event(type,{});assert.equal(fx.items.length,0);}
  fx.event('critical-hit',payload);const parent=fx.host.parent;fx.dispose();assert.equal(parent.children.length,0);
});
