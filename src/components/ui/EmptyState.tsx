import type { ReactNode } from "react";
export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="glass-card flex flex-col items-center justify-center gap-2 p-8 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
