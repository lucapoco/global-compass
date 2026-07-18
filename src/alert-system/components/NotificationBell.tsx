/**
 * NotificationBell — Global floating notification center trigger.
 */
import { useState, useRef, useEffect } from "react";
import { Bell, X, Check, CheckCheck, AlertTriangle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useT } from "@/i18n";
import { useNotifications } from "../hooks/useNotifications";
import { ALERT_LEVEL_COLORS, NOTIFICATION_TYPE_LABELS } from "../types";
import type { AppNotification } from "../types";

function ageLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function NotificationRow({
  notification, onAcknowledge, onDismiss,
}: { notification: AppNotification; onAcknowledge: () => void; onDismiss: () => void }) {
  const t = useT();
  const color = ALERT_LEVEL_COLORS[notification.level];

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 border-b border-border transition-colors ${
        notification.acknowledged ? "opacity-50" : "hover:bg-muted/60"
      }`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
        style={{ background: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {NOTIFICATION_TYPE_LABELS[notification.type]}
          </span>
          <span className="text-[9px] text-border">·</span>
          <span className="text-[9px] text-muted-foreground" suppressHydrationWarning>{ageLabel(notification.createdAt)}</span>
        </div>
        <div className="text-xs font-medium text-foreground truncate mt-0.5">{notification.title}</div>
        <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{notification.body}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!notification.acknowledged && (
          <button
            onClick={onAcknowledge}
            className="p-1 rounded text-muted-foreground hover:text-emerald-600 hover:bg-muted transition-colors"
            aria-label={t("app.shell.notifications.acknowledge")}
            title={t("app.shell.notifications.acknowledge")}
          >
            <Check className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={onDismiss}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
          aria-label={t("app.shell.notifications.dismiss")}
          title={t("app.shell.notifications.dismiss")}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const t = useT();
  const { notifications, unacknowledgedCount, acknowledge, acknowledgeAll, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const hasCritical = notifications.some((n) => (n.level === "critical" || n.level === "extreme") && !n.acknowledged);

  return (
    <div ref={panelRef} className="fixed top-[4.25rem] right-4 z-40 lg:top-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full border bg-card shadow-sm transition-all ${
          hasCritical
            ? "border-destructive/40 hover:border-destructive/60"
            : "border-border hover:border-primary/30 hover:shadow-md"
        }`}
        aria-label={t("app.shell.notifications.unreadAria", { count: unacknowledgedCount })}
      >
        <Bell className={`w-4 h-4 ${hasCritical ? "text-destructive" : "text-muted-foreground"}`} />
        {unacknowledgedCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${
              hasCritical ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            {unacknowledgedCount > 99 ? "99+" : unacknowledgedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-h-[70vh] rounded-xl border border-border bg-card shadow-lg overflow-hidden flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">{t("app.shell.notifications.title")}</span>
              {unacknowledgedCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-primary">
                  {t("app.shell.notifications.newCount", { count: unacknowledgedCount })}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={acknowledgeAll}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                {t("app.shell.notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <Bell className="w-6 h-6" />
                <span className="text-xs">{t("app.shell.notifications.empty")}</span>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onAcknowledge={() => acknowledge(n.id)}
                  onDismiss={() => dismiss(n.id)}
                />
              ))
            )}
          </div>

          <button
            onClick={() => { setOpen(false); void navigate({ to: "/alert-center" }); }}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 border-t border-border text-[11px] text-primary hover:bg-muted transition-colors"
          >
            <AlertTriangle className="w-3 h-3" />
            {t("app.shell.notifications.openAlertCenter")}
          </button>
        </div>
      )}
    </div>
  );
}
