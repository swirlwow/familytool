"use client";

import { LucideIcon } from "lucide-react";

export type StatTheme = 
  | "slate" | "rose" | "emerald" | "amber" 
  | "sky" | "cyan" | "violet" | "pink" | "yellow";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  theme?: StatTheme;
  loading?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  theme = "slate",
  loading = false,
}: StatCardProps) {
  
  const styles = {
    slate: { text: "text-slate-800", title: "text-slate-400" },
    rose: { text: "text-rose-500", title: "text-rose-500" },
    emerald: { text: "text-emerald-500", title: "text-emerald-500" },
    amber: { text: "text-amber-500", title: "text-amber-500" },
    sky: { text: "text-sky-600", title: "text-sky-500" },
    cyan: { text: "text-slate-800", title: "text-slate-400" },
    violet: { text: "text-violet-600", title: "text-violet-500" },
    pink: { text: "text-pink-600", title: "text-pink-500" },
    yellow: { text: "text-yellow-700", title: "text-yellow-600" },
  };

  const s = styles[theme] || styles.slate;

  return (
    <div className="stat-card min-w-0 h-full rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex h-full min-h-20 flex-col justify-between p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${s.title}`}>
            {Icon && <Icon className="w-4 h-4" />}
            {title}
          </div>
        </div>

        <div className="mt-auto">
          {loading ? (
            <div className="h-9 w-32 bg-slate-100 rounded-lg animate-pulse" />
          ) : (
            <div className={`stat-value font-black tabular-nums ${s.text}`}>
              {value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
