"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function saveTargets(formData: FormData) {
  await requireRole("admin", "sales_manager");
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}-01$/.test(month)) return;
  const supabase = await createClient();

  // Inputs are named rev:<kind>:<id> and conv:<kind>:<id>, kind = user | team.
  const keys = new Set<string>();
  for (const k of formData.keys()) {
    const m = k.match(/^(rev|conv):(user|team):([0-9a-f-]{36})$/i);
    if (m) keys.add(`${m[2]}:${m[3]}`);
  }
  for (const key of keys) {
    const [kind, id] = key.split(":");
    const revenue_target = Math.max(0, Number(formData.get(`rev:${key}`)) || 0);
    const conversion_target = Math.max(0, Math.round(Number(formData.get(`conv:${key}`)) || 0));
    const column = kind === "user" ? "user_id" : "team_id";
    const { data: existing } = await supabase.from("targets").select("id").eq(column, id).eq("month", month).maybeSingle();
    if (existing) {
      await supabase.from("targets").update({ revenue_target, conversion_target }).eq("id", existing.id);
    } else if (revenue_target || conversion_target) {
      await supabase.from("targets").insert({ [column]: id, month, revenue_target, conversion_target });
    }
  }
  revalidatePath("/targets");
  revalidatePath("/");
}
