import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import MembersList from "./MembersList";

export default async function AdminMembersPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role, first_name, last_name, phone, instagram, avatar_url, onboarded, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <h1
          className="text-2xl font-medium mb-6"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          Members
        </h1>
        <MembersList members={members ?? []} />
      </div>
    </div>
  );
}
