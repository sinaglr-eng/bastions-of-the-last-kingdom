// Prepare text-only changes on the current public head. Gallery files and
// original model/audio binaries are deliberately outside this publication set.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=process.cwd(),git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}),parent=git('rev-parse','origin/main').trim(),baseTree=git('rev-parse','origin/main^{tree}').trim();
const prior=new Map(git('ls-tree','-r','-z','origin/main').split('\0').filter(Boolean).map(row=>{const [meta,file]=row.split('\t');return [file,meta.split(' ')[2]];}));
const candidates=[],extensions=new Set(['.js','.mjs','.css','.ts','.json','.py','.ps1','.html','.sql','.md','.yaml','.yml','.csv']);
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const rel=(dir+'/'+e.name).replaceAll('\\','/');if(e.isDirectory()){if(!['node_modules','dist','__pycache__','.git','.sites-runtime'].includes(e.name))walk(rel);}else if(extensions.has(path.extname(e.name)))candidates.push(rel);}}
for(const dir of ['game','ui','backend','data','tests'])walk(dir);
candidates.push(...['fr010-auth-migration.mjs','package-runtime-assets.mjs','prepare-fr010-publication.mjs','prepare-statistics-site.mjs','serve.mjs','verify-fr010-template.mjs'].map(name=>'tools/'+name));
candidates.push('package.json','pnpm-lock.yaml','pnpm-workspace.yaml','vite.config.js','README.md','CHANGELOG.md','AGENTS.md','.gitattributes','.gitignore','.github/workflows/pages.yml','public/release.json','public/privacy.html','docs/FR010_IMPLEMENTATION.md','docs/PUBLIC_ACCOUNTS_SETUP.md','docs/RELEASE_RETENTION.md',...['deployment.json','result.json','public-verification.json','publication.json','public-browser.json'].map(name=>'output/implementation/release-current/'+name));
const changes=[];
for(const file of [...new Set(candidates)].sort()){
 if(!fs.existsSync(file))continue;if(file.startsWith('sites/')||/\.(glb|gltf|blend|fbx|obj|wav|mp3|zip|tar)$/i.test(file))throw Error('Forbidden publication file: '+file);
 const content=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),bytes=Buffer.from(content);if(bytes.includes(0))throw Error('Binary in text publication: '+file);
 const sha=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');if(prior.get(file)!==sha)changes.push({path:file,mode:'100644',type:'blob',content,expectedSha:sha});
}
const report={parent,baseTree,files:changes.length,bytes:changes.reduce((n,r)=>n+Buffer.byteLength(r.content),0),galleryFiles:0,modelOrAudioFiles:0,tree:changes};
fs.mkdirSync('artifacts/fr010-public',{recursive:true});fs.writeFileSync('artifacts/fr010-public/github-tree.json',JSON.stringify(report));
console.log(JSON.stringify({...report,tree:changes.map(({content,...r})=>({...r,bytes:Buffer.byteLength(content)}))},null,2));
