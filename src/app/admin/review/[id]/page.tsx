import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ReviewForm from "./ReviewForm";

async function getRecommendation(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}

export default async function AdminReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const rec = await getRecommendation(id);

  if (!rec) notFound();

  // Mirror the edit-listing page: merge any neighborhoods admins have already
  // saved on existing spots into the picker, so the second listing in a new
  // neighborhood benefits from the first.
  const admin = createAdminClient();
  const { data: nbRows } = await admin
    .from("spots")
    .select("neighborhood")
    .not("neighborhood", "is", null);
  const existingNeighborhoods = Array.from(
    new Set((nbRows ?? []).map((r) => r.neighborhood).filter(Boolean) as string[]),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <ReviewForm recommendation={rec} existingNeighborhoods={existingNeighborhoods} />
        </div>
      </div>
    </div>
  );
}
