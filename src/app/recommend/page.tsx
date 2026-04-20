import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import PageHeader from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { requireAuth } from "@/lib/auth";
import { getMyRecommendations } from "@/app/actions/recommendations";
import RecommendHubClient from "./RecommendHubClient";

export const metadata: Metadata = { title: "Recommendations" };

export default async function RecommendPage() {
  await requireAuth();
  const recommendations = await getMyRecommendations();

  return (
    <PageShell maxWidth="md">
      <PageHeader
        title="Recommendations"
        action={<ButtonLink href="/recommend/new">Recommend a space</ButtonLink>}
      />
      <RecommendHubClient recommendations={recommendations} />
    </PageShell>
  );
}
