"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findDuplicate, insertLead } from "@/lib/leads";
import { normalizePhone } from "@/lib/phone";

export type FormState = { error?: string; duplicate?: { id: string; full_name: string; owner: string } } | undefined;

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const get = (k: string) => (formData.get(k) as string | null) ?? null;

  const phone = normalizePhone(get("phone"));
  if (get("confirm_duplicate") !== "1") {
    const dup = await findDuplicate(phone);
    if (dup) return { duplicate: dup };
  }

  const isManager = hasRole(user, "admin", "sales_manager");
  const assign = get("assign"); // "me" | "auto" | <user id>
  let assigned_to: string | null = null;
  if (assign === "me") assigned_to = user.id;
  else if (assign && assign !== "auto" && isManager) assigned_to = assign;

  if (!hasRole(user, "admin", "sales_manager", "sales_person", "call_executive")) {
    return { error: "You don't have permission to add leads." };
  }
  // A manager may only place leads in their own team.
  const team_id = hasRole(user, "admin") ? get("team_id") || user.team_id : user.team_id;
  if (assigned_to && assigned_to !== user.id && !hasRole(user, "admin")) {
    const { data: assignee } = await supabase.from("profiles").select("team_id").eq("id", assigned_to).single();
    if (!assignee || assignee.team_id !== user.team_id) return { error: "You can only assign leads to your own team." };
  }

  // Inserted with the service role (permissions checked above) because an
  // auto-assigned lead may go to someone else, and the person adding it
  // would then not be allowed to read the row back.
  const result = await insertLead(createAdminClient(), {
    created_by: user.id,
    full_name: get("full_name") ?? "",
    phone: get("phone"),
    email: get("email"),
    source: (get("source") as never) ?? "manual",
    campaign: get("campaign"),
    product_id: get("product_id"),
    region_id: get("region_id"),
    team_id,
    assigned_to,
    notes: get("notes"),
    consent_given: get("consent_given") === "on",
    consent_note: get("consent_note"),
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/leads");
  const { data: visible } = await supabase.from("leads").select("id").eq("id", result.id).maybeSingle();
  redirect(visible ? `/leads/${result.id}` : "/leads?added=1");
}
