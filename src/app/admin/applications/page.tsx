import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/ui/PageHeader";
import ApplicationList from "./ApplicationList";

export default async function AdminApplicationsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <PageShell navbar={<Navbar />} maxWidth="md">
      <PageHeader title="Applications" />
      <ApplicationList applications={applications ?? []} />
    </PageShell>
  );
}
