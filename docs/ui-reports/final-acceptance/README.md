# 本機 UI 定稿驗收

日期：2026-09-26。基準提交：5c52539。僅本機，未推送、未部署。

## 結果

- TypeScript：`npx tsc --noEmit` 通過。
- 單元測試：26 個測試檔，184 項通過。
- 版面：15 個頁面 × 1440、834、390px，45 組通過，沒有整頁水平溢出。
- 互動：各尺寸分別驗證待購／購買紀錄切換、取消刪除、股票五個分頁與新增買進取消、行事曆新增視窗與 Escape 關閉；9 組通過。
- 額外確認：記帳列模擬觸控左滑展開至 -80px，再點擊收回 0px，通過。
- 執行時：無 pageerror，無外部網路請求，無 POST／PUT／PATCH／DELETE 資料變更。
- 原始碼：本輪變動的記帳、股票、AppShell hooks、fetch 與 JSX 事件處理，與基準提交逐項比對一致；src/app/api、src/lib 無差異。
- 畫面：桌面表單／彈窗及手機／平板代表畫面已目視檢查；保留貓咪、便條紙六色與已確認的精簡版面。

## 驗收修正

發現手機記帳明細的共用 `.group` 留白套到滑動列外層，造成藍／紅操作底色在靜止時露出。
僅針對 `.ledger-records-panel .group.touch-pan-y` 將 padding 設為 0，保留內層文字留白；全部驗收重新通過。

## 限制

使用 Vite 隔離假資料預覽，不是正式登入、正式 API 或正式資料庫端到端驗收。
未提交新增、付款、結清、刪除、備份下載或還原操作；未執行 production build 或部署；不聲稱完整無障礙符合性。
首頁、值班休假不在這次 15 頁驗收範圍。

## 重跑

啟動既有預覽：`node node_modules/vite/bin/vite.js --config tools/ui-preview/vite.config.mjs`

驗收：`node tools/ui-preview/verify-harmony-final.cjs`

機器結果：results.json。截圖依「寬度-頁面／操作.png」命名。
