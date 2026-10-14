import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS } from "@/lib/labels";
import type { LeadStatus } from "@/lib/types";
import { Card, PageHeader, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { addListItem, revokeApiKey, saveRules, toggleListItem } from "./actions";
import { ApiKeyForm } from "./api-key-form";

type Item = { id: string; name: string; is_active?: boolean };
type Rule = { id: string; status: LeadStatus; delay_hours: number; max_attempts: number; task_title: string; is_active: boolean };

export default async function SettingsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [teams, products, regions, rules, settings, keys] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("products").select("id, name, is_active").order("name"),
    supabase.from("regions").select("id, name, is_active").order("name"),
    supabase.from("followup_rules").select("*"),
    supabase.from("app_settings").select("*").single(),
    supabase.from("api_keys").select("id, name, is_active, created_at, last_used_at").order("created_at", { ascending: false }),
  ]);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <div className="grid gap-6 lg:grid-cols-3">
        <ListCard title="Teams" table="teams" items={teams.data ?? []} />
        <ListCard title="Products" table="products" items={products.data ?? []} toggle />
        <ListCard title="Regions" table="regions" items={regions.data ?? []} toggle />
      </div>

      <Card>
        <h2 className="mb-1 text-lg font-bold">Automatic follow-ups</h2>
        <p className="mb-4 text-slate-600">When a lead reaches a stage, a reminder is created for the person handling it. After the maximum number of tries, their manager is alerted.</p>
        <form action={saveRules} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-sm text-slate-600">
                <tr>
                  <th className="py-2">When the lead is</th>
                  <th className="py-2">Remind after (hours)</th>
                  <th className="py-2">Max tries</th>
                  <th className="py-2">Reminder text</th>
                  <th className="py-2">On</th>
                </tr>
              </thead>
              <tbody>
                {((rules.data ?? []) as Rule[])
                  .sort((a, b) => Object.keys(STATUS).indexOf(a.status) - Object.keys(STATUS).indexOf(b.status))
                  .map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-medium">
                        <input type="hidden" name="rule_id" value={r.id} />
                        {STATUS[r.status].label}
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`delay:${r.id}`} type="number" min={0} defaultValue={r.delay_hours} className={`${inputClass} max-w-28`} />
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`attempts:${r.id}`} type="number" min={1} defaultValue={r.max_attempts} className={`${inputClass} max-w-24`} />
                      </td>
                      <td className="py-2 pr-3">
                        <input name={`title:${r.id}`} defaultValue={r.task_title} className={inputClass} />
                      </td>
                      <td className="py-2">
                        <input type="checkbox" name={`active:${r.id}`} defaultChecked={r.is_active} className="h-5 w-5" />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Alert managers when a lead has no activity for (days)</span>
              <input name="stale_lead_days" type="number" min={1} defaultValue={settings.data?.stale_lead_days ?? 3} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Remind about a demo this many hours before</span>
              <input name="demo_reminder_hours" type="number" min={0} defaultValue={settings.data?.demo_reminder_hours ?? 24} className={inputClass} />
            </label>
          </div>
          <SubmitButton>Save follow-up settings</SubmitButton>
        </form>
      </Card>

      <Card>
        <h2 className="mb-1 text-lg font-bold">Lead sources</h2>
        <div className="space-y-3 text-slate-700">
          <p>
            <b>Website form:</b> send a POST to <code className="rounded bg-slate-100 px-1">{origin}/api/leads/inbound</code> with the header{" "}
            <code className="rounded bg-slate-100 px-1">x-api-key</code> and JSON like{" "}
            <code className="rounded bg-slate-100 px-1">{`{"name":"Asha","phone":"9876543210","product":"…","region":"…"}`}</code>.
          </p>
          <p>
            <b>Facebook, Instagram and WhatsApp:</b> in your Meta app, set the webhook URL to{" "}
            <code className="rounded bg-slate-100 px-1">{origin}/api/webhooks/meta</code> and subscribe to <i>leadgen</i> (Page) and <i>messages</i> (WhatsApp).
          </p>
        </div>
        <h3 className="mb-2 mt-5 font-bold">API keys</h3>
        <ul className="mb-4 divide-y divide-slate-100">
          {(keys.data ?? []).map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-2">
              <span className={k.is_active ? "" : "text-slate-400 line-through"}>
                {k.name}
                <span className="ml-2 text-sm text-slate-500">{k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString("en-IN")}` : "never used"}</span>
              </span>
              {k.is_active && (
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={k.id} />
                  <button className="text-sm font-semibold text-rose-700">Turn off</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <ApiKeyForm />
      </Card>
    </div>
  );
}

function ListCard({ title, table, items, toggle }: { title: string; table: string; items: Item[]; toggle?: boolean }) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <ul className="mb-3 divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between py-2">
            <span className={i.is_active === false ? "text-slate-400 line-through" : ""}>{i.name}</span>
            {toggle && (
              <form action={toggleListItem}>
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="active" value={i.is_active ? "false" : "true"} />
                <button className="text-sm font-semibold text-slate-600 hover:underline">{i.is_active ? "Hide" : "Show"}</button>
              </form>
            )}
          </li>
        ))}
      </ul>
      <form action={addListItem} className="flex gap-2">
        <input type="hidden" name="table" value={table} />
        <input name="name" placeholder={`New ${title.toLowerCase().slice(0, -1)}`} required className={inputClass} />
        <SubmitButton variant="secondary" pendingText="…">
          Add
        </SubmitButton>
      </form>
    </Card>
  );
}
