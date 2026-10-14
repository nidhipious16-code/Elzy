import { requireRole, hasRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { LeadForm } from "./lead-form";

export default async function NewLeadPage() {
  const user = await requireRole("admin", "sales_manager", "sales_person", "call_executive");
  const ref = await getReference();
  const isAdmin = hasRole(user, "admin");
  const people = ref.people
    .filter((p) => p.is_active && p.roles.some((r) => r === "sales_person" || r === "call_executive"))
    .filter((p) => isAdmin || p.team_id === user.team_id)
    .map((p) => ({ id: p.id, name: p.full_name }));

  return (
    <>
      <PageHeader title="Add a lead" subtitle="For walk-ins, referrals, phone calls or anyone you met offline." />
      <Card>
        <LeadForm
          products={ref.products}
          regions={ref.regions}
          teams={ref.teams}
          people={people}
          canChooseTeam={isAdmin}
          canChoosePerson={hasRole(user, "admin", "sales_manager")}
          takesLeads={hasRole(user, "sales_person", "call_executive")}
        />
      </Card>
    </>
  );
}
