import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import EditListingForm from "./EditListingForm";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const supabase = createAdminClient();
  const { data: spot, error } = await supabase
    .from("spots")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !spot) notFound();

  // Distinct neighborhoods across all existing spots — admins have been
  // adding custom values ("Hialeah", "Doral") that aren't in the
  // hardcoded MIAMI_NEIGHBORHOODS list. Merge them into the picker so
  // the second listing in a new neighborhood benefits from the first.
  const { data: nbRows } = await supabase
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
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">Edit space</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              Update the details below and save to push changes live.
            </p>
          </div>

          <EditListingForm spot={spot} existingNeighborhoods={existingNeighborhoods} />
        </div>
      </div>
    </div>
  );
}
