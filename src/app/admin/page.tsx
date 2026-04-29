import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import AdminSectionNav from "@/components/admin/SectionNav";

const fmt = new Intl.NumberFormat("en-US");

function StatTile({
  label,
  value,
  delta,
  caption,
  actionable,
}: {
  label: string;
  value: number;
  delta?: number;
  caption?: string;
  actionable?: boolean;
}) {
  const sub =
    caption ??
    (delta !== undefined ? (delta > 0 ? `+${delta} this week` : "No change this week") : null);
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">{label}</p>
        {actionable && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-neutral-900 dark:bg-white"
            aria-label="Needs attention"
          />
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{fmt.format(value)}</p>
      {sub && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 tabular-nums">{sub}</p>
      )}
    </div>
  );
}

export default async function AdminPage() {
  const supabase = createAdminClient();

  const nowIso = new Date().toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const monthAheadIso = new Date(Date.now() + 30 * 86_400_000).toISOString();

  const [
    { count: spotCount },
    { count: appPendingCount },
    { count: recScrapedCount },
    { count: memberCount },
    { count: spotsThisWeek },
    { count: membersThisWeek },
    { count: recsThisWeek },
    { count: appsThisWeek },
    { count: pendingReferralsCount },
    { count: checkinsThisWeek },
    { count: onboardingStuckCount },
    { count: upcomingEventsCount },
  ] = await Promise.all([
    supabase.from("spots").select("*", { count: "exact", head: true }),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("recommendations")
      .select("*", { count: "exact", head: true })
      .eq("status", "scraped"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("spots")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("recommendations")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("referrals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("user_checkins")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgoIso),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("onboarded", false),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "published")
      .gte("starts_at", nowIso)
      .lte("starts_at", monthAheadIso),
  ]);

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <AdminSectionNav />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatTile
          label="Awaiting review"
          value={recScrapedCount ?? 0}
          delta={recsThisWeek ?? 0}
          actionable={(recScrapedCount ?? 0) > 0}
        />
        <StatTile
          label="Pending applications"
          value={appPendingCount ?? 0}
          delta={appsThisWeek ?? 0}
          actionable={(appPendingCount ?? 0) > 0}
        />
        <StatTile
          label="Spaces"
          value={spotCount ?? 0}
          delta={spotsThisWeek ?? 0}
        />
        <StatTile
          label="Members"
          value={memberCount ?? 0}
          delta={membersThisWeek ?? 0}
        />
        <StatTile
          label="Pending referrals"
          value={pendingReferralsCount ?? 0}
          actionable={(pendingReferralsCount ?? 0) > 0}
          caption={
            (pendingReferralsCount ?? 0) > 0 ? "Awaiting decision" : "Nothing pending"
          }
        />
        <StatTile
          label="Check-ins this week"
          value={checkinsThisWeek ?? 0}
          caption="Last 7 days"
        />
        <StatTile
          label="Onboarding stuck"
          value={onboardingStuckCount ?? 0}
          actionable={(onboardingStuckCount ?? 0) > 0}
          caption={
            (onboardingStuckCount ?? 0) > 0
              ? "Signed up, not finished"
              : "Everyone is onboarded"
          }
        />
        <StatTile
          label="Upcoming events"
          value={upcomingEventsCount ?? 0}
          caption="Next 30 days"
        />
      </div>
    </PageShell>
  );
}
