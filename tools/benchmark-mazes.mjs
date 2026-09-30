import {writeFileSync,mkdirSync} from 'node:fs';
import {GridManager} from '../game/core/grid.js';
import {mazeSnapshot,searchMazeVariants} from '../game/core/maze-search.js';
import {recommendMaze} from '../game/core/maze.js';
const grid=new GridManager(),snapshot=mazeSnapshot(grid),started=performance.now();
const initial=searchMazeVariants(snapshot,250);
const refined=searchMazeVariants(snapshot,250,{effort:3,initialPlans:initial.plans});
const reports=[initial,refined].map((r,i)=>({search:i?'Extended':'Initial',evaluated:r.evaluated,budget:r.budget,plans:r.plans.map(p=>({id:p.id,name:p.name,steps:p.plannedLength,walls:p.walls.length,coreSteps:p.coverage,corePercent:Math.round(p.coverage/p.plannedLength*100),segments:p.segments}))}));
// Independently verify every planned path using the game's navigation class.
for(const r of [initial,refined])for(const p of r.plans){const g=new GridManager();for(const cell of p.walls)g.occupied.set(`${cell.x},${cell.z}`,1);if(JSON.stringify(g.findRoute())!==JSON.stringify(p.route))throw Error('Route disagrees with gameplay BFS');}
mkdirSync('artifacts',{recursive:true});
writeFileSync('artifacts/maze-comparison.json',JSON.stringify({openSteps:grid.route.length-1,legacySteps:recommendMaze(grid).plannedLength,milliseconds:Math.round(performance.now()-started),reports},null,2));
writeFileSync('artifacts/maze-layouts.json',JSON.stringify(refined.plans,null,2));
writeFileSync('docs/MAZE_COMPARISON.md',`# Measured maze variants\n\nOpen field: ${grid.route.length-1} steps. Previous 140-wall recommendation: ${recommendMaze(grid).plannedLength} steps. Current campaign allows 250 total placements over 50 rounds. Counts sum the actual cardinal shortest path across all six ordered checkpoint segments, including repeated visits. These are best-found layouts, not proven global optima. Flying enemies ignore the walls.\n\n| Search | Variant | Steps | Walls | Steps in central range | Central coverage | Six legs |\n|---|---|---:|---:|---:|---:|---|\n`+reports.flatMap(r=>r.plans.map(p=>`| ${r.search} | ${p.name} | ${p.steps} | ${p.walls} | ${p.coreSteps} | ${p.corePercent}% | ${p.segments.join(' + ')} |`)).join('\n')+'\n\nCentral coverage is the union of 6-tile firing circles around gold positions near the field centre. Commander’s spiral uses its solid 3 x 3 battery; other layouts use up to ten positions. It counts route steps, not cumulative damage. The central search rewards repeat exposure near the middle; the lean option prioritizes route length per foundation. Every final count is independently verified with GridManager.findRoute. Blueprint previews never place units or reveal hidden recruits.\n');
console.log(JSON.stringify(reports,null,2));
