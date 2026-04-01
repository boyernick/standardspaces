import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import ReviewForm from "./ReviewForm";

async function getRecommendation(id: string) {
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
  const { id } = await params;
  const rec = await getRecommendation(id);

  if (!rec) notFound();

  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Review recommendation</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Edit the details below, then publish to make it live.
            </p>
          </div>

          <ReviewForm recommendation={rec} />
        </div>
      </div>
    </div>
  );
}
