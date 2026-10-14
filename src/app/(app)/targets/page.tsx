import { hasRole, requireRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/labels";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { saveTargets } from "./actions";

type Target = { user_id: string | null; team_id: string | null; revenue_target: number; conversion_target: number };
type Won = { assigned_to: string | null; team_id: string | null; deal_value: number | null };

export default async function TargetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireRole("admin", "sales_manager");
  const { month: m } = await searchParams;
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? `${m}-01` : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const start = new Date(`${month}T00:00:00+05:30`);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const ref = await getReference();
  const supabase = await createClient();
  const isAdmin = hasRole(user, "admin");
  const teams = isAdmin ? ref.teams : ref.teams.filter((t) => t.id === user.team_id);
  const people = ref.people.filter(
    (p) => p.is_active && p.roles.some((r) => r === "sales_person" || r === "call_executive") && (isAdmin || p.team_id === user.team_id),
  );

  const [{ data: targets }, { data: won }] = await Promise.all([
    supabase.from("targets").select("*").eq("month", month),
    supabase.from("leads").select("assigned_to, team_id, deal_value").eq("status", "converted").gte("closed_at", start.toISOString()).lt("closed_at", end.toISOString()),
  ]);
  const t = (targets ?? []) as Target[];
  const w = (won ?? []) as Won[];
  const sum = (rows: Won[]) => ({ revenue: rows.reduce((a, r) => a + Number(r.deal_value ?? 0), 0), count: rows.length });

  const rows = [
    ...teams.map((team) => ({ key: `team:${team.id}`, name: `${team.name} (whole team)`, target: t.find((x) => x.team_id === team.id), actual: sum(w.filter((r) => r.team_id === team.id)), isTeam: true })),
    ...people.map((p) => ({ key: `user:${p.id}`, name: p.full_name, target: t.find((x) => x.user_id === p.id), actual: sum(w.filter((r) => r.assigned_to === p.id)), isTeam: false })),
  ];

  return (
    <>
      <PageHeader title="Sales targets" subtitle="Set monthly revenue and conversion targets. Progress updates as leads are converted." />
      <form className="mb-4 flex items-center gap-2">
        <label className="font-semibold text-slate-700" htmlFor="month">
          Month
        </label>
        <input id="month" type="month" name="month" defaultValue={month.slice(0, 7)} className={`${inputClass} max-w-48`} />
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold">Show</button>
      </form>
      <Card>
        <form action={saveTargets}>
          <input type="hidden" name="month" value={month} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-slate-600">
                <tr>
                  <th className="py-2">Who</th>
                  <th className="py-2">Revenue target (₹)</th>
                  <th className="py-2">Earned</th>
                  <th className="py-2">Conversions target</th>
                  <th className="py-2">Converted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const pct = r.target?.revenue_target ? Math.round((r.actual.revenue / Number(r.target.revenue_target)) * 100) : null;
                  return (
                    <tr key={r.key} className={r.isTeam ? "bg-slate-50 font-semibold" : ""}>
                      <td className="py-2 pr-3">{r.name}</td>
                      <td className="py-2 pr-3">
                        <input name={`rev:${r.key}`} type="number" min={0} step={1000} defaultValue={r.target?.revenue_target ?? ""} className={`${inputClass} max-w-40`} />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {formatMoney(r.actual.revenue)}
                        {pct !== null && <span className={`ml-2 text-sm ${pct >= 100 ? "text-emerald-700" : "text-slate-500"}`}>{pct}%</span>}
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`conv:${r.key}`} type="number" min={0} defaultValue={r.target?.conversion_target ?? ""} className={`${inputClass} max-w-28`} />
                      </td>
                      <td className="py-2 tabular-nums">{r.actual.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <SubmitButton>Save targets</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
