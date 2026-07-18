/**
 * Notification Center
 *
 * Generates and stores in-app notifications derived from alert diffs,
 * watchlist matches, and system events. Supports acknowledgment and
 * dismissal, matching the professional notification patterns requested.
 */
import type { AppNotification, NotificationType, GlobalAlert, WatchlistMatch, AlertLevel } from "../types";
import type { AlertDiff } from "../history/alertHistory";

let notificationCounter = 0;
function nextId(): string {
  return `notif-${Date.now()}-${notificationCounter++}`;
}

function buildNotification(
  type: NotificationType,
  title: string,
  body: string,
  level: AlertLevel,
  relatedAlertId?: string,
  relatedEventIds?: string[],
): AppNotification {
  return {
    id: nextId(),
    type,
    title,
    body,
    level,
    relatedAlertId,
    relatedEventIds,
    createdAt: new Date().toISOString(),
    acknowledged: false,
    dismissed: false,
  };
}

// ─── Generators ───────────────────────────────────────────────────────────────

export function notificationsFromAlertDiff(diff: AlertDiff): AppNotification[] {
  const notifications: AppNotification[] = [];

  for (const alert of diff.newAlerts) {
    if (alert.level === "information" || alert.level === "low") continue; // avoid noise
    notifications.push(buildNotification(
      alert.severity === "critical" ? "new_critical_event" : "new_alert",
      alert.title,
      `New ${alert.level} alert: ${alert.summary}`,
      alert.level,
      alert.id,
      alert.supportingEventIds,
    ));
  }

  for (const { alert, previousLevel } of diff.escalatedAlerts) {
    notifications.push(buildNotification(
      "alert_escalation",
      `Escalated: ${alert.title}`,
      `Alert escalated from "${previousLevel}" to "${alert.level}". ${alert.explanation}`,
      alert.level,
      alert.id,
      alert.supportingEventIds,
    ));
  }

  for (const alert of diff.resolvedAlerts) {
    notifications.push(buildNotification(
      "alert_resolved",
      `Resolved: ${alert.title}`,
      `No new supporting evidence in the last 3 days. Situation appears resolved or stale.`,
      "information",
      alert.id,
      alert.supportingEventIds,
    ));
  }

  return notifications;
}

export function notificationsFromWatchlistMatches(matches: WatchlistMatch[]): AppNotification[] {
  return matches.map((m) =>
    buildNotification(
      "watchlist_match",
      `Watchlist: ${m.entry.label}`,
      `${m.matchReason} — "${m.event.title}"`,
      m.event.severity === "critical" ? "critical" : m.event.severity === "high" ? "high" : "moderate",
      undefined,
      [m.event.id],
    ),
  );
}

export function systemStatusNotification(body: string): AppNotification {
  return buildNotification("system_status", "System Status", body, "information");
}

export function aiReportReadyNotification(reportTitle: string, alertId?: string): AppNotification {
  return buildNotification(
    "ai_report_ready",
    "AI Report Ready",
    `"${reportTitle}" has finished generating and is ready to view.`,
    "information",
    alertId,
  );
}

// ─── Notification Store ──────────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 200;

class NotificationStore {
  private items: AppNotification[] = [];
  private listeners: Set<() => void> = new Set();

  push(notifications: AppNotification[]): void {
    if (notifications.length === 0) return;
    this.items = [...notifications, ...this.items].slice(0, MAX_NOTIFICATIONS);
    this.emit();
  }

  getAll(): AppNotification[] {
    return this.items;
  }

  getActive(): AppNotification[] {
    return this.items.filter((n) => !n.dismissed);
  }

  getUnacknowledgedCount(): number {
    return this.items.filter((n) => !n.acknowledged && !n.dismissed).length;
  }

  acknowledge(id: string): void {
    this.items = this.items.map((n) => (n.id === id ? { ...n, acknowledged: true } : n));
    this.emit();
  }

  acknowledgeAll(): void {
    this.items = this.items.map((n) => ({ ...n, acknowledged: true }));
    this.emit();
  }

  dismiss(id: string): void {
    this.items = this.items.map((n) => (n.id === id ? { ...n, dismissed: true } : n));
    this.emit();
  }

  filterByType(type: NotificationType): AppNotification[] {
    return this.items.filter((n) => n.type === type);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.items = [];
    this.emit();
  }
}

export const notificationStore = new NotificationStore();
