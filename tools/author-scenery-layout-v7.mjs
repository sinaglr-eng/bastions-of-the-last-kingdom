import {readFileSync,writeFileSync} from 'node:fs';

// V7 adds decorative defenses; every V6 settlement and river coordinate stays fixed.
const source=JSON.parse(readFileSync(new URL('../data/scenery-v6.json',import.meta.url),'utf8'));
const layout={...source,edition:'V7',royalOuterDefenses:{
  seed:7283,wallX:-10,gateRoadHalfWidth:3.5,waterMargin:.28,
  bands:[{fromY:4.2,toY:46.5},{fromY:-7.3,toY:-4.1}],
  stakeSpacing:.61,stakeRows:2,minimumWallGap:.52,thornCount:22,
  gameplayEffect:'none'
}};
writeFileSync(new URL('../data/scenery-v7.json',import.meta.url),JSON.stringify(layout,null,2)+'\n');
const sampled=JSON.parse(readFileSync(new URL('../public/assets/scenery/layout-v6.json',import.meta.url),'utf8'));
writeFileSync(new URL('../public/assets/scenery/layout-v7.json',import.meta.url),JSON.stringify({...sampled,edition:'V7',royalOuterDefenses:layout.royalOuterDefenses},null,2)+'\n');
console.log('V7 inherits V6 settlement/river coordinates and adds dry royal outer defenses.');
