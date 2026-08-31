"use client";

import { useEffect } from "react";
import { isKeyboardViewport } from "@/lib/client/viewport";

export function ViewportObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    function update() {
      const height = viewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-viewport-height", `${height}px`);
      root.style.setProperty("--app-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      const editing = document.activeElement?.matches("input:not([type=checkbox]):not([type=radio]), textarea, [contenteditable=true]") ?? false;
      root.toggleAttribute("data-keyboard-open", isKeyboardViewport(window.innerHeight, height, viewport?.scale ?? 1, editing));
    }
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
      root.removeAttribute("data-keyboard-open");
    };
  }, []);
  return null;
}
