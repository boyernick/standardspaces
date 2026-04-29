import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import PageShell from "@/components/ui/PageShell";
import AdminSectionNav from "@/components/admin/SectionNav";
import ApplicationList from "./ApplicationList";

export default async function AdminApplicationsPage() {
  const supabase = createAdminClient();
  const { data: applications } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <AdminSectionNav />
      <ApplicationList applications={applications ?? []} />
    </PageShell>
  );
}
