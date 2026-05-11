import { Search } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, onSubmit, placeholder }: Props) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}
      className="flex items-center gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2 focus-within:border-primary/60"
    >
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
      />
    </form>
  );
}
