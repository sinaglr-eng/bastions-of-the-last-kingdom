import {defineConfig} from 'vite';
import {packageRuntimeAssets} from './tools/package-runtime-assets.mjs';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins:[{name:'current-release-media',apply:'build',closeBundle(){packageRuntimeAssets();}}],
  build: {copyPublicDir:false,rollupOptions:{input:{game:'index.html'},output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/loaders/GLTFLoader.js','three/addons/utils/BufferGeometryUtils.js']}}}},
});
