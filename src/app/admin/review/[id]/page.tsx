import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import PageShell from "@/components/ui/PageShell";
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

  return (
    <PageShell maxWidth="md">
      <div className="text-center mb-8">
        <h1>Review recommendation</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Edit the details below, then publish to make it live.
        </p>
      </div>
      <ReviewForm recommendation={rec} />
    </PageShell>
  );
}
