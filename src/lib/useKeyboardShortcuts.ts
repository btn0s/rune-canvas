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
  // #region agent log
  if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
    console.log('[DEBUG] checking shortcut match', {eventKey:e.key,eventCode:e.code,shortcutKey:shortcut.key,shortcutCode:shortcut.code,modifiers:shortcut.modifiers});
    fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:38',message:'checking shortcut match',data:{eventKey:e.key,eventCode:e.code,shortcutKey:shortcut.key,shortcutCode:shortcut.code,modifiers:shortcut.modifiers},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }
  // #endregion
  // Check key or code match
  const keyMatches = shortcut.key
    ? e.key === shortcut.key ||
      e.key.toLowerCase() === shortcut.key.toLowerCase()
    : true;
  const codeMatches = shortcut.code ? e.code === shortcut.code : true;

  // Must match at least one of key or code
  if (!shortcut.key && !shortcut.code) return false;
  if (shortcut.key && !keyMatches) {
    // #region agent log
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      console.log('[DEBUG] key mismatch', {eventKey:e.key,shortcutKey:shortcut.key});
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:48',message:'key mismatch',data:{eventKey:e.key,shortcutKey:shortcut.key},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    return false;
  }
  if (shortcut.code && !codeMatches) return false;

  // Check modifiers
  const mods = shortcut.modifiers || {};

  // meta: true means Cmd on Mac, Ctrl on Windows
  const metaRequired = mods.meta || false;
  const metaPressed = e.metaKey || e.ctrlKey;
  if (metaRequired !== metaPressed) {
    // #region agent log
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      console.log('[DEBUG] meta modifier mismatch', {metaRequired,metaPressed,eMetaKey:e.metaKey,eCtrlKey:e.ctrlKey});
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:57',message:'meta modifier mismatch',data:{metaRequired,metaPressed,eMetaKey:e.metaKey,eCtrlKey:e.ctrlKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    return false;
  }

  // Explicit ctrl (rarely needed, meta handles cross-platform)
  if (mods.ctrl !== undefined && mods.ctrl !== e.ctrlKey) return false;

  // Alt key
  const altRequired = mods.alt || false;
  if (altRequired !== e.altKey) return false;

  // Shift key
  const shiftRequired = mods.shift || false;
  if (shiftRequired !== e.shiftKey) {
    // #region agent log
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      console.log('[DEBUG] shift modifier mismatch', {shiftRequired,eShiftKey:e.shiftKey,modifiers:mods});
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:68',message:'shift modifier mismatch',data:{shiftRequired,eShiftKey:e.shiftKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    return false;
  }

  // Check optional condition
  if (shortcut.when && !shortcut.when()) {
    // #region agent log
    if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
      console.log('[DEBUG] when condition failed');
      fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:71',message:'when condition failed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    }
    // #endregion
    return false;
  }

  // #region agent log
  if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
    console.log('[DEBUG] shortcut MATCHED!', {shortcutKey:shortcut.key,modifiers:mods});
  }
  // #endregion
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
      // #region agent log
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        console.log('[DEBUG] handleKeyDown: cmd+z keydown detected', {key:e.key,metaKey:e.metaKey,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,enabled,shortcutsCount:shortcuts.length,target:(e.target as HTMLElement)?.tagName});
        fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:97',message:'cmd+z keydown detected',data:{key:e.key,metaKey:e.metaKey,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey,enabled,shortcutsCount:shortcuts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
      // Run custom handler first
      onKeyDown?.(e);

      // Skip if disabled
      if (!enabled) {
        // #region agent log
        if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
          console.log('[DEBUG] shortcuts disabled', {enabled});
          fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:102',message:'shortcuts disabled',data:{enabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        }
        // #endregion
        return;
      }

      // Skip if focus is on an input element (forms, contenteditable, etc.)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        // #region agent log
        if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
          console.log('[DEBUG] skipped - input element', {tagName:target.tagName,isContentEditable:target.isContentEditable});
          fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:111',message:'skipped - input element',data:{tagName:target.tagName,isContentEditable:target.isContentEditable},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        }
        // #endregion
        return;
      }

      // Find and execute matching shortcut
      for (let i = 0; i < shortcuts.length; i++) {
        const shortcut = shortcuts[i];
        if (matchesShortcut(e, shortcut)) {
          // #region agent log
          if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
            console.log('[DEBUG] shortcut matched - executing action', {index:i,key:shortcut.key,code:shortcut.code,hasAction:!!shortcut.action,modifiers:shortcut.modifiers});
            fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:117',message:'shortcut matched - executing action',data:{key:shortcut.key,code:shortcut.code,hasAction:!!shortcut.action},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }
          // #endregion
          // Default to preventDefault: true
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          if (shortcut.stopPropagation) {
            e.stopPropagation();
          }
          shortcut.action();
          // #region agent log
          if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
            console.log('[DEBUG] action executed');
            fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:126',message:'action executed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }
          // #endregion
          return; // Only execute first matching shortcut
        }
      }
      // #region agent log
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        console.log('[DEBUG] no shortcut matched', {shortcutsChecked:shortcuts.length});
        fetch('http://127.0.0.1:7250/ingest/489067f9-1dbe-4235-9816-21c1c421f1e2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useKeyboardShortcuts.ts:129',message:'no shortcut matched',data:{shortcutsChecked:shortcuts.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      }
      // #endregion
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
    console.log('[DEBUG] useKeyboardShortcuts: registering event listeners', {shortcutsCount:shortcuts.length,enabled});
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp);
    
    // Add a test listener to verify events are firing
    const testListener = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        console.log('[DEBUG] TEST LISTENER: cmd+z detected', {key:e.key,metaKey:e.metaKey,ctrlKey:e.ctrlKey,shiftKey:e.shiftKey});
      }
    };
    window.addEventListener("keydown", testListener, { capture: true });

    return () => {
      console.log('[DEBUG] useKeyboardShortcuts: removing event listeners');
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("keydown", testListener, { capture: true });
    };
  }, [handleKeyDown, handleKeyUp, shortcuts.length, enabled]);
}

