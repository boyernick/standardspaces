"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, SUBCATEGORIES, VIBES, Category } from "@/lib/types";
import { ChevronDown, Loader2, CheckCircle, X, Plus, GripVertical, Upload, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SpotData {
  id: string;
  name: string;
  category: string;
  subcategory: string[] | null;
  vibes: string[] | null;
  neighborhood: string;
  city: string;
  description: string;
  address: string;
  images: string[];
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
  booking_platform: string | null;
  menu_url: string | null;
  reservations: string | null;
}

export default function EditListingForm({ spot }: { spot: SpotData }) {
  const router = useRouter();

  const [name, setName] = useState(spot.name || "");
  const [category, setCategory] = useState(spot.category || "");
  const [subcategory, setSubcategory] = useState<string[]>(spot.subcategory || []);
  const [vibes, setVibes] = useState<string[]>(spot.vibes || []);
  const [neighborhood, setNeighborhood] = useState(spot.neighborhood || "");
  const [city, setCity] = useState(spot.city || "");
  const [description, setDescription] = useState(spot.description || "");
  const [address, setAddress] = useState(spot.address || "");
  const [phone, setPhone] = useState(spot.phone || "");
  const [website, setWebsite] = useState(spot.website || "");
  const [instagram, setInstagram] = useState(spot.instagram || "");
  const [hours, setHours] = useState(spot.hours || "");
  const [priceRange, setPriceRange] = useState(spot.price_range || "");
  const [dressCode, setDressCode] = useState(spot.dress_code || "");
  const [parking, setParking] = useState(spot.parking || "");
  const [bookingUrl, setBookingUrl] = useState(spot.booking_url || "");
  const [bookingPlatform, setBookingPlatform] = useState(spot.booking_platform || "");
  const [menuUrl, setMenuUrl] = useState(spot.menu_url || "");
  const [lng, setLng] = useState(spot.lng?.toString() || "");
  const [lat, setLat] = useState(spot.lat?.toString() || "");
  const [images, setImages] = useState<string[]>(spot.images || []);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim() || !category || !neighborhood.trim() || !city.trim()) {
      setError("Name, category, neighborhood, and city are required.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);

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
          hours: hours.trim() || null,
          price_range: priceRange.trim() || null,
          dress_code: dressCode.trim() || null,
          parking: parking.trim() || null,
          booking_url: bookingUrl.trim() || null,
          booking_platform: bookingPlatform.trim() || null,
          menu_url: menuUrl.trim() || null,
          lng: lng ? parseFloat(lng) : null,
          lat: lat ? parseFloat(lat) : null,
          images,
        },
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error || "Failed to save.");
      return;
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
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

    setDeleting(false);

    if (!res.ok) {
      setError("Failed to delete.");
      return;
    }

    router.push("/admin/listings");
  }

  return (
    <div className="space-y-5">
      <Link href="/admin/listings" className="inline-flex items-center gap-1.5 text-xs text-black/40 hover:text-black/60 transition-colors mb-2">
        <ArrowLeft size={12} /> Back to listings
      </Link>

      {/* Photos */}
      <PhotoManager images={images} onChange={setImages} spotId={spot.id} />

      {/* Name */}
      <Field label="Name" required>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>

      {/* Category */}
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

      {/* Subcategory */}
      <Field label="Subcategory">
        <MultiSelect
          options={(category && SUBCATEGORIES[category as Category]) || []}
          selected={subcategory}
          onChange={setSubcategory}
          placeholder="Select subcategories"
        />
      </Field>

      {/* Vibes */}
      <Field label="Vibes">
        <MultiSelect
          options={VIBES}
          selected={vibes}
          onChange={setVibes}
          placeholder="Select vibes"
        />
      </Field>

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
          <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Latitude">
          <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} className={inputClass} />
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

      {/* Parking */}
      <Field label="Parking">
        <input type="text" value={parking} onChange={(e) => setParking(e.target.value)} placeholder="Valet available" className={inputClass} />
      </Field>

      {/* Booking URL + Platform */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Booking URL">
          <input type="text" value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Booking Platform">
          <input type="text" value={bookingPlatform} onChange={(e) => setBookingPlatform(e.target.value)} placeholder="Resy, OpenTable..." className={inputClass} />
        </Field>
      </div>

      {/* Menu URL */}
      <Field label="Menu URL">
        <input type="text" value={menuUrl} onChange={(e) => setMenuUrl(e.target.value)} className={inputClass} />
      </Field>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving || deleting}
        className="w-full py-3 text-sm font-medium rounded-xl bg-brand-900 text-white hover:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <><Loader2 size={16} className="animate-spin" /> Saving...</>
        ) : saved ? (
          <><CheckCircle size={16} /> Saved</>
        ) : (
          "Save changes"
        )}
      </button>

      <button
        onClick={handleDelete}
        disabled={saving || deleting}
        className="w-full py-3 text-sm font-medium rounded-xl border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
      >
        {deleting ? <><Loader2 size={16} className="animate-spin" /> Deleting...</> : <><Trash2 size={14} /> Delete listing</>}
      </button>
    </div>
  );
}

const inputClass = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-xl bg-surface placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors";

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

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
}) {
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
          <span className="text-neutral-400 dark:text-neutral-500">{placeholder}</span>
        )}
        {selected.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-brand-900 text-white text-xs font-medium">
            {s}
            <X size={12} strokeWidth={2} className="cursor-pointer opacity-70 hover:opacity-100" onClick={(e) => { e.stopPropagation(); toggle(s); }} />
          </span>
        ))}
        <ChevronDown size={14} className={`ml-auto text-neutral-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1.5 w-full bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
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
  spotId,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  spotId: string;
}) {
  const [uploading, setUploading] = useState<number | "add" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recommendationId", spotId);
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
      if (newUrls.length > 0) onChange([...images, ...newUrls]);
      setUploading(null);
    }

    e.target.value = "";
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function handleDrop(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  }

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
                      <div
                        draggable
                        onDragStart={() => setDragIndex(0)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex(0); }}
                        onDrop={() => { if (dragIndex !== null) handleDrop(dragIndex, 0); setDragIndex(null); setDragOverIndex(null); }}
                        onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                        className={`absolute inset-0 flex items-center justify-center transition-all ${dragOverIndex === 0 ? "bg-brand-900/20 ring-2 ring-inset ring-brand-900" : uploading === 0 ? "bg-black/40" : "bg-black/0 hover:bg-black/40"}`}
                      >
                        {uploading === 0 ? (
                          <Loader2 size={20} className="text-white animate-spin" />
                        ) : (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                            <button type="button" onClick={() => triggerFileInput(0)} className="p-2 rounded-lg bg-white/90 text-neutral-700 hover:bg-white"><Upload size={14} /></button>
                            <button type="button" onClick={() => removeImage(0)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white"><Trash2 size={14} /></button>
                            <div className="p-2 rounded-lg bg-white/90 text-neutral-700 cursor-grab"><GripVertical size={14} /></div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <button type="button" onClick={() => triggerFileInput(null)} className="w-full h-full flex flex-col items-center justify-center text-neutral-400 hover:text-neutral-500">
                      <Plus size={20} /><span className="text-xs mt-1">Add</span>
                    </button>
                  )}
                </div>
                {slots.slice(1, 5).map((url, i) => {
                  const idx = i + 1;
                  return (
                    <div key={idx} className="relative group bg-neutral-100 dark:bg-neutral-800">
                      {url ? (
                        <>
                          <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <div
                            draggable
                            onDragStart={() => setDragIndex(idx)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
                            onDrop={() => { if (dragIndex !== null) handleDrop(dragIndex, idx); setDragIndex(null); setDragOverIndex(null); }}
                            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                            className={`absolute inset-0 flex items-center justify-center transition-all ${dragOverIndex === idx ? "bg-brand-900/20 ring-2 ring-inset ring-brand-900" : uploading === idx ? "bg-black/40" : "bg-black/0 hover:bg-black/40"}`}
                          >
                            {uploading === idx ? (
                              <Loader2 size={20} className="text-white animate-spin" />
                            ) : (
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                                <button type="button" onClick={() => triggerFileInput(idx)} className="p-2 rounded-lg bg-white/90 text-neutral-700 hover:bg-white"><Upload size={14} /></button>
                                <button type="button" onClick={() => removeImage(idx)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white"><Trash2 size={14} /></button>
                                <div className="p-2 rounded-lg bg-white/90 text-neutral-700 cursor-grab"><GripVertical size={14} /></div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <button type="button" onClick={() => triggerFileInput(null)} className="w-full h-full flex flex-col items-center justify-center text-neutral-400 hover:text-neutral-500">
                          <Plus size={20} /><span className="text-xs mt-1">Add</span>
                        </button>
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
                <div className="absolute inset-0 bg-black/0 hover:bg-black/40 flex items-center justify-center transition-all">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 transition-opacity">
                    <button type="button" onClick={() => triggerFileInput(idx)} className="p-2 rounded-lg bg-white/90 text-neutral-700 hover:bg-white"><Upload size={14} /></button>
                    <button type="button" onClick={() => removeImage(idx)} className="p-2 rounded-lg bg-white/90 text-red-500 hover:bg-white"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => triggerFileInput(null)}
        disabled={uploading !== null}
        className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl text-neutral-500 hover:border-neutral-400 hover:text-neutral-700 transition-colors disabled:opacity-50"
      >
        {uploading === "add" ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Plus size={14} /> Add photos</>}
      </button>
    </div>
  );
}
