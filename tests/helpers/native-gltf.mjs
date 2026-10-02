import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';

// Node geometry/rig checks don't have a DOM image decoder. Preserve texture
// bindings and verify actual embedded PNG data; pixels are reviewed in Blender
// and the real browser, which use the normal unmodified GLTFLoader.
export class NativeTestGLTFLoader extends GLTFLoader {
  constructor(...args) {
    super(...args);
    if(typeof document==='undefined')this.register(parser=>({
      name:'NativeTestEmbeddedTextures',
      async loadTexture(index){
        const definition=parser.json.textures[index];
        const image=parser.json.images[definition.source];
        assert.equal(image.mimeType,'image/png','Native PBR textures must be embedded PNGs');
        assert.ok(Number.isInteger(image.bufferView),'Texture must travel in the GLB');
        const bytes=new Uint8Array(await parser.getDependency('bufferView',image.bufferView));
        assert.deepEqual(Array.from(bytes.slice(0,8)),[137,80,78,71,13,10,26,10]);
        assert.ok(bytes.length>64,'Empty authored PBR texture');
        const texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);
        texture.name=image.name||definition.name||'Embedded native PBR texture';
        texture.flipY=false;texture.needsUpdate=true;
        return texture;
      },
    }));
  }
}
