import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Only allow http(s) links to be used as `<a href>` targets. Guards against
 * `javascript:`/`data:` URLs sneaking in through upstream provider data
 * (news articles, alerts, saved items) that ultimately gets rendered as a
 * clickable "Open source" / "View" link.
 */
export function sanitizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const base = typeof window !== "undefined" ? window.location.origin : "https://example.com";
    const parsed = new URL(url, base);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}
