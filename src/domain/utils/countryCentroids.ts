/**
 * Lightweight country-name → approximate centroid lookup.
 *
 * Several intelligence sources (ReliefWeb, GDELT, RSS) report a country by
 * name but do not include point coordinates. Rather than dropping these
 * events from the map entirely, we plot them at a reasonable country
 * centroid — clearly distinguishable from precise point data (GDACS, USGS,
 * FIRMS all report exact coordinates) via `metadata.approximateLocation`.
 *
 * This is intentionally a curated subset (not a full gazetteer) covering the
 * countries that dominate real-world news/disaster/humanitarian coverage.
 * Unmatched countries simply render without a map pin — never fabricated.
 */
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "united states": { lat: 39.8, lng: -98.6 }, usa: { lat: 39.8, lng: -98.6 },
  "united kingdom": { lat: 54.0, lng: -2.0 }, uk: { lat: 54.0, lng: -2.0 },
  china: { lat: 35.9, lng: 104.2 }, russia: { lat: 61.5, lng: 105.3 },
  ukraine: { lat: 48.4, lng: 31.2 }, israel: { lat: 31.0, lng: 34.8 },
  palestine: { lat: 31.9, lng: 35.2 }, gaza: { lat: 31.5, lng: 34.5 },
  iran: { lat: 32.4, lng: 53.7 }, iraq: { lat: 33.2, lng: 43.7 },
  syria: { lat: 34.8, lng: 38.9 }, yemen: { lat: 15.6, lng: 48.0 },
  afghanistan: { lat: 33.9, lng: 67.7 }, pakistan: { lat: 30.4, lng: 69.3 },
  india: { lat: 22.4, lng: 78.7 }, "north korea": { lat: 40.3, lng: 127.5 },
  "south korea": { lat: 36.5, lng: 127.9 }, japan: { lat: 36.2, lng: 138.3 },
  france: { lat: 46.6, lng: 2.4 }, germany: { lat: 51.2, lng: 10.5 },
  italy: { lat: 42.8, lng: 12.6 }, spain: { lat: 40.4, lng: -3.7 },
  poland: { lat: 51.9, lng: 19.1 }, romania: { lat: 45.9, lng: 25.0 },
  turkey: { lat: 38.9, lng: 35.2 }, greece: { lat: 39.1, lng: 21.8 },
  egypt: { lat: 26.8, lng: 30.8 }, libya: { lat: 26.3, lng: 17.2 },
  sudan: { lat: 12.9, lng: 30.2 }, "south sudan": { lat: 7.0, lng: 30.0 },
  ethiopia: { lat: 9.1, lng: 40.5 }, somalia: { lat: 5.2, lng: 46.2 },
  nigeria: { lat: 9.1, lng: 8.7 }, "democratic republic of the congo": { lat: -4.0, lng: 21.8 },
  drc: { lat: -4.0, lng: 21.8 }, mali: { lat: 17.6, lng: -4.0 },
  niger: { lat: 17.6, lng: 8.1 }, chad: { lat: 15.5, lng: 18.7 },
  kenya: { lat: -0.02, lng: 37.9 }, mozambique: { lat: -18.7, lng: 35.5 },
  "south africa": { lat: -30.6, lng: 22.9 }, myanmar: { lat: 21.9, lng: 95.9 },
  bangladesh: { lat: 23.7, lng: 90.4 }, philippines: { lat: 12.9, lng: 121.8 },
  indonesia: { lat: -0.8, lng: 113.9 }, vietnam: { lat: 14.1, lng: 108.3 },
  thailand: { lat: 15.9, lng: 100.9 }, nepal: { lat: 28.4, lng: 84.1 },
  haiti: { lat: 18.9, lng: -72.3 }, mexico: { lat: 23.6, lng: -102.5 },
  brazil: { lat: -14.2, lng: -51.9 }, colombia: { lat: 4.6, lng: -74.3 },
  venezuela: { lat: 6.4, lng: -66.6 }, argentina: { lat: -38.4, lng: -63.6 },
  chile: { lat: -35.7, lng: -71.5 }, peru: { lat: -9.2, lng: -75.0 },
  canada: { lat: 56.1, lng: -106.3 }, australia: { lat: -25.3, lng: 133.8 },
  lebanon: { lat: 33.9, lng: 35.9 }, jordan: { lat: 30.6, lng: 36.2 },
  "saudi arabia": { lat: 23.9, lng: 45.1 }, "united arab emirates": { lat: 23.4, lng: 53.8 },
  taiwan: { lat: 23.7, lng: 121.0 }, philippines2: { lat: 12.9, lng: 121.8 },
  moldova: { lat: 47.4, lng: 28.4 }, georgia: { lat: 42.3, lng: 43.4 },
  armenia: { lat: 40.1, lng: 45.0 }, azerbaijan: { lat: 40.1, lng: 47.6 },
};

/** Best-effort country name → { lat, lng } centroid. Returns undefined if unknown. */
export function getCountryCentroid(countryName: string | undefined | null): { lat: number; lng: number } | undefined {
  if (!countryName) return undefined;
  return COUNTRY_CENTROIDS[countryName.trim().toLowerCase()];
}
