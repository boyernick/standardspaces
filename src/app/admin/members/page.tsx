import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import PageHeader from "@/components/ui/PageHeader";
import MembersList from "./MembersList";

export default async function AdminMembersPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role, first_name, last_name, phone, instagram, avatar_url, onboarded, created_at")
    .order("created_at", { ascending: false });

  return (
    <PageShell navbar={<Navbar />} maxWidth="md">
      <PageHeader title="Members" />
      <MembersList members={members ?? []} />
    </PageShell>
  );
}
