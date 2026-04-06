"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, X, Check, CircleUserRound, Heart, Bookmark, CircleCheck } from "lucide-react";
import { updateProfile } from "@/app/actions/profile";
import { citySlugFromName, CITIES } from "@/lib/cities";
import { CATEGORY_LABELS } from "@/lib/types";
import { Spot } from "@/lib/types";

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
};

type Tab = "favorites" | "checkins" | "wishlist";

export default function ProfileClient({
  profile,
  stats,
  isOwn,
  favoriteSpots = [],
  wishlistSpots,
  checkinSpots = [],
}: {
  profile: Profile;
  stats: Stats;
  isOwn: boolean;
  favoriteSpots?: Spot[];
  wishlistSpots?: Spot[];
  checkinSpots?: Spot[];
  checkinCounts?: Record<string, number>;
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

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const currentSpots =
    activeTab === "favorites"
      ? favoriteSpots
      : activeTab === "checkins"
        ? checkinSpots
        : wishlistSpots ?? [];

  const tabs: { key: Tab; icon: typeof Heart; label: string }[] = [
    { key: "favorites", icon: Heart, label: "Favorites" },
    { key: "checkins", icon: CircleCheck, label: "Check-ins" },
    ...(isOwn && wishlistSpots
      ? [{ key: "wishlist" as Tab, icon: Bookmark, label: "Wishlist" }]
      : []),
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Profile header */}
      {editing ? (
        <div className="mb-6">
          {/* Avatar upload */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
                  <CircleUserRound size={32} strokeWidth={1.5} className="text-white dark:text-neutral-900" />
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

          {/* Edit form */}
          <div className="space-y-3 max-w-sm mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className={inputStyle}
                style={fontCalibre}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className={inputStyle}
                style={fontCalibre}
              />
            </div>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="Instagram handle"
              className={inputStyle}
              style={fontCalibre}
            />
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
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="Tell other members about yourself"
              rows={3}
              className={`${inputStyle} resize-none`}
              style={fontCalibre}
            />
            <p className="text-right text-[10px] text-neutral-300 dark:text-neutral-600" style={fontCalibre}>
              {bio.length}/160
            </p>
            {error && <p className="text-xs text-red-600" style={fontCalibre}>{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                style={fontCalibre}
              >
                <X size={14} /> Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
                style={fontCalibre}
              >
                <Check size={14} /> {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          {/* Avatar + name row */}
          <div className="flex items-center gap-5 mb-4">
            <div className="shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center">
                  <CircleUserRound size={32} strokeWidth={1.5} className="text-white dark:text-neutral-900" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-medium leading-tight" style={fontMartina}>{displayName}</h1>
              {profile.instagram && (
                <p className="text-sm text-neutral-400 dark:text-neutral-500 mt-1" style={fontCalibre}>
                  @{profile.instagram.replace("@", "")}
                </p>
              )}
              {profile.city && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1" style={fontCalibre}>
                  {profile.city}
                </p>
              )}
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-4" style={fontCalibre}>
              {profile.bio}
            </p>
          )}

          {/* Edit profile button */}
          {isOwn && (
            <button
              onClick={() => setEditing(true)}
              className="w-full py-1.5 text-xs font-medium border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
              style={fontCalibre}
            >
              Edit profile
            </button>
          )}
        </div>
      )}

      {/* Tab bar */}
      <div className="border-t border-neutral-100 dark:border-neutral-800">
        <div className="flex">
          {tabs.map(({ key, icon: Icon, label }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 transition-colors relative ${
                  isActive
                    ? "text-neutral-900 dark:text-white"
                    : "text-neutral-400 dark:text-neutral-500"
                }`}
                aria-label={label}
              >
                {key === "favorites" && isActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                ) : key === "checkins" && isActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <path d="m9 12 2 2 4-4" stroke="var(--color-surface)" strokeWidth="2" />
                  </svg>
                ) : key === "wishlist" && isActive ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
                ) : (
                  <Icon size={20} strokeWidth={1.5} />
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-4px)] h-0.5 bg-neutral-900 dark:bg-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spot grid */}
      {currentSpots.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
            {activeTab === "favorites" && "No favorites yet"}
            {activeTab === "checkins" && "No check-ins yet"}
            {activeTab === "wishlist" && "Wishlist is empty"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 mt-0.5">
          {currentSpots.map((spot) => (
            <Link
              key={spot.id}
              href={`/${citySlugFromName(spot.city)}/${spot.id}`}
              className="relative aspect-square overflow-hidden rounded-md group"
            >
              <img
                src={spot.images[0]}
                alt={spot.name}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 pt-10">
                <h4 className="text-xs font-medium text-white truncate" style={fontCalibre}>{spot.name}</h4>
                <p className="text-[10px] text-white/70 truncate" style={fontCalibre}>
                  {spot.neighborhood}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
