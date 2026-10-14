import { hasRole, requireRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const user = await requireRole("admin", "sales_manager");
  const ref = await getReference();
  return (
    <>
      <PageHeader title="Import leads" subtitle="Upload a spreadsheet saved as CSV. Duplicates are skipped." />
      <Card>
        <ImportForm teams={hasRole(user, "admin") ? ref.teams : null} />
      </Card>
    </>
  );
}
