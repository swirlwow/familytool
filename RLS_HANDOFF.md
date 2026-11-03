# FAMILYTOOL 安全與 RLS 接續說明

更新日期：2026-11-03（Asia/Taipei）。取代 2026-07-16 的過期操作指示；歷史內容可由 Git 查閱。

## 目前版本及工作原則

- 目前分支為 ui/settings-visual-pilot-20260925，正式站為 a21732f，Vercel production READY；main 並非最新正式功能。
- 套件安全修補於本次獲授權推送部署；完成狀態須核對當前提交的 production READY 與正式 alias，不把本機驗收結果當正式環境驗收。
- 不依賴固定本機路徑；由目前 checkout 接續，先讀 AGENTS.md 及 docs/AI_HANDOFF.md。
- Google Drive 同步暫停，本機保留；秘密、私人備份及登入資料不得進 Git。
- 本次只讀取正式中繼資料及未登入 HTTP 結果，未修改正式資料、Auth 設定、分享或部署。

## 正式環境唯讀查核結果

目標 Supabase 專案為 life（ztaapoeqqeqvofnyowdf）。2026-11-03 查核：

- public 32 張一般資料表全部啟用 RLS；anon 資料表授權為 0。
- 未查到 qual／with_check 直接為 true 或指定 public 角色的政策；這只是基本篩查，不代表全部政策語意已完整驗證。
- user_workspaces 有 1 筆 membership；SELECT 政策限制讀取自己的紀錄，沒有自行新增 membership 的政策。
- migration 紀錄包含 harden_workspace_rls、google_calendar_sync、bill_notes_zero_due。
- 部分正式與本機 migration 名稱相同但時間編號不同，須比對 SQL／實際 schema 後建立對照；不要重新套用或自行修改 migration history。
- 正式未安裝 pgTAP。本次未在正式執行 pgTAP 或建立測試資料；舊文件的 13/13 僅為歷史開發環境結果，不能代表本次正式驗收。
- 目前連線專案清單未列出舊 familytool-dev，不可直接假設它仍可用。

## 舊阻擋事項的目前狀態

1. membership 已存在，舊「完全沒有 membership」描述不適用。
2. src/proxy.ts 使用 getUser 驗證登入；正式 feed 與 bills 未登入實測回 401。feed 不再提供無 session 的外部 URL 訂閱；不要為恢復訂閱而直接公開。
3. login 已無 signup 路徑，也無用戶自行寫入 membership 的流程；但尚未確認 Supabase Auth 是否關閉直接註冊，不能以移除按鈕代替服務端設定確認。

## 2026-11-03 本機套件修補

- Next.js／eslint-config-next：16.3.4 → 16.4.4。
- sharp 0.35.5、source-map-js 1.2.2、postcss-selector-parser 6.1.5。
- Vitest 4.1.12、Vite 8.3.5、brace-expansion 1.1.21（詳細多版本相依樹以 package-lock.json 為準）。
- npm audit --omit=dev：0 項已知漏洞。
- 完整 npm audit：前次 16 項 moderate，本次定向更新 TypeScript ESLint 的 minimatch 至 11.0.1 後剩 15 項 moderate，根源為 minimatch <11.0.1，沿 ESLint 等開發依賴傳遞。沒有使用 audit fix --force 強制降版或跨大版本覆寫；需另評估工具相容性與上游修補。
- 39 檔／272 項測試、tsc --noEmit、Next.js 正式建置通過。
- 本機正式建置 4293：login 200、calendar 導向 login；feed、bills、Google status 未登入 401，CSP 標頭存在。
- 本機沒有正式環境設定，未驗收登入後真實資料、Google 授權／寫入同步；未做入侵測試。

## 待處理事項

- Supabase Security Advisor 回報已外洩密碼防護未啟用；需確認方案支援後設定。這不代表現有密碼已外洩。
- CSP 正式 script-src 含 unsafe-inline；nonce 改造需同步評估動態渲染與登入相容性。
- 共用 Supabase Proxy／匿名 fallback 是維護風險；尚未證明可繞過 RLS，應另外分離 server／browser client。
- 另備獨立測試資料庫驗證匿名、非成員、成員、跨 workspace 的讀寫與 RPC 權限。不在正式環境直接跑會寫入的測試。
- 實體列印與實際 PDF 分頁尚未完整驗收，屬功能驗收限制。

發布驗收：本次已獲推送部署授權；發布後確認 commit、READY 及正式 alias，並唯讀檢查登入頁及 API 未登入 401。後續剩餘 minimatch、Auth 設定與 CSP 改造另行規劃，不混入本次。

## 定向修補發布接續

2026-11-03：已驗收的定向 override 套回主專案，重新測試及建置通過，本次獲授權推送部署。未修改資料庫、Auth、CSP、ESLint 規則或產品功能。剩餘 15 項原因詳見 docs/MINIMATCH_REVIEW.md。前版 a8aaeef；實際發布狀態請核對當前提交的 Vercel production READY／正式 alias。
