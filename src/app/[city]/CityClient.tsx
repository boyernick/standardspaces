"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, SUBCATEGORY_GROUPS, Category, Spot, EventRecord } from "@/lib/types";
import { isSpotNew } from "@/lib/new-badge";
import UpcomingEventsStrip from "@/components/UpcomingEventsStrip";
import dynamic from "next/dynamic";
const SpotMap = dynamic(() => import("@/components/Map"), { ssr: false });
// Lazy-load the menu so its Supabase / search plumbing only ships when a
// mobile user actually taps the bottom search bar.
const CommandMenu = dynamic(() => import("@/components/CommandMenu"), { ssr: false });
import ImageCarousel from "@/components/ImageCarousel";
import CheckInButton from "@/components/CheckInButton";
import FavoriteButton from "@/components/FavoriteButton";
import WishlistButton from "@/components/WishlistButton";
import { NewBadge } from "@/lib/new-badge";
import { ChevronDown, Map as MapIcon, List, X, MapPin, Search, Calendar, Maximize2, Minimize2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { motion, AnimatePresence } from "framer-motion";
import {
  squaredDistance,
  isLngLatInBounds,
  boundsCenter,
  type LngLat,
  type LngLatBounds,
} from "@/lib/geo";
import type { MapView } from "@/components/Map";

const VIEWPORT_DEAD_ZONE = 0.0005;

/**
 * Pull a viewport out of the URL search params, if all four required pieces
 * are present and well-formed. Used to hydrate the map + side panel from a
 * shareable link without flashing through fitBounds first.
 *
 * URL shape mirrors Airbnb's: `?ne=lat,lng&sw=lat,lng&z=12.9&auto=1`. Lat/lng
 * order matches the human convention even though Mapbox uses lng/lat
 * internally.
 */
function parseViewportParams(sp: URLSearchParams): {
  bounds: LngLatBounds;
  center: LngLat;
  zoom: number;
  auto: boolean;
} | null {
  const ne = sp.get("ne");
  const sw = sp.get("sw");
  const z = sp.get("z");
  if (!ne || !sw || !z) return null;
  const [neLat, neLng] = ne.split(",").map(Number);
  const [swLat, swLng] = sw.split(",").map(Number);
  const zoom = Number(z);
  if (
    !Number.isFinite(neLat) ||
    !Number.isFinite(neLng) ||
    !Number.isFinite(swLat) ||
    !Number.isFinite(swLng) ||
    !Number.isFinite(zoom)
  ) {
    return null;
  }
  if (neLat < swLat || neLng < swLng) return null;
  const bounds: LngLatBounds = [
    [swLng, swLat],
    [neLng, neLat],
  ];
  return {
    bounds,
    center: boundsCenter(bounds),
    zoom,
    auto: sp.get("auto") !== "0",
  };
}

interface CityClientProps {
  spots: Spot[];
  favoritedSpotIds?: string[];
  wishlistedSpotIds?: string[];
  checkedInSpotIds?: string[];
  cityName: string;
  citySlug: string;
  userCitySlug: string;
  upcomingEvents?: EventRecord[];
  invitedEvents?: EventRecord[];
  eventSpotNames?: Record<string, string>;
  eventSpotCategories?: Record<string, Category[]>;
  // Rendered on the server (with the user's avatar + badge counts
  // prefetched) and passed in as JSX so this client boundary can embed it
  // without importing the server-only module.
  navbar: React.ReactNode;
}

export default function CityClient({ spots: allSpots, favoritedSpotIds = [], wishlistedSpotIds = [], checkedInSpotIds = [], cityName, citySlug, userCitySlug, upcomingEvents = [], invitedEvents = [], eventSpotNames = {}, eventSpotCategories = {}, navbar }: CityClientProps) {
  const favoritedSet = useMemo(() => new Set(favoritedSpotIds), [favoritedSpotIds]);
  const wishlistedSet = useMemo(() => new Set(wishlistedSpotIds), [wishlistedSpotIds]);
  const checkedInSet = useMemo(() => new Set(checkedInSpotIds), [checkedInSpotIds]);

  // Spot counts per facet — drive the count-desc ordering of pills, with
  // the canonical array order in CATEGORY_ORDER / VIBES / SUBCATEGORIES as
  // the deterministic tiebreak.
  const categoryCount = useMemo(() => {
    const m = new Map<Category, number>();
    for (const s of allSpots) for (const c of s.category) m.set(c, (m.get(c) ?? 0) + 1);
    return m;
  }, [allSpots]);
  const neighborhoodCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allSpots) m.set(s.neighborhood, (m.get(s.neighborhood) ?? 0) + 1);
    return m;
  }, [allSpots]);

  // Editorial order from CATEGORY_ORDER — categories are 7 items where the
  // intentional left-to-right hierarchy beats data-driven shuffling.
  // Shops and Venues always render even with zero matches so the row feels
  // complete across cities that haven't onboarded those categories yet.
  const ALWAYS_SHOWN_CATEGORIES: Category[] = ["shopping", "members"];
  const categories = useMemo(
    () => CATEGORY_ORDER.filter((c) => ALWAYS_SHOWN_CATEGORIES.includes(c) || (categoryCount.get(c) ?? 0) > 0),
    [categoryCount],
  );
  const neighborhoods = useMemo(
    () =>
      [...neighborhoodCount.keys()].sort((a, b) => {
        const diff = (neighborhoodCount.get(b) ?? 0) - (neighborhoodCount.get(a) ?? 0);
        return diff !== 0 ? diff : a.localeCompare(b);
      }),
    [neighborhoodCount],
  );

  // `?events=1` deep-links the city feed with the Events filter already
  // toggled — used from empty states on /events so a user with nothing
  // on their calendar can tap straight into the city's open events.
  // Read from window.location here (not useSearchParams, which runs
  // later in this component) so the initial useState value is correct.
  const [eventsOnly, setEventsOnly] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("events") === "1";
  });
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeSubcategories, setActiveSubcategories] = useState<Set<string>>(new Set());
  const [categoryDropdown, setCategoryDropdown] = useState<Category | null>(null);
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [activeEventTypes, setActiveEventTypes] = useState<Set<Category>>(new Set());
  const [eventTypesOpen, setEventTypesOpen] = useState(false);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [hoveredSpotId, setHoveredSpotId] = useState<string | null>(null);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

  // Mobile-only bottom-bar search. Owns its own state mirror of the
  // navbar's pattern (open + query) so the dropdown can render anchored
  // to the bottom bar's input.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchWrapRef = useRef<HTMLDivElement>(null);
  // Desktop-only: hide the side panel cards and give the map the full width,
  // with the filter pills overlaid at the top. Mobile has its own map/list
  // toggle (`mobileView`) so this flag only takes effect at the `split:`
  // breakpoint — the expand button below is hidden under `split:` as well.
  const [mapExpanded, setMapExpanded] = useState(false);
  // Lazy-mount Mapbox on mobile: don't boot a WebGL context + tile fetches
  // for users who only browse the list. Defaults to `false` during SSR and
  // the first client render, then flips true on mount if the viewport is at
  // or above the `split:` breakpoint. Also flips true (and stays true) the
  // first time a mobile user taps the Map toggle, so switching back to the
  // list doesn't tear down the map and lose its state.
  const [mapMounted, setMapMounted] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 56rem)");
    if (mql.matches) setMapMounted(true);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMapMounted(true);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Hydrate viewport state from the URL on first render only. Later
  // `searchParams` changes (from our own router.replace calls or pagination)
  // must NOT re-trigger this — that would cause an infinite write loop.
  const initialViewportRef = useRef<ReturnType<typeof parseViewportParams> | null>(null);
  if (initialViewportRef.current === null) {
    initialViewportRef.current = parseViewportParams(
      new URLSearchParams(searchParams.toString()),
    );
  }
  const initialViewport = initialViewportRef.current;

  // Committed viewport: what the side panel actually filters against. Updated
  // automatically on every moveend when `searchAsIMove` is on, or only when
  // the user clicks the "Search this area" pill when it's off.
  const [committedBounds, setCommittedBounds] = useState<LngLatBounds | null>(
    initialViewport?.bounds ?? null,
  );
  const [committedCenter, setCommittedCenter] = useState<LngLat | null>(
    initialViewport?.center ?? null,
  );
  const [committedZoom, setCommittedZoom] = useState<number | null>(
    initialViewport?.zoom ?? null,
  );

  // Live viewport: what the map is currently showing. Diverges from the
  // committed viewport when the user pans with the toggle off — that's what
  // makes the "Search this area" pill appear.
  const [liveCenter, setLiveCenter] = useState<LngLat | null>(
    initialViewport?.center ?? null,
  );
  const liveBoundsRef = useRef<LngLatBounds | null>(initialViewport?.bounds ?? null);
  const liveZoomRef = useRef<number | null>(initialViewport?.zoom ?? null);

  // "Search as I move the map" is now always on — every moveend commits.
  // Kept as constants (rather than ripped out entirely) so the existing
  // refs/handlers still type-check and the URL contract is unchanged.
  const searchAsIMove = true;
  const committedBoundsRef = useRef(committedBounds);
  committedBoundsRef.current = committedBounds;
  const BATCH = 12;
  const [visibleCount, setVisibleCount] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Writes (or refreshes) the viewport params on the URL bar.
  //
  // We deliberately use `window.history.replaceState` instead of
  // `router.replace`. Next.js's router replace on a dynamic route refetches
  // the server component, which re-creates the `spots` array reference, which
  // re-runs Map.tsx's fitBounds effect — and that yanks the user's pan/zoom
  // back out on every moveend (bug observed: zooming in pans you back out).
  // `history.replaceState` updates the URL bar in-place with no router churn,
  // which is exactly what Airbnb does for their `?ne=…&sw=…&zoom=…` sync.
  const writeViewportUrl = useCallback(
    (b: LngLatBounds, z: number, auto: boolean) => {
      const sp = new URLSearchParams(window.location.search);
      sp.set("ne", `${b[1][1].toFixed(4)},${b[1][0].toFixed(4)}`);
      sp.set("sw", `${b[0][1].toFixed(4)},${b[0][0].toFixed(4)}`);
      sp.set("z", z.toFixed(2));
      sp.set("auto", auto ? "1" : "0");
      window.history.replaceState(null, "", `${pathname}?${sp.toString()}`);
    },
    [pathname],
  );

  const handleViewChange = useCallback(
    (v: MapView) => {
      setLiveCenter((prev) => {
        if (
          prev &&
          Math.abs(prev[0] - v.center[0]) < 1e-6 &&
          Math.abs(prev[1] - v.center[1]) < 1e-6
        ) {
          return prev;
        }
        return v.center;
      });
      liveBoundsRef.current = v.bounds;
      liveZoomRef.current = v.zoom;
      setCommittedBounds(v.bounds);
      setCommittedCenter(v.center);
      setCommittedZoom(v.zoom);
      writeViewportUrl(v.bounds, v.zoom, true);
    },
    [writeViewportUrl],
  );

  const neighborhoodRef = useRef<HTMLDivElement>(null);
  const neighborhoodDropdownRef = useRef<HTMLDivElement>(null);
  const eventTypesRef = useRef<HTMLDivElement>(null);
  const eventTypesDropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  // Soft shadow beneath the filter bar once the side panel scrolls away from
  // its top edge — reads as the filters floating above the list.
  const [panelScrolled, setPanelScrolled] = useState(false);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);

  // Click-outside / Escape close the mobile search dropdown.
  useEffect(() => {
    if (!mobileSearchOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        mobileSearchWrapRef.current &&
        !mobileSearchWrapRef.current.contains(e.target as Node)
      ) {
        setMobileSearchOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        mobileSearchInputRef.current?.blur();
        setMobileSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileSearchOpen]);

  // Close after navigating to a result.
  useEffect(() => {
    setMobileSearchOpen(false);
    setMobileSearchQuery("");
  }, [pathname]);

  useEffect(() => {
    if (!neighborhoodOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        neighborhoodRef.current && !neighborhoodRef.current.contains(target) &&
        neighborhoodDropdownRef.current && !neighborhoodDropdownRef.current.contains(target)
      ) {
        setNeighborhoodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [neighborhoodOpen]);

  useEffect(() => {
    if (!eventTypesOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        eventTypesRef.current && !eventTypesRef.current.contains(target) &&
        eventTypesDropdownRef.current && !eventTypesDropdownRef.current.contains(target)
      ) {
        setEventTypesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [eventTypesOpen]);

  useEffect(() => {
    if (!categoryDropdown) return;
    function handleClick(e: MouseEvent) {
      if (
        categoryRef.current && !categoryRef.current.contains(e.target as Node) &&
        categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)
      ) setCategoryDropdown(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [categoryDropdown]);

  // Compute map height to fill viewport between filter bar and search bar
  useEffect(() => {
    function compute() {
      const filterBar = filterBarRef.current;
      const bottomBar = bottomBarRef.current;
      if (!filterBar || !bottomBar) return;
      const filterBottom = filterBar.getBoundingClientRect().bottom;
      const bottomBarHeight = bottomBar.getBoundingClientRect().height;
      setMapHeight(window.innerHeight - filterBottom - bottomBarHeight - 10);
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [mobileView]);

  // Filtered spots (no sort). Passed to the map as-is so the sort order can't
  // retrigger fitBounds.
  const filteredRaw = useMemo(() => {
    if (eventsOnly) {
      const eventSpotIds = new Set(upcomingEvents.map((e) => e.spot_id));
      return allSpots.filter((s) => eventSpotIds.has(s.id));
    }
    let result = allSpots;
    if (activeCategory) {
      result = result.filter((s) => s.category.includes(activeCategory));
      if (activeSubcategories.size > 0) {
        result = result.filter((s) => s.subcategory?.some((sc) => activeSubcategories.has(sc)));
      }
    }
    if (activeNeighborhood) {
      result = result.filter((s) => s.neighborhood === activeNeighborhood);
    }
    return result;
  }, [eventsOnly, upcomingEvents, activeCategory, activeSubcategories, activeNeighborhood, allSpots]);

  // Viewport-scoped list. Spots inside the committed bounds, ranked nearest
  // to map center first. When the viewport is empty, fall back to the 5
  // nearest matching spots overall (Airbnb's `location_search=NEARBY`
  // pattern) so the panel never goes blank.
  const { filtered, nearby, hydrated } = useMemo(() => {
    // Strict viewport scoping — the panel should mirror exactly what's
    // visible on the map, no padding, no fudge factor.
    //
    // Category priority: food & drink at the top (tier 0), members /
    // wellness / shopping at the bottom (tier 2), everything else in the
    // middle (tier 1). Priority outranks the `is_new` pin so a new
    // wellness spot doesn't shove dining down the feed.
    const PRIORITY_CATS = new Set<Category>(["dining", "drinks"]);
    const DEPRIORITY_CATS = new Set<Category>(["members", "wellness", "shopping"]);
    const categoryTier = (cats: Category[]): number => {
      if (cats.some((c) => PRIORITY_CATS.has(c))) return 0;
      if (cats.length > 0 && cats.every((c) => DEPRIORITY_CATS.has(c))) return 2;
      return 1;
    };
    // Mobile list view before the map has booted: no viewport to scope
    // against, so show every matching spot sorted by tier + is_new only.
    // Without this, `hydrated` would stay false forever and the skeleton
    // would never resolve (mapMounted only flips true on the split:
    // breakpoint or after the user taps Map).
    if (!mapMounted || !committedBounds || !committedCenter) {
      const sorted = [...filteredRaw].sort((a, b) => {
        const at = categoryTier(a.category);
        const bt = categoryTier(b.category);
        if (at !== bt) return at - bt;
        const an = isSpotNew(a) ? 1 : 0;
        const bn = isSpotNew(b) ? 1 : 0;
        return bn - an;
      });
      return { filtered: sorted, nearby: [] as Spot[], hydrated: true };
    }
    const sortFn = (a: Spot, b: Spot): number => {
      const at = categoryTier(a.category);
      const bt = categoryTier(b.category);
      if (at !== bt) return at - bt;
      // is_new pinned within tier, then distance from map center.
      const an = isSpotNew(a) ? 1 : 0;
      const bn = isSpotNew(b) ? 1 : 0;
      if (an !== bn) return bn - an;
      return (
        squaredDistance([a.lng, a.lat], committedCenter) -
        squaredDistance([b.lng, b.lat], committedCenter)
      );
    };
    const inside = filteredRaw
      .filter((s) => isLngLatInBounds([s.lng, s.lat], committedBounds))
      .sort(sortFn);
    if (inside.length > 0) {
      return { filtered: inside, nearby: [] as Spot[], hydrated: true };
    }
    // Nearby fallback: pure proximity to the current map center. We
    // deliberately skip the category/is_new priority here because the
    // user's intent ("what's close to where I'm looking?") outranks any
    // editorial ranking the feed uses inside the viewport.
    const fallback = [...filteredRaw]
      .sort(
        (a, b) =>
          squaredDistance([a.lng, a.lat], committedCenter) -
          squaredDistance([b.lng, b.lat], committedCenter),
      )
      .slice(0, 6);
    return { filtered: [] as Spot[], nearby: fallback, hydrated: true };
  }, [filteredRaw, committedBounds, committedCenter, mapMounted]);


  // Reset the visible window whenever the filtered list identity changes
  // (category/neighborhood/events filters, viewport pans/zooms all rebuild it).
  useEffect(() => {
    setVisibleCount(BATCH);
    panelRef.current?.scrollTo({ top: 0 });
  }, [filtered]);

  const visibleSpots = filtered.slice(0, visibleCount);

  // Infinite scroll: when the sentinel near the bottom of the panel enters
  // the scroll viewport, append another batch.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = panelRef.current;
    if (!sentinel || !root) return;
    if (visibleCount >= filtered.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + BATCH, filtered.length));
        }
      },
      { root, rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  // Track whether the side panel has scrolled so the filter bar can cast a
  // soft shadow over the scrolling content below it.
  useEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    const onScroll = () => setPanelScrolled(root.scrollTop > 0);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  const handleSpotSelect = useCallback((spot: Spot | null) => { setActiveSpot(spot); }, []);

  // Imperative focus mechanism for "Nearby spaces" card hover — bumping
  // `focusToken` forces the map to pan to `focusSpot`, bypassing the normal
  // activeSpot isOutside heuristic so the pan is guaranteed.
  const [focusSpot, setFocusSpot] = useState<Spot | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const focusOnNearby = useCallback((spot: Spot) => {
    setActiveSpot(spot);
    setFocusSpot(spot);
    setFocusToken((t) => t + 1);
  }, []);

  const clearAll = () => {
    setActiveCategory(null);
    setActiveSubcategories(new Set());
    setCategoryDropdown(null);
    setActiveNeighborhood(null);
    setActiveSpot(null);
  };


  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      {navbar}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex-1 min-h-0 flex flex-col split:flex-row relative"
      >
        {/* Panel — left */}
        <div className={`w-full ${mapExpanded ? "split:w-0 split:min-w-0 split:grow-0 split:basis-0" : "split:w-[55%] lg:w-1/2 split:min-w-[420px]"} split:flex split:flex-col split:shrink-0 ${mobileView === "list" ? "flex flex-col flex-1 min-h-0" : "flex flex-col split:flex"}`}>
          {/* Filters bar */}
          {allSpots.length > 0 && <motion.div ref={filterBarRef} layout="position" transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }} className={`relative z-20 py-2.5 shrink-0 bg-surface ${mapExpanded ? "split:absolute split:top-3 split:left-4 split:right-[4.5rem] split:z-40 split:bg-transparent" : ""}`}>
            {/* Bottom-only soft shadow on panel scroll. Uses a downward
                gradient anchored to the bar so it can't bleed sideways into
                the adjacent map column the way a 4-sided box-shadow would. */}
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-full h-3 bg-gradient-to-b from-black/[0.05] to-transparent transition-opacity duration-[var(--duration-base)] ${panelScrolled && !mapExpanded ? "opacity-100" : "opacity-0"}`}
            />
            <div ref={filterScrollRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4">
              {/* City — hidden until more cities exist. Keep component intact. */}
              {false && (
                <>
                  <div className="relative shrink-0">
                    <button className={`flex items-center justify-between gap-1.5 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                      citySlug !== userCitySlug
                        ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                        : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                    }`}>
                      {cityName}
                      <ChevronDown size={10} strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                </>
              )}

              {/* Neighborhood — first; spatial filter keeps the panel in sync with where the admin is browsing */}
              {neighborhoods.length > 0 && (
                <>
                  <div ref={neighborhoodRef} className="relative shrink-0">
                    <button
                      onClick={() => setNeighborhoodOpen(!neighborhoodOpen)}
                      className={`flex items-center justify-between gap-1.5 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                        activeNeighborhood
                          ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                          : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                      }`}
                    >
                      {activeNeighborhood ?? cityName}
                      {activeNeighborhood ? (
                        <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveNeighborhood(null); setNeighborhoodOpen(false); }} />
                      ) : (
                        <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${neighborhoodOpen ? "rotate-180" : ""}`} />
                      )}
                    </button>
                  </div>
                  <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                </>
              )}

              {/* Events — body toggles eventsOnly; chevron opens type dropdown */}
              <div ref={eventTypesRef} className="relative shrink-0">
                <div
                  className={`flex items-center gap-1 px-3.5 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                    eventsOnly || activeEventTypes.size > 0
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                      : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  <button
                    onClick={() => {
                      setEventsOnly((v) => {
                        const next = !v;
                        if (next) {
                          setActiveCategory(null);
                          setActiveSubcategories(new Set());
                          setCategoryDropdown(null);
                          setActiveNeighborhood(null);
                        } else {
                          setActiveEventTypes(new Set());
                        }
                        return next;
                      });
                    }}
                    className="flex items-center gap-1"
                  >
                    Events
                    {activeEventTypes.size > 0 && <span className="text-[10px] opacity-80">({activeEventTypes.size})</span>}
                  </button>
                  {eventsOnly || activeEventTypes.size > 0 ? (
                    <button
                      onClick={() => { setEventsOnly(false); setActiveEventTypes(new Set()); setEventTypesOpen(false); }}
                      className="opacity-70 hover:opacity-100"
                      aria-label="Clear events filter"
                    >
                      <X size={12} strokeWidth={2} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setEventTypesOpen((o) => !o)}
                      aria-label="Toggle event type filter"
                    >
                      <ChevronDown
                        size={10}
                        strokeWidth={1.5}
                        className={`transition-transform ${eventTypesOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Category pills — scroll on mobile, wrap on sm+ so nothing is clipped in the split-view panel */}
              <div ref={categoryRef} className="flex gap-1.5 shrink-0">
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  const isDropdownOpen = categoryDropdown === cat;
                  return (
                    <button
                      key={cat}
                      data-category={cat}
                      onClick={(e) => {
                        if (isActive) {
                          // Already active — just toggle dropdown
                          isDropdownOpen ? setCategoryDropdown(null) : setCategoryDropdown(cat);
                          return;
                        }

                        // Disable events-only view when switching to a category
                        if (eventsOnly) setEventsOnly(false);

                        const btn = e.currentTarget;
                        const container = filterScrollRef.current;
                        const scrollToCenter = () => {
                          if (container) {
                            const btnRect = btn.getBoundingClientRect();
                            const containerRect = container.getBoundingClientRect();
                            const scrollLeft = container.scrollLeft + (btnRect.left - containerRect.left) - (containerRect.width / 2) + (btnRect.width / 2);
                            container.scrollTo({ left: scrollLeft, behavior: "smooth" });
                          }
                        };

                        if (activeCategory) {
                          // Switching filters: close dropdown, immediately switch category (no null gap)
                          setCategoryDropdown(null);
                          // Scroll new pill into view while dropdown closes
                          setTimeout(() => {
                            scrollToCenter();
                            // Switch category directly — feed updates instantly, pill transitions via CSS
                            setTimeout(() => {
                              setActiveCategory(cat);
                              setActiveSubcategories(new Set());
                              setActiveSpot(null);
                              setTimeout(() => setCategoryDropdown(cat), 200);
                            }, 250);
                          }, 150);
                        } else {
                          // Fresh selection: scroll, activate, open
                          scrollToCenter();
                          setTimeout(() => {
                            setActiveCategory(cat);
                            setActiveSubcategories(new Set());
                            setActiveSpot(null);
                            setTimeout(() => setCategoryDropdown(cat), 200);
                          }, 250);
                        }
                      }}
                      className={`flex items-center gap-1 px-3.5 py-1.5 text-sm rounded-full border whitespace-nowrap shrink-0 transition-all duration-200 ease-in-out ${
                        isActive ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white" : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                      {isActive ? (
                        <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); }} />
                      ) : (
                        <ChevronDown size={10} strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Event types dropdown — rendered outside scrollable container so it isn't clipped */}
            {eventTypesOpen && (() => {
              const btn = eventTypesRef.current;
              const bar = filterBarRef.current;
              const barWidth = bar?.getBoundingClientRect().width ?? 375;
              const dropdownWidth = 224;
              let left = btn && bar ? btn.getBoundingClientRect().left - bar.getBoundingClientRect().left : 16;
              if (left + dropdownWidth > barWidth - 8) {
                left = btn && bar ? btn.getBoundingClientRect().right - bar.getBoundingClientRect().left - dropdownWidth : left;
              }
              left = Math.max(8, left);
              // Per-type counts: number of upcoming events whose host spot
              // includes this category. Hide types with zero events.
              const typeCount = new Map<Category, number>();
              for (const e of upcomingEvents) {
                const cats = eventSpotCategories[e.spot_id];
                if (!cats) continue;
                for (const c of cats) typeCount.set(c, (typeCount.get(c) ?? 0) + 1);
              }
              const visibleTypes = CATEGORY_ORDER.filter((c) => (typeCount.get(c) ?? 0) > 0);
              return (
                <div ref={eventTypesDropdownRef} className="absolute left-0 right-0 z-50" style={{ top: "100%" }}>
                  <div className="relative" style={{ marginLeft: left }}>
                    <div className="mt-1.5 w-56 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-72 animate-[fadeSlideDown_150ms_ease-out]">
                      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                      {visibleTypes.length === 0 && (
                        <div className="px-4 py-3 text-xs text-neutral-400">No upcoming events</div>
                      )}
                      {visibleTypes.map((c) => {
                        const isActive = activeEventTypes.has(c);
                        const count = typeCount.get(c) ?? 0;
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              setActiveEventTypes((prev) => {
                                const next = new Set(prev);
                                isActive ? next.delete(c) : next.add(c);
                                return next;
                              });
                              if (!eventsOnly) {
                                setEventsOnly(true);
                                setActiveCategory(null);
                                setActiveSubcategories(new Set());
                                setCategoryDropdown(null);
                                setActiveNeighborhood(null);
                              }
                            }}
                            className={`group flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-xs transition-colors ${isActive ? "text-neutral-900 dark:text-white font-medium bg-ink-100" : "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100"}`}
                          >
                            <span className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isActive ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-600"}`}>
                                {isActive && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </span>
                              <span className="truncate">{CATEGORY_LABELS[c]}</span>
                            </span>
                            <span className="text-neutral-600 dark:text-neutral-300 shrink-0">{count}</span>
                          </button>
                        );
                      })}
                      </div>
                      {activeEventTypes.size > 0 && (
                        <div className="border-t border-neutral-100 dark:border-neutral-800">
                          <button onClick={() => { setActiveEventTypes(new Set()); setEventTypesOpen(false); }} className="block w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors">Clear filter</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Neighborhood dropdown — rendered outside scrollable container so it isn't clipped on mobile */}
            {neighborhoodOpen && (() => {
              const btn = neighborhoodRef.current;
              const bar = filterBarRef.current;
              const barWidth = bar?.getBoundingClientRect().width ?? 375;
              const dropdownWidth = 208; // w-52
              let left = btn && bar ? btn.getBoundingClientRect().left - bar.getBoundingClientRect().left : 16;
              if (left + dropdownWidth > barWidth - 8) {
                left = btn && bar ? btn.getBoundingClientRect().right - bar.getBoundingClientRect().left - dropdownWidth : left;
              }
              left = Math.max(8, left);
              return (
              <div ref={neighborhoodDropdownRef} className="absolute left-0 right-0 z-50" style={{ top: "100%" }}>
                <div className="relative" style={{ marginLeft: left }}>
                  <div className="mt-1.5 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60 animate-[fadeSlideDown_150ms_ease-out]">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                    {neighborhoods.map((n) => {
                      const count = allSpots.filter((s) => s.neighborhood === n).length;
                      return (
                        <button key={n} onClick={() => { setActiveNeighborhood(activeNeighborhood === n ? null : n); setNeighborhoodOpen(false); setEventsOnly(false); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors ${activeNeighborhood === n ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100"}`}>
                          {n}
                          <span className="text-neutral-300 dark:text-neutral-600">{count}</span>
                        </button>
                      );
                    })}
                    </div>
                    {activeNeighborhood && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800">
                        <button onClick={() => { setActiveNeighborhood(null); setNeighborhoodOpen(false); }} className="block w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors">Clear filter</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Category dropdown — rendered outside scrollable pills so it isn't clipped */}
            {categoryDropdown && (() => {
              const cat = categoryDropdown;
              // Per-subcategory spot count in this city (0 → hidden).
              const subCount = new Map<string, number>();
              for (const s of allSpots) {
                if (!s.category.includes(cat)) continue;
                for (const sc of s.subcategory ?? []) {
                  subCount.set(sc, (subCount.get(sc) ?? 0) + 1);
                }
              }
              const sortByCount = (a: string, b: string, canonical: string[]): number => {
                const diff = (subCount.get(b) ?? 0) - (subCount.get(a) ?? 0);
                if (diff !== 0) return diff;
                return canonical.indexOf(a) - canonical.indexOf(b);
              };
              // Grouped layout for categories with semantic groupings (Wellness,
              // Shops, Dining); flat for the rest.
              const groups = SUBCATEGORY_GROUPS[cat];
              const flatSubs = SUBCATEGORIES[cat].filter((s) => (subCount.get(s) ?? 0) > 0);
              const renderedGroups = groups
                ? groups
                    .map((g) => ({
                      label: g.label,
                      items: g.items.filter((s) => (subCount.get(s) ?? 0) > 0).sort((a, b) => sortByCount(a, b, g.items)),
                    }))
                    .filter((g) => g.items.length > 0)
                : null;
              const ungroupedSubs = !groups
                ? [...flatSubs].sort((a, b) => sortByCount(a, b, SUBCATEGORIES[cat]))
                : null;
              const btn = categoryRef.current?.querySelector(`[data-category="${cat}"]`) as HTMLElement | null;
              const bar = filterBarRef.current;
              const barWidth = bar?.getBoundingClientRect().width ?? 375;
              const dropdownWidth = 208; // w-52 — slightly wider to hold group labels
              let left = btn && bar ? btn.getBoundingClientRect().left - bar.getBoundingClientRect().left : 0;
              if (left + dropdownWidth > barWidth - 8) {
                left = btn && bar ? btn.getBoundingClientRect().right - bar.getBoundingClientRect().left - dropdownWidth : left;
              }
              left = Math.max(8, left);
              const renderSub = (sub: string) => {
                const isSubActive = activeSubcategories.has(sub);
                const count = subCount.get(sub) ?? 0;
                return (
                  <button key={sub} onClick={() => { setActiveSubcategories((prev) => { const next = new Set(prev); isSubActive ? next.delete(sub) : next.add(sub); return next; }); }} className={`group flex w-full items-center justify-between gap-2.5 px-4 py-2.5 text-xs transition-colors ${isSubActive ? "text-neutral-900 dark:text-white font-medium bg-ink-100" : "text-neutral-600 dark:text-neutral-400 hover:bg-ink-100"}`}>
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSubActive ? "bg-neutral-900 border-neutral-900 text-white dark:bg-white dark:border-white dark:text-neutral-900" : "border-neutral-300 dark:border-neutral-600"}`}>
                        {isSubActive && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      <span className="truncate">{sub}</span>
                    </span>
                    <span className="text-neutral-600 dark:text-neutral-300 shrink-0">{count}</span>
                  </button>
                );
              };
              return (
                <div ref={categoryDropdownRef} className="absolute left-0 right-0 z-50" style={{ top: "100%" }}>
                  <div className="relative" style={{ marginLeft: left }}>
                    <div className="mt-1.5 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-72 animate-[fadeSlideDown_150ms_ease-out]">
                      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                      {renderedGroups
                        ? renderedGroups.map((g) => (
                            <div key={g.label}>
                              <div className="px-4 pt-2 pb-1 text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                                {g.label}
                              </div>
                              {g.items.map(renderSub)}
                            </div>
                          ))
                        : ungroupedSubs?.map(renderSub)}
                      </div>
                      <div className="border-t border-neutral-100 dark:border-neutral-800">
                        <button onClick={() => { setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); }} className="block w-full text-left px-4 py-2.5 text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-ink-100 transition-colors">Clear filter</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>}

          {/* Scrollable content — hidden on mobile map view */}
          <div ref={panelRef} className={`flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-36 split:pb-0 ${mapExpanded ? "split:hidden" : ""} ${mobileView === "map" ? "hidden split:block" : ""}`}>
          {eventsOnly ? (() => {
            const matchesType = (e: typeof upcomingEvents[number]) => {
              if (activeEventTypes.size === 0) return true;
              const cats = eventSpotCategories?.[e.spot_id];
              if (!cats) return false;
              for (const c of cats) if (activeEventTypes.has(c)) return true;
              return false;
            };
            const filteredUpcoming = upcomingEvents.filter(matchesType);
            const filteredInvited = invitedEvents.filter(matchesType);
            return (
            <div className="p-4 pt-2 space-y-6">
              {filteredInvited.length > 0 && (
                <UpcomingEventsStrip
                  events={filteredInvited}
                  spotNames={eventSpotNames}
                  title="You're invited"
                />
              )}
              {filteredUpcoming.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredUpcoming.map((event) => {
                      const d = new Date(event.starts_at);
                      const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                      const day = d.getDate();
                      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      const priceLabel = event.price_cents === 0 ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`;
                      return (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="group block rounded-2xl overflow-hidden card-edge card-edge-hover"
                        >
                          <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-900 relative rounded-2xl overflow-hidden">
                            {event.cover_image_url ? (
                              <Image src={event.cover_image_url} alt={event.title} fill sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw" className="object-cover group-hover:scale-[1.02] transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl font-semibold text-neutral-300 dark:text-neutral-700">
                                {day}
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-lg px-2 pt-1.5 pb-1 flex flex-col items-center leading-none">
                              <span className="text-[9px] font-medium text-neutral-500">{month}</span>
                              <span className="text-sm font-semibold">{day}</span>
                            </div>
                          </div>
                          <div className="p-3 rounded-b-2xl bg-surface">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold line-clamp-1">{event.title}</h3>
                                {eventSpotNames[event.spot_id] && (
                                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{eventSpotNames[event.spot_id]}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-sm font-semibold">{priceLabel}</div>
                                <div className="text-xs text-neutral-500 mt-0.5">{time}</div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="px-6 pt-4 pb-10 text-center">
                  {/* Watercolor illustration — same composition / mask as the
                      "No spaces in this area" state so the two empty states
                      feel cohesive across the Events and Spaces filters. */}
                  <div className="mx-auto mb-6 w-full max-w-[480px] aspect-[16/9] relative">
                    <Image
                      src="/empty-states/events-nullstate.png"
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes="480px"
                      className="object-contain select-none pointer-events-none dark:opacity-40 dark:mix-blend-screen"
                      style={{
                        WebkitMaskImage:
                          "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                        maskImage:
                          "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                      }}
                    />
                  </div>
                  <h3 className="text-base font-medium">No upcoming events</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                    {activeEventTypes.size > 0
                      ? `No events match the selected types in ${cityName}.`
                      : `Nothing on the calendar in ${cityName} yet.`}
                  </p>
                  <div className="mt-6">
                    <Button onClick={() => { setEventsOnly(false); setActiveEventTypes(new Set()); setEventTypesOpen(false); }}>Clear filters</Button>
                  </div>
                </div>
              )}
            </div>
            );
          })() : allSpots.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#eceae2] dark:bg-[#0e0d07]">
                <MapPin size={20} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
              </div>
              <h3 className="text-base font-medium">No spaces yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                We&apos;re curating the best spaces in {cityName}.<br />Know a place that belongs here?
              </p>
              <ButtonLink href="/recommend/new" variant="secondary" className="mt-4">
                Recommend a space
              </ButtonLink>
            </div>
          ) : !hydrated ? (
            // Pre-commit window: map hasn't emitted its first viewport yet.
            // Render a skeleton grid so we never flash alphabetical content.
            <div className="p-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 split:grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-6 split:gap-x-3 split:gap-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800"
                  >
                    <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
                    <div className="p-3">
                      <div className="h-3 w-2/3 rounded bg-neutral-100 dark:bg-neutral-900 animate-pulse" />
                      <div className="h-2 w-1/2 rounded bg-neutral-100 dark:bg-neutral-900 mt-2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : filteredRaw.length === 0 ? (
            <div className="px-6 pt-4 pb-10 text-center">
              <div className="mx-auto mb-6 w-full max-w-[480px] aspect-[16/9] relative">
                <Image
                  src="/empty-states/nofilter-nullstate.png"
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="480px"
                  // Source PNG ships with a solid sky-blue field; `multiply`
                  // lets the cream surface punch through the lighter wash so
                  // only the ink details read. Dark mode flips to `screen`
                  // against the near-black surface for the same effect.
                  className="object-contain select-none pointer-events-none opacity-80 mix-blend-multiply dark:opacity-40 dark:mix-blend-screen"
                  style={{
                    WebkitMaskImage:
                      "radial-gradient(ellipse at center, black 25%, transparent 72%)",
                    maskImage:
                      "radial-gradient(ellipse at center, black 25%, transparent 72%)",
                  }}
                />
              </div>
              <h3 className="text-base font-medium">No spaces match</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                Nothing in {cityName} fits this combination.
              </p>
              <div className="mt-6">
                <Button onClick={clearAll}>Clear filters</Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            // Filters match real spots, but none of them are in the current
            // viewport. Show "Nearby" fallback (Airbnb's NEARBY mode).
            <div className="p-4 pt-2">
              <div className="px-6 pt-4 pb-10 text-center">
                {/* Cityscape watercolor faded into the page. Masked with a
                    radial gradient so the edges dissolve into the surface
                    rather than sitting as a hard-edged rectangle. Decorative
                    only — the text below carries the meaning. Served through
                    next/image so the 2MB PNG source ships as a right-sized
                    WebP/AVIF on mobile. */}
                <div className="mx-auto mb-6 w-full max-w-[480px] aspect-[16/9] relative">
                  <Image
                    src="/empty-states/nospaces-nullstate.png"
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="480px"
                    className="object-contain select-none pointer-events-none dark:opacity-40 dark:mix-blend-screen"
                    style={{
                      WebkitMaskImage:
                        "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                      maskImage:
                        "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                    }}
                  />
                </div>
                <h3 className="text-base font-medium">No spaces in this area</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                  Pan or zoom the map, or try one of these nearby.
                </p>
              </div>
              {nearby.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-2 mb-2">
                    Nearby spaces
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 split:grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-6 split:gap-x-3 split:gap-y-4">
                    {nearby.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/${citySlug}/${spot.id}`}
                        className="cursor-pointer group block rounded-2xl overflow-hidden card-edge card-edge-hover"
                        onMouseEnter={() => focusOnNearby(spot)}
                        onMouseLeave={() => setActiveSpot(null)}
                      >
                        <ImageCarousel
                          images={spot.images}
                          alt={spot.name}
                          aspectClassName="aspect-[16/10]"
                          roundedClassName="rounded-2xl"
                        />
                        <div className="p-3 rounded-b-2xl bg-surface">
                          <h3 className="text-sm font-semibold line-clamp-1">{spot.name}</h3>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                            {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 split:grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-6 split:gap-x-3 split:gap-y-4">
                <AnimatePresence mode="popLayout">
                {visibleSpots.map((spot, i) => (
                  <motion.div
                    key={spot.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    // Softer entrance: smaller y-travel and the "polished settle"
                    // curve (easeOutQuart-ish) — lands smoothly instead of snapping
                    // into place. Stagger capped so the last card isn't waiting.
                    transition={{ duration: 0.45, delay: Math.min(i, 5) * 0.05, ease: [0.22, 1, 0.36, 1] }}
                    className="cursor-pointer group block rounded-2xl overflow-hidden card-edge card-edge-hover relative"
                    onMouseEnter={() => setHoveredSpotId(spot.id)}
                    onMouseLeave={() => setHoveredSpotId((prev) => (prev === spot.id ? null : prev))}
                  >
                    <Link href={`/${citySlug}/${spot.id}`} className="block">
                      <ImageCarousel
                        images={spot.images}
                        alt={spot.name}
                        aspectClassName="aspect-[16/10]"
                        roundedClassName="rounded-2xl"
                        priority={i < 6}
                        sizes="(min-width: 1024px) 40vw, (min-width: 640px) 50vw, 100vw"
                      />
                      <div className="p-3 pr-12 rounded-b-2xl bg-surface">
                        <h3 className="text-sm font-semibold line-clamp-1">{spot.name}</h3>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </p>
                      </div>
                    </Link>
                    {/* Top-left badge overlay on the image. pointer-events-none
                        so it doesn't steal the card's Link click. */}
                    <div className="absolute top-2 left-3 z-10 pointer-events-none">
                      <NewBadge spot={spot} />
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
              </div>
              {visibleCount < filtered.length && (
                <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
              )}
            </div>
          )}
          </div>
        </div>

        {/* Map — right */}
        <div className={`split:flex-1 split:min-w-0 split:block relative px-4 ${mapExpanded ? "" : "split:pl-0"} split:pr-4 split:pt-1.5 split:pb-4 ${mobileView === "map" ? "pb-2.5" : "hidden"}`}>
          <div
            className="w-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative split:h-full"
            style={mapHeight && mobileView === "map" ? { height: mapHeight } : undefined}
          >
            {mapMounted && (
              <SpotMap
                spots={filteredRaw}
                activeSpot={activeSpot}
                onSpotSelect={handleSpotSelect}
                onViewChange={handleViewChange}
                focusSpot={focusSpot}
                focusToken={focusToken}
                hoverSpotId={hoveredSpotId}
                initialView={
                  initialViewport
                    ? { center: initialViewport.center, zoom: initialViewport.zoom }
                    : undefined
                }
              />
            )}

            {/* Expand / collapse side panel — desktop only. Shares the center
                button's translucent pill style. */}
            <button
              type="button"
              onClick={() => setMapExpanded((v) => !v)}
              aria-label={mapExpanded ? "Show list" : "Hide list"}
              className="hidden split:flex absolute top-3 right-3 z-20 w-8 h-8 rounded-[10px] bg-white/40 dark:bg-neutral-900/40 backdrop-blur-sm border border-neutral-200 dark:border-neutral-700 shadow-sm items-center justify-center hover:bg-white/70 dark:hover:bg-neutral-900/70 transition-colors"
            >
              {mapExpanded ? (
                <Minimize2 size={14} strokeWidth={1.75} className="text-neutral-900 dark:text-white" />
              ) : (
                <Maximize2 size={14} strokeWidth={1.75} className="text-neutral-900 dark:text-white" />
              )}
            </button>


            {/* Map card */}
            {activeSpot && (
              <div className="absolute bottom-3 left-3 right-3 split:left-auto split:right-3 split:w-80 z-10">
                <div
                  className="bg-surface rounded-3xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
                  style={{ animation: "map-card-in 0.2s ease-out" }}
                >
                  <div className="flex gap-3 p-3">
                    {activeSpot.images[0] && (
                      <Link
                        href={`/${citySlug}/${activeSpot.id}`}
                        onClick={() => setActiveSpot(null)}
                        className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800"
                      >
                        <Image src={activeSpot.images[0]} alt={activeSpot.name} width={80} height={80} sizes="80px" className="w-full h-full object-cover" />
                      </Link>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <Link
                        href={`/${citySlug}/${activeSpot.id}`}
                        onClick={() => setActiveSpot(null)}
                        className="min-w-0"
                      >
                        <h3 className="text-sm font-medium truncate">{activeSpot.name}</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">
                          {activeSpot.neighborhood} · {activeSpot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </p>
                      </Link>
                      <div className="flex items-center -space-x-1 mt-1 -ml-2">
                        <WishlistButton
                          spotId={activeSpot.id}
                          initialWishlisted={wishlistedSet.has(activeSpot.id)}
                          size="icon"
                        />
                        <FavoriteButton
                          spotId={activeSpot.id}
                          initialFavorited={favoritedSet.has(activeSpot.id)}
                          size="icon"
                        />
                        <CheckInButton
                          spotId={activeSpot.id}
                          spotName={activeSpot.name}
                          variant="icon"
                          initialChecked={checkedInSet.has(activeSpot.id)}
                          initialWishlisted={wishlistedSet.has(activeSpot.id)}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveSpot(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <style>{`
            @keyframes map-card-in {
              from { transform: translateY(16px); opacity: 0; }
              to { transform: translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      </motion.div>

      {/* Mobile bottom bar */}
      <div ref={bottomBarRef} className="split:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <div ref={mobileSearchWrapRef} className="flex-1 relative">
            <Search
              size={15}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 pointer-events-none"
            />
            <input
              ref={mobileSearchInputRef}
              type="text"
              value={mobileSearchQuery}
              onChange={(e) => {
                setMobileSearchQuery(e.target.value);
                if (!mobileSearchOpen) setMobileSearchOpen(true);
              }}
              onFocus={() => setMobileSearchOpen(true)}
              placeholder="Search for spaces and members"
              className={`w-full h-10 pl-9 pr-3 leading-10 text-sm border border-neutral-200 dark:border-neutral-800 rounded-full text-neutral-900 dark:text-white placeholder-neutral-500 dark:placeholder-neutral-400 caret-brand-500 outline-none transition-[background-color,box-shadow] ${
                mobileSearchOpen
                  ? "bg-[var(--color-surface)] shadow-[0_8px_24px_-8px_rgba(0,0,0,0.22)] dark:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.55)]"
                  : "bg-transparent"
              }`}
            />
            <CommandMenu
              open={mobileSearchOpen}
              onClose={() => setMobileSearchOpen(false)}
              query={mobileSearchQuery}
              setQuery={setMobileSearchQuery}
              placement="above"
            />
          </div>
          <button
            onClick={() => {
              setMapMounted(true);
              setMobileView(mobileView === "list" ? "map" : "list");
            }}
            className="flex items-center justify-center w-[70px] h-10 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-400 text-sm font-medium rounded-full shrink-0 transition-colors"
          >
            {mobileView === "list" ? "Map" : "List"}
          </button>
        </div>
      </div>
    </div>
  );
}
