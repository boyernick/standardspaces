"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, updateNotificationPreferences, deleteAccount } from "@/app/actions/profile";
import { CITIES } from "@/lib/cities";
import { citySlugFromName } from "@/lib/cities";

type Props = {
  phone: string;
  city: string;
  smsNotifications: boolean;
};

export default function SettingsClient({ phone, city, smsNotifications }: Props) {
  const router = useRouter();
  const [currentCity, setCurrentCity] = useState(city);
  const [sms, setSms] = useState(smsNotifications);
  const [themeMode, setThemeMode] = useState<"auto" | "light" | "dark">(() => {
    if (typeof window === "undefined") return "auto";
    const stored = localStorage.getItem("theme");
    return stored === "dark" || stored === "light" ? stored : "auto";
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function formatPhone(p: string) {
    const digits = p.replace(/\D/g, "");
    const national = digits.startsWith("1") ? digits.slice(1) : digits;
    if (national.length === 10) {
      return `(${national.slice(0, 3)}) ${national.slice(3, 6)} - ${national.slice(6)}`;
    }
    return p;
  }

  async function handleCityChange(newCity: string) {
    setCurrentCity(newCity);
    await updateProfile({ city: newCity });
    router.push(`/${citySlugFromName(newCity)}`);
  }

  async function handleSmsToggle() {
    const newVal = !sms;
    setSms(newVal);
    await updateNotificationPreferences({ sms_notifications: newVal });
  }

  function handleThemeChange() {
    let nextMode: "auto" | "light" | "dark";
    if (themeMode === "auto") nextMode = "light";
    else if (themeMode === "light") nextMode = "dark";
    else nextMode = "auto";

    setThemeMode(nextMode);

    let dark: boolean;
    if (nextMode === "auto") {
      localStorage.removeItem("theme");
      dark = typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;
    } else {
      localStorage.setItem("theme", nextMode);
      dark = nextMode === "dark";
    }
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.backgroundColor = dark ? "#13120A" : "";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#13120A" : "#F7F7F3");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const result = await deleteAccount();
    if (result.error) {
      setDeleting(false);
      return;
    }
    router.push("/");
  }

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="text-xl font-medium mb-8" style={fontMartina}>Settings</h1>

      {/* Notifications */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
          Notifications
        </h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-900 dark:text-white" style={fontCalibre}>SMS notifications</p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5" style={fontCalibre}>
                Referral requests and updates
              </p>
            </div>
            <button
              onClick={handleSmsToggle}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                sms ? "bg-brand-500" : "bg-neutral-200 dark:bg-neutral-700"
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                sms ? "left-[18px]" : "left-0.5"
              }`} />
            </button>
          </div>
        </div>
      </section>

      {/* City */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
          City
        </h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <select
            value={currentCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full text-sm bg-transparent text-neutral-900 dark:text-white focus:outline-none cursor-pointer"
            style={fontCalibre}
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
          Appearance
        </h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <button
            onClick={handleThemeChange}
            className="flex w-full items-center justify-between text-sm text-neutral-900 dark:text-white"
            style={fontCalibre}
          >
            Theme
            <span className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">
              {themeMode}
            </span>
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
          Account
        </h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5" style={fontCalibre}>Phone</p>
          <p className="text-sm text-neutral-900 dark:text-white" style={fontCalibre}>{formatPhone(phone)}</p>
        </div>
      </section>

      {/* Delete account */}
      <section className="mb-8">
        <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
          Delete account
        </h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          {showDeleteConfirm ? (
            <div>
              <p className="text-sm text-red-600 mb-3" style={fontCalibre}>
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                  style={fontCalibre}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  style={fontCalibre}
                >
                  {deleting ? "Deleting..." : "Delete account"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-500 hover:text-red-600 transition-colors"
              style={fontCalibre}
            >
              Delete account
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
