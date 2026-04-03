import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import { List, Users } from "lucide-react";

export default async function AdminPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const [{ count: spotCount }, { count: appCount }] = await Promise.all([
    supabase.from("spots").select("*", { count: "exact", head: true }),
    supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-center mb-10">Admin</h1>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/admin/listings"
              className="group flex items-start gap-4 p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-950 transition-colors">
                <List size={18} className="text-neutral-500 dark:text-neutral-400 group-hover:text-brand-900 transition-colors" />
              </div>
              <div>
                <h2 className="text-sm font-medium">Listings</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {spotCount ?? 0} published spot{spotCount !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>

            <Link
              href="/admin/applications"
              className="group flex items-start gap-4 p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 group-hover:bg-brand-50 dark:group-hover:bg-brand-950 transition-colors">
                <Users size={18} className="text-neutral-500 dark:text-neutral-400 group-hover:text-brand-900 transition-colors" />
              </div>
              <div>
                <h2 className="text-sm font-medium">Applications</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {appCount ?? 0} pending application{appCount !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
