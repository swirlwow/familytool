# Isolated settings UI preview

Run from repository root:

    node node_modules/vite/bin/vite.js --config tools/ui-preview/vite.config.mjs

Open http://127.0.0.1:4287/settings/categories (loopback only).

This development-only harness imports the real four settings pages and AppShell.
Only Next navigation/link and Supabase auth are stubbed. App fetch is handled in memory,
with no fallback to the network. Unknown API requests fail closed. CSP restricts requests
to this local origin. Environment files from the app root are not loaded.
All records are synthetic and reset on full navigation/reload. Do not enter real data.
This is UI verification, not backend/auth/production integration testing.
Out-of-scope routes are not implemented in this harness.
Nothing here is imported by the production Next app.
