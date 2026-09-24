import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root: here, publicDir: repo + 'public', envDir: here,
  resolve: { alias: [
    { find: '@/lib/supabaseClient', replacement: here + 'auth.mjs' },
    { find: 'next/navigation', replacement: here + 'navigation.mjs' },
    { find: 'next/link', replacement: here + 'link.jsx' },
    { find: '@', replacement: repo + 'src' },
  ] },
  define: { 'process.env.NEXT_PUBLIC_WORKSPACE_ID': JSON.stringify('ui-preview-only') },
  esbuild: { jsx: 'automatic' },
  css: { postcss: repo },
  server: { host: '127.0.0.1', port: 4287, strictPort: true, fs: { allow: [repo, repo + '../familytool-sso/node_modules'] },
    headers: { 'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self' ws://127.0.0.1:4287; form-action 'none'; base-uri 'self'" } },
});
