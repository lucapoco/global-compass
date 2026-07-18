/** Brand asset paths — Global Pulse */
export const BRAND_NAME = "Global Pulse";
export const BRAND_ALT = "Global Pulse logo";

export const BRAND_ASSETS = {
  icon: {
    webp: "/brand/icon-only.webp",
    png: "/brand/icon-only.png",
  },
  favicon: "/brand/favicon-32.png",
  appleTouchIcon: "/brand/apple-touch-icon.png",
} as const;

export type BrandLogoTheme = "light" | "dark" | "auto";

export function resolveBrandTheme(theme: BrandLogoTheme): "light" | "dark" {
  return theme === "auto" ? "light" : theme;
}
