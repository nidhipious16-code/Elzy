import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getReference, nameOf } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { dateRange, parseFilters, toQueryString } from "@/lib/filters";
import { filterFieldsFor } from "@/lib/filter-fields";
import { SOURCE_LABELS, formatDateTime } from "@/lib/labels";
import type { Lead } from "@/lib/types";
import { FilterBar } from "@/components/filter-bar";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 50;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  const ref = await getReference();
  const f = parseFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .order("last_activity_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (f.product) query = query.eq("product_id", f.product);
  if (f.region) query = query.eq("region_id", f.region);
  if (f.status) query = query.eq("status", f.status);
  if (f.source) query = query.eq("source", f.source);
  if (f.team) query = query.eq("team_id", f.team);
  if (f.user) query = query.eq("assigned_to", f.user);
  if (f.open) query = query.eq("is_closed", false);
  const { from, to } = dateRange(f);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lt("created_at", to);
  if (f.q) {
    // strip characters that have meaning in PostgREST filter syntax
    const q = f.q.replace(/[%,()*\\]/g, " ").trim();
    if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, count } = await query;
  const leads = (data ?? []) as Lead[];
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const canAdd = hasRole(user, "admin", "sales_manager", "sales_person", "call_executive");
  const canImport = hasRole(user, "admin", "sales_manager");

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${count ?? 0} lead${count === 1 ? "" : "s"}`}
        action={
          <div className="flex gap-2">
            {canImport && (
              <LinkButton href="/leads/import" variant="secondary">
                <Upload size={20} /> Import
              </LinkButton>
            )}
            {canAdd && (
              <LinkButton href="/leads/new">
                <Plus size={20} /> Add lead
              </LinkButton>
            )}
          </div>
        }
      />
      <FilterBar fields={filterFieldsFor(user, ref)} showSearch />

      {leads.length === 0 ? (
        <EmptyState>No leads match these filters.</EmptyState>
      ) : (
        <>
          {/* phone: cards */}
          <div className="space-y-3 md:hidden">
            {leads.map((l) => (
              <Link key={l.id} href={`/leads/${l.id}`} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-lg font-semibold">{l.full_name}</div>
                    <div className="text-slate-600">{l.phone ?? l.email}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {[nameOf(ref.products, l.product_id), nameOf(ref.regions, l.region_id), SOURCE_LABELS[l.source]].filter(Boolean).join(" · ")}
                </div>
              </Link>
            ))}
          </div>

          {/* desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-sm text-slate-600">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${l.id}`} className="font-semibold text-blue-700 hover:underline">
                        {l.full_name}
                      </Link>
                      <div className="text-sm text-slate-500">{l.phone ?? l.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={l.status} />
                    </td>
                    <td className="px-4 py-3">{nameOf(ref.products, l.product_id)}</td>
                    <td className="px-4 py-3">{nameOf(ref.regions, l.region_id)}</td>
                    <td className="px-4 py-3">{SOURCE_LABELS[l.source]}</td>
                    <td className="px-4 py-3">{nameOf(ref.people, l.assigned_to) || <span className="text-amber-700">Not assigned</span>}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatDateTime(l.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {page > 1 && (
                <LinkButton variant="secondary" href={`/leads${toQueryString(f)}${toQueryString(f) ? "&" : "?"}page=${page - 1}`}>
                  Previous
                </LinkButton>
              )}
              <span className="text-slate-600">
                Page {page} of {pages}
              </span>
              {page < pages && (
                <LinkButton variant="secondary" href={`/leads${toQueryString(f)}${toQueryString(f) ? "&" : "?"}page=${page + 1}`}>
                  Next
                </LinkButton>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
