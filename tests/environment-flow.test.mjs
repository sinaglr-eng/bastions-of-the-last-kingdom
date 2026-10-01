import test from 'node:test';
import assert from 'node:assert/strict';
import {valleyEnvironment} from '../game/render/environment.js';

test('river currents move downstream while scenery stays outside every playable tile',()=>{
  const valley=valleyEnvironment(),currents=valley.water.children.find(o=>o.isLineSegments);
  const before=Array.from(currents.geometry.attributes.position.array);
  for(const time of [1,35,120,480]){
    valley.update(.1,time,90);
    for(const object of valley.water.children){
      const positions=object.geometry?.attributes.position;if(!positions)continue;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
        assert.ok(Number.isFinite(x+y+z));
        assert.ok(Math.abs(x)>=18.49||Math.abs(z)>=18.49,'moving water never reaches a build tile');
      }
    }
  }
  assert.notDeepEqual(Array.from(currents.geometry.attributes.position.array),before);
});

test('distant clouds drift and disappear when the camera returns to a close view',()=>{
  const valley=valleyEnvironment();valley.update(0,0,90);
  assert.equal(valley.clouds.visible,true);
  const position=valley.clouds.children[0].position.clone();valley.update(.1,35,90);
  assert.notDeepEqual(valley.clouds.children[0].position.toArray(),position.toArray());
  assert.ok(valley.clouds.children.some(c=>c.material.opacity>0));
  valley.update(.1,35,35);assert.equal(valley.clouds.visible,false);
  assert.ok(valley.clouds.children.every(c=>c.material.opacity===0));
});

test('both actual river curves tolerate a negative first frame and large animation clocks',()=>{
  const valley=valleyEnvironment();
  const currents=valley.water.children.filter(object=>object.isLineSegments);
  assert.equal(currents.length,2,'The regression exercises the main river and the new mill stream');
  for(const [dt,time]of [[-.0001,-.0001],[-.05,-.05],[.05,-400/6],[.05,-250000],[3600,1e9],[.05,Number.MAX_SAFE_INTEGER],[NaN,NaN],[.05,Infinity]]){
    assert.doesNotThrow(()=>valley.update(dt,time,90),'Clock '+String(time)+' stays within both CatmullRom parameter domains');
    for(const river of currents){
      const positions=river.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
        assert.ok(Number.isFinite(x+y+z),'Current positions remain finite');
        assert.ok(Math.abs(x)>=18.49||Math.abs(z)>=18.49,'Wrapping never sends a current through the build field');
      }
    }
    for(const cloud of valley.clouds.children){
      assert.ok(cloud.position.toArray().every(Number.isFinite));
      assert.ok(cloud.position.x>=-50&&cloud.position.x<50,'Cloud wrapping also handles a negative time');
    }
  }
});
