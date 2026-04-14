import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { List, Users, Sparkles, UserRound } from "lucide-react";
import PageShell from "@/components/ui/PageShell";

export default async function AdminPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const [
    { count: spotCount },
    { count: appCount },
    { count: recCount },
    { count: memberCount },
  ] = await Promise.all([
    supabase.from("spots").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("recommendations").select("*", { count: "exact", head: true }).neq("status", "published"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  const cards = [
    {
      href: "/admin/recommendations",
      icon: Sparkles,
      title: "Recommendations",
      subtitle: `${recCount ?? 0} awaiting review`,
    },
    {
      href: "/admin/listings",
      icon: List,
      title: "Listings",
      subtitle: `${spotCount ?? 0} published spot${spotCount !== 1 ? "s" : ""}`,
    },
    {
      href: "/admin/applications",
      icon: Users,
      title: "Applications",
      subtitle: `${appCount ?? 0} pending application${appCount !== 1 ? "s" : ""}`,
    },
    {
      href: "/admin/members",
      icon: UserRound,
      title: "Members",
      subtitle: `${memberCount ?? 0} member${memberCount !== 1 ? "s" : ""}`,
    },
  ];

  return (
    <PageShell maxWidth="md">
      <h1 className="mb-10 text-center">Admin</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ href, icon: Icon, title, subtitle }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-950 transition-colors">
              <Icon size={18} className="text-neutral-500 dark:text-neutral-400 group-hover:text-brand-500 transition-colors" />
            </div>
            <div>
              {/* Using a span; the page's main h1 is "Admin" — card titles
                  aren't heading-level. */}
              <span className="block text-sm font-medium">{title}</span>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
