// Verify the exact deployed workflow SHA and every shipped basic GLB/portrait.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const base='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
const families=['soldier','archer','druid','mage','cleric','runebreaker','frostwarden','stormcaller'];
const args=process.argv.slice(2),sha=args[args.indexOf('--sha')+1];
const workflowOnly=args.includes('--workflow-only');
if(!/^[0-9a-f]{40}$/.test(sha??''))throw new Error('Pass the full expected commit with --sha');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const request=async url=>{
  const response=await fetch(url,{headers:{'User-Agent':'Bastions-native-asset-verification','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`${response.status} ${url}`);
  return response;
};
const runs=await (await request('https://api.github.com/repos/sinaglr-eng/bastions-of-the-last-kingdom/actions/workflows/pages.yml/runs?branch=main&per_page=10')).json();
const run=runs.workflow_runs.find(r=>r.head_sha===sha);
const workflow={sha,status:run?.status??'not_found',conclusion:run?.conclusion??null,url:run?.html_url??null};
if(workflowOnly){console.log(JSON.stringify(workflow,null,2));}
else {
if(workflow.status!=='completed'||workflow.conclusion!=='success')throw new Error(`Deployment has not succeeded: ${JSON.stringify(workflow)}`);
const manifest=await (await request(base+'assets/models/manifest.json?verify='+sha)).json();
const basic=manifest.filter(e=>e.kind==='tower'&&families.includes(e.family));
if(basic.length!==48||basic.some(e=>e.style!=='hooded-turnarounds-v3'))throw new Error('Production does not contain all48 expected v3 models');
const tasks=basic.flatMap(e=>[`assets/models/${e.file}`,`assets/army/${e.family}-t${e.tier}.png`]);
const results=[];
let next=0;
await Promise.all(Array.from({length:4},async()=>{
  while(next<tasks.length){
    const path=tasks[next++];
    const remote=Buffer.from(await (await request(base+path+'?verify='+sha)).arrayBuffer());
    const local=readFileSync(new URL('public/'+path,root));
    const expected=digest(local),actual=digest(remote);
    results.push({path,bytes:remote.length,expectedSha256:expected,productionSha256:actual,match:actual===expected});
  }
}));
results.sort((a,b)=>a.path.localeCompare(b.path));
const report={base,checkedAt:new Date().toISOString(),workflow,models:48,portraits:48,checkedFiles:results.length,
  allHashesMatch:results.length===96&&results.every(r=>r.match),results};
writeFileSync(new URL('output/design/hooded-turnarounds-v3/production-verification.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({base,workflow,checkedFiles:report.checkedFiles,allHashesMatch:report.allHashesMatch},null,2));
if(!report.allHashesMatch)process.exitCode=1;
}
