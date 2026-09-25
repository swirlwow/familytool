# UI pilot checkpoint 2: navigation and settings actions

- Brand now displays FAMILYTOOL only; its home link is unchanged.
- Sidebar group icons: wallet, ascending bars, calendar. Shift shortcut: house. Logout: gear.
- Existing child icons, all destinations, expansion handlers, auth effects and logout handler retained.
- Navy/lavender navigation and purple primary settings actions; mint status badges remain noninteractive.
- This is shared sidebar styling; other page contents remain unchanged.
- No cat illustration yet: no approved standalone asset exists in the repository. Do not substitute unrelated art.
- No production data, API, font or dependency changes. No push or deployment.

## Verification
- 26 test files / 184 tests passed.
- AppShell ESLint and TypeScript noEmit passed.
- Browser checked 1440px desktop, 390px phone drawer and 768px tablet settings.
- Phone groups open/close and all eleven sidebar links retained; 390px viewport scrollWidth 375px.
- Browser errors empty. Tests use the isolated fixture preview, not production auth or writes.
- Screenshots: ui-sidebar-v2-desktop.png, ui-sidebar-v2-phone.png, ui-buttons-v2-tablet.png.

## Recovery
Revert this checkpoint with git revert; original baseline tag remains ui-before-redesign-20260925.
No database restoration is necessary. Full visual redesign is not yet complete.
