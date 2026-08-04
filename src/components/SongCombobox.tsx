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

// Tailwind `sm` breakpoint — below this the open state renders as a full-screen browser.
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
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false);
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

  const alphabeticalGroups = React.useMemo(() => {
    const collator = new Intl.Collator(undefined, {
      sensitivity: "base",
      numeric: true,
    });
    const sorted = [...filtered].sort((a, b) =>
      collator.compare(a.title, b.title)
    );
    const groups = new Map<string, Item[]>();

    for (const item of sorted) {
      const firstCharacter = item.title.trim().charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(firstCharacter) ? firstCharacter : "#";
      const group = groups.get(letter) ?? [];
      group.push(item);
      groups.set(letter, group);
    }

    return Array.from(groups.entries());
  }, [filtered]);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const groupRefs = React.useRef(new Map<string, HTMLElement>());

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setMobileSearchOpen(false);
  }, []);

  const openMobileSearch = React.useCallback(() => {
    setMobileSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const closeMobileSearch = React.useCallback(() => {
    searchInputRef.current?.blur();
    setQuery("");
    setMobileSearchOpen(false);
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
        ref={searchInputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search songs…"
        autoFocus={!isMobile}
        className="h-11 pl-8 text-base sm:h-9 sm:text-sm"
      />
    </div>
  );

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
        <span className="min-w-0">
          <span className="block truncate text-sm opacity-80 sm:hidden">
            Browse {items.length} songs
          </span>
          <span className="hidden truncate text-sm opacity-80 sm:block">
            {placeholder}
          </span>
        </span>
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

      {/* Mobile: full-screen alphabetical browser. Search is opt-in so opening the
          picker never summons the keyboard or obscures the catalog. */}
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
                  className="absolute inset-0 flex h-[100dvh] flex-col overflow-hidden bg-background shadow-2xl"
                  initial={{ y: shouldReduceMotion ? 0 : "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: shouldReduceMotion ? 0 : "100%" }}
                  transition={{
                    duration: shouldReduceMotion ? 0 : 0.24,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <header className="z-20 border-b border-border/70 bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
                    <AnimatePresence initial={false} mode="wait">
                      {mobileSearchOpen ? (
                        <motion.div
                          key="search"
                          className="flex items-center gap-2"
                          initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: shouldReduceMotion ? 0 : 8 }}
                          transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                        >
                          {searchBox}
                          <button
                            type="button"
                            onClick={closeMobileSearch}
                            className="h-11 flex-shrink-0 px-1 text-sm font-semibold text-primary"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="title"
                          className="flex items-center justify-between gap-3"
                          initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -8 }}
                          transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                        >
                          <div className="min-w-0">
                            <p className="text-lg font-bold tracking-tight text-foreground">
                              Add a song
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {items.length} songs · alphabetical
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={openMobileSearch}
                              aria-label="Search songs"
                              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95 active:bg-accent"
                            >
                              <Search className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={close}
                              aria-label="Close song browser"
                              className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-foreground active:scale-95 active:bg-accent"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </header>

                  {filtered.length === 0 ? (
                    <div className="flex-1">{emptyState}</div>
                  ) : (
                    <div className="relative min-h-0 flex-1">
                      <div className="h-full overflow-y-auto overscroll-contain scroll-smooth pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <div role="listbox" className="pr-8">
                          {alphabeticalGroups.map(([letter, group]) => (
                            <section
                              key={letter}
                              ref={(node) => {
                                if (node) groupRefs.current.set(letter, node);
                                else groupRefs.current.delete(letter);
                              }}
                              aria-labelledby={`song-group-${letter}`}
                            >
                              <div
                                id={`song-group-${letter}`}
                                className="sticky top-0 z-10 border-y border-border/60 bg-secondary/95 px-4 py-1 text-xs font-bold tracking-[0.14em] text-primary backdrop-blur-xl"
                              >
                                {letter}
                              </div>
                              <ul>
                                {group.map((item) => (
                                  <li
                                    key={item.id}
                                    className="border-b border-border/45 px-1 last:border-b-0"
                                  >
                                    {renderRow(item, true)}
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>

                        {!mobileSearchOpen && alphabeticalGroups.length > 1 && (
                          <nav
                            aria-label="Song initials"
                            className="fixed right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center rounded-l-xl border-y border-l border-border/60 bg-background/80 px-1 py-1.5 shadow-lg backdrop-blur-xl"
                          >
                            {alphabeticalGroups.map(([letter]) => (
                              <button
                                type="button"
                                key={letter}
                                onClick={() =>
                                  groupRefs.current.get(letter)?.scrollIntoView({
                                    behavior: shouldReduceMotion ? "auto" : "smooth",
                                    block: "start",
                                  })
                                }
                                className="flex min-h-[18px] min-w-[24px] items-center justify-center text-[10px] font-bold leading-none text-primary active:scale-125"
                                aria-label={`Jump to songs starting with ${letter}`}
                              >
                                {letter}
                              </button>
                            ))}
                          </nav>
                        )}
                      </div>
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
