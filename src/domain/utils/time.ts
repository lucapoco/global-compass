export function toIsoOrNow(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return new Date().toISOString();
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function hoursBetween(a: string, b: string): number {
  const diffMs = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diffMs / (1000 * 60 * 60);
}

export function isWithinLastMs(iso: string, windowMs: number, now: number = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= windowMs && now - t >= 0 - windowMs;
}

export function ageMs(iso: string, now: number = Date.now()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, now - t);
}
