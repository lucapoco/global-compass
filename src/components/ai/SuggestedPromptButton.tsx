interface Props {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function SuggestedPromptButton({ label, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-full border border-border/60 bg-secondary/30 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary disabled:opacity-50"
    >
      {label}
    </button>
  );
}
