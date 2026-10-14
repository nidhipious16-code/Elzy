"use client";

import { useActionState } from "react";
import { createUser, resetPassword, updateUser, type UserFormState } from "./actions";
import { ROLE_LABELS } from "@/lib/labels";
import type { Profile, Role } from "@/lib/types";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Opt = { id: string; name: string };

function Feedback({ state }: { state: UserFormState }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.ok) return <Alert kind="success">{state.ok}</Alert>;
  return null;
}

function ProfileFields({ teams, regions, profile, roles }: { teams: Opt[]; regions: Opt[]; profile?: Profile; roles?: Role[] }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name *">
          <input name="full_name" defaultValue={profile?.full_name} required className={inputClass} />
        </Field>
        <Field label="Team">
          <select name="team_id" defaultValue={profile?.team_id ?? ""} className={inputClass}>
            <option value="">No team (sees across teams where allowed)</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region" hint="Leads from other regions won't be auto-assigned to them. Leave empty for any region.">
          <select name="region_id" defaultValue={profile?.region_id ?? ""} className={inputClass}>
            <option value="">Any region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How many open leads can they handle?" hint="Used for automatic assignment.">
          <input name="capacity" type="number" min={1} defaultValue={profile?.capacity ?? 30} className={inputClass} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">Roles (pick one or more)</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <label key={r} className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2">
              <input type="checkbox" name="roles" value={r} defaultChecked={roles?.includes(r)} className="h-5 w-5" />
              {ROLE_LABELS[r]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function NewUserForm({ teams, regions }: { teams: Opt[]; regions: Opt[] }) {
  const [state, action] = useActionState(createUser, undefined);
  return (
    <form action={action} className="space-y-4">
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Mobile number *" hint="They sign in with this number.">
          <input name="phone" type="tel" required className={inputClass} />
        </Field>
        <Field label="Starting password *" hint="At least 8 characters with a letter and a number.">
          <input name="password" type="text" autoComplete="new-password" required className={inputClass} />
        </Field>
      </div>
      <ProfileFields teams={teams} regions={regions} roles={["sales_person"]} />
      <SubmitButton>Add person</SubmitButton>
    </form>
  );
}

export function EditUserForm({ teams, regions, profile, roles }: { teams: Opt[]; regions: Opt[]; profile: Profile; roles: Role[] }) {
  const [state, action] = useActionState(updateUser, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={profile.id} />
      <Feedback state={state} />
      <ProfileFields teams={teams} regions={regions} profile={profile} roles={roles} />
      <label className="flex items-center gap-2">
        <input type="checkbox" name="is_active" defaultChecked={profile.is_active} className="h-5 w-5" />
        Account is active (untick to block sign-in)
      </label>
      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ id }: { id: string }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <Feedback state={state} />
      <input name="password" type="text" autoComplete="new-password" placeholder="New password" required className={inputClass} />
      <SubmitButton variant="secondary">Set new password</SubmitButton>
    </form>
  );
}
