# UI production rollout / recovery baseline

Approved: user authorized push and deployment after local acceptance, requiring old version retention.

## Retained original

- Git commit: 0c07475443998c63b065559a122afb643f392b6f
- Git tag: ui-before-redesign-20260925
- Original branch: fix/restore-latest-with-shopping (do not overwrite)
- Vercel deployment: dpl_ALCgmfpqcRUAD92wpfRHEAS4aBSK
- Old immutable URL: https://familytool-keiwdz40h-swirlwows-projects.vercel.app
- Production aliases: familytool.vercel.app, familytool-swirlwows-projects.vercel.app
- Vercel reported READY and isRollbackCandidate=true before rollout.

## New UI

- Accepted UI commit: 4d43eda
- Branch: ui/settings-visual-pilot-20260925
- API files, src/lib, package.json and package-lock.json match the old production commit.
- Deploy a clean Git archive; exclude docs and tools/ui-preview with .vercelignore.
- Build as production with --skip-domain; promote only after build and read-only checks.
- No migration, data import, restore, mutation or environment change is part of this rollout.

## Recovery

Use Vercel rollback to dpl_ALCgmfpqcRUAD92wpfRHEAS4aBSK (or its immutable URL) after explicit authorization.
The remote recovery tag preserves the original source. Do not force-push or reset shared branches.
This restores application code, not a database snapshot; no database changes are intended.
