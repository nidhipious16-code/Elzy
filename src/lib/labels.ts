import type { LeadSource, LeadStatus, Role } from "./types";

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  sales_manager: "Sales Manager",
  sales_person: "Sales Person",
  call_executive: "Call Executive",
  demo_manager: "Demo Manager",
};

export const SOURCE_LABELS: Record<LeadSource, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  website: "Website",
  call: "Phone call",
  manual: "Walk-in / referral",
  import: "Imported file",
};

// Plain-language names and colours shown on buttons and badges.
export const STATUS: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-sky-100 text-sky-800" },
  responsive: { label: "Picked up the call", color: "bg-emerald-100 text-emerald-800" },
  not_responsive: { label: "Didn't pick up", color: "bg-amber-100 text-amber-800" },
  demo_agreed: { label: "Agreed to a demo", color: "bg-violet-100 text-violet-800" },
  demo_scheduled: { label: "Demo booked", color: "bg-indigo-100 text-indigo-800" },
  demo_done: { label: "Demo done", color: "bg-blue-100 text-blue-800" },
  converted: { label: "Converted", color: "bg-green-600 text-white" },
  declined: { label: "Declined", color: "bg-rose-600 text-white" },
};

export const STATUS_ORDER: LeadStatus[] = [
  "new",
  "responsive",
  "not_responsive",
  "demo_agreed",
  "demo_scheduled",
  "demo_done",
  "converted",
  "declined",
];

// What the person should be able to do next from each stage.
export const NEXT_STEPS: Record<LeadStatus, LeadStatus[]> = {
  new: ["responsive", "not_responsive", "declined"],
  not_responsive: ["responsive", "declined"],
  responsive: ["demo_agreed", "converted", "declined"],
  demo_agreed: ["demo_scheduled", "declined"],
  demo_scheduled: ["demo_done", "declined"],
  demo_done: ["converted", "declined"],
  converted: [],
  declined: [],
};

export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
