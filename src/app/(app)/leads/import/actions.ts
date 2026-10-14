"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { parseCsv } from "@/lib/csv";
import { findDuplicate, insertLead } from "@/lib/leads";
import { normalizePhone } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";

export type ImportState = { error?: string; added?: number; skipped?: { row: number; reason: string }[] } | undefined;

const MAX_ROWS = 2000;
const HEADERS: Record<string, string> = {
  name: "full_name",
  "full name": "full_name",
  "customer name": "full_name",
  phone: "phone",
  mobile: "phone",
  "mobile number": "phone",
  "phone number": "phone",
  email: "email",
  product: "product",
  region: "region",
  campaign: "campaign",
  notes: "notes",
  consent: "consent",
};

export async function importLeads(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!hasRole(user, "admin", "sales_manager")) return { error: "Only managers can import leads." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > 5 * 1024 * 1024) return { error: "The file is too big. Keep it under 5 MB." };

  const rows = parseCsv(await file.text());
  if (rows.length < 2) return { error: "The file has no rows under the header." };
  if (rows.length - 1 > MAX_ROWS) return { error: `Import up to ${MAX_ROWS} rows at a time.` };

  const columns = rows[0].map((h) => HEADERS[h.trim().toLowerCase()] ?? null);
  if (!columns.includes("full_name") || !(columns.includes("phone") || columns.includes("email"))) {
    return { error: "The first row must have a Name column and a Phone or Email column." };
  }

  const ref = await getReference();
  const byName = (list: { id: string; name: string }[], v?: string) =>
    v ? list.find((x) => x.name.toLowerCase() === v.trim().toLowerCase())?.id ?? null : null;
  const team_id = hasRole(user, "admin") ? (formData.get("team_id") as string) || user.team_id : user.team_id;

  const admin = createAdminClient();
  const skipped: { row: number; reason: string }[] = [];
  const seen = new Set<string>();
  let added = 0;

  for (let i = 1; i < rows.length; i++) {
    const rec: Record<string, string> = {};
    columns.forEach((c, j) => c && (rec[c] = (rows[i][j] ?? "").trim()));
    const phone = normalizePhone(rec.phone);
    if (phone && seen.has(phone)) {
      skipped.push({ row: i + 1, reason: "Same number appears earlier in the file" });
      continue;
    }
    if (phone && (await findDuplicate(phone))) {
      skipped.push({ row: i + 1, reason: "Already an open lead" });
      continue;
    }
    const result = await insertLead(admin, {
      created_by: user.id,
      full_name: rec.full_name,
      phone: rec.phone || null,
      email: rec.email || null,
      source: "import",
      campaign: rec.campaign || file.name.slice(0, 100),
      product_id: byName(ref.products, rec.product),
      region_id: byName(ref.regions, rec.region),
      team_id,
      notes: rec.notes || null,
      consent_given: /^(y|yes|true|1)$/i.test(rec.consent ?? ""),
    });
    if ("error" in result) skipped.push({ row: i + 1, reason: result.error ?? "Invalid row" });
    else {
      added++;
      if (phone) seen.add(phone);
    }
  }
  revalidatePath("/leads");
  return { added, skipped };
}
