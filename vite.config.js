import { defineConfig } from 'vite';

// Build statique déployable sur tout hébergeur de fichiers (Cloudflare Pages, Netlify, Vercel, GitHub Pages…).
// Build command: npm run build  |  Output dir: dist
export default defineConfig({
  plugins: [],
  // Identifiant de build (horodatage) injecté pour détecter les nouvelles versions.
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
  server: {
    port: 5173,
    open: true,
  },
});
