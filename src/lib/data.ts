import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Named, Profile, Role } from "./types";

export type Reference = {
  products: Named[];
  regions: Named[];
  teams: Named[];
  people: (Profile & { roles: Role[] })[];
};

// Dropdown data used across pages. Cached for the length of one request.
export const getReference = cache(async (): Promise<Reference> => {
  const supabase = await createClient();
  const [products, regions, teams, people, roles] = await Promise.all([
    supabase.from("products").select("id, name").eq("is_active", true).order("name"),
    supabase.from("regions").select("id, name").eq("is_active", true).order("name"),
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("profiles").select("*").order("full_name"),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  return {
    products: products.data ?? [],
    regions: regions.data ?? [],
    teams: teams.data ?? [],
    people: (people.data ?? []).map((p) => ({
      ...(p as Profile),
      roles: (roles.data ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as Role),
    })),
  };
});

export function nameOf(list: Named[] | { id: string; full_name: string }[], id: string | null | undefined) {
  if (!id) return "";
  const item = (list as { id: string; name?: string; full_name?: string }[]).find((x) => x.id === id);
  return item?.name ?? item?.full_name ?? "";
}
