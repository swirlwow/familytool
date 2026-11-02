# 家庭工具 FAMILYTOOL｜跨 AI 協作與接續說明

最後內容更新：2026-11-03（Asia/Taipei）。本文件與原始碼一起版本控制，請以所在提交及遠端分支狀態為準。

## 專案與版本入口

- GitHub：<https://github.com/swirlwow/familytool>
- 目前工作／發布分支：`ui/settings-visual-pilot-20260925`。
- 正式站：<https://familytool.vercel.app>；行事曆 `/calendar`。
- 本次行事曆發布的前一個正式提交：`5f6852ed5039f8253e2f2623bd738f5c23e0fe0f`。
- `main` 尚未與此分支合併；切勿只下載預設分支就認為是最新正式功能。不要自行合併或改分支策略。
- 最新提交請用 `git log -1`、GitHub 分支頁與 Vercel deployment 的 commit SHA 核對，避免將文件內的歷史基準視為最新版本。
- Vercel 專案名稱 `familytool`，專案 ID `prj_xcywwhOe54iM2M80v5Sg6rNP6SJR`；請勿部署到獨立的值班休假專案。

## 工作原則

目前只有使用者一人使用產品。以現有流程與配色為基礎，避免未授權的大幅重構。
使用者已暫停 Google Drive 檔案同步；接續資料放在 GitHub 與本機。既有 Drive 檔案保留，不繼續更新。本次不將任何檔案上傳 Google Drive。
產品的 Google 行事曆同步仍正常保留，和 Drive 檔案保存是不同功能。
所有本機檔案保留，不自動清理。保險預覽、圖片及其他未完成改動可能仍在本機，不能整個工作目錄直接提交；保險缺的原始文件仍待補，未與其他業務資料串連。

## 開始或換電腦時

1. 經已授權 GitHub 帳號取得本儲存庫及上述分支，先讀根目錄 `AGENTS.md`。
2. 檢查 `git status --short`、`git branch --show-current`、`git log -1`、遠端提交與工作區差異。尚有修改先保留並比較，不要直接 reset 或覆蓋。
3. 乾淨分支可 `git pull --ff-only`；有衝突先比較內容，無法判斷再詢問使用者。
4. 準備依賴及自己的本機環境設定，執行測試，再繼續使用者指定工作。
5. GitHub 提供程式碼與說明，不包含正式資料庫內容、秘密設定或使用者的 Google 授權。取得程式碼不代表已取得線上資料。

## 環境與常用命令

Next.js 16、React 19、TypeScript、Supabase；Node.js >=22（Vercel 目前使用 24.x），依 `package-lock.json` 重建依賴。

```sh
npm ci
npm test
npx tsc --noEmit
npm run dev
```

正式啟動／建置：`npm run build`、`npm start`。部署前確認 Vercel 團隊、專案、環境與確切 commit。
本機 `.env.local` 由使用者安全設定；基本鍵名為 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_WORKSPACE_ID`。Google 設定範本見 `config/google-calendar.env.example`；真實值只放未追蹤的本機設定或部署平台，勿貼到協作文件或提交。前端不可使用 service-role key。

## 不連正式資料的 UI 預覽

既有 Vite 工具說明見 `tools/ui-preview/README.md`。若該工作區已準備 Vite，可執行：

```sh
node node_modules/vite/bin/vite.js --config tools/ui-preview/vite.config.mjs
```

開啟 <http://127.0.0.1:4287/calendar?google_preview=connected>。Vite 是既有本機驗證工具，未列為正式 app 的直接依賴；乾淨環境若沒有 Vite，先比較原說明再以專用測試環境準備，勿為了預覽隨意更動正式依賴鎖定檔。
預覽用可重置假資料，測試行程主要在 2026 年 9 月；不得輸入私人資料。它不使用正式 Auth、資料庫或 Google，不能代替正式整合驗收。

## 本次行事曆功能與使用者決定

- 人物多選：家庭、爸媽、雅惠、昱元、子逸、英茵。符合任一選取人物就顯示，共同行程不重複。
- 再點人物取消；取消最後一人或點「全部」恢復全行程。選個人不自動加入「家庭」分類的行程。
- 按鈕僅外框標示，不放勾選，選取前後不變寬。手機可橫向滑動。
- 月／週與月份切換保留所選人物；新增行程預選這些人物；列印跟隨篩選並在標題註明人物。
- 無行程提示在分類按鈕右側同列，不額外增加一排。
- 螢幕行程文字降低字重、略增字距；列印字重維持原樣。
- 同步、列印、新增按鈕統一高度、頂端對齊；同步下方只顯示 `YYYY/MM/DD HH:mm` 最後成功時間。錯誤與成功 toast、輔助閱讀提示仍保留。
- 同步仍由使用者手動操作，以家庭工具為準，同步所有月份與人物；只刪除家庭工具建立的 Google 行程。人物篩選只控制顯示與列印，不得用來縮小同步來源導致誤刪。
- 列印按鈕文字為「列印」。A4 橫向表格加高、減少下方留白，不隱藏長文字；事件多時紙張分頁仍需實際確認。
- 僅行事曆有桌面選單收合：半圓懸浮箭頭，選單收合不預留窄欄。其他頁面固定展開，手機維持既有導覽。
- 桌面月曆扣除實際上方位移，外層容器一起適應視窗；依月份使用 4／5／6 週，不留多餘空白週。每週顯示層數隨高度調整，其他行程由 `+N` 入口查看。

## 檔案地圖

| 範圍 | 檔案 |
|---|---|
| 月／週畫面、人物選取、列印、尺寸調整 | `src/app/calendar/page.tsx` |
| 人物篩選與取消邏輯／測試 | `src/lib/calendar-filter.ts`、`src/lib/calendar-filter.test.ts` |
| 行事曆與列印樣式 | `src/app/calendar/calendar-ui.css` |
| 左側選單顯示與行事曆限定收合 | `src/components/AppShell.tsx`、`src/app/family-harmony.css` |
| Google 同步按鈕與時間 | `src/components/google-calendar-sync-button.tsx` |
| 人物既有顏色 | `src/lib/calendar-colors.ts` |
| Google 同步後端 | `src/lib/google-calendar-*`、`src/app/api/google-calendar/` |

## 驗證與限制

本次本機已通過 38 個測試檔、270 項測試，`tsc --noEmit` 與 `git diff --check` 通過。新增測試涵蓋多人任一符合、共同行程不重複、獨立取消、清除人物條件。
隔離瀏覽器已確認手機按鈕選取前後同寬、多人同時選取、人物新增預選、行事曆桌面收合，以及 5 週與 6 週月份在 639px 高視窗沒有整頁垂直捲軸，其他行程仍有 `+N` 入口。
實體列印與實際 PDF 分頁尚未完整驗收，須以使用者瀏覽器與紙張縮放設定確認；不要把程式碼／DOM 檢查稱為實體列印已驗收。
本次不需資料庫 migration，未修改正式帳單、記帳、付款或 Google 行程。

## 發布與接續

本次使用者已授權推送部署；其他 AI 後續的新修改仍需依當次授權決定預覽或發布。
確認測試後，只提交任務相關檔案、以一般 push 推送目前分支。Vercel 必須從該確切提交建立 production，等待 READY 且正式 alias 指向該版本，再以唯讀操作驗證畫面。不要因預設 production 分支為 main 而擅自合併。
部署結果以 Vercel／GitHub 的提交與 deployment 記錄核對，本文件不硬寫自身提交 SHA。發布後若有問題，先比較前一版 `5f6852e`，只在使用者授權下回退。

可貼給其他 AI 的接續指令：

> 請接續 swirlwow/familytool 的 ui/settings-visual-pilot-20260925 分支。先讀 AGENTS.md 與 docs/AI_HANDOFF.md，核對遠端、本機及正式部署版本，保留未提交修改。Google Drive 同步暫停，本機保留。只處理我本次指定的內容，完成測試後說明差異與未驗證範圍；未經本次授權不要部署、改正式資料或覆蓋其他人的修改。
