import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {configureTouchControls,PointerTapGesture,SelectedTowerDoubleTap,cancelPointerGesture} from '../game/render/touch-input.js';

const pointer=(pointerId,x=100,y=100,type='touch',button=0)=>({pointerId,clientX:x,clientY:y,pageX:x,pageY:y,pointerType:type,button});

test('a second eligible tap on the selected candidate confirms once and mixed pointer types cannot',()=>{
  let now=1000;const taps=new SelectedTowerDoubleTap(()=>now);
  assert.equal(taps.tap(4,pointer(1),{selected:false,eligible:true}),false);
  now+=200;assert.equal(taps.tap(4,pointer(2,106,105),{selected:true,eligible:true}),true);
  now+=100;assert.equal(taps.tap(4,pointer(3),{selected:true,eligible:true}),false,'the completed pair is consumed');
  now+=100;assert.equal(taps.tap(5,pointer(4),{selected:true,eligible:true}),false);
  now+=100;assert.equal(taps.tap(5,pointer(5,100,100,'mouse'),{selected:true,eligible:true}),false);
  now+=100;assert.equal(taps.tap(5,pointer(6),{selected:true,eligible:true}),false,'a mouse action clears touch history');
});

test('mouse and pen double clicks retain the same selected candidate, never another or an ineligible unit',()=>{
  for(const type of ['mouse','pen']){
    let now=100;const taps=new SelectedTowerDoubleTap(()=>now);
    assert.equal(taps.tap(3,pointer(1,100,100,type),{selected:false,eligible:true}),false);
    now+=180;assert.equal(taps.tap(3,pointer(1,103,102,type),{selected:true,eligible:true}),true);
    now+=80;assert.equal(taps.tap(3,pointer(1,100,100,type),{selected:true,eligible:true}),false);
    now+=80;assert.equal(taps.tap(4,pointer(1,100,100,type),{selected:true,eligible:true}),false);
    now+=80;assert.equal(taps.tap(4,pointer(1,100,100,type),{selected:true,eligible:false}),false);
  }
});

test('late, distant, cancelled and ineligible touches cannot retain a tower',()=>{
  let now=1000;const taps=new SelectedTowerDoubleTap(()=>now),options={selected:true,eligible:true};
  taps.tap(1,pointer(1),options);now+=451;assert.equal(taps.tap(1,pointer(2),options),false);
  now+=100;assert.equal(taps.tap(1,pointer(3,140,100),options),false);
  taps.clear();now+=100;assert.equal(taps.tap(1,pointer(4,140,100),options),false);
  now+=100;assert.equal(taps.tap(1,pointer(5,140,100),{selected:true,eligible:false}),false);
  now+=100;assert.equal(taps.tap(1,pointer(6,140,100),options),false);
});

test('touch taps tolerate small jitter, but returning after a drag never places a tower',()=>{
  const gesture=new PointerTapGesture();
  gesture.start(pointer(1));gesture.move(pointer(1,107,103));assert.equal(gesture.navigating(1),false);
  assert.equal(gesture.end(pointer(1,106,102)),true);
  gesture.start(pointer(2));gesture.move(pointer(2,150));gesture.move(pointer(2));
  assert.equal(gesture.navigating(2),true);assert.equal(gesture.end(pointer(2)),false);
  gesture.start(pointer(3));assert.equal(gesture.end(pointer(3,140)),false,'the release position also determines a drag');
});

test('neither finger in a pinch or orbit can place a tower, in either release order',()=>{
  for(const order of [[1,2],[2,1]]){
    const gesture=new PointerTapGesture();gesture.start(pointer(1));gesture.start(pointer(2,200));
    assert.equal(gesture.navigating(1),true);assert.equal(gesture.navigating(2),true);
    for(const id of order)assert.equal(gesture.end(pointer(id,id===1?100:200)),false);
    gesture.start(pointer(3));assert.equal(gesture.end(pointer(3)),true,'the next isolated tap works normally');
  }
});

test('cancellation, lost capture and interrupted gestures cannot produce stale taps',()=>{
  const gesture=new PointerTapGesture();gesture.start(pointer(1));gesture.cancel(pointer(1));
  assert.equal(gesture.end(pointer(1)),false);
  gesture.start(pointer(2));gesture.start(pointer(3));gesture.cancel(pointer(2));
  assert.equal(gesture.end(pointer(3)),false);
  gesture.start(pointer(4));gesture.clear();assert.equal(gesture.end(pointer(4)),false);
  gesture.start(pointer(5));assert.equal(gesture.end(pointer(5)),true);
});

test('compatibility clicks are suppressed after touch, while fresh mouse clicks keep working',()=>{
  let time=1000;const gesture=new PointerTapGesture(()=>time);
  gesture.start(pointer(1));gesture.end(pointer(1));
  assert.equal(gesture.suppressClick({}),true);assert.equal(gesture.suppressClick({pointerType:'touch'}),true);
  time+=801;assert.equal(gesture.suppressClick({pointerType:'mouse'}),false);
  gesture.start(pointer(2,100,100,'mouse'));assert.equal(gesture.end(pointer(2,102,102,'mouse')),true);
  gesture.start(pointer(3,100,100,'mouse',2));assert.equal(gesture.end(pointer(3,100,100,'mouse',2)),false);
});

// Exercise Three's actual touch navigation without requiring a WebGL renderer.
class Canvas extends EventTarget {
  constructor(){super();this.style={};this.clientWidth=900;this.clientHeight=600;this.document=new EventTarget();}
  getRootNode(){return this.document;}
  setPointerCapture(){}
  releasePointerCapture(){}
  emit(type,data){const event=Object.assign(new Event(type,{cancelable:true}),data);this.dispatchEvent(event);return event;}
}

test('normal OrbitControls capture release preserves a map double tap while unexpected capture loss cancels it',()=>{
  class CapturingCanvas extends Canvas {
    constructor(){super();this.captured=new Set();this.losses=0;}
    setPointerCapture(id){this.captured.add(id);}
    releasePointerCapture(id){if(this.captured.delete(id)){this.losses++;this.emit('lostpointercapture',{pointerId:id});}}
  }
  for(const type of ['mouse','touch','pen']){
    const canvas=new CapturingCanvas(),camera=new PerspectiveCamera(38,1.5,.1,210);
    camera.position.set(7,53,41);const controls=new OrbitControls(camera,canvas);configureTouchControls(controls);
    let now=1000,selected=false,kept=0,cleared=0;
    const gesture=new PointerTapGesture(()=>now),doubleTap=new SelectedTowerDoubleTap(()=>now);
    canvas.addEventListener('pointerdown',event=>gesture.start(event));
    canvas.addEventListener('pointerup',event=>{if(gesture.end(event)){if(doubleTap.tap(4,event,{selected,eligible:true}))kept++;selected=true;}else doubleTap.clear();});
    const cancel=event=>cancelPointerGesture(event,gesture,doubleTap,()=>cleared++);
    canvas.addEventListener('lostpointercapture',cancel);canvas.addEventListener('pointercancel',cancel);
    canvas.emit('pointerdown',pointer(1,100,100,type));canvas.emit('pointerup',pointer(1,100,100,type));
    assert.equal(canvas.losses,1);assert.equal(cleared,0);assert.equal(kept,0);
    now+=200;canvas.emit('pointerdown',pointer(2,100,100,type));canvas.emit('pointerup',pointer(2,100,100,type));
    assert.equal(canvas.losses,2);assert.equal(kept,1,`${type}: normal release must allow the second tap to keep`);
    now+=100;canvas.emit('pointerdown',pointer(3,100,100,type));canvas.emit('pointerup',pointer(3,100,100,type));
    now+=100;canvas.emit('pointerdown',pointer(4,100,100,type));canvas.releasePointerCapture(4);
    assert.equal(cleared,1);assert.equal(gesture.active(4),false);assert.equal(doubleTap.last,null);
    canvas.emit('pointerup',pointer(4,100,100,type));
    now+=100;canvas.emit('pointerdown',pointer(5,100,100,type));canvas.emit('pointerup',pointer(5,100,100,type));
    assert.equal(kept,1,`${type}: capture loss must consume pending confirmation`);
    controls.dispose();
  }
});

test('one finger pans the camera, two fingers zoom and rotate, and neither gesture activates a tile',()=>{
  const canvas=new Canvas(),camera=new PerspectiveCamera(38,1.5,.1,210);camera.position.set(7,53,41);
  const controls=new OrbitControls(camera,canvas);controls.target.set(1,1,-1);configureTouchControls(controls);controls.update();
  const gesture=new PointerTapGesture();let taps=0;
  canvas.addEventListener('pointerdown',event=>gesture.start(event));
  canvas.addEventListener('pointermove',event=>{gesture.move(event);if(!gesture.navigating(event.pointerId))event.stopImmediatePropagation();});
  canvas.addEventListener('pointerup',event=>{if(gesture.end(event))taps++;});
  canvas.addEventListener('pointercancel',event=>gesture.cancel(event));
  const firstTarget=controls.target.clone();
  canvas.emit('pointerdown',pointer(1));canvas.emit('pointermove',pointer(1,106,102));
  assert.ok(controls.target.equals(firstTarget),'tap jitter does not move the camera');
  canvas.emit('pointerup',pointer(1,106,102));assert.equal(taps,1);
  canvas.emit('pointerdown',pointer(2));canvas.emit('pointermove',pointer(2,180,120));
  assert.ok(controls.target.distanceTo(firstTarget)>1,'a one-finger drag moves the map');
  canvas.emit('pointerup',pointer(2));assert.equal(taps,1,'returning to the start does not activate a tile');
  canvas.emit('pointerdown',pointer(3,100));canvas.emit('pointerdown',pointer(4,200));
  const beforePinch=camera.position.distanceTo(controls.target),beforeOrbit=camera.position.clone().sub(controls.target);
  canvas.emit('pointermove',pointer(4,260,140));
  assert.ok(camera.position.distanceTo(controls.target)<beforePinch,'spreading two fingers zooms in');
  assert.ok(camera.position.clone().sub(controls.target).normalize().distanceTo(beforeOrbit.normalize())>.01,'two-finger movement rotates');
  canvas.emit('pointerup',pointer(4,260,140));canvas.emit('pointerup',pointer(3,100));assert.equal(taps,1);
  canvas.emit('pointerdown',pointer(5));canvas.emit('pointercancel',pointer(5));
  canvas.emit('pointerdown',pointer(6));canvas.emit('pointerup',pointer(6));assert.equal(taps,2,'a tap after cancellation works');
  controls.dispose();
});
