"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Role } from "@/lib/types";

export type UserFormState = { error?: string; ok?: string } | undefined;

const ROLES: Role[] = ["admin", "sales_manager", "sales_person", "call_executive", "demo_manager"];

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Za-z]/, "Password needs at least one letter")
  .regex(/\d/, "Password needs at least one number");

const profileFields = z.object({
  full_name: z.string().trim().min(1, "Enter a name").max(200),
  team_id: z.string().uuid().nullable(),
  region_id: z.string().uuid().nullable(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(10000),
  roles: z.array(z.enum(ROLES as [Role, ...Role[]])).min(1, "Pick at least one role"),
});

function readProfile(formData: FormData) {
  return profileFields.safeParse({
    full_name: formData.get("full_name"),
    team_id: (formData.get("team_id") as string) || null,
    region_id: (formData.get("region_id") as string) || null,
    capacity: formData.get("capacity") || 30,
    roles: formData.getAll("roles"),
  });
}

async function setRoles(userId: string, roles: Role[]) {
  const admin = createAdminClient();
  await admin.from("user_roles").delete().eq("user_id", userId).not("role", "in", `(${roles.join(",")})`);
  await admin.from("user_roles").upsert(roles.map((role) => ({ user_id: userId, role })), { onConflict: "user_id,role", ignoreDuplicates: true });
}

export async function createUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireRole("admin");
  const email = z.string().trim().toLowerCase().email().safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address" };
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "That mobile number doesn't look right" };
  const pw = password.safeParse(formData.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  const p = readProfile(formData);
  if (!p.success) return { error: p.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email: email.data, password: pw.data, email_confirm: true });
  if (error || !data.user) {
    return { error: /already/i.test(error?.message ?? "") ? "Someone already uses this email" : error?.message ?? "Could not create user" };
  }
  const { roles, ...profile } = p.data;
  const { error: profileError } = await admin.from("profiles").insert({ id: data.user.id, email: email.data, phone, ...profile });
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: profileError.message };
  }
  await setRoles(data.user.id, roles);
  revalidatePath("/admin/users");
  return { ok: `${profile.full_name} can now sign in with ${email.data}` };
}

export async function updateUser(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const me = await requireRole("admin");
  const id = z.string().uuid().parse(formData.get("id"));
  const p = readProfile(formData);
  if (!p.success) return { error: p.error.issues[0].message };
  const is_active = formData.get("is_active") === "on";
  if (id === me.id && (!is_active || !p.data.roles.includes("admin"))) {
    return { error: "You can't remove your own admin access or switch yourself off." };
  }
  const admin = createAdminClient();
  const { roles, ...profile } = p.data;
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  if (rawPhone && !phone) return { error: "That mobile number doesn't look right" };
  const { error } = await admin.from("profiles").update({ ...profile, phone, is_active }).eq("id", id);
  if (error) return { error: error.message };
  await setRoles(id, roles);
  // A switched-off person is signed out everywhere.
  await admin.auth.admin.updateUserById(id, { ban_duration: is_active ? "none" : "876000h" });
  revalidatePath("/admin/users");
  return { ok: "Saved" };
}

export async function resetPassword(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const me = await requireRole("admin");
  const id = z.string().uuid().parse(formData.get("id"));
  const pw = password.safeParse(formData.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: pw.data });
  if (error) return { error: error.message };
  await admin.from("audit_log").insert({ actor_id: me.id, action: "reset_password", entity: "profiles", entity_id: id });
  return { ok: "Password changed. Share it with them privately." };
}
