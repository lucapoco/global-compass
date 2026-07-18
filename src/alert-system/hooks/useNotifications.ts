/**
 * useNotifications — React hook wrapping the NotificationStore singleton.
 * Used by the NotificationBell and the Alert Center's notification panel.
 */
import { useState, useEffect, useCallback } from "react";
import { notificationStore } from "../notifications/notificationCenter";
import type { AppNotification } from "../types";

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>(notificationStore.getAll());

  useEffect(() => {
    setItems(notificationStore.getAll());
    return notificationStore.subscribe(() => setItems(notificationStore.getAll()));
  }, []);

  const acknowledge = useCallback((id: string) => notificationStore.acknowledge(id), []);
  const acknowledgeAll = useCallback(() => notificationStore.acknowledgeAll(), []);
  const dismiss = useCallback((id: string) => notificationStore.dismiss(id), []);

  const active = items.filter((n) => !n.dismissed);
  const unacknowledgedCount = items.filter((n) => !n.acknowledged && !n.dismissed).length;

  return { notifications: active, all: items, unacknowledgedCount, acknowledge, acknowledgeAll, dismiss };
}
