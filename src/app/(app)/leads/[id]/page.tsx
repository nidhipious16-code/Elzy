import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getReference, nameOf } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { SOURCE_LABELS, STATUS, formatDateTime, formatMoney } from "@/lib/labels";
import type { Lead, LeadStatus } from "@/lib/types";
import { Alert, Card, StatusBadge, buttonStyles, inputClass } from "@/components/ui";
import { NoteForm, ReassignForm, StatusActions, TaskForm } from "./lead-actions";
import { completeTask, eraseLead, reopenLead } from "./actions";

type Activity = { id: string; type: string; from_status: LeadStatus | null; to_status: LeadStatus | null; body: string | null; actor_id: string | null; created_at: string };
type Task = { id: string; title: string; due_at: string; done_at: string | null; assigned_to: string };

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erase?: string }> }) {
  const { id } = await params;
  const { erase } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const user = await getCurrentUser();
  const ref = await getReference();
  const supabase = await createClient();

  const [{ data: lead }, { data: activities }, { data: tasks }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("tasks").select("*").eq("lead_id", id).is("done_at", null).order("due_at"),
  ]);
  if (!lead) notFound();
  const l = lead as Lead;
  const isManager = hasRole(user, "admin", "sales_manager");
  const isAdmin = hasRole(user, "admin");
  const people = ref.people
    .filter((p) => p.is_active && p.roles.some((r) => r === "sales_person" || r === "call_executive"))
    .filter((p) => isAdmin || p.team_id === user.team_id)
    .map((p) => ({ id: p.id, name: p.full_name }));
  const demoManagers = ref.people
    .filter((p) => p.is_active && p.roles.includes("demo_manager"))
    .map((p) => ({ id: p.id, name: p.full_name }));
  const waNumber = l.phone?.replace(/\D/g, "");

  return (
    <div className="space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
        <ArrowLeft size={18} /> All leads
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{l.full_name}</h1>
            <div className="mt-1 text-lg text-slate-700">{l.phone}</div>
            {l.email && <div className="text-slate-600">{l.email}</div>}
          </div>
          <StatusBadge status={l.status} />
        </div>
        {l.phone && (
          <div className="mt-4 flex flex-wrap gap-3">
            <a href={`tel:${l.phone}`} className={buttonStyles.primary}>
              <Phone size={20} /> Call
            </a>
            <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className={buttonStyles.secondary}>
              <MessageCircle size={20} /> WhatsApp
            </a>
          </div>
        )}
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
          <Info label="Product" value={nameOf(ref.products, l.product_id) || "—"} />
          <Info label="Region" value={nameOf(ref.regions, l.region_id) || "—"} />
          <Info label="Source" value={SOURCE_LABELS[l.source] + (l.campaign ? ` · ${l.campaign}` : "")} />
          <Info label="Handled by" value={nameOf(ref.people, l.assigned_to) || "Not assigned yet"} />
          <Info label="Team" value={nameOf(ref.teams, l.team_id) || "—"} />
          <Info label="Added" value={formatDateTime(l.created_at)} />
          {l.demo_at && <Info label="Demo" value={`${formatDateTime(l.demo_at)}${l.demo_manager_id ? ` with ${nameOf(ref.people, l.demo_manager_id)}` : ""}`} />}
          {l.status === "converted" && <Info label="Deal value" value={formatMoney(l.deal_value)} />}
          {l.status === "declined" && <Info label="Reason" value={l.decline_reason ?? ""} />}
          <Info label="Consent to contact" value={l.consent_given ? `Yes${l.consent_note ? ` (${l.consent_note})` : ""}` : "Not recorded"} />
        </dl>
        {l.notes && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-700">{l.notes}</p>}
      </Card>

      {!l.is_closed && (
        <Card>
          <StatusActions leadId={l.id} status={l.status} demoManagers={demoManagers} />
        </Card>
      )}
      {l.is_closed && (
        <Card className={l.status === "converted" ? "border-green-300 bg-green-50" : "border-rose-200 bg-rose-50"}>
          <form action={reopenLead} className="flex flex-wrap items-center justify-between gap-3">
            <input type="hidden" name="lead_id" value={l.id} />
            <span className="text-lg font-semibold">
              {l.status === "converted" ? `🎉 Converted for ${formatMoney(l.deal_value)}. This lead is closed.` : "Customer declined. This lead is closed."}
            </span>
            {isManager && <button className={buttonStyles.secondary}>Reopen lead</button>}
          </form>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-lg font-bold">Log a call or note</h2>
          <NoteForm leadId={l.id} />
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Follow-up reminders</h2>
          {(tasks as Task[] | null)?.length ? (
            <ul className="mb-4 divide-y divide-slate-100">
              {(tasks as Task[]).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className={`text-sm ${new Date(t.due_at) < new Date() ? "font-semibold text-rose-700" : "text-slate-500"}`}>
                      {formatDateTime(t.due_at)} · {nameOf(ref.people, t.assigned_to)}
                    </div>
                  </div>
                  {t.assigned_to === user.id && (
                    <form action={completeTask}>
                      <input type="hidden" name="task_id" value={t.id} />
                      <input type="hidden" name="lead_id" value={l.id} />
                      <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Done</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-slate-500">No reminders.</p>
          )}
          {!l.is_closed && <TaskForm leadId={l.id} />}
        </Card>
      </div>

      {isManager && !l.is_closed && (
        <Card>
          <h2 className="mb-3 text-lg font-bold">Give this lead to someone else</h2>
          <ReassignForm leadId={l.id} current={l.assigned_to} people={people} />
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg font-bold">History</h2>
        <ol className="space-y-3">
          {((activities ?? []) as Activity[]).map((a) => (
            <li key={a.id} className="border-l-4 border-slate-200 pl-3">
              <div className="text-sm text-slate-500">
                {formatDateTime(a.created_at)}
                {a.actor_id ? ` · ${nameOf(ref.people, a.actor_id)}` : " · System"}
              </div>
              <div>{describe(a)}</div>
            </li>
          ))}
        </ol>
      </Card>

      {isAdmin && (
        <Card className="border-rose-200">
          <h2 className="mb-2 text-lg font-bold text-rose-800">Privacy: erase this customer&apos;s data</h2>
          <p className="mb-3 text-slate-600">Use this when the customer asks us to delete their details. Name, phone, email and notes are wiped permanently. Numbers for reports are kept.</p>
          {erase === "confirm" && <Alert>Type ERASE in the box to confirm.</Alert>}
          <form action={eraseLead} className="mt-3 flex flex-wrap gap-3">
            <input type="hidden" name="lead_id" value={l.id} />
            <input name="confirm" placeholder="Type ERASE" className={`${inputClass} max-w-48`} />
            <button className={buttonStyles.danger}>Erase personal data</button>
          </form>
        </Card>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function describe(a: Activity) {
  switch (a.type) {
    case "status_change":
      return (
        <>
          Status changed from <b>{a.from_status ? STATUS[a.from_status].label : "—"}</b> to <b>{a.to_status ? STATUS[a.to_status].label : "—"}</b>
        </>
      );
    case "call":
      return <>📞 {a.body}</>;
    case "note":
      return <>📝 {a.body}</>;
    default:
      return a.body;
  }
}
