import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {icon,iconArt,ornateIcon} from '../ui/icons.js';

function assertWebP(url){
 const file=new URL('../public'+url.split('?')[0],import.meta.url);
 const bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'RIFF',url);
 assert.equal(bytes.toString('ascii',8,12),'WEBP',url);
}

test('loading screens, gameplay controls and all five recruit marks use packaged raster pictures',()=>{
 const names='loading compass play pause path grid reset help close check pin target chevron mute snow fire flask sun hammer bolt scroll maze wave shield coin command clock spark commander book warband sound settings crown basic swords bow'.split(' ');
 for(const name of names){
  assertWebP(iconArt(name));
  for(const render of [icon,ornateIcon])assert.ok(render(name).includes('src="'+iconArt(name)+'"'));
 }
 const page=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(page.includes('src="%BASE_URL%'+iconArt('loading').slice(1)+'"'));
 for(let position=1;position<=5;position++)assertWebP('/assets/ui/war-table/ui-icons/recruit-'+position+'.webp');
 assert.equal(iconArt('constructor'),iconArt('shield'));
});
