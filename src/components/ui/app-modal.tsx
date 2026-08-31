"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";

/** Shared focus trap and scroll boundary; callers retain their save/cancel handlers. */
export function AppModal({ title, onClose, children, wide = true }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="family-modal-overlay" />
      <Dialog.Content ref={content} className={`family-dialog family-shell ${wide ? "family-dialog-wide" : ""}`}
        aria-describedby={undefined}
        onOpenAutoFocus={event => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          // Start at the dialog heading, not an input which would immediately open the phone keyboard.
          event.preventDefault();
          content.current?.focus();
        }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
