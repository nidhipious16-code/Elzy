import type { LeadSource, LeadStatus } from "./types";
import { SOURCE_LABELS, STATUS } from "./labels";

export type LeadFilters = {
  q?: string;
  product?: string;
  region?: string;
  status?: LeadStatus;
  source?: LeadSource;
  team?: string;
  user?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd, inclusive
  open?: "1";
};

const UUID = /^[0-9a-f-]{36}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

// Reads filters from the URL, dropping anything malformed.
export function parseFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : undefined) || undefined;
  const id = (k: string) => (UUID.test(get(k) ?? "") ? get(k) : undefined);
  const day = (k: string) => (DAY.test(get(k) ?? "") ? get(k) : undefined);
  const status = get("status");
  const source = get("source");
  return {
    q: get("q")?.slice(0, 100),
    product: id("product"),
    region: id("region"),
    team: id("team"),
    user: id("user"),
    status: status && status in STATUS ? (status as LeadStatus) : undefined,
    source: source && source in SOURCE_LABELS ? (source as LeadSource) : undefined,
    from: day("from"),
    to: day("to"),
    open: get("open") === "1" ? "1" : undefined,
  };
}

// Inclusive "to" date → exclusive timestamp at the next IST midnight.
export function dateRange(f: LeadFilters) {
  const from = f.from ? new Date(`${f.from}T00:00:00+05:30`).toISOString() : null;
  let to: string | null = null;
  if (f.to) {
    const d = new Date(`${f.to}T00:00:00+05:30`);
    d.setUTCDate(d.getUTCDate() + 1);
    to = d.toISOString();
  }
  return { from, to };
}

export function toQueryString(f: LeadFilters) {
  const params = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
  const s = params.toString();
  return s ? `?${s}` : "";
}
