"use client";

import { useState } from "react";

type Application = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  instagram: string | null;
  status: string;
  created_at: string;
  referred_by_name: string | null;
  referred_by_phone: string | null;
  referral_status: string | null;
};

export default function ApplicationList({ applications: initial }: { applications: Application[] }) {
  const [applications, setApplications] = useState(initial);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const filtered = filter === "all" ? applications : applications.filter((a) => a.status === filter);

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessing(id);
    const res = await fetch(`/api/admin/applications/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: id }),
    });

    if (res.ok) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: action === "approve" ? "approved" : "rejected" } : a))
      );
    }
    setProcessing(null);
  }

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <div>
      <div className="flex gap-2 mb-6" style={fontCalibre}>
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f ? "bg-black dark:bg-white text-white dark:text-black border-black dark:border-white" : "border-black/15 dark:border-white/15 text-black/60 dark:text-white/60 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-black/40 dark:text-white/40" style={fontCalibre}>No applications.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <div key={app.id} className="border border-black/10 dark:border-white/10 rounded-lg p-4 bg-white dark:bg-neutral-900">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-black dark:text-white" style={fontCalibre}>{app.first_name} {app.last_name}</p>
                  <p className="text-xs text-black/50 dark:text-white/50" style={fontCalibre}>{app.phone}</p>
                  {app.instagram && (
                    <p className="text-xs text-black/40 dark:text-white/40 mt-0.5" style={fontCalibre}>@{app.instagram.replace("@", "")}</p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    app.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : app.status === "approved"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                  style={fontCalibre}
                >
                  {app.status}
                </span>
              </div>
              {app.referred_by_name && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-xs text-black/40 dark:text-white/40" style={fontCalibre}>
                    Referred by: {app.referred_by_name}{app.referred_by_phone ? ` (${app.referred_by_phone})` : ""}
                  </span>
                  {app.referral_status && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      app.referral_status === "approved"
                        ? "bg-green-100 text-green-700"
                        : app.referral_status === "denied"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`} style={fontCalibre}>
                      {app.referral_status}
                    </span>
                  )}
                </div>
              )}
              <p className="text-xs text-black/30 dark:text-white/30 mt-2" style={fontCalibre}>
                {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
              {app.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleAction(app.id, "approve")}
                    disabled={processing === app.id}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors disabled:opacity-50"
                    style={fontCalibre}
                  >
                    {processing === app.id ? "..." : "Approve & send SMS"}
                  </button>
                  <button
                    onClick={() => handleAction(app.id, "reject")}
                    disabled={processing === app.id}
                    className="px-3 py-1.5 text-xs font-medium text-black/60 dark:text-white/60 border border-black/15 dark:border-white/15 rounded-full hover:border-black/30 dark:hover:border-white/30 transition-colors disabled:opacity-50"
                    style={fontCalibre}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
