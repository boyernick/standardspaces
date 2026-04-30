"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, CATEGORY_ORDER, Category, Spot, EventRecord } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { NewBadge } from "@/lib/new-badge";
import { Search, MapPin, Calendar, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/initials";

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-neutral-900 dark:text-white font-semibold">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}

type Member = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  instagram: string | null;
  avatar_url: string | null;
  city: string | null;
};

type SemanticHit = { id: string; similarity: number };

interface CommandMenuProps {
  /** Whether the dropdown is visible. Owned by the parent (the navbar). */
  open: boolean;
  /** Close the dropdown. Called when an item is picked or focus leaves. */
  onClose: () => void;
  /** Current query text. The parent's `<input>` is the source of truth. */
  query: string;
  /** Update the query (used when a vibe/category/neighborhood is tapped to
   *  fill the input). */
  setQuery: (q: string) => void;
  /** Where the dropdown sits relative to its parent. Desktop navbar uses
   *  "below" (default); the mobile bottom bar uses "above" so the panel
   *  grows upward into the screen instead of off the bottom edge. */
  placement?: "below" | "above";
}

export default function CommandMenu({
  open,
  onClose,
  query,
  setQuery,
  placement = "below",
}: CommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [semantic, setSemantic] = useState<SemanticHit[]>([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState<string | null>(null);
  const semanticCache = useRef<Map<string, SemanticHit[]>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Refetch the three datasets each time the menu opens. We deliberately
  // don't cache past the first open: a newly-approved member, a newly-added
  // space, or a newly-published event needs to be discoverable on the very
  // next Cmd+K without a page reload. Payloads are small and the old state
  // stays visible while the refresh runs (stale-while-revalidate for free —
  // we only call `setX` on success, so typing a query the instant the menu
  // opens still hits the prior list until the new one lands).
  //
  // `cancelled` + the cleanup handler drops any in-flight response whose
  // menu-open session has since ended, preventing stale writes after close.

  // Fetch spots. Only the columns the menu actually reads are selected to
  // keep the payload small.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    createClient()
      .from("spots")
      .select("id, name, category, vibes, neighborhood, city, images, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSpots(data.map((r: Record<string, unknown>) => ({
          // Only the fields the menu actually reads. The wider `Spot`
          // type has description/address/lng/lat that we never touch
          // here, so we go through `unknown` to assert the partial
          // shape — same pattern the menu has used since it was a
          // modal, just made explicit now that `created_at` got added
          // and TypeScript started enforcing the gap.
          id: r.id as string,
          name: r.name as string,
          category: r.category as Category[],
          vibes: r.vibes as string[] | undefined,
          neighborhood: r.neighborhood as string,
          city: r.city as string,
          images: r.images as string[],
          created_at: r.created_at as string,
        }) as unknown as Spot));
      });
    return () => { cancelled = true; };
  }, [open]);

  // Fetch members.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("id, first_name, last_name, instagram, avatar_url, city")
      .not("first_name", "is", null)
      .order("first_name")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMembers(data as Member[]);
      });
    return () => { cancelled = true; };
  }, [open]);

  // Fetch upcoming public events. The `starts_at >= now` filter is tied to
  // the moment of the fetch, which is another reason to re-run per open —
  // yesterday's "upcoming" list shouldn't bleed into today.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    createClient()
      .from("events")
      .select("id, title, description, city, cover_image_url, images, starts_at")
      .eq("status", "published")
      .eq("visibility", "public")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setEvents(data as unknown as EventRecord[]);
      });
    return () => { cancelled = true; };
  }, [open]);

  const neighborhoods = useMemo(() => [...new Set(spots.map((s) => s.neighborhood))].sort(), [spots]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return spots.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.neighborhood.toLowerCase().includes(q) ||
        s.category.some((c) => CATEGORY_LABELS[c].toLowerCase().includes(q)) ||
        (s.vibes && s.vibes.some((v) => v.toLowerCase().includes(q)))
    );
  }, [query, spots]);

  const matchingNeighborhoods = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return neighborhoods.filter((n) => n.toLowerCase().includes(q));
  }, [query, neighborhoods]);

  const matchingCategories = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return CATEGORY_ORDER.filter((c) =>
      CATEGORY_LABELS[c].toLowerCase().includes(q)
    );
  }, [query]);

  const matchingMembers = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return members.filter((m) => {
      const name = [m.first_name, m.last_name].filter(Boolean).join(" ").toLowerCase();
      const handle = (m.instagram || "").toLowerCase();
      return name.includes(q) || handle.includes(q);
    });
  }, [query, members]);

  const matchingEvents = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return events.filter((e) => {
      return (
        e.title.toLowerCase().includes(q) ||
        (e.city && e.city.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q))
      );
    });
  }, [query, events]);

  // Semantic "Related" hits: only surface IDs that aren't already in the
  // substring results. The substring path stays authoritative for anything
  // it catches; semantic is purely additive.
  const relatedSpots = useMemo(() => {
    if (semantic.length === 0 || spots.length === 0) return [];
    const seen = new Set(results.map((s) => s.id));
    const byId = new Map(spots.map((s) => [s.id, s]));
    const out: Spot[] = [];
    for (const hit of semantic) {
      if (seen.has(hit.id)) continue;
      const spot = byId.get(hit.id);
      if (spot) out.push(spot);
    }
    return out;
  }, [semantic, spots, results]);

  // Five most-recently added spaces (DB sort = created_at desc). Surfaced as
  // "Recently added" in the empty state, and also fed into `flatItems` so
  // arrow keys can navigate them.
  const recentSpots = useMemo(() => spots.slice(0, 5), [spots]);


  const flatItems = useMemo(() => {
    const all: Array<{ type: string; value: string }> = [];
    if (!query.trim()) {
      // Empty state — let arrow keys navigate the Trending list.
      for (const s of recentSpots) all.push({ type: "spot", value: s.id });
      return all;
    }
    for (const m of matchingMembers) all.push({ type: "member", value: m.id });
    for (const e of matchingEvents) all.push({ type: "event", value: e.id });
    for (const n of matchingNeighborhoods) all.push({ type: "neighborhood", value: n });
    for (const c of matchingCategories) all.push({ type: "category", value: c });
    for (const s of results) all.push({ type: "spot", value: s.id });
    for (const s of relatedSpots) all.push({ type: "spot", value: s.id });
    return all;
  }, [query, recentSpots, matchingMembers, matchingEvents, matchingNeighborhoods, matchingCategories, results, relatedSpots]);

  const hasQuery = query.trim().length > 0;
  const hasResults = flatItems.length > 0;

  // Arrow / Enter navigation is captured at the document level (only when the
  // menu is open) so it works regardless of which element inside the menu has
  // focus — clicking on the result list used to drop focus from the input
  // and break keyboard nav.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(flatItems.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        const item = flatItems[selectedIndex];
        if (item) {
          e.preventDefault();
          selectItem(item);
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatItems, selectedIndex]);

  // Reset highlight to first row whenever the result set changes (typing,
  // dataset refresh, etc.). Keeps the keyboard cursor predictable.
  useEffect(() => { setSelectedIndex(0); }, [flatItems]);

  // Semantic search — debounced, only fires when substring results are thin.
  // Substring path stays instant; this paints in a second wave. Cached by
  // query string so backspace/retype doesn't re-hit the network.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 4 || results.length >= 5) {
      setSemantic([]);
      setSemanticLoading(false);
      setSemanticError(null);
      return;
    }
    const cached = semanticCache.current.get(q);
    if (cached) {
      setSemantic(cached);
      setSemanticLoading(false);
      setSemanticError(null);
      return;
    }
    // Flip loading on immediately when a semantic search is scheduled — not
    // when the fetch starts — so fast typing (which repeatedly cancels and
    // reschedules the 250ms timer) keeps the "Searching…" state up instead
    // of flashing the null state between keystrokes.
    setSemanticLoading(true);
    setSemanticError(null);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/semantic?q=${encodeURIComponent(q)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          // Surface the specific failure mode so setup problems (missing
          // key, missing migration, missing backfill) are debuggable from
          // the UI instead of silently returning nothing.
          let reason = `error ${res.status}`;
          try {
            const body: { error?: string } = await res.json();
            if (body.error) reason = body.error;
          } catch {
            if (res.status === 401) reason = "sign in required";
          }
          setSemantic([]);
          setSemanticError(reason);
          return;
        }
        const json: { results?: SemanticHit[] } = await res.json();
        const hits = json.results ?? [];
        semanticCache.current.set(q, hits);
        setSemantic(hits);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setSemantic([]);
          setSemanticError("network error");
        }
      } finally {
        setSemanticLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, query, results.length]);

  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function selectItem(item: { type: string; value: string }) {
    if (item.type === "spot") {
      const spot = spots.find((s) => s.id === item.value);
      if (spot) {
        onClose();
        router.push(`/${citySlugFromName(spot.city)}/${spot.id}`);
      }
    } else if (item.type === "member") {
      onClose();
      router.push(`/members/${item.value}`);
    } else if (item.type === "event") {
      onClose();
      router.push(`/events/${item.value}`);
    } else {
      // Tapping a category/neighborhood/vibe fills the parent input. The
      // navbar input keeps focus because we never moved it.
      setQuery(item.type === "category" ? CATEGORY_LABELS[item.value as Category] : item.value);
    }
  }

  function handleQuickFilter(value: string) {
    setQuery(value);
  }

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className={`absolute left-0 right-0 z-50 rounded-2xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.55)] dark:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] overflow-hidden ${
        placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
      }`}
      style={{
        backgroundColor: "var(--color-surface)",
        animation: `${placement === "above" ? "command-in-up" : "command-in"} 0.2s cubic-bezier(0.25,0.1,0.25,1)`,
      }}
    >
      <div className="flex flex-col max-h-[480px]">
        {/* Content */}
        <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-hide">
          {!hasQuery ? (
            <div className="px-5 pt-3 pb-3 space-y-4">
              {/* Trending in Miami — newest spaces first */}
              {spots.length > 0 && (
                <div>
                  <p
                    className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-3"
                    style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
                  >
                    Trending in Miami
                  </p>
                  <div className="-mx-3">
                    {recentSpots.map((spot, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                      <button
                        key={spot.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "spot", value: spot.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        {spot.images?.[0] && (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <Image src={spot.images[0]} alt="" fill sizes="40px" className="object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate">{spot.name}</p>
                            <NewBadge spot={spot} compact />
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : !hasResults && semanticLoading ? (
            <div className="px-5 py-12 flex items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
              <span>Searching…</span>
            </div>
          ) : !hasResults ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Try a name, neighborhood, vibe, or member
              </p>
            </div>
          ) : (
            <div className="pt-2 pb-3" style={{ animation: "fadeIn 0.15s ease-out" }}>
              {/* Member matches */}
              {matchingMembers.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Members</p>
                  </div>
                  {matchingMembers.map((member) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
                    return (
                      <button
                        key={member.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "member", value: member.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        {member.avatar_url ? (
                          <Image src={member.avatar_url} alt="" width={32} height={32} sizes="32px" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center shrink-0 text-[10px] font-medium text-neutral-400 dark:text-neutral-500"
                            style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
                          >
                            {getInitials(name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate"><Highlight text={name} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {member.instagram && <><Highlight text={`@${member.instagram.replace("@", "")}`} query={query} /></>}
                            {member.instagram && member.city && " · "}
                            {member.city}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Event matches */}
              {matchingEvents.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Events</p>
                  </div>
                  {matchingEvents.map((event) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const thumb = event.cover_image_url || event.images?.[0];
                    const date = new Date(event.starts_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <button
                        key={event.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "event", value: event.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        {thumb ? (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <Image src={thumb} alt="" fill sizes="40px" className="object-cover spot-img" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center shrink-0">
                            <Calendar size={16} strokeWidth={1.5} className="text-white dark:text-neutral-900" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate"><Highlight text={event.title} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                            {date}{event.city && <> · <Highlight text={event.city} query={query} /></>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Neighborhood matches */}
              {matchingNeighborhoods.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Neighborhoods</p>
                  </div>
                  {matchingNeighborhoods.map((n) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const count = spots.filter((s) => s.neighborhood === n).length;
                    return (
                      <button
                        key={n}
                        data-selected={isSelected}
                        onClick={() => handleQuickFilter(n)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        <MapPin size={16} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium"><Highlight text={n} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">{count} spaces</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Category matches */}
              {matchingCategories.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Categories</p>
                  </div>
                  {matchingCategories.map((c) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    const count = spots.filter((s) => s.category.includes(c)).length;
                    return (
                      <button
                        key={c}
                        data-selected={isSelected}
                        onClick={() => handleQuickFilter(CATEGORY_LABELS[c])}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        <Search size={14} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium"><Highlight text={CATEGORY_LABELS[c]} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500">{count} spaces</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Spot results — with thumbnails */}
              {results.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Spaces</p>
                  </div>
                  {results.map((spot) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={spot.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "spot", value: spot.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        {spot.images?.[0] && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={spot.images[0]} alt="" className="w-full h-full object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate"><Highlight text={spot.name} query={query} /></p>
                            <NewBadge spot={spot} compact />
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                            <Highlight text={spot.neighborhood} query={query} /> · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Semantic search status — loading/error/empty states.
                 Hidden entirely when suppressed (substring returned ≥5) or
                 when results are rendering below; this is the UX signal that
                 we tried and didn't find anything (or a setup issue). */}
              {(semanticLoading || semanticError || (semantic.length > 0 && relatedSpots.length === 0)) && (
                <div className="px-5 pt-3 pb-1 flex items-center gap-2 text-[11px] text-neutral-400 dark:text-neutral-500">
                  {semanticLoading ? (
                    <>
                      <Loader2 size={11} strokeWidth={2} className="animate-spin" />
                      <span>Searching related…</span>
                    </>
                  ) : semanticError ? (
                    <span>Related search unavailable — {semanticError}</span>
                  ) : (
                    <span>No related matches</span>
                  )}
                </div>
              )}

              {/* Semantic "Related" — vibe/intent matches not caught by substring */}
              {relatedSpots.length > 0 && (
                <div>
                  <div className="px-5 pt-3 pb-3">
                    <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>Related</p>
                  </div>
                  {relatedSpots.map((spot) => {
                    const idx = flatIdx++;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={spot.id}
                        data-selected={isSelected}
                        onClick={() => selectItem({ type: "spot", value: spot.id })}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors ${
                          isSelected ? "bg-ink-100" : ""
                        }`}
                      >
                        {spot.images?.[0] && (
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <Image src={spot.images[0]} alt="" fill sizes="40px" className="object-cover spot-img opacity-90" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-medium truncate text-neutral-700 dark:text-neutral-300">{spot.name}</p>
                            <NewBadge spot={spot} compact />
                          </div>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                            {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <style>{`
        @keyframes command-in {
          from { opacity: 0; transform: scale(0.96) translateY(-12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes command-in-up {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
