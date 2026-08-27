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

type ConfirmActionDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
};

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "確認",
  busy = false,
  destructive = false,
  onConfirm,
  onOpenChange,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
      <AlertDialogContent className="max-w-md rounded-3xl border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-black text-slate-900">{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription className="whitespace-pre-line leading-6 text-slate-600">
              {description}
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-2 gap-2 sm:gap-0">
          <AlertDialogCancel disabled={busy} className="rounded-xl">
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={
              destructive
                ? "rounded-xl bg-rose-600 text-white hover:bg-rose-700"
                : "rounded-xl bg-violet-700 text-white hover:bg-violet-800"
            }
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {busy ? "處理中…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
