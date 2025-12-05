import { useEffect, useCallback } from "react";

export interface Shortcut {
  /** The key to match (e.g., "a", "ArrowUp", " " for space) */
  key?: string;
  /** The code to match (e.g., "KeyA") - useful for macOS Alt key compatibility */
  code?: string;
  /** Modifier keys required for this shortcut */
  modifiers?: {
    /** Cmd on Mac, Ctrl on Windows */
    meta?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
  };
  /** The action to execute when shortcut is triggered */
  action: () => void;
  /** Optional condition - shortcut only triggers if this returns true */
  when?: () => boolean;
  /** Whether to call preventDefault (default: true) */
  preventDefault?: boolean;
  /** Whether to call stopPropagation (default: false) */
  stopPropagation?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled (e.g., disable when editing text) */
  enabled?: boolean;
  /** Custom keydown handler for special cases (runs before shortcut matching) */
  onKeyDown?: (e: KeyboardEvent) => void;
  /** Custom keyup handler for special cases */
  onKeyUp?: (e: KeyboardEvent) => void;
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(e: KeyboardEvent, shortcut: Shortcut): boolean {
  // Check key or code match
  const keyMatches = shortcut.key
    ? e.key === shortcut.key ||
      e.key.toLowerCase() === shortcut.key.toLowerCase()
    : true;
  const codeMatches = shortcut.code ? e.code === shortcut.code : true;

  // Must match at least one of key or code
  if (!shortcut.key && !shortcut.code) return false;
  if (shortcut.key && !keyMatches) return false;
  if (shortcut.code && !codeMatches) return false;

  // Check modifiers
  const mods = shortcut.modifiers || {};

  // meta: true means Cmd on Mac, Ctrl on Windows
  const metaRequired = mods.meta || false;
  const metaPressed = e.metaKey || e.ctrlKey;
  if (metaRequired !== metaPressed) return false;

  // Explicit ctrl (rarely needed, meta handles cross-platform)
  if (mods.ctrl !== undefined && mods.ctrl !== e.ctrlKey) return false;

  // Alt key
  const altRequired = mods.alt || false;
  if (altRequired !== e.altKey) return false;

  // Shift key
  const shiftRequired = mods.shift || false;
  if (shiftRequired !== e.shiftKey) return false;

  // Check optional condition
  if (shortcut.when && !shortcut.when()) return false;

  return true;
}

/**
 * Hook for declarative keyboard shortcuts
 *
 * @example
 * ```tsx
 * const shortcuts = useMemo(() => [
 *   { key: "v", action: () => setTool("select") },
 *   { key: "c", modifiers: { meta: true }, action: copySelected },
 *   { code: "KeyA", modifiers: { alt: true }, action: alignLeft },
 * ], [setTool, copySelected, alignLeft]);
 *
 * useKeyboardShortcuts(shortcuts, { enabled: !isEditing });
 * ```
 */
export function useKeyboardShortcuts(
  shortcuts: Shortcut[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true, onKeyDown, onKeyUp } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Run custom handler first
      onKeyDown?.(e);

      // Skip if disabled
      if (!enabled) return;

      // Skip if focus is on an input element (forms, contenteditable, etc.)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      // Find and execute matching shortcut
      for (const shortcut of shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          // Default to preventDefault: true
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          if (shortcut.stopPropagation) {
            e.stopPropagation();
          }
          shortcut.action();
          return; // Only execute first matching shortcut
        }
      }
    },
    [shortcuts, enabled, onKeyDown]
  );

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      onKeyUp?.(e);
    },
    [onKeyUp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}

