import { requireAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import ProfileTabs from "./ProfileTabs";

export default async function ProfilePage() {
  const user = await requireAuth();

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: "var(--color-surface)" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1
          className="text-2xl font-medium mb-1"
          style={{ fontFamily: "var(--font-martina), Georgia, serif" }}
        >
          Profile
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-8">
          {user.email}
        </p>

        <ProfileTabs userId={user.id} />
      </div>
    </div>
  );
}
