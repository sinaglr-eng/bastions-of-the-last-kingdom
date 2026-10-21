import test from 'node:test';
import assert from 'node:assert/strict';
import {observeWebGLContext} from '../game/render/webgl-diagnostics.js';

test('WebGL context diagnostics stay bounded and observational through loss, restoration and cleanup',()=>{
  const canvas=new EventTarget();let clock=20;
  const diagnostic=observeWebGLContext(canvas,{now:()=>clock});
  assert.deepEqual(diagnostic.snapshot(),{lost:false,losses:0,restores:0,lastEvent:null});
  const loss=new Event('webglcontextlost',{cancelable:true});assert.equal(canvas.dispatchEvent(loss),true);assert.equal(loss.defaultPrevented,false,'diagnostics never cancel or replace the renderer recovery handler');
  assert.deepEqual(diagnostic.snapshot(),{lost:true,losses:1,restores:0,lastEvent:{type:'lost',atMs:20}});
  clock=42;canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.deepEqual(diagnostic.snapshot(),{lost:false,losses:1,restores:1,lastEvent:{type:'restored',atMs:42}});
  const copy=diagnostic.snapshot();copy.lastEvent.type='mutated';copy.losses=99;
  assert.equal(diagnostic.snapshot().lastEvent.type,'restored');assert.equal(diagnostic.snapshot().losses,1,'the read-only DOM receipt owns no mutable diagnostic state');
  for(let i=0;i<1000;i++){canvas.dispatchEvent(new Event('webglcontextlost'));canvas.dispatchEvent(new Event('webglcontextrestored'));}
  assert.equal(diagnostic.snapshot().losses,1001);assert.equal(diagnostic.snapshot().restores,1001);assert.equal(Object.keys(diagnostic.snapshot()).length,4,'no unbounded event history is retained');
  clock=Infinity;canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(diagnostic.snapshot().lastEvent.atMs,null);
  diagnostic.dispose();const disposed=diagnostic.snapshot();diagnostic.dispose();canvas.dispatchEvent(new Event('webglcontextrestored'));assert.deepEqual(diagnostic.snapshot(),disposed,'a replaced battlefield cannot retain or mutate through old listeners');
});
