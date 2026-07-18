/**
 * Set local minim de țări — rezervă de ultimă instanță când proxy-ul backend
 * și API-ul REST Countries sunt ambele indisponibile.
 *
 * Conține cele 50 de țări cele mai relevante pentru intelligence, cutremure
 * și risc, astfel încât căutarea, capitalele pe hartă și compararea funcționează offline.
 */
import type { Country } from "@/types";

export const FALLBACK_COUNTRIES: Country[] = [
  { name: { common: "Romania", official: "Romania" }, cca2: "RO", cca3: "ROU", capital: ["Bucharest"], region: "Europe", subregion: "Eastern Europe", population: 19_237_691, area: 238397, flags: { png: "https://flagcdn.com/w320/ro.png" }, latlng: [46, 25] },
  { name: { common: "United States", official: "United States of America" }, cca2: "US", cca3: "USA", capital: ["Washington, D.C."], region: "Americas", subregion: "Northern America", population: 329_484_123, area: 9372610, flags: { png: "https://flagcdn.com/w320/us.png" }, latlng: [38, -97] },
  { name: { common: "United Kingdom", official: "United Kingdom of Great Britain and Northern Ireland" }, cca2: "GB", cca3: "GBR", capital: ["London"], region: "Europe", subregion: "Northern Europe", population: 67_215_293, area: 242900, flags: { png: "https://flagcdn.com/w320/gb.png" }, latlng: [54, -2] },
  { name: { common: "Germany", official: "Federal Republic of Germany" }, cca2: "DE", cca3: "DEU", capital: ["Berlin"], region: "Europe", subregion: "Western Europe", population: 83_240_525, area: 357114, flags: { png: "https://flagcdn.com/w320/de.png" }, latlng: [51, 9] },
  { name: { common: "France", official: "French Republic" }, cca2: "FR", cca3: "FRA", capital: ["Paris"], region: "Europe", subregion: "Western Europe", population: 67_391_582, area: 551695, flags: { png: "https://flagcdn.com/w320/fr.png" }, latlng: [46, 2] },
  { name: { common: "Russia", official: "Russian Federation" }, cca2: "RU", cca3: "RUS", capital: ["Moscow"], region: "Europe", subregion: "Eastern Europe", population: 144_104_080, area: 17098242, flags: { png: "https://flagcdn.com/w320/ru.png" }, latlng: [60, 100] },
  { name: { common: "China", official: "People's Republic of China" }, cca2: "CN", cca3: "CHN", capital: ["Beijing"], region: "Asia", subregion: "Eastern Asia", population: 1_402_112_000, area: 9596960, flags: { png: "https://flagcdn.com/w320/cn.png" }, latlng: [35, 105] },
  { name: { common: "India", official: "Republic of India" }, cca2: "IN", cca3: "IND", capital: ["New Delhi"], region: "Asia", subregion: "Southern Asia", population: 1_380_004_385, area: 3287590, flags: { png: "https://flagcdn.com/w320/in.png" }, latlng: [20, 77] },
  { name: { common: "Ukraine", official: "Ukraine" }, cca2: "UA", cca3: "UKR", capital: ["Kyiv"], region: "Europe", subregion: "Eastern Europe", population: 44_134_693, area: 603550, flags: { png: "https://flagcdn.com/w320/ua.png" }, latlng: [49, 32] },
  { name: { common: "Japan", official: "Japan" }, cca2: "JP", cca3: "JPN", capital: ["Tokyo"], region: "Asia", subregion: "Eastern Asia", population: 125_681_593, area: 377930, flags: { png: "https://flagcdn.com/w320/jp.png" }, latlng: [36, 138] },
  { name: { common: "South Korea", official: "Republic of Korea" }, cca2: "KR", cca3: "KOR", capital: ["Seoul"], region: "Asia", subregion: "Eastern Asia", population: 51_780_579, area: 100210, flags: { png: "https://flagcdn.com/w320/kr.png" }, latlng: [37, 127.5] },
  { name: { common: "North Korea", official: "Democratic People's Republic of Korea" }, cca2: "KP", cca3: "PRK", capital: ["Pyongyang"], region: "Asia", subregion: "Eastern Asia", population: 25_778_816, area: 120538, flags: { png: "https://flagcdn.com/w320/kp.png" }, latlng: [40, 127] },
  { name: { common: "Israel", official: "State of Israel" }, cca2: "IL", cca3: "ISR", capital: ["Jerusalem"], region: "Asia", subregion: "Western Asia", population: 9_216_900, area: 20770, flags: { png: "https://flagcdn.com/w320/il.png" }, latlng: [31.5, 34.75] },
  { name: { common: "Iran", official: "Islamic Republic of Iran" }, cca2: "IR", cca3: "IRN", capital: ["Tehran"], region: "Asia", subregion: "Southern Asia", population: 83_992_949, area: 1648195, flags: { png: "https://flagcdn.com/w320/ir.png" }, latlng: [32, 53] },
  { name: { common: "Iraq", official: "Republic of Iraq" }, cca2: "IQ", cca3: "IRQ", capital: ["Baghdad"], region: "Asia", subregion: "Western Asia", population: 40_222_493, area: 438317, flags: { png: "https://flagcdn.com/w320/iq.png" }, latlng: [33, 44] },
  { name: { common: "Turkey", official: "Republic of Turkey" }, cca2: "TR", cca3: "TUR", capital: ["Ankara"], region: "Asia", subregion: "Western Asia", population: 84_339_067, area: 783562, flags: { png: "https://flagcdn.com/w320/tr.png" }, latlng: [39, 35] },
  { name: { common: "Saudi Arabia", official: "Kingdom of Saudi Arabia" }, cca2: "SA", cca3: "SAU", capital: ["Riyadh"], region: "Asia", subregion: "Western Asia", population: 34_813_871, area: 2149690, flags: { png: "https://flagcdn.com/w320/sa.png" }, latlng: [25, 45] },
  { name: { common: "Pakistan", official: "Islamic Republic of Pakistan" }, cca2: "PK", cca3: "PAK", capital: ["Islamabad"], region: "Asia", subregion: "Southern Asia", population: 220_892_340, area: 881912, flags: { png: "https://flagcdn.com/w320/pk.png" }, latlng: [30, 70] },
  { name: { common: "Brazil", official: "Federative Republic of Brazil" }, cca2: "BR", cca3: "BRA", capital: ["Brasília"], region: "Americas", subregion: "South America", population: 212_559_417, area: 8515767, flags: { png: "https://flagcdn.com/w320/br.png" }, latlng: [-10, -55] },
  { name: { common: "Mexico", official: "United Mexican States" }, cca2: "MX", cca3: "MEX", capital: ["Mexico City"], region: "Americas", subregion: "North America", population: 128_932_753, area: 1964375, flags: { png: "https://flagcdn.com/w320/mx.png" }, latlng: [23, -102] },
  { name: { common: "Canada", official: "Canada" }, cca2: "CA", cca3: "CAN", capital: ["Ottawa"], region: "Americas", subregion: "Northern America", population: 38_005_238, area: 9984670, flags: { png: "https://flagcdn.com/w320/ca.png" }, latlng: [60, -95] },
  { name: { common: "Australia", official: "Commonwealth of Australia" }, cca2: "AU", cca3: "AUS", capital: ["Canberra"], region: "Oceania", subregion: "Australia and New Zealand", population: 25_499_884, area: 7692024, flags: { png: "https://flagcdn.com/w320/au.png" }, latlng: [-27, 133] },
  { name: { common: "Italy", official: "Italian Republic" }, cca2: "IT", cca3: "ITA", capital: ["Rome"], region: "Europe", subregion: "Southern Europe", population: 59_554_023, area: 301336, flags: { png: "https://flagcdn.com/w320/it.png" }, latlng: [42.83, 12.83] },
  { name: { common: "Spain", official: "Kingdom of Spain" }, cca2: "ES", cca3: "ESP", capital: ["Madrid"], region: "Europe", subregion: "Southern Europe", population: 47_351_567, area: 505990, flags: { png: "https://flagcdn.com/w320/es.png" }, latlng: [40, -4] },
  { name: { common: "Poland", official: "Republic of Poland" }, cca2: "PL", cca3: "POL", capital: ["Warsaw"], region: "Europe", subregion: "Eastern Europe", population: 37_950_802, area: 312679, flags: { png: "https://flagcdn.com/w320/pl.png" }, latlng: [52, 20] },
  { name: { common: "Netherlands", official: "Kingdom of the Netherlands" }, cca2: "NL", cca3: "NLD", capital: ["Amsterdam"], region: "Europe", subregion: "Western Europe", population: 17_407_585, area: 41543, flags: { png: "https://flagcdn.com/w320/nl.png" }, latlng: [52.5, 5.75] },
  { name: { common: "Belgium", official: "Kingdom of Belgium" }, cca2: "BE", cca3: "BEL", capital: ["Brussels"], region: "Europe", subregion: "Western Europe", population: 11_555_997, area: 30528, flags: { png: "https://flagcdn.com/w320/be.png" }, latlng: [50.83, 4] },
  { name: { common: "Sweden", official: "Kingdom of Sweden" }, cca2: "SE", cca3: "SWE", capital: ["Stockholm"], region: "Europe", subregion: "Northern Europe", population: 10_353_442, area: 450295, flags: { png: "https://flagcdn.com/w320/se.png" }, latlng: [62, 15] },
  { name: { common: "Norway", official: "Kingdom of Norway" }, cca2: "NO", cca3: "NOR", capital: ["Oslo"], region: "Europe", subregion: "Northern Europe", population: 5_379_475, area: 323802, flags: { png: "https://flagcdn.com/w320/no.png" }, latlng: [62, 10] },
  { name: { common: "Finland", official: "Republic of Finland" }, cca2: "FI", cca3: "FIN", capital: ["Helsinki"], region: "Europe", subregion: "Northern Europe", population: 5_530_719, area: 338424, flags: { png: "https://flagcdn.com/w320/fi.png" }, latlng: [64, 26] },
  { name: { common: "Greece", official: "Hellenic Republic" }, cca2: "GR", cca3: "GRC", capital: ["Athens"], region: "Europe", subregion: "Southern Europe", population: 10_718_565, area: 131990, flags: { png: "https://flagcdn.com/w320/gr.png" }, latlng: [39, 22] },
  { name: { common: "Hungary", official: "Hungary" }, cca2: "HU", cca3: "HUN", capital: ["Budapest"], region: "Europe", subregion: "Eastern Europe", population: 9_749_763, area: 93028, flags: { png: "https://flagcdn.com/w320/hu.png" }, latlng: [47, 20] },
  { name: { common: "Egypt", official: "Arab Republic of Egypt" }, cca2: "EG", cca3: "EGY", capital: ["Cairo"], region: "Africa", subregion: "Northern Africa", population: 102_334_403, area: 1002450, flags: { png: "https://flagcdn.com/w320/eg.png" }, latlng: [27, 30] },
  { name: { common: "South Africa", official: "Republic of South Africa" }, cca2: "ZA", cca3: "ZAF", capital: ["Pretoria"], region: "Africa", subregion: "Southern Africa", population: 59_308_690, area: 1219090, flags: { png: "https://flagcdn.com/w320/za.png" }, latlng: [-29, 25] },
  { name: { common: "Nigeria", official: "Federal Republic of Nigeria" }, cca2: "NG", cca3: "NGA", capital: ["Abuja"], region: "Africa", subregion: "Western Africa", population: 206_139_589, area: 923768, flags: { png: "https://flagcdn.com/w320/ng.png" }, latlng: [10, 8] },
  { name: { common: "Ethiopia", official: "Federal Democratic Republic of Ethiopia" }, cca2: "ET", cca3: "ETH", capital: ["Addis Ababa"], region: "Africa", subregion: "Eastern Africa", population: 114_963_583, area: 1104300, flags: { png: "https://flagcdn.com/w320/et.png" }, latlng: [8, 38] },
  { name: { common: "Kenya", official: "Republic of Kenya" }, cca2: "KE", cca3: "KEN", capital: ["Nairobi"], region: "Africa", subregion: "Eastern Africa", population: 53_771_296, area: 580367, flags: { png: "https://flagcdn.com/w320/ke.png" }, latlng: [1, 38] },
  { name: { common: "Indonesia", official: "Republic of Indonesia" }, cca2: "ID", cca3: "IDN", capital: ["Jakarta"], region: "Asia", subregion: "South-Eastern Asia", population: 273_523_615, area: 1904569, flags: { png: "https://flagcdn.com/w320/id.png" }, latlng: [-5, 120] },
  { name: { common: "Philippines", official: "Republic of the Philippines" }, cca2: "PH", cca3: "PHL", capital: ["Manila"], region: "Asia", subregion: "South-Eastern Asia", population: 109_581_085, area: 342353, flags: { png: "https://flagcdn.com/w320/ph.png" }, latlng: [13, 122] },
  { name: { common: "Vietnam", official: "Socialist Republic of Vietnam" }, cca2: "VN", cca3: "VNM", capital: ["Hanoi"], region: "Asia", subregion: "South-Eastern Asia", population: 97_338_579, area: 331212, flags: { png: "https://flagcdn.com/w320/vn.png" }, latlng: [16.17, 107.83] },
  { name: { common: "Thailand", official: "Kingdom of Thailand" }, cca2: "TH", cca3: "THA", capital: ["Bangkok"], region: "Asia", subregion: "South-Eastern Asia", population: 69_799_978, area: 513120, flags: { png: "https://flagcdn.com/w320/th.png" }, latlng: [15, 100] },
  { name: { common: "Singapore", official: "Republic of Singapore" }, cca2: "SG", cca3: "SGP", capital: ["Singapore"], region: "Asia", subregion: "South-Eastern Asia", population: 5_850_342, area: 710, flags: { png: "https://flagcdn.com/w320/sg.png" }, latlng: [1.37, 103.8] },
  { name: { common: "Argentina", official: "Argentine Republic" }, cca2: "AR", cca3: "ARG", capital: ["Buenos Aires"], region: "Americas", subregion: "South America", population: 45_376_763, area: 2780400, flags: { png: "https://flagcdn.com/w320/ar.png" }, latlng: [-34, -64] },
  { name: { common: "Chile", official: "Republic of Chile" }, cca2: "CL", cca3: "CHL", capital: ["Santiago"], region: "Americas", subregion: "South America", population: 19_116_201, area: 756102, flags: { png: "https://flagcdn.com/w320/cl.png" }, latlng: [-30, -71] },
  { name: { common: "Switzerland", official: "Swiss Confederation" }, cca2: "CH", cca3: "CHE", capital: ["Bern"], region: "Europe", subregion: "Western Europe", population: 8_654_622, area: 41285, flags: { png: "https://flagcdn.com/w320/ch.png" }, latlng: [47, 8] },
  { name: { common: "Austria", official: "Republic of Austria" }, cca2: "AT", cca3: "AUT", capital: ["Vienna"], region: "Europe", subregion: "Western Europe", population: 9_006_398, area: 83871, flags: { png: "https://flagcdn.com/w320/at.png" }, latlng: [47.33, 13.33] },
  { name: { common: "Portugal", official: "Portuguese Republic" }, cca2: "PT", cca3: "PRT", capital: ["Lisbon"], region: "Europe", subregion: "Southern Europe", population: 10_305_564, area: 92212, flags: { png: "https://flagcdn.com/w320/pt.png" }, latlng: [39.5, -8] },
  { name: { common: "Denmark", official: "Kingdom of Denmark" }, cca2: "DK", cca3: "DNK", capital: ["Copenhagen"], region: "Europe", subregion: "Northern Europe", population: 5_792_202, area: 43094, flags: { png: "https://flagcdn.com/w320/dk.png" }, latlng: [56, 10] },
  { name: { common: "Ireland", official: "Republic of Ireland" }, cca2: "IE", cca3: "IRL", capital: ["Dublin"], region: "Europe", subregion: "Northern Europe", population: 4_994_724, area: 70273, flags: { png: "https://flagcdn.com/w320/ie.png" }, latlng: [53, -8] },
  { name: { common: "New Zealand", official: "New Zealand" }, cca2: "NZ", cca3: "NZL", capital: ["Wellington"], region: "Oceania", subregion: "Australia and New Zealand", population: 5_084_300, area: 270467, flags: { png: "https://flagcdn.com/w320/nz.png" }, latlng: [-41, 174] },
];

/** Caută în setul de rezervă după nume (potrivire parțială, case-insensitive). */
export function searchFallbackCountries(name: string): Country[] {
  const q = name.toLowerCase();
  return FALLBACK_COUNTRIES.filter(
    (c) =>
      c.name.common.toLowerCase().includes(q) ||
      c.name.official.toLowerCase().includes(q) ||
      c.cca2?.toLowerCase() === q ||
      c.cca3?.toLowerCase() === q,
  );
}
