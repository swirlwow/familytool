/**
 * 全站共用設定
 * - WORKSPACE_ID：目前使用中的 workspace
 * - 從 .env.local 讀取 NEXT_PUBLIC_WORKSPACE_ID
 */

export const WORKSPACE_ID: string | null =
  process.env.NEXT_PUBLIC_WORKSPACE_ID && process.env.NEXT_PUBLIC_WORKSPACE_ID !== ""
    ? process.env.NEXT_PUBLIC_WORKSPACE_ID
    : null;
