export async function fetchBackupFile(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("無法下載備份，請確認登入狀態後重試。");
  }
  const blob = await response.blob();
  const payload = JSON.parse(await blob.text());
  if (payload?.format !== "familytool-backup" || !payload.tables) {
    throw new Error("備份內容不完整，請稍後重試。");
  }
  return blob;
}
