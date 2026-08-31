"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type TextInputDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  value: string;
  busy?: boolean;
  confirmLabel?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  onValueChange: (value: string) => void;
  onConfirm: () => boolean | void | Promise<boolean | void>;
  onOpenChange: (open: boolean) => void;
};

export function TextInputDialog({
  open,
  title,
  description,
  label,
  value,
  busy = false,
  confirmLabel = "儲存",
  inputMode = "text",
  onValueChange,
  onConfirm,
  onOpenChange,
}: TextInputDialogProps) {
  async function runConfirm() {
    const result = await onConfirm();
    if (result !== false) onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <AlertDialogContent className="max-w-md rounded-3xl border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-black text-slate-900">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <label className="space-y-2 text-left">
          <span className="text-sm font-bold text-slate-700">{label}</span>
          <Input
            autoFocus
            inputMode={inputMode}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && !busy) {
                event.preventDefault();
                void runConfirm();
              }
            }}
            className="h-11 rounded-xl"
          />
        </label>
        <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={busy} className="rounded-xl">取消</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="rounded-xl bg-violet-700 text-white hover:bg-violet-800"
            onClick={(event) => {
              event.preventDefault();
              void runConfirm();
            }}
          >
            {busy ? "處理中…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
