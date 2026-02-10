/**
 * Utility functions for MSE React components.
 */

/**
 * Merge class names conditionally.
 * Lightweight alternative to clsx + tailwind-merge.
 * Filters out falsy values and joins with spaces.
 */
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
