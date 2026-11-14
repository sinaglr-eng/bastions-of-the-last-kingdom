import {siteUrl} from '../game/site-url.js';
import {referenceEnemyPortrait} from './reference-portraits.js';

export const escapeProgression=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache=new Map();
const motifs={
 collection:'<path d="m63 78 25 18 32-37 32 37 25-18-12 66H75Z" fill="#d8b965"/><path d="M82 135h76v18H82Z" fill="#f7dda0"/><path d="m120 91 7 15 16 2-12 12 3 16-14-7-14 7 3-16-12-12 16-2Z" fill="#507b67"/>',
 mastery:'<path d="m120 54 51 29-9 62-42 31-42-31-9-62Z" fill="#d4b15f"/><path d="m120 68 37 22-7 48-30 23-30-23-7-48Z" fill="#456d60"/><text x="120" y="133" text-anchor="middle" fill="#fff0bf" font-family="Georgia" font-size="46">VI</text>',
 campaign:'<path d="M71 151V86h22v17h14V71h26v32h14V86h22v65Z" fill="#e0c88c"/><path d="M109 151v-26a11 11 0 0 1 22 0v26" fill="#35544b"/><path d="M120 71V47m0 2 28 8-28 8" stroke="#dfba62" stroke-width="5" fill="#d98455"/>',
 streak:'<path d="m120 49 52 19-7 65c-5 23-26 39-45 50-19-11-40-27-45-50l-7-65Z" fill="#dec486"/><path d="m120 63 37 14-5 52c-3 17-19 30-32 38-13-8-29-21-32-38l-5-52Z" fill="#527a63"/><path d="M120 131c-34-20-30-42-14-43 7-1 11 4 14 8 3-4 7-9 14-8 16 1 20 23-14 43Z" fill="#fbefc5"/>',
 endless:'<path d="M120 108c-47-63-88 6-51 25 20 13 35-5 51-25 47-63 88 6 51 25-20 13-35-5-51-25Z" fill="none" stroke="#ebcc83" stroke-width="15"/><path d="M65 149h110" stroke="#9aaf86" stroke-width="2"/>',
 boss:'<path d="m80 93 10-28 30 14 30-14 10 28-8 51-32 27-32-27Z" fill="#ddc18a"/><path d="m91 107 20 9m38-9-20 9M111 142h18" stroke="#6b5c43" stroke-width="9"/><path d="M77 70 61 49l4 40m98-19 16-21-4 40" stroke="#cfa968" stroke-width="8" fill="none"/>',
 secret:'<path d="m120 50 46 26-8 63-38 36-38-36-8-63Z" fill="#d6b86d"/><path d="m120 64 33 19-6 50-27 25-27-25-6-50Z" fill="#405750"/><path d="M106 100c0-22 37-24 37 0 0 15-23 14-23 29m0 9v4" stroke="#f2dca5" stroke-width="8" fill="none" stroke-linecap="round"/>',
 'deep-refit':'<path d="M69 132h101l-16 19H82Z" fill="#b2c3b0"/><path d="M84 112h75v19H84zm20 38h29v16h-29Z" fill="#dfca94"/><path d="m103 67 26-18 25 35-26 18Z" fill="#e4bb70"/><path d="m121 94-22 36" stroke="#a37c50" stroke-width="12"/><path d="m64 76 13 9m82 18 14-4" stroke="#e8cc87" stroke-width="4"/>',
 'recruitment-focus':'<rect x="66" y="70" width="54" height="81" rx="5" fill="#8ba9a0" transform="rotate(-15 93 111)"/><rect x="118" y="70" width="54" height="81" rx="5" fill="#c8b379" transform="rotate(15 145 111)"/><rect x="91" y="59" width="58" height="93" rx="5" fill="#f2dc9f" stroke="#aa8549" stroke-width="3"/><path d="m120 78 20 11-5 24-15 11-15-11-5-24Z" fill="#54796d"/><path d="M105 137h30" stroke="#9b7b42" stroke-width="4"/>',
 'field-logistics':'<path d="m120 49 49 28v56l-49 30-49-30V77Z" fill="#dab66c"/><path d="m120 64 35 20v42l-35 21-35-21V84Z" fill="#5c7e6e"/><path d="m120 78 8 19 20 2-15 14 5 20-18-11-18 11 5-20-15-14 20-2Z" fill="#fff0bf"/><path d="m59 139 16 20m-9-4 18 14m97-30-16 20m9-4-18 14" stroke="#a5b893" stroke-width="5"/>',
 quartermaster:'<path d="M68 104h104v52H68Z" fill="#b07a3e"/><path d="M68 104v-9c0-34 104-34 104 0v9Z" fill="#dfb864"/><path d="M82 102v54m76-54v54M68 112h104" stroke="#f3d691" stroke-width="7"/><rect x="111" y="108" width="18" height="21" rx="2" fill="#f4d28a"/><circle cx="120" cy="117" r="3" fill="#73562d"/><ellipse cx="79" cy="171" rx="17" ry="7" fill="#f2d082"/><ellipse cx="162" cy="168" rx="17" ry="7" fill="#d9ad50"/>',
 'morale-boost':'<path d="M85 51v116" stroke="#e6c079" stroke-width="7"/><path d="M90 57h67l-14 29 14 29H90Z" fill="#b85d48"/><path d="m120 69 6 12 13 2-10 9 2 13-11-6-11 6 2-13-10-9 13-2Z" fill="#f8d790"/><path d="m60 132 17-14m87 15 17-14m-41 32 17-14" stroke="#eccb84" stroke-width="5"/><path d="M73 171h64" stroke="#d1c599" stroke-width="5"/>',
 'war-horn':'<path d="M62 102c49 27 74 8 96-38l22 75c-52-21-79 5-106-8Z" fill="#e4bd67" stroke="#ac7a3e" stroke-width="4"/><path d="m156 65 24 74" stroke="#fff0bb" stroke-width="10"/><path d="m77 108 8 25m10-22 7 22" stroke="#9c7b45" stroke-width="6"/><path d="m164 46 8-14m12 25 15-7m-12 29 17 1" stroke="#e4c58b" stroke-width="4"/>',
 'blood-wrath':'<path d="m74 156 76-76" stroke="#d7c38c" stroke-width="12"/><path d="m96 62 26 17 26-17 22 22-22 27-16-25-26 17-24-22Z" fill="#c16853" stroke="#ebc787" stroke-width="3"/><path d="m91 145 12 12m-31 5 13 13" stroke="#ad8b54" stroke-width="7"/><path d="M158 130c-20 29 20 29 0 0Z" fill="#d46e56"/>',
};
export function progressionArtwork(kind='collection',target=''){
 if(['collection','mastery','campaign','streak','endless','secret','deep-refit','recruitment-focus','field-logistics','quartermaster','morale-boost','war-horn','blood-wrath'].includes(kind))return siteUrl('assets/ui/war-table/'+kind+'.webp');
 const key=kind+':'+target;if(cache.has(key))return cache.get(key);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><radialGradient id="bg"><stop stop-color="#577665"/><stop offset="1" stop-color="#193d3d"/></radialGradient><linearGradient id="metal" x2="1" y2="1"><stop stop-color="#f6e1ac"/><stop offset=".5" stop-color="#aa8246"/><stop offset="1" stop-color="#e5c984"/></linearGradient></defs><rect x="8" y="8" width="224" height="224" rx="29" fill="url(#bg)"/><rect x="13" y="13" width="214" height="214" rx="25" fill="none" stroke="url(#metal)" stroke-width="3"/><circle cx="120" cy="114" r="77" fill="none" stroke="#bfa66a" stroke-opacity=".3"/><path d="M35 120h19m132 0h19M120 27v15m0 142v16" stroke="#e0c282" stroke-opacity=".45"/><path d="m37 178 6 18 19 5m141-23-6 18-19 5" stroke="#baa56d" fill="none" stroke-width="3"/>${motifs[kind]||motifs.collection}${target?`<rect x="83" y="182" width="74" height="30" rx="5" fill="#e5c88b"/><text x="120" y="204" text-anchor="middle" fill="#345448" font-family="Georgia" font-weight="bold" font-size="22">${escapeProgression(target)}</text>`:''}</svg>`;
 const src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);cache.set(key,src);return src;
}
export function achievementArtwork(achievement,data,reveal=false){
 if(achievement.secret&&!reveal)return progressionArtwork('secret');
 const id=achievement.id.split(':').at(-1);
 if(achievement.kind==='champion'){
  const portrait=data.defenderAssets?.find(a=>a.family===id&&a.tier===1)?.portrait;
  if(portrait)return siteUrl(portrait);
 }
 if(achievement.kind==='boss'&&data.enemies[id])return referenceEnemyPortrait(data.enemies[id].visualAsset||id)||progressionArtwork('boss');
 return progressionArtwork(achievement.kind,achievement.kind==='mastery'?'':achievement.kind==='campaign'?'50':achievement.target);
}
export const medalIcon=(className='')=>`<img class="medal-icon ${className}" src="${siteUrl('assets/ui/war-table/medal.svg')}" alt="" aria-hidden="true" width="48" height="64">`;
export const medalAmount=(amount,label='medals')=>`<span class="medal-amount">${medalIcon()}<span><b>${BigInt(amount||0).toLocaleString('en-US')}</b> ${label}</span></span>`;
