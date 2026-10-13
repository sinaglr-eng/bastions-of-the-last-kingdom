const identity=tower=>JSON.stringify([tower.id,tower.family,tower.tier]);

// Keep the completed army's measured identities separate from the next draft.
// A crafted/upgraded defender sharing an ID never inherits that old score.
export class DpsMeasurement {
  constructor(){this.currentWave=null;this.completedWave=null;this.completedRows=[];}
  startWave(wave){this.currentWave=wave;}
  completeWave(game,tracker){
    this.completedWave=this.currentWave??game.round;
    this.completedRows=tracker.snapshot(game.towers,game.combat.elapsed,{includeDraft:false}).map(row=>({...row}));
  }
  view(game,tracker){
    const fighting=game.phase==='combat';
    const wave=fighting?this.currentWave:this.completedWave;
    const current=new Set(game.towers.filter(t=>t.state==='active').map(identity));
    const rows=fighting?tracker.snapshot(game.towers,game.combat.elapsed,{includeDraft:false}):this.completedRows.map(row=>({...row,selectable:current.has(identity(row)),archived:!current.has(identity(row))}));
    return {rows,options:{phase:game.phase,paused:game.paused,wave,measured:wave!==null,completed:!fighting&&wave!==null}};
  }
}
