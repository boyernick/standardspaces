import Navbar from "@/components/Navbar";
import RecommendForm from "./RecommendForm";
import { requireAuth } from "@/lib/auth";

export default async function RecommendPage() {
  await requireAuth();
  return (
    <div className="h-screen flex flex-col bg-surface">
      <Navbar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-12">
          <RecommendForm />
        </div>
      </div>
    </div>
  );
}
