import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig } from 'vite';

// HTTPS is required on phones for wake lock and a stable WebRTC secure context.
// `host: true` exposes the dev server on the LAN so phones can open it.
export default defineConfig({
  plugins: [basicSsl()],
  server: { host: true, port: 5173 },
});
