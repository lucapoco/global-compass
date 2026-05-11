import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Radio } from "lucide-react";
import { useState } from "react";

const items = [
  { to: "/", label: "Dashboard" },
  { to: "/intelligence", label: "Intel" },
  { to: "/map", label: "Map" },
  { to: "/countries", label: "Countries" },
  { to: "/earthquakes", label: "Earthquakes" },
  { to: "/weather", label: "Weather" },
  { to: "/alerts", label: "Alerts" },
  { to: "/compare", label: "Compare" },
  { to: "/saved", label: "Saved" },
  { to: "/about", label: "About" },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="lg:hidden sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <span className="font-semibold tracking-tight">Global Pulse</span>
        </div>
        <button
          className="rounded-md border border-border/60 p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <nav className="flex flex-wrap gap-1 px-3 pb-3">
          {items.map((i) => (
            <Link
              key={i.to}
              to={i.to}
              onClick={() => setOpen(false)}
              className={`rounded-md px-3 py-1.5 text-xs ${
                path === i.to
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "border border-border/60 text-muted-foreground"
              }`}
            >
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
