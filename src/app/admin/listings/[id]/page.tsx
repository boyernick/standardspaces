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

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1 className="text-2xl font-medium mb-6" style={{ fontFamily: "var(--font-martina), Georgia, serif" }}>
          Edit: {spot.name}
        </h1>
        <EditListingForm spot={spot} />
      </div>
    </div>
  );
}
