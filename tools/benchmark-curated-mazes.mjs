import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {GridManager} from '../game/core/grid.js';
import {preparedBlueprints} from '../game/core/blueprints.js';
const plans=preparedBlueprints(JSON.parse(readFileSync('data/maze-blueprints.json','utf8')));
const reports=plans.map(plan=>{
 const grid=new GridManager();for(const [i,p]of plan.walls.entries())assert.ok(grid.occupy(p.x,p.z,i+1).ok);
 assert.deepEqual(grid.route,plan.route);
 const covered=grid.route.slice(1).filter(p=>plan.core.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<=6));
 const unique=new Set(covered.map(p=>`${p.x},${p.z}`));
 return {id:plan.id,name:plan.name,origin:plan.origin||'reference',walls:plan.walls.length,steps:plan.route.length-1,coreSteps:covered.length,corePercent:+(covered.length/plan.plannedLength*100).toFixed(1),passes:plan.fire.passes,secondsAtTwoCellsPerSecond:plan.fire.seconds,batterySeconds:plan.fire.batterySeconds,repeatedCoreVisitsPerTile:+(covered.length/unique.size).toFixed(2),segments:plan.segments,core:plan.core};
});
writeFileSync('artifacts/curated-maze-report.json',JSON.stringify(reports,null,2));
writeFileSync('docs/MAZE_COMPARISON.md',`# Fixed central-fire blueprints

The library contains the three requested reference layouts and three curated central-fire variants. The earlier automatic suggestions have been removed. Custom saved blueprints remain available. Existing geometry in Commander's spiral, Diamond spiral and Chevron bastion is unchanged, including Chevron's 153 cells. Each new curated plan occupies at most 150 cells.

| Layout | Cells | Route steps | Steps in core fire | Core coverage | Continuous firing passes | Seconds in range at 2 cells/s | Combined position-seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
`+reports.map(p=>`| ${p.name} | ${p.walls} | ${p.steps} | ${p.coreSteps} | ${p.corePercent}% | ${p.passes} | ${p.secondsAtTwoCellsPerSecond} | ${p.batterySeconds} |`).join('\n')+`

Core fire is the union of six-cell circles around the plan's gold firing positions. A firing pass is a continuous in-range run on the full ordered route; leaving and returning starts another pass. Route visits, including repeated steps through the same tile, count separately. Seconds use a comparison speed of two cells per second without slows. Combined position-seconds sum exposure to every gold position; they represent simultaneous firing opportunities, not a combat damage prediction. Defenders have different ranges, damage, targeting and effects, so actual battle time and damage vary.

The new Compact crossfire, Core gauntlet and Crown crossfire plans all revisit central tiles more than three times on average and bring every ordered checkpoint leg through the central battery. They extend the user's diamond topology with different gate and turn arrangements. Compact needs fewer placements; Core increases concentrated exposure; Crown extends total time in central fire.

All six legs are independently measured with gameplay GridManager BFS and its east/south/west/north tie-breaking. Every build prefix is checked for reachability. This is a comparison of bounded search results, without a claim of global optimality. Flying units ignore walls and take their checkpoint route.

Reproduce current metrics with \`node tools/benchmark-curated-mazes.mjs\`. Fixed presets live in \`data/maze-blueprints.json\`; the commander geometry is in \`game/core/commander-maze.js\`. Search was performed offline with a 150-cell maximum, and never moves a selected plan while playing.
`);
console.table(reports.map(({name,walls,steps,corePercent,passes,secondsAtTwoCellsPerSecond})=>({name,walls,steps,corePercent,passes,secondsAtTwoCellsPerSecond})));
