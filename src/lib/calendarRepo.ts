// src/lib/calendarRepo.ts
import { supabase } from "@/lib/supabaseClient";

export type CalendarEventRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  start_at: string; // ISO
  end_at: string | null;
  all_day: boolean;
  color: string;
  location: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function listEvents(params: {
  workspace_id: string;
  from: string; // ISO
  to: string;   // ISO
  limit?: number;
}) {
  const { workspace_id, from, to, limit = 200 } = params;

  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("workspace_id", workspace_id)
    .is("deleted_at", null)
    .gte("start_at", from)
    .lte("start_at", to)
    .order("start_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarEventRow[];
}

export async function createEvent(input: {
  workspace_id: string;
  title: string;
  description?: string;
  start_at: string; // ISO
  end_at?: string | null;
  all_day?: boolean;
  color?: string;
  location?: string;
}) {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert([
      {
        workspace_id: input.workspace_id,
        title: input.title,
        description: input.description ?? "",
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        all_day: input.all_day ?? true,
        color: input.color ?? "amber",
        location: input.location ?? "",
      },
    ])
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data?.id as string;
}

export async function patchEvent(input: {
  workspace_id: string;
  id: string;
  title?: string;
  description?: string;
  start_at?: string;
  end_at?: string | null;
  all_day?: boolean;
  color?: string;
  location?: string;
}) {
  const { workspace_id, id, ...patch } = input;

  const { error } = await supabase
    .from("calendar_events")
    .update(patch)
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function softDeleteEvent(workspace_id: string, id: string) {
  const { error } = await supabase
    .from("calendar_events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspace_id)
    .eq("id", id);

  if (error) throw new Error(error.message);
}
