import { Search } from "lucide-react";

interface Props { value: string; onChange: (v: string) => void; }

export function MapSearchBox({ value, onChange }: Props) {
  return (
    <div className="glass-card flex items-center gap-2 px-3 py-1.5">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search country, city, event or keyword…"
        className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button onClick={() => onChange("")} className="text-[10px] text-muted-foreground hover:text-foreground">clear</button>
      )}
    </div>
  );
}
