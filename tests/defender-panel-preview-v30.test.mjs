import test from 'node:test';
import {PhaseUiState} from '../ui/phase-ui.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {defenderPanelMarkup} from '../ui/defender-panel.js';
import {DefenderRankPreview} from '../ui/defender-rank-preview.js';
import {abilityLines,baseAttackDps,formatTowerNumber} from '../ui/grimoire.js';
import {drawKeeperKey,keepDrawKeeper,mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {selectedSupportMarkup} from '../ui/support-guide.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {icon} from '../ui/icons.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const snapshot=game=>JSON.stringify({data:game.data,towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,gold:game.economy.gold,cp:game.commandPoints.value,selection:game.selected,grid:[...game.grid.occupied]});
function candidates(family='druid',tier=1){const game=new Game(data,{seed:807});game.draft.roundForced={family,tier};for(let x=15;x<20;x++)assert.equal(game.place(x,17),true);game.select(game.towers[0].id);return game;}
const core=html=>{const start=html.indexOf('class="defender-core"');assert.ok(start>=0);return html.slice(start,html.indexOf('</ul>',start)+5);};
const mainEffects=html=>[...core(html).matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match=>match[1]);
const attr=(html,action,name)=>html.match(new RegExp(`<button[^>]*data-action="${action}"[^>]*${name}="([^"]+)"`))?.[1];

test('candidate hierarchy puts legal actual actions, potential combinations and rank comparison before the single previewed core',()=>{
  const game=candidates(),tower=game.selection,preview=new DefenderRankPreview(),images={'druid:1':'/actual-druid-I.png','druid:2':'/preview-druid-II.png'};
  assert.equal(preview.select(tower,2,data),true);const before=snapshot(game),html=defenderPanelMarkup(game,tower,{rankPreview:preview,images});
  const positions=['class="tower-name"','data-action="keep-draw"','data-action="merge"','data-detail-key="recipes"','data-detail-key="ranks"','class="defender-core"'].map(key=>html.indexOf(key));
  assert.ok(positions.every((position,index)=>position>=0&&(index===0||position>positions[index-1])));
  assert.match(html,/Actual rank I · Candidate/);assert.match(core(html),/Preview rank II · Actual rank I unchanged/);
  assert.match(html,/src="\/actual-druid-I\.png"/);assert.doesNotMatch(html,/src="\/preview-druid-II\.png"|rank-comparison-stats|data-detail-key="abilities"/);
  assert.equal((html.match(/Damage \/ hit/g)||[]).length,1);assert.equal((html.match(/class="tower-effects/g)||[]).length,1);
  const expected=towerStats({...tower,tier:2},data);assert.match(core(html),new RegExp(`Damage / hit<\/span><strong>${formatTowerNumber(expected.damage)}<\/strong>`));
  assert.deepEqual(mainEffects(html),abilityLines(expected).map(escape));assert.notDeepEqual(abilityLines(expected),abilityLines(towerStats(tower,data)));
  assert.equal(snapshot(game),before);
});

test('every basic rank and champion shows every engine-derived ability exactly once in the upper core, including fourth and later abilities',()=>{
  let profiles=0,longLists=0;const original=JSON.stringify(data);
  for(const [family,definition]of Object.entries(data.towers)){
    const game=new Game(data,{seed:807}),tower={id:999,family,tier:1,state:'active',priority:'first',mvpLevel:0,x:18,z:17};game.towers.push(tower);game.selected=tower.id;
    const preview=new DefenderRankPreview();
    for(const tier of definition.advanced?[1]:[1,2,3,4,5,6]){
      if(!definition.advanced)assert.equal(preview.select(tower,tier,data),true);
      const displayed={...tower,tier},stats=towerStats(displayed,data),expected=abilityLines(stats).map(escape),html=defenderPanelMarkup(game,tower,{rankPreview:preview});profiles++;
      if(expected.length>3)longLists++;
      assert.deepEqual(mainEffects(html),expected,`${family} rank ${tier} has a complete upper ability list`);
      assert.equal((html.match(/class="tower-effects/g)||[]).length,1);assert.doesNotMatch(html,/data-detail-key="abilities"|rank-comparison-stats|concise-effects/);
      assert.ok(html.indexOf('data-detail-key="recipes"')<html.indexOf('class="defender-core"'));
      assert.ok(html.indexOf('class="defender-core"')<html.indexOf('id="targeting"'));
      assert.ok(core(html).includes(`Direct DPS</span><strong>${formatTowerNumber(baseAttackDps(stats))}</strong>`));
      assert.ok(core(html).includes(`Range</span><strong>${formatTowerNumber(stats.range)}</strong>`));
      assert.ok(core(html).includes(`Interval</span><strong>${formatTowerNumber(stats.interval)}s</strong>`));
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
  assert.doesNotMatch(core(defenderPanelMarkup(game,tower,{rankPreview:preview})),/Preview rank VI/);
  const keepGame=candidates('mage',4),actual=keepGame.selection,keepPreview=new DefenderRankPreview();keepPreview.select(actual,1,data);
  const actualKey=drawKeeperKey(keepGame,0),keepHtml=defenderPanelMarkup(keepGame,actual,{rankPreview:keepPreview});assert.equal(attr(keepHtml,'keep-draw','data-keeper-key'),actualKey);
  assert.equal(keepDrawKeeper(keepGame,0,actual.id,actualKey),true);assert.equal(actual.tier,4);assert.equal(actual.state,'active');
});

test('targeting, current support, measured peak and MVP belong to the actual unit after previewing another rank',()=>{
  const game=candidates(),tower=game.selection;game.keep();game.mvp.setLevel(tower,7);tower.priority='last';tower.attackPaused=true;
  const preview=new DefenderRankPreview();preview.select(tower,2,data);const before=snapshot(game),html=defenderPanelMarkup(game,tower,{rankPreview:preview,peak:{dps:123}});
  assert.match(html,/<option value="last" selected>Last/);assert.match(html,/data-action="tower-pause" aria-pressed="true"/);assert.match(html,/MVP Level: 7 \/ 10/);
  assert.ok(html.includes(mvpDetailsMarkup(tower).replace(/<button[\s\S]*?<\/button>/,'')));assert.ok(html.includes(selectedSupportMarkup(tower,game.towers,data,{combat:game.combat,phase:game.phase})));
  assert.match(html,/Measured peak · Actual rank I · 123 DPS/);assert.ok(html.indexOf('class="defender-core"')<html.indexOf('id="targeting"'));assert.ok(html.indexOf('id="targeting"')<html.indexOf('data-detail-key="mvp"'));
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

test('actual sidebar refresh preserves recipes/ranks/MVP disclosure keys, rank-button focus and scroll after switching the main stats',()=>{
  const game=candidates(),tower=game.selection;game.keep();const rankPreview=new DefenderRankPreview(),{body,top,document}=sidebarHost(),main=readFileSync(new URL('../game/main.js',import.meta.url),'utf8');
  const source=name=>{const start=main.indexOf('function '+name+'(');assert.ok(start>=0);const end=main.indexOf('\nfunction ',start+1);return main.slice(start,end);};
  const context={phaseUi:new PhaseUiState(),game,rankPreview,images:{},data,$:id=>id==='side-body'?body:id==='side-top'?top:body.querySelector('#'+id),document,icon,defenderPanelMarkup,dpsMeasurement:new DpsMeasurement(),dpsTracker:new TowerDpsTracker(),panelDetails:new Map(),endedPhase:phase=>['won','lost'].includes(phase),stampCraftButtons:()=>{}};
  const render=runInNewContext(source('towerPanel')+'\n'+source('renderSidebar')+'\nrenderSidebar',context);render();
  for(const key of ['recipes','ranks','mvp'])body.querySelector(`[data-detail-key="${key}"]`).open=true;
  body.scrollTop=174;body.querySelector('[data-tier="2"]').focus();rankPreview.select(tower,2,data);render();
  for(const key of ['recipes','ranks','mvp'])assert.equal(body.querySelector(`[data-detail-key="${key}"]`).open,true);
  assert.equal(body.scrollTop,174);assert.equal(document.activeElement,body.querySelector('[data-tier="2"]'));assert.match(core(body.innerHTML),/Preview rank II · Actual rank I unchanged/);
  assert.ok(body.innerHTML.indexOf('data-detail-key="recipes"')<body.innerHTML.indexOf('data-detail-key="ranks"'));assert.ok(body.innerHTML.indexOf('data-detail-key="ranks"')<body.innerHTML.indexOf('class="defender-core"'));
});
