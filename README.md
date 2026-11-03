# FAMILYTOOL 家庭工具

跨 AI 接續請先讀 [AGENTS.md](AGENTS.md) 及 [協作與接續說明](docs/AI_HANDOFF.md)。

最新功能目前在 **`ui/settings-visual-pilot-20260925`** 分支，尚未合併到 `main`。正式站：[家庭工具](https://familytool.vercel.app)。

Google Drive 檔案同步已暫停；產品內的 Google 行事曆同步保留。本機檔案不自動刪除，秘密設定與私人資料不提交 GitHub。

## 環境與執行

使用 Node.js 24.x 與 npm，依 package-lock.json 安裝，避免重新解析出不同版本。

```sh
npm ci
npm test
npx tsc --noEmit
npm run build
npm run dev
```

開發預設網址為 http://localhost:3000；正式模式使用 `npm run build` 後 `npm start`。
本機需安全準備 Supabase 環境設定，設定鍵名及 Google 同步範本見 [接續說明](docs/AI_HANDOFF.md)。缺少設定時只能驗收登入畫面與未登入保護，不能宣稱完成資料整合驗收。

## 安全與驗收

2026-11-03 套件修補在本機完成：Next.js／eslint-config-next 16.4.4、Vitest 4.1.12；其餘修補版本以鎖定檔為準。272 項測試、型別檢查與正式建置通過。正式依賴掃描為 0 項；完整掃描仍有開發用 minimatch 相依鏈的 16 項 moderate 警告，不代表所有依賴零漏洞。
此修補於 2026-11-03 獲授權推送部署；前版為 a21732f，發布完成狀態請核對目前 Git 提交與 Vercel production READY／正式 alias。詳細限制見 [安全交接](RLS_HANDOFF.md)。

資料庫變更須比較現況與 migration；本機與正式部分版本編號不同，不可直接重跑。資料庫行為測試先使用獨立測試環境，不以正式資料進行寫入測試。

## 協作與發布

功能包含行事曆、帳單與記帳、投資、購物及記事。任務範圍與發布權限依當次使用者指示；不自行合併 main、強制推送或部署。協作前先讀根目錄 AGENTS.md 與 docs/AI_HANDOFF.md。
