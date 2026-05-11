// Lightweight wrapper for public FX data (optional / not used on critical paths).
export async function getExchangeRates(base = "USD"): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.rates ?? null;
  } catch {
    return null;
  }
}
