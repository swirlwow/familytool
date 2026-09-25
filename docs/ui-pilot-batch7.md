# Settlement reference redesign

- Replaces the earlier subtle treatment for settlement and history only.
- Purple selected tabs (#8859d5), compact white 7px panels, purple outlined secondary actions, coral destructive actions, grey-blue table headers.
- Period row above four summary cards; desktop member cards and member table side by side. Existing fields/extra sections retained.
- No invented date-mode controls or avatars from the illustrative mockup. No return shortcuts restored.
- TSX changes are presentation classes only; data, handlers and calculations unchanged.
- TypeScript passed; 184 tests passed.
- Browser: desktop1440 and phone390 settlement widths1425/375, tab computed rgb(136,89,213); desktop net columns568px/568px.
- History phone checked; browser errors checked; isolated synthetic data only.
- Screenshots ui-v7-settlement-desktop.png, ui-v7-settlement-phone.png, ui-v7-history-desktop.png.
- Full production mutations not tested. No push or deployment. Revert this commit independently to undo.
