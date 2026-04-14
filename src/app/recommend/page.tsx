import PageShell from "@/components/ui/PageShell";
import RecommendForm from "./RecommendForm";
import { requireAuth } from "@/lib/auth";

export default async function RecommendPage() {
  await requireAuth();
  return (
    <PageShell maxWidth="sm">
      <RecommendForm />
    </PageShell>
  );
}
