import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getReference } from "@/lib/data";
import { Card, PageHeader } from "@/components/ui";
import { EditUserForm, ResetPasswordForm } from "../user-forms";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const ref = await getReference();
  const person = ref.people.find((p) => p.id === id);
  if (!person) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900">
        <ArrowLeft size={18} /> Team members
      </Link>
      <PageHeader title={person.full_name} subtitle={person.phone} />
      <Card>
        <EditUserForm teams={ref.teams} regions={ref.regions} profile={person} roles={person.roles} />
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Reset password</h2>
        <ResetPasswordForm id={person.id} />
      </Card>
    </div>
  );
}
