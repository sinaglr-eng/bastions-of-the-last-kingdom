import {defineConfig} from 'vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  build: {rollupOptions:{input:{game:'index.html',archer:'archer.html'},output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js','three/addons/loaders/GLTFLoader.js','three/addons/utils/BufferGeometryUtils.js']}}}},
});
