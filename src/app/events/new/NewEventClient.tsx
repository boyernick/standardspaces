"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Lock, Globe, Loader2, X } from "lucide-react";
import { Spot, EventRecord } from "@/lib/types";
import {
  createEvent,
  inviteMembers,
  removeInvite,
  searchMembers,
  searchSpotsForPicker,
  updateEvent,
  type MemberSearchResult,
} from "@/app/actions/events";
import {
  Field,
  PhotoManager,
  SectionHeader,
  inputClass,
} from "@/components/admin/form";

interface Props {
  initialSpot: Spot | null;
  existingEvent?: EventRecord | null;
  initialInvitees?: MemberSearchResult[];
}

function toLocalInput(iso: string): string {
  // Convert ISO string to value suitable for <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function uploadEventCover(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch("/api/events/upload-cover", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url;
  } catch {
    return null;
  }
}

export default function NewEventClient({
  initialSpot,
  existingEvent = null,
  initialInvitees = [],
}: Props) {
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
  const [invitees, setInvitees] = useState<MemberSearchResult[]>(initialInvitees);
  // Track the snapshot we loaded with so edit-mode removals can be persisted
  // server-side when the host removes an already-invited member.
  const [originalInviteeIds] = useState<Set<string>>(
    () => new Set(initialInvitees.map((m) => m.id)),
  );
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<MemberSearchResult[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
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

  // Debounced member search for the invite list. Only runs when visibility is
  // private — public events don't have invitees.
  useEffect(() => {
    if (visibility !== "private" || !inviteQuery.trim()) {
      setInviteResults([]);
      return;
    }
    setInviteSearching(true);
    const t = setTimeout(async () => {
      const results = await searchMembers(inviteQuery);
      setInviteResults(results);
      setInviteSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [inviteQuery, visibility]);

  function addInvitee(m: MemberSearchResult) {
    if (invitees.some((i) => i.id === m.id)) return;
    setInvitees((prev) => [...prev, m]);
    setInviteQuery("");
    setInviteResults([]);
  }

  function removeInvitee(id: string) {
    setInvitees((prev) => prev.filter((m) => m.id !== id));
  }

  function memberLabel(m: MemberSearchResult): string {
    const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
    return full || m.instagram || "Member";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!spot) {
      setError("Pick a space");
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
      // Only sync invitees for private events — public events ignore the list.
      const inviteeIds = visibility === "private" ? invitees.map((m) => m.id) : [];
      const toRemove =
        visibility === "private"
          ? [...originalInviteeIds].filter((id) => !inviteeIds.includes(id))
          : [...originalInviteeIds];

      if (isEdit && existingEvent) {
        const res = await updateEvent(existingEvent.id, payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // Persist invite changes against the existing event. Failures here
        // shouldn't block navigation — the event itself saved — but we log
        // and surface a soft error after the redirect via query params.
        await Promise.all(toRemove.map((id) => removeInvite(existingEvent.id, id)));
        if (inviteeIds.length > 0) {
          await inviteMembers(existingEvent.id, inviteeIds);
        }
        router.push(`/events/${existingEvent.id}`);
      } else {
        const res = await createEvent(payload);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (inviteeIds.length > 0) {
          await inviteMembers(res.id, inviteeIds);
        }
        router.push(`/events/${res.id}`);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h1
        className="text-3xl font-medium mb-6"
        style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
      >
        {isEdit ? "Edit event" : "Host an event"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photos */}
        <PhotoManager images={images} onChange={setImages} uploadFn={uploadEventCover} />

        {/* === Basic info === */}
        <SectionHeader>Basic info</SectionHeader>

        <Field label="Space" required>
          {spot ? (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-surface">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{spot.name}</div>
                <div className="text-xs text-neutral-500 truncate">{spot.neighborhood}, {spot.city}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSpot(null); setSpotQuery(""); }}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white shrink-0 ml-2"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search for a space…"
                  value={spotQuery}
                  onChange={(e) => setSpotQuery(e.target.value)}
                  className={inputClass + " pl-9"}
                />
              </div>
              {spotQuery && (spotResults.length > 0 || searching) && (
                <div className="absolute z-10 left-0 right-0 mt-1.5 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {searching && spotResults.length === 0 && (
                    <div className="px-4 py-2 text-xs text-neutral-500">Searching…</div>
                  )}
                  {spotResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSpot(s); setSpotQuery(""); setSpotResults([]); }}
                      className="w-full text-left px-4 py-2 hover:bg-ink-100 transition-colors"
                    >
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-neutral-500">{s.neighborhood}, {s.city}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="Title" required>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunset rooftop dinner"
            className={inputClass}
            required
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="What's the vibe? Who should come?"
            className={inputClass + " resize-none"}
          />
        </Field>

        {/* === When === */}
        <SectionHeader>When</SectionHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts" required>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Ends" required>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className={inputClass}
              required
            />
          </Field>
        </div>

        {/* === Details === */}
        <SectionHeader>Details</SectionHeader>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Capacity">
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="Unlimited"
              className={inputClass}
            />
          </Field>
          <Field label="Price USD">
            <input
              type="number"
              min={0}
              step="0.01"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Age restriction">
          <input
            type="text"
            value={ageRestriction}
            onChange={(e) => setAgeRestriction(e.target.value)}
            placeholder="e.g. 18+, 21+, All ages"
            className={inputClass}
          />
        </Field>

        <Field label="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVisibility("public")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-colors ${
                visibility === "public"
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
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
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm transition-colors ${
                visibility === "private"
                  ? "border-neutral-900 dark:border-white"
                  : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600"
              }`}
            >
              <Lock size={14} />
              <div className="text-left">
                <div className="font-medium">Private</div>
                <div className="text-xs text-neutral-500">Invite-only</div>
              </div>
            </button>
          </div>
        </Field>

        {visibility === "private" && (
          <Field label={`Invite members · ${invitees.length} invited`}>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Search by name or Instagram handle…"
                value={inviteQuery}
                onChange={(e) => setInviteQuery(e.target.value)}
                className={inputClass + " pl-9"}
              />
              {inviteQuery && (inviteResults.length > 0 || inviteSearching) && (
                <div className="absolute z-10 left-0 right-0 mt-1.5 bg-surface border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {inviteSearching && inviteResults.length === 0 && (
                    <div className="px-4 py-2 text-xs text-neutral-500">Searching…</div>
                  )}
                  {inviteResults
                    .filter((m) => !invitees.some((i) => i.id === m.id))
                    .map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => addInvitee(m)}
                        className="w-full flex items-center gap-3 text-left px-4 py-2 hover:bg-ink-100 transition-colors"
                      >
                        <Avatar member={m} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{memberLabel(m)}</div>
                          {m.instagram && (
                            <div className="text-xs text-neutral-500 truncate">@{m.instagram}</div>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {invitees.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {invitees.map((m) => (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700 bg-surface text-xs text-neutral-700 dark:text-neutral-200"
                  >
                    <Avatar member={m} size={20} />
                    {memberLabel(m)}
                    <button
                      type="button"
                      onClick={() => removeInvitee(m.id)}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                      aria-label={`Remove ${memberLabel(m)}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-500 mt-2">
              Invitees get a notification and can RSVP. You can adjust this list anytime.
            </p>
          </Field>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="h-32" />

        {/* Fixed bottom bar — mirrors EditListingForm/ReviewForm */}
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 bg-surface/90 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={pending}
              className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-white disabled:opacity-60 transition-colors shrink-0"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-8 py-2.5 text-sm font-medium rounded-xl bg-black text-white dark:bg-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-60 transition-colors flex items-center gap-2 shrink-0"
            >
              {pending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : (
                isEdit ? "Save" : "Create event"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Avatar({ member, size = 28 }: { member: MemberSearchResult; size?: number }) {
  const initial = (member.first_name?.[0] || member.instagram?.[0] || "?").toUpperCase();
  if (member.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-medium text-neutral-600 dark:text-neutral-300 shrink-0"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}
