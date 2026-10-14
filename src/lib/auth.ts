import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./types";

export type CurrentUser = Profile & { roles: Role[] };

// The signed-in user with their profile and roles, or a redirect to /login.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }
  return { ...(profile as Profile), roles: (roles ?? []).map((r) => r.role as Role) };
});

export function hasRole(user: CurrentUser, ...roles: Role[]) {
  return user.roles.some((r) => roles.includes(r));
}

export async function requireRole(...roles: Role[]) {
  const user = await getCurrentUser();
  if (!hasRole(user, ...roles)) redirect("/");
  return user;
}
