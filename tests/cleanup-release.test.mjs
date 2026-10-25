import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('../tools/clean-old-builds.ps1',import.meta.url));
const available=spawnSync('pwsh',['-NoProfile','-Command','$PSVersionTable.PSVersion.Major'],{encoding:'utf8',windowsHide:true}).status===0;
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'bastions-cleanup-'));
 t.after(()=>{assert.ok(path.basename(root).startsWith('bastions-cleanup-'));fs.rmSync(root,{recursive:true,force:true});});
 const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};git('init','-q');
 const old=path.join(root,'tmp/v19-local-dist');fs.mkdirSync(old,{recursive:true});fs.writeFileSync(path.join(old,'index.html'),'old build');fs.writeFileSync(path.join(old,'release.json'),JSON.stringify({version:'0.3.18'}));
 const archive=path.join(root,'backups/releases/v0.5.0');fs.mkdirSync(archive,{recursive:true});
 const archives=['source','production'].map(kind=>{const f=path.join(archive,`bastions-v0.5.0-${kind}.zip`);fs.writeFileSync(f,kind);return{path:f,sha256:sha(f)};});
 const proof=path.join(root,'verified.json');
 const run=(value,apply=true)=>{fs.writeFileSync(proof,JSON.stringify(value));return spawnSync('pwsh',['-NoProfile','-File',script,'-WorkspaceRoots',root,...apply?['-Apply','-VerifiedArchiveProof',proof]:[]],{encoding:'utf8',windowsHide:true,timeout:30000});};
 return{root,old,archives,proof,git,run,valid:{status:'passed',version:'0.5.0',archiveVerified:true,archives}};
}
test('cleanup preview is read-only and successful apply retains the current archive pair',{skip:!available},t=>{const f=fixture(t);let r=f.run(f.valid,false);assert.equal(r.status,0,r.stderr);assert.ok(fs.existsSync(f.old));r=f.run(f.valid);assert.equal(r.status,0,r.stderr);assert.ok(!fs.existsSync(f.old));for(const row of f.archives)assert.ok(fs.existsSync(row.path));});
for(const [name,change]of Object.entries({missing:v=>{delete v.archives;},empty:v=>{v.archives=[];},single:v=>{v.archives.pop();},duplicate:v=>{v.archives[1]=v.archives[0];},stringBoolean:v=>{v.archiveVerified='true';},changedHash:v=>{v.archives[0].sha256='0'.repeat(64);},invalidHash:v=>{v.archives[0].sha256='not-a-hash';}}))test(`cleanup rejects ${name} archive evidence before removing any path`,{skip:!available},t=>{const f=fixture(t),v=structuredClone(f.valid);change(v);const r=f.run(v);assert.notEqual(r.status,0);assert.ok(fs.existsSync(f.old));});
test('cleanup refuses tracked old build contents',{skip:!available},t=>{const f=fixture(t);f.git('add','tmp');const r=f.run(f.valid);assert.notEqual(r.status,0);assert.ok(fs.existsSync(f.old));});
test('cleanup refuses a current archive inside a cleanup candidate',{skip:!available},t=>{const f=fixture(t);const target=path.join(f.old,'bastions-v0.5.0-source.zip');fs.copyFileSync(f.archives[0].path,target);f.valid.archives[0]={path:target,sha256:sha(target)};const r=f.run(f.valid);assert.notEqual(r.status,0);assert.ok(fs.existsSync(f.old));});
