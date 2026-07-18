/**
 * Intelligence Export Utilities — GP-014.
 *
 * Supported formats: JSON, CSV, PDF (browser print).
 *
 * Architecture decision:
 *  All exports are client-side — no server round-trip required.
 *  - JSON: serialize to formatted string + download blob
 *  - CSV: build RFC 4180-compliant string + download blob
 *  - PDF: open print-optimised HTML in new tab → user saves as PDF
 *
 *  All functions are pure and synchronous (except PDF which opens a window).
 *  No external libraries required — works in all modern browsers.
 */

import type { IntelligenceItem, Earthquake, CountryRisk } from "@/types";

// ─── Internal helpers ─────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function dateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── JSON export ──────────────────────────────────────────────────────────────

export interface IntelligenceExportPayload {
  exportedAt: string;
  exportedBy: "Global Pulse Intelligence Platform";
  version: "1.0";
  events?: IntelligenceItem[];
  earthquakes?: Earthquake[];
  countryRisks?: CountryRisk[];
  report?: { title: string; type: string; content: string };
}

export function exportToJSON(payload: IntelligenceExportPayload, filename?: string): void {
  const json = JSON.stringify(
    { ...payload, exportedAt: new Date().toISOString() },
    null,
    2,
  );
  downloadBlob(json, filename ?? `global-pulse-${dateSlug()}.json`, "application/json");
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const INTEL_CSV_HEADERS = [
  "id", "title", "description", "category", "severity", "country",
  "source", "publishedAt", "url",
];

export function exportEventsToCSV(events: IntelligenceItem[], filename?: string): void {
  const rows = events.map((e) => {
    const rec = e as unknown as Record<string, unknown>;
    return INTEL_CSV_HEADERS.map((h) => csvEscape(rec[h])).join(",");
  });
  const csv = [INTEL_CSV_HEADERS.join(","), ...rows].join("\n");
  downloadBlob(csv, filename ?? `intel-events-${dateSlug()}.csv`, "text/csv;charset=utf-8");
}

const QUAKE_CSV_HEADERS = [
  "id", "place", "magnitude", "depth", "time", "latitude", "longitude", "url",
];

export function exportEarthquakesToCSV(quakes: Earthquake[], filename?: string): void {
  const rows = quakes.map((q) => {
    const rec = q as unknown as Record<string, unknown>;
    return QUAKE_CSV_HEADERS.map((h) => csvEscape(rec[h])).join(",");
  });
  const csv = [QUAKE_CSV_HEADERS.join(","), ...rows].join("\n");
  downloadBlob(csv, filename ?? `earthquakes-${dateSlug()}.csv`, "text/csv;charset=utf-8");
}

export function exportRisksToCSV(risks: CountryRisk[], filename?: string): void {
  const headers = ["country", "score", "label", "factors"];
  const rows = risks.map((r) =>
    [csvEscape(r.country), r.score, r.label, csvEscape(r.factors.join("; "))].join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename ?? `country-risk-${dateSlug()}.csv`, "text/csv;charset=utf-8");
}

// ─── PDF / Print export ───────────────────────────────────────────────────────

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #1a1a1a;
    line-height: 1.5;
    background: #fff;
    max-width: 750px;
    margin: 0 auto;
    padding: 40px 32px;
  }
  .report-header {
    border-bottom: 3px solid #1a1a1a;
    padding-bottom: 12px;
    margin-bottom: 24px;
  }
  .report-brand {
    font-size: 8pt;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #555;
    margin-bottom: 4px;
  }
  h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4px; }
  .report-meta { font-size: 9pt; color: #555; }
  h2 {
    font-size: 12pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
    margin: 24px 0 12px;
  }
  p { margin-bottom: 8px; }
  ul { margin: 0 0 12px 20px; }
  li { margin-bottom: 4px; }
  .event-item {
    border-left: 3px solid #555;
    padding: 6px 10px;
    margin-bottom: 8px;
    background: #f8f8f8;
  }
  .event-title { font-weight: bold; font-size: 10pt; }
  .event-meta { font-size: 8.5pt; color: #666; margin-top: 2px; }
  .severity-critical { border-color: #dc2626; }
  .severity-high { border-color: #d97706; }
  .severity-medium { border-color: #2563eb; }
  .severity-low { border-color: #16a34a; }
  .report-footer {
    margin-top: 48px;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    font-size: 8pt;
    color: #777;
  }
  .classification {
    text-align: center;
    font-size: 7pt;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #999;
    margin-top: 8px;
  }
  @media print {
    body { padding: 0; }
    @page { margin: 2cm; }
  }
`;

export interface PrintReportOptions {
  title: string;
  type: string;
  content: string;          // main body HTML or text
  events?: IntelligenceItem[];
  risks?: CountryRisk[];
  quakes?: Earthquake[];
  autoprint?: boolean;
}

export function exportToPDF(opts: PrintReportOptions): void {
  const now = new Date();
  const dateLine = now.toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const timeLine = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // Top events HTML
  const eventsHtml = opts.events?.slice(0, 15).map((e) => `
    <div class="event-item severity-${e.severity}">
      <div class="event-title">${escapeHtml(e.title)}</div>
      <div class="event-meta">${escapeHtml(e.source)} · ${escapeHtml(e.category)} · ${escapeHtml(e.country ?? "")} · ${escapeHtml(e.severity.toUpperCase())} · ${new Date(e.publishedAt).toLocaleTimeString()}</div>
    </div>
  `).join("") ?? "";

  // Risk table HTML
  const risksHtml = opts.risks?.slice(0, 10).map((r) => `
    <li><strong>${escapeHtml(r.country)}</strong> — Score ${r.score}/100 (${r.label}) · ${r.factors.slice(0, 2).join(", ")}</li>
  `).join("") ?? "";

  // Quakes
  const quakesHtml = opts.quakes?.filter((q) => q.magnitude >= 4.5).slice(0, 5).map((q) => `
    <li>M${q.magnitude.toFixed(1)} — ${escapeHtml(q.place)} (depth ${q.depth.toFixed(0)} km)</li>
  `).join("") ?? "";

  const contentHtml = opts.content
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("# ")) return `<h2>${escapeHtml(line.slice(2))}</h2>`;
      if (line.startsWith("- ") || line.startsWith("• ")) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (line.trim() === "") return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <div class="report-header">
    <div class="report-brand">Global Pulse · Intelligence Platform · Restricted</div>
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="report-meta">
      ${escapeHtml(opts.type)} · ${dateLine} · ${timeLine} UTC
    </div>
  </div>

  ${contentHtml}

  ${eventsHtml ? `<h2>Key Intelligence Events</h2>${eventsHtml}` : ""}
  ${risksHtml ? `<h2>Country Risk Index</h2><ul>${risksHtml}</ul>` : ""}
  ${quakesHtml ? `<h2>Significant Seismic Activity</h2><ul>${quakesHtml}</ul>` : ""}

  <div class="report-footer">
    Generated by Global Pulse Intelligence Platform · ${dateLine} · For educational purposes only
    <div class="classification">UNCLASSIFIED // FOR EDUCATIONAL USE ONLY</div>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!printWindow) {
    alert("Pop-up blocked. Please allow pop-ups to export PDF.");
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  if (opts.autoprint !== false) {
    setTimeout(() => printWindow.print(), 600);
  }
}

// ─── Report content export ────────────────────────────────────────────────────

export function exportReportToTXT(title: string, content: string): void {
  const header = [
    "=".repeat(60),
    `GLOBAL PULSE INTELLIGENCE PLATFORM`,
    title.toUpperCase(),
    `Generated: ${new Date().toISOString()}`,
    "=".repeat(60),
    "",
  ].join("\n");
  downloadBlob(header + content, `report-${dateSlug()}.txt`, "text/plain");
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
