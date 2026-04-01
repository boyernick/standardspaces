"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/types";
import { ChevronDown, Loader2, CheckCircle } from "lucide-react";

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

export default function ReviewForm({ recommendation: rec }: { recommendation: Recommendation }) {
  const router = useRouter();
  const scraped = (rec.scraped_data || {}) as Record<string, string | null>;

  const [name, setName] = useState(rec.name || scraped.name || "");
  const [category, setCategory] = useState(rec.category || scraped.category || "");
  const [subcategory, setSubcategory] = useState((scraped.subcategory as string) || "");
  const [neighborhood, setNeighborhood] = useState(rec.neighborhood || scraped.neighborhood || "");
  const [city, setCity] = useState("Miami");
  const [description, setDescription] = useState(scraped.description || "");
  const [address, setAddress] = useState(scraped.address || "");
  const [phone, setPhone] = useState(scraped.phone || "");
  const [website, setWebsite] = useState(scraped.website || rec.url || "");
  const [instagram, setInstagram] = useState(scraped.instagram || "");
  const [hours, setHours] = useState(scraped.hours || "");
  const [priceRange, setPriceRange] = useState(scraped.priceRange || "");
  const [dressCode, setDressCode] = useState("");
  const [reservations, setReservations] = useState("");
  const [parking, setParking] = useState("");
  const [lng, setLng] = useState(scraped.lng?.toString() || "");
  const [lat, setLat] = useState(scraped.lat?.toString() || "");

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");

  async function handlePublish() {
    if (!name.trim() || !category || !neighborhood.trim() || !city.trim()) {
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
          subcategory: subcategory.trim() || null,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          description: description.trim(),
          address: address.trim(),
          phone: phone.trim() || null,
          website: website.trim() || null,
          instagram: instagram.trim() || null,
          hours: hours.trim() || null,
          price_range: priceRange.trim() || null,
          dress_code: dressCode.trim() || null,
          reservations: reservations.trim() || null,
          parking: parking.trim() || null,
          lng: lng ? parseFloat(lng) : -80.19,
          lat: lat ? parseFloat(lat) : 25.77,
          images: rec.scraped_images || [],
        },
      }),
    });

    setPublishing(false);

    if (!res.ok) {
      setError("Failed to publish. Please try again.");
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
        <button onClick={() => router.push("/miami")} className="mt-4 text-sm text-brand-900 hover:underline">
          View on map
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <Field label="Name" required>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      {/* Category + Subcategory */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" required>
          <div className="relative">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass + " appearance-none pr-10"}>
              <option value="">Select</option>
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          </div>
        </Field>
        <Field label="Subcategory">
          <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="e.g. Omakase, Speakeasy" className={inputClass} />
        </Field>
      </div>

      {/* Neighborhood + City */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Neighborhood" required>
          <input type="text" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputClass} />
        </Field>
        <Field label="City" required>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {/* Description */}
      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass + " resize-none"} />
      </Field>

      {/* Address */}
      <Field label="Address">
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
      </Field>

      {/* Coordinates */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Longitude">
          <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-80.19" className={inputClass} />
        </Field>
        <Field label="Latitude">
          <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="25.77" className={inputClass} />
        </Field>
      </div>

      {/* Hours + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Hours">
          <input type="text" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Sun 9am–10pm" className={inputClass} />
        </Field>
        <Field label="Phone">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
      </div>

      {/* Website + Instagram */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Website">
          <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Instagram">
          <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@handle" className={inputClass} />
        </Field>
      </div>

      {/* Price + Dress code */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Price range">
          <input type="text" value={priceRange} onChange={(e) => setPriceRange(e.target.value)} placeholder="$$$$" className={inputClass} />
        </Field>
        <Field label="Dress code">
          <input type="text" value={dressCode} onChange={(e) => setDressCode(e.target.value)} placeholder="Smart casual" className={inputClass} />
        </Field>
      </div>

      {/* Reservations + Parking */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Reservations">
          <input type="text" value={reservations} onChange={(e) => setReservations(e.target.value)} placeholder="Required via Resy" className={inputClass} />
        </Field>
        <Field label="Parking">
          <input type="text" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Valet available" className={inputClass} />
        </Field>
      </div>

      {/* Original URL + Notes */}
      <div className="border-t border-neutral-100 dark:border-neutral-800 pt-5 mt-6">
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">Original URL</p>
        <a href={rec.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-900 hover:underline break-all">{rec.url}</a>
        {rec.notes && (
          <div className="mt-3">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-1">User notes</p>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 italic">"{rec.notes}"</p>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handlePublish}
        disabled={publishing}
        className="w-full py-3 text-sm font-medium rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : "Publish to site"}
      </button>
    </div>
  );
}

const inputClass = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-950 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

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
