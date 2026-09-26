# Batch 13 — calendar and backup

Local-only UI implementation; baseline before this batch: `7222583`.

Preview:
- http://127.0.0.1:4287/review-calendar-backup.html
- http://127.0.0.1:4287/calendar
- http://127.0.0.1:4287/settings/backup

Only the two page presentation layers and scoped CSS are changed in production source. Existing sidebar, font and cat remain shared. Calendar helpers, state, queries, validation, save/delete and backup download handler are unchanged. The in-memory preview now includes calendar fixtures and valid synthetic backup files; never enter private records there.

Verification: four Chromium sizes (1440, 834, 390, 360), no document horizontal overflow or page errors, test controls and busy/error/success states, 184 existing unit tests, TypeScript and ESLint. Evidence and caveats: `../design-qa.md`.

To roll back: revert the local commit titled `style: align calendar and backup with approved UI` after checking for subsequent overlapping changes. Do not reset the workspace or revert earlier batches. No remote branch or deployment was changed.
