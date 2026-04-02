import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import ApplicationList from "./ApplicationList";

export default async function AdminApplicationsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-medium mb-6" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
          Applications
        </h1>
        <ApplicationList applications={applications ?? []} />
      </div>
    </div>
  );
}
