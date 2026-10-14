import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestLead } from "@/lib/leads";
import { idByName } from "@/lib/lookup";
import { createAdminClient } from "@/lib/supabase/admin";

// One webhook for Meta: Facebook/Instagram lead ads (Page "leadgen") and
// WhatsApp Business Cloud API messages.

const GRAPH = "https://graph.facebook.com/v21.0";

// Meta calls this once when you save the webhook URL.
export function GET(req: Request) {
  const url = new URL(req.url);
  const ok =
    url.searchParams.get("hub.mode") === "subscribe" &&
    !!process.env.META_VERIFY_TOKEN &&
    url.searchParams.get("hub.verify_token") === process.env.META_VERIFY_TOKEN;
  return ok ? new NextResponse(url.searchParams.get("hub.challenge")) : new NextResponse("Forbidden", { status: 403 });
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const given = Buffer.from(header.slice(7));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

type FieldData = { name: string; values: string[] };

async function handleLeadgen(leadgenId: string) {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN is not set");
  const res = await fetch(`${GRAPH}/${encodeURIComponent(leadgenId)}?fields=field_data,campaign_name,ad_name,form_id,platform`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
  const lead = (await res.json()) as { field_data?: FieldData[]; campaign_name?: string; ad_name?: string; platform?: string };
  const field = (...names: string[]) => lead.field_data?.find((f) => names.includes(f.name.toLowerCase()))?.values?.[0] ?? null;
  const first = field("first_name");
  const last = field("last_name");

  await ingestLead({
    full_name: field("full_name", "name") ?? ([first, last].filter(Boolean).join(" ") || "Facebook lead"),
    phone: field("phone_number", "phone", "mobile_number"),
    email: field("email"),
    source: lead.platform === "ig" ? "instagram" : "facebook",
    campaign: lead.campaign_name ?? lead.ad_name ?? null,
    product_id: await idByName("products", field("product", "product_interest")),
    region_id: await idByName("regions", field("region", "city", "state")),
    consent_given: true,
    consent_note: "Submitted Meta lead ad form",
    external_id: leadgenId,
  });
}

type WaValue = {
  contacts?: { wa_id: string; profile?: { name?: string } }[];
  messages?: { from: string; id: string; type: string; text?: { body?: string } }[];
};

async function handleWhatsApp(value: WaValue) {
  for (const m of value.messages ?? []) {
    const contact = value.contacts?.find((c) => c.wa_id === m.from);
    await ingestLead({
      full_name: contact?.profile?.name || `WhatsApp +${m.from}`,
      phone: `+${m.from}`,
      source: "whatsapp",
      notes: m.text?.body ?? `(${m.type} message)`,
      consent_given: true,
      consent_note: "Customer messaged us on WhatsApp",
      external_id: m.id,
    });
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Invalid signature", { status: 401 });
  }
  const payload = JSON.parse(raw) as {
    object: string;
    entry?: { changes?: { field: string; value: Record<string, unknown> }[] }[];
  };

  const errors: string[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      try {
        if (payload.object === "page" && change.field === "leadgen") {
          await handleLeadgen(String(change.value.leadgen_id));
        } else if (payload.object === "whatsapp_business_account" && change.field === "messages") {
          await handleWhatsApp(change.value as WaValue);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
  }
  if (errors.length) {
    // Keep a record so an admin can see failed deliveries; still answer 200 so
    // Meta doesn't disable the webhook over one bad event.
    await createAdminClient()
      .from("audit_log")
      .insert({ action: "webhook_error", entity: "meta", details: { errors } });
  }
  return NextResponse.json({ ok: true });
}
