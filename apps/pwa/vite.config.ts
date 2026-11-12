import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import brand from '../../brand.json';
import { brandPlugin } from './brand';
import { facePreloadPlugin } from './face';

// HTTPS is required on phones for wake lock and a stable WebRTC secure context.
// `host: true` exposes the dev server on the LAN so phones can open it.
// `BASE_PATH` is the sub-path a static host serves the build from (GitHub Pages: `/Bezel/`).
// `brand.json` (the public name, pitch and address) fills in the page and writes the web manifest; the dev server
// gets its own address for the display face's preload (`face.ts`).
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env['BASE_PATH'] ?? '/') : '/',
  plugins: [basicSsl(), brandPlugin(brand), facePreloadPlugin()],
  server: { host: true, port: 5173 },
}));
