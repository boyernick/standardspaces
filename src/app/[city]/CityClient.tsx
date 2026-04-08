"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, Category, Spot, EventRecord } from "@/lib/types";
import UpcomingEventsStrip from "@/components/UpcomingEventsStrip";
import dynamic from "next/dynamic";
const SpotMap = dynamic(() => import("@/components/Map"), { ssr: false });
import ImageCarousel from "@/components/ImageCarousel";
import Navbar from "@/components/Navbar";
import CheckInButton from "@/components/CheckInButton";
import FavoriteButton from "@/components/FavoriteButton";
import WishlistButton from "@/components/WishlistButton";
import { ChevronDown, ChevronLeft, ChevronRight, Map as MapIcon, List, X, MapPin, Search } from "lucide-react";
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
}

export default function CityClient({ spots: allSpots, favoritedSpotIds = [], wishlistedSpotIds = [], checkedInSpotIds = [], cityName, citySlug, userCitySlug, upcomingEvents = [], invitedEvents = [], eventSpotNames = {} }: CityClientProps) {
  const favoritedSet = useMemo(() => new Set(favoritedSpotIds), [favoritedSpotIds]);
  const wishlistedSet = useMemo(() => new Set(wishlistedSpotIds), [wishlistedSpotIds]);
  const checkedInSet = useMemo(() => new Set(checkedInSpotIds), [checkedInSpotIds]);
  const activeCategories = useMemo(() => new Set(allSpots.flatMap((s) => s.category)), [allSpots]);
  const categories = useMemo(() => CATEGORY_ORDER.filter((c) => activeCategories.has(c)), [activeCategories]);
  const neighborhoods = useMemo(() => [...new Set(allSpots.map((s) => s.neighborhood))].sort(), [allSpots]);

  const [eventsOnly, setEventsOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [activeSubcategories, setActiveSubcategories] = useState<Set<string>>(new Set());
  const [categoryDropdown, setCategoryDropdown] = useState<Category | null>(null);
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [activeSpot, setActiveSpot] = useState<Spot | null>(null);
  const [neighborhoodOpen, setNeighborhoodOpen] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");

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
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get("page"));
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const perPage = 6;

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

  // Sync page to URL whenever it changes. Use `history.replaceState` rather
  // than `router.replace` for the same reason as the viewport sync below: a
  // router replace on a dynamic route refetches the server component, which
  // bumps the `spots` prop reference and re-runs Map.tsx's fitBounds effect —
  // which would yank the user's pan/zoom back out every time they paginate.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const current = Number(params.get("page")) || 1;
    if (current === page) return;
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  }, [page, pathname]);

  const neighborhoodRef = useRef<HTMLDivElement>(null);
  const neighborhoodDropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const bottomBarRef = useRef<HTMLDivElement>(null);
  const [mapHeight, setMapHeight] = useState<number | null>(null);

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

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

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
    if (!committedBounds || !committedCenter) {
      return {
        filtered: [] as Spot[],
        nearby: [] as Spot[],
        hydrated: false,
      };
    }
    // Strict viewport scoping — the panel should mirror exactly what's
    // visible on the map, no padding, no fudge factor.
    const inside = filteredRaw
      .filter((s) => isLngLatInBounds([s.lng, s.lat], committedBounds))
      .sort(
        (a, b) =>
          squaredDistance([a.lng, a.lat], committedCenter) -
          squaredDistance([b.lng, b.lat], committedCenter),
      );
    if (inside.length > 0) {
      return { filtered: inside, nearby: [] as Spot[], hydrated: true };
    }
    const fallback = [...filteredRaw]
      .sort(
        (a, b) =>
          squaredDistance([a.lng, a.lat], committedCenter) -
          squaredDistance([b.lng, b.lat], committedCenter),
      )
      .slice(0, 6);
    return { filtered: [] as Spot[], nearby: fallback, hydrated: true };
  }, [filteredRaw, committedBounds, committedCenter]);


  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages, setPage]);
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * perPage, safePage * perPage);

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
    setPage(1);
  };

  const hasFilters = activeCategory || activeNeighborhood;

  return (
    <div className="h-[100dvh] flex flex-col bg-surface">
      <Navbar />

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="flex-1 min-h-0 flex flex-col md:flex-row"
      >
        {/* Panel — left */}
        <div className={`w-full md:w-[55%] lg:w-1/2 md:min-w-[420px] md:flex md:flex-col md:shrink-0 ${mobileView === "list" ? "flex flex-col flex-1 min-h-0" : "flex flex-col md:flex"}`}>
          {/* Filters bar */}
          {allSpots.length > 0 && <div ref={filterBarRef} className="relative z-20 bg-surface py-2.5 shrink-0 md:overflow-x-clip">
            <div ref={filterScrollRef} className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-4">
              {/* City */}
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

              {/* Neighborhood */}
              <div ref={neighborhoodRef} className="relative shrink-0">
                <button
                  onClick={() => setNeighborhoodOpen(!neighborhoodOpen)}
                  className={`flex items-center justify-between gap-1.5 px-3.5 py-1.5 text-sm rounded-full border transition-colors whitespace-nowrap ${
                    activeNeighborhood
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                      : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  {activeNeighborhood ?? "Neighborhood"}
                  {activeNeighborhood ? (
                    <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveNeighborhood(null); setNeighborhoodOpen(false); setPage(1); }} />
                  ) : (
                    <ChevronDown size={10} strokeWidth={1.5} className={`transition-transform ${neighborhoodOpen ? "rotate-180" : ""}`} />
                  )}
                </button>
              </div>

              <div className="w-px h-5 bg-neutral-200 dark:bg-neutral-700 shrink-0" />

              {/* Category pills — scrollable, dropdowns rendered outside */}
              <div ref={categoryRef} className="flex gap-1.5 md:overflow-x-auto scrollbar-hide shrink-0">
                <button
                  onClick={() => {
                    setEventsOnly((v) => {
                      const next = !v;
                      if (next) {
                        setActiveCategory(null);
                        setActiveSubcategories(new Set());
                        setCategoryDropdown(null);
                        setActiveNeighborhood(null);
                      }
                      return next;
                    });
                    setPage(1);
                  }}
                  className={`flex items-center gap-1 px-3.5 py-1.5 text-sm rounded-full border whitespace-nowrap shrink-0 transition-colors ${
                    eventsOnly
                      ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                      : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  Events
                  {eventsOnly && (
                    <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setEventsOnly(false); }} />
                  )}
                </button>
                {categories.map((cat) => {
                  const isActive = activeCategory === cat;
                  const isDropdownOpen = categoryDropdown === cat;
                  const activeSubCount = isActive ? activeSubcategories.size : 0;
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
                              setPage(1);
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
                            setPage(1);
                            setTimeout(() => setCategoryDropdown(cat), 200);
                          }, 250);
                        }
                      }}
                      className={`flex items-center gap-1 px-3.5 py-1.5 text-sm rounded-full border whitespace-nowrap shrink-0 transition-all duration-200 ease-in-out ${
                        isActive ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white" : "bg-surface text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                      {activeSubCount > 0 && <span className="text-[10px] opacity-70">({activeSubCount})</span>}
                      {isActive ? (
                        <X size={12} strokeWidth={2} className="opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); setPage(1); }} />
                      ) : (
                        <ChevronDown size={10} strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
                  <div className="mt-1.5 w-52 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto scrollbar-hide animate-[fadeSlideDown_150ms_ease-out]">
                    <button onClick={() => { setActiveNeighborhood(null); setNeighborhoodOpen(false); setPage(1); }} className={`block w-full text-left px-4 py-2.5 text-xs transition-colors ${!activeNeighborhood ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                      All neighborhoods
                    </button>
                    {neighborhoods.map((n) => {
                      const count = allSpots.filter((s) => s.neighborhood === n).length;
                      return (
                        <button key={n} onClick={() => { setActiveNeighborhood(activeNeighborhood === n ? null : n); setNeighborhoodOpen(false); setPage(1); setEventsOnly(false); }} className={`flex w-full items-center justify-between px-4 py-2.5 text-xs transition-colors ${activeNeighborhood === n ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                          {n}
                          <span className="text-neutral-300 dark:text-neutral-600">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              );
            })()}

            {/* Category dropdown — rendered outside scrollable pills so it isn't clipped */}
            {categoryDropdown && (() => {
              const cat = categoryDropdown;
              const subs = SUBCATEGORIES[cat].filter((sub) =>
                allSpots.some((s) => s.category.includes(cat) && s.subcategory?.includes(sub))
              );
              const activeSubCount = activeCategory === cat ? activeSubcategories.size : 0;
              const btn = categoryRef.current?.querySelector(`[data-category="${cat}"]`) as HTMLElement | null;
              const bar = filterBarRef.current;
              const barWidth = bar?.getBoundingClientRect().width ?? 375;
              const dropdownWidth = 192; // w-48
              let left = btn && bar ? btn.getBoundingClientRect().left - bar.getBoundingClientRect().left : 0;
              // If dropdown overflows right, align right edge to pill's right edge
              if (left + dropdownWidth > barWidth - 8) {
                left = btn && bar ? btn.getBoundingClientRect().right - bar.getBoundingClientRect().left - dropdownWidth : left;
              }
              left = Math.max(8, left);
              return (
                <div ref={categoryDropdownRef} className="absolute left-0 right-0 z-50" style={{ top: "100%" }}>
                  <div className="relative" style={{ marginLeft: left }}>
                    <div className="mt-1.5 w-48 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto scrollbar-hide animate-[fadeSlideDown_150ms_ease-out]">
                      <button onClick={() => { setActiveSubcategories(new Set()); setPage(1); }} className={`block w-full text-left px-4 py-2 text-xs transition-colors ${activeSubCount === 0 ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                        All {CATEGORY_LABELS[cat]}
                      </button>
                      {subs.map((sub) => {
                        const isSubActive = activeSubcategories.has(sub);
                        return (
                          <button key={sub} onClick={() => { setActiveSubcategories((prev) => { const next = new Set(prev); isSubActive ? next.delete(sub) : next.add(sub); return next; }); setPage(1); }} className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition-colors ${isSubActive ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSubActive ? "bg-brand-500 border-brand-500" : "border-neutral-300 dark:border-neutral-600"}`}>
                              {isSubActive && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                            </span>
                            {sub}
                          </button>
                        );
                      })}
                      <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                        <button onClick={() => { setActiveCategory(null); setActiveSubcategories(new Set()); setCategoryDropdown(null); setPage(1); }} className="block w-full text-left px-4 py-2 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Clear filter</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>}

          {/* Scrollable content — hidden on mobile map view */}
          <div ref={panelRef} className={`flex-1 min-h-0 overflow-y-auto scrollbar-hide pb-36 md:pb-0 ${mobileView === "map" ? "hidden md:block" : ""}`}>
          {eventsOnly ? (
            <div className="p-4 pt-2 space-y-6">
              {invitedEvents.length > 0 && (
                <UpcomingEventsStrip
                  events={invitedEvents}
                  spotNames={eventSpotNames}
                  title="You're invited"
                />
              )}
              {upcomingEvents.length > 0 ? (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {upcomingEvents.map((event) => {
                      const d = new Date(event.starts_at);
                      const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                      const day = d.getDate();
                      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
                      const priceLabel = event.price_cents === 0 ? "Free" : `$${(event.price_cents / 100).toFixed(0)}`;
                      return (
                        <Link
                          key={event.id}
                          href={`/events/${event.id}`}
                          className="group block rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
                        >
                          <div className="aspect-[16/10] bg-neutral-100 dark:bg-neutral-900 relative rounded-2xl overflow-hidden">
                            {event.cover_image_url ? (
                              <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl font-semibold text-neutral-300 dark:text-neutral-700">
                                {day}
                              </div>
                            )}
                            <div className="absolute top-2 left-2 bg-white/95 dark:bg-neutral-900/95 backdrop-blur rounded-lg px-2 py-1 flex flex-col items-center leading-none">
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
                <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-12">
                  No upcoming events in {cityName} yet.
                </p>
              )}
            </div>
          ) : allSpots.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                <MapPin size={20} strokeWidth={1.5} className="text-neutral-400 dark:text-neutral-500" />
              </div>
              <h3 className="text-base font-medium">No spaces yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                We&apos;re curating the best spaces in {cityName}.<br />Know a place that belongs here?
              </p>
              <Link href="/recommend" className="inline-block mt-4 text-sm font-medium text-brand-500 hover:underline">
                Recommend a space
              </Link>
            </div>
          ) : !hydrated ? (
            // Pre-commit window: map hasn't emitted its first viewport yet.
            // Render a skeleton grid so we never flash alphabetical content.
            <div className="p-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6 md:gap-x-3 md:gap-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
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
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-neutral-400 dark:text-neutral-500">No spaces match your filters</p>
              <button onClick={clearAll} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white mt-2 transition-colors">Clear filters</button>
            </div>
          ) : filtered.length === 0 ? (
            // Filters match real spots, but none of them are in the current
            // viewport. Show "Nearby" fallback (Airbnb's NEARBY mode).
            <div className="p-4 pt-2">
              <div className="px-2 py-6 text-center">
                <h3 className="text-base font-medium" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
                  No spaces in this area
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
                  Pan or zoom the map, or try one of these nearby.
                </p>
              </div>
              {nearby.length > 0 && (
                <>
                  <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-2 mb-2">
                    Nearby spaces
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6 md:gap-x-3 md:gap-y-4">
                    {nearby.map((spot) => (
                      <Link
                        key={spot.id}
                        href={`/${citySlug}/${spot.id}`}
                        className="cursor-pointer group block rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-6 md:gap-x-3 md:gap-y-4">
                <AnimatePresence mode="popLayout">
                {paginated.map((spot, i) => {
                  // Temporary: highlight Mary Lou's with a "New" badge.
                  // Case-insensitive match handles the curly apostrophe.
                  const isMaryLous = spot.name.toLowerCase().includes("mary lou");
                  return (
                  <motion.div
                    key={spot.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, delay: i * 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                    className="cursor-pointer group block rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors relative"
                    onMouseEnter={() => setActiveSpot(spot)}
                    onMouseLeave={() => setActiveSpot(null)}
                  >
                    <Link href={`/${citySlug}/${spot.id}`} className="block">
                      <ImageCarousel
                        images={spot.images}
                        alt={spot.name}
                        aspectClassName="aspect-[16/10]"
                        roundedClassName="rounded-2xl"
                      />
                      <div className="p-3 rounded-b-2xl bg-surface">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold line-clamp-1">{spot.name}</h3>
                          {isMaryLous && (
                            <span className="shrink-0 px-2 py-0.5 text-[10px] font-semibold rounded-full border border-brand-500 text-brand-500">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                          {spot.neighborhood} · {spot.category.map((c) => CATEGORY_LABELS[c]).join(" · ")}
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                  );
                })}
                </AnimatePresence>
              </div>
            </div>
          )}
          </div>

          {/* Pagination — pinned to the bottom of the panel column instead of
              living inside the scrollable area, so it stays put as the user
              scrolls cards. Only shown in the regular list state, never on
              the events / empty / skeleton / nearby branches. */}
          {!eventsOnly && hydrated && filtered.length > 0 && totalPages > 1 && (
            <div className={`shrink-0 bg-surface px-4 py-3 ${mobileView === "map" ? "hidden md:block" : ""}`}>
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default transition-colors">
                  <ChevronLeft size={12} strokeWidth={1.5} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${p === page ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>{p}</button>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-neutral-500 hover:border-neutral-400 disabled:opacity-30 disabled:cursor-default transition-colors">
                  <ChevronRight size={12} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Map — right */}
        <div className={`md:flex-1 md:min-w-0 md:block relative px-4 md:pl-0 md:pr-4 md:pt-1.5 md:pb-4 ${mobileView === "map" ? "pb-2.5" : "hidden"}`}>
          <div
            className="w-full rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 relative md:h-full"
            style={mapHeight && mobileView === "map" ? { height: mapHeight } : undefined}
          >
            <SpotMap
              spots={filteredRaw}
              activeSpot={activeSpot}
              onSpotSelect={handleSpotSelect}
              onViewChange={handleViewChange}
              focusSpot={focusSpot}
              focusToken={focusToken}
              initialView={
                initialViewport
                  ? { center: initialViewport.center, zoom: initialViewport.zoom }
                  : undefined
              }
            />


            {/* Map card */}
            {activeSpot && (
              <div className="absolute bottom-3 left-3 right-3 md:left-auto md:right-3 md:w-80 z-10">
                <div
                  className="bg-surface rounded-2xl shadow-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden"
                  style={{ animation: "map-card-in 0.2s ease-out" }}
                >
                  <div className="flex gap-3 p-3">
                    {activeSpot.images[0] && (
                      <Link
                        href={`/${citySlug}/${activeSpot.id}`}
                        onClick={() => setActiveSpot(null)}
                        className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-neutral-100 dark:bg-neutral-800"
                      >
                        <img src={activeSpot.images[0]} alt={activeSpot.name} loading="lazy" className="w-full h-full object-cover" />
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
                        <FavoriteButton
                          spotId={activeSpot.id}
                          initialFavorited={favoritedSet.has(activeSpot.id)}
                          size="icon"
                        />
                        <CheckInButton
                          spotId={activeSpot.id}
                          variant="icon"
                          initialChecked={checkedInSet.has(activeSpot.id)}
                          initialWishlisted={wishlistedSet.has(activeSpot.id)}
                        />
                        <WishlistButton
                          spotId={activeSpot.id}
                          initialWishlisted={wishlistedSet.has(activeSpot.id)}
                          size="icon"
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
      <div ref={bottomBarRef} className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-neutral-200 dark:border-neutral-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="flex-1 flex items-center gap-2 px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-full text-neutral-400 dark:text-neutral-500"
          >
            <Search size={15} strokeWidth={2} />
            Search
          </button>
          <button
            onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
            className="flex items-center justify-center w-[70px] py-2.5 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 text-neutral-600 dark:text-neutral-400 text-sm font-medium rounded-full shrink-0 transition-colors"
          >
            {mobileView === "list" ? "Map" : "List"}
          </button>
        </div>
      </div>
    </div>
  );
}
