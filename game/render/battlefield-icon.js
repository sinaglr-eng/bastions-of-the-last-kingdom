import {DoubleSide,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace,Texture,TextureLoader} from 'three';

// The presentation owns this plane and its texture. Headless simulations still
// get the same selectable geometry without needing a DOM image decoder.
export function battlefieldIcon(url,size,{depthTest=false}={}){
 const texture=typeof Image==='function'&&globalThis.document?.createElementNS?new TextureLoader().load(url):new Texture();
 texture.name=url;texture.colorSpace=SRGBColorSpace;
 const material=new MeshBasicMaterial({map:texture,transparent:true,alphaTest:.015,depthTest,depthWrite:false,side:DoubleSide,toneMapped:false});
 return new Mesh(new PlaneGeometry(size,size),material);
}
