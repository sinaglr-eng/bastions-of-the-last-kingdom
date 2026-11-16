import {restoreRun} from '../game/core/run-state.js';
import {validateLoadout} from '../game/core/general.js';

const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const sameLoadout=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,level])=>b[id]===level);
const parse=value=>typeof value==='string'?JSON.parse(value):value;

// This validates server-owned saved state before command replay. It is not a
// signature for arbitrary client snapshots or a substitute for replay.
export function restoreVerifiedRun(data,run){
 const snapshot=parse(run.snapshot_json),recorded=parse(run.loadout_json);
 if(!object(recorded)||!object(snapshot?.loadout))throw Error('Invalid frozen Commander loadout.');
 const loadout=validateLoadout(recorded);
 if(!sameLoadout(loadout,snapshot.loadout)||snapshot.factionId!==run.faction_id||snapshot.ruleset!==run.ruleset)throw Error('Saved run identity does not match its frozen Commander loadout.');
 const game=restoreRun(data,snapshot),maximum=data.balance.startingLives+5*(loadout['fortified-keep']||0);
 if(!sameLoadout(loadout,game.general.loadout)||!Number.isSafeInteger(game.lives)||game.lives<0||game.lives>maximum||(game.maxLives??data.balance.startingLives)!==maximum)throw Error('Invalid Commander keep health.');
 return game;
}
