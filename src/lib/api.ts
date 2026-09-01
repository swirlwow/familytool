// src/lib/api.ts
import { requestJson, withJsonBody } from "@/lib/apiClient";

// ---- Types ------------------------------------------------------------

export type PayMethod = {
  id: string;
  workspace_id: string;
  name: string;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string;
};

// ---- Helpers ----------------------------------------------------------

export function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function orderBySortName<T extends { sort_order?: any; name: string }>(rows: T[]) {
  return rows
    .slice()
    .sort((a, b) => n(a.sort_order) - n(b.sort_order) || a.name.localeCompare(b.name, "zh-Hant"));
}

// ---- Payment Methods --------------------------------------------------

export async function apiGetPaymentMethods(params: {
  workspace_id: string;
  include_inactive?: 0 | 1;
}) {
  const { workspace_id, include_inactive = 1 } = params;
  return requestJson<{ data: PayMethod[] }>(
    `/api/payment-methods?workspace_id=${workspace_id}&include_inactive=${include_inactive}`,
    { cache: "no-store" }
  );
}

export async function apiPostPaymentMethod(body: {
  workspace_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}) {
  return requestJson<any>("/api/payment-methods", {
    method: "POST",
    ...withJsonBody(body),
  });
}

export async function apiPatchPaymentMethod(body: {
  workspace_id: string;
  id: string;
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  return requestJson<any>("/api/payment-methods", {
    method: "PATCH",
    ...withJsonBody(body),
  });
}

export async function apiDeletePaymentMethod(body: { workspace_id: string; id: string }) {
  return requestJson<any>("/api/payment-methods", {
    method: "DELETE",
    ...withJsonBody(body),
  });
}

