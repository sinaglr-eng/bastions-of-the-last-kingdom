import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'public/assets/ui/geometric');fs.mkdirSync(out,{recursive:true});
const c={gold:'#d3a54f',light:'#f5d992',shade:'#86612d',green:'#2f6455',mint:'#60917a',dark:'#183d38',steel:'#a9c3bf',silver:'#d6e1d5',red:'#af5542',blue:'#5286a1'};
const p=(points,fill)=>`<polygon points="${points}" fill="${fill}"/>`;
const line=(points,color=c.light,width=4)=>`<polyline points="${points}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linejoin="miter"/>`;
const oct=(x,y,r,fill)=>p(Array.from({length:8},(_,i)=>{const a=(i*45+22.5)*Math.PI/180;return `${x+Math.cos(a)*r},${y+Math.sin(a)*r}`;}).join(' '),fill);
const gem=(x,y,r,color=c.mint)=>p(`${x},${y-r} ${x+r},${y} ${x},${y+r} ${x-r},${y}`,color)+p(`${x},${y-r} ${x},${y} ${x-r},${y}`,c.silver)+p(`${x},${y} ${x+r},${y} ${x},${y+r}`,c.green);
const coin=(x,y,r=15)=>oct(x+2,y+3,r,c.shade)+oct(x,y,r,c.gold)+p(`${x-r*.92},${y-r*.38} ${x-r*.38},${y-r*.92} ${x+r*.38},${y-r*.92} ${x+r*.92},${y-r*.38} ${x},${y}`,c.light)+oct(x,y,r*.63,c.shade)+oct(x,y,r*.5,c.gold);
const shield=(x=48,y=47,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})">${p('-29,-34 0,-43 29,-34 26,7 15,25 0,38 -15,25 -26,7',c.shade)}${p('-26,-31 0,-39 26,-31 23,6 13,22 0,34 -13,22 -23,6',c.gold)}${p('-20,-26 0,-32 20,-26 17,4 8,18 0,24 -8,18 -17,4',c.green)}${p('-20,-26 0,-32 0,24 -8,18 -17,4',c.mint)}${p('0,-32 20,-26 17,4 8,18 0,24',c.dark)}</g>`;
const sword=(x=48,y=44,rotation=0)=>`<g transform="translate(${x} ${y}) rotate(${rotation})">${p('0,-39 7,-25 5,15 -5,15 -7,-25',c.steel)}${p('0,-39 0,15 -5,15 -7,-25',c.silver)}${p('-17,14 17,14 15,21 -15,21',c.gold)}${p('-4,21 4,21 4,34 -4,34',c.shade)}${gem(0,36,5,c.gold)}</g>`;
const crate=()=>p('15,33 49,19 81,33 81,70 47,84 15,69',c.shade)+p('15,33 47,46 47,84 15,69',c.green)+p('47,46 81,33 81,70 47,84',c.dark)+p('15,33 49,19 81,33 47,46',c.mint)+line('31,27 63,41 63,77',c.gold,7)+line('31,39 31,76',c.light,6)+line('16,60 47,72 81,58',c.gold,4);
const helmet=()=>p('20,48 25,24 39,12 57,12 72,26 78,49 71,75 49,85 25,73',c.shade)+p('24,46 29,27 41,17 54,17 67,28 73,47 67,71 49,79 29,69',c.steel)+p('29,27 41,17 48,17 48,79 29,69 24,46',c.silver)+p('48,17 54,17 67,28 73,47 67,71 49,79',c.green)+p('23,45 47,49 75,44 72,57 49,62 25,57',c.dark)+p('44,17 51,17 54,65 48,75 43,63',c.gold)+p('38,10 48,3 59,10 57,19 40,19',c.red);
const chest=()=>p('13,42 24,22 71,22 83,40 83,74 74,82 20,82 13,74',c.shade)+p('18,42 28,27 67,27 78,41 78,49 18,49',c.blue)+p('18,51 78,51 78,73 72,77 23,77 18,72',c.green)+p('18,42 28,27 42,27 35,49 18,49',c.steel)+line('29,28 28,76',c.gold,6)+line('67,28 68,76',c.gold,6)+p('41,45 55,45 55,64 41,64',c.light)+gem(48,54,5,c.green);
const banner=()=>p('22,12 28,12 28,85 22,85',c.shade)+p('27,15 74,15 69,39 75,63 27,63',c.green)+p('27,15 74,15 52,39 27,63',c.mint)+line('28,17 72,17',c.gold,5)+gem(49,37,13,c.gold);
const keep=()=>p('14,36 28,36 28,24 40,24 40,36 55,36 55,24 68,24 68,36 82,36 78,80 18,80',c.shade)+p('19,41 43,41 43,75 22,75',c.steel)+p('43,41 76,41 73,75 43,75',c.green)+p('39,58 48,51 57,58 57,79 39,79',c.dark)+p('39,8 57,8 57,40 39,40',c.gold)+p('43,13 53,13 53,34 43,34',c.light);
const anvil=()=>p('9,34 33,34 38,25 75,25 75,42 61,51 54,51 54,66 73,72 73,82 25,82 25,72 41,66 41,51 27,51',c.shade)+p('9,31 32,31 38,22 78,22 78,36 62,45 27,45',c.silver)+p('27,45 62,45 54,50 41,50',c.steel)+p('41,50 54,50 54,66 41,66',c.green)+line('68,49 68,64 59,57 68,66 77,57',c.gold,4);
const horn=()=>p('15,26 33,38 58,39 78,18 88,23 83,63 65,78 43,72 35,56 16,48',c.shade)+p('18,29 33,41 60,43 80,23 76,56 62,68 47,64 40,51 18,45',c.gold)+p('18,29 33,41 60,43 80,23 70,47 47,50 30,46 18,38',c.light)+p('76,19 88,23 83,43 71,40',c.dark)+line('43,43 42,56 48,66',c.green,6);
const bow=()=>p('30,8 48,14 67,30 75,49 67,69 48,84 30,90 37,79 53,64 60,49 53,32 37,18',c.gold)+p('30,8 48,14 67,30 75,49 60,49 53,32 37,18',c.light)+line('31,12 31,86',c.steel,3)+p('10,46 75,46 75,38 91,49 75,59 75,51 10,51',c.dark);
const lightning=()=>p('49,6 76,6 57,35 79,35 26,92 39,55 20,55',c.shade)+p('45,3 70,3 50,38 73,38 25,86 40,49 24,49',c.gold)+p('45,3 53,3 39,42 48,42 25,86 40,49 24,49',c.light);
const star=()=>p('48,8 59,32 86,36 66,54 71,82 48,69 25,82 30,54 10,36 37,32',c.shade)+p('48,4 59,29 86,33 66,51 71,78 48,65 25,78 30,51 10,33 37,29',c.gold)+p('48,4 48,46 10,33 37,29',c.light)+p('48,46 71,78 48,65 25,78',c.green);
const motifs={
 'wave':p('18,9 24,9 24,88 18,88',c.shade)+p('24,14 52,10 80,18 75,49 51,43 24,49',c.green)+p('24,14 52,10 51,43 24,49',c.mint)+p('29,20 48,17 49,36 29,41',c.gold)+p('10,84 34,84 34,90 10,90',c.gold),
 'keep-health':shield()+p('48,31 36,24 28,32 28,43 48,62 68,43 68,32 60,24',c.red)+p('36,24 28,32 28,43 48,62 48,31', '#d28461'),
 'gold':coin(29,66,20)+coin(65,62,23)+coin(49,30,23),
 'command-points':shield(48,49,.9)+star(),
 'time':p('22,7 74,7 74,16 22,16',c.gold)+p('22,80 74,80 74,89 22,89',c.shade)+p('29,16 67,16 63,34 53,47 63,61 67,80 29,80 33,61 43,47 33,34',c.steel)+p('33,20 63,20 58,34 48,44 38,34',c.gold)+p('48,52 61,73 35,73',c.gold)+p('29,16 35,16 39,34 48,45 48,52 36,69 34,80 29,80 33,61 43,47 33,34',c.silver),
 'commander':helmet(),'equipment':p('28,15 38,10 48,20 58,10 68,15 84,34 72,43 68,82 28,82 24,43 12,34',c.shade)+p('29,20 38,16 48,27 58,16 67,20 77,33 66,38 62,75 34,75 30,38 19,33',c.green)+p('29,20 38,16 48,27 48,75 34,75 30,38 19,33',c.mint)+line('33,57 62,57',c.gold,6)+gem(48,40,11,c.gold),
 'skills':shield()+gem(48,42,21,c.gold),
 'chests':chest(), 'sets':line('23,34 48,20 74,35 70,67 27,67 23,34',c.gold,7)+gem(23,34,16)+gem(74,35,16)+gem(48,69,17),
 'recipes':p('10,20 42,16 48,22 55,16 86,20 86,78 55,74 48,80 41,74 10,78',c.shade)+p('14,22 40,20 45,25 45,72 38,69 14,73',c.silver)+p('51,25 57,20 82,22 82,73 57,69 51,72',c.light)+line('23,34 36,32',c.gold,4)+line('23,46 36,44',c.gold,4)+gem(66,45,13),
 'enemy-waves':helmet().replaceAll(c.green,c.red).replaceAll(c.silver,'#c0b19b').replaceAll(c.steel,'#97887a'),
 'sound':p('9,38 29,38 53,18 53,78 29,59 9,59',c.shade)+p('13,41 31,41 49,25 49,71 31,55 13,55',c.gold)+p('13,41 31,41 49,25 49,46 13,49',c.light)+line('64,31 74,40 74,56 64,65',c.green,7)+line('76,20 89,33 89,63 76,76',c.mint,6),
 'settings':oct(48,48,39,c.shade)+oct(48,46,36,c.gold)+oct(48,46,26,c.green)+oct(48,46,14,c.silver)+p('42,3 54,3 59,22 37,22',c.light)+p('42,70 59,70 54,91 42,91',c.shade),
 'champions':p('10,23 31,39 48,12 65,39 86,23 75,75 22,75',c.shade)+p('15,28 32,45 48,19 64,45 81,28 71,67 26,67',c.gold)+p('15,28 32,45 48,19 48,67 26,67',c.light)+gem(48,52,11),
 'basic-defenders':shield()+sword(48,45,0),
 'relic-dust':p('18,64 30,40 39,32 57,32 68,41 79,64 69,82 27,82',c.shade)+p('22,63 33,43 41,37 55,37 64,44 74,63 65,76 31,76',c.green)+p('22,63 33,43 41,37 47,76 31,76',c.mint)+p('30,64 43,57 59,58 69,65 58,71 42,73', '#b9c9d2')+gem(44,53,8,'#94b1c6')+gem(59,59,6)+gem(48,25,9,'#94b1c6')+p('29,15 33,15 33,19 29,19 29,15 27,22 31,22 31,26 27,26',c.light)+p('68,25 72,25 72,29 68,29 66,32 70,32 70,36 66,36',c.light),
 'skill-deep-refit':anvil(), 'skill-recruitment-focus':oct(48,48,35,c.shade)+oct(48,48,30,c.gold)+p('48,18 58,43 82,48 58,54 48,79 38,54 14,48 38,43',c.green)+gem(48,48,14),
 'skill-field-logistics':crate(), 'skill-quartermaster':chest()+coin(69,69,18),
 'skill-morale-boost':banner()+line('55,74 68,61 81,74',c.gold,7), 'skill-war-horn':horn(),
 'skill-blood-wrath':sword(39,46,-33)+sword(58,46,33)+gem(49,62,11,c.red),
 'skill-field-promotion':shield()+p('25,47 48,24 71,47 71,59 48,37 25,59',c.light)+p('29,64 48,46 67,64 67,75 48,58 29,75',c.gold),
 'skill-fortified-keep':keep(), 'skill-extended-range':bow(), 'skill-decisive-strike':lightning()
};
for(const[name,body]of Object.entries(motifs))fs.writeFileSync(path.join(out,name+'.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g stroke-linejoin="miter">${body}</g></svg>\n`);
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({style:'Hand-authored faceted geometry, emerald enamel, aged gold and pale steel; transparent backgrounds',generator:'tools/generate-geometric-ui.mjs',icons:Object.keys(motifs)},null,2)+'\n');
console.log(`Generated ${Object.keys(motifs).length} geometric UI symbols.`);
