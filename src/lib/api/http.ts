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

export function apiOk(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

export async function parseJson<T = any>(req: Request, fallback: T = {} as T): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return fallback;
  }
}

export function getSearchParams(req: Request) {
  return new URL(req.url).searchParams;
}
