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
    <div className="h-screen flex flex-col bg-white dark:bg-neutral-950">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Review recommendation</h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                Edit the details below, then publish to make it live.
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full ${
              rec.status === "scraped" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
              rec.status === "processing" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
              "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
            }`}>
              {rec.status}
            </span>
          </div>

          {rec.scraped_images && rec.scraped_images.length > 0 && (
            <div className="mb-8">
              <p className="text-sm font-medium mb-3">Scraped photos</p>
              <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
                {rec.scraped_images.map((url: string, i: number) => (
                  <div key={i} className="aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <ReviewForm recommendation={rec} />
        </div>
      </div>
    </div>
  );
}
