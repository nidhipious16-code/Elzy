"use client";

import { useActionState, useState } from "react";
import { addNote, addTask, reassignLead, updateStatus, type ActionState } from "./actions";
import { NEXT_STEPS, STATUS } from "@/lib/labels";
import type { LeadStatus } from "@/lib/types";
import { Alert, Field, buttonStyles, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function Feedback({ state }: { state: ActionState }) {
  if (state?.error) return <Alert>{state.error}</Alert>;
  if (state?.ok) return <Alert kind="success">{state.ok}</Alert>;
  return null;
}

const STEP_STYLE: Partial<Record<LeadStatus, string>> = {
  converted: "border-green-600 bg-green-50 text-green-800",
  declined: "border-rose-500 bg-rose-50 text-rose-800",
};

// Big "what happened?" buttons. Steps that need more detail open a small form.
export function StatusActions({ leadId, status, demoManagers }: { leadId: string; status: LeadStatus; demoManagers: { id: string; name: string }[] }) {
  const [state, action] = useActionState(updateStatus, undefined);
  const [choice, setChoice] = useState<LeadStatus | null>(null);
  const steps = NEXT_STEPS[status];
  if (steps.length === 0) return null;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="lead_id" value={leadId} />
      <Feedback state={state} />
      <p className="font-semibold text-slate-700">What happened?</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setChoice(s)}
            className={`rounded-xl border-2 px-4 py-4 text-left text-lg font-semibold ${
              choice === s ? "border-blue-600 bg-blue-50 text-blue-800" : STEP_STYLE[s] ?? "border-slate-200 bg-white text-slate-800 hover:border-blue-300"
            }`}
          >
            {STATUS[s].label}
          </button>
        ))}
      </div>

      {choice && (
        <div className="space-y-4 rounded-xl bg-slate-50 p-4">
          <input type="hidden" name="status" value={choice} />
          {choice === "converted" && (
            <Field label="Deal value (₹) *">
              <input name="deal_value" inputMode="decimal" required className={inputClass} placeholder="50000" />
            </Field>
          )}
          {choice === "declined" && (
            <Field label="Why did they decline? *">
              <select name="decline_reason" required className={inputClass} defaultValue="">
                <option value="" disabled>
                  Choose a reason
                </option>
                <option>Price too high</option>
                <option>Not interested any more</option>
                <option>Bought from someone else</option>
                <option>Wrong number / fake lead</option>
                <option>Could not reach after many tries</option>
                <option>Other</option>
              </select>
            </Field>
          )}
          {choice === "demo_scheduled" && (
            <>
              <Field label="Demo date and time *">
                <input name="demo_at" type="datetime-local" required className={inputClass} />
              </Field>
              {demoManagers.length > 0 && (
                <Field label="Demo manager">
                  <select name="demo_manager_id" className={inputClass}>
                    <option value="">Not decided</option>
                    {demoManagers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}
          <Field label="Add a note (optional)">
            <textarea name="note" rows={2} className={inputClass} />
          </Field>
          <div className="flex gap-3">
            <SubmitButton>Save</SubmitButton>
            <button type="button" onClick={() => setChoice(null)} className={buttonStyles.secondary}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

export function NoteForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addNote, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <Feedback state={state} />
      <textarea name="body" rows={2} placeholder="What did the customer say?" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="type" value="call" variant="secondary">
          Save as call log
        </SubmitButton>
        <SubmitButton name="type" value="note" variant="secondary">
          Save as note
        </SubmitButton>
      </div>
    </form>
  );
}

export function TaskForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addTask, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <Feedback state={state} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" placeholder="e.g. Call back after salary day" className={inputClass} />
        <input name="due_at" type="datetime-local" required className={inputClass} />
      </div>
      <SubmitButton variant="secondary">Add reminder</SubmitButton>
    </form>
  );
}

export function ReassignForm({ leadId, current, people }: { leadId: string; current: string | null; people: { id: string; name: string }[] }) {
  const [state, action] = useActionState(reassignLead, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <Feedback state={state} />
      <select name="assigned_to" defaultValue={current ?? ""} required className={inputClass}>
        <option value="" disabled>
          Choose a person
        </option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <SubmitButton variant="secondary">Reassign</SubmitButton>
    </form>
  );
}
