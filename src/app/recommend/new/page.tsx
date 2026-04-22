import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import Navbar from "@/components/Navbar";
import RecommendForm from "../RecommendForm";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Recommend a space" };

export default async function NewRecommendationPage() {
  await requireAuth();
  return (
    <PageShell navbar={<Navbar />} maxWidth="md">
      <RecommendForm />
    </PageShell>
  );
}
