"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export type SetupState = { error?: string; done?: string } | undefined;

export async function adminExists() {
  const admin = createAdminClient();
  const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
  return (count ?? 0) > 0;
}

function sameSecret(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const input = z.object({
  full_name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/[A-Za-z]/, "Password needs at least one letter")
    .regex(/\d/, "Password needs at least one number"),
});

// Creates the very first admin. Only works while there is no admin yet,
// and only with the SETUP_CODE set on the server.
export async function createFirstAdmin(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const code = process.env.SETUP_CODE;
  if (!code) return { error: "Setup is switched off. Add SETUP_CODE to the app's settings first." };
  if (!sameSecret(String(formData.get("setup_code") ?? ""), code)) return { error: "That setup code is not right." };
  if (await adminExists()) return { error: "An admin already exists. Please sign in instead." };

  const parsed = input.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { full_name, email, password } = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return { error: error?.message ?? "Could not create the account" };
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, full_name, email });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: pErr.message };
  }
  await admin.from("user_roles").insert({ user_id: data.user.id, role: "admin" });
  return { done: email };
}
