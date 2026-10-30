import {gunzipSync} from 'three/addons/libs/fflate.module.js';
import {releaseAsset} from '../release.js';

// Transport compression only: vertices, materials, embedded textures, skins and
// animation samples are byte-for-byte identical after decompression.
export async function decodedModelBytes(response,{sha256,signal}={}){
 if(!response.ok)throw Error(`Model content unavailable (HTTP ${response.status}).`);
 let bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]===0x1f&&bytes[1]===0x8b){
  if(typeof DecompressionStream==='function')bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  else bytes=gunzipSync(bytes);
 }
 if(signal?.aborted)throw Error('Selection cancelled.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)throw Error('Invalid defender content.');
 if(sha256){const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==sha256)throw Error('Approved model integrity check failed.');}
 return bytes;
}
export async function loadPackedModel(loader,entry){
 const url=releaseAsset(entry.packedFile),bytes=await decodedModelBytes(await fetch(url),entry);
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),new URL('.',new URL(url,globalThis.location?.href||'http://localhost/')).href);
}
