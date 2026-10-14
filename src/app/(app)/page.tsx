import { getCurrentUser, hasRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dateRange, parseFilters, toQueryString } from "@/lib/filters";
import { filterFieldsFor } from "@/lib/filter-fields";
import { SOURCE_LABELS, STATUS, STATUS_ORDER, formatMoney } from "@/lib/labels";
import type { LeadSource } from "@/lib/types";
import { FilterBar } from "@/components/filter-bar";
import { TrendChart } from "@/components/charts";
import { BarList } from "@/components/bar-list";
import { Card, PageHeader } from "@/components/ui";

type Stats = {
  total: number;
  open: number;
  converted: number;
  declined: number;
  demos: number;
  revenue: number;
  revenue_target: number;
  conversion_target: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  by_day: { day: string; leads: number; converted: number }[];
  leaderboard: { id: string; full_name: string; leads: number; converted: number; revenue: number }[];
};

function monthStart() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000); // IST
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const ref = await getReference();
  // With no dates chosen, show this month so targets line up.
  const f = parseFilters(sp);
  const effective = { ...f, from: f.from ?? (f.to ? undefined : monthStart()) };
  const { from, to } = dateRange(effective);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", {
    p_from: from,
    p_to: to,
    p_product: f.product ?? null,
    p_region: f.region ?? null,
    p_status: f.status ?? null,
    p_source: f.source ?? null,
    p_team: f.team ?? null,
    p_user: f.user ?? null,
  });
  if (error) throw new Error(error.message);
  const s = data as Stats;

  const scope = hasRole(user, "admin") ? "All teams" : hasRole(user, "sales_manager") ? "Your team" : "Your leads";
  const conversionRate = s.total ? Math.round((s.converted / s.total) * 100) : 0;
  const revenuePct = s.revenue_target ? Math.min(100, Math.round((s.revenue / s.revenue_target) * 100)) : null;
  const leadsLink = (extra: Record<string, string>) => `/leads${toQueryString({ ...effective, ...extra })}`;

  return (
    <>
      <PageHeader title={`Hello, ${user.full_name.split(" ")[0]}`} subtitle={`${scope} · ${f.from || f.to ? "chosen dates" : "this month"}`} />
      <FilterBar fields={filterFieldsFor(user, ref)} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Leads" value={String(s.total)} sub={`${s.open} still open`} />
        <Tile label="Converted" value={String(s.converted)} sub={`${conversionRate}% of leads${s.conversion_target ? ` · target ${s.conversion_target}` : ""}`} />
        <Tile label="Demos" value={String(s.demos)} sub="booked or done" />
        <Tile label="Revenue earned" value={formatMoney(s.revenue)} sub={s.revenue_target ? `of ${formatMoney(s.revenue_target)} target` : "No target set"}>
          {revenuePct !== null && (
            <div className="mt-3">
              <div className="h-2.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={revenuePct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-2.5 rounded-full bg-emerald-600" style={{ width: `${revenuePct}%` }} />
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{revenuePct}% of target</div>
            </div>
          )}
        </Tile>
      </div>

      <Card className="mt-6">
        <h2 className="mb-3 text-lg font-bold">New leads and conversions per day</h2>
        <TrendChart data={s.by_day} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Where leads are in the journey</h2>
          <BarList
            rows={STATUS_ORDER.map((k) => ({ key: k, label: STATUS[k].label, value: s.by_status[k] ?? 0, href: leadsLink({ status: k }) }))}
          />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Where leads come from</h2>
          <BarList
            rows={(Object.keys(SOURCE_LABELS) as LeadSource[])
              .map((k) => ({ key: k, label: SOURCE_LABELS[k], value: s.by_source[k] ?? 0, href: leadsLink({ source: k }) }))
              .sort((a, b) => b.value - a.value)}
          />
        </Card>
      </div>

      {hasRole(user, "admin", "sales_manager") && (
        <Card className="mt-6">
          <h2 className="mb-3 text-lg font-bold">Team performance</h2>
          {s.leaderboard.length === 0 ? (
            <p className="text-slate-500">No assigned leads in this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-sm text-slate-600">
                  <tr>
                    <th className="py-2">Person</th>
                    <th className="py-2 text-right">Leads</th>
                    <th className="py-2 text-right">Converted</th>
                    <th className="py-2 text-right">Rate</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {s.leaderboard.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 font-medium">{p.full_name}</td>
                      <td className="py-2 text-right">{p.leads}</td>
                      <td className="py-2 text-right">{p.converted}</td>
                      <td className="py-2 text-right">{p.leads ? Math.round((p.converted / p.leads) * 100) : 0}%</td>
                      <td className="py-2 text-right">{formatMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}

function Tile({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <Card>
      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
      {children}
    </Card>
  );
}
