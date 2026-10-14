"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS } from "@/lib/labels";
import type { LeadStatus } from "@/lib/types";

export type ActionState = { error?: string; ok?: string } | undefined;

const id = z.string().uuid();

function friendly(message: string) {
  // Messages raised by the database rules are already written for people.
  if (/row-level security|permission denied/i.test(message)) return "You don't have permission to do that.";
  return message;
}

export async function updateStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const leadId = id.parse(formData.get("lead_id"));
  const status = String(formData.get("status")) as LeadStatus;
  if (!(status in STATUS)) return { error: "Unknown status" };

  const patch: Record<string, unknown> = { status };
  if (status === "converted") {
    const value = Number(String(formData.get("deal_value") ?? "").replace(/[,\s₹]/g, ""));
    if (!Number.isFinite(value) || value < 0) return { error: "Enter the deal value in rupees" };
    patch.deal_value = value;
  }
  if (status === "declined") {
    const reason = String(formData.get("decline_reason") ?? "").trim();
    if (!reason) return { error: "Tell us why the customer declined" };
    patch.decline_reason = reason.slice(0, 500);
  }
  if (status === "demo_scheduled") {
    const at = String(formData.get("demo_at") ?? "");
    if (!at) return { error: "Pick the demo date and time" };
    patch.demo_at = new Date(`${at}:00+05:30`).toISOString();
    const dm = formData.get("demo_manager_id");
    if (dm) patch.demo_manager_id = id.parse(dm);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("leads").update(patch).eq("id", leadId);
  if (error) return { error: friendly(error.message) };

  const note = String(formData.get("note") ?? "").trim();
  if (note) {
    const user = await getCurrentUser();
    await supabase.from("lead_activities").insert({ lead_id: leadId, actor_id: user.id, type: "note", body: note.slice(0, 5000) });
  }
  revalidatePath(`/leads/${leadId}`);
  return { ok: `Saved: ${STATUS[status].label}` };
}

export async function addNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const leadId = id.parse(formData.get("lead_id"));
  const body = String(formData.get("body") ?? "").trim();
  const type = formData.get("type") === "call" ? "call" : "note";
  if (!body) return { error: "Write something first" };
  const supabase = await createClient();
  const { error } = await supabase.from("lead_activities").insert({ lead_id: leadId, actor_id: user.id, type, body: body.slice(0, 5000) });
  if (error) return { error: friendly(error.message) };
  await supabase.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Saved" };
}

export async function addTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const leadId = id.parse(formData.get("lead_id"));
  const title = String(formData.get("title") ?? "").trim() || "Follow up";
  const due = String(formData.get("due_at") ?? "");
  if (!due) return { error: "Pick when to follow up" };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("assigned_to").eq("id", leadId).single();
  const assignee = hasRole(user, "admin", "sales_manager") && lead?.assigned_to ? lead.assigned_to : user.id;
  const { error } = await supabase.from("tasks").insert({
    lead_id: leadId,
    assigned_to: assignee,
    created_by: user.id,
    title: title.slice(0, 200),
    kind: "manual",
    due_at: new Date(`${due}:00+05:30`).toISOString(),
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/my-day");
  return { ok: "Reminder added" };
}

export async function completeTask(formData: FormData) {
  const taskId = id.parse(formData.get("task_id"));
  const supabase = await createClient();
  await supabase.from("tasks").update({ done_at: new Date().toISOString() }).eq("id", taskId);
  const leadId = formData.get("lead_id");
  if (leadId) revalidatePath(`/leads/${leadId}`);
  revalidatePath("/my-day");
}

export async function reassignLead(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin", "sales_manager")) return { error: "Only managers can reassign leads." };
  const leadId = id.parse(formData.get("lead_id"));
  const assignee = id.parse(formData.get("assigned_to"));
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("team_id").eq("id", assignee).single();
  if (!person) return { error: "Person not found" };
  if (!hasRole(user, "admin") && person.team_id !== user.team_id) return { error: "You can only assign to your own team." };
  const { error } = await supabase.from("leads").update({ assigned_to: assignee, team_id: person.team_id }).eq("id", leadId);
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Lead reassigned" };
}

export async function reopenLead(formData: FormData) {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin", "sales_manager")) return;
  const leadId = id.parse(formData.get("lead_id"));
  const supabase = await createClient();
  await supabase.from("leads").update({ status: "responsive", deal_value: null, decline_reason: null }).eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
}

export async function eraseLead(formData: FormData) {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin")) return;
  const leadId = id.parse(formData.get("lead_id"));
  if (formData.get("confirm") !== "ERASE") redirect(`/leads/${leadId}?erase=confirm`);
  const supabase = await createClient();
  await supabase.rpc("erase_lead_personal_data", { p_lead: leadId });
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}
