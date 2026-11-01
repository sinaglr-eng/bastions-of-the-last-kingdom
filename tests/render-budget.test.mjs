import test from 'node:test';import assert from 'node:assert/strict';import {renderBudget,AssetLoadQueue} from '../game/render/render-budget.js';
const settle=()=>new Promise(r=>setImmediate(r));
test('touch and desktop-mode iPads bound render targets and decode concurrency while ordinary desktops retain their existing resolution',()=>{
 for(const options of [{coarsePointer:true},{platform:'MacIntel',maxTouchPoints:5}]){const p=renderBudget({pixelRatio:3,...options});assert.equal(p.pixelRatio,1.25);assert.equal(p.assetConcurrency,1);assert.equal(p.maxCachedUnused,0);assert.equal(p.shadowMapSize,1024);}assert.equal(renderBudget({pixelRatio:2}).pixelRatio,1.6);assert.equal(renderBudget({pixelRatio:.8}).pixelRatio,.8);assert.equal(renderBudget({pixelRatio:NaN}).pixelRatio,1);const r=renderBudget({pixelRatio:3,recovering:true});assert.equal(r.pixelRatio,1);assert.equal(r.assetConcurrency,1);
});
test('one shared queue serializes real load promises across enemy, defender and scenery callers',async()=>{
 const q=new AssetLoadQueue(1),order=[],gates=[];const jobs=['enemy','defender','scenery'].map(name=>q.run(()=>{order.push(name);return new Promise(r=>gates.push(()=>r(name)));}));await settle();assert.deepEqual(order,['enemy']);gates.shift()();assert.equal(await jobs[0],'enemy');await settle();assert.deepEqual(order,['enemy','defender']);q.setSuspended(true);gates.shift()();assert.equal(await jobs[1],'defender');await settle();assert.deepEqual(order,['enemy','defender']);q.setSuspended(false);await settle();gates.shift()();assert.equal(await jobs[2],'scenery');q.dispose();
});
test('closing a queue rejects work not started while active ownership still reaches its original disposal boundary',async()=>{
 const q=new AssetLoadQueue(1);let resolve,started=0;const live=q.run(()=>{started++;return new Promise(r=>resolve=r);}),waiting=q.run(()=>{started++;});const rejected=assert.rejects(waiting,/closed/);await settle();q.dispose();await rejected;resolve('late asset for owner disposal');assert.equal(await live,'late asset for owner disposal');assert.equal(started,1);await assert.rejects(q.run(()=>{}),/closed/);
});
