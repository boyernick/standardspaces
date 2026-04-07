import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import RecommendationList from "./RecommendationList";

export default async function AdminRecommendationsPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: recommendations } = await supabase
    .from("recommendations")
    .select(
      "id, name, url, status, category, neighborhood, notes, additional_urls, scraped_images, created_at, processed_at"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1
          className="text-2xl font-medium mb-6"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          Recommendations
        </h1>
        <RecommendationList recommendations={recommendations ?? []} />
      </div>
    </div>
  );
}
