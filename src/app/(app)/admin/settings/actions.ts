"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const LISTS = { teams: "teams", products: "products", regions: "regions" } as const;

function done() {
  revalidatePath("/admin/settings");
}

export async function addListItem(formData: FormData) {
  await requireRole("admin");
  const table = LISTS[String(formData.get("table")) as keyof typeof LISTS];
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!table || !name) return;
  const supabase = await createClient();
  await supabase.from(table).insert({ name });
  done();
}

export async function toggleListItem(formData: FormData) {
  await requireRole("admin");
  const table = String(formData.get("table"));
  if (table !== "products" && table !== "regions") return;
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from(table).update({ is_active: formData.get("active") === "true" }).eq("id", id);
  done();
}

export async function saveRules(formData: FormData) {
  await requireRole("admin");
  const supabase = await createClient();
  const ids = formData.getAll("rule_id").map((v) => z.string().uuid().parse(v));
  for (const id of ids) {
    await supabase
      .from("followup_rules")
      .update({
        delay_hours: Math.max(0, Math.round(Number(formData.get(`delay:${id}`)) || 0)),
        max_attempts: Math.max(1, Math.round(Number(formData.get(`attempts:${id}`)) || 1)),
        task_title: String(formData.get(`title:${id}`) ?? "Follow up").trim().slice(0, 200) || "Follow up",
        is_active: formData.get(`active:${id}`) === "on",
      })
      .eq("id", id);
  }
  await supabase
    .from("app_settings")
    .update({
      stale_lead_days: Math.max(1, Math.round(Number(formData.get("stale_lead_days")) || 3)),
      demo_reminder_hours: Math.max(0, Math.round(Number(formData.get("demo_reminder_hours")) || 24)),
    })
    .eq("id", true);
  done();
}

export type KeyState = { key?: string; error?: string } | undefined;

// The full key is shown once; only its SHA-256 hash is stored.
export async function createApiKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim().slice(0, 100);
  if (!name) return { error: "Give the key a name, e.g. Website form" };
  const key = `crm_${randomBytes(24).toString("base64url")}`;
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({ name, key_hash: createHash("sha256").update(key).digest("hex") });
  if (error) return { error: error.message };
  done();
  return { key };
}

export async function revokeApiKey(formData: FormData) {
  await requireRole("admin");
  const id = z.string().uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
  done();
}
