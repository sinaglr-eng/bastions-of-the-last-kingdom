import test from 'node:test';
import {PhaseUiState} from '../ui/phase-ui.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,combatTowerStats} from '../game/core/math.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {abilityLines,baseAttackDps,formatTowerNumber,defenderGuide} from '../ui/grimoire.js';
import {drawKeeperKey,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {selectedSupportMarkup} from '../ui/support-guide.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {icon} from '../ui/icons.js';
import {preparationEffects} from '../ui/preparation-folio.js';
import {PreparationRecipeNavigation} from '../ui/preparation-recipe-navigation.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snapshot=game=>JSON.stringify({data:game.data,towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,gold:game.economy.gold,cp:game.commandPoints.value,selection:game.selected,grid:[...game.grid.occupied]});
function candidates(family='druid',tier=1){const game=new Game(data,{seed:807});game.draft.roundForced={family,tier};for(let x=15;x<20;x++)assert.equal(game.place(x,17),true);game.select(game.towers[0].id);return game;}
const core=html=>{const start=html.indexOf('class="defender-core"');assert.ok(start>=0);return html.slice(start,html.indexOf('<section class="folio-recipes',start));};
const mainEffects=html=>[...(html.match(/<ul class="tower-effects defender-abilities[^"]*">([\s\S]*?)<\/ul>/)?.[1]||'').matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match=>match[1]);
const attr=(html,action,name)=>html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*${name}="([^"]+)"`))?.[1];

test('candidate folio keeps actual actions and puts all previewed effects after ranks and the single base grid',()=>{
  const game=candidates(),tower=game.selection,preview=new DefenderRankPreview(),images={'druid:1':'/actual-druid-I.png','druid:2':'/preview-druid-II.png'};
  assert.equal(preview.select(tower,2,data),true);const before=snapshot(game),html=defenderPanelMarkup(game,tower,{rankPreview:preview,images});
  const positions=['class="tower-name"','data-action="keep-draw"','data-action="merge"','class="defender-core"','class="rank-preview"','folio-metrics','folio-recipes','folio-effects'].map(key=>html.indexOf(key));
  assert.ok(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])));
  assert.match(html,/Actual rank I · Candidate/);assert.match(core(html),/Preview rank II · Actual rank I unchanged/);
  assert.match(html,/src="\/preview-druid-II\.png"/);assert.doesNotMatch(html.slice(0,html.indexOf('</header>')),/src="\/actual-druid-I\.png"/);assert.doesNotMatch(html,/rank-comparison-stats|data-detail-key="abilities"/);
  assert.equal((html.match(/Damage \/ hit/g)||[]).length,1);assert.equal((html.match(/class="tower-effects/g)||[]).length,1);
  assert.doesNotMatch(html,/data-detail-key="(?:recipes|ranks)"|<summary>(?:Potential combinations|Compare ranks)/);
  const expected=towerStats({...tower,tier:2},data);assert.match(core(html),new RegExp(`Damage / hit<\/span><strong>${formatTowerNumber(expected.damage)}<\/strong>`));
  assert.deepEqual(mainEffects(html),preparationEffects(expected).map(escape));assert.notDeepEqual(abilityLines(expected),abilityLines(towerStats(tower,data)));
  assert.equal(snapshot(game),before);
});

test('every basic rank and champion shows all engine-derived abilities once, with only Holy immunity copy condensed in the inspector',()=>{
  let profiles=0,longLists=0;const original=JSON.stringify(data);
  for(const [family,definition]of Object.entries(data.towers)){
    const game=new Game(data,{seed:807}),tower={id:999,family,tier:1,state:'active',priority:'first',mvpLevel:0,x:18,z:17};game.towers.push(tower);game.selected=tower.id;
    const preview=new DefenderRankPreview();
    for(const tier of definition.advanced?[1]:[1,2,3,4,5,6]){
      if(!definition.advanced)assert.equal(preview.select(tower,tier,data),true);
      const displayed={...tower,tier},stats=towerStats(displayed,data),expected=preparationEffects(stats).map(escape),html=defenderPanelMarkup(game,tower,{rankPreview:preview});profiles++;
      if(stats.type==='holy')expected[0]='Holy damage ignores immunities';
      if(expected.length>3)longLists++;
      assert.deepEqual(mainEffects(html),expected,`${family} rank ${tier} has a complete bottom ability list`);
      assert.equal((html.match(/class="tower-effects/g)||[]).length,1);assert.doesNotMatch(html,/data-detail-key="abilities"|rank-comparison-stats|concise-effects/);
      assert.ok(html.indexOf('folio-effects')>html.indexOf('folio-metrics'));assert.ok(html.indexOf('folio-metrics')<html.indexOf('folio-recipes'));
      assert.ok(html.indexOf('class="defender-core"')<html.indexOf('id="targeting"'));
      const actual=tier===tower.tier,effective=actual?combatTowerStats(tower,game.towers,data):{stats,bonuses:{haste:1}};
      assert.ok(core(html).includes(`Direct DPS</span><strong>${formatTowerNumber(baseAttackDps(effective.stats)*effective.bonuses.haste)}</strong>`));
      assert.ok(core(html).includes(`Range</span><strong>${formatTowerNumber(effective.stats.range)}</strong>`));
      assert.ok(core(html).includes(`Interval</span><strong>${formatTowerNumber(stats.interval/effective.bonuses.haste)}s</strong>`));
      assert.equal(tower.tier,1);if(definition.advanced)assert.doesNotMatch(html,/data-detail-key="ranks"|data-action="preview-rank"/);
    }
  }
  assert.ok(profiles>48);assert.ok(longLists>0,'At least one actual champion has more than three abilities');assert.equal(JSON.stringify(data),original);
});

test('previewing VI leaves actual rank I Keep/Merge keys, legal result and stale-command guards intact without consuming RNG',()=>{
  const game=candidates(),control=candidates(),tower=game.selection,preview=new DefenderRankPreview(),before=snapshot(game),keeperKey=drawKeeperKey(game,0),mergeKey=mergeTowerKey(game,tower.id);
  preview.select(tower,6,data);const html=defenderPanelMarkup(game,tower,{rankPreview:preview});
  assert.equal(attr(html,'keep-draw','data-keeper-key'),keeperKey);assert.equal(attr(html,'merge','data-merge-key'),mergeKey);assert.match(html,/Merge to rank II/);assert.doesNotMatch(html,/data-action="downgrade"/);
  assert.equal(snapshot(game),before);assert.equal(game.rng(),control.rng());
  assert.equal(mergeTowerFromBadge(game,tower.id,mergeKey),true);assert.equal(tower.tier,2);assert.equal(tower.state,'active');assert.equal(preview.view(tower,data).tier,2);
  const completed=snapshot(game);assert.equal(mergeTowerFromBadge(game,tower.id,mergeKey),false);assert.equal(keepDrawKeeper(game,0,tower.id,keeperKey),false);assert.equal(snapshot(game),completed);
  const mergedCore=core(defenderPanelMarkup(game,tower,{rankPreview:preview}));assert.match(mergedCore,/data-displayed-rank="2"/);assert.doesNotMatch(mergedCore,/<strong>Preview rank VI/);
  const keepGame=candidates('mage',4),actual=keepGame.selection,keepPreview=new DefenderRankPreview();keepPreview.select(actual,1,data);
  const actualKey=drawKeeperKey(keepGame,0),keepHtml=defenderPanelMarkup(keepGame,actual,{rankPreview:keepPreview});assert.equal(attr(keepHtml,'keep-draw','data-keeper-key'),actualKey);
  assert.equal(keepDrawKeeper(keepGame,0,actual.id,actualKey),true);assert.equal(actual.tier,4);assert.equal(actual.state,'active');
});

test('targeting, current support, measured peak and MVP belong to the actual unit after previewing another rank',()=>{
  const game=candidates(),tower=game.selection;game.keep();game.mvp.setLevel(tower,7);tower.priority='last';tower.attackPaused=true;
  const preview=new DefenderRankPreview();preview.select(tower,2,data);const before=snapshot(game),html=defenderPanelMarkup(game,tower,{rankPreview:preview,peak:{dps:123}});
  assert.match(html,/<option value="last" selected>Last/);assert.match(html,/data-action="tower-pause" aria-pressed="true"/);assert.match(html,/MVP Level: 7 \/ 10/);
  assert.ok(html.includes(mvpDetailsMarkup(tower).replace(/<button[\s\S]*?<\/button>/,'')));assert.ok(html.includes(selectedSupportMarkup(tower,game.towers,data,{combat:game.combat,phase:game.phase})));
  assert.match(html,/Measured peak · Actual rank I · 123 DPS/);assert.ok(html.indexOf('class="defender-core"')<html.indexOf('id="targeting"'));assert.ok(html.indexOf('class="mvp-details"')<html.indexOf('class="selected-support"'));assert.ok(html.indexOf('class="selected-support"')<html.indexOf('class="defender-core"'));assert.doesNotMatch(html,/data-detail-key="mvp"|<summary>MVP/);
  assert.equal(snapshot(game),before);
  game.phase='lost';const ended=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(ended,/Read-only defender inspection/);assert.doesNotMatch(ended,/data-action="(?:keep-draw|merge|downgrade|tower-pause)"|id="targeting"/);
});

test('reserved units keep their existing inactive explanatory pane and never acquire preview actions or stats',()=>{
  const game=candidates(),tower=game.selection;assert.equal(game.reserve(),true);const preview=new DefenderRankPreview();preview.select(tower,6,data);
  const html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,/Actual rank I · Reserved · Inactive wall/);assert.match(html,/Fixed foundation/);
  assert.doesNotMatch(html,/defender-core|data-action="(?:preview-rank|keep-draw|merge|downgrade)"/);assert.equal(tower.tier,1);
});

function sidebarHost(){
  const document={activeElement:null};
  class Element{
    constructor(tag='div',attributes={}){this.tag=tag;this.attributes=attributes;this.id=attributes.id||'';this.className=attributes.class||'';this.dataset=Object.fromEntries(Object.entries(attributes).filter(([key])=>key.startsWith('data-')).map(([key,value])=>[key.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));this.children=[];this.parentNode=null;this.open=Object.hasOwn(attributes,'open');this.disabled=Object.hasOwn(attributes,'disabled');this.scrollTop=0;}
    matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));const a=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);return a?Object.hasOwn(this.attributes,a[1])&&(a[2]===undefined||this.attributes[a[1]]===a[2]):this.tag===selector;}
    contains(node){for(let p=node;p;p=p.parentNode)if(p===this)return true;return false;}
    querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    addEventListener(){}
    focus(){document.activeElement=this;}
    get innerHTML(){return this.html||'';}
    set innerHTML(html){this.html=html;this.children=[];this.scrollTop=0;const stack=[this];for(const token of html.match(/<[^>]+>/g)||[]){if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;const attrs={};for(const a of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:="([^"]*)")?/g))attrs[a[1]]=a[2]??'';const child=new Element(tag,attrs),parent=stack.at(-1);child.parentNode=parent;parent.children.push(child);if(!['img','input','br','hr','path','circle'].includes(tag)&&!token.endsWith('/>'))stack.push(child);}}
  }
  const body=new Element(),top=new Element();document.getElementById=id=>body.querySelector('#'+id);return {body,top,document};
}

test('actual sidebar refresh keeps permanent MVP/potential/ranks visible and preserves rank-button focus and scroll after switching the main stats',()=>{
  const game=candidates(),tower=game.selection;game.keep();const rankPreview=new DefenderRankPreview(),{body,top,document}=sidebarHost(),main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
  const source=name=>{const start=main.indexOf('function '+name+'(');assert.ok(start>=0);const end=main.indexOf('\nfunction ',start+1);return main.slice(start,end);};
  const context={phaseUi:new PhaseUiState(),game,rankPreview,preparationNavigation:new PreparationRecipeNavigation(),folioRecipeId:null,folioRecipeSelection:null,folioLayout:{restoreParts(){}},syncFolio:()=>{},images:{},data,$:id=>id==='side-body'?body:id==='side-top'?top:body.querySelector('#'+id),document,icon,defenderPanelMarkup,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),panelDetails:new Map(),endedPhase:phase=>['won','lost'].includes(phase),stampCraftButtons:()=>{}};
  const render=runInNewContext(source('towerPanel')+'\n'+source('renderSidebar')+'\nrenderSidebar',context);render();
  assert.equal(body.querySelector('.mvp-details').tag,'section');assert.equal(body.querySelector('[data-detail-key="mvp"]'),null);
  for(const selector of ['.potential-combinations','.rank-preview'])assert.ok(body.querySelector(selector));
  for(const key of ['recipes','ranks'])assert.equal(body.querySelector(`[data-detail-key="${key}"]`),null);
  body.scrollTop=174;body.querySelector('[data-tier="2"]').focus();rankPreview.select(tower,2,data);render();
  assert.equal(body.querySelector('.mvp-details').tag,'section');assert.equal(body.querySelector('[data-detail-key="mvp"]'),null);
  for(const selector of ['.potential-combinations','.rank-preview']){const section=body.querySelector(selector);assert.ok(section);assert.equal(section.tag,'section');assert.equal(section.parentNode.tag==='details',false);}
  assert.equal(body.scrollTop,174);assert.equal(document.activeElement,body.querySelector('[data-tier="2"]'));assert.match(core(body.innerHTML),/Preview rank II · Actual rank I unchanged/);
  assert.ok(body.innerHTML.indexOf('folio-effects')>body.innerHTML.indexOf('class="rank-preview"'));assert.ok(body.innerHTML.indexOf('class="rank-preview"')<body.innerHTML.indexOf('folio-metrics'));assert.ok(body.innerHTML.indexOf('folio-metrics')<body.innerHTML.indexOf('folio-recipes'));
});

const displayedBuiltCount=html=>Number(html.match(/class="defender-built-count">(\d+) built at rank /)?.[1]);
function placeRound(game,family,tier=1){game.draft.roundForced={family,tier};for(let x=3;x<8;x++)assert.equal(game.place(x,2+game.round),true);game.select(game.roundCandidates[0].tower.id);}
function nextRound(game){assert.equal(game.startCombat(),true);game.completeWave();}

test('header counts only kept defenders at the viewed family and rank, excluding candidate/reserve/wall stock',()=>{
  const game=new Game(data,{seed:807}),control=new Game(data,{seed:807});
  for(const current of [game,control]){
    placeRound(current,'mage',1);assert.equal(current.keep(),true);nextRound(current);
    placeRound(current,'mage',4);assert.equal(current.keep(),true);nextRound(current);
    current.draft.roundForced={family:'mage',tier:5};assert.equal(current.place(3,2+current.round),true);
  }
  const first=game.towers.find(t=>t.state==='active'),candidate=game.roundCandidates[0].tower,preview=new DefenderRankPreview();
  first.attackPaused=true;assert.equal(preview.select(candidate,6,data),true);
  let before=snapshot(game),html=defenderPanelMarkup(game,candidate,{rankPreview:preview});
  assert.equal(displayedBuiltCount(html),0);assert.match(html,/0 built at rank VI/);assert.match(html,/Actual rank V · Candidate/);assert.equal(game.draft.draws.filter(draw=>!draw.placed).length,4);assert.equal(snapshot(game),before);
  preview.select(first,6,data);html=defenderPanelMarkup(game,first,{rankPreview:preview});assert.equal(displayedBuiltCount(html),0);assert.match(html,/0 built at rank VI/);assert.match(html,/Preview rank VI · Actual rank I unchanged/);
  const rankIV=game.towers.find(t=>t.state==='active'&&t.tier===4);preview.select(rankIV,1,data);html=defenderPanelMarkup(game,rankIV,{rankPreview:preview});assert.equal(displayedBuiltCount(html),1);assert.match(html,/1 built at rank I/);assert.equal(snapshot(game),before);
  for(const current of [game,control]){for(let x=4;x<8;x++)assert.equal(current.place(x,2+current.round),true);current.select(current.roundCandidates[0].tower.id);assert.equal(current.reserve(),true);}
  before=snapshot(game);html=defenderPanelMarkup(game,candidate,{rankPreview:preview});assert.equal(displayedBuiltCount(html),0);assert.match(html,/Reserved · Inactive wall/);assert.equal(snapshot(game),before);
  assert.equal(game.towers.filter(t=>t.family==='mage'&&t.state==='active').length,2);assert.ok(game.towers.some(t=>t.family==='mage'&&t.state==='ruin'));assert.equal(game.rng(),control.rng());
});

test('header counts each advanced family independently and reflects a real keep transition without counting its draft peers',()=>{
  const game=new Game(data,{seed:807});
  placeRound(game,'frostblade');assert.equal(displayedBuiltCount(defenderPanelMarkup(game,game.selection)),0);assert.equal(game.keep(),true);nextRound(game);
  placeRound(game,'frostblade');const candidate=game.selection;assert.equal(displayedBuiltCount(defenderPanelMarkup(game,candidate)),1);assert.equal(game.keep(),true);
  assert.equal(displayedBuiltCount(defenderPanelMarkup(game,candidate)),2);nextRound(game);
  placeRound(game,'archangel');assert.equal(game.keep(),true);const before=snapshot(game),html=defenderPanelMarkup(game,candidate);
  assert.equal(displayedBuiltCount(html),2);assert.equal(displayedBuiltCount(defenderPanelMarkup(game,game.selection)),1);assert.equal(snapshot(game),before);
});

test('ended rank planning remains visible and read-only; walls and reserved defenders do not gain planning controls',()=>{
  const game=candidates(),tower=game.selection;assert.equal(game.keep(),true);const preview=new DefenderRankPreview();preview.select(tower,4,data);
  for(const phase of ['won','lost']){game.phase=phase;const before=snapshot(game),html=defenderPanelMarkup(game,tower,{rankPreview:preview});assert.match(html,/class="folio-recipes potential-combinations"/);assert.equal((html.match(/data-action="preview-rank"/g)||[]).length,6);assert.match(html,/Preview rank IV · Actual rank I unchanged/);assert.equal(displayedBuiltCount(html),0);assert.doesNotMatch(html,/data-detail-key="(?:recipes|ranks)"|data-action="(?:keep-draw|merge|downgrade|tower-pause)"|id="targeting"/);assert.equal(snapshot(game),before);}
  const wall=game.towers.find(t=>t.state==='ruin');const html=defenderPanelMarkup(game,wall,{rankPreview:preview});assert.doesNotMatch(html,/defender-built-count|potential-combinations|rank-preview/);
});

test('Holy inspector uses the requested short sentence while shared ability/help text retains companion immunity and defense semantics',()=>{
  const game=candidates('winterhold'),tower=game.selection,stats=towerStats(tower,data),before=snapshot(game),html=defenderPanelMarkup(game,tower);
  assert.equal(stats.type,'holy');assert.equal(mainEffects(html)[0],'Holy damage ignores immunities');assert.deepEqual(mainEffects(html).slice(1),abilityLines(stats).slice(1).map(escape));assert.equal(snapshot(game),before);
  assert.match(abilityLines(stats)[0],/companion slows\/freezes respect Physical immunity.*poison\/burning\/healing block respect Magical immunity.*armor, evasion, shields and shells still apply/);
  const help=defenderGuide(data,{});assert.match(help,/Only Holy damage ignores these immunities; companion effects retain their normal immunity categories/);assert.match(help,/Evasion, shields and direct-hit shells still apply/);
});
