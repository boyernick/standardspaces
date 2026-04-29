import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import AdminSectionNav from "@/components/admin/SectionNav";
import ListingsTable from "./ListingsTable";

export default async function AdminListingsPage() {
  const supabase = createAdminClient();
  const { data: spots } = await supabase
    .from("spots")
    .select("id, name, category, neighborhood, city, images")
    .order("name");

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <AdminSectionNav />
      <ListingsTable spots={spots ?? []} />
    </PageShell>
  );
}
