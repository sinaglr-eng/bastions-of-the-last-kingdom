// Prepare a clean, credential-free Sites template from the canonical backend.
import {mkdir,copyFile,writeFile,readFile,cp,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const gameVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const destination=path.resolve(process.argv[2]||path.join(root,'artifacts/statistics-template'));
await mkdir(destination,{recursive:true});
for(const dir of ['backend','data','db','.openai'])await mkdir(path.join(destination,dir),{recursive:true});
for(const file of ['worker.js','validation.js','service-page.js'])await copyFile(path.join(root,'backend',file),path.join(destination,'backend',file));
for(const file of ['towers.json','waves.json','enemies.json'])await copyFile(path.join(root,'data',file),path.join(destination,'data',file));
await copyFile(path.join(root,'backend/sites-db-schema.ts'),path.join(destination,'db/schema.ts'));
try{await access(path.join(root,'backend/drizzle'));await cp(path.join(root,'backend/drizzle'),path.join(destination,'drizzle'),{recursive:true});}catch{}
await writeFile(path.join(destination,'package.json'),JSON.stringify({name:'bastions-statistics',version:gameVersion,private:true,type:'module',packageManager:'pnpm@11.25.0',scripts:{build:'node build.mjs','db:generate':'drizzle-kit generate'},dependencies:{'drizzle-orm':'0.45.2'},devDependencies:{'drizzle-kit':'0.31.10',esbuild:'0.25.12'}},null,2)+'\n');
await writeFile(path.join(destination,'pnpm-workspace.yaml'),'allowBuilds:\n  esbuild: true\n');
await writeFile(path.join(destination,'drizzle.config.ts'),"import {defineConfig} from 'drizzle-kit';\nexport default defineConfig({schema:'./db/schema.ts',out:'./drizzle',dialect:'sqlite'});\n");
await writeFile(path.join(destination,'.openai/hosting.json'),JSON.stringify({d1:'DB',r2:null},null,2)+'\n');
await writeFile(path.join(destination,'.gitignore'),'node_modules/\ndist/\n.sites-runtime/\n.env*\n*.sqlite*\n*.log\n');
await writeFile(path.join(destination,'build.mjs'),`import {build} from 'esbuild';
import {mkdir,cp} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});
await build({entryPoints:['backend/worker.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
await cp('.openai','dist/.openai',{recursive:true});
await cp('drizzle','dist/drizzle',{recursive:true});
console.log('Built statistics Worker and D1 migrations.');
`);
console.log('Prepared clean template: '+destination);
