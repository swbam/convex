import * as React from "react";
import { FixedSizeList as List } from "react-window";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

type Item = {
  id: string;
  title: string;
  album?: string | null;
  disabled?: boolean;
};

export function SongCombobox({
  items,
  placeholder = "Add a song...",
  onSelect,
  disabled,
}: {
  items: Item[];
  placeholder?: string;
  onSelect: (title: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.title} - ${it.album || "Single"}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (!containerRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3.5 bg-secondary border border-border rounded-xl text-left text-sm text-foreground backdrop-blur-sm transition-all duration-300 flex items-center justify-between"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-sm opacity-80">{placeholder}</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-border bg-background shadow-xl">
          <div className="p-2 border-b border-border sticky top-0 bg-background/80 backdrop-blur">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search songs…"
                className="pl-8 h-9"
              />
            </div>
          </div>

          <div className="max-h-72">
            {filtered.length <= 200 ? (
              <ScrollArea className="h-72">
                <ul role="listbox" className="p-1">
                  {filtered.map((it) => {
                    const label = `${it.title} - ${it.album || "Single"}`;
                    return (
                      <li key={it.id}>
                        <button
                          disabled={it.disabled}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent/50 disabled:opacity-50"
                          onClick={() => {
                            onSelect(it.title);
                            setOpen(false);
                            setQuery("");
                          }}
                        >
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            ) : (
              <List
                height={288}
                width={"100%"}
                itemCount={filtered.length}
                itemSize={40}
              >
                {({ index, style }) => {
                  const it = filtered[index];
                  const label = `${it.title} - ${it.album || "Single"}`;
                  return (
                    <div style={style} key={it.id} className="px-1">
                      <button
                        disabled={it.disabled}
                        className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent/50 disabled:opacity-50"
                        onClick={() => {
                          onSelect(it.title);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        {label}
                      </button>
                    </div>
                  );
                }}
              </List>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


