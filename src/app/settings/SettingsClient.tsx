"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  updateNotificationPreferences,
  updateNotificationPrefs,
  deleteAccount,
  type NotificationPrefs,
} from "@/app/actions/profile";
import { CITIES } from "@/lib/cities";
import { citySlugFromName } from "@/lib/cities";
import PageHeader from "@/components/ui/PageHeader";

type Props = {
  phone: string;
  city: string;
  smsNotifications: boolean;
  notificationPrefs: NotificationPrefs;
};

export default function SettingsClient({ phone, city, smsNotifications, notificationPrefs }: Props) {
  const router = useRouter();
  const [currentCity, setCurrentCity] = useState(city);
  const [sms, setSms] = useState(smsNotifications);
  const [prefs, setPrefs] = useState<NotificationPrefs>(notificationPrefs);
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

  async function togglePref(key: keyof NotificationPrefs) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await updateNotificationPrefs(next);
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

  return (
    <>
      <PageHeader title="Settings" />

      {/* Notifications */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">Notifications</h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl divide-y divide-neutral-200 dark:divide-neutral-800">
          {[
            { label: "SMS notifications", sub: "Referral requests and updates", value: sms, onToggle: handleSmsToggle },
            { label: "Social", sub: "Follows, check-ins, and shared RSVPs", value: prefs.social, onToggle: () => togglePref("social") },
            { label: "Events", sub: "Invites, reminders, and host updates", value: prefs.events, onToggle: () => togglePref("events") },
            { label: "Recommendations", sub: "Updates on spaces you submitted", value: prefs.recommendations, onToggle: () => togglePref("recommendations") },
            { label: "Discovery", sub: "New spaces and events in your city", value: prefs.curation, onToggle: () => togglePref("curation") },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-neutral-900 dark:text-white">{row.label}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  {row.sub}
                </p>
              </div>
              <button
                onClick={row.onToggle}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  row.value ? "bg-neutral-900 dark:bg-white" : "bg-neutral-200 dark:bg-neutral-700"
                }`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  row.value ? "left-[18px]" : "left-0.5"
                }`} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* City */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">City</h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <select
            value={currentCity}
            onChange={(e) => handleCityChange(e.target.value)}
            className="w-full text-sm bg-transparent text-neutral-900 dark:text-white focus:outline-none cursor-pointer"
          >
            {CITIES.map((c) => (
              <option key={c.slug} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Appearance */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">Appearance</h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <button
            onClick={handleThemeChange}
            className="flex w-full items-center justify-between text-sm text-neutral-900 dark:text-white"
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
        <h2 className="eyebrow mb-3">Account</h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mb-0.5">Phone</p>
          <p className="text-sm text-neutral-900 dark:text-white">{formatPhone(phone)}</p>
        </div>
      </section>

      {/* Delete account */}
      <section className="mb-8">
        <h2 className="eyebrow mb-3">Delete account</h2>
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
          {showDeleteConfirm ? (
            <div>
              <p className="text-sm text-red-600 mb-3">
                Are you sure? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 text-sm border border-neutral-200 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete account"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-500 hover:text-red-600 transition-colors"
            >
              Delete account
            </button>
          )}
        </div>
      </section>
    </>
  );
}
