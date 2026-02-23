// src/components/NoteRangeBadge.tsx
"use client";

type NoteLike = {
  note_date?: string | null;
  date_from?: string | null;
  date_to?: string | null;
};

function pickFrom(n: NoteLike) {
  return n.date_from || n.note_date || null;
}
function pickTo(n: NoteLike) {
  return n.date_to || n.date_from || n.note_date || null;
}

export function NoteRangeBadge({ note }: { note: NoteLike }) {
  const from = pickFrom(note);
  const to = pickTo(note);

  if (!from && !to) {
    return (
      <span className="badge bg-slate-100 text-slate-600 border-none">
        未設定日期
      </span>
    );
  }

  if (from && to && from !== to) {
    return (
      <span className="badge bg-emerald-100 text-emerald-700 border-none">
        {from} ～ {to}
      </span>
    );
  }

  return (
    <span className="badge bg-indigo-100 text-indigo-700 border-none">
      {from || to}
    </span>
  );
}
