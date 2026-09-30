// Document the current campaign, including each variant's actual inherited traits.
// This tool never writes enemy definitions or wave settings.
import {readFileSync,writeFileSync} from 'node:fs';
const enemies=JSON.parse(readFileSync('data/enemies.json','utf8'));
const waves=JSON.parse(readFileSync('data/waves.json','utf8'));
const number=n=>new Intl.NumberFormat('cs-CZ',{maximumFractionDigits:3}).format(n);
const pct=n=>`${number(n*100)} %`;
function effects(e){
 const out=[];
 if(e.traits?.includes('highArmor'))out.push(`Těžký pancíř: ${number(e.armor)} armor`);
 if(e.stealth)out.push('Skrytí: odhalení do 2 polí od obránce, 1,5 pole od checkpointu nebo 6 polí od kněze');
 if(e.cloakDaggers)out.push('Cyklické skrytí: 4 s z každých 6 s');
 if(e.regen)out.push(`Regenerace ${number(e.regen)} HP/s`);
 if(e.evasion)out.push(`Úhyb ${pct(e.evasion)} proti přímým fyzickým zásahům`);
 if(e.disarm)out.push('Odzbrojení na 1,25 s každých 8 s, dosah pod 3 pole');
 if(e.refraction)out.push(`${e.refraction} zásahové štíty, obnova každých 8 s`);
 if(e.magicImmune)out.push('Magická imunita včetně magických stavových efektů');
 if(e.physicalImmune)out.push('Imunita proti fyzickému a průraznému poškození');
 if(e.untouchable)out.push(`Aura strachu: −${pct(e.untouchable)} rychlosti útoků obránců do 4 polí`);
 if(e.rush)out.push(`Nápor: ×${number(e.rush)} rychlost na 2 s každých 6 s`);
 if(e.reactiveArmor)out.push(`Reaktivní pancíř: +${number(e.reactiveArmor)} armor za přímý zásah, nejvýše 12 vrstev, úbytek 0,7 vrstvy/s`);
 if(e.recharge)out.push(`Obnova ${pct(e.recharge)} maximálního HP každých 8 s`);
 if(e.blink)out.push(`Skok o ${number(e.blink)} pole každých 6 s, zachovává checkpointy`);
 if(e.krakenShell)out.push(`Krunýř: −${number(e.krakenShell)} HP z každého přímého zásahu kromě čistého poškození`);
 if(e.hasteAura)out.push(`Válečné bubny: +${pct(e.hasteAura-1)} rychlosti spojenců do 3,5 pole na 3 s každých 6 s`);
 if(e.thief)out.push(`Krádež ${number(e.thief)} zlata při průniku do hradu`);
 for(const [type,value]of Object.entries(e.resists||{}))if(value>0&&!e.magicImmune)out.push(`Odolnost ${type}: ${pct(value)}`);
 return out.join('; ')||'Bez zvláštní schopnosti';
}
const rows=waves.flatMap((w,i)=>w.groups.map(g=>{
 const base=enemies[g.type],variants=base.variants?.length?base.variants.map(v=>({...base,...v})):[base];
 const descriptions=variants.map(e=>effects(e));
 const traits=new Set(descriptions).size===1?descriptions[0]:variants.map((e,j)=>`${e.name}: ${descriptions[j]}`).join('<br>');
 return `| ${i+1} | ${variants.map(e=>e.name).filter((v,j,a)=>a.indexOf(v)===j).join('<br>')} | ${base.boss?'Boss · ':''}${base.flying?'Létající':'Pozemní'} | ${traits} |`;
}));
writeFileSync('docs/WAVE_REFERENCE.md',`# Padesát vln skřetí kampaně\n\nPředloha: [Gem TD](https://dota2.fandom.com/wiki/Gem_TD). Názvy, číselné parametry a přesné načasování jsou adaptací naší hry. Tento přehled vychází přímo z aktuálních data/enemies.json a data/waves.json. Vlny ani nepřátelé se při jeho vytváření nemění.\n\nVarianta se losuje jednou pro celou skupinu. U vln 31, 35 a 36 jde o magickou **nebo** fyzickou imunitu podle varianty, nikoli současně ani o přepínání během boje. Vlny 38 a 50 mají varianty s odlišnými efekty, rozepsané níže. Běžný armor je součástí statistik všech jednotek; jako zvláštní efekt je uveden pouze těžký pancíř.\n\n| Vlna | Nepřítel a možné varianty | Pohyb | Skutečné efekty |\n|---:|---|---|---|\n${rows.join('\n')}\n\nPřímé zásahové štíty nezachytí tiky jedu ani průběžné hoření. Čisté poškození obchází armor, odolnosti, obě imunity a krunýř; přímý čistý zásah stále zachytí zásahový štít. Přesné zásahy obcházejí úhyb, ale zachovávají armor, štíty a fyzickou imunitu. Létající jednotky prolétají checkpointy přímo.\n`);
console.log(`Documented ${waves.length} unchanged waves and all enemy variants.`);
