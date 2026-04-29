import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import AdminSectionNav from "@/components/admin/SectionNav";
import RecommendationList from "./RecommendationList";

export default async function AdminRecommendationsPage() {
  const supabase = createAdminClient();
  const { data: recommendations } = await supabase
    .from("recommendations")
    .select(
      "id, name, url, status, category, neighborhood, notes, additional_urls, scraped_images, created_at, processed_at"
    )
    .order("created_at", { ascending: false });

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <AdminSectionNav />
      <RecommendationList recommendations={recommendations ?? []} />
    </PageShell>
  );
}
