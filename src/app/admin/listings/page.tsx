import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/ui/PageHeader";
import ListingsTable from "./ListingsTable";

export default async function AdminListingsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: spots } = await supabase
    .from("spots")
    .select("id, name, category, neighborhood, city, images")
    .order("name");

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <PageHeader title="Listings" />
      <ListingsTable spots={spots ?? []} />
    </PageShell>
  );
}
