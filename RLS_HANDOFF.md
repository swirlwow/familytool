# FamilyTool RLS 修正交接文件

更新日期：2026-07-16

## 目的

本次工作優先修正 Supabase 過度寬鬆的 Row Level Security（RLS）政策，避免匿名使用者或非工作區成員存取家庭、記事、行事曆及帳務資料。

目前正式版已上線，請遵守以下原則：

- 不直接修改或測試正式環境資料。
- 所有程式與 migration 變更只在 `codex/receipt-import-mvp` Git branch 進行。
- 資料庫先在 `familytool-dev` 驗證，未完成下方正式部署檢查前，不得套用至 production。
- 不要把 Supabase API key、service role key、密碼、使用者 UUID 或電子郵件寫入 Git。

## Repository 狀態

- GitHub：<https://github.com/swirlwow/familytool>
- 本機路徑：`C:\Users\ASUS\Documents\生活\familytool`
- 工作 branch：`codex/receipt-import-mvp`
- branch 與以下檔案目前仍只存在原電腦本機，尚未 commit、push。
- 原有應用程式檔案沒有被修改。

新增檔案：

- `supabase/migrations/20260716091526_harden_workspace_rls.sql`
- `supabase/tests/workspace_rls_test.sql`
- `RLS_HANDOFF.md`

## Supabase 環境

### Production

- Project name：`life`
- Project ref：`ztaapoeqqeqvofnyowdf`
- Region：`ap-south-1`
- 本次工作未修改 production。
- 稽核時有 1 位 active Auth user，但 `user_workspaces` 與 `members` 都沒有資料。
- 帳務資料表已有正式資料，migration 內的防呆會阻止在尚未建立 membership 時部署。

### Development

- Project name：`familytool-dev`
- Project ref：`iwbogfxdcnuheuqgxwjf`
- Region：`ap-south-1`
- 因目前 Supabase organization 是 Free plan，無法使用 Supabase Branching，因此建立獨立 development project。
- development 只包含最小化測試 schema 與合成資料，沒有複製 production 使用者或正式資料。

在新電腦請透過 Supabase/Codex OAuth 重新登入並選擇上述 project；不要傳遞或貼上 service role key。

## 已完成的 RLS 修正

Migration 會：

- 在目標應用資料表啟用 RLS。
- 移除舊有過度寬鬆、固定 workspace 或重複政策。
- 撤銷 `anon` 對應用資料表的權限。
- 僅授予 `authenticated` 必要的資料表權限。
- 以 `user_workspaces` membership 限制 workspace 資料存取。
- 讓 `sticky_items` 透過其 parent sticky 驗證 workspace membership。
- 移除舊的公開 `is_workspace_member(uuid)` SECURITY DEFINER helper。
- 在 production 已有 workspace、但沒有任何 `user_workspaces` membership 時主動中止 migration。

涵蓋資料表包括 `notes`、`stickies`、`sticky_items`、`calendar_events`、`members`、workspace 資料及帳務相關資料表。

## 驗證結果

已在 `familytool-dev` 套用 migration 並執行 pgTAP：

- 13/13 測試通過。
- Security Advisor：`lints: []`。
- Policy 數量：22。
- `anon` table grants：0。
- always-true policies：0。
- public-role policies：0。
- legacy helper：不存在。

尚未完成應用程式 lint/build。原電腦未安裝 `node_modules`，執行 `npm run lint` 時找不到 ESLint；新電腦應先執行 `npm ci` 再驗證。

## 正式部署前的阻擋事項

以下三項未完成前，不得將 migration 套用到 `life`：

1. **建立合法 membership**
   確認唯一的 production Auth 帳號與目前 workspace 的擁有關係，再以經審核的 SQL 建立 `user_workspaces`。不要把 UUID 寫進 migration 或本文件。

2. **修正公開 Calendar Feed**
   `src/middleware.ts` 目前將 `/api/calendar/feed` 設為公開，而 feed 會讀取 notes。撤銷匿名存取後，外部 calendar feed 將失效。需先改為不可猜測且可撤銷的 feed token，或要求有效登入 session。

3. **修正註冊與 workspace 指派流程**
   `src/app/login/page.tsx` 目前允許 signup 後自行寫入 `user_workspaces`。新的 RLS 會禁止自行加入其他 workspace；需改成邀請制或管理者指派。

## 新電腦接續步驟

目前 branch 尚未 push。請先在原電腦 commit 並 push；完成後，在新電腦執行：

```powershell
git clone https://github.com/swirlwow/familytool.git
cd familytool
git fetch origin
git switch codex/receipt-import-mvp
git status --short --branch
npm ci
npm run lint
npm run build
```

接著：

1. 重新連接 GitHub 與 Supabase OAuth。
2. 確認操作目標為 `familytool-dev`（`iwbogfxdcnuheuqgxwjf`），不要誤選 production。
3. 檢查 migration 與 pgTAP 檔案。
4. 優先處理 Calendar Feed 與 signup/workspace 指派相容性。
5. 在 development 重跑 RLS 測試及 Security Advisor。
6. 提交測試結果與 deployment SQL 供人工確認。
7. 取得明確批准後，才可安排 production migration。

## 給下一個 Codex 工作階段的指示

可將以下文字作為新工作的開場：

> 請先閱讀 `RLS_HANDOFF.md`，確認目前位於 `codex/receipt-import-mvp`。正式環境 `life` 不得修改。先檢查現有 migration 與測試，再處理公開 Calendar Feed 及 signup/workspace membership 的相容性；所有資料庫驗證只在 `familytool-dev` 執行。任何 production 操作都必須先向我說明 SQL、影響及回復方式，並取得明確確認。
