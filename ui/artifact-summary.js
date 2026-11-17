import {artifactModifierText,usesArtifactRulesV3} from '../game/core/artifacts.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const percentKeys=new Set(['damage','bossDamage','speed','controlResistance','immunityReduction']);
const labels={damage:'Own damage',bossDamage:'Damage vs bosses',speed:'Attack speed',rangeTiles:'Attack range',gold:'Starting gold',cp:'Starting CP',keepHealth:'Starting / max health',controlResistance:'Disarm / Dread resistance',immunityReduction:'Damage through immunity'};
const number=(key,value)=>`${value>0?'+':value<0?'−':''}${Number((Math.abs(value)*(percentKeys.has(key)?100:1)).toFixed(3)).toLocaleString('en-US')}${percentKeys.has(key)?'%':key==='rangeTiles'?' tiles':''}`;

export function artifactConditionsMarkup(summary){
 return summary.diagnostics?.length?`<ul class="artifact-condition-list" aria-label="Artifact activation conditions">${summary.diagnostics.map(row=>`<li class="is-${row.state}"><b>${row.state==='inactive'?'Inactive':'Conditional'}</b> ${esc(row.message)}</li>`).join('')}</ul>`:'';
}

export function artifactBreakdownMarkup(summary){
 const b=summary.breakdown;if(!b)return '';
 const modern=usesArtifactRulesV3(summary.version),rows=[];
 for(const[key,label]of Object.entries(labels)){
  const items=b.positiveItems[key]||0,sets=b.sets[key]||0,penalties=b.penalties[key]||0,final=summary.effects[key]||0;
  if(!items&&!sets&&!penalties&&!final)continue;
  rows.push(`<tr><th scope="row">${label}</th><td>${number(key,items)}</td><td>${number(key,sets)}</td><td>${number(key,penalties)}</td><td><strong>${number(key,final)}</strong></td></tr>`);
 }
 const rangeNote=modern&&(b.range.positive||b.range.penalties)?`<p class="artifact-range-budget">Positive artifact range: ${number('rangeTiles',b.range.positive)} · cap +3 tiles${b.range.discarded?` · ${number('rangeTiles',b.range.discarded)} above the cap`:''}. Equipment range penalties apply after the cap. Auras, splash areas and secondary jumps keep their own reach.</p>`:'';
 const capNotes=Object.entries(b.capped).filter(([key])=>key!=='rangeTiles').map(([key,row])=>`${labels[key]||key}: ${number(key,row.raw)} before limits → ${number(key,row.final)}`);
 return `<details class="artifact-bonus-breakdown"><summary>Items, set bonuses & limits</summary>${rows.length?`<div class="artifact-breakdown-scroll"><table><thead><tr><th>Army property</th><th>Items</th><th>Sets</th><th>Penalties</th><th>Final</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:''}${rangeNote}${capNotes.length?`<p class="artifact-cap-note">${capNotes.map(esc).join(' · ')}</p>`:''}${artifactConditionsMarkup(summary)}<p class="artifact-rule-note">Set thresholds are cumulative. Poison and Burn bases use the strongest equipped source. Native and artifact Slow, armor reduction and immunity breach use the strongest active effect.</p></details>`;
}

export function artifactEffectListMarkup(summary){
 const rows=artifactModifierText(summary.effects,{version:summary.version});
 return rows.length?`<ul class="artifact-effect-list">${rows.map(row=>`<li>${esc(row)}</li>`).join('')}</ul>`:'<p class="artifact-empty-copy">Equip artifacts to shape your next defense.</p>';
}
