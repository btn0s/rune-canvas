import { useCallback, useRef } from "react";

/**
 * Hook to manage deferred history capture for interactions.
 * Ensures history is captured exactly once per interaction, on first movement.
 */
export function useHistoryCapture(pushHistory: () => void) {
  const captured = useRef(false);

  /**
   * Capture history if not already captured this interaction.
   * Call this when the user makes a meaningful change (e.g., moves > 2px).
   */
  const captureOnce = useCallback(() => {
    if (!captured.current) {
      pushHistory();
      captured.current = true;
    }
  }, [pushHistory]);

  /**
   * Reset capture state. Call this when the interaction ends.
   */
  const reset = useCallback(() => {
    captured.current = false;
  }, []);

  /**
   * Check if history has been captured this interaction.
   */
  const hasCaptured = useCallback(() => captured.current, []);

  return { captureOnce, reset, hasCaptured };
}

