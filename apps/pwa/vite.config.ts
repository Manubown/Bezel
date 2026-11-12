import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';
import brand from '../../brand.json';
import { brandPlugin } from './brand';

// HTTPS is required on phones for wake lock and a stable WebRTC secure context.
// `host: true` exposes the dev server on the LAN so phones can open it.
// `BASE_PATH` is the sub-path a static host serves the build from (GitHub Pages: `/Bezel/`).
// `brand.json` (the public name, pitch and address) fills in the page and writes the web manifest.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? (process.env['BASE_PATH'] ?? '/') : '/',
  plugins: [basicSsl(), brandPlugin(brand)],
  server: { host: true, port: 5173 },
}));
