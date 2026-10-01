// Windows equivalent of Sites' Bash packager, using its shared build validator.
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,copyFileSync,cpSync,readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
const [projectArg,archiveArg,validatorArg]=process.argv.slice(2);
if(!projectArg||!archiveArg||!validatorArg)throw new Error('Provide Site checkout, absolute archive path and Sites prepare-site-build.cjs.');
const project=realpathSync(projectArg),archive=path.resolve(archiveArg),stage=mkdtempSync(path.join(path.dirname(archive),'statistics-package-'));
const run=(cmd,args)=>{const result=spawnSync(cmd,args,{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr||'Packaging failed.');return result.stdout;};
const kind=run(process.execPath,[validatorArg,project,path.join(stage,'dist')]).trim();
if(kind!=='worker')throw new Error('Expected a validated Worker build.');
mkdirSync(path.join(stage,'dist/.openai'),{recursive:true});
const hosting=JSON.parse(readFileSync(path.join(project,'.openai/hosting.json'),'utf8'));
if(!hosting.project_id||hosting.d1!=='DB')throw new Error('Missing Site identity or statistics binding.');
copyFileSync(path.join(project,'.openai/hosting.json'),path.join(stage,'dist/.openai/hosting.json'));
cpSync(path.join(project,'drizzle'),path.join(stage,'dist/.openai/drizzle'),{recursive:true});
run('tar',['-C',stage,'-czf',archive,'dist']);
const entries=run('tar',['-tzf',archive]).trim().split(/\r?\n/);
for(const required of ['dist/.openai/hosting.json','dist/server/index.js','dist/.openai/drizzle/meta/_journal.json'])if(!entries.includes(required))throw new Error('Archive missing '+required);
console.log(JSON.stringify({archive,files:entries.length,validated:true}));
