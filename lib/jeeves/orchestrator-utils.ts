/**
 * Jeeves Orchestrator Utilities
 *
 * Shared helper functions for orchestration logic
 */

/**
 * Calculate next analysis time based on flexible interval format
 * Supports: "Nmin" (e.g., "5min", "30min", "90min") or "Nhour" (e.g., "1hour", "2hour", "6hour")
 */
export function calculateNextAnalysis(interval: string): Date {
  const now = new Date();

  // Parse flexible format: "Nmin" or "Nhour"
  const minMatch = interval.match(/^(\d+)min$/);
  const hourMatch = interval.match(/^(\d+)hour$/);

  let milliseconds = 0;

  if (minMatch) {
    milliseconds = parseInt(minMatch[1]) * 60 * 1000;
  } else if (hourMatch) {
    milliseconds = parseInt(hourMatch[1]) * 60 * 60 * 1000;
  } else {
    // Fallback to 5 minutes if format is invalid
    console.warn(`[Jeeves] Invalid interval format: "${interval}" - falling back to 5min`);
    milliseconds = 5 * 60 * 1000;
  }

  return new Date(now.getTime() + milliseconds);
}
