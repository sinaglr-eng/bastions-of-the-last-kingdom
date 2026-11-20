import * as THREE from 'three';
import {siteUrl} from '../site-url.js';

const custom=id=>'war-table/ui-icons/'+id+'.webp';
const status=id=>custom('status-'+id);
const glyphs={
 clock:'hud-generated/time.webp',blade:'commander-generated/skill-blood-wrath.webp',
 arrows:'commander-generated/skill-extended-range.webp',shield:'commander-feedback/basic-defenders.webp',
 target:custom('target'),spiral:status('dread'),brokenSword:status('disarmed'),
 crack:status('broken-barricade'),moon:status('melancholy'),snowflake:custom('snow'),
 brokenStar:status('stunned'),diamond:status('arcane-ward'),drop:status('blood-drop'),
 flame:custom('fire'),brokenShield:status('fractured-shield'),cross:status('healing-blocked')
};
export function supportArtwork(glyph,key){
 const asset=key==='poison'?custom('flask'):glyphs[glyph]||glyphs.target;
 return siteUrl('assets/ui/'+asset);
}

// Instantiate once per active renderer. A hidden effect never starts a download.
export function applyStatusTexture(material,src,textures){
 if(material.map)return;
 let texture=textures.get(src);
 if(!texture){
  texture=typeof document==='undefined'?new THREE.Texture():new THREE.TextureLoader().load(src);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.userData.source=src;
  textures.set(src,texture);
 }
 material.map=texture;
 material.needsUpdate=true;
}
