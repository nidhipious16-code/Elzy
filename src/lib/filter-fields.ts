import type { CurrentUser } from "./auth";
import { hasRole } from "./auth";
import type { Reference } from "./data";
import type { FilterField } from "@/components/filter-bar";
import { SOURCE_LABELS, STATUS, STATUS_ORDER } from "./labels";

// The filter dropdowns a person gets. Team and person filters are only useful
// to people who can see more than their own leads.
export function filterFieldsFor(user: CurrentUser, ref: Reference): FilterField[] {
  const fields: FilterField[] = [
    { name: "product", label: "Product", options: ref.products.map((p) => ({ value: p.id, label: p.name })) },
    { name: "status", label: "Status", options: STATUS_ORDER.map((s) => ({ value: s, label: STATUS[s].label })) },
    { name: "region", label: "Region", options: ref.regions.map((r) => ({ value: r.id, label: r.name })) },
    { name: "source", label: "Source", options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })) },
  ];
  if (hasRole(user, "admin")) {
    fields.push({ name: "team", label: "Team", options: ref.teams.map((t) => ({ value: t.id, label: t.name })) });
  }
  if (hasRole(user, "admin", "sales_manager")) {
    const people = ref.people.filter(
      (p) => p.roles.some((r) => r === "sales_person" || r === "call_executive") && (hasRole(user, "admin") || p.team_id === user.team_id),
    );
    fields.push({ name: "user", label: "Person", options: people.map((p) => ({ value: p.id, label: p.full_name })) });
  }
  return fields;
}
