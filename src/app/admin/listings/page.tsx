import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import ListingsTable from "./ListingsTable";

export default async function AdminListingsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: spots } = await supabase
    .from("spots")
    .select("id, name, category, neighborhood, city, images")
    .order("name");

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-medium mb-6" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
          Listings
        </h1>
        <ListingsTable spots={spots ?? []} />
      </div>
    </div>
  );
}
