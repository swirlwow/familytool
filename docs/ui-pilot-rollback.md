# Settings UI pilot - 2026-09-25

## Baseline
- Original local and remote branch: fix/restore-latest-with-shopping.
- Verified HEAD: 0c07475443998c63b065559a122afb643f392b6f.
- Local recovery tag: ui-before-redesign-20260925.
- Pilot branch: ui/settings-visual-pilot-20260925.
- Separate worktree: D:/@WORK/Shift Schedule/familytool-ui-pilot.
- Original untracked single-user A/B documents remain untouched.
- Production deployment identity is not yet verified. Nothing is deployed or pushed.

## Scope
Additive CSS scoped to main.app-page:has(.settings-navigation), imported after the existing theme.
No handlers, APIs, fields, DOM order, dependencies, fonts or database changes.
This is an initial settings checkpoint, not completion of the sidebar/cat or full redesign.
Do not copy production credentials here. Write testing requires isolated fixtures/backend.

## Acceptance still required
- Categories: expense/income, major/minor names, groups, sort, badges, toggle/delete, add, refresh/fix-sort.
- Payment methods: add/rename, sorting, badges, toggle/delete, refresh/fix-sort.
- Merchants: add, blur/Enter/Escape rename, error, badge/toggle, drag/keyboard sort; no invented delete.
- Payers: counts, add, rename dialog, toggle, navigation and notices.
- Browser checks at 390/768/1440px; portal dialogs retain original styles for now.
- Sidebar/assets and final visual review must precede user acceptance.

## Rollback
Original worktree still runs the baseline. Use git revert <pilot-commit> to undo a checkpoint.
Do not reset/discard unrelated work. No database restore is required for a CSS rollback.
Before production rollout, record the original deployment URL/id and verify rollback availability.

## Checks at initial checkpoint
- Existing unit suite: 26 files, 184 tests passed.
- Default Turbopack build blocked by the dependency junction outside its filesystem root.
- Webpack compilation, TypeScript and all 47 static pages succeeded; final build result recorded in handoff.
- No environment files or production credentials copied; no API write or deployment performed.
- Shared dependencies are a local node_modules junction to the original worktree, not committed.
- This checkpoint is not visual acceptance; isolated browser preview and remaining shared styling are next.
