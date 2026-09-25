# Payer portraits and compact settlement cards

- Local decorative SVG portraits for display names 大帥哥 and 大美女; initial fallback for any other name.
- No hard-coded payer IDs, filtering, calculation or backend changes.
- Avatar/name, receivable/payable rows and bottom net amount match the requested composition.
- Repayment row reduced to inline names, amount and existing action.
- Only isolated fixture display names changed; original records untouched.
- TypeScript and 184 tests passed. Desktop/tablet/phone browser checks show two portraits with names and no page-level overflow.
- Desktop screenshot visually reviewed. Browser error log checked.
- No push/deployment; independently revertible local commit.
