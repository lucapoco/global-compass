export type VideoCategory = "news" | "space" | "weather" | "city" | "disaster" | "education";

export interface VideoSource {
  id: string;
  title: string;
  description: string;
  category: VideoCategory;
  region: string;
  provider: string;
  /** YouTube embed URL (no autoplay-with-sound) */
  embedUrl: string;
  /** Original page URL */
  sourceUrl: string;
  isLive: boolean;
}

/**
 * Curated public live streams. All are YouTube embeds — provider keeps
 * working URLs and we never scrape. Replace IDs in this file to swap sources.
 */
export const VIDEO_SOURCES: VideoSource[] = [
  {
    id: "iss-hd",
    title: "NASA · ISS Live HD Earth View",
    description: "Live high-definition view of Earth from the International Space Station.",
    category: "space",
    region: "Low Earth Orbit",
    provider: "NASA",
    embedUrl: "https://www.youtube.com/embed/H999s0P1Er0?autoplay=1&mute=1",
    sourceUrl: "https://www.youtube.com/@NASA",
    isLive: true,
  },
  {
    id: "skynews",
    title: "Sky News · Live World News",
    description: "Continuous breaking news coverage from Sky News.",
    category: "news",
    region: "United Kingdom",
    provider: "Sky News",
    embedUrl: "https://www.youtube.com/embed/YDvsBbKfLPA?autoplay=1&mute=1",
    sourceUrl: "https://www.youtube.com/@SkyNews",
    isLive: true,
  },
  {
    id: "dwnews",
    title: "DW News · Live",
    description: "Deutsche Welle English live international news.",
    category: "news",
    region: "Germany",
    provider: "DW News",
    embedUrl: "https://www.youtube.com/embed/pP6kJVZAA0o?autoplay=1&mute=1",
    sourceUrl: "https://www.youtube.com/@dwnews",
    isLive: true,
  },
  {
    id: "alj",
    title: "Al Jazeera English · Live",
    description: "Live international news from Al Jazeera English.",
    category: "news",
    region: "Qatar",
    provider: "Al Jazeera",
    embedUrl: "https://www.youtube.com/embed/gCNeDWCI0vo?autoplay=1&mute=1",
    sourceUrl: "https://www.youtube.com/@aljazeeraenglish",
    isLive: true,
  },
  {
    id: "noaa-goes",
    title: "NOAA · GOES-East Weather Loop",
    description: "Latest geostationary satellite imagery of the Western Hemisphere.",
    category: "weather",
    region: "Americas",
    provider: "NOAA",
    embedUrl: "https://www.youtube.com/embed/kGmd5pKE3kE?autoplay=1&mute=1",
    sourceUrl: "https://www.star.nesdis.noaa.gov/GOES/",
    isLive: false,
  },
  {
    id: "times-square",
    title: "EarthCam · Times Square",
    description: "24/7 city camera at the Crossroads of the World.",
    category: "city",
    region: "New York, USA",
    provider: "EarthCam",
    embedUrl: "https://www.youtube.com/embed/AdUw5RdyZxI?autoplay=1&mute=1",
    sourceUrl: "https://www.earthcam.com/usa/newyork/timessquare/",
    isLive: true,
  },
  {
    id: "shibuya",
    title: "Shibuya Crossing · Live",
    description: "Live view of Tokyo's famous Shibuya scramble crossing.",
    category: "city",
    region: "Tokyo, Japan",
    provider: "ANN News",
    embedUrl: "https://www.youtube.com/embed/3kPH7kTphnE?autoplay=1&mute=1",
    sourceUrl: "https://www.youtube.com/@ANNnewsCH",
    isLive: true,
  },
  {
    id: "volcano-iceland",
    title: "Iceland Volcano Watch",
    description: "Live monitoring feed of Reykjanes peninsula volcanic activity.",
    category: "disaster",
    region: "Iceland",
    provider: "RÚV",
    embedUrl: "https://www.youtube.com/embed/nVKjLZEYRrU?autoplay=1&mute=1",
    sourceUrl: "https://www.ruv.is/",
    isLive: true,
  },
];
