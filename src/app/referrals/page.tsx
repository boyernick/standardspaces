"use client";

import { useState, useEffect, useTransition } from "react";
import { getReferrals, approveReferral, denyReferral } from "@/app/actions/referrals";
import Link from "next/link";
import { Check, X, UserPlus, Send } from "lucide-react";
import Navbar from "@/components/Navbar";

type Referral = {
  id: string;
  referred_name: string;
  referred_phone: string;
  status: string;
  created_at: string;
  applications: {
    first_name: string;
    last_name: string;
    instagram: string;
    city: string;
  } | null;
};

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getReferrals().then((data) => {
      setReferrals(data as Referral[]);
      setLoading(false);
    });
  }, []);

  function handleApprove(referralId: string) {
    startTransition(async () => {
      const result = await approveReferral(referralId);
      if (result.success) {
        setReferrals((prev) =>
          prev.map((r) => (r.id === referralId ? { ...r, status: "approved" } : r))
        );
      }
    });
  }

  function handleDeny(referralId: string) {
    startTransition(async () => {
      const result = await denyReferral(referralId);
      if (result.success) {
        setReferrals((prev) =>
          prev.map((r) => (r.id === referralId ? { ...r, status: "denied" } : r))
        );
      }
    });
  }

  const fontCalibre = { fontFamily: "var(--font-calibre), system-ui, sans-serif" };
  const fontMartina = { fontFamily: "var(--font-martina), Georgia, serif" };

  const pending = referrals.filter((r) => r.status === "pending_approval");
  const waitingToApply = referrals.filter((r) => r.status === "pending_apply");
  const resolved = referrals.filter((r) => r.status === "approved" || r.status === "denied");

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-lg mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-medium" style={fontMartina}>Referrals</h1>
          <Link
            href="/refer"
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
            style={fontCalibre}
          >
            Refer a friend
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-400 dark:text-neutral-500" style={fontCalibre}>Loading…</p>
        ) : referrals.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#eceae2] dark:bg-[#0e0d07]">
              <UserPlus size={20} strokeWidth={1.5} className="text-neutral-500 dark:text-neutral-400" />
            </div>
            <h3 className="text-base font-medium" style={fontMartina}>No referrals yet</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 max-w-xs mx-auto" style={fontCalibre}>
              When you invite a friend they&apos;ll show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Pending approval */}
            {pending.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
                  Needs your approval
                </h2>
                <div className="space-y-2">
                  {pending.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white" style={fontCalibre}>
                          {r.applications ? `${r.applications.first_name} ${r.applications.last_name}` : r.referred_name}
                        </p>
                        {r.applications?.instagram && (
                          <p className="text-xs text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
                            @{r.applications.instagram}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDeny(r.id)}
                          disabled={isPending}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Deny"
                        >
                          <X size={16} />
                        </button>
                        <button
                          onClick={() => handleApprove(r.id)}
                          disabled={isPending}
                          className="p-2 text-neutral-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30 rounded-lg transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Waiting to apply */}
            {waitingToApply.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
                  Invited — waiting to apply
                </h2>
                <div className="space-y-2">
                  {waitingToApply.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white" style={fontCalibre}>
                          {r.referred_name}
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500" style={fontCalibre}>
                          Invite sent
                        </p>
                      </div>
                      <Send size={14} className="text-neutral-300 dark:text-neutral-600" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Resolved */}
            {resolved.length > 0 && (
              <section>
                <h2 className="text-xs font-medium text-neutral-400 dark:text-neutral-500 tracking-wider mb-3" style={fontCalibre}>
                  Past referrals
                </h2>
                <div className="space-y-2">
                  {resolved.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl opacity-60">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white" style={fontCalibre}>
                          {r.applications ? `${r.applications.first_name} ${r.applications.last_name}` : r.referred_name}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        r.status === "approved"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`} style={fontCalibre}>
                        {r.status === "approved" ? "Approved" : "Denied"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
