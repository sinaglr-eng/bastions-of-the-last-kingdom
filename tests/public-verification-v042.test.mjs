import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyPublic} from '../tools/verify-v042-public.mjs';

const bytes=path=>readFileSync(new URL(`../${path}`,import.meta.url));
const base='https://example.test/project/';
const manifestBytes=bytes('public/assets/ui/reference-cutouts/manifest.json'),manifest=JSON.parse(manifestBytes),manifestSha256=createHash('sha256').update(manifestBytes).digest('hex');
const crimsonBytes=bytes('public/assets/ui/portrait-variants/manifest.json'),crimsonManifest=JSON.parse(crimsonBytes);
const release={version:'0.4.2',uiRevision:'cartographer-refined-20261018-v3',uiPortraitRevision:manifest.revision,uiEnemyPortraitRevision:crimsonManifest.revision};
const javascript=Buffer.from('assets/ui/reference-cutouts/ reference-cutouts-20261016-v1 atlas-book catalog-index-page catalog-reading-page warbands-atlas folio-construction-seal catalog-selected-heading warband-story host_50-crimson folio-champion-context data-effective-stats');
const css=Buffer.from('--folio-grain --folio-frame book-corners catalog-reading-page catalog-bookmark preparation-folio catalog-heading-pin is-compact-external folio-create-actions');
const indexHtml=Buffer.from('<!doctype html>\n<html><head><script type="module" src="./assets/index-fixture.js"></script><link rel="stylesheet" href="./assets/index-fixture.css"></head></html>');
const localBuild={indexHtml,assets:{'assets/index-fixture.js':javascript,'assets/index-fixture.css':css}};

function fixture(overrides={}){
  const files=new Map([['release.json',Buffer.from(JSON.stringify(release))],['index.html',indexHtml],['assets/index-fixture.js',javascript],['assets/index-fixture.css',css],['assets/ui/reference-cutouts/manifest.json',manifestBytes],['assets/ui/portrait-variants/manifest.json',crimsonBytes],...manifest.identities.map(row=>[row.output.replace(/^public\//,''),bytes(row.output)]),[crimsonManifest.output.replace(/^public\//,''),bytes(crimsonManifest.output)]]);
  for(const [file,value]of Object.entries(overrides))files.set(file,value);
  const requests=[];
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),options});
    const pathname=new URL(url).pathname.replace(/^\/project\//,''),body=files.get(pathname);
    const mime=pathname.endsWith('.png')?'image/png':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.html')?'text/html':'application/json';
    return new Response(body||'',{status:body?200:404,headers:{'content-type':mime}});
  };
  return {fetchImpl,requests};
}
const verify=options=>verifyPublic({base,manifest,manifestSha256,crimsonManifest,localBuild,...options});

test('0.4.2 public checker verifies immutable 136 portraits, active crimson PNG and exact compiled build with credential-free GETs',async()=>{
  const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl});
  assert.equal(report.status,'passed');assert.equal(report.portraits.passed,136);assert.equal(report.portraits.exactHashes,136);assert.equal(report.crimson.passed,1);assert.equal(report.crimson.rgbaHeader,true);assert.deepEqual(report.crimson.dimensions,[426,422]);assert.equal(report.localBuildComparison.status,'passed');assert.equal(report.localBuildComparison.exactHashes,2);
  assert.equal(requests.length,143);assert.ok(requests.every(({options,url})=>options.method==='GET'&&options.credentials==='omit'&&options.redirect==='error'&&options.cache==='no-store'&&url.startsWith(base)&&new URL(url).searchParams.has('verify')));
});

test('release metadata mismatch stops verification before any bulk assets or compiled requests',async()=>{
  const {fetchImpl,requests}=fixture({'release.json':Buffer.from(JSON.stringify({...release,version:'0.4.1'}))}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(requests.length,1);assert.equal(report.portraits.checked,0);assert.ok(report.failures.some(row=>row.error.includes('Expected version=0.4.2')));
});

test('Git LF/CRLF checkout differences preserve the same immutable manifest record and production HTML',async()=>{
  const {fetchImpl}=fixture({'index.html':Buffer.from(indexHtml.toString('utf8').replaceAll('\n','\r\n')),'assets/ui/reference-cutouts/manifest.json':Buffer.from(JSON.stringify(manifest,null,2)+'\n')}),report=await verify({fetchImpl});
  assert.equal(report.status,'passed');assert.equal(report.localBuildComparison.index,true);assert.equal(report.portraits.passed,136);
});

test('exact local bundle comparison detects a stale compiled response even if all required UI markers still exist',async()=>{
  const {fetchImpl}=fixture({'assets/index-fixture.js':Buffer.concat([javascript,Buffer.from(' stale')])}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.localBuildComparison.status,'failed');assert.ok(report.failures.some(row=>row.error.includes('Public compiled bytes differ')));
});

test('crimson portrait corruption fails independently of the unchanged original 136 portraits',async()=>{
  const damaged=Buffer.from(bytes(crimsonManifest.output));damaged[damaged.length-1]^=1;
  const {fetchImpl}=fixture({[crimsonManifest.output.replace(/^public\//,'')]:damaged}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,0);assert.ok(report.failures.some(row=>row.error.includes('Crimson PNG SHA-256 differs')));
});

test('missing final local build and changed immutable manifest are rejected before network requests',async()=>{
  for(const override of [{localBuild:null},{manifest:{...manifest,algorithm:'changed record'}}]){
    const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl,...override});assert.equal(report.status,'failed');assert.equal(requests.length,0);
  }
});
