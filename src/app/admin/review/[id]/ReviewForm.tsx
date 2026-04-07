"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, VIBES, Category } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { ChevronDown, Loader2, CheckCircle, X, Plus, GripVertical, Upload, Trash2, Eye } from "lucide-react";
import Lightbox from "@/components/Lightbox";

// --- Constants ---

const MIAMI_NEIGHBORHOODS = [
  "Aventura", "Bal Harbour", "Bay Harbor Islands", "Brickell", "Coconut Grove",
  "Coral Gables", "Design District", "Downtown", "Edgewater", "Fisher Island",
  "Key Biscayne", "Little Haiti", "Little Havana", "Miami Beach", "Miami Shores",
  "Midtown", "North Beach", "South Beach", "Surfside", "Sunny Isles Beach",
  "Upper East Side", "Wynwood",
];

const CITIES = ["Miami"];

const DRESS_CODES = [
  "Casual",
  "Smart casual",
  "Business casual",
  "Upscale",
  "Formal",
  "Resort chic",
  "No dress code",
];

const PARKING_OPTIONS = [
  "Valet",
  "Valet & self-park",
  "Street parking",
  "Parking garage",
  "Parking lot",
  "Limited street parking",
  "No dedicated parking",
];

const PRICE_RANGES = ["$", "$$", "$$$", "$$$$"];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

interface TimeBlock {
  open: string;
  close: string;
}

interface DayHours {
  closed: boolean;
  blocks: TimeBlock[];
}

function parseHoursString(str: string): Record<string, DayHours> {
  const defaults: Record<string, DayHours> = {};
  for (const d of DAYS) {
    defaults[d] = { closed: false, blocks: [{ open: "11:00", close: "23:00" }] };
  }
  if (str && str.trim()) {
    const timeMatch = str.match(/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i);
    if (timeMatch) {
      const block = { open: to24(timeMatch[1]), close: to24(timeMatch[2]) };
      for (const d of DAYS) {
        defaults[d] = { closed: false, blocks: [block] };
      }
    }
  }
  return defaults;
}

function to24(t: string): string {
  t = t.trim().toUpperCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!m) return "12:00";
  let h = parseInt(m[1]);
  const min = m[2] || "00";
  const ampm = m[3];
  if (ampm === "PM" && h < 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${min}`;
}

function fmtBlocks(blocks: TimeBlock[]): string {
  return blocks.map((b) => `${fmt(b.open)}–${fmt(b.close)}`).join(", ");
}

function blocksEqual(a: TimeBlock[], b: TimeBlock[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((ab, i) => ab.open === b[i].open && ab.close === b[i].close);
}

function hoursToString(hours: Record<string, DayHours>): string {
  const entries = DAYS.map((d) => ({ day: d, ...hours[d] }));
  const openDays = entries.filter((e) => !e.closed);
  if (openDays.length === 0) return "Closed";
  const allSame = openDays.every((d) => blocksEqual(d.blocks, openDays[0].blocks));
  if (allSame && openDays.length === 7) {
    return `Daily ${fmtBlocks(openDays[0].blocks)}`;
  }
  if (allSame) {
    const ranges = getRanges(entries);
    return `${ranges} ${fmtBlocks(openDays[0].blocks)}`;
  }
  return entries
    .filter((e) => !e.closed)
    .map((e) => `${e.day} ${fmtBlocks(e.blocks)}`)
    .join(", ");
}

function getRanges(entries: { day: string; closed: boolean }[]): string {
  const open = entries.filter((e) => !e.closed);
  if (open.length === 0) return "";
  if (open.length === 7) return "Mon–Sun";
  // Simple: just list days
  const dayIndices = open.map((e) => DAYS.indexOf(e.day as typeof DAYS[number]));
  let ranges: string[] = [];
  let start = dayIndices[0];
  let end = dayIndices[0];
  for (let i = 1; i < dayIndices.length; i++) {
    if (dayIndices[i] === end + 1) {
      end = dayIndices[i];
    } else {
      ranges.push(start === end ? DAYS[start] : `${DAYS[start]}–${DAYS[end]}`);
      start = dayIndices[i];
      end = dayIndices[i];
    }
  }
  ranges.push(start === end ? DAYS[start] : `${DAYS[start]}–${DAYS[end]}`);
  return ranges.join(", ");
}

function fmt(t: string): string {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m === "00" ? `${h}${ampm}` : `${h}:${m}${ampm}`;
}

// --- Types ---

interface Recommendation {
  id: string;
  url: string;
  name: string | null;
  category: string | null;
  neighborhood: string | null;
  notes: string | null;
  scraped_data: Record<string, unknown> | null;
  scraped_images: string[] | null;
  status: string;
}

// --- Main Form ---

export default function ReviewForm({ recommendation: rec }: { recommendation: Recommendation }) {
  const router = useRouter();
  const scraped = (rec.scraped_data || {}) as Record<string, string | null>;

  const [name, setName] = useState(rec.name || scraped.name || "");
  const [category, setCategory] = useState<string[]>(
    rec.category ? (Array.isArray(rec.category) ? rec.category : [rec.category]) :
    scraped.category ? (Array.isArray(scraped.category) ? scraped.category : [scraped.category]) : []
  );
  const [subcategory, setSubcategory] = useState<string[]>(
    Array.isArray(scraped.subcategory) ? scraped.subcategory : []
  );
  const [neighborhood, setNeighborhood] = useState(rec.neighborhood || scraped.neighborhood || "");
  const [city, setCity] = useState("Miami");
  const [description, setDescription] = useState(scraped.description || "");
  const [address, setAddress] = useState(scraped.address || "");
  const [phone, setPhone] = useState(scraped.phone || "");
  const [website, setWebsite] = useState(scraped.website || rec.url || "");
  const [instagram, setInstagram] = useState(scraped.instagram || "");
  const [hours, setHours] = useState<Record<string, DayHours>>(() =>
    parseHoursString(scraped.hours || "")
  );
  const [priceRange, setPriceRange] = useState(scraped.priceRange || "");
  const [dressCode, setDressCode] = useState(scraped.dressCode || "");
  const [parking, setParking] = useState(scraped.parking || "");
  const [bookingUrl, setBookingUrl] = useState(scraped.bookingUrl || "");
  const [menuUrl, setMenuUrl] = useState(scraped.menuUrl || "");
  const [lng] = useState(scraped.lng?.toString() || "");
  const [lat] = useState(scraped.lat?.toString() || "");
  const [images, setImages] = useState<string[]>(rec.scraped_images || []);
  const [vibes, setVibes] = useState<string[]>(
    Array.isArray(scraped.vibes) ? scraped.vibes : []
  );

  const [sourceUrl, setSourceUrl] = useState(rec.url);
  const [rescraping, setRescraping] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleRescrape() {
    if (!sourceUrl.trim()) return;
    setRescraping(true);
    setError("");

    try {
      const res = await fetch("/api/admin/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId: rec.id, url: sourceUrl.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Re-scrape failed. Please try again.");
        setRescraping(false);
        return;
      }

      const { data, photos } = await res.json();

      // Apply scraped data to form fields — only overwrite if new data exists
      if (data.name) setName(data.name);
      if (data.category) {
        const cats = Array.isArray(data.category) ? data.category : [data.category];
        setCategory(cats);
      }
      if (data.subcategory && Array.isArray(data.subcategory)) setSubcategory(data.subcategory);
      if (data.neighborhood) setNeighborhood(data.neighborhood);
      if (data.description) setDescription(data.description);
      if (data.address) setAddress(data.address);
      if (data.phone) setPhone(data.phone);
      if (data.website) setWebsite(data.website);
      if (data.instagram) setInstagram(data.instagram);
      if (data.hours) setHours(parseHoursString(data.hours));
      if (data.priceRange) setPriceRange(data.priceRange);
      if (data.dressCode) setDressCode(data.dressCode);
      if (data.parking) setParking(data.parking);
      if (data.bookingUrl) setBookingUrl(data.bookingUrl);
      if (data.menuUrl) setMenuUrl(data.menuUrl);
      if (data.vibes && Array.isArray(data.vibes)) setVibes(data.vibes);
      if (photos && photos.length > 0) setImages(photos);
    } catch {
      setError("Re-scrape failed. Please try again.");
    }

    setRescraping(false);
  }

  async function handlePublish() {
    if (!name.trim() || category.length === 0 || !neighborhood.trim() || !city.trim()) {
      setError("Name, category, neighborhood, and city are required.");
      return;
    }

    setPublishing(true);
    setError("");

    const res = await fetch("/api/admin/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recommendationId: rec.id,
        spot: {
          id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
          name: name.trim(),
          category,
          subcategory: subcategory.length > 0 ? subcategory : null,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          description: description.trim(),
          address: address.trim(),
          phone: phone.trim() || null,
          website: website.trim() || null,
          instagram: instagram.trim() || null,
          hours: hoursToString(hours) || null,
          price_range: priceRange.trim() || null,
          dress_code: dressCode.trim() || null,
          parking: parking.trim() || null,
          booking_url: bookingUrl.trim() || null,
          menu_url: menuUrl.trim() || null,
          vibes: vibes.length > 0 ? vibes : null,
          lng: lng ? parseFloat(lng) : -80.19,
          lat: lat ? parseFloat(lat) : 25.77,
          images,
        },
      }),
    });

    setPublishing(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to publish. Please try again.");
      return;
    }

    setPublished(true);
  }

  if (published) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-semibold">Published</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
          {name} is now live on the map.
        </p>
        <button onClick={() => router.push(`/${citySlugFromName(city)}`)} className="mt-4 text-sm text-brand-500 hover:underline">
          View on map
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source URL — editable with re-scrape */}
      <div className="px-4 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800">
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1.5">Source</p>
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRescrape(); }}
            placeholder="Paste a new URL to re-scrape..."
            className="flex-1 min-w-0 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
          />
          <button
            type="button"
            onClick={handleRescrape}
            disabled={rescraping || !sourceUrl.trim()}
            className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {rescraping ? <><Loader2 size={14} className="animate-spin" /> Scraping...</> : "Re-scrape"}
          </button>
        </div>
        {rec.notes && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 italic mt-2">User note: "{rec.notes}"</p>
        )}
      </div>

      {/* Photos */}
      <PhotoManager images={images} onChange={setImages} recommendationId={rec.id} />

      {/* === Basic Info === */}
      <SectionHeader>Basic info</SectionHeader>

      <Field label="Name" required>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      <Field label={`Category · ${category.length} selected`} required>
        <ChipSelect
          options={CATEGORY_ORDER}
          labels={CATEGORY_LABELS}
          selected={category}
          onChange={setCategory}
        />
      </Field>

      <Field label="Price range">
        <SelectInput value={priceRange} onChange={setPriceRange} options={PRICE_RANGES.map((p) => ({ value: p, label: p }))} placeholder="Select" />
      </Field>

      {/* Subcategory chips — show subcategories for all selected categories */}
      {category.length > 0 && (
        <Field label={`Subcategory · ${subcategory.length} selected`}>
          <ChipSelect
            options={category.flatMap((c) => SUBCATEGORIES[c as Category] || [])}
            selected={subcategory}
            onChange={setSubcategory}
          />
        </Field>
      )}

      {/* Vibes chips */}
      <Field label={`Vibes · ${vibes.length} selected`}>
        <ChipSelect options={VIBES} selected={vibes} onChange={setVibes} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Neighborhood" required>
          <SelectInput value={neighborhood} onChange={setNeighborhood} options={MIAMI_NEIGHBORHOODS.map((n) => ({ value: n, label: n }))} placeholder="Select" allowCustom />
        </Field>
        <Field label="City" required>
          <SelectInput value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c }))} placeholder="Select" />
        </Field>
      </div>

      {/* Description with template generator */}
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={inputClass + " resize-none"} />
      </Field>

      {/* === Location & Contact === */}
      <SectionHeader>Location & contact</SectionHeader>

      <Field label="Address">
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <input type="tel" value={phone} onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            if (digits.length === 0) { setPhone(""); return; }
            let formatted = "(";
            formatted += digits.slice(0, 3);
            if (digits.length >= 4) formatted += ") " + digits.slice(3, 6);
            if (digits.length >= 7) formatted += " - " + digits.slice(6);
            setPhone(formatted);
          }} placeholder="(305) 555 - 1234" className={inputClass} />
        </Field>
        <Field label="Instagram">
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" className={inputClass} />
        </Field>
      </div>

      <Field label="Website">
        <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Booking URL">
        <input type="text" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://resy.com/..." className={inputClass} />
      </Field>

      <Field label="Menu URL">
        <input type="text" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </Field>

      {/* === Logistics === */}
      <SectionHeader>Logistics</SectionHeader>

      <Field label="Hours">
        <HoursEditor hours={hours} onChange={setHours} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dress code">
          <SelectInput value={dressCode} onChange={setDressCode} options={DRESS_CODES.map((d) => ({ value: d, label: d }))} placeholder="Select" />
        </Field>
        <Field label="Parking">
          <SelectInput value={parking} onChange={setParking} options={PARKING_OPTIONS.map((p) => ({ value: p, label: p }))} placeholder="Select" />
        </Field>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="h-32" />

      {/* Fixed publish bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-4">
        <button
          onClick={async () => {
            if (!confirm("Delete this recommendation? This cannot be undone.")) return;
            setDeleting(true);
            setError("");
            const res = await fetch("/api/admin/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ recommendationId: rec.id }),
            });
            setDeleting(false);
            if (!res.ok) {
              setError("Failed to delete. Please try again.");
              return;
            }
            router.push(`/${citySlugFromName(city)}`);
          }}
          disabled={publishing || deleting}
          className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0"
        >
          {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete</>}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || deleting}
          className="px-8 py-2.5 text-sm font-medium rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
        >
          {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : "Publish to site"}
        </button>
        </div>
      </div>
    </div>
  );
}

// --- Shared styles & components ---

const inputClass = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0">{children}</h3>
      <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// --- SelectInput: styled dropdown with optional custom entry ---

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
  allowCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  allowCustom?: boolean;
}) {
  const isCustom = allowCustom && value && !options.some((o) => o.value === value);

  return (
    <div className="relative">
      <select
        value={isCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") return;
          onChange(e.target.value);
        }}
        className={inputClass + " appearance-none pr-10"}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {isCustom && <option value="__custom__">{value} (custom)</option>}
      </select>
      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
    </div>
  );
}

// --- ChipSelect: toggleable chip grid for subcategories & vibes ---

function ChipSelect({
  options,
  labels,
  selected,
  onChange,
}: {
  options: string[];
  labels?: Record<string, string>;
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(v: string) {
    if (selected.includes(v)) {
      onChange(selected.filter((s) => s !== v));
    } else {
      onChange([...selected, v]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto scrollbar-hide p-0.5">
        {options.map((opt) => {
          const isActive = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                isActive
                  ? "bg-brand-500 border-brand-500 text-white"
                  : "bg-surface border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-500"
              }`}
            >
              {labels ? labels[opt] || opt : opt}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 mt-2 transition-colors">
          Clear all
        </button>
      )}
    </div>
  );
}

// --- HoursEditor: structured day-by-day hours ---

function HoursEditor({
  hours,
  onChange,
}: {
  hours: Record<string, DayHours>;
  onChange: (h: Record<string, DayHours>) => void;
}) {
  const timeInputClass = "px-2 py-1 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-surface focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

  function updateBlock(day: string, blockIndex: number, patch: Partial<TimeBlock>) {
    const blocks = hours[day].blocks.map((b, i) => i === blockIndex ? { ...b, ...patch } : b);
    onChange({ ...hours, [day]: { ...hours[day], blocks } });
  }

  function addBlock(day: string) {
    const lastBlock = hours[day].blocks[hours[day].blocks.length - 1];
    const newBlock = { open: lastBlock?.close || "18:00", close: "23:00" };
    onChange({ ...hours, [day]: { ...hours[day], blocks: [...hours[day].blocks, newBlock] } });
  }

  function removeBlock(day: string, blockIndex: number) {
    const blocks = hours[day].blocks.filter((_, i) => i !== blockIndex);
    onChange({ ...hours, [day]: { ...hours[day], blocks: blocks.length > 0 ? blocks : [{ open: "11:00", close: "23:00" }] } });
  }

  function toggleClosed(day: string) {
    onChange({ ...hours, [day]: { ...hours[day], closed: !hours[day].closed } });
  }

  function applyToAll(day: string) {
    const src = hours[day];
    const next = { ...hours };
    for (const d of DAYS) {
      next[d] = { closed: src.closed, blocks: src.blocks.map((b) => ({ ...b })) };
    }
    onChange(next);
  }

  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
      {DAYS.map((day, i) => (
        <div
          key={day}
          className={`px-4 py-2.5 ${i > 0 ? "border-t border-neutral-100 dark:border-neutral-800" : ""}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-sm font-medium w-8 shrink-0 pt-1">{day}</span>
            {hours[day].closed ? (
              <span className="text-sm text-neutral-400 dark:text-neutral-500 flex-1 pt-1">Closed</span>
            ) : (
              <div className="flex-1 space-y-1.5">
                {hours[day].blocks.map((block, bi) => (
                  <div key={bi} className="flex items-center gap-1.5">
                    <input
                      type="time"
                      value={block.open}
                      onChange={(e) => updateBlock(day, bi, { open: e.target.value })}
                      className={timeInputClass}
                    />
                    <span className="text-neutral-400 text-xs">to</span>
                    <input
                      type="time"
                      value={block.close}
                      onChange={(e) => updateBlock(day, bi, { close: e.target.value })}
                      className={timeInputClass}
                    />
                    {hours[day].blocks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(day, bi)}
                        className="text-neutral-300 dark:text-neutral-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove this time block"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <button
                type="button"
                onClick={() => toggleClosed(day)}
                className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                {hours[day].closed ? "Open" : "Closed"}
              </button>
              {!hours[day].closed && (
                <button
                  type="button"
                  onClick={() => addBlock(day)}
                  title="Add another time block (e.g. lunch + dinner)"
                  className="text-xs text-neutral-400 hover:text-brand-500 transition-colors"
                >
                  Add block
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- PhotoManager (unchanged from original) ---

function PhotoManager({
  images,
  onChange,
  recommendationId,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  recommendationId: string;
}) {
  const [uploading, setUploading] = useState<number | "add" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recommendationId", recommendationId);
    try {
      const res = await fetch("/api/admin/upload-photo", { method: "POST", body: formData });
      if (!res.ok) return null;
      const data = await res.json();
      return data.url;
    } catch {
      return null;
    }
  }

  function triggerFileInput(replaceIndex: number | null) {
    replaceIndexRef.current = replaceIndex;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const replaceIndex = replaceIndexRef.current;
    replaceIndexRef.current = null;

    if (replaceIndex !== null) {
      setUploading(replaceIndex);
      const url = await uploadFile(files[0]);
      if (url) {
        const next = [...images];
        next[replaceIndex] = url;
        onChange(next);
      }
      setUploading(null);
    } else {
      setUploading("add");
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i]);
        if (url) newUrls.push(url);
      }
      if (newUrls.length > 0) {
        onChange([...images, ...newUrls]);
      }
      setUploading(null);
    }

    e.target.value = "";
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDragStart(index: number) { setDragIndex(index); }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIndex(index); }
  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) { setDragIndex(null); setDragOverIndex(null); return; }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onChange(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleDragEnd() { setDragIndex(null); setDragOverIndex(null); }

  return (
    <div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      <p className="text-sm font-medium mb-3">Photos</p>

      {images.length > 0 && (
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[320px] rounded-xl overflow-hidden mb-3">
          {(() => {
            const slots = [...images.slice(0, 5)];
            while (slots.length < 5) slots.push("");
            return (
              <>
                <div className="col-span-2 row-span-2 relative group bg-neutral-100 dark:bg-neutral-800">
                  {slots[0] ? (
                    <>
                      <img src={slots[0]} alt="Photo 1" className="w-full h-full object-cover" />
                      <PhotoOverlay index={0} onView={() => setLightboxIndex(0)} onReplace={() => triggerFileInput(0)} onRemove={() => removeImage(0)} uploading={uploading === 0} draggable onDragStart={() => handleDragStart(0)} onDragOver={(e) => handleDragOver(e, 0)} onDrop={() => handleDrop(0)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === 0} />
                    </>
                  ) : (
                    <EmptySlot onClick={() => triggerFileInput(null)} />
                  )}
                </div>
                {slots.slice(1, 5).map((url, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx} className="relative group bg-neutral-100 dark:bg-neutral-800">
                      {url ? (
                        <>
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <PhotoOverlay index={idx} onView={() => setLightboxIndex(idx)} onReplace={() => triggerFileInput(idx)} onRemove={() => removeImage(idx)} uploading={uploading === idx} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === idx} />
                        </>
                      ) : (
                        <EmptySlot onClick={() => triggerFileInput(null)} />
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {images.length > 5 && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          {images.slice(5).map((url, i) => {
            const idx = i + 5;
            return (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <PhotoOverlay index={idx} onView={() => setLightboxIndex(idx)} onReplace={() => triggerFileInput(idx)} onRemove={() => removeImage(idx)} uploading={uploading === idx} draggable onDragStart={() => handleDragStart(idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={() => handleDrop(idx)} onDragEnd={handleDragEnd} isDragOver={dragOverIndex === idx} />
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => triggerFileInput(null)}
        disabled={uploading !== null}
        className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
      >
        {uploading === "add" ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Plus size={14} /> Add photos</>}
      </button>

      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          name="Photo"
          index={Math.min(lightboxIndex, images.length - 1)}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() => setLightboxIndex((i) => Math.min(images.length - 1, (i ?? 0) + 1))}
          onGoTo={(i) => setLightboxIndex(i)}
        />
      )}
    </div>
  );
}

function PhotoOverlay({
  index,
  onView,
  onReplace,
  onRemove,
  uploading,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  index: number;
  onView: () => void;
  onReplace: () => void;
  onRemove: () => void;
  uploading: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  isDragOver?: boolean;
}) {
  void index;
  return (
    <div
      draggable={draggable && !uploading}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={(e) => {
        // Clicking empty overlay area (not a button) opens the lightbox.
        if (e.target === e.currentTarget) onView();
      }}
      className={`absolute inset-0 flex items-center justify-center transition-all cursor-zoom-in ${isDragOver ? "bg-brand-500/20 ring-2 ring-inset ring-brand-500" : uploading ? "bg-black/40" : "bg-black/0 hover:bg-black/40"}`}
    >
      {uploading ? (
        <Loader2 size={20} className="text-white animate-spin" />
      ) : (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
          <button type="button" onClick={onView} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="View photo"><Eye size={14} /></button>
          <button type="button" onClick={onReplace} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="Replace photo"><Upload size={14} /></button>
          <button type="button" onClick={onRemove} className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-red-500 hover:bg-white dark:hover:bg-neutral-800 transition-colors" title="Remove photo"><Trash2 size={14} /></button>
          {draggable && <div className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 cursor-grab active:cursor-grabbing" title="Drag to reorder"><GripVertical size={14} /></div>}
        </div>
      )}
    </div>
  );
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-500 transition-colors">
      <Plus size={20} />
      <span className="text-xs mt-1">Add</span>
    </button>
  );
}
