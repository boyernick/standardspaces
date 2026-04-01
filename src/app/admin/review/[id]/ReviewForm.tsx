"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, Category } from "@/lib/types";
import { ChevronDown, Loader2, CheckCircle, X, Plus, GripVertical, Upload, Trash2 } from "lucide-react";

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
  const [hours, setHours] = useState(scraped.hours || "");
  const [priceRange, setPriceRange] = useState(scraped.priceRange || "");
  const [dressCode, setDressCode] = useState(scraped.dressCode || "");
  const [reservations, setReservations] = useState(
    scraped.bookingPlatform && scraped.bookingUrl
      ? `${scraped.bookingPlatform}`
      : ""
  );
  const [parking, setParking] = useState(scraped.parking || "");
  const [bookingUrl, setBookingUrl] = useState(scraped.bookingUrl || "");
  const [lng, setLng] = useState(scraped.lng?.toString() || "");
  const [lat, setLat] = useState(scraped.lat?.toString() || "");
  const [images, setImages] = useState<string[]>(rec.scraped_images || []);

  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
          subcategory: subcategory.length > 0 ? subcategory : null,
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
          booking_url: bookingUrl.trim() || null,
          lng: lng ? parseFloat(lng) : -80.19,
          lat: lat ? parseFloat(lat) : 25.77,
          images,
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
      {/* Photos */}
      <PhotoManager
        images={images}
        onChange={setImages}
        recommendationId={rec.id}
      />

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
          <SubcategorySelect
            category={category as Category}
            selected={subcategory}
            onChange={setSubcategory}
          />
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

      {/* Booking URL */}
      <Field label="Booking URL">
        <input type="text" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} placeholder="https://resy.com/..." className={inputClass} />
      </Field>

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
        disabled={publishing || deleting}
        className="w-full py-3 text-sm font-medium rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {publishing ? <><Loader2 size={16} className="animate-spin" /> Publishing...</> : "Publish to site"}
      </button>

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
          router.push("/miami");
        }}
        disabled={publishing || deleting}
        className="w-full py-3 text-sm font-medium rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete recommendation</>}
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

function SubcategorySelect({
  category,
  selected,
  onChange,
}: {
  category: Category;
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const options = category && SUBCATEGORIES[category] ? SUBCATEGORIES[category] : [];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((s) => s !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={inputClass + " text-left flex items-center gap-1.5 flex-wrap min-h-[42px]"}
      >
        {selected.length === 0 && (
          <span className="text-neutral-400 dark:text-neutral-500">Select subcategories</span>
        )}
        {selected.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-900 text-white text-xs font-medium"
          >
            {s}
            <X
              size={12}
              strokeWidth={2}
              className="cursor-pointer opacity-70 hover:opacity-100"
              onClick={(e) => { e.stopPropagation(); toggle(s); }}
            />
          </span>
        ))}
        <ChevronDown size={14} className={`ml-auto text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1.5 w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {options.map((opt) => {
            const isActive = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={`flex w-full items-center gap-2.5 px-4 py-2 text-xs transition-colors ${isActive ? "text-neutral-900 dark:text-white font-medium bg-neutral-50 dark:bg-neutral-900" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isActive ? "bg-brand-900 border-brand-900" : "border-neutral-300 dark:border-neutral-600"}`}>
                  {isActive && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </span>
                {opt}
              </button>
            );
          })}
          {selected.length > 0 && (
            <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
              <button type="button" onClick={() => onChange([])} className="block w-full text-left px-4 py-2 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors">Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
      // Replace a specific photo
      setUploading(replaceIndex);
      const url = await uploadFile(files[0]);
      if (url) {
        const next = [...images];
        next[replaceIndex] = url;
        onChange(next);
      }
      setUploading(null);
    } else {
      // Add new photos
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

    // Reset file input
    e.target.value = "";
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...images];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    onChange(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <p className="text-sm font-medium mb-3">Photos</p>

      {/* Gallery grid — matching SpotGallery layout */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 grid-rows-2 gap-2 h-[320px] rounded-xl overflow-hidden mb-3">
          {(() => {
            const slots = [...images.slice(0, 5)];
            while (slots.length < 5) slots.push("");
            return (
              <>
                {/* Hero image — col-span-2 row-span-2 */}
                <div className="col-span-2 row-span-2 relative group bg-neutral-100 dark:bg-neutral-800">
                  {slots[0] ? (
                    <>
                      <img src={slots[0]} alt="Photo 1" className="w-full h-full object-cover" />
                      <PhotoOverlay
                        index={0}
                        onReplace={() => triggerFileInput(0)}
                        onRemove={() => removeImage(0)}
                        uploading={uploading === 0}
                        draggable
                        onDragStart={() => handleDragStart(0)}
                        onDragOver={(e) => handleDragOver(e, 0)}
                        onDrop={() => handleDrop(0)}
                        onDragEnd={handleDragEnd}
                        isDragOver={dragOverIndex === 0}
                      />
                    </>
                  ) : (
                    <EmptySlot onClick={() => triggerFileInput(null)} />
                  )}
                </div>
                {/* 4 smaller images */}
                {slots.slice(1, 5).map((url, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx} className="relative group bg-neutral-100 dark:bg-neutral-800">
                      {url ? (
                        <>
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <PhotoOverlay
                            index={idx}
                            onReplace={() => triggerFileInput(idx)}
                            onRemove={() => removeImage(idx)}
                            uploading={uploading === idx}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={() => handleDrop(idx)}
                            onDragEnd={handleDragEnd}
                            isDragOver={dragOverIndex === idx}
                          />
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

      {/* Extra photos beyond the 5 in gallery */}
      {images.length > 5 && (
        <div className="grid grid-cols-5 gap-2 mb-3">
          {images.slice(5).map((url, i) => {
            const idx = i + 5;
            return (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                <PhotoOverlay
                  index={idx}
                  onReplace={() => triggerFileInput(idx)}
                  onRemove={() => removeImage(idx)}
                  uploading={uploading === idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  isDragOver={dragOverIndex === idx}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Add photos button */}
      <button
        type="button"
        onClick={() => triggerFileInput(null)}
        disabled={uploading !== null}
        className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-500 dark:text-neutral-400 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors disabled:opacity-50"
      >
        {uploading === "add" ? (
          <><Loader2 size={14} className="animate-spin" /> Uploading...</>
        ) : (
          <><Plus size={14} /> Add photos</>
        )}
      </button>
    </div>
  );
}

function PhotoOverlay({
  index,
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
  return (
    <div
      draggable={draggable && !uploading}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`absolute inset-0 flex items-center justify-center transition-all ${
        isDragOver
          ? "bg-brand-900/20 ring-2 ring-inset ring-brand-900"
          : uploading
          ? "bg-black/40"
          : "bg-black/0 hover:bg-black/40"
      }`}
    >
      {uploading ? (
        <Loader2 size={20} className="text-white animate-spin" />
      ) : (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
          <button
            type="button"
            onClick={onReplace}
            className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
            title="Replace photo"
          >
            <Upload size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-red-500 hover:bg-white dark:hover:bg-neutral-800 transition-colors"
            title="Remove photo"
          >
            <Trash2 size={14} />
          </button>
          {draggable && (
            <div
              className="p-2 rounded-lg bg-white/90 dark:bg-neutral-900/90 text-neutral-700 dark:text-neutral-300 cursor-grab active:cursor-grabbing"
              title="Drag to reorder"
            >
              <GripVertical size={14} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full h-full flex flex-col items-center justify-center text-neutral-400 dark:text-neutral-600 hover:text-neutral-500 dark:hover:text-neutral-500 transition-colors"
    >
      <Plus size={20} />
      <span className="text-xs mt-1">Add</span>
    </button>
  );
}
