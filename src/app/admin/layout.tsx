import { requireAdmin } from "@/lib/auth";

// One auth check covers /admin and every /admin/* route, so the leaf
// pages don't need to call requireAdmin() themselves.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
