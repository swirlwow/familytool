"use client";

import { Plus } from "lucide-react";

export function MobileFab({
  onClick,
  label = "新增",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        md:hidden fixed right-4 z-50
        bottom-[88px] pb-safe
        w-14 h-14 rounded-full
        bg-sky-600 hover:bg-sky-700 active:scale-95
        text-white shadow-lg shadow-sky-200/40
        flex items-center justify-center
      "
      aria-label={label}
      title={label}
    >
      <Plus className="w-7 h-7" strokeWidth={2.5} />
    </button>
  );
}
