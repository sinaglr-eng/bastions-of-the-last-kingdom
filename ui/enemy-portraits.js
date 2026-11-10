import {enemyPortraitImage} from './reference-portraits.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Mixed wave 38 must name both faces. Other existing single-image summaries
// retain their presentation, while individual profiles use exact visual IDs.
export function enemyGroupPortraits(enemy,images){
 const variants=(Array.isArray(enemy?.variants)?enemy.variants:[]).filter(v=>v&&typeof v==='object'),distinct=variants.some(v=>v.visualAsset==='host_38-wraith');
 if(!distinct){const image=enemyPortraitImage(images,enemy);return image?`<img src="${escape(image)}" alt="${escape(enemy.name||'Invader')}" draggable="false">`:'';}
 return `<span class="enemy-variant-portraits">${variants.map(v=>{const image=enemyPortraitImage(images,{...v,type:enemy.type});return `<span>${image?`<img src="${escape(image)}" alt="${escape(v.name)}" draggable="false">`:''}<small>${escape(v.name)}</small></span>`;}).join('')}</span>`;
}
