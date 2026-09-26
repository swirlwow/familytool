# Homepage production rollout — 2026-09-27

- User approved push and production deployment after local homepage review.
- Source commit: 41cb7db; branch: ui/settings-visual-pilot-20260925.
- Production: https://familytool.vercel.app
- Deployment: dpl_3jvj9iJeKsDVxpkbC7ZXpM2yktuM (READY).
- Immutable URL: https://familytool-enuqmj31a-swirlwows-projects.vercel.app
- Framework: Next.js 16.3.4; build output reported 12s, 47/47 static pages generated.
- Previous deployment retained: dpl_ESY1tqa9Lvz2Vi84iuhzPLaN37Li, https://familytool-i4r6k04m6-swirlwows-projects.vercel.app.
- Recovery tag ui-before-home-20260927 was pushed and remotely verified at 61b07cde8ba648f86cba77bc945adca4400e02be before pushing the new homepage.
- Previous pre-redesign tag ui-before-redesign-20260925 remains untouched.
- Deployed from a clean Git archive. Draft PNG images, untracked files and local environment files were not uploaded.
- TypeScript and local browser verification passed at widths 1487/834/390. All 10 internal links rendered; external link target retained. No page errors, external requests or mutation requests during local checks.
- Production read-only checks: /login 200; / redirects to login (307); /api/ledger rejects unauthenticated access (401).
- Homepage illustration also redirects unauthenticated requests (307), as expected from the unchanged authentication middleware. Signed-in production rendering was not tested; no credentials or data were accessed.
- Deployment error-level logs since 1h returned no logs immediately after promotion. Point-in-time check only; no ongoing monitoring configured by this task. Existing drains not inspected.
- API, src/lib, dependencies, database and environment settings unchanged.
- Recovery: explicitly authorized Vercel rollback to the previous deployment restores the prior homepage; no database restoration is involved.
