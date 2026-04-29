import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import AdminSectionNav from "@/components/admin/SectionNav";
import MembersList from "./MembersList";

export default async function AdminMembersPage() {
  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role, first_name, last_name, phone, instagram, avatar_url, onboarded, created_at")
    .order("created_at", { ascending: false });

  return (
    <PageShell navbar={<Navbar />} maxWidth="lg">
      <AdminSectionNav />
      <MembersList members={members ?? []} />
    </PageShell>
  );
}
