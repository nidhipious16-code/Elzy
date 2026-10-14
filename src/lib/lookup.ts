import "server-only";
import { createAdminClient } from "./supabase/admin";

// Finds a product or region id by its name (case-insensitive), for leads that
// arrive from outside the app with plain-text values.
export async function idByName(table: "products" | "regions", name: string | null | undefined) {
  const n = name?.trim();
  if (!n) return null;
  const { data } = await createAdminClient().from(table).select("id").ilike("name", n.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
