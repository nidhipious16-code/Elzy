export type Role = "admin" | "sales_manager" | "sales_person" | "call_executive" | "demo_manager";
export type LeadSource = "facebook" | "instagram" | "whatsapp" | "website" | "call" | "manual" | "import";
export type LeadStatus =
  | "new"
  | "responsive"
  | "not_responsive"
  | "demo_agreed"
  | "demo_scheduled"
  | "demo_done"
  | "converted"
  | "declined";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  team_id: string | null;
  region_id: string | null;
  capacity: number;
  is_available: boolean;
  is_active: boolean;
};

export type Lead = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  campaign: string | null;
  product_id: string | null;
  region_id: string | null;
  team_id: string | null;
  assigned_to: string | null;
  status: LeadStatus;
  is_closed: boolean;
  deal_value: number | null;
  decline_reason: string | null;
  demo_at: string | null;
  demo_manager_id: string | null;
  consent_given: boolean;
  consent_note: string | null;
  notes: string | null;
  created_at: string;
  last_activity_at: string;
  closed_at: string | null;
};

export type Named = { id: string; name: string };
