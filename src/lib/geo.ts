/**
 * Tiny geo helpers shared by `Map.tsx` (marker ranking) and
 * `CityClient.tsx` (viewport-scoped side panel list).
 *
 * Everything here treats lng/lat as planar — no haversine, no geodesic
 * math. Good enough at single-city zoom levels, cheap enough to run
 * every moveend.
 */

export type LngLat = [number, number]; // [lng, lat]
export type LngLatBounds = [LngLat, LngLat]; // [[swLng, swLat], [neLng, neLat]]

/**
 * Squared Euclidean distance between two lng/lat points. Used for
 * ranking — the actual metric value is meaningless, only the ordering
 * matters, so we skip the `Math.sqrt` call.
 */
export function squaredDistance(a: LngLat, b: LngLat): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

/**
 * Is the given point inside the axis-aligned lng/lat bounding box?
 * Bounds are expected in SW → NE order (Mapbox's native shape after
 * `map.getBounds()` gets unpacked).
 */
export function isLngLatInBounds(p: LngLat, b: LngLatBounds): boolean {
  const [[swLng, swLat], [neLng, neLat]] = b;
  return p[0] >= swLng && p[0] <= neLng && p[1] >= swLat && p[1] <= neLat;
}

/**
 * Midpoint of a bounding box. Used when the URL contains bounds but
 * we want to derive a "center" for distance ranking without adding a
 * fourth URL param.
 */
export function boundsCenter(b: LngLatBounds): LngLat {
  const [[swLng, swLat], [neLng, neLat]] = b;
  return [(swLng + neLng) / 2, (swLat + neLat) / 2];
}

/**
 * Inflate a bounding box outward by `pct` of its width/height. Used by the
 * side panel filter so spots that are visually inside the map view aren't
 * excluded by:
 *   - 4-decimal URL rounding (~11m per axis)
 *   - the spider-offset Map.tsx applies to colliding markers
 *   - mapbox projection / round-corner clipping at the canvas edges
 *
 * 5% is generous enough to swallow all of those edge cases without pulling
 * in genuinely off-screen spots.
 */
export function inflateBounds(b: LngLatBounds, pct: number): LngLatBounds {
  const [[swLng, swLat], [neLng, neLat]] = b;
  const dLng = (neLng - swLng) * pct;
  const dLat = (neLat - swLat) * pct;
  return [
    [swLng - dLng, swLat - dLat],
    [neLng + dLng, neLat + dLat],
  ];
}
