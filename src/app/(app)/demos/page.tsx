import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getReference, nameOf } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/labels";
import type { Lead } from "@/lib/types";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";

export default async function DemosPage() {
  await requireRole("admin", "sales_manager", "demo_manager");
  const ref = await getReference();
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("*")
    .in("status", ["demo_agreed", "demo_scheduled", "demo_done"])
    .order("demo_at", { ascending: true, nullsFirst: true })
    .limit(300);
  const leads = (data ?? []) as Lead[];
  const toBook = leads.filter((l) => l.status === "demo_agreed");
  const booked = leads.filter((l) => l.status === "demo_scheduled");
  const done = leads.filter((l) => l.status === "demo_done");

  return (
    <>
      <PageHeader title="Demos" subtitle="Customers who agreed to a demo, booked demos, and demos waiting for an outcome." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Column title="Need a date" leads={toBook} ref_={ref} />
        <Column title="Booked" leads={booked} ref_={ref} showDate />
        <Column title="Done: waiting for a decision" leads={done} ref_={ref} showDate />
      </div>
    </>
  );
}

function Column({ title, leads, ref_, showDate }: { title: string; leads: Lead[]; ref_: Awaited<ReturnType<typeof getReference>>; showDate?: boolean }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">
        {title} ({leads.length})
      </h2>
      {leads.length === 0 ? (
        <EmptyState>None</EmptyState>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="block">
              <Card className="hover:border-blue-300">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{l.full_name}</div>
                  <StatusBadge status={l.status} />
                </div>
                {showDate && l.demo_at && <div className="mt-1 font-medium text-indigo-700">{formatDateTime(l.demo_at)}</div>}
                <div className="mt-1 text-sm text-slate-500">
                  {[nameOf(ref_.products, l.product_id), nameOf(ref_.regions, l.region_id), nameOf(ref_.people, l.assigned_to)].filter(Boolean).join(" · ")}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
