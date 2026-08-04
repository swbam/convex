import * as React from "react";
import { createPortal } from "react-dom";
import { FixedSizeList as List } from "react-window";
import { ChevronDown, Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type Item = {
  id: string;
  title: string;
  album?: string | null;
  disabled?: boolean;
};

// Tailwind `sm` breakpoint — below this the open state renders as a bottom sheet.
const MOBILE_QUERY = "(max-width: 639px)";

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
  const shouldReduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  );

  React.useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.title} - ${it.album || "Single"}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const handlePick = React.useCallback(
    (title: string) => {
      onSelect(title);
      close();
    },
    [onSelect, close]
  );

  // Close when clicking outside. The mobile sheet is portaled to <body>,
  // so it needs its own ref guard (its backdrop handles dismissal).
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (sheetRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  // Close on Escape.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Lock body scroll behind the mobile sheet.
  React.useEffect(() => {
    if (!(open && isMobile)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, isMobile]);

  const renderRow = (it: Item, mobile: boolean) => (
    <button
      type="button"
      disabled={it.disabled}
      className={`w-full flex items-center gap-2 text-left rounded-md px-3 py-1.5 hover:bg-accent/50 active:bg-accent/60 disabled:opacity-40 ${
        mobile ? "min-h-[44px]" : ""
      }`}
      onClick={() => handlePick(it.title)}
    >
      <span className="flex-1 min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">
          {it.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {it.album || "Single"}
        </span>
      </span>
      {it.disabled && (
        <span className="flex-shrink-0 text-xs text-muted-foreground">
          Added
        </span>
      )}
    </button>
  );

  const emptyState = (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      No songs match &ldquo;{query}&rdquo;
    </div>
  );

  const searchBox = (
    <div className="relative flex-1">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs…"
        autoFocus
        className="h-10 pl-8 sm:h-9"
      />
    </div>
  );

  // Virtualized list height for the mobile sheet (~70vh minus handle + search).
  const sheetListHeight =
    typeof window !== "undefined"
      ? Math.max(
          200,
          Math.min(
            Math.round(window.innerHeight * 0.7) - 132,
            filtered.length * 48
          )
        )
      : 320;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] px-4 py-3.5 bg-secondary border border-border rounded-xl text-left text-sm text-foreground backdrop-blur-sm transition-all duration-300 flex items-center justify-between disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-sm opacity-80">{placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 opacity-70 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Desktop: overlay dropdown (never pushes page content) */}
      <AnimatePresence initial={false}>
        {open && !isMobile && (
          <motion.div
            className="absolute z-50 mt-2 w-full origin-top overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
            initial={{
              opacity: shouldReduceMotion ? 1 : 0,
              y: shouldReduceMotion ? 0 : -4,
              scale: shouldReduceMotion ? 1 : 0.995,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: shouldReduceMotion ? 1 : 0,
              y: shouldReduceMotion ? 0 : -3,
              scale: shouldReduceMotion ? 1 : 0.995,
            }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.16 }}
          >
            <div className="border-b border-border p-2">{searchBox}</div>

            {filtered.length === 0 ? (
              emptyState
            ) : filtered.length <= 200 ? (
              <ScrollArea className="h-72">
                <ul role="listbox" className="p-1.5">
                  {filtered.map((it) => (
                    <li key={it.id}>{renderRow(it, false)}</li>
                  ))}
                </ul>
              </ScrollArea>
            ) : (
              <List
                height={288}
                width={"100%"}
                itemCount={filtered.length}
                itemSize={48}
              >
                {({ index, style }) => {
                  const it = filtered[index];
                  return (
                    <div style={style} key={it.id} className="px-1.5">
                      {renderRow(it, false)}
                    </div>
                  );
                }}
              </List>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile: bottom sheet portaled to <body> so it can't be clipped or push the setlist */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence initial={false}>
            {open && isMobile && (
              <div className="fixed inset-0 z-50">
                <motion.div
                  className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
                  initial={{ opacity: shouldReduceMotion ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: shouldReduceMotion ? 1 : 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
                  onClick={close}
                  aria-hidden="true"
                />
                <motion.div
                  ref={sheetRef}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Add a song"
                  className="absolute inset-x-0 bottom-0 flex max-h-[72vh] flex-col rounded-t-2xl border-t border-border bg-popover shadow-2xl"
                  initial={{ y: shouldReduceMotion ? 0 : "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: shouldReduceMotion ? 0 : "100%" }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.24,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
              <div className="flex justify-center pb-1 pt-2.5">
                <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
              </div>
              <div className="flex items-center gap-2 border-b border-border px-3 pb-3 pt-1">
                {searchBox}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close song search"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {filtered.length === 0 ? (
                <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {emptyState}
                </div>
              ) : filtered.length <= 200 ? (
                <div className="flex-1 overflow-y-auto overscroll-contain">
                  <ul
                    role="listbox"
                    className="p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                  >
                    {filtered.map((it) => (
                      <li key={it.id}>{renderRow(it, true)}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                  <List
                    height={sheetListHeight}
                    width={"100%"}
                    itemCount={filtered.length}
                    itemSize={48}
                  >
                    {({ index, style }) => {
                      const it = filtered[index];
                      return (
                        <div style={style} key={it.id} className="px-2">
                          {renderRow(it, true)}
                        </div>
                      );
                    }}
                  </List>
                </div>
              )}
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
