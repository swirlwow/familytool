# Home UI — 2026-09-26 (latest local-only review)

final result: passed

## Target and scope

- Source: C:/Users/ASUS/.codex/generated_images/01a017fa-725e-7d92-be7e-9fe6383f84f8/exec-19ce051e-7d1e-49dc-9491-46b9701c4b3c.png (1487 x 1058).
- Implementation: http://127.0.0.1:4287/; isolated fixtures, no production connection.
- Evidence: docs/ui-reports/home-acceptance/{1487,834,390}.png and comparison.jpg.
- Desktop CSS viewport: 1487 x 1058 at DPR 1; full-page captures. Source and desktop implementation normalized to 744 x 529 contain boxes in one comparison image. Tablet/mobile also visually reviewed.
- Intentional constraints: preserve the accepted inner-page pastel palette, current sidebar and cat, existing 11 destinations and descriptions. No search feature, date feature, new backend, or fake availability status added. Reference's decorative section foliage and 3D icons are simplified to existing library icons to remain consistent with the approved inner pages.

## Comparison history and fidelity

- Initial P2: hero cropped heads and illustration was too realistic. Fixed hero to 3:1 desktop ratio, regenerated a round-faced storybook family illustration. Final comparison shows complete heads, family and cat. Mobile uses the right half without vertical cropping.
- Fonts: existing Chiron GoRound rounded face retained; navy display heading, smaller descriptive captions. No unreadable truncation in reviewed widths.
- Layout: wide hero above 2 x 2 category groups; desktop finance/life four-column links; tablet two-column links; phone stacked groups. All 11 links visible and no page-level horizontal overflow.
- Colors: warm white #fffdf7; coral #ffd4d8, orange #ffe0b8, teal #b8eeea, lavender #e2d3ff match accepted inner-page harmony rather than the original saturated mock.
- Image quality: built-in image_gen asset, no code-drawn substitute. WebP 1800 x 600, 148858 bytes. Existing sidebar cat unchanged. Image is decorative with empty alt.
- Copy/content: tool names, descriptions, targets and external new-tab behavior retained; no new forms or business behavior.
- Full-view and readable tablet/mobile review found no remaining actionable P0/P1/P2 issues. P3: generated illustration is not a pixel-identical copy of the supplied artwork; library icons intentionally match existing product UI.

## Verification

- TypeScript noEmit passed.
- Automated browser: 1487, 834, 390 widths; 10 internal destination clicks render; external destination and target verified without navigating externally.
- Existing source destinations compared with HEAD and identical. No page errors, external requests, or mutation requests.
- Native in-app automation could not start (ACL error); used previously authorized local Playwright. Formal signed-in production workflows not tested or modified.
- No push, commit, deployment or production data changes in this iteration.

## Asset provenance

- Final asset: public/images/home-family-garden.webp, generated from public/images/home-family-garden-v2.png using built-in image_gen, then compressed locally.
- Prompt: 3:1 warm children's-storybook garden; simplified chibi family of four with oversized round heads, tiny black bean eyes, soft gouache, orange-white cat, red-roof house and rainbow; left half open sky for HTML title; no text, UI or logos; no Pixar or realistic faces; margin above and below subjects.

## Implementation checklist

- [x] Preserve feature destinations and cat sidebar.
- [x] Validate desktop, tablet, mobile and link navigation.
- [x] Keep local preview running for user style approval; do not deploy.

---

# Calendar and backup UI — 2026-09-26 (previous review)

final result: passed

## Scope and visual truth

- Calendar approved boards: `D:/@WORK/Shift Schedule/calendar-ui-designs-20260926/01-desktop-month.png` through `06-mobile-dialogs-navigation.png`.
- Backup approved board: `C:/Users/ASUS/.codex/generated_images/01a017fa-725e-7d92-be7e-9fe6383f84f8/exec-8a6296f0-6a7e-49b5-ae8f-bd6dfa358659.png`.
- Implementation: http://127.0.0.1:4287/calendar and /settings/backup.
- Evidence: `docs/ui-calendar-backup/`. Review: /review-calendar-backup.html.
- Source dimensions: month/week/backup 1487x1058; forms 1513x1040; states 1448x1086; responsive 1514x1039; mobile overlay board 1415x1112.
- Browser CSS viewports and screenshot pixels at DPR 1: 1440x1000, 834x1194, 390x844, 360x740. Fixed viewport captures; animations disabled for stable evidence.
- Comparison sheets normalize each full source board and implementation into 900x700 contain boxes, side by side. Boards with several states are not treated as a pixel-exact single viewport. The mock's synthetic data and image-generated text are not substituted for actual field values. UI density is checked on full-size captures as well.

## Comparison history

1. First capture: P2 inherited cream fields/header, month empty-cell blue background, and phone overflow count colliding with today's date. Compared source and implementation together. Fixed with scoped theme tokens, white fields, lavender weekday headers and count positioning. No date/overflow algorithm changed.
2. Subsequent capture: P2 delete confirmation buttons stacked on phone. Fixed scoped footer layout to keep Cancel/Confirm side by side. A screenshot also caught the sidebar mid-transition; verification now waits for visibility and position, and captures the viewport without changing layout height.
3. Final capture: checked final month/week, tablet, phone editor/navigation, delete and backup states. No remaining actionable P0/P1/P2 findings in the scoped routes. See `compare-*.png` plus native-size screenshots for readable controls.

## Five fidelity surfaces

- Typography: existing self-hosted Chiron GoRound retained. Labels made readable at 14px, fields at native input sizes. No font substitution. Generated mock glyph shapes are not a literal font asset.
- Layout: no page-level title/Banner; compact period controls, 7-column desktop/tablet week, stacked phone week; all original month cells and event lanes retained. Narrow month view can scroll vertically so events and overflow controls remain reachable. Backup is one notice and one card with an action divider; phone download fills the row.
- Color: purple primary/selected state, fine lavender borders, white surfaces, existing six owner colors, coral destructive actions, green success and rose error notices. Scope does not recolor other feature routes.
- Assets: existing shared sidebar, library icons and garden-cat asset retained without regeneration or new stand-ins. Mobile sidebar scrolls when needed so all navigation and the cat remain available.
- Content: original field names, six multi-select owners, notices, dates and error messages retained. Calendar dates/ranges remain in existing runtime format. No invented reminders, times, repeat controls, filters, export or restore actions.

## Browser interactions and states

All four widths: month/week, previous/next month, create/edit, empty title, invalid date range, tag selection, save, delete cancel/confirm, overflow list, backup busy/disabled, verified synthetic download, success/failure. Sidebar open and Escape checked below 1024px. Desktop additional read loading/failure and save busy/failure. See `results.json`: all four passed, no page errors. No document horizontal overflow in captured states.

The preview intercepts API calls in memory and blocks other origins. Downloads contain synthetic fixture tables only. No live backend, auth, real records, API/schema changes or production deployment were exercised.

## Code checks and preservation

- TypeScript noEmit and targeted ESLint passed.
- Existing Vitest suite: 26 files, 184 tests passed.
- Calendar helper/state/query/save/delete block and backup state/download handler exactly match HEAD after normalizing line endings. Changes are JSX, CSS, labels and local-only preview fixtures.

## Accepted differences / follow-up polish

- Existing navigation assets and sidebar width take precedence over small raster illustration differences in generated boards.
- Date formatting, number of event lanes and synthetic sample events follow real code, not inconsistent illustrative examples.
- Dialog illustration icon is not added; existing destructive dialog semantics and controls retained.
- This is isolated Chromium UI verification, not a new production backend, Safari or OS-keyboard integration certification.

## Checklist

- [x] Calendar and backup UI implemented against selected sources.
- [x] Desktop/tablet/two phone sizes and key states checked.
- [x] Data/API/business handlers unchanged.
- [x] Local preview and review gallery available.
- [x] No push or deployment.
