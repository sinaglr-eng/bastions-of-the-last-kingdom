import {DEVELOPER_STATISTICS_NOTICE} from '../game/core/developer-console.js';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const numeric=(name,label,value,{min=0,max=1e9,step=1}={})=>`<label>${label}<input type="number" name="${name}" value="${escape(value)}" min="${min}" max="${max}" step="${step}" required></label>`;
const form=(command,heading,fields,button,{sandbox=false}={})=>`<form data-console-command="${command}"${sandbox?' data-sandbox-only="true"':''}><h3>${heading}</h3><div class="developer-fields">${fields}</div><button type="submit" class="secondary-button">${button}</button></form>`;
const familyOptions=data=>Object.entries(data.towers).map(([id,stats])=>`<option value="${escape(id)}">${escape(stats.name)}${stats.advanced?' · Champion':''}</option>`).join('');
const enemyOptions=data=>Object.entries(data.enemies).map(([id,stats])=>`<option value="${escape(id)}">${escape(stats.name||id)}</option>`).join('');
const option=(value,label,current)=>`<option value="${escape(value)}"${String(value)===String(current)?' selected':''}>${escape(label)}</option>`;
const idSelect=(name,label)=>`<label>${label}<select name="${name}" data-console-defenders></select></label>`;
const variants=group=>`<label>Variant · Sandbox only<select name="variant" data-sandbox-control><option value="random">Random per invader</option>${Array.from({length:Math.max(0,...group.map(row=>row.variants.length))},(_,index)=>`<option value="${index}">Variant ${index+1}</option>`).join('')}</select></label>`;

export function developerConsoleMarkup(session){
  const game=session.game,data=game.data;
  return `<section class="developer-console" aria-label="Developer Console"><p class="developer-notice">${DEVELOPER_STATISTICS_NOTICE}</p><p class="developer-scope">Activation excludes this entire run permanently. Closing or resetting the console does not restore statistics. Only a new normal game can record results.</p><p data-console-status role="status" aria-live="polite">${session.ready?'Ready for testing.':'Disabling statistics…'}</p><div class="developer-live" data-console-live></div>
  ${form('reset','Test mode',`<label>Mode<select name="mode">${option('campaign','Campaign Test · approved rules and normal progression',session.mode)}${option('sandbox','Sandbox · custom lineup and wave',session.mode)}</select></label>${numeric('seed','Repeatable seed',game.seed>>>0,{max:0xffffffff})}`,'Reset test')}
  <p class="developer-mode-note">Campaign Test starts at wave 1 with normal costs, recipes and resources. Sandbox permits interventions; a Sandbox victory is not a campaign completion.</p>
  <div class="developer-grid">
  ${form('run-wave','Wave',numeric('wave','Wave',game.round,{min:1,max:session.waveLimit})+variants(session.variantsForWave(game.round)),'Run wave')}
  ${form('simulation','Simulation',`<label>State<select name="paused">${option('false','Running',!!game.paused)}${option('true','Paused',!!game.paused)}</select></label><label>Speed<select name="speed">${[1,2,3].map(speed=>option(speed,`${speed}×`,game.speed)).join('')}</select></label>`,'Apply simulation')}
  ${form('add-defender','Free Sandbox placement',`<label>Defender<select name="family">${familyOptions(data)}</select></label>${numeric('tier','Rank (champions use I)',1,{min:1,max:6})}${numeric('x','Tile X · 0–36',18,{max:36})}${numeric('z','Tile Z · 0–36',17,{max:36})}${numeric('mvpLevel','MVP level',0,{max:10})}`,'Add defender',{sandbox:true})}
  ${form('defender','Existing defender',idSelect('id','Defender')+numeric('mvpLevel','MVP level',0,{max:10})+`<label>Attacks<select name="attackPaused"><option value="false">Running</option><option value="true">Paused · support auras stay active</option></select></label>`,'Apply defender',{sandbox:true})}
  ${form('remove-defender','Remove from test lineup',idSelect('id','Defender'),'Remove defender',{sandbox:true})}
  ${form('resources','Sandbox resources',numeric('gold','Gold',game.economy.gold)+numeric('lives','Keep health',game.lives,{min:1,max:1000000})+numeric('cp','CP',game.commandPoints.value,{max:1000000}),'Apply resources',{sandbox:true})}
  ${form('spawn','Additional invader',`<label>Enemy / boss<select name="type">${enemyOptions(data)}</select></label><label>Variant<select name="variant"><option value="random">Random</option><option value="0">Variant 1</option><option value="1">Variant 2</option><option value="2">Variant 3</option></select></label>`,'Spawn in running wave',{sandbox:true})}
  ${form('enemy-rules','Temporary enemy profile',`<label>Enemy / boss<select name="type">${enemyOptions(data)}</select></label><label>Field<select name="field"><option value="armor">Armor</option><option value="krakenShell">Shell · damage blocked</option><option value="regen">Regeneration · max HP fraction / second</option><option value="recharge">Recharge · missing HP fraction</option><option value="untouchable">Dread · attack penalty fraction</option><option value="evasion">Evasion · chance fraction</option><option value="reactiveArmor">Reactive armor / hit</option><option value="blink">Blink · tiles</option><option value="rush">Blood rush · speed multiplier</option></select></label>${numeric('value','Value (0.1 = 10%)',0,{max:1e7,step:.001})}`,'Apply profile',{sandbox:true})}
  ${form('timing-rules','Temporary timing',`<label>Rule<select name="rule"><option value="refraction.period">Refraction interval</option><option value="recharge.period">Recharge interval</option><option value="blink.period">Blink interval</option><option value="disarm.duration">Disarm duration</option><option value="disarm.period">Disarm interval</option><option value="reactive.maxStacks">Reactive maximum stacks</option><option value="reactive.decayPerSecond">Reactive stack decay / second</option><option value="rush.duration">Blood rush duration</option><option value="rush.period">Blood rush interval</option></select></label>${numeric('value','Game seconds / stacks',5,{max:120,step:.1})}`,'Apply timing',{sandbox:true})}
  </div><div class="developer-tools"><button type="button" data-console-action="restart" data-sandbox-only="true" class="secondary-button">Restart wave from its saved start</button><button type="button" data-console-action="restore" data-sandbox-only="true" class="text-button">Restore approved rules</button></div>
  <details class="developer-setups"><summary>Save / load test setup</summary><p>Lineup, seed, enemy settings and resources. Test setups stay separate from normal profiles and statistics.</p><textarea data-console-setup aria-label="Test setup JSON" spellcheck="false"></textarea><div class="developer-tools"><button type="button" data-console-action="export" class="text-button">Show setup JSON</button><button type="button" data-console-action="import" data-sandbox-only="true" class="text-button">Import JSON</button><button type="button" data-console-action="save" class="text-button">Save on this device</button><button type="button" data-console-action="load" data-sandbox-only="true" class="text-button">Load saved setup</button></div></details>
  <details open><summary>Test results and current lineup</summary><div data-console-results></div></details><details><summary>Actual hit breakdown · latest 40 attempts</summary><p>Before defense → armor → Shell → applied damage → HP removed. Blocked hits include their actual reason. Overkill is excluded from contribution.</p><div data-console-traces></div></details><details><summary>Test interventions</summary><div data-console-log></div></details></section>`;
}

const table=(head,rows)=>`<div class="developer-table"><table><thead><tr>${head.map(cell=>`<th scope="col">${escape(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const format=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:2}):'—';
const storage=()=>{try{return globalThis.localStorage;}catch{return null;}};
const updateHTML=(node,html)=>{
  if(node.innerHTML===html)return;
  const scroll=[...node.querySelectorAll('.developer-table')].map(table=>({top:table.scrollTop,left:table.scrollLeft}));node.innerHTML=html;
  [...node.querySelectorAll('.developer-table')].forEach((table,index)=>{if(scroll[index]){table.scrollTop=scroll[index].top;table.scrollLeft=scroll[index].left;}});
};
export function connectDeveloperConsole(host,session,{onMutation=()=>{},onRun=()=>{},store=storage()}={}){
  const root=host.querySelector('.developer-console')||host,status=root.querySelector('[data-console-status]'),setup=root.querySelector('[data-console-setup]');let disposed=false,busy=false,unsubscribe=null,observedGame=null,queued=false;
  const notify=text=>{if(!disposed&&status)status.textContent=text;};
  const refresh=()=>{
    if(disposed)return;const game=session.game,snapshot=session.snapshot();
    if(observedGame!==game){unsubscribe?.();observedGame=game;unsubscribe=game.on(type=>{if(['hit','damage-trace','wave','reward','won','lost','change'].includes(type)&&!queued){queued=true;queueMicrotask(()=>{queued=false;refresh();});}});
      const waveInput=root.querySelector('[data-console-command="run-wave"] [name="wave"]');if(waveInput){waveInput.value=game.round;waveInput.max=session.waveLimit;}
      for(const [selector,value]of [
        ['[data-console-command="reset"] [name="mode"]',session.mode],
        ['[data-console-command="reset"] [name="seed"]',game.seed>>>0],
        ['[data-console-command="simulation"] [name="paused"]',String(!!game.paused)],
        ['[data-console-command="simulation"] [name="speed"]',String(game.speed)],
      ]){const control=root.querySelector(selector);if(control)control.value=value;}
    }
    root.querySelector('[data-console-live]').textContent=`${snapshot.mode==='campaign'?'Campaign Test':'Sandbox'} · Wave ${snapshot.wave} · ${snapshot.phase} · Keep ${snapshot.health} · ${snapshot.paused?'Paused':`${snapshot.speed}× speed`}`;
    const lineup=game.towers.filter(t=>t.state==='active');
    for(const select of root.querySelectorAll('[data-console-defenders]')){const value=select.value,html=lineup.map(t=>`<option value="${t.id}">#${t.id} · ${escape(game.data.towers[t.family]?.name||t.family)} · Rank ${t.tier} · MVP ${t.mvpLevel||0}</option>`).join('');if(select.innerHTML!==html){select.innerHTML=html;select.value=lineup.some(t=>String(t.id)===value)?value:select.options[0]?.value||'';}}
    for(const node of root.querySelectorAll('[data-sandbox-only]'))for(const control of node.matches('button')?[node]:node.querySelectorAll('button,input,select'))control.disabled=snapshot.mode!=='sandbox'||!snapshot.ready;
    for(const control of root.querySelectorAll('[data-sandbox-control]'))control.disabled=snapshot.mode!=='sandbox'||!snapshot.ready;
    const results=root.querySelector('[data-console-results]');updateHTML(results,`<p>${snapshot.results.filter(row=>row.completed).length} completed test waves · ${game.leaks} total leaks · Keep health ${game.lives}</p>${table(['Defender','Rank','MVP','Attacks'],lineup.map(t=>[game.data.towers[t.family]?.name||t.family,t.tier,t.mvpLevel||0,t.attackPaused?'Paused':'Running']))}${table(['Mode','Wave','Result','Leaks','Health','HP removed'],snapshot.results.map(row=>[row.mode,row.wave,row.completed?'Survived':'Lost',row.leaks,row.health,format(row.damage.reduce((sum,t)=>sum+t.damage,0))]))}${table(['Wave','Defender','HP removed','MVP'],snapshot.results.flatMap(row=>row.damage.map(t=>[row.wave,game.data.towers[t.family]?.name||t.family,format(t.damage),t.mvpLevel])))}`);
    const traces=root.querySelector('[data-console-traces]');updateHTML(traces,table(['Defender','Enemy','Type','Before defense','Armor','After armor','Shell','Applied','HP removed','Blocked'],snapshot.traces.slice().reverse().map(t=>[t.sourceId??'—',t.enemyType??'—',t.type,format(t.beforeDefense),format(t.effectiveArmor),format(t.afterArmor),format(t.shellBlock),format(t.appliedDamage),format(t.effectiveDamage),t.blockReason||'—'])));
    updateHTML(root.querySelector('[data-console-log]'),table(['Action','Details'],snapshot.log.slice().reverse().map(row=>[row.action,JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='time'&&key!=='action')))])));
  };
  const mutate=async(action,values={})=>{
    if(busy||disposed)return;busy=true;
    try{
      switch(action){
        case'reset':await session.resetTest(values);break;
        case'run-wave':if(session.mode==='sandbox')session.setVariant(values.variant);session.runWave(values.wave);onRun();break;
        case'simulation':session.setPaused(values.paused==='true');session.setSpeed(values.speed);break;
        case'add-defender':session.addDefender(values);break;
        case'defender':session.setMvp(values.id,values.mvpLevel);session.setAttackPaused(values.id,values.attackPaused==='true');break;
        case'remove-defender':session.removeDefender(values.id);break;
        case'resources':session.setResources(values);break;
        case'spawn':session.spawnEnemy(values.type,values.variant);break;
        case'enemy-rules':session.setEnemyRules(values.type,{[values.field]:values.value});break;
        case'timing-rules':{const [group,field]=values.rule.split('.');session.setTimingRules(group,{[field]:values.value});break;}
        case'restart':session.restartWave();onRun();break;
        case'restore':session.restoreRules();break;
        case'export':setup.value=JSON.stringify(session.exportSetup(),null,2);break;
        case'import':session.importSetup(setup.value);break;
        case'save':if(!store?.setItem)throw new Error('Device storage is unavailable. Use setup JSON instead.');store.setItem('bastions.developer.setup.v1',JSON.stringify(session.exportSetup()));break;
        case'load':{const saved=store?.getItem('bastions.developer.setup.v1');if(!saved)throw new Error('No test setup is saved on this device.');session.importSetup(saved);break;}
        default:throw new Error('Unknown console command.');
      }
      if(!disposed){onMutation(action);refresh();notify('Test command applied. Statistics remain disabled.');}
    }catch(error){notify(error.message);}finally{busy=false;}
  };
  const submit=event=>{const form=event.target.closest?.('[data-console-command]');if(!form)return;event.preventDefault();void mutate(form.dataset.consoleCommand,Object.fromEntries(new FormData(form)));};
  const click=event=>{const button=event.target.closest?.('[data-console-action]');if(!button||button.disabled)return;void mutate(button.dataset.consoleAction);};
  const change=event=>{const form=event.target.closest?.('[data-console-command="run-wave"]');if(form&&event.target.name==='wave'){const select=form.querySelector('[name="variant"]');const current=select.value,html=variants(session.variantsForWave(Number(event.target.value)));const wrapper=host.ownerDocument.createElement('div');wrapper.innerHTML=html;select.innerHTML=wrapper.querySelector('select').innerHTML;if([...select.options].some(option=>option.value===current))select.value=current;}};
  root.addEventListener('submit',submit);root.addEventListener('click',click);root.addEventListener('change',change);refresh();
  return {refresh,dispose(){disposed=true;unsubscribe?.();root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.removeEventListener('change',change);}};
}
