import {defineConfig} from 'vite';
import {packageRuntimeAssets} from './tools/package-runtime-assets.mjs';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  server:{proxy:{'/api':{target:process.env.LOCAL_PLAYER_API||'http://127.0.0.1:4180',changeOrigin:false}}},
  plugins:[{name:'public-game-entry',apply:'build',transformIndexHtml(){const target=process.env.VITE_PUBLIC_GAME_URL;if(!target)return [];const url=new URL(target);if(url.protocol!=='https:')throw Error('Public game URL must use HTTPS.');return [{tag:'script',children:`if(location.origin==='https://sinaglr-eng.github.io')location.replace(${JSON.stringify(url.href)}+location.search+location.hash);`,injectTo:'head-prepend'}];}},{name:'current-release-media',apply:'build',closeBundle(){packageRuntimeAssets();}}],
  build: {copyPublicDir:false,rollupOptions:{input:{game:'index.html'},output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/loaders/GLTFLoader.js','three/addons/utils/BufferGeometryUtils.js']}}}},
});
