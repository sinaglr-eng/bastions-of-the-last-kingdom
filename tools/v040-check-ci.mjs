import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const REPOSITORY='sinaglr-eng/bastions-of-the-last-kingdom';
export const WORKFLOW='pages.yml';
export const REPO_ROOT=fileURLToPath(new URL('../',import.meta.url));
const API=`https://api.github.com/repos/${REPOSITORY}/actions/`;
const shaPattern=/^[0-9a-f]{40}$/i;
const positiveId=value=>/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0;
const REQUIRED_STEPS={build:['Test game rules and assets','Build for the repository URL','Upload website'],deploy:['Publish website']};

export function parseArguments(args){
  const options={runId:null,commit:null,latestMain:false,proof:null};
  const valueAt=(index,flag)=>{const value=args[index+1];if(!value||value.startsWith('--'))throw Error(`Missing ${flag} value`);return value;};
  for(let i=0;i<args.length;i++){
    const arg=args[i];
    if(arg==='--run'){if(options.runId)throw Error('Run specified twice');options.runId=valueAt(i,arg);i++;}
    else if(arg==='--commit'){if(options.commit)throw Error('Commit specified twice');options.commit=valueAt(i,arg);i++;}
    else if(arg==='--proof'){if(options.proof)throw Error('Proof specified twice');options.proof=valueAt(i,arg);i++;}
    else if(arg==='--latest-main')options.latestMain=true;
    else if(arg==='--help'||arg==='-h')return {help:true};
    else if(positiveId(arg)&&!options.runId)options.runId=arg;
    else if(shaPattern.test(arg)&&!options.commit)options.commit=arg;
    else throw Error('Unknown or invalid argument');
  }
  if(options.runId&&!positiveId(options.runId))throw Error('Run ID must be a positive safe integer');
  if(options.commit&&!shaPattern.test(options.commit))throw Error('Commit must be an exact 40-character SHA');
  if(options.latestMain&&(options.runId||options.commit))throw Error('--latest-main cannot be combined with a run or exact commit');
  if(!options.runId&&!options.commit&&!options.latestMain)throw Error('Specify --run ID, --commit FULL_SHA or --latest-main');
  if(options.commit)options.commit=options.commit.toLowerCase();
  return options;
}

export async function publicGet(relative,{fetchImpl=fetch}={}){
  const url=new URL(relative,API);
  if(url.protocol!=='https:'||url.hostname!=='api.github.com'||url.username||url.password||!url.pathname.startsWith(`/repos/${REPOSITORY}/actions/`))throw Error('Only this public GitHub Actions API is allowed');
  const response=await fetchImpl(url.href,{method:'GET',redirect:'error',cache:'no-store',headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Bastions-read-only-CI-check','Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});
  if(!response.ok){
    const reset=response.headers?.get?.('x-ratelimit-reset'),remaining=response.headers?.get?.('x-ratelimit-remaining');
    const detail=remaining==='0'&&/^\d+$/.test(reset||'')?`; public rate limit resets at ${new Date(Number(reset)*1000).toISOString()}`:'';
    throw Error(`GitHub public API HTTP ${response.status}${detail}`);
  }
  return response.json();
}

const compactStep=step=>({number:step.number,name:step.name,status:step.status,conclusion:step.conclusion??null,startedAt:step.started_at??null,completedAt:step.completed_at??null});
const compactJob=job=>({id:job.id,name:job.name,status:job.status,conclusion:job.conclusion??null,url:job.html_url??null,startedAt:job.started_at??null,completedAt:job.completed_at??null,steps:(job.steps||[]).map(compactStep)});
function assess(run,jobs){
  const reasons=[],checks=[];
  for(const [jobName,steps]of Object.entries(REQUIRED_STEPS)){
    const job=jobs.find(job=>job.name===jobName),jobOkay=job?.status==='completed'&&job.conclusion==='success';
    checks.push({job:jobName,status:job?.status??'not_reported',conclusion:job?.conclusion??null,passed:!!jobOkay});
    for(const name of steps){const step=job?.steps.find(step=>step.name===name);checks.push({job:jobName,step:name,status:step?.status??'not_reported',conclusion:step?.conclusion??null,passed:step?.status==='completed'&&step.conclusion==='success'});}
  }
  const failedRequired=checks.some(check=>check.status==='completed'&&check.conclusion!=='success');
  let state=failedRequired?'failure':'pending';
  if(failedRequired)reasons.push('A required job or step did not succeed');
  if(run.status==='completed'&&run.conclusion!=='success'){state='failure';reasons.push(`Workflow concluded ${run.conclusion||'without a conclusion'}`);}
  else if(run.status==='completed'&&checks.every(check=>check.passed))state='success';
  else if(run.status==='completed'){
    const terminalFailure=checks.some(check=>check.status==='completed'&&check.conclusion!=='success');
    state=terminalFailure?'failure':'incomplete_evidence';reasons.push('Completed workflow lacks complete successful tests/build/upload/deploy evidence');
  }
  const failedSteps=jobs.flatMap(job=>job.steps.filter(step=>step.status==='completed'&&step.conclusion&&!['success','skipped'].includes(step.conclusion)).map(step=>({job:job.name,step:step.name,conclusion:step.conclusion})));
  return {state,allRequiredChecksPassed:checks.every(check=>check.passed),checks,failedSteps,reasons};
}

export async function checkCi(options,{request=publicGet,now=()=>new Date().toISOString()}={}){
  let runId=options.runId,selected=null;
  if(!runId){
    const query=new URLSearchParams({branch:'main',per_page:'100',...(options.commit?{head_sha:options.commit,event:'push'}:{})});
    const listing=await request(`workflows/${WORKFLOW}/runs?${query}`);
    if(!Array.isArray(listing.workflow_runs))throw Error('Malformed public workflow run list');
    selected=listing.workflow_runs.filter(run=>run.head_branch==='main'&&(!options.commit||run.event==='push'&&run.head_sha?.toLowerCase()===options.commit)).sort((a,b)=>Number(b.id)-Number(a.id))[0];
    if(!selected)return {schemaVersion:1,repository:REPOSITORY,workflow:WORKFLOW,checkedAt:now(),requested:{runId:null,commit:options.commit??null,latestMain:!!options.latestMain},assessment:{state:'not_found',allRequiredChecksPassed:false,reasons:['No matching Pages main workflow run is reported yet']},run:null,jobs:[]};
    runId=selected.id;
  }
  const run=await request(`runs/${runId}`);
  if(!positiveId(run.id)||String(run.id)!==String(runId))throw Error('Returned workflow run ID does not match the requested run');
  if(run.head_branch!=='main')throw Error('Run is not for branch main');
  if(String(run.path||'').split('@')[0]!=='.github/workflows/pages.yml')throw Error('Run is not the Pages workflow');
  if(!shaPattern.test(run.head_sha||''))throw Error('Run has no valid full workflow head SHA');
  if(options.commit&&run.head_sha.toLowerCase()!==options.commit.toLowerCase())throw Error('Workflow head SHA does not match the exact requested main commit');
  if(!['push','workflow_dispatch'].includes(run.event))throw Error('Unexpected workflow event');
  const rawJobs=[];
  for(let page=1;page<=100;page++){
    const batch=await request(`runs/${run.id}/jobs?per_page=100&filter=latest&page=${page}`);
    if(!Array.isArray(batch.jobs))throw Error('Malformed public jobs list');
    rawJobs.push(...batch.jobs);
    if(batch.jobs.length<100||Number.isFinite(batch.total_count)&&rawJobs.length>=batch.total_count)break;
    if(page===100)throw Error('Jobs pagination exceeded its bounded limit');
  }
  const jobs=[...new Map(rawJobs.map(job=>[job.id,compactJob(job)])).values()];
  return {schemaVersion:1,repository:REPOSITORY,workflow:WORKFLOW,checkedAt:now(),requested:{runId:options.runId?Number(options.runId):null,commit:options.commit??null,latestMain:!!options.latestMain},run:{id:run.id,attempt:run.run_attempt??null,name:run.name,url:run.html_url,event:run.event,headBranch:run.head_branch,headSha:run.head_sha,status:run.status,conclusion:run.conclusion??null,createdAt:run.created_at??null,updatedAt:run.updated_at??null,startedAt:run.run_started_at??null},assessment:assess(run,jobs),jobs,identityBoundary:run.event==='workflow_dispatch'?'headSha identifies the main workflow context; release_ref checkout and deployed source are unverified by this status checker. Verify the recorded checkout identity and served compiled hashes separately.':'headSha identifies the push workflow context; served compiled hashes and current deployment still need separate verification.'};
}

export function writeProof(requestedFile,report){
  const target=path.resolve(REPO_ROOT,requestedFile),relative=path.relative(REPO_ROOT,target);
  const portable=relative.replaceAll('\\','/'),evidencePath=portable.startsWith('tmp/')||portable.startsWith('output/design/cartographer-ui-v040-20261016/');
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!evidencePath||path.extname(target)!=='.json')throw Error('Proof must be a .json evidence file inside this isolated checkout tmp or v040 output folder');
  for(let parent=path.dirname(target);parent!==path.resolve(REPO_ROOT);parent=path.dirname(parent))if(fs.existsSync(parent)&&fs.lstatSync(parent).isSymbolicLink())throw Error('Proof cannot pass through a filesystem link');
  if(fs.existsSync(target)){
    const old=JSON.parse(fs.readFileSync(target,'utf8'));
    if(old.run?.id&&old.run.id!==report.run?.id)throw Error('Proof path belongs to another workflow run; use separate proof paths for each deployment cycle');
  }
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');return relative.replaceAll('\\','/');
}

const HELP=`Read-only public Pages CI snapshot. No authentication, dispatch, polling or deployment.\n\nnode tmp/v040-check-ci.mjs --run RUN_ID [--commit FULL_MAIN_SHA] [--proof output/path.json]\nnode tmp/v040-check-ci.mjs --commit FULL_MAIN_SHA [--proof output/path.json]\nnode tmp/v040-check-ci.mjs --latest-main [--proof output/path.json]\n\nA positional run ID or full SHA also works. Commit-only lookup chooses the latest main push run for that SHA; use explicit run IDs for rollback/final dispatch runs. Use a distinct proof path per cycle.\nExit: 0 pending/success/incomplete snapshot, 1 failure/API/identity error, 2 invalid arguments, 3 no matching run yet.\nRepeat manually at 45–60 second intervals; public requests are rate limited.\nDispatch headSha is the workflow context, not proof of the release_ref checked-out code.\n`;
export async function runCli(args=process.argv.slice(2)){
  let options;try{options=parseArguments(args);}catch(error){console.error(JSON.stringify({error:error.message,usage:'Use --help'}));return 2;}
  if(options.help){console.log(HELP);return 0;}
  try{const report=await checkCi(options);if(options.proof)report.proofFile=writeProof(options.proof,report);console.log(JSON.stringify(report));return report.assessment.state==='failure'?1:report.assessment.state==='not_found'?3:0;}
  catch(error){console.error(JSON.stringify({error:error.message}));return 1;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await runCli();
