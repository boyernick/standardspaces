import PageShell from "@/components/ui/PageShell";
import PageEnter from "@/components/PageEnter";
import RecommendForm from "./RecommendForm";
import { requireAuth } from "@/lib/auth";

export default async function RecommendPage() {
  await requireAuth();
  return (
    <PageShell maxWidth="sm">
      <PageEnter>
        <RecommendForm />
      </PageEnter>
    </PageShell>
  );
}
