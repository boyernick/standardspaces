"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, VIBES, Category } from "@/lib/types";
import { citySlugFromName } from "@/lib/cities";
import { NEW_WINDOW_MS } from "@/lib/new-badge";
import { CheckCircle, Loader2 } from "lucide-react";
import {
  ChipSelect,
  CITIES,
  CuratePhotosModal,
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
  locked_images: string[] | null;
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
  const [lockedImages, setLockedImages] = useState<string[]>(rec.locked_images || []);
  const [vibes, setVibes] = useState<string[]>(
    Array.isArray(scraped.vibes) ? scraped.vibes : []
  );

  // "Mark as new" toggle — defaults off; the admin opts in when they want
  // the <NewBadge /> to surface on this space for NEW_WINDOW_MS after publishing.
  const [markedNew, setMarkedNew] = useState(false);

  const [sourceUrl, setSourceUrl] = useState(rec.url);
  const [rescraping, setRescraping] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [curateOpen, setCurateOpen] = useState(false);

  async function handleRescrape() {
    if (!sourceUrl.trim()) return;
    setRescraping(true);
    setError("");

    try {
      const res = await fetch("/api/admin/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send the current lockedImages so the server preserves them
        // when merging in the new scrape result. Without this, locking
        // a photo wouldn't survive a re-scrape.
        body: JSON.stringify({
          recommendationId: rec.id,
          url: sourceUrl.trim(),
          lockedImages,
        }),
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
          marked_new_at: markedNew ? new Date().toISOString() : null,
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
    const spotId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const citySlug = citySlugFromName(city);
    const hero = images[0];
    const categoryLabel = category
      .map((c) => CATEGORY_LABELS[c as Category] ?? c)
      .join(" · ");
    return (
      <div className="py-16 sm:py-20 text-center">
        {/* Hero image of the published space with a confirmation chip. Falls
            back to a standalone checkmark badge if the admin published
            without any photos. */}
        {hero ? (
          <div className="relative mx-auto aspect-[16/10] max-w-xl overflow-hidden rounded-2xl bg-neutral-100 dark:bg-neutral-900">
            <img
              src={hero}
              alt={name}
              className="h-full w-full object-cover"
            />
            <div className="absolute top-4 left-4 flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-neutral-950/90 px-3 py-1.5 text-xs font-medium text-neutral-900 dark:text-white shadow-sm backdrop-blur">
              <CheckCircle size={14} className="text-green-600 dark:text-green-400" />
              Live on the map
            </div>
          </div>
        ) : (
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle size={28} className="text-green-600 dark:text-green-400" />
          </div>
        )}

        <h2 className="mt-8">{name}</h2>
        {(neighborhood || categoryLabel) && (
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {[neighborhood, categoryLabel].filter(Boolean).join(" · ")}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push(`/${citySlug}/${spotId}`)}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
          >
            View space
          </button>
          <button
            onClick={() => router.push("/admin/recommendations")}
            className="px-5 py-2.5 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
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
            className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {rescraping ? <><Loader2 size={14} className="animate-spin" /> Scraping...</> : "Re-scrape"}
          </button>
        </div>
        {rec.notes && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 italic mt-2">User note: &ldquo;{rec.notes}&rdquo;</p>
        )}
      </Field>

      {/* Photos */}
      <PhotoManager
        images={images}
        onChange={setImages}
        spotId={rec.id}
        onCurate={() => setCurateOpen(true)}
        lockedImages={lockedImages}
        onLockedChange={setLockedImages}
      />
      <CuratePhotosModal
        recommendationId={rec.id}
        open={curateOpen}
        onClose={() => setCurateOpen(false)}
        onReplace={(urls) => setImages(urls)}
      />

      {/* Mark as new — curation toggle, drives the <NewBadge /> on every card surface */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border border-neutral-200 dark:border-neutral-800 rounded-xl">
        <div className="min-w-0">
          <p className="text-sm font-medium">Mark as new</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={markedNew}
          onClick={() => setMarkedNew((v) => !v)}
          className={`relative shrink-0 w-10 h-6 rounded-full transition-colors ${
            markedNew ? "bg-brand-500" : "bg-neutral-200 dark:bg-neutral-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              markedNew ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

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
            className="px-8 py-2.5 text-sm font-medium rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
          >
            {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
