"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { getInitials } from "@/lib/initials";
import { updateProfile } from "@/app/actions/profile";
import { toggleFollow } from "@/app/actions/follows";
import { citySlugFromName, CITIES } from "@/lib/cities";
import { CATEGORY_LABELS } from "@/lib/types";
import { Spot, EventRecord } from "@/lib/types";
import { NewBadge } from "@/lib/new-badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BUCKET_LABELS, bucketForScore } from "@/lib/ratings";
import FollowListModal from "@/components/FollowListModal";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  instagram: string | null;
  bio: string | null;
  avatar_url: string | null;
  city: string | null;
  created_at: string;
};

type Stats = {
  favorites: number;
  checkins: number;
  referrals: number;
  followers: number;
  following: number;
};

type Tab = "favorites" | "checkins" | "wishlist" | "attended";

export default function ProfileClient({
  profile,
  stats,
  isOwn,
  isFollowing: initialFollowing = false,
  favoriteSpots = [],
  wishlistSpots,
  checkinSpots = [],
  attendedEvents = [],
  ratings = {},
}: {
  profile: Profile;
  stats: Stats;
  isOwn: boolean;
  isFollowing?: boolean;
  favoriteSpots?: Spot[];
  wishlistSpots?: Spot[];
  checkinSpots?: Spot[];
  checkinCounts?: Record<string, number>;
  attendedEvents?: EventRecord[];
  ratings?: Record<string, number>;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.first_name || "");
  const [lastName, setLastName] = useState(profile.last_name || "");
  const [instagram, setInstagram] = useState(profile.instagram || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar_url || "");
  const [uploading, setUploading] = useState(false);
  const [city, setCity] = useState(profile.city || "Miami");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("favorites");
  const [following, setFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [followLoading, setFollowLoading] = useState(false);
  // Tapping the follower/following counts opens a list modal. `null`
  // means closed; the active kind drives the modal's title + fetch.
  const [followListKind, setFollowListKind] = useState<"followers" | "following" | null>(null);

  const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Member";

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };
  const inputStyle = "w-full px-4 py-2.5 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg bg-transparent text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors";

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/upload-avatar", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.url);
      } else {
        setAvatarPreview(avatarUrl);
      }
    } catch {
      setAvatarPreview(avatarUrl);
    }

    setUploading(false);
  }

  async function handleSave() {
    setError("");
    setSaving(true);

    const result = await updateProfile({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      instagram: instagram.trim(),
      bio: bio.trim(),
      avatar_url: avatarUrl,
      city,
    });

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  function handleCancel() {
    setFirstName(profile.first_name || "");
    setLastName(profile.last_name || "");
    setInstagram(profile.instagram || "");
    setBio(profile.bio || "");
    setCity(profile.city || "Miami");
    setAvatarUrl(profile.avatar_url || "");
    setAvatarPreview(profile.avatar_url || "");
    setEditing(false);
    setError("");
  }

  async function handleFollow() {
    setFollowLoading(true);
    setFollowing((prev) => !prev);
    setFollowerCount((prev) => prev + (following ? -1 : 1));
    const result = await toggleFollow(profile.id);
    setFollowing(result.following);
    setFollowerCount((prev) => {
      // Correct if optimistic update was wrong
      if (result.following !== !following) {
        return prev + (result.following ? 1 : -1);
      }
      return prev;
    });
    setFollowLoading(false);
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const currentSpots =
    activeTab === "favorites"
      ? favoriteSpots
      : activeTab === "checkins"
        ? checkinSpots
        : activeTab === "wishlist"
          ? wishlistSpots ?? []
          : [];

  const tabs: { key: Tab; label: string }[] = [
    { key: "favorites", label: "Favorites" },
    { key: "checkins", label: "Check-ins" },
    ...(isOwn && wishlistSpots
      ? [{ key: "wishlist" as Tab, label: "Wishlist" }]
      : []),
    // Events always renders — empty state handled below. Internal key
    // stays `attended` (it's wired to prop + state shape across the
    // profile routes); only the user-facing label changes.
    { key: "attended" as Tab, label: "Events" },
  ];

  return (
    <>
      {/* Profile header */}
      {editing ? (
        <div className="mb-6">
          {/* Avatar upload */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full bg-surface-dark dark:bg-[#F7F7F3] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-3xl text-[#F7F7F3] dark:text-surface-dark"
                  style={fontMartina}
                >
                  {getInitials(displayName)}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-neutral-900 dark:bg-white rounded-full flex items-center justify-center shadow-lg"
              >
                <Camera size={12} className="text-white dark:text-neutral-900" />
              </button>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Edit form. Each field is wrapped in a <label> so the caption
              doubles as a click target for the input it describes — and
              so assistive tech reads "First name" rather than inferring
              from placeholder copy that disappears on focus. */}
          <div className="space-y-4 max-w-sm mx-auto">
            <div className="flex gap-2">
              <label className="flex-1 block">
                <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 pl-4" style={fontCalibre}>
                  First name
                </span>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputStyle}
                  style={fontCalibre}
                />
              </label>
              <label className="flex-1 block">
                <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 pl-4" style={fontCalibre}>
                  Last name
                </span>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputStyle}
                  style={fontCalibre}
                />
              </label>
            </div>
            <label className="block">
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 pl-4" style={fontCalibre}>
                Instagram
              </span>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@username"
                className={inputStyle}
                style={fontCalibre}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 pl-4" style={fontCalibre}>
                City
              </span>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={`${inputStyle} appearance-none pr-10 cursor-pointer`}
                  style={fontCalibre}
                >
                  {CITIES.map((c) => (
                    <option key={c.slug} value={c.name}>{c.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </label>
            <label className="block">
              <span className="flex items-baseline justify-between mb-1.5 px-4" style={fontCalibre}>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Bio
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  {bio.length}/160
                </span>
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
                placeholder="Tell other members about yourself"
                rows={3}
                className={`${inputStyle} resize-none`}
                style={fontCalibre}
              />
            </label>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                style={fontCalibre}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
                style={fontCalibre}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          {/* Threads-style header. Two stacked rows share a right column
              sized to the avatar so the Instagram icon below sits
              centered under the photo:

                ┌─────────────────────┬──────────┐
                │ Name                │  AVATAR  │
                │ City                │          │
                ├─────────────────────┼──────────┤
                │ N followers · N ...│   [IG]   │
                └─────────────────────┴──────────┘
                [Edit profile / Follow — full width]

              Bio sits below the city within the name column so it
              wraps inside the avatar-indented width, matching how
              Threads handles bio-under-handle. */}
          <div className="flex items-center gap-4 mb-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-medium leading-tight" style={fontMartina}>{displayName}</h1>
              {profile.city && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1" style={fontCalibre}>
                  {profile.city}
                </p>
              )}
              {profile.bio && (
                <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-2 whitespace-pre-line" style={fontCalibre}>
                  {profile.bio}
                </p>
              )}
            </div>
            <div className="shrink-0 w-20">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full bg-surface-dark dark:bg-[#F7F7F3] border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-3xl text-[#F7F7F3] dark:text-surface-dark"
                  style={fontMartina}
                >
                  {getInitials(displayName)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="min-w-0 flex-1 flex items-center gap-2 text-sm" style={fontCalibre}>
              <button
                type="button"
                onClick={() => setFollowListKind("followers")}
                className="rounded-sm hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              >
                <span className="font-medium text-neutral-900 dark:text-white">{followerCount}</span>
                <span className="text-neutral-400 dark:text-neutral-500 ml-1">{followerCount === 1 ? "follower" : "followers"}</span>
              </button>
              <span className="text-neutral-400 dark:text-neutral-500">·</span>
              <button
                type="button"
                onClick={() => setFollowListKind("following")}
                className="rounded-sm hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
              >
                <span className="font-medium text-neutral-900 dark:text-white">{stats.following}</span>
                <span className="text-neutral-400 dark:text-neutral-500 ml-1">following</span>
              </button>
            </div>
            <div className="shrink-0 w-20 flex justify-center">
              {profile.instagram && (
                <a
                  href={`https://instagram.com/${profile.instagram.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Instagram — ${profile.instagram.replace("@", "")}`}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* Primary action row. Own view: Edit profile + Settings side
              by side (each flex-1 so they split the width evenly — this
              is also where the nav menu's Settings entry used to live;
              hoisting it here puts it one tap away on the page people
              actually go to when they want to change something).
              Member view: Follow / Following full-width. */}
          {isOwn ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setEditing(true)}
                className="flex-1"
                style={fontCalibre}
              >
                Edit profile
              </Button>
              <ButtonLink
                variant="secondary"
                size="md"
                href="/settings"
                className="flex-1"
                style={fontCalibre}
              >
                Settings
              </ButtonLink>
            </div>
          ) : (
            <Button
              variant={following ? "secondary" : "primary"}
              size="md"
              onClick={handleFollow}
              disabled={followLoading}
              className="w-full"
              style={fontCalibre}
            >
              {following ? "Following" : "Follow"}
            </Button>
          )}
        </div>
      )}

      {/* Tab bar */}
      {!editing && (
      <div>
      <div className="flex items-center mb-6">
          {tabs.map(({ key, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative flex-1 px-3 py-2 text-sm transition-colors -mb-px ${
                  isActive
                    ? "text-neutral-900 dark:text-white font-medium"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
                style={fontCalibre}
              >
                {label}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-neutral-900 dark:bg-white" />
                )}
              </button>
            );
          })}
      </div>

      {/* Grid */}
      {activeTab === "attended" ? (
        attendedEvents.length === 0 ? (
          <div className="px-6 pt-4 pb-10 text-center">
            <div className="mx-auto mb-6 w-full max-w-[480px] aspect-[16/9] relative">
              <Image
                src="/empty-states/events-nullstate.png"
                alt=""
                aria-hidden="true"
                fill
                sizes="480px"
                className="object-contain select-none pointer-events-none dark:opacity-40 dark:mix-blend-screen"
                style={{
                  WebkitMaskImage:
                    "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                  maskImage:
                    "radial-gradient(ellipse at center, black 35%, transparent 78%)",
                }}
              />
            </div>
            <h3 className="text-base font-medium">No events yet</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto">
              {isOwn
                ? "Events you RSVP yes to will show up here."
                : "Nothing on their calendar yet."}
            </p>
            {isOwn && (
              <div className="mt-6">
                <ButtonLink
                  href={`/${citySlugFromName(profile.city || "Miami")}?events=1`}
                  variant="secondary"
                >
                  Browse events
                </ButtonLink>
              </div>
            )}
          </div>
        ) : (
          // iOS-style list rows. Thumb (64px) · title + date · chevron,
          // with 1px dividers between rows and no bottom border on the
          // last item so the list blends into the surrounding layout.
          <ul className="mt-0.5 mb-12 divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {attendedEvents.map((event) => {
              const d = new Date(event.starts_at);
              return (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-center gap-3 py-3 group"
                  >
                    <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
                      {event.cover_image_url ? (
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        // Calendar-date fallback preserves the
                        // timestamp as a visual anchor when no cover
                        // image is set.
                        <span className="text-xl font-semibold text-neutral-300 dark:text-neutral-700" style={fontMartina}>
                          {d.getDate()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate" style={fontCalibre}>
                        {event.title}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5" style={fontCalibre}>
                        {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-neutral-300 dark:text-neutral-600" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      ) : currentSpots.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
            {activeTab === "favorites" && "No favorites yet"}
            {activeTab === "checkins" && "No check-ins yet"}
            {activeTab === "wishlist" && "Wishlist is empty"}
          </p>
        </div>
      ) : (
        // Spot list rows. NewBadge sits inline with the name rather
        // than overlaid on the thumb — the row is short, so a tiny
        // badge on a 64px image would be hard to read anyway. For
        // check-ins, the rating pill is right-aligned just before the
        // chevron so scores are easy to scan down the column.
        <ul className="mt-0.5 mb-12 divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
          {currentSpots.map((spot) => {
            // Title-case category/subcategory slugs ("speakeasy" →
            // "Speakeasy", "rooftop-bar" → "Rooftop Bar") per the
            // app-wide typography rule against all-caps labels.
            const tc = (s: string) =>
              s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const metaLine = [
              spot.neighborhood,
              ...(spot.category ?? []).map(tc),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={spot.id}>
                <Link
                  href={`/${citySlugFromName(spot.city)}/${spot.id}`}
                  className="flex items-center gap-3 py-3 group"
                >
                  <div className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-neutral-100 dark:bg-neutral-900">
                    <img
                      src={spot.images[0]}
                      alt={spot.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate" style={fontCalibre}>
                        {spot.name}
                      </p>
                      <NewBadge spot={spot} compact />
                    </div>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 truncate mt-0.5" style={fontCalibre}>
                      {metaLine}
                    </p>
                  </div>
                  {activeTab === "checkins" && ratings[spot.id] !== undefined && (
                    // Show the sentiment label ("Loved it", "Liked
                    // it", ...) rather than the raw score. The numeric
                    // score is an internal artifact of the Beli-style
                    // bucket+rank algorithm and shouldn't leak into
                    // the user-facing list; the bucket label is what
                    // the user actually chose.
                    <span
                      className="shrink-0 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded-md"
                      style={fontCalibre}
                    >
                      {BUCKET_LABELS[bucketForScore(ratings[spot.id])]}
                    </span>
                  )}
                  <ChevronRight size={16} className="shrink-0 text-neutral-300 dark:text-neutral-600" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </div>
      )}

      {/* Followers / Following list modal. Always mounted so the open
          animation plays on the first tap; internal state gates the
          portal render. */}
      <FollowListModal
        userId={profile.id}
        kind={followListKind ?? "followers"}
        open={followListKind !== null}
        onClose={() => setFollowListKind(null)}
      />
    </>
  );
}
