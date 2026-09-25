# Batch 6 — Ledger and shopping

## Scope and rollback
- Ledger, wishlist and purchase-record views adopt scoped everyday-pilot styles.
- Existing font/sidebar reused; lavender controls and white cards; no decorative page title/banner.
- Ledger dashboard action, category chips, summaries, forms and all handlers retained.
- Wishlist quick-add and explanatory copy retained; decorative introduction compacted.
- Purchase record source snapshots/links remain unchanged.
- Production TSX differences: CSS import and presentation classes only. No API, calculation, storage or validation changes.
- Local commit only, independently revertible; no push/deployment.

## Verification
- TypeScript passed; 26 test files / 184 tests passed.
- Ledger, wishlist, purchases checked at widths 390/768/1440.
- Document widths 375/753/1425 respectively; no whole-page horizontal overflow.
- Synthetic records only, no backend fallback.
- Purchase snapshot expanded: both original product links available.
- Mobile manual-ledger form expanded: date/type/amount/categories/payment method/payer/merchant/content/note/split/confirm retained.
- Browser error output empty. Screenshots: ui-v6-*.png.
- Actual saves, deletes, rebuy and production backend flows were not exercised; not a claim of complete end-to-end acceptance.
- Remaining whole-site UI work and previously pending full-dialog validation are not marked complete.
