// src/components/DayNotesDrawer.tsx
"use client";

import { X, CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { NoteRangeBadge } from "@/components/NoteRangeBadge";

type NoteRow = {
  id: string;
  title: string;
  note_date: string | null;
  date_from: string | null;
  date_to: string | null;
};

export function DayNotesDrawer({
  open,
  onClose,
  date,
  notes,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  notes: NoteRow[];
}) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-slate-800">當日記事</div>
              <div className="text-xs text-slate-400">{date}</div>
            </div>
          </div>

          <button className="btn btn-ghost btn-sm rounded-xl" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-auto h-[calc(100%-72px)]">
          {notes.length === 0 ? (
            <div className="text-slate-400 text-sm py-10 text-center">
              這天沒有記事
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-slate-800 truncate">
                      {n.title}
                    </div>
                    <div className="mt-2">
                      <NoteRangeBadge note={n} />
                    </div>
                  </div>

                  <button
                    className="btn btn-sm rounded-xl"
                    onClick={() => router.push(`/notes/${n.id}`)}
                  >
                    開啟
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
