"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { getReferrals, approveReferral, denyReferral, resendReferralInvite, deleteReferral } from "@/app/actions/referrals";
import { Check, X, UserPlus } from "lucide-react";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import { Button, ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

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

type Tab = "pending" | "invited" | "past";

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [justResent, setJustResent] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("pending");

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

  async function handleResend(referralId: string) {
    setRowBusy(referralId);
    const result = await resendReferralInvite(referralId);
    setRowBusy(null);
    if (result.success) {
      setJustResent((prev) => {
        const next = new Set(prev);
        next.add(referralId);
        return next;
      });
      setTimeout(() => {
        setJustResent((prev) => {
          const next = new Set(prev);
          next.delete(referralId);
          return next;
        });
      }, 2000);
    } else if (result.error) {
      alert(result.error);
    }
  }

  async function handleDelete(referralId: string) {
    if (!confirm("Delete this referral? The invite will disappear from your list.")) return;
    setRowBusy(referralId);
    const result = await deleteReferral(referralId);
    setRowBusy(null);
    if (result.success) {
      setReferrals((prev) => prev.filter((r) => r.id !== referralId));
    } else if (result.error) {
      alert(result.error);
    }
  }

  const grouped = useMemo(() => {
    const out: Record<Tab, Referral[]> = { pending: [], invited: [], past: [] };
    for (const r of referrals) {
      if (r.status === "pending_approval") out.pending.push(r);
      else if (r.status === "pending_apply") out.invited.push(r);
      else if (r.status === "approved" || r.status === "denied") out.past.push(r);
    }
    return out;
  }, [referrals]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: grouped.pending.length },
    { id: "invited", label: "Invited", count: grouped.invited.length },
    { id: "past", label: "Past", count: grouped.past.length },
  ];

  const emptyByTab: Record<Tab, { title: string; body: string }> = {
    pending: {
      title: "No referrals to approve",
      body: "When someone applies with your name, they'll show up here.",
    },
    invited: {
      title: "No invites out",
      body: "Invite a friend from the Refer page — you'll see them here once the SMS lands.",
    },
    past: {
      title: "No past referrals",
      body: "Approved or denied referrals will live here.",
    },
  };

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="Referrals"
        action={<ButtonLink href="/refer">Refer a friend</ButtonLink>}
      />

      {loading ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">Loading...</p>
      ) : referrals.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No referrals yet"
          body="Invite a friend you'd love to see around the community."
        />
      ) : (
        <>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />

          {tab === "pending" && (
            grouped.pending.length === 0 ? (
              <EmptyState icon={UserPlus} title={emptyByTab.pending.title} body={emptyByTab.pending.body} />
            ) : (
              <div className="space-y-2">
                {grouped.pending.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {r.applications ? `${r.applications.first_name} ${r.applications.last_name}` : r.referred_name}
                      </p>
                      {r.applications?.instagram && (
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
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
            )
          )}

          {tab === "invited" && (
            grouped.invited.length === 0 ? (
              <EmptyState icon={UserPlus} title={emptyByTab.invited.title} body={emptyByTab.invited.body} />
            ) : (
              <div className="space-y-2">
                {grouped.invited.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                        {r.referred_name}
                      </p>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        Invite sent
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResend(r.id)}
                        disabled={rowBusy === r.id}
                      >
                        {rowBusy === r.id ? "Sending…" : justResent.has(r.id) ? "Sent" : "Resend"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(r.id)}
                        disabled={rowBusy === r.id}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === "past" && (
            grouped.past.length === 0 ? (
              <EmptyState icon={UserPlus} title={emptyByTab.past.title} body={emptyByTab.past.body} />
            ) : (
              <div className="space-y-2">
                {grouped.past.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl opacity-60">
                    <div>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white">
                        {r.applications ? `${r.applications.first_name} ${r.applications.last_name}` : r.referred_name}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "approved"
                        ? "bg-ink-100 text-neutral-700 dark:text-neutral-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {r.status === "approved" ? "Approved" : "Denied"}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </PageShell>
  );
}
