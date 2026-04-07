"use client";

import { useState, useRef } from "react";
import { Camera } from "lucide-react";
import { completeOnboarding } from "@/app/actions/profile";
import { citySlugFromName } from "@/lib/cities";

type Props = {
  profile: {
    firstName: string;
    lastName: string;
    avatarUrl: string;
    city: string;
  };
};

export default function OnboardingClient({ profile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [avatarPreview, setAvatarPreview] = useState(profile.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const initials = `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.url);
      } else {
        const data = await res.json();
        setError(data.error || "Upload failed");
        setAvatarPreview(avatarUrl);
      }
    } catch {
      setError("Upload failed");
      setAvatarPreview(avatarUrl);
    }

    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await completeOnboarding({
      avatar_url: avatarUrl || undefined,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Full page navigation to bypass middleware cache
    window.location.href = `/${citySlugFromName(profile.city)}`;
  }

  async function handleSkip() {
    setLoading(true);
    await completeOnboarding({});
    window.location.href = `/${citySlugFromName(profile.city)}`;
  }

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-surface)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.svg" alt="Standard Spaces" className="h-6 w-6 dark:invert" />
          </div>
          <h1 className="text-xl font-medium mb-1" style={fontMartina}>Add a profile photo</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400" style={fontCalibre}>
            Other members will be able to see your profile.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full overflow-hidden group"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-500 flex items-center justify-center">
                  {initials ? (
                    <span className="text-white text-xl font-medium" style={fontCalibre}>{initials}</span>
                  ) : (
                    <Camera size={28} className="text-white/60" />
                  )}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={22} className="text-white" />
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <p className="text-center text-xs text-neutral-400 dark:text-neutral-500 mb-2" style={fontCalibre}>
            Tap to upload a photo
          </p>

          {error && <p className="text-xs text-red-600 text-center" style={fontCalibre}>{error}</p>}

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full py-2.5 text-sm font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-50"
            style={fontCalibre}
          >
            {loading ? "Saving..." : "Continue"}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="w-full py-2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
            style={fontCalibre}
          >
            Skip for now
          </button>
        </form>
      </div>
    </div>
  );
}
