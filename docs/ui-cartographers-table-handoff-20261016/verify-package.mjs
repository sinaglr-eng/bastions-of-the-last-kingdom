// Verifies documentation capture; does not run or modify the game.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('./',import.meta.url)),repo=fileURLToPath(new URL('../../',import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(here,f))),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source=read('SOURCE_BASELINE.json'),changed=[];
for(const [f,expected]of Object.entries(source.files))if(hash(path.join(repo,f))!==expected)changed.push(f);
assert.deepEqual(changed,[],'Game or production assets changed during handoff preparation');
const selection=read('SELECTED_CONCEPTS.json'),art=read('PORTRAIT_SOURCES.json'),requirements=read('REQUIREMENTS.json'),approval=read('APPROVAL_RECORD.json');
assert.equal(selection.screens.length,22);assert.equal(art.rows.length,136);assert.equal(requirements.requirements.length,40);
for(const row of [...selection.screens,...art.rows])assert.equal(hash(path.join(here,row.file)),row.sha256,row.file);
for(const row of art.rows){assert.equal(hash(path.join(repo,row.source)),row.sha256,row.source);assert(!row.source.includes('/portraits/'),'Model-render portrait incorrectly selected');assert(row.plannedUiFile.startsWith('assets/ui/reference-portraits/'));}
assert.equal(art.uniqueFiles,107);
assert.equal(approval.authorization.implementGameInThisChat,false);assert.equal(approval.authorization.deployInThisChat,false);assert.equal(approval.authorization.messageMasterChat,false);
const acceptance=fs.readFileSync(path.join(here,'ACCEPTANCE.md'),'utf8'),cases=new Set([...acceptance.matchAll(/\| (A\d+) \|/g)].map(m=>m[1]));
assert.equal(cases.size,29);
const covered=new Set();for(const r of requirements.requirements){assert(r.acceptance.length,r.id);for(const id of r.acceptance){assert(cases.has(id),r.id+' references missing '+id);covered.add(id);}}
assert.equal(covered.size,cases.size,'Acceptance scenario lacks requirement mapping');
const missingLinks=[];let linkCount=0;
for(const f of fs.readdirSync(here).filter(f=>f.endsWith('.md'))){const text=fs.readFileSync(path.join(here,f),'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/g)){const ref=m[1].split('#')[0];if(!ref||/^(https?:|mailto:)/.test(ref))continue;linkCount++;if(!fs.existsSync(path.resolve(here,ref)))missingLinks.push({file:f,target:ref});}}
// The archive is created after this verified capture and is intentionally outside the package.
const unresolved=missingLinks.filter(l=>!l.target.endsWith('cartographer-ui-handoff-20261016-v1.zip')&&l.target!=='PACKAGE_VERIFICATION.json');
assert.deepEqual(unresolved,[],'Missing handoff documentation link');
const files=[];function walk(dir=''){for(const e of fs.readdirSync(path.join(here,dir),{withFileTypes:true})){const file=dir?dir+'/'+e.name:e.name;if(e.isDirectory())walk(file);else if(!['PACKAGE_MANIFEST.json','PACKAGE_VERIFICATION.json'].includes(file))files.push(file);}}
walk();
fs.writeFileSync(path.join(here,'PACKAGE_MANIFEST.json'),JSON.stringify({date:'2026-10-16',scope:'All packaged files except this manifest and the verification receipt',files:Object.fromEntries(files.sort().map(f=>[f,hash(path.join(here,f))]))},null,2)+'\n');
const result={date:'2026-10-16',status:'PREPARATION VERIFIED; GAME NOT IMPLEMENTED OR DEPLOYED',sourceVersion:source.version,protectedFilesChecked:Object.keys(source.files).length,protectedFilesUnchanged:true,selectedScreensVerified:selection.screens.length,portraitIdentitiesVerified:art.rows.length,uniqueOriginalRastersVerified:art.uniqueFiles,requirements:requirements.requirements.length,acceptanceScenarios:cases.size,allAcceptanceScenariosMapped:true,localDocumentLinksChecked:linkCount,documentLinksValid:true,archiveCreatedBySeparatePackagingStep:true,galleryCopy:'English; historical prompts and original human wording preserved separately',gameTestsRun:false,gameBuildRun:false,reason:'Only preparation documents, immutable reference copies and gallery approval status changed; new-game acceptance is defined for the future authorized implementation.'};
fs.writeFileSync(path.join(here,'PACKAGE_VERIFICATION.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
