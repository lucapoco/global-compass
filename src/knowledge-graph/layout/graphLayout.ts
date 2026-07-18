/**
 * Graph Layout Engine
 *
 * Computes x/y positions for knowledge graph nodes using a
 * radial cluster layout algorithm designed for intelligence graphs.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LAYOUT ALGORITHM
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Layer 0 — TOPIC nodes:  arranged in a tight central cluster
 * Layer 1 — COUNTRY nodes: distributed evenly on a large outer ring
 * Layer 2 — EVENT nodes:   placed near their associated country node
 *           (radially offset from country position)
 *
 * Country angle is determined by geographic longitude when available,
 * otherwise by alphabetical order for stable, reproducible layouts.
 *
 * Event nodes use a polar grid around their country node:
 *   radius = BASE_ORBIT + (index / eventsPerCountry) × ORBIT_SPREAD
 *   angle  = country_angle ± angular_spread / 2
 *
 * Uncategorized events (no country) are distributed on an intermediate ring.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * GEOGRAPHIC LONGITUDE TABLE (approximate, for ring ordering)
 * ─────────────────────────────────────────────────────────────────────────
 * Countries are sorted west-to-east (lng –180 → +180) so geographically
 * close countries appear adjacent on the ring, creating a visually
 * intuitive layout that resembles a world map projected onto a circle.
 */
import type { KnowledgeNode, KnowledgeEdge } from "../types";

// ─── Layout parameters ────────────────────────────────────────────────────────

const TOPIC_RING_RADIUS  = 180;
const COUNTRY_RING_RADIUS = 700;
const EVENT_ORBIT_BASE    = 180;
const EVENT_ORBIT_SPREAD  = 80;
const TOPIC_SPREAD_ANGLE  = (2 * Math.PI) / 12;

// ─── Approximate longitude for ring ordering ──────────────────────────────────

const COUNTRY_LNG: Record<string, number> = {
  "Canada": -95, "United States": -98, "Mexico": -102,
  "Brazil": -51, "Argentina": -65, "Colombia": -75, "Chile": -71,
  "Peru": -76, "Venezuela": -65, "Ecuador": -78,
  "United Kingdom": -3, "Ireland": -8, "Portugal": -8, "Spain": -4,
  "France": 2, "Belgium": 4, "Netherlands": 5, "Switzerland": 8,
  "Germany": 10, "Italy": 12, "Austria": 14, "Czechia": 16,
  "Sweden": 18, "Norway": 10, "Denmark": 10, "Poland": 20,
  "Hungary": 19, "Romania": 25, "Bulgaria": 25, "Greece": 22,
  "Serbia": 21, "Croatia": 16, "Ukraine": 32, "Moldova": 29,
  "Russia": 60, "Belarus": 28, "Albania": 20, "Kosovo": 21,
  "Turkey": 35, "Israel": 35, "Palestine": 35, "Lebanon": 36,
  "Jordan": 38, "Syria": 38, "Iraq": 44, "Iran": 53,
  "Saudi Arabia": 45, "Yemen": 48, "Oman": 57,
  "United Arab Emirates": 54, "Kuwait": 48, "Qatar": 51, "Bahrain": 50,
  "Libya": 17, "Egypt": 30, "Tunisia": 9, "Morocco": -7,
  "Algeria": 3, "Sudan": 30, "Ethiopia": 40, "Somalia": 46,
  "Kenya": 38, "Tanzania": 35, "Nigeria": 8, "Ghana": -1,
  "South Africa": 25, "Angola": 18, "Mozambique": 35,
  "Pakistan": 70, "India": 79, "Bangladesh": 90, "Nepal": 84,
  "Sri Lanka": 81, "Afghanistan": 68,
  "Kazakhstan": 68, "Uzbekistan": 63,
  "China": 104, "Mongolia": 106, "Japan": 138, "South Korea": 128,
  "North Korea": 127, "Taiwan": 121,
  "Vietnam": 108, "Thailand": 101, "Myanmar": 96, "Cambodia": 105,
  "Laos": 103, "Malaysia": 110, "Indonesia": 110, "Philippines": 122,
  "Singapore": 104,
  "Australia": 134, "New Zealand": 172,
  "Papua New Guinea": 145,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function polarToCart(r: number, angle: number): { x: number; y: number } {
  return { x: Math.round(r * Math.cos(angle)), y: Math.round(r * Math.sin(angle)) };
}

function jitter(seed: string, range: number): number {
  // deterministic pseudo-random from string
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return ((hash % 1000) / 1000 - 0.5) * 2 * range;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function computeLayout(
  nodes: KnowledgeNode[],
  _edges: KnowledgeEdge[],
): KnowledgeNode[] {
  const countryNodes = nodes.filter((n) => n.type === "country");
  const topicNodes   = nodes.filter((n) => n.type === "topic");
  const eventNodes   = nodes.filter((n) => n.type !== "country" && n.type !== "topic");

  const posMap = new Map<string, { x: number; y: number }>();

  // ── Topic nodes: central ring ─────────────────────────────────────────
  topicNodes.forEach((n, i) => {
    const angle = (i / Math.max(1, topicNodes.length)) * 2 * Math.PI - Math.PI / 2;
    posMap.set(n.id, polarToCart(TOPIC_RING_RADIUS, angle));
  });

  // ── Country nodes: outer ring sorted by longitude ─────────────────────
  const sortedCountries = [...countryNodes].sort((a, b) => {
    const lngA = COUNTRY_LNG[a.label] ?? 0;
    const lngB = COUNTRY_LNG[b.label] ?? 0;
    return lngA - lngB;
  });

  const countryAngles = new Map<string, number>();
  sortedCountries.forEach((n, i) => {
    const angle = (i / Math.max(1, sortedCountries.length)) * 2 * Math.PI - Math.PI / 2;
    countryAngles.set(n.country ?? n.label, angle);
    posMap.set(n.id, polarToCart(COUNTRY_RING_RADIUS, angle));
  });

  // ── Event nodes: clustered around their country ───────────────────────
  // Group event nodes by country
  const byCountry = new Map<string, KnowledgeNode[]>();
  const uncategorized: KnowledgeNode[] = [];
  for (const n of eventNodes) {
    if (n.country && countryAngles.has(n.country)) {
      const arr = byCountry.get(n.country) ?? [];
      arr.push(n);
      byCountry.set(n.country, arr);
    } else {
      uncategorized.push(n);
    }
  }

  for (const [country, cEvents] of byCountry) {
    const baseAngle = countryAngles.get(country) ?? 0;
    const spreadAngle = Math.min(Math.PI / 3, (cEvents.length / 4) * TOPIC_SPREAD_ANGLE);

    cEvents.forEach((n, i) => {
      const t = cEvents.length > 1 ? i / (cEvents.length - 1) : 0.5;
      const angle = baseAngle - spreadAngle / 2 + t * spreadAngle;
      const radius = EVENT_ORBIT_BASE + (i % 3) * EVENT_ORBIT_SPREAD;
      const countryPos = posMap.get(`country:${country.toLowerCase().replace(/\s+/g, "_")}`)
        ?? polarToCart(COUNTRY_RING_RADIUS, baseAngle);
      posMap.set(n.id, {
        x: countryPos.x + radius * Math.cos(angle) + jitter(n.id, 20),
        y: countryPos.y + radius * Math.sin(angle) + jitter(n.id + "y", 20),
      });
    });
  }

  // Uncategorized events: intermediate ring
  const midRadius = (TOPIC_RING_RADIUS + COUNTRY_RING_RADIUS) / 2;
  uncategorized.forEach((n, i) => {
    const angle = (i / Math.max(1, uncategorized.length)) * 2 * Math.PI;
    posMap.set(n.id, polarToCart(midRadius, angle));
  });

  return nodes.map((n) => {
    const pos = posMap.get(n.id) ?? { x: 0, y: 0 };
    return { ...n, x: pos.x, y: pos.y };
  });
}
