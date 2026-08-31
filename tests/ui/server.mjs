// Isolated UI preview: real page components, fake data, no Next server or production auth.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const here = fileURLToPath(new URL('./', import.meta.url));
const server = await createServer({
  configFile: false,
  envDir: false,
  root: here,
  publicDir: path.join(root, 'public'),
  cacheDir: path.join(root, '.local-verification/vite-cache'),
  resolve: { alias: [
    { find: 'next/navigation', replacement: path.join(here, 'navigation.js') },
    { find: 'next/link', replacement: path.join(here, 'link.jsx') },
    { find: '@/lib/supabaseClient', replacement: path.join(here, 'auth.js') },
    { find: '@', replacement: path.join(root, 'src') },
  ] },
  esbuild: { jsx: 'automatic' },
  define: { 'process.env.NEXT_PUBLIC_WORKSPACE_ID': JSON.stringify('ui-test-only'), 'process.env.NODE_ENV': JSON.stringify('development') },
  css: { postcss: root },
  server: { host: '127.0.0.1', port: 4179, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
server.printUrls();
