"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS, CATEGORY_ORDER, TOP_VIBES, Category, Spot, EventRecord } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { Search, MapPin, X, CircleUserRound, Calendar } from "lucide-react";

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

export default function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spots, setSpots] = useState<Spot[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch spots once on first open
  useEffect(() => {
    if (!open || spots.length > 0) return;
    let cancelled = false;
    createClient()
      .from("spots")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (cancelled || !data) return;
        setSpots(data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          category: r.category as Category[],
          subcategory: r.subcategory as string[] | undefined,
          vibes: r.vibes as string[] | undefined,
          neighborhood: r.neighborhood as string,
          city: r.city as string,
          description: r.description as string,
          address: r.address as string,
          images: r.images as string[],
          lng: r.lng as number,
          lat: r.lat as number,
          priceRange: r.price_range as string | undefined,
        } as Spot)));
      });
    return () => { cancelled = true; };
  }, [open, spots.length]);

  // Fetch members once on first open
  useEffect(() => {
    if (!open || members.length > 0) return;
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
  }, [open, members.length]);

  // Fetch upcoming public events once on first open
  useEffect(() => {
    if (!open || events.length > 0) return;
    let cancelled = false;
    createClient()
      .from("events")
      .select("*")
      .eq("status", "published")
      .eq("visibility", "public")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        setEvents(data as EventRecord[]);
      });
    return () => { cancelled = true; };
  }, [open, events.length]);

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

  const flatItems = useMemo(() => {
    const all: Array<{ type: string; value: string }> = [];
    for (const m of matchingMembers) all.push({ type: "member", value: m.id });
    for (const e of matchingEvents) all.push({ type: "event", value: e.id });
    for (const n of matchingNeighborhoods) all.push({ type: "neighborhood", value: n });
    for (const c of matchingCategories) all.push({ type: "category", value: c });
    for (const s of results) all.push({ type: "spot", value: s.id });
    return all;
  }, [matchingMembers, matchingEvents, matchingNeighborhoods, matchingCategories, results]);

  const hasQuery = query.trim().length > 0;
  const hasResults = flatItems.length > 0;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => { setSelectedIndex(0); }, [flatItems]);

  useEffect(() => {
    const el = listRef.current?.querySelector("[data-selected='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) selectItem(item);
    }
  }

  function selectItem(item: { type: string; value: string }) {
    if (item.type === "spot") {
      const spot = spots.find((s) => s.id === item.value);
      if (spot) {
        setOpen(false);
        router.push(`/${citySlugFromName(spot.city)}/${spot.id}`);
      }
    } else if (item.type === "member") {
      setOpen(false);
      router.push(`/members/${item.value}`);
    } else if (item.type === "event") {
      setOpen(false);
      router.push(`/events/${item.value}`);
    } else {
      setQuery(item.type === "category" ? CATEGORY_LABELS[item.value as Category] : item.value);
      inputRef.current?.focus();
    }
  }

  function handleQuickFilter(value: string) {
    setQuery(value);
    inputRef.current?.focus();
  }

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] md:pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ animation: "fadeIn 0.15s ease-out" }} />

      <div
        className="relative w-full max-w-lg mx-4 md:mx-0 bg-surface rounded-2xl shadow-2xl dark:shadow-neutral-900/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "command-in 0.2s cubic-bezier(0.25,0.1,0.25,1)" }}
      >
        {/* Search input — large and prominent */}
        <div className="relative px-5 pt-3 pb-3">
          <Search size={18} strokeWidth={2} className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search spaces and members..."
            className="w-full pl-7 pr-8 py-3 text-base bg-transparent outline-none placeholder-neutral-400 dark:placeholder-neutral-500 border-b border-neutral-100 dark:border-neutral-800"
          />
          <button
            onClick={() => { if (query) { setQuery(""); inputRef.current?.focus(); } else { setOpen(false); } }}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-400 transition-colors"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto scrollbar-hide">
          {!hasQuery ? (
            <div className="px-5 pb-5 space-y-4">
              {/* Vibes — single scrollable row */}
              <div>
                <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-2">
                  Vibes
                </p>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
                  {TOP_VIBES.map((vibe) => (
                    <button
                      key={vibe}
                      onClick={() => handleQuickFilter(vibe)}
                      className="px-3 py-1.5 text-xs rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      {vibe}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trending — with thumbnails */}
              {spots.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mb-2">
                    Trending
                  </p>
                  <div className="-mx-5">
                    {spots.slice(0, 5).map((spot) => (
                      <button
                        key={spot.id}
                        onClick={() => {
                          setOpen(false);
                          router.push(`/${citySlugFromName(spot.city)}/${spot.id}`);
                        }}
                        className="w-full text-left px-5 py-2.5 flex items-center gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                      >
                        {spot.images?.[0] && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={spot.images[0]} alt="" className="w-full h-full object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{spot.name}</p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate">
                            {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : !hasResults ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                Try a name, neighborhood, vibe, or member
              </p>
            </div>
          ) : (
            <div className="pb-3" style={{ animation: "fadeIn 0.15s ease-out" }}>
              {/* Member matches */}
              {matchingMembers.length > 0 && (
                <div>
                  <div className="px-5 pt-2 pb-1.5">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Members</p>
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
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center shrink-0">
                            <CircleUserRound size={14} strokeWidth={1.5} className="text-white dark:text-neutral-900" />
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
                  <div className="px-5 pt-2 pb-1.5">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Events</p>
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
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        {thumb ? (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={thumb} alt="" className="w-full h-full object-cover spot-img" />
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
                  <div className="px-5 pt-2 pb-1.5">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Neighborhoods</p>
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
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
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
                  <div className="px-5 pt-2 pb-1.5">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Categories</p>
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
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
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
                  <div className="px-5 pt-2 pb-1.5">
                    <p className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">Spaces</p>
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
                        className={`w-full text-left px-5 py-2.5 flex items-center gap-3 transition-colors ${
                          isSelected ? "bg-neutral-50 dark:bg-neutral-900" : ""
                        }`}
                      >
                        {spot.images?.[0] && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800">
                            <img src={spot.images[0]} alt="" className="w-full h-full object-cover spot-img" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate"><Highlight text={spot.name} query={query} /></p>
                          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
                            <Highlight text={spot.neighborhood} query={query} /> · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
