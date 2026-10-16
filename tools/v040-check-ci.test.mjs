import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {parseArguments,publicGet,checkCi,writeProof,REPO_ROOT} from './v040-check-ci.mjs';

const SHA='a'.repeat(40),OTHER='b'.repeat(40),RUN=123456;
const run=(changes={})=>({id:RUN,head_branch:'main',head_sha:SHA,path:'.github/workflows/pages.yml',event:'push',status:'completed',conclusion:'success',name:'Test and deploy GitHub Pages',html_url:`https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/${RUN}`,run_attempt:1,...changes});
const step=name=>({name,status:'completed',conclusion:'success'});
const jobs=()=>[{id:1,name:'build',status:'completed',conclusion:'success',steps:['Test game rules and assets','Build for the repository URL','Upload website'].map(step)},{id:2,name:'deploy',status:'completed',conclusion:'success',steps:[step('Publish website')]}];
const fixture=(actual=run(),list=jobs())=>({request:async route=>{if(route.startsWith('workflows/'))return {workflow_runs:[actual]};if(route===`runs/${RUN}`)return actual;if(route.startsWith(`runs/${RUN}/jobs?`))return {total_count:list.length,jobs:list};throw Error('Unexpected GET '+route);},now:()=> '2026-10-16T00:00:00.000Z'});

test('CLI accepts explicit run/exact full SHA/latest main and rejects ambiguous or malformed inputs',()=>{
  assert.deepEqual(parseArguments(['--run',String(RUN),'--commit',SHA]),{runId:String(RUN),commit:SHA,latestMain:false,proof:null});
  assert.equal(parseArguments([SHA]).commit,SHA);assert.equal(parseArguments([String(RUN)]).runId,String(RUN));assert.equal(parseArguments(['--latest-main']).latestMain,true);
  for(const args of [[],['--commit','short'],['--run','0'],['--run','x'],['--run'],['--latest-main','--commit',SHA],['--run','1','--run','2'],['--unknown']])assert.throws(()=>parseArguments(args));
});

test('public transport makes only bounded public GETs without credentials, redirects, logs or private response text',async()=>{
  let captured;const value=await publicGet(`runs/${RUN}`,{fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({id:RUN})};}});assert.equal(value.id,RUN);assert.equal(captured.options.method,'GET');assert.equal(captured.options.redirect,'error');assert.equal(new URL(captured.url).hostname,'api.github.com');assert.equal(Object.keys(captured.options.headers).some(name=>name.toLowerCase()==='authorization'),false);assert.ok(captured.options.signal);
  await assert.rejects(publicGet('https://example.com/private',{fetchImpl:()=>{throw Error('Must not fetch');}}),/Only this public/);
  await assert.rejects(publicGet('../../secret',{fetchImpl:()=>{throw Error('Must not fetch');}}),/Only this public/);
  await assert.rejects(publicGet(`runs/${RUN}`,{fetchImpl:async()=>({ok:false,status:403,headers:{get:name=>name==='x-ratelimit-remaining'?'0':name==='x-ratelimit-reset'?'1800000000':null},json:()=>{throw Error('Do not read raw error body');}})}),/public rate limit resets/);
});

test('exact commit selects the latest matching main Pages run and then independently validates the run identity',async()=>{
  const routes=[],base=fixture();const report=await checkCi(parseArguments(['--commit',SHA]),{...base,request:async route=>{routes.push(route);if(route.startsWith('workflows/'))return {workflow_runs:[run({id:RUN-1}),run({id:RUN+1,head_sha:OTHER}),run({id:RUN+10,event:'workflow_dispatch'}),run()]};return base.request(route);}});
  assert.equal(report.run.id,RUN);assert.equal(report.assessment.state,'success');assert.equal(report.assessment.allRequiredChecksPassed,true);assert.match(routes[0],/workflows\/pages.yml\/runs\?/);assert.match(routes[0],new RegExp('head_sha='+SHA));assert.match(routes[0],/event=push/);assert.equal(routes[1],`runs/${RUN}`);assert.equal(routes.length,3);
});

test('pending run is reported as pending; missing final job evidence cannot be called success',async()=>{
  const pending=await checkCi(parseArguments([String(RUN)]),fixture(run({status:'in_progress',conclusion:null}),[{...jobs()[0],status:'in_progress',conclusion:null,steps:[]} ]));assert.equal(pending.assessment.state,'pending');assert.equal(pending.assessment.allRequiredChecksPassed,false);
  const incomplete=await checkCi(parseArguments([String(RUN)]),fixture(run(),[jobs()[0]]));assert.equal(incomplete.assessment.state,'incomplete_evidence');assert.equal(incomplete.assessment.allRequiredChecksPassed,false);
});

test('required test/build/deploy skipped or failed steps reject success, even while workflow cleanup is pending',async()=>{
  for(const [jobIndex,stepName,conclusion]of [[0,'Test game rules and assets','failure'],[0,'Build for the repository URL','skipped'],[1,'Publish website','cancelled']]){
    const rows=jobs();rows[jobIndex].steps.find(entry=>entry.name===stepName).conclusion=conclusion;const report=await checkCi(parseArguments([String(RUN)]),fixture(run({status:'in_progress',conclusion:null}),rows));assert.equal(report.assessment.state,'failure',stepName);assert.equal(report.assessment.allRequiredChecksPassed,false);
  }
});

test('wrong main SHA, branch, workflow, event or run ID fails before jobs are accepted',async()=>{
  for(const change of [{head_sha:OTHER},{head_branch:'feature'},{path:'.github/workflows/other.yml'},{event:'pull_request'},{id:RUN+1}])await assert.rejects(checkCi(parseArguments(['--run',String(RUN),'--commit',SHA]),fixture(run(change))));
});

test('job pagination retrieves the eventual deploy job without reading other endpoints',async()=>{
  const first=[jobs()[0],...Array.from({length:99},(_,i)=>({id:i+10,name:'auxiliary-'+i,status:'completed',conclusion:'success',steps:[]}))],routes=[];
  const report=await checkCi(parseArguments([String(RUN)]),{request:async route=>{routes.push(route);if(route===`runs/${RUN}`)return run();if(route.endsWith('page=1'))return {total_count:101,jobs:first};if(route.endsWith('page=2'))return {total_count:101,jobs:[jobs()[1]]};throw Error('Unexpected endpoint');}});assert.equal(report.jobs.length,101);assert.equal(report.assessment.state,'success');assert.equal(routes.length,3);
});

test('dispatch status explicitly separates workflow head identity from the stable release_ref checkout',async()=>{
  const report=await checkCi(parseArguments(['--run',String(RUN),'--commit',SHA]),fixture(run({event:'workflow_dispatch'})));assert.equal(report.assessment.state,'success');assert.equal(report.run.headSha,SHA);assert.match(report.identityBoundary,/release_ref checkout and deployed source are unverified/);assert.equal(Object.hasOwn(report,'deployedCommit'),false);
});

test('no exact matching run is explicit and produces no fake run/job success',async()=>{
  const report=await checkCi(parseArguments(['--commit',SHA]),{request:async()=>({workflow_runs:[run({head_sha:OTHER})]})});assert.equal(report.assessment.state,'not_found');assert.equal(report.run,null);assert.deepEqual(report.jobs,[]);
});

test('proof writes stay inside the isolated checkout and cannot overwrite a different deployment cycle',()=>{
  const directory=fs.mkdtempSync(path.join(REPO_ROOT,'tmp','v040-ci-test-')),file=path.join(directory,'proof.json');
  try{const report={run:{id:RUN},assessment:{state:'pending'}};writeProof(file,report);assert.equal(JSON.parse(fs.readFileSync(file)).run.id,RUN);writeProof(file,{...report,assessment:{state:'success'}});assert.throws(()=>writeProof(file,{run:{id:RUN+1}}),/another workflow run/);assert.throws(()=>writeProof(file,{run:null}),/another workflow run/);assert.throws(()=>writeProof('../outside.json',report),/inside this isolated/);assert.throws(()=>writeProof('data/balance.json',report),/evidence file/);assert.throws(()=>writeProof(path.join(directory,'x.txt'),report),/\.json/);}
  finally{const checked=path.resolve(directory),expectedParent=path.resolve(REPO_ROOT,'tmp')+path.sep;if(!checked.startsWith(expectedParent)||!path.basename(checked).startsWith('v040-ci-test-'))throw Error('Unsafe fixture cleanup target');fs.rmSync(checked,{recursive:true,force:true});}
});
