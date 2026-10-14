"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createLead, type FormState } from "../actions";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { KeepValuesForm } from "@/components/keep-values-form";

type Opt = { id: string; name: string };

export function LeadForm({
  products,
  regions,
  teams,
  people,
  canChooseTeam,
  canChoosePerson,
  takesLeads,
}: {
  products: Opt[];
  regions: Opt[];
  teams: Opt[];
  people: Opt[];
  canChooseTeam: boolean;
  canChoosePerson: boolean;
  takesLeads: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(createLead, undefined);
  const [confirmDup, setConfirmDup] = useState(false);

  return (
    <KeepValuesForm action={action} className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.duplicate && !confirmDup && (
        <Alert>
          <p className="font-semibold">This mobile number is already an open lead.</p>
          <p>
            <Link href={`/leads/${state.duplicate.id}`} className="underline">
              {state.duplicate.full_name}
            </Link>{" "}
            is with {state.duplicate.owner}.
          </p>
          <button type="button" onClick={() => setConfirmDup(true)} className="mt-2 font-semibold underline">
            Add it anyway
          </button>
        </Alert>
      )}
      {confirmDup && <input type="hidden" name="confirm_duplicate" value="1" />}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Customer name *">
          <input name="full_name" required className={inputClass} />
        </Field>
        <Field label="Mobile number" hint="10 digits is fine. We add +91.">
          <input name="phone" type="tel" inputMode="tel" className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className={inputClass} />
        </Field>
        <Field label="Where did this lead come from?">
          <select name="source" defaultValue="manual" className={inputClass}>
            <option value="manual">Walk-in / referral / word of mouth</option>
            <option value="call">Phone call</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="website">Website</option>
          </select>
        </Field>
        <Field label="Product interested in">
          <select name="product_id" className={inputClass}>
            <option value="">Not sure yet</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region">
          <select name="region_id" className={inputClass}>
            <option value="">Not sure</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        {canChooseTeam && (
          <Field label="Team">
            <select name="team_id" className={inputClass}>
              <option value="">My team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Who should handle it?">
          <select name="assign" defaultValue={takesLeads ? "me" : "auto"} className={inputClass}>
            {takesLeads && <option value="me">Me</option>}
            <option value="auto">Give it to whoever is free (automatic)</option>
            {canChoosePerson &&
              people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Campaign or referred by">
          <input name="campaign" className={inputClass} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} className={inputClass} />
      </Field>
      <label className="flex items-start gap-3 rounded-xl bg-slate-100 p-4">
        <input type="checkbox" name="consent_given" className="mt-1 h-5 w-5" />
        <span>
          <span className="font-semibold">The customer agreed to be contacted.</span>
          <input name="consent_note" placeholder="How? e.g. asked us to call back" className={`${inputClass} mt-2`} />
        </span>
      </label>
      <SubmitButton className="w-full md:w-auto">Save lead</SubmitButton>
    </KeepValuesForm>
  );
}
