// Preserve the physical V5 head/cloth regressions while writing new V6 evidence.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {NativeTestGLTFLoader} from '../tests/helpers/native-gltf.mjs';
import {inspectProportionsV5} from './audit-geometric-proportions-v5.mjs';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
const project=resolve(fileURLToPath(new URL('..',import.meta.url)));
export async function runProportionsV6Audit(){
 const entries=[];
 for(const category of ['defenders','champions','enemies']){
  const manifest=JSON.parse(readFileSync(resolve(project,`public/assets/geometric/geometric-${category}.json`)));
  for(const row of manifest.assets||manifest.entries){
   const bytes=readFileSync(resolve(project,'public/assets/geometric',row.file));
   const gltf=await new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
   entries.push({...inspectProportionsV5(gltf.scene,{id:row.id}),category,actualGlbSha256:createHash('sha256').update(bytes).digest('hex')});
   disposeDecodedGeometricAsset(gltf);
  }
 }
 const checks=entries.flatMap(row=>row.checks);
 const report={revision:'geometric-game-v6',scope:'Retained actual V5 physical whole-head and closed folded-cloth regressions; V6 source reconstruction and enemy anatomy have independent audits.',subjects:entries.length,checks:checks.length,failures:checks.filter(check=>!check.passed).length,entries};
 const output=resolve(project,'output/design/geometric-game-v6/proportions-cloak-audit.json');
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({subjects:report.subjects,checks:report.checks,failures:report.failures,output}));
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const report=await runProportionsV6Audit();if(report.failures)process.exitCode=1;}
