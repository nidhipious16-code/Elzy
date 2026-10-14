"use client";

import { useActionState } from "react";
import { importLeads, type ImportState } from "./actions";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ImportForm({ teams }: { teams: { id: string; name: string }[] | null }) {
  const [state, action] = useActionState<ImportState, FormData>(importLeads, undefined);
  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.added !== undefined && (
        <Alert kind="success">
          Added {state.added} lead{state.added === 1 ? "" : "s"}. They have been shared out to the team automatically.
          {!!state.skipped?.length && (
            <details className="mt-2">
              <summary className="cursor-pointer font-semibold">{state.skipped.length} rows skipped</summary>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {state.skipped.slice(0, 100).map((s) => (
                  <li key={s.row}>
                    Row {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Alert>
      )}
      <Field label="CSV file" hint="Columns: Name, Phone, Email, Product, Region, Campaign, Notes, Consent. Name and Phone (or Email) are required.">
        <input type="file" name="file" accept=".csv,text/csv" required className={inputClass} />
      </Field>
      {teams && (
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
      <SubmitButton pendingText="Importing…">Import leads</SubmitButton>
    </form>
  );
}
