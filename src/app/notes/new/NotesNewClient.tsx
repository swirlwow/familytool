// src/app/notes/new/NotesNewClient.tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

const WORKSPACE_ID = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

export default function NotesNewClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const once = useRef(false);

  useEffect(() => {
    if (once.current) return;
    once.current = true;

    (async () => {
      try {
        if (!WORKSPACE_ID) throw new Error("未設定 WORKSPACE_ID（請檢查 .env.local）");

        const date = sp.get("date") || ""; // YYYY-MM-DD
        const owner = sp.get("owner") || "家庭";

        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace_id: WORKSPACE_ID,
            owner,
            title: "",
            content: "",
            date_from: date || null,
            date_to: date || null,
            // 兼容舊欄位
            note_date: date || null,
            is_important: false,
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error || "新增記事失敗");

        const id = j?.data?.id;
        if (!id) throw new Error("新增成功但缺少 id");

        router.replace(`/notes/${encodeURIComponent(id)}`);
      } catch (e: any) {
        toast({ variant: "destructive", title: "新增記事失敗", description: e.message });
        router.replace("/calendar");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
      <div className="text-slate-400">建立記事中…</div>
    </main>
  );
}
