import Navbar from "@/components/Navbar";
import PageEnter from "@/components/PageEnter";
import RecommendForm from "./RecommendForm";
import { requireAuth } from "@/lib/auth";

export default async function RecommendPage() {
  await requireAuth();
  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <PageEnter>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-sm mx-auto px-6 pt-4">
            <RecommendForm />
          </div>
        </div>
      </PageEnter>
    </div>
  );
}
