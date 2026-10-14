import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestLead } from "@/lib/leads";
import { idByName } from "@/lib/lookup";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// Website / external lead capture.
// POST JSON or form data with an `x-api-key` header created in Settings.
// Fields: name*, phone or email*, product, region, campaign, notes, consent, id.

const allowedOrigins = (process.env.LEAD_FORM_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function cors(req: Request) {
  const origin = req.headers.get("origin");
  const h: Record<string, string> = { Vary: "Origin" };
  if (origin && allowedOrigins.includes(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Allow-Headers"] = "content-type, x-api-key";
  }
  return h;
}

export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const headers = cors(req);
  if (!rateLimit(`inbound:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers });
  }

  const key = req.headers.get("x-api-key");
  if (!key) return NextResponse.json({ error: "Missing API key" }, { status: 401, headers });
  const admin = createAdminClient();
  const { data: apiKey } = await admin
    .from("api_keys")
    .select("id")
    .eq("key_hash", createHash("sha256").update(key).digest("hex"))
    .eq("is_active", true)
    .maybeSingle();
  if (!apiKey) return NextResponse.json({ error: "Invalid API key" }, { status: 401, headers });

  let body: Record<string, unknown>;
  try {
    const type = req.headers.get("content-type") ?? "";
    body = type.includes("application/json") ? await req.json() : Object.fromEntries((await req.formData()).entries());
  } catch {
    return NextResponse.json({ error: "Could not read the request body" }, { status: 400, headers });
  }
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : body[k] != null ? String(body[k]) : null);

  // Honeypot field for spam bots: real forms leave it empty.
  if (str("website_url")) return NextResponse.json({ ok: true }, { headers });

  const result = await ingestLead({
    full_name: str("name") ?? str("full_name") ?? "",
    phone: str("phone"),
    email: str("email"),
    source: "website",
    campaign: str("campaign") ?? str("utm_campaign"),
    notes: str("notes") ?? str("message"),
    product_id: await idByName("products", str("product")),
    region_id: await idByName("regions", str("region")),
    consent_given: ["true", "1", "yes", "on"].includes((str("consent") ?? "").toLowerCase()),
    consent_note: "Submitted via website form",
    external_id: str("id"),
  });
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id);

  if ("error" in result && !("duplicate" in result && result.duplicate)) {
    return NextResponse.json({ error: result.error }, { status: 422, headers });
  }
  return NextResponse.json({ ok: true }, { status: 201, headers });
}
