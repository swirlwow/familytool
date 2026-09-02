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

export type Category = {
  id: string;
  name: string;
  type: "expense" | "income";
  group_name?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type CatGroup = {
  id: string;
  name: string;
  type: "expense" | "income";
  sort_order: number;
  is_active: boolean;
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

// ---- Categories -------------------------------------------------------

export async function apiGetCategories(params: {
  workspace_id: string;
  type: "expense" | "income";
  include_inactive?: 0 | 1;
}) {
  const { workspace_id, type, include_inactive = 1 } = params;
  return requestJson<{ data: Category[] }>(
    `/api/categories?workspace_id=${workspace_id}&type=${type}&include_inactive=${include_inactive}`,
    { cache: "no-store" }
  );
}

export async function apiPostCategory(body: {
  workspace_id: string;
  type: "expense" | "income";
  group_name: string;
  name: string;
  sort_order: number;
  is_active?: boolean;
}) {
  return requestJson<any>("/api/categories", {
    method: "POST",
    ...withJsonBody(body),
  });
}

export async function apiPatchCategory(body: {
  workspace_id: string;
  id: string;
  name?: string;
  group_name?: string | null;
  sort_order?: number;
  is_active?: boolean;
  type?: "expense" | "income";
}) {
  return requestJson<any>("/api/categories", {
    method: "PATCH",
    ...withJsonBody(body),
  });
}

export async function apiDeleteCategory(body: { workspace_id: string; id: string }) {
  return requestJson<any>("/api/categories", {
    method: "DELETE",
    ...withJsonBody(body),
  });
}

// ---- Category Groups --------------------------------------------------

export async function apiGetCategoryGroups(params: {
  workspace_id: string;
  type: "expense" | "income";
  include_inactive?: 0 | 1;
}) {
  const { workspace_id, type, include_inactive = 1 } = params;
  return requestJson<{ data: CatGroup[] }>(
    `/api/category-groups?workspace_id=${workspace_id}&type=${type}&include_inactive=${include_inactive}`,
    { cache: "no-store" }
  );
}

export async function apiPostCategoryGroup(body: {
  workspace_id: string;
  type: "expense" | "income";
  name: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  return requestJson<any>("/api/category-groups", {
    method: "POST",
    ...withJsonBody(body),
  });
}

export async function apiPatchCategoryGroup(body: {
  workspace_id: string;
  id: string;
  name?: string;
  sort_order?: number;
  is_active?: boolean;
}) {
  return requestJson<any>("/api/category-groups", {
    method: "PATCH",
    ...withJsonBody(body),
  });
}

export async function apiDeleteCategoryGroup(body: { workspace_id: string; id: string }) {
  return requestJson<any>("/api/category-groups", {
    method: "DELETE",
    ...withJsonBody(body),
  });
}
