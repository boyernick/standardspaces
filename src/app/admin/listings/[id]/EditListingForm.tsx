"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, VIBES, Category } from "@/lib/types";
import { NEW_WINDOW_MS } from "@/lib/new-badge";
import { Loader2 } from "lucide-react";
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

interface SpotData {
  id: string;
  name: string;
  category: string[];
  subcategory: string[] | null;
  vibes: string[] | null;
  neighborhood: string;
  city: string;
  description: string;
  address: string;
  images: string[];
  locked_images: string[] | null;
  lng: number;
  lat: number;
  hours: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  price_range: string | null;
  dress_code: string | null;
  parking: string | null;
  booking_url: string | null;
  menu_url: string | null;
  reservations: string | null;
  marked_new_at: string | null;
}

export default function EditListingForm({
  spot,
  existingNeighborhoods = [],
}: {
  spot: SpotData;
  existingNeighborhoods?: string[];
}) {
  // Union canonical + any neighborhoods admins have already saved on
  // other spots. Sorted; dedup is case-insensitive so "brickell" and
  // "Brickell" don't both appear.
  const neighborhoodOptions = Array.from(
    new Map(
      [...MIAMI_NEIGHBORHOODS, ...existingNeighborhoods].map((n) => [n.toLowerCase(), n]),
    ).values(),
  ).sort((a, b) => a.localeCompare(b));
  const router = useRouter();

  const [name, setName] = useState(spot.name || "");
  const [category, setCategory] = useState<string[]>(
    Array.isArray(spot.category) ? spot.category : spot.category ? [spot.category] : [],
  );
  const [subcategory, setSubcategory] = useState<string[]>(spot.subcategory || []);
  const [vibes, setVibes] = useState<string[]>(spot.vibes || []);
  const [neighborhood, setNeighborhood] = useState(spot.neighborhood || "");
  const [city, setCity] = useState(spot.city || "");
  const [description, setDescription] = useState(spot.description || "");
  const [address, setAddress] = useState(spot.address || "");
  const [phone, setPhone] = useState(spot.phone || "");
  const [website, setWebsite] = useState(spot.website || "");
  const [instagram, setInstagram] = useState(spot.instagram || "");
  const [hours, setHours] = useState<Record<string, DayHours>>(() =>
    parseHoursString(spot.hours || ""),
  );
  const [priceRange, setPriceRange] = useState(spot.price_range || "");
  const [dressCode, setDressCode] = useState(spot.dress_code || "");
  const [parking, setParking] = useState(spot.parking || "");
  const [bookingUrl, setBookingUrl] = useState(spot.booking_url || "");
  const [menuUrl, setMenuUrl] = useState(spot.menu_url || "");
  // lng/lat are managed via geocoding and not edited directly here.
  const lng = spot.lng?.toString() || "";
  const lat = spot.lat?.toString() || "";
  const [images, setImages] = useState<string[]>(spot.images || []);
  const [lockedImages, setLockedImages] = useState<string[]>(spot.locked_images || []);

  // "Mark as new" toggle. Initial on-state reflects whether the badge is
  // currently active (within the NEW_WINDOW_MS window), not just whether
  // the column has ever been set. We preserve the existing timestamp on
  // save so saving unrelated edits doesn't reset the clock.
  const initiallyNew =
    !!spot.marked_new_at &&
    Date.now() - new Date(spot.marked_new_at).getTime() < NEW_WINDOW_MS;
  const [markedNew, setMarkedNew] = useState(initiallyNew);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  // Source URL + rescrape. Mirrors ReviewForm's source flow — paste a
  // URL, hit Re-scrape, the form fields repopulate from the new research.
  // Hits /api/admin/rescrape-spot which does research + photo upload
  // scoped to `spots/<id>/…` and returns merged data without persisting
  // to the DB; admin still has to click Save to commit.
  const [sourceUrl, setSourceUrl] = useState(spot.website || "");
  const [rescraping, setRescraping] = useState(false);

  async function handleRescrape() {
    if (!sourceUrl.trim()) return;
    setRescraping(true);
    setError("");

    try {
      const res = await fetch("/api/admin/rescrape-spot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spotId: spot.id,
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
      if (Array.isArray(photos) && photos.length > 0) setImages(photos);
    } catch {
      setError("Re-scrape failed. Please try again.");
    }

    setRescraping(false);
  }

  async function handleSave() {
    if (!name.trim() || category.length === 0 || !neighborhood.trim() || !city.trim()) {
      setError("Name, category, neighborhood, and city are required.");
      return;
    }

    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/spots", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: spot.id,
        updates: {
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
          lng: lng ? parseFloat(lng) : null,
          lat: lat ? parseFloat(lat) : null,
          images,
          locked_images: lockedImages,
          marked_new_at: markedNew
            ? (initiallyNew ? spot.marked_new_at : new Date().toISOString())
            : null,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to save.");
      setSaving(false);
      return;
    }

    // Success → back to admin listings. Leave `saving` true so the button
    // stays in its spinner state during the navigation transition.
    router.push("/admin/listings");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete "${spot.name}" permanently? This cannot be undone.`)) return;
    setDeleting(true);
    setError("");

    const res = await fetch("/api/admin/spots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: spot.id }),
    });

    if (!res.ok) {
      setError("Failed to delete.");
      setDeleting(false);
      return;
    }

    router.push("/admin/listings");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Source URL + re-scrape — mirrors ReviewForm's source row so an
          admin can refresh a listing's fields + photos from a new link
          without copying the URL to a staging recommendation first. */}
      <Field label="Source">
        <div className="flex items-center gap-2">
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleRescrape(); } }}
            placeholder="Paste a URL to re-scrape..."
            className={inputClass + " flex-1 min-w-0"}
          />
          <button
            type="button"
            onClick={handleRescrape}
            disabled={rescraping || !sourceUrl.trim()}
            className="shrink-0 px-4 py-2.5 text-sm font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {rescraping ? (
              <><Loader2 size={14} className="animate-spin" /> Scraping...</>
            ) : (
              "Re-scrape"
            )}
          </button>
        </div>
      </Field>

      {/* Photos */}
      <PhotoManager
        images={images}
        onChange={setImages}
        spotId={spot.id}
        lockedImages={lockedImages}
        onLockedChange={setLockedImages}
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

      {/* Fixed bottom bar — mirrors ReviewForm's publish toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting...</> : "Delete"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className="px-8 py-2.5 text-sm font-medium rounded-lg bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
          >
            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
