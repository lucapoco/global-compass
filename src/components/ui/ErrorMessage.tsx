import { AlertCircle } from "lucide-react";
export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="glass-card flex items-start gap-2 border-rose-glow/30 p-3 text-sm text-rose-glow">
      <AlertCircle className="mt-0.5 h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}
