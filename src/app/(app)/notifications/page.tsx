import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/labels";
import { Card, EmptyState, PageHeader, buttonStyles } from "@/components/ui";
import { markNotificationsRead } from "../actions";

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  return (
    <>
      <PageHeader
        title="Notifications"
        action={
          items.some((n) => !n.read_at) && (
            <form action={markNotificationsRead}>
              <button className={buttonStyles.secondary}>Mark all as read</button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState>No notifications yet.</EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li key={n.id} className={`py-3 ${n.read_at ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {!n.read_at && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-label="Unread" />}
                  {n.title}
                </div>
                {n.lead_id ? (
                  <Link href={`/leads/${n.lead_id}`} className="text-blue-700 hover:underline">
                    {n.body}
                  </Link>
                ) : (
                  <div>{n.body}</div>
                )}
                <div className="text-sm text-slate-500">{formatDateTime(n.created_at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
