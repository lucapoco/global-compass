/**
 * Intelligence NLP Dictionaries
 *
 * All keyword lists used for category detection, entity extraction, and severity
 * scoring. Pure data — no logic here. Keeps the processing modules clean.
 */
import type { ExtendedCategory } from "../types";

// ─── Category keyword rules (ordered by specificity) ─────────────────────────
/** Each entry: [category, keywords[], weight]. Higher weight = stronger signal. */
export interface CategoryRule {
  category: ExtendedCategory;
  keywords: string[];
  weight: number;
}

export const CATEGORY_RULES: CategoryRule[] = [
  // High-specificity categories first
  {
    category: "cybersecurity",
    weight: 10,
    keywords: [
      "cyberattack", "cyber attack", "hacking", "hack", "malware", "ransomware",
      "data breach", "phishing", "exploit", "zero-day", "ddos", "botnet",
      "cybercrime", "cybersecurity", "information security", "espionage",
      "surveillance", "encryption", "firewall", "spyware", "keylogger",
    ],
  },
  {
    category: "earthquake",
    weight: 10,
    keywords: [
      "earthquake", "seismic", "magnitude", "richter", "aftershock",
      "tremor", "epicenter", "tectonic", "fault line", "usgs",
    ],
  },
  {
    category: "space",
    weight: 9,
    keywords: [
      "spacecraft", "rocket launch", "nasa", "spacex", "esa", "roscosmos",
      "iss", "orbit", "astronaut", "moon landing", "mars mission", "asteroid",
      "satellite launch", "spacewalk", "telescope", "exoplanet",
    ],
  },
  {
    category: "military",
    weight: 8,
    keywords: [
      "war", "missile", "airstrike", "invasion", "troops", "military", "defense",
      "army", "navy", "air force", "weapons", "artillery", "combat", "battle",
      "siege", "offensive", "ceasefire", "frontline", "soldier", "warplane",
      "munitions", "ballistic", "nuclear weapon", "warship", "drone strike",
      "pentagon", "ministry of defense", "armed forces", "regiment", "battalion",
      "military operation", "bombardment", "rocket attack", "ground offensive",
    ],
  },
  {
    category: "disaster",
    weight: 8,
    keywords: [
      "tsunami", "wildfire", "forest fire", "volcanic eruption", "volcano",
      "landslide", "avalanche", "mudslide", "dam collapse", "building collapse",
      "explosion", "catastrophe", "disaster", "emergency declaration",
      "mass casualty", "rescue operation",
    ],
  },
  {
    category: "weather",
    weight: 7,
    keywords: [
      "hurricane", "typhoon", "cyclone", "tropical storm", "tornado",
      "blizzard", "snowstorm", "flood", "rainfall", "monsoon",
      "temperature record", "wind speed", "storm surge", "weather warning",
      "lightning", "hail", "heat dome", "cold snap",
    ],
  },
  {
    category: "health",
    weight: 7,
    keywords: [
      "pandemic", "epidemic", "outbreak", "pathogen", "vaccine", "hospital",
      "disease", "infection", "mortality", "fatality", "public health",
      "who", "world health organization", "treatment", "quarantine", "lockdown",
      "virus", "bacteria", "variant", "mutation", "contagion", "mpox", "ebola",
    ],
  },
  {
    category: "finance",
    weight: 7,
    keywords: [
      "stock market", "wall street", "nasdaq", "dow jones", "s&p 500",
      "hedge fund", "ipo", "dividend", "equity", "venture capital",
      "cryptocurrency", "bitcoin", "ethereum", "blockchain",
      "bank collapse", "financial crisis", "bankruptcy", "bailout",
      "interest rate hike", "federal reserve", "central bank decision",
    ],
  },
  {
    category: "energy",
    weight: 7,
    keywords: [
      "oil price", "opec", "pipeline", "nuclear power", "solar panel",
      "wind farm", "renewable energy", "energy crisis", "fuel", "lng",
      "natural gas", "refinery", "power grid", "energy security",
      "oil spill", "gas leak", "coal", "power plant", "fracking",
    ],
  },
  {
    category: "geopolitics",
    weight: 6,
    keywords: [
      "election", "government", "president", "prime minister", "parliament",
      "congress", "senate", "border dispute", "diplomacy", "sanctions",
      "treaty", "summit", "foreign policy", "embassy", "ambassador",
      "sovereignty", "coup", "protest", "referendum", "political crisis",
      "opposition leader", "chancellor", "secretary of state", "regime change",
    ],
  },
  {
    category: "economy",
    weight: 6,
    keywords: [
      "recession", "inflation", "gdp", "unemployment", "trade war", "tariff",
      "import", "export", "market", "supply chain", "manufacturing",
      "consumer prices", "cost of living", "economic growth", "wage",
      "trade deficit", "currency devaluation", "debt crisis",
    ],
  },
  {
    category: "climate",
    weight: 6,
    keywords: [
      "climate change", "global warming", "carbon emission", "co2",
      "greenhouse gas", "paris agreement", "cop", "carbon tax",
      "deforestation", "arctic ice", "sea level rise", "drought",
      "net zero", "fossil fuel", "sustainability", "ipcc",
    ],
  },
  {
    category: "technology",
    weight: 5,
    keywords: [
      "artificial intelligence", " ai ", "machine learning", "silicon valley",
      "semiconductor", "chip shortage", "cloud computing", "data center",
      "quantum computing", "robot", "automation", "5g", "electric vehicle",
      "tech company", "software", "hardware", "startup", "big tech",
    ],
  },
  {
    category: "diplomacy",
    weight: 5,
    keywords: [
      "peace talks", "negotiations", "ceasefire agreement", "mediation",
      "un security council", "nato summit", "g7", "g20", "bilateral meeting",
      "memorandum", "delegation", "envoy", "diplomatic relations", "normalisation",
    ],
  },
  {
    category: "migration",
    weight: 5,
    keywords: [
      "refugee", "asylum seeker", "migration", "immigration", "border crossing",
      "deportation", "displacement", "humanitarian crisis", "camp",
      "human trafficking", "people smuggling",
    ],
  },
  {
    category: "crime",
    weight: 5,
    keywords: [
      "murder", "homicide", "terrorism", "terrorist attack", "arrest",
      "shooting", "robbery", "cartel", "mafia", "gang violence",
      "drug trafficking", "organized crime", "prosecution", "verdict",
    ],
  },
  {
    category: "transportation",
    weight: 4,
    keywords: [
      "aviation", "airline", "aircraft crash", "airport", "flight cancellation",
      "railway", "train derailment", "shipping", "cargo ship", "accident",
      "collision", "highway", "bridge", "tunnel collapse",
    ],
  },
  {
    category: "infrastructure",
    weight: 4,
    keywords: [
      "power outage", "blackout", "water supply", "sewage", "internet outage",
      "critical infrastructure", "bridge collapse", "dam failure", "telecom",
    ],
  },
  {
    category: "environment",
    weight: 4,
    keywords: [
      "pollution", "plastic", "ocean contamination", "coral reef", "endangered species",
      "extinction", "ecosystem", "habitat destruction", "chemical spill", "toxic waste",
      "air quality", "water quality",
    ],
  },
  {
    category: "science",
    weight: 3,
    keywords: [
      "discovery", "research breakthrough", "scientific study", "experiment",
      "laboratory", "nasa", "genome", "particle physics", "quantum",
      "publication", "journal nature", "nobel prize",
    ],
  },
  {
    category: "general",
    weight: 1,
    keywords: [],
  },
];

// ─── Severity keywords ────────────────────────────────────────────────────────
export const SEVERITY_CRITICAL: string[] = [
  "war declared", "nuclear", "invasion", "mass casualty", "killed", "dead",
  "massacre", "genocide", "fatal", "emergency declaration", "state of emergency",
  "magnitude 7", "magnitude 8", "magnitude 9", "tsunami warning",
  "pandemic declared", "catastrophic", "total collapse", "missile strike",
  "ballistic missile", "nuclear threat",
];

export const SEVERITY_HIGH: string[] = [
  "attack", "crisis", "conflict", "warning", "sanctions", "explosion",
  "flood", "evacuat", "airstrike", "cyberattack", "earthquake", "typhoon",
  "hurricane", "protest", "coup", "hostage", "terrorism", "bombing",
  "military operation", "financial crisis", "outbreak",
];

export const SEVERITY_MEDIUM: string[] = [
  "protest", "inflation", "election", "storm", "outage", "recall",
  "strike", "tension", "arrest", "investigation", "accident", "recall",
  "shortage", "disruption", "concern", "risk", "warning",
];

// ─── Entity dictionaries ──────────────────────────────────────────────────────
export const ENTITY_LEADERS: string[] = [
  "biden", "trump", "putin", "zelenskyy", "zelensky", "xi jinping", "modi",
  "macron", "scholz", "sunak", "meloni", "erdogan", "netanyahu", "khamenei",
  "kim jong", "bin salman", "lula", "milei", "johnson", "orban", "merkel",
  "draghi", "sanchez", "trudeau", "albanese", "abe", "kishida", "yoon",
  "sisi", "al-sisi", "mnangagwa", "kagame", "buhari", "tinubu", "ramaphosa",
];

export const ENTITY_ORGANIZATIONS: string[] = [
  "united nations", " un ", "nato", "european union", "world bank", "imf",
  "international monetary fund", "wto", "world trade organization",
  "who", "world health organization", "iaea", "interpol", "icj", "icc",
  "red cross", "amnesty international", "human rights watch",
  "opec", "g7", "g20", "brics", "asean", "african union", "arab league",
  "oecd", "un security council", "general assembly",
];

export const ENTITY_ALLIANCES: string[] = [
  "nato", "european union", "five eyes", "quad", "aukus",
  "shanghai cooperation", "collective security treaty",
  "arab league", "african union",
];

export const ENTITY_COMPANIES: string[] = [
  "apple", "google", "microsoft", "amazon", "meta", "tesla", "nvidia",
  "samsung", "huawei", "boeing", "lockheed", "raytheon", "shell",
  "exxon", "bp", "chevron", "jpmorgan", "goldman sachs", "blackrock",
  "visa", "mastercard", "alibaba", "tencent", "tiktok", "openai", "anthropic",
];

export const ENTITY_CONFLICTS: string[] = [
  "ukraine war", "russia-ukraine", "israel-gaza", "israel-hamas",
  "taiwan strait", "south china sea", "kashmir", "syrian civil war",
  "yemen war", "sahel", "sudan conflict", "nagorno-karabakh",
];

export const ENTITY_TECHNOLOGIES: string[] = [
  "chatgpt", "gpt-4", "gemini", "claude", "generative ai", "large language model",
  "nuclear reactor", "5g network", "hydrogen fuel", "quantum computer",
  "semiconductor chip", "cryptocurrency", "blockchain", "electric vehicle",
];

export const ENTITY_COMMODITIES: string[] = [
  "crude oil", "natural gas", "gold", "silver", "wheat", "corn",
  "soybeans", "copper", "lithium", "rare earth", "uranium", "coal",
  "iron ore", "steel", "aluminum",
];

export const ENTITY_INFRASTRUCTURE: string[] = [
  "nord stream", "power grid", "nuclear reactor", "oil pipeline", "gas pipeline",
  "dam", "power plant", "undersea cable", "satellite network",
];

// ─── Country data ─────────────────────────────────────────────────────────────
/** Country name → [lat, lng] for map integration. */
export const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [38, -97], "USA": [38, -97], "US": [38, -97],
  "Russia": [60, 100], "China": [35, 105], "Ukraine": [49, 32],
  "Germany": [51, 9], "France": [46, 2], "United Kingdom": [54, -2],
  "UK": [54, -2], "Israel": [31.5, 34.75], "Palestine": [31.9, 35.2],
  "Gaza": [31.5, 34.47], "Iran": [32, 53], "Iraq": [33, 44],
  "Syria": [35, 38], "Turkey": [39, 35], "Japan": [36, 138],
  "South Korea": [37, 127.5], "North Korea": [40, 127],
  "India": [20, 77], "Pakistan": [30, 70], "Saudi Arabia": [25, 45],
  "Brazil": [-10, -55], "Mexico": [23, -102], "Canada": [60, -95],
  "Australia": [-27, 133], "Egypt": [27, 30], "Nigeria": [10, 8],
  "Romania": [46, 25], "Poland": [52, 20], "Taiwan": [23.5, 121],
  "Venezuela": [8, -66], "Libya": [25, 17], "Sudan": [15, 30],
  "Ethiopia": [8, 38], "Afghanistan": [33, 65], "Somalia": [6, 46],
  "Yemen": [15, 48], "Lebanon": [33.83, 35.83], "Jordan": [31, 36],
  "Serbia": [44, 21], "Hungary": [47, 20], "Italy": [42.83, 12.83],
  "Spain": [40, -4], "Greece": [39, 22], "Indonesia": [-5, 120],
  "Philippines": [13, 122], "Vietnam": [16.17, 107.83],
  "Myanmar": [22, 98], "Cuba": [21.5, -80], "Argentina": [-34, -64],
  "Chile": [-30, -71], "Colombia": [4, -72], "South Africa": [-29, 25],
  "Sweden": [62, 15], "Norway": [62, 10], "Finland": [64, 26],
  "Netherlands": [52.5, 5.75], "Belgium": [50.83, 4], "Switzerland": [47, 8],
  "Austria": [47.33, 13.33], "Portugal": [39.5, -8], "Denmark": [56, 10],
  "Ireland": [53, -8], "Czech": [50, 15.5], "Bulgaria": [43, 25],
  "Kazakhstan": [48, 68], "Peru": [-10, -76],
};

/** Country → world region. */
export const COUNTRY_REGIONS: Record<string, string> = {
  "Russia": "Eastern Europe", "Ukraine": "Eastern Europe", "Poland": "Eastern Europe",
  "Romania": "Eastern Europe", "Hungary": "Eastern Europe", "Czech": "Eastern Europe",
  "Bulgaria": "Eastern Europe", "Serbia": "Eastern Europe",
  "Germany": "Western Europe", "France": "Western Europe", "Italy": "Western Europe",
  "Spain": "Western Europe", "United Kingdom": "Western Europe", "UK": "Western Europe",
  "Netherlands": "Western Europe", "Belgium": "Western Europe", "Switzerland": "Western Europe",
  "Austria": "Western Europe", "Portugal": "Western Europe",
  "Sweden": "Northern Europe", "Norway": "Northern Europe", "Finland": "Northern Europe",
  "Denmark": "Northern Europe", "Ireland": "Northern Europe",
  "United States": "North America", "USA": "North America", "Canada": "North America",
  "Mexico": "Latin America", "Brazil": "Latin America", "Argentina": "Latin America",
  "Chile": "Latin America", "Colombia": "Latin America", "Venezuela": "Latin America",
  "Peru": "Latin America", "Cuba": "Latin America",
  "China": "East Asia", "Japan": "East Asia", "South Korea": "East Asia",
  "North Korea": "East Asia", "Taiwan": "East Asia",
  "India": "South Asia", "Pakistan": "South Asia", "Afghanistan": "South Asia",
  "Israel": "Middle East", "Palestine": "Middle East", "Gaza": "Middle East",
  "Iran": "Middle East", "Iraq": "Middle East", "Syria": "Middle East",
  "Lebanon": "Middle East", "Jordan": "Middle East", "Saudi Arabia": "Middle East",
  "Turkey": "Middle East", "Yemen": "Middle East",
  "Egypt": "North Africa", "Libya": "North Africa",
  "Nigeria": "West Africa", "Ethiopia": "East Africa",
  "Sudan": "East Africa", "Somalia": "East Africa", "South Africa": "Southern Africa",
  "Kenya": "East Africa",
  "Indonesia": "Southeast Asia", "Philippines": "Southeast Asia",
  "Vietnam": "Southeast Asia", "Myanmar": "Southeast Asia", "Thailand": "Southeast Asia",
  "Australia": "Oceania", "New Zealand": "Oceania",
  "Kazakhstan": "Central Asia",
};

/** Country → geopolitical importance bonus (0–20). */
export const COUNTRY_IMPORTANCE: Record<string, number> = {
  "United States": 20, "USA": 20, "China": 18, "Russia": 18,
  "Germany": 12, "United Kingdom": 12, "UK": 12, "France": 12,
  "Israel": 15, "Ukraine": 16, "Iran": 13, "North Korea": 14,
  "India": 12, "Pakistan": 12, "Saudi Arabia": 10, "Turkey": 10,
  "Japan": 10, "Taiwan": 13, "NATO": 15, "Gaza": 14, "Palestine": 12,
};

/** Major world cities for geo-enrichment. */
export const MAJOR_CITIES: string[] = [
  "new york", "london", "beijing", "moscow", "paris", "berlin",
  "tokyo", "washington", "kyiv", "tel aviv", "jerusalem", "tehran",
  "baghdad", "damascus", "kabul", "islamabad", "new delhi", "mumbai",
  "riyadh", "cairo", "istanbul", "ankara", "seoul", "pyongyang",
  "beijing", "shanghai", "hong kong", "taipei", "singapore",
  "sydney", "bucharest", "warsaw", "brussels", "amsterdam",
  "rome", "madrid", "lisbon", "athens", "budapest", "sofia",
  "toronto", "ottawa", "mexico city", "brasilia", "buenos aires",
  "beijing", "nairobi", "addis ababa", "lagos", "johannesburg",
  "dubai", "abu dhabi", "doha", "kuwait city", "amman", "beirut",
  "kabul", "dhaka", "colombo", "kathmandu", "yangon", "bangkok",
  "jakarta", "manila", "hanoi", "ho chi minh city",
];
