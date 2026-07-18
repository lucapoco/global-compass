/**
 * BrandLogo — official Global Pulse logo component.
 */
import { cn } from "@/lib/utils";
import {
  BRAND_ALT,
  BRAND_ASSETS,
  BRAND_NAME,
  resolveBrandTheme,
  type BrandLogoTheme,
} from "./assets";

export type BrandLogoVariant = "icon" | "horizontal" | "navbar" | "footer";

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  theme?: BrandLogoTheme;
  /** Visual height in px (width follows aspect ratio). Default 44. */
  size?: number;
  className?: string;
  /** Premium hover: scale 1.03 + soft blue glow */
  interactive?: boolean;
  /** Always show icon + wordmark (sidebar, mission control). */
  wordmarkAlways?: boolean;
}

function BrandImage({
  alt,
  height,
  className,
  loading = "eager",
  decorative = false,
}: {
  alt: string;
  height: number;
  className?: string;
  loading?: "eager" | "lazy";
  decorative?: boolean;
}) {
  return (
    <picture>
      <source srcSet={BRAND_ASSETS.icon.webp} type="image/webp" />
      <img
        src={BRAND_ASSETS.icon.png}
        alt={decorative ? "" : alt}
        height={height}
        loading={loading}
        decoding="async"
        draggable={false}
        aria-hidden={decorative || undefined}
        className={cn("block h-auto w-auto max-w-none object-contain bg-transparent", className)}
        style={{ height, width: "auto", maxHeight: height }}
      />
    </picture>
  );
}

function Wordmark({ dark }: { dark: boolean }) {
  return (
    <span
      className={cn(
        "flex flex-col justify-center min-w-0 leading-tight",
        dark ? "text-white" : "text-foreground",
      )}
    >
      <span className="text-sm font-semibold tracking-tight leading-snug">{BRAND_NAME}</span>
    </span>
  );
}

function IconWordmarkRow({
  iconSize,
  dark,
  decorativeIcon = false,
  className,
  loading = "eager",
}: {
  iconSize: number;
  dark: boolean;
  decorativeIcon?: boolean;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const crisp = dark ? "brand-logo-dark-crisp" : undefined;
  return (
    <span className={cn("inline-flex items-center gap-2.5 min-w-0", className)}>
      <BrandImage
        alt={BRAND_ALT}
        height={iconSize}
        decorative={decorativeIcon}
        loading={loading}
        className={cn("shrink-0", crisp)}
      />
      <Wordmark dark={dark} />
    </span>
  );
}

export function BrandLogo({
  variant = "navbar",
  theme = "auto",
  size = 44,
  className = "",
  interactive = false,
  wordmarkAlways = false,
}: BrandLogoProps) {
  const isDark = resolveBrandTheme(theme) === "dark";
  const shell = cn(
    "inline-flex items-center min-w-0",
    interactive && "brand-logo-interactive",
    className,
  );
  const navbarIconSize = Math.min(Math.max(size, 40), 48);

  if (variant === "icon") {
    return (
      <span className={cn(shell, "shrink-0")}>
        <BrandImage
          alt={BRAND_ALT}
          height={size}
          className={isDark ? "brand-logo-dark-crisp" : undefined}
        />
      </span>
    );
  }

  if (variant === "footer") {
    const iconSize = Math.min(size, 44);
    return (
      <span className={cn(shell, "opacity-[0.85]")}>
        <IconWordmarkRow iconSize={iconSize} dark={isDark} loading="lazy" />
      </span>
    );
  }

  if (variant === "horizontal") {
    return (
      <span className={shell}>
        <IconWordmarkRow iconSize={Math.min(Math.max(size, 40), 48)} dark={isDark} />
      </span>
    );
  }

  /* navbar */
  if (wordmarkAlways) {
    return (
      <span className={shell}>
        <IconWordmarkRow iconSize={navbarIconSize} dark={isDark} />
      </span>
    );
  }

  return (
    <span className={shell}>
      <BrandImage
        alt={BRAND_ALT}
        height={navbarIconSize}
        className={cn("shrink-0 lg:hidden", isDark && "brand-logo-dark-crisp")}
      />
      <span className="hidden lg:inline-flex">
        <IconWordmarkRow iconSize={navbarIconSize} dark={isDark} decorativeIcon />
      </span>
    </span>
  );
}

/** @deprecated Use BrandLogo */
export const GlobalPulseLogo = BrandLogo;
export type LogoVariant = BrandLogoVariant;
export type LogoTheme = BrandLogoTheme;
