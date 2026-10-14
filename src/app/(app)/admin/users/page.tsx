import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getReference, nameOf } from "@/lib/data";
import { ROLE_LABELS } from "@/lib/labels";
import { Card, PageHeader } from "@/components/ui";
import { NewUserForm } from "./user-forms";

export default async function UsersPage() {
  await requireRole("admin");
  const ref = await getReference();
  return (
    <>
      <PageHeader title="Team members" subtitle="Add people, give them roles, and set how many leads they can take." />
      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead className="text-sm text-slate-600">
              <tr>
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Roles</th>
                <th className="py-2">Team</th>
                <th className="py-2">Capacity</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ref.people.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">
                    <Link href={`/admin/users/${p.id}`} className="font-semibold text-blue-700 hover:underline">
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="py-2">{p.email}</td>
                  <td className="py-2 text-sm">{p.roles.map((r) => ROLE_LABELS[r]).join(", ")}</td>
                  <td className="py-2">{nameOf(ref.teams, p.team_id) || "—"}</td>
                  <td className="py-2">{p.capacity}</td>
                  <td className="py-2 text-sm">{!p.is_active ? "Switched off" : p.is_available ? "Available" : "Away"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-bold">Add a person</h2>
        <NewUserForm teams={ref.teams} regions={ref.regions} />
      </Card>
    </>
  );
}
