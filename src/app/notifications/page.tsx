import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotifications } from "@/app/actions/notifications";
import Navbar from "@/components/Navbar";
import NotificationsClient from "./NotificationsClient";
import { MOCK_NOTIFICATIONS } from "./mockData";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ mock?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // `?mock=1` renders the seed fixture without touching the db — useful for
  // previewing every notification shape at once. Marked as mock so the client
  // skips the auto-mark-read side effect.
  const { mock } = await searchParams;

  let rows = mock ? MOCK_NOTIFICATIONS : await getNotifications(50);
  let isMock = !!mock;

  // Dev convenience: if there's nothing in the db yet, show the seeded
  // fixture instead of an empty state so the layout can be iterated on
  // without having to trigger every action. Never kicks in in production.
  if (!isMock && rows.length === 0 && process.env.NODE_ENV !== "production") {
    rows = MOCK_NOTIFICATIONS;
    isMock = true;
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: "var(--color-surface)" }}
    >
      <Navbar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <NotificationsClient initialRows={rows} mock={isMock} />
      </div>
    </div>
  );
}
