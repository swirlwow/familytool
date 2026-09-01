import { NextResponse } from "next/server";

type ApiErrorOptions = {
  status?: number;
  /** Include a `data` field (some endpoints expect `data: []` on error) */
  data?: any;
  /** Some endpoints use `{ success:false, error: ... }` shape */
  successFalse?: boolean;
  /** Some endpoints include `{ extra: ... }` for debug/details */
  extra?: any;
  /** Merge additional fields into the response payload */
  payload?: Record<string, any>;
};

export function apiError(message: string, options: ApiErrorOptions = {}) {
  const { status = 400, data, successFalse, extra, payload } = options;

  const base: Record<string, any> = successFalse
    ? { success: false, error: message }
    : { error: message };

  if (data !== undefined) base.data = data;
  if (extra !== undefined) base.extra = extra;
  if (payload) Object.assign(base, payload);

  return NextResponse.json(base, { status });
}

type InternalErrorOptions = Pick<ApiErrorOptions, "data" | "successFalse" | "payload"> & {
  context?: string;
  message?: string;
};

const operationMessages: Record<string, string> = {
  "workspace access denied": "沒有此工作區的操作權限",
  "settled ledger entry cannot be edited": "已有結清紀錄的帳目不能修改",
  "settled ledger entry cannot be deleted": "已有結清紀錄的帳目不能刪除",
  "settlement exceeds split remaining amount": "結清金額超過待結清金額",
  "settlement item not found": "找不到結清明細",
  "settlement not found": "找不到結清紀錄",
  "ledger entry not found": "找不到記帳紀錄",
  "bill not found": "找不到帳單",
  "status-only bill cannot create ledger entry": "此信用卡帳單只需標記已繳",
  "invalid payment amount": "付款金額不正確",
  "invalid settlement": "結清資料不正確",
  "invalid ledger entry": "記帳資料不正確",
  "invalid split allocation": "分攤金額不正確",
  "invalid split participant": "分攤成員不正確",
  "duplicate split participant": "同一位分攤成員不可重複",
  "request key is required": "請重新操作一次",
};

export function apiInternalError(error: unknown, options: InternalErrorOptions = {}) {
  console.error(options.context || "API request failed", error);
  return apiError(options.message || "處理失敗，請稍後再試", {
    status: 500,
    data: options.data,
    successFalse: options.successFalse,
    payload: options.payload,
  });
}

export function apiOperationError(error: unknown, options: InternalErrorOptions = {}) {
  const raw = error instanceof Error ? error.message : "";
  const translated = operationMessages[raw];
  const isAppValidation = /^(缺少|找不到|此 |拆帳|結清|付款|帳單|amount|debtor_id|split)/.test(raw);

  if (translated || isAppValidation) {
    console.warn(options.context || "Operation rejected", raw);
    return apiError(translated || raw, {
      status: 400,
      data: options.data,
      successFalse: options.successFalse,
      payload: options.payload,
    });
  }

  return apiInternalError(error, options);
}

export async function parseJson<T = any>(req: Request, fallback: T = {} as T): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return fallback;
  }
}
