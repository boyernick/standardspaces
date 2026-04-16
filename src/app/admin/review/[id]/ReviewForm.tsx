"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, VIBES, Category } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { CheckCircle, Loader2 } from "lucide-react";
import {
  ChipSelect,
  CITIES,
  DRESS_CODES,
  Field,
  HoursEditor,
  MIAMI_NEIGHBORHOODS,
  PARKING_OPTIONS,
  PhotoManager,
  PRICE_RANGES,
  SectionHeader,
  SelectInput,
  hoursToString,
  inputClass,
  parseHoursString,
  type DayHours,
} from "@/components/admin/form";

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

export default function ReviewForm({
  recommendation: rec,
  existingNeighborhoods = [],
}: {
  recommendation: Recommendation;
  existingNeighborhoods?: string[];
}) {
  const router = useRouter();
  const scraped = (rec.scraped_data || {}) as Record<string, string | null>;

  // Union canonical + any neighborhoods admins have already saved on other
  // spots so the picker surfaces "Hialeah", "Doral", etc. Mirrors the edit
  // form's neighborhood options treatment.
  const neighborhoodOptions = Array.from(
    new Map(
      [...MIAMI_NEIGHBORHOODS, ...existingNeighborhoods].map((n) => [n.toLowerCase(), n]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));

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
    parseHoursString(scraped.hours || ""),
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
          vibes: vibes.length > 0 ? vibes : null,
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

  async function handleDelete() {
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
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={() => router.push(`/${citySlugFromName(city)}`)}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
          >
            View on map
          </button>
          <button
            onClick={() => router.push("/admin/recommendations")}
            className="px-4 py-2 text-sm font-medium rounded-xl bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            Review more spaces
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source URL — editable with re-scrape */}
      <Field label="Source">
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleRescrape(); }}
            placeholder="Paste a new URL to re-scrape..."
            className={inputClass + " flex-1 min-w-0"}
          />
          <button
            type="button"
            onClick={handleRescrape}
            disabled={rescraping || !sourceUrl.trim()}
            className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {rescraping ? <><Loader2 size={14} className="animate-spin" /> Scraping...</> : "Re-scrape"}
          </button>
        </div>
        {rec.notes && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 italic mt-2">User note: &ldquo;{rec.notes}&rdquo;</p>
        )}
      </Field>

      {/* Photos */}
      <PhotoManager images={images} onChange={setImages} spotId={rec.id} />

      {/* === Basic info === */}
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

      {category.length > 0 && (
        <Field label={`Subcategory · ${subcategory.length} selected`}>
          <ChipSelect
            options={category.flatMap((c) => SUBCATEGORIES[c as Category] || [])}
            selected={subcategory}
            onChange={setSubcategory}
          />
        </Field>
      )}

      <Field label={`Vibes · ${vibes.length} selected`}>
        <ChipSelect options={VIBES} selected={vibes} onChange={setVibes} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Neighborhood" required>
          <SelectInput value={neighborhood} onChange={setNeighborhood} options={neighborhoodOptions.map((n) => ({ value: n, label: n }))} placeholder="Select" allowCustom />
        </Field>
        <Field label="City" required>
          <SelectInput value={city} onChange={setCity} options={CITIES.map((c) => ({ value: c, label: c }))} placeholder="Select" allowCustom />
        </Field>
      </div>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={inputClass + " resize-none"} />
      </Field>

      {/* === Location & contact === */}
      <SectionHeader>Location & contact</SectionHeader>

      <Field label="Address">
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              if (digits.length === 0) { setPhone(""); return; }
              let formatted = "(";
              formatted += digits.slice(0, 3);
              if (digits.length >= 4) formatted += ") " + digits.slice(3, 6);
              if (digits.length >= 7) formatted += " - " + digits.slice(6);
              setPhone(formatted);
            }}
            placeholder="(305) 555 - 1234"
            className={inputClass}
          />
        </Field>
        <Field label="Instagram">
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" className={inputClass} />
        </Field>
      </div>

      <Field label="Website">
        <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Menu URL">
        <input type="text" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} placeholder="https://..." className={inputClass} />
      </Field>

      <Field label="Booking URL">
        <input type="text" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://resy.com/..." className={inputClass} />
      </Field>

      {/* === Logistics === */}
      <SectionHeader>Logistics</SectionHeader>

      <Field label="Hours">
        <HoursEditor hours={hours} onChange={setHours} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Dress code">
          <SelectInput value={dressCode} onChange={setDressCode} options={DRESS_CODES.map((d) => ({ value: d, label: d }))} placeholder="Select" allowCustom />
        </Field>
        <Field label="Parking">
          <SelectInput value={parking} onChange={setParking} options={PARKING_OPTIONS.map((p) => ({ value: p, label: p }))} placeholder="Select" allowCustom />
        </Field>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="h-32" />

      {/* Fixed bottom bar — mirrors EditListingForm's save/delete toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={handleDelete}
            disabled={publishing || deleting}
            className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : "Delete"}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || deleting}
            className="px-8 py-2.5 text-sm font-medium rounded-xl bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
          >
            {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
