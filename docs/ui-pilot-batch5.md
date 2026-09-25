# Batch 5: finance pages

## Scope
- Bills, settlement, settlement history share an opt-in finance-pilot stylesheet.
- Production TSX changes: one class per page, one stylesheet import in layout.
- No data, API, calculation, handler, validation or field changes.
- Existing font/sidebar retained. Titles visually clipped, configuration alerts retained.
- Shared lavender borders, purple primary actions, rounded controls; financial status colors retained.

## Verification
- TypeScript passed; 184 tests / 26 files passed; git diff --check passed.
- Isolated synthetic data at /bills, /settlement and /settlement/history.
- Each checked at 390, 768, 1440 viewport width. Document widths 375, 753, 1425 respectively: no page-level horizontal overflow.
- Browser error logs empty; settlement history detail expanded successfully.
- Bills mobile payment dialog opened, original fields/options/cancel/confirm present; no payment submitted.
- Bills has a separate header selector; corrected after visual inspection and recaptured phone screenshot.
- Screenshots ui-v5-* capture the main pages and mobile payment dialog. Bills tablet/desktop screenshots precede the header-selector correction.
- Fixed-bill manager, all dialog states, exports and backend persistence are not fully verified in this batch.
- Preview stubs are in memory only; unknown requests remain blocked.
- No push/deployment. This commit can be reverted independently.
