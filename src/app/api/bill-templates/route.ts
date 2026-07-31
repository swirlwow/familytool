import { NextResponse } from "next/server";
import { apiError, parseJson } from "@/lib/api/http";
import { supabase } from "@/lib/supabaseClient";

const templateSelect = `
  id,
  workspace_id,
  name,
  amount_default,
  amount_mode,
  schedule_type,
  schedule_months,
  generate_day,
  due_day,
  payment_mode,
  starts_on,
  ends_on,
  active,
  created_at
`;

type TemplateBody = {
  workspace_id?: unknown;
  id?: unknown;
  name?: unknown;
  amount_default?: unknown;
  amount_mode?: unknown;
  schedule_type?: unknown;
  schedule_months?: unknown;
  due_day?: unknown;
  payment_mode?: unknown;
  starts_on?: unknown;
  ends_on?: unknown;
  active?: unknown;
};

function parseOptionalDay(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const day = Number(value);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : NaN;
}

function parseMonths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number))]
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12)
    .sort((a, b) => a - b);
}

function parseStartDate(value: unknown) {
  const raw = String(value || "");
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function validateTemplate(body: TemplateBody) {
  const name = String(body.name || "").trim();
  const amountMode = String(body.amount_mode || "fixed");
  const scheduleType = String(body.schedule_type || "monthly");
  const paymentMode = String(body.payment_mode || "ledger");
  const dueDay = parseOptionalDay(body.due_day);
  const months = parseMonths(body.schedule_months);
  const startsOn = parseStartDate(body.starts_on);
  const endsOn = body.ends_on ? parseStartDate(body.ends_on) : null;
  const amount = body.amount_default === null || body.amount_default === "" || body.amount_default === undefined
    ? null
    : Number(body.amount_default);

  if (!name) return { error: "請輸入模板名稱" } as const;
  if (!["fixed", "variable"].includes(amountMode)) return { error: "金額類型錯誤" } as const;
  if (!["monthly", "months"].includes(scheduleType)) return { error: "週期類型錯誤" } as const;
  if (!["ledger", "status_only"].includes(paymentMode)) return { error: "付款處理方式錯誤" } as const;
  if (Number.isNaN(dueDay)) return { error: "到期日需介於 1 至 31 日" } as const;
  if (!startsOn) return { error: "請選擇開始月份" } as const;
  if (body.ends_on && !endsOn) return { error: "結束月份格式錯誤" } as const;
  if (endsOn && endsOn < startsOn) return { error: "結束月份不可早於開始月份" } as const;
  if (scheduleType === "months" && months.length === 0) return { error: "請至少選擇一個產生月份" } as const;
  if (amountMode === "fixed" && (!Number.isFinite(amount) || Number(amount) <= 0)) {
    return { error: "固定金額需大於 0" } as const;
  }

  return {
    value: {
      name,
      amount_default: amountMode === "fixed" ? amount : null,
      amount_mode: amountMode,
      schedule_type: scheduleType,
      schedule_months: scheduleType === "months" ? months : null,
      generate_day: 1,
      due_day: dueDay,
      payment_mode: paymentMode,
      starts_on: startsOn,
      ends_on: endsOn,
    },
  } as const;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspace_id") || "";
  if (!workspaceId) return apiError("缺少 workspace_id", { data: [] });

  const { data, error } = await supabase
    .from("bill_templates")
    .select(templateSelect)
    .eq("workspace_id", workspaceId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) return apiError(error.message, { status: 500, data: [] });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req: Request) {
  const body = await parseJson<TemplateBody>(req, {});
  const workspaceId = String(body.workspace_id || "");
  if (!workspaceId) return apiError("缺少 workspace_id");

  const parsed = validateTemplate(body);
  if ("error" in parsed && parsed.error) return apiError(parsed.error);

  const { data, error } = await supabase
    .from("bill_templates")
    .insert([{ workspace_id: workspaceId, ...parsed.value, active: true }])
    .select(templateSelect)
    .single();

  if (error) return apiError(error.message, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: Request) {
  const body = await parseJson<TemplateBody>(req, {});
  const workspaceId = String(body.workspace_id || "");
  const id = String(body.id || "");
  if (!workspaceId || !id) return apiError("缺少 workspace_id / id");

  if (body.active !== undefined && body.name === undefined) {
    const { error } = await supabase
      .from("bill_templates")
      .update({ active: Boolean(body.active) })
      .eq("workspace_id", workspaceId)
      .eq("id", id);

    if (error) return apiError(error.message, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const parsed = validateTemplate(body);
  if ("error" in parsed && parsed.error) return apiError(parsed.error);

  const { data, error } = await supabase
    .from("bill_templates")
    .update({ ...parsed.value, active: body.active === undefined ? true : Boolean(body.active) })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .select(templateSelect)
    .single();

  if (error) return apiError(error.message, { status: 500 });
  return NextResponse.json({ success: true, data });
}
