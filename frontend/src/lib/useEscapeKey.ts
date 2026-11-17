"use client";
import { useEffect, useRef } from "react";

// Open modals and dropdowns, most recent last. Only the top one reacts to
// Escape, so closing a confirm card does not also close the form behind it.
const stack: symbol[] = [];

export function useEscapeKey(onEscape: () => void, enabled = true) {
  const callback = useRef(onEscape);
  callback.current = onEscape;

  useEffect(() => {
    if (!enabled) return;
    const token = Symbol("escape");
    stack.push(token);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || stack[stack.length - 1] !== token) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      callback.current();
    };
    // Capture phase, so the top layer handles Escape before older listeners.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      const index = stack.indexOf(token);
      if (index >= 0) stack.splice(index, 1);
    };
  }, [enabled]);
}

/** Drop inside a conditionally rendered modal: Escape calls onEscape while it is shown. */
export function EscapeKey({ onEscape }: { onEscape: () => void }) {
  useEscapeKey(onEscape);
  return null;
}
