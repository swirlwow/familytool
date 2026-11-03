# minimatch 定向修補與剩餘風險

更新日期：2026-11-03（Asia/Taipei）。本次已獲使用者授權套回主專案、重新驗收及推送部署；正式完成狀態以當前提交的 Vercel production READY 和 familytool.vercel.app alias 為準。前版為 a8aaeef。

## 採用範圍

只 override @typescript-eslint/typescript-estree 的 minimatch 為 11.0.1，鎖定依賴並保留原平台 libc 中繼資料。沒有全域替換 minimatch、降版 ESLint、關閉規則或變更業務程式。

完整 audit：16 → 15 moderate；正式依賴 audit 0。39 檔／272 項測試、型別檢查、正式建置在隔離副本及主專案通過。隔離試修的 110 組 dot:true 路徑比對與 TypeScript parser smoke 通過。ESLint 仍有原有 1 個 react-hooks/refs error（useLedgerMonth.ts render 中更新 ref）及 2 warnings；不稱為 lint 全通過。隔離共 185 份已追蹤來源的診斷相同，基準另含一份本機未提交 insurance 型別檔，未混入發布。

## 保留 15 項的原因

警告主要沿 minimatch 3.1.5 → ESLint／設定／外掛相依鏈傳遞，並非 15 個獨立漏洞。查核時外掛上游仍要求舊主版本。minimatch 11 不再是可直接呼叫的模組，且移除 makeRe；現有 eslint-plugin-import／react／jsx-a11y 及舊 ESLint 設定仍使用這些介面，直接全域 override 不安全，已在隔離副本確認舊呼叫方式會報 mm is not a function。單升 ESLint 10 也仍依賴 minimatch 10.2.6，不能完整消除。

安全公告 GHSA-g3hv-75wg-m249 將 <11.0.1 列為影響範圍，描述 optimizationLevel>=2 的處理放大；舊 3 原始碼沒有該處理實作，但本次不因此宣稱誤報或已修補。風險保留並等待上游相容版本。未執行攻擊負載，亦未用 audit fix --force、降版、停用檢查或隱藏警告消除數字。

## 驗收限制及後續

本次無正式環境設定，不以本機建置代表登入後真實資料或 Google 寫入同步驗收。正式發布只唯讀確認版本、安全標頭、登入頁及未登入 API 401，不修改正式資料或觸發同步。

後續定期查核上游相容更新，再以隔離試修、相同來源的 ESLint 診斷比較、完整測試、型別、建置及 audit 驗收。Google Drive 暫不同步，本機與隔離證據保留。
