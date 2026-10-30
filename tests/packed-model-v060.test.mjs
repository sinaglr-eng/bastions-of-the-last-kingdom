import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {decodedModelBytes} from '../game/render/packed-model.js';
const manifest=JSON.parse(readFileSync(new URL('../public/assets/factions/v060/manifest.json',import.meta.url)));
for(const faction of ['crown','forge','grove'])test(`${faction}: native and portable gzip decoders reproduce the exact approved GLB bytes`,async()=>{
 const entry=manifest.assets.find(a=>a.file.includes('/'+faction+'/')),packed=readFileSync(new URL('../public/'+entry.packedFile,import.meta.url)),expected=gunzipSync(packed),native=globalThis.DecompressionStream;
 try{for(const decoder of [native,undefined]){globalThis.DecompressionStream=decoder;const actual=await decodedModelBytes(new Response(packed),{sha256:entry.sha256});assert.deepEqual(Buffer.from(actual),expected);}await assert.rejects(decodedModelBytes(new Response(packed),{sha256:'0'.repeat(64)}),/integrity/);const aborted=new AbortController();aborted.abort();await assert.rejects(decodedModelBytes(new Response(packed),{signal:aborted.signal}),/cancelled/);}finally{globalThis.DecompressionStream=native;}
});
test('model decoding rejects unavailable content, invalid GLB headers and a damaged gzip stream',async()=>{await assert.rejects(decodedModelBytes(new Response('missing',{status:404})),/unavailable/);await assert.rejects(decodedModelBytes(new Response(new Uint8Array(40))),/Invalid/);await assert.rejects(decodedModelBytes(new Response(new Uint8Array([31,139,1,2,3,4]))));});
