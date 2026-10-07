import test from 'node:test';
import assert from 'node:assert/strict';
import {currentReconstructionEntry,auditCurrentReconstructionIds} from '../tools/audit-reconstructed-roster.mjs';

// V4/V5 source-specific solids, clipping contracts and named grip fixtures do
// not describe the approved V7/V8 authoring deliveries. Run current production
// adaptation and real geometry/attack/resource checks for those deliveries;
// retain the exact legacy diagnostics when a caller selects legacy fixtures.
export function testApprovedOrLegacy(ids,currentName,legacyName,legacy,{fixtureOverride=false}={}){
  const current=!fixtureOverride&&ids.every(currentReconstructionEntry);
  return test(current?currentName:legacyName,async()=>{
    if(!current)return legacy();
    const reports=await auditCurrentReconstructionIds(ids);
    assert.equal(reports.length,ids.length);
    for(const report of reports){
      assert.deepEqual(report.failures,[],report.id+' actual approved source/runtime audit');
      assert.ok(report.maximumMuzzleTravel>1e-5,report.id+' real articulated endpoint moves');
      assert.ok(report.checks.length>=50,report.id+' actual surface, event and resource assertions execute');
    }
  });
}
