// One-off audit: re-geocode every spot's stored address via Google and
// report drift vs the lat/lng currently in the database. Run with:
//   node --env-file=.env.local scripts/audit-coords.mjs
//
// The script only reads — it prints a JSON report and SQL UPDATE statements
// for any row drifted > 40m so we can apply them manually.

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY");
  process.exit(1);
}

// Haversine distance in meters.
function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const h = s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function geocode(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const d = await res.json();
  const r = d.results?.[0];
  const loc = r?.geometry?.location;
  if (typeof loc?.lat !== "number" || typeof loc?.lng !== "number") {
    return { status: d.status, error: true };
  }
  return {
    status: d.status,
    lat: loc.lat,
    lng: loc.lng,
    formatted: r.formatted_address,
    locationType: r.geometry?.location_type, // ROOFTOP / RANGE_INTERPOLATED / etc.
  };
}

const spots = JSON.parse(process.argv[2]);
const THRESHOLD_M = 40;

const drifted = [];
const failures = [];
const clean = [];

for (const s of spots) {
  const g = await geocode(s.address);
  if (!g || g.error) {
    failures.push({ ...s, status: g?.status ?? "network_error" });
    continue;
  }
  const drift = metersBetween(
    { lat: s.lat, lng: s.lng },
    { lat: g.lat, lng: g.lng },
  );
  const rec = {
    id: s.id,
    name: s.name,
    address: s.address,
    from: { lat: s.lat, lng: s.lng },
    to: { lat: g.lat, lng: g.lng },
    formatted: g.formatted,
    locationType: g.locationType,
    drift_m: Math.round(drift),
  };
  if (drift > THRESHOLD_M) drifted.push(rec);
  else clean.push(rec);
}

console.log("=== DRIFTED (> " + THRESHOLD_M + "m) ===");
drifted.sort((a, b) => b.drift_m - a.drift_m);
for (const r of drifted) {
  console.log(
    `${String(r.drift_m).padStart(5)}m  [${r.locationType}]  ${r.name}  (${r.id})`,
  );
  console.log(`        addr: ${r.address}`);
  console.log(`        from: ${r.from.lat}, ${r.from.lng}`);
  console.log(`        to:   ${r.to.lat}, ${r.to.lng}  (${r.formatted})`);
}

console.log("\n=== FAILURES ===");
for (const r of failures) {
  console.log(`  ${r.name} (${r.id}): ${r.status} — ${r.address}`);
}

console.log(
  `\n=== SUMMARY ===\nclean: ${clean.length}   drifted: ${drifted.length}   failed: ${failures.length}`,
);

console.log("\n=== SQL ===");
for (const r of drifted) {
  console.log(
    `update public.spots set lat = ${r.to.lat}, lng = ${r.to.lng} where id = '${r.id}'; -- ${r.name} (${r.drift_m}m)`,
  );
}
