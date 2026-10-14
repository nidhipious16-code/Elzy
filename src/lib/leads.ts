import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { normalizePhone } from "./phone";
import type { LeadSource } from "./types";

const optionalId = z
  .string()
  .uuid()
  .nullish()
  .or(z.literal("").transform(() => null));

export const leadInput = z
  .object({
    full_name: z.string().trim().min(1, "Enter the customer's name").max(200),
    phone: z
      .string()
      .trim()
      .max(30)
      .nullish()
      .transform((v) => (v ? normalizePhone(v) ?? "invalid" : null))
      .refine((v) => v !== "invalid", "That mobile number doesn't look right"),
    email: z
      .string()
      .trim()
      .max(200)
      .nullish()
      .transform((v) => v || null)
      .pipe(z.string().email("That email doesn't look right").nullable()),
    source: z.enum(["facebook", "instagram", "whatsapp", "website", "call", "manual", "import"]),
    campaign: z.string().trim().max(200).nullish().transform((v) => v || null),
    product_id: optionalId,
    region_id: optionalId,
    team_id: optionalId,
    assigned_to: optionalId,
    notes: z.string().trim().max(5000).nullish().transform((v) => v || null),
    consent_given: z.boolean().default(false),
    consent_note: z.string().trim().max(500).nullish().transform((v) => v || null),
    external_id: z.string().max(200).nullish(),
    created_by: z.string().uuid().nullish(),
  })
  .refine((l) => l.phone || l.email, { message: "Enter a mobile number or an email", path: ["phone"] });

export type LeadInput = z.input<typeof leadInput>;

// Looks for an open lead with the same phone number, across all teams.
// Uses the service role because the person adding the lead may not be able to see it.
export async function findDuplicate(phone: string | null) {
  if (!phone) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("leads")
    .select("id, full_name, status, assigned_to, profiles:assigned_to(full_name)")
    .eq("phone", phone)
    .eq("is_closed", false)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const owner = (data.profiles as unknown as { full_name: string } | null)?.full_name;
  return { id: data.id as string, full_name: data.full_name as string, owner: owner ?? "nobody yet" };
}

export async function insertLead(client: SupabaseClient, raw: LeadInput) {
  const parsed = leadInput.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form" } as const;
  }
  const { data, error } = await client.from("leads").insert(parsed.data).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: "This lead was already received", duplicate: true } as const;
    return { error: error.message } as const;
  }
  return { id: data.id as string } as const;
}

// Used by webhooks: add the lead unless an open one already exists for that phone,
// in which case a note is added to the existing lead instead.
export async function ingestLead(input: LeadInput & { source: LeadSource }) {
  const admin = createAdminClient();
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const dup = await findDuplicate(phone);
  if (dup) {
    await admin.from("lead_activities").insert({
      lead_id: dup.id,
      type: "note",
      body: `Contacted again via ${input.source}${input.campaign ? ` (${input.campaign})` : ""}${input.notes ? `: ${input.notes}` : ""}`,
    });
    await admin.from("leads").update({ last_activity_at: new Date().toISOString() }).eq("id", dup.id);
    return { id: dup.id, duplicate: true };
  }
  return insertLead(admin, input);
}
