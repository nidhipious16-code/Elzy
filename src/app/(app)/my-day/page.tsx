import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/labels";
import type { LeadStatus } from "@/lib/types";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { completeTask } from "../leads/[id]/actions";

type Row = {
  id: string;
  title: string;
  due_at: string;
  kind: string;
  lead_id: string | null;
  leads: { full_name: string; phone: string | null; status: LeadStatus } | null;
};

export default async function MyDayPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const endOfToday = new Date();
  endOfToday.setUTCHours(18, 30, 0, 0); // midnight IST
  if (endOfToday < new Date()) endOfToday.setUTCDate(endOfToday.getUTCDate() + 1);

  const [{ data: tasks }, { count: newLeads }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, kind, lead_id, leads(full_name, phone, status)")
      .eq("assigned_to", user.id)
      .is("done_at", null)
      .lt("due_at", endOfToday.toISOString())
      .order("due_at")
      .limit(200),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", user.id).eq("status", "new"),
  ]);
  const rows = (tasks ?? []) as unknown as Row[];
  const now = new Date();
  const overdue = rows.filter((t) => new Date(t.due_at) < now);
  const today = rows.filter((t) => new Date(t.due_at) >= now);

  return (
    <>
      <PageHeader title="My day" subtitle="Calls and follow-ups to do today. Tap a name to open the lead." />
      {!!newLeads && (
        <Link href={`/leads?status=new&user=${user.id}`} className="mb-6 block rounded-2xl bg-blue-600 p-5 text-white shadow">
          <div className="text-3xl font-bold">{newLeads}</div>
          <div className="text-lg">new lead{newLeads === 1 ? "" : "s"} waiting for a first call →</div>
        </Link>
      )}
      {rows.length === 0 ? (
        <EmptyState>Nothing due today. Nice work!</EmptyState>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && <TaskList title={`Overdue (${overdue.length})`} rows={overdue} late />}
          {today.length > 0 && <TaskList title={`Later today (${today.length})`} rows={today} />}
        </div>
      )}
    </>
  );
}

function TaskList({ title, rows, late }: { title: string; rows: Row[]; late?: boolean }) {
  return (
    <Card>
      <h2 className={`mb-3 text-lg font-bold ${late ? "text-rose-700" : ""}`}>{title}</h2>
      <ul className="divide-y divide-slate-100">
        {rows.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <div className="font-semibold">{t.title}</div>
              {t.leads && t.lead_id && (
                <Link href={`/leads/${t.lead_id}`} className="text-blue-700 hover:underline">
                  {t.leads.full_name} {t.leads.phone && `· ${t.leads.phone}`}
                </Link>
              )}
              <div className="text-sm text-slate-500">Due {formatDateTime(t.due_at)}</div>
            </div>
            <div className="flex items-center gap-3">
              {t.leads && <StatusBadge status={t.leads.status} />}
              {t.leads?.phone && (
                <a href={`tel:${t.leads.phone}`} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white">
                  Call
                </a>
              )}
              <form action={completeTask}>
                <input type="hidden" name="task_id" value={t.id} />
                {t.lead_id && <input type="hidden" name="lead_id" value={t.lead_id} />}
                <button className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">Done</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
