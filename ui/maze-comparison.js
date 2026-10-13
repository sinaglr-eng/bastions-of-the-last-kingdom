import {SIZE,CHECKPOINTS} from '../game/core/grid.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>Number(value).toLocaleString('en-US',{maximumFractionDigits:1});

// Every mark comes from the validated blueprint, including the full ordered
// ground route. This is a comparison thumbnail, never a new playable path.
export function mazePlanThumbnail(plan,{size=SIZE,checkpoints=CHECKPOINTS}={}){
  const cells=(points,kind)=>points.map(p=>`<rect data-maze-${kind}="${p.x},${p.z}" x="${p.x+.06}" y="${p.z+.06}" width=".88" height=".88"/>`).join('');
  const grid=Array.from({length:size+1},(_,i)=>`M${i} 0V${size}M0 ${i}H${size}`).join('');
  const route=(plan.route||[]).map(p=>`${p.x+.5},${p.z+.5}`).join(' ');
  return `<svg class="maze-plan-thumbnail" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escape(plan.name)}: top-down blueprint with ground route, walls and gold firing positions"><rect class="maze-thumbnail-field" width="${size}" height="${size}"/><path class="maze-thumbnail-grid" d="${grid}"/><g class="maze-thumbnail-walls">${cells(plan.walls||[],'wall')}</g><polyline class="maze-thumbnail-route" points="${route}"/><g class="maze-thumbnail-core">${cells(plan.core||[],'core')}</g><g class="maze-thumbnail-checkpoints">${checkpoints.map((p,index)=>`<circle data-maze-checkpoint="${index}" cx="${p.x+.5}" cy="${p.z+.5}" r=".53"/>`).join('')}</g></svg>`;
}

function planDetails(plan){
  const fire=plan.fire,coverage=plan.plannedLength?Math.round(plan.coverage/plan.plannedLength*100):0;
  return `<dl class="maze-plan-facts"><div><dt>Planned cells</dt><dd>${number(plan.walls.length)}</dd></div><div><dt>Route in firing circles</dt><dd>${number(plan.coverage)} steps · ${coverage}%</dd></div><div><dt>Firing passes</dt><dd>${number(fire.passes)}</dd></div><div><dt>Time in firing circles</dt><dd>${number(fire.seconds)}s</dd></div><div><dt>Combined position exposure</dt><dd>${number(fire.batterySeconds)}s</dd></div><div><dt>Checkpoint legs</dt><dd>${plan.segments.map(number).join(' + ')} steps</dd></div></dl><p class="maze-plan-assumptions">Reference: ${number(fire.speed)} cells/s, ${number(fire.range)}-cell firing circles around gold positions, without slows. Repeated route visits count; combined exposure sums each firing position.</p>${plan.topology?`<p class="maze-plan-topology">${escape(plan.topology)}</p>`:''}`;
}

export function mazeComparisonMarkup({plans,selected=null,progress=null,budget,limit,visible=true,detailsOpen=new Map()}){
  const option=plan=>{
    const chosen=selected?.id===plan.id,key=escape(plan.id);
    return `<article class="maze-comparison-card ${chosen?'selected':''}"><button type="button" class="maze-plan-select" data-maze="choose" data-id="${key}" data-maze-focus="choose:${key}" aria-pressed="${chosen}" aria-describedby="maze-flight-warning" aria-label="Select ${escape(plan.name)}, ${number(plan.plannedLength)} ground route steps">${mazePlanThumbnail(plan)}<span class="maze-plan-copy"><strong>${escape(plan.name)}</strong><span class="maze-plan-primary"><b>${number(plan.plannedLength)}</b> ground route steps</span>${chosen?'<small class="maze-plan-selected">Selected</small>':''}</span></button><details class="maze-plan-details" data-maze-details="${key}"${detailsOpen.get(plan.id)?' open':''}><summary data-maze-focus="details:${key}">Route, exposure and assumptions</summary>${planDetails(plan)}</details></article>`;
  };
  const group=(name,items)=>items.length?`<section class="maze-plan-group"><h3>${name}</h3><div class="maze-comparison-options">${items.map(option).join('')}</div></section>`:'';
  const reference=plans.filter(p=>!p.id.startsWith('custom-')&&p.origin!=='curated'),curated=plans.filter(p=>p.origin==='curated'),custom=plans.filter(p=>p.id.startsWith('custom-'));
  const status=selected?`<section class="maze-selected-progress" aria-label="Selected blueprint progress"><h3>Selected: ${escape(selected.name)}</h3><p>${progress?.built||0} / ${selected.walls.length} built · ${progress?.route?number(progress.route.length-1):'blocked'} steps after maze</p><p>${progress?.projected??selected.walls.length} / ${limit} occupied or planned cells · ${budget} placements left${progress?.offPlan?` · ${progress.offPlan} outside this plan`:''}</p>${progress?.conflict?'<p class="maze-error">Existing defenses block the completed route. Your plan is unchanged; edit it or choose another.</p>':''}${progress?.overBudget?'<p class="maze-error">This layout exceeds the construction budget. Choose or edit a smaller plan. Demolition does not refund a draw.</p>':''}<div class="maze-selected-actions"><button type="button" class="text-button" data-maze="visibility" data-maze-focus="visibility">${visible?'Hide blueprint':'Show blueprint'}</button><button type="button" class="text-button" data-maze="edit" data-maze-focus="edit">${selected.id.startsWith('custom-')?'Edit selected':'Edit a copy'}</button></div></section>`:'';
  return `<section class="maze-comparison"><div class="maze-panel-heading"><h2>Maze plans</h2><button type="button" class="text-button" data-maze="close" data-maze-focus="close" aria-label="Close maze plans">Close · M</button></div><p class="maze-budget-note">Fixed blueprints · ${limit} placements total. Walls and defenders both count.</p><p class="maze-flight-warning" id="maze-flight-warning">Flying enemies ignore the maze and follow checkpoints directly.</p><p class="maze-comparison-caution">Geometric comparisons, not damage predictions, campaign win probabilities or globally optimal solutions.</p>${group('Your reference plans',reference)}${group('Central crossfire · up to 150 cells',curated)}${group('Your saved plans',custom)}${status}<button type="button" class="secondary-button maze-new" data-maze="new" data-maze-focus="new">＋ Create your own maze</button><small class="maze-comparison-help">Choose a plan to show its fixed cells on the field. Gold marks firing positions. M reopens this panel.</small></section>`;
}

const states=new WeakMap();
export function updateMazeComparison(host,options){
  let state=states.get(host);if(!state){state={open:new Map(),markup:null};states.set(host,state);}
  for(const details of host.querySelectorAll?.('[data-maze-details]')||[])state.open.set(details.dataset.mazeDetails,details.open);
  const active=host.ownerDocument?.activeElement,focus=host.contains?.(active)?active?.closest?.('[data-maze-focus]')?.dataset.mazeFocus:null;
  const scroll=host.scrollTop||0,markup=mazeComparisonMarkup({...options,detailsOpen:state.open});
  if(state.markup===markup&&host.innerHTML.startsWith('<section class="maze-comparison"'))return false;
  host.innerHTML=markup;state.markup=markup;host.scrollTop=scroll;
  if(focus){const replacement=[...(host.querySelectorAll?.('[data-maze-focus]')||[])].find(node=>node.dataset.mazeFocus===focus&&!node.disabled)||host.querySelector?.('[data-maze="close"]');replacement?.focus?.({preventScroll:true});}
  return true;
}
