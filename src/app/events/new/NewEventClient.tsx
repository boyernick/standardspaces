"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Upload, Lock, Globe, Loader2, Trash2, GripVertical, Plus } from "lucide-react";
import { Spot, EventRecord } from "@/lib/types";
import { createEvent, updateEvent, searchSpotsForPicker } from "@/app/actions/events";

interface Props {
  initialSpot: Spot | null;
  existingEvent?: EventRecord | null;
}

function toLocalInput(iso: string): string {
  // Convert ISO string to value suitable for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NewEventClient({ initialSpot, existingEvent = null }: Props) {
  const router = useRouter();
  const isEdit = !!existingEvent;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [spot, setSpot] = useState<Spot | null>(initialSpot);
  const [spotQuery, setSpotQuery] = useState("");
  const [spotResults, setSpotResults] = useState<Spot[]>([]);
  const [searching, setSearching] = useState(false);

  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [startsAt, setStartsAt] = useState(existingEvent ? toLocalInput(existingEvent.starts_at) : "");
  const [endsAt, setEndsAt] = useState(existingEvent ? toLocalInput(existingEvent.ends_at) : "");
  const [capacity, setCapacity] = useState(existingEvent?.capacity ? String(existingEvent.capacity) : "");
  const [priceUsd, setPriceUsd] = useState(
    existingEvent && existingEvent.price_cents > 0 ? (existingEvent.price_cents / 100).toFixed(2) : ""
  );
  const [visibility, setVisibility] = useState<"public" | "private">(existingEvent?.visibility ?? "public");
  const [ageRestriction, setAgeRestriction] = useState(existingEvent?.age_restriction ?? "");
  const initialImages =
    existingEvent?.images && existingEvent.images.length > 0
      ? existingEvent.images
      : existingEvent?.cover_image_url
      ? [existingEvent.cover_image_url]
      : [];
  const [images, setImages] = useState<string[]>(initialImages);

  // Debounced spot search
  useEffect(() => {
    if (spot || !spotQuery.trim()) {
      setSpotResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const results = await searchSpotsForPicker(spotQuery);
      setSpotResults(results);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [spotQuery, spot]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!spot) {
      setError("Pick a spot");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!startsAt || !endsAt) {
      setError("Start and end time are required");
      return;
    }

    startTransition(async () => {
      const payload = {
        spot_id: spot.id,
        title,
        description: description || null,
        cover_image_url: images[0] ?? null,
        images,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        capacity: capacity ? parseInt(capacity, 10) : null,
        price_cents: priceUsd ? Math.round(parseFloat(priceUsd) * 100) : 0,
        visibility,
        age_restriction: ageRestriction || null,
      };
      if (isEdit && existingEvent) {
        const res = await updateEvent(existingEvent.id, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/events/${existingEvent.id}`);
      } else {
        const res = await createEvent(payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.push(`/events/${res.id}`);
      }
    });
  }

  const inputClass =
    "w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-600";

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-semibold mb-6">{isEdit ? "Edit event" : "Host an event"}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Photos */}
        <PhotoManager images={images} onChange={setImages} onError={setError} />

        {/* Spot picker */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Spot</label>
          {spot ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{spot.name}</div>
                <div className="text-xs text-neutral-500 truncate">{spot.neighborhood}, {spot.city}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSpot(null); setSpotQuery(""); }}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search for a spot…"
                  value={spotQuery}
                  onChange={(e) => setSpotQuery(e.target.value)}
                  className={inputClass + " pl-9"}
                />
              </div>
              {spotQuery && (spotResults.length > 0 || searching) && (
                <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {searching && spotResults.length === 0 && (
                    <div className="px-3 py-2 text-xs text-neutral-500">Searching…</div>
                  )}
                  {spotResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSpot(s); setSpotQuery(""); setSpotResults([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-neutral-500">{s.neighborhood}, {s.city}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunset rooftop dinner"
            className={inputClass}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="What's the vibe? Who should come?"
            className={inputClass}
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Starts</label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Ends</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
              required
            />
          </div>
        </div>

        {/* Capacity + price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Capacity (optional)</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Leave empty for unlimited"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-2">Price USD (0 = free)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
        </div>

        {/* Age */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Age (optional)</label>
          <input
            type="text"
            value={ageRestriction}
            onChange={(e) => setAgeRestriction(e.target.value)}
            placeholder="e.g. 18+, 21+, All ages"
            className={inputClass}
          />
        </div>

        {/* Visibility */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Visibility</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                visibility === "public"
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <Globe size={14} />
              <div className="text-left">
                <div className="font-medium">Public</div>
                <div className="text-xs text-neutral-500">Open to all members</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setVisibility("private")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
                visibility === "private"
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <Lock size={14} />
              <div className="text-left">
                <div className="font-medium">Private</div>
                <div className="text-xs text-neutral-500">Invite-only</div>
              </div>
            </button>
          </div>
          {visibility === "private" && (
            <p className="text-xs text-neutral-500 mt-2">
              You&apos;ll be able to invite members from the event page after creating it.
            </p>
          )}
        </div>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="px-5 py-2 rounded-full text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 disabled:opacity-50"
          >
            {pending ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create event"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PhotoManager({
  images,
  onChange,
  onError,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  onError: (msg: string | null) => void;
}) {
  const [uploading, setUploading] = useState<number | "add" | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number | null>(null);

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/events/upload-cover", { method: "POST", body: formData });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        onError(json.error || "Upload failed");
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch {
      onError("Upload failed");
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
    onError(null);

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
                        className={`absolute inset-0 flex items-center justify-center transition-all ${dragOverIndex === 0 ? "bg-neutral-900/20 ring-2 ring-inset ring-neutral-900" : uploading === 0 ? "bg-black/40" : "bg-black/0 hover:bg-black/40"}`}
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
                            className={`absolute inset-0 flex items-center justify-center transition-all ${dragOverIndex === idx ? "bg-neutral-900/20 ring-2 ring-inset ring-neutral-900" : uploading === idx ? "bg-black/40" : "bg-black/0 hover:bg-black/40"}`}
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
