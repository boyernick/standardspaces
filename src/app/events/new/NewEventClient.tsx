"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Upload, Lock, Globe } from "lucide-react";
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
  const [coverUrl, setCoverUrl] = useState<string | null>(existingEvent?.cover_image_url ?? null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleCoverUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/events/upload-cover", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setCoverUrl(json.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

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
        cover_image_url: coverUrl,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
        capacity: capacity ? parseInt(capacity, 10) : null,
        price_cents: priceUsd ? Math.round(parseFloat(priceUsd) * 100) : 0,
        visibility,
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
        {/* Cover */}
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-2">Cover image</label>
          {coverUrl ? (
            <div className="relative rounded-xl overflow-hidden aspect-[16/9] bg-neutral-100 dark:bg-neutral-900">
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverUrl(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full aspect-[16/9] rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 flex flex-col items-center justify-center gap-2 text-neutral-500"
            >
              <Upload size={20} />
              <span className="text-sm">{uploading ? "Uploading…" : "Upload cover image"}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCoverUpload(f);
            }}
          />
        </div>

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
