# 全新資料庫初始化（階段 2）

`baseline.sql` 是已核對的 schema-only 基準，不含業務資料、使用者、密碼或 Auth 設定。**不是既有站台的增量 migration，不可套用到正式站或還原資料庫。**

## 操作順序

1. 建立獨立空白 Supabase 專案。確認連線目標；Supabase roles、`auth.users`、`auth.uid()` 須已存在。
2. 在專案根目錄執行 `node supabase/bootstrap/verify.cjs`，核對基準及涵蓋的 24 個歷史檔案。驗證會正規化 CRLF/LF，跨平台換行不影響結果。
3. 用 `psql -X -v ON_ERROR_STOP=1 -f supabase/bootstrap/baseline.sql`，明確指定該空資料庫的連線；不要將密碼寫入版本控制。
4. SQL 以 transaction 執行，已有 public/private 應用表或 private 函式就拒絕。它先清除新表對一般角色的隱含預設授權，再按照基準明確還原權限，避免新版平台額外擴權。
5. 核對結構、RLS、函式與權限，並以測試帳號驗證合法存取、跨帳號拒絕。不得只確認表數就往下執行。
6. **僅在這個新資料庫已確認結構吻合後**，使用 `supabase migration repair --status applied`，逐一帶入 `manifest.json` 中 24 個已涵蓋的版本。明確指定此測試庫；不要使用正式專案連線或不明的 `--linked`。這只是同步已存在結構的追蹤紀錄，不是重跑 SQL，也不聲稱找回早期歷史。
7. `supabase migration list` 確認基準版本對齊，再 `supabase migration up` 套用未涵蓋的新版本。目前包含 `20260910150806_restrict_table_management_privileges.sql`，移除一般角色的 TRUNCATE/REFERENCES/TRIGGER/MAINTAIN，保留原 DML 與 RLS。
8. 再執行一次更新，確認無待套用項目；重跑測試與安全檢查。

## 已驗證結果

- 全新 Supabase：30 張應用表，JWT 與 API 帳號隔離通過。
- 與凍結基準比較：296 欄、137 約束、116 索引、51 政策、30 張 RLS 表、7 觸發器、14 函式、545 項基準授權一致。
- 在刻意寬鬆的預設授權下重建也一致；重複套用基準會拒絕。
- 新測試庫由 24 個基準版本接到第 25 個權限修補，再次更新為 no-op。正式 migration history 沒有更動。
- Windows Docker 的資料庫轉送曾中斷，驗收改用只綁 127.0.0.1 的專用連線與原容器內 nc，仍由官方 CLI 執行。該連線用後關閉，不是新增正式端點。

## 限制

- 不可在基準後重跑已涵蓋的 24 個舊檔，也不要對這套不完整早期歷史直接使用 `db reset`。
- 基準不包含後續 migration；新增版本需再驗證「基準 → 後續更新 → 回歸」。
- 本流程不恢復 Auth/OAuth、Storage 或正式資料；它們使用階段 1 的獨立備份／還原程序。
- 這次未推送、未部署、未修改正式站。
