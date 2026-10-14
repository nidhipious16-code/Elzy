"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createFirstAdmin, type SetupState } from "./actions";
import { Alert, Field, buttonStyles, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { KeepValuesForm } from "@/components/keep-values-form";

export function SetupForm() {
  const [state, action] = useActionState<SetupState, FormData>(createFirstAdmin, undefined);
  if (state?.done) {
    return (
      <div className="space-y-4">
        <Alert kind="success">Your admin account is ready. Sign in with {state.done}.</Alert>
        <Link href="/login" className={`${buttonStyles.primary} w-full`}>
          Go to sign in
        </Link>
      </div>
    );
  }
  return (
    <KeepValuesForm action={action} className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Your name">
        <input name="full_name" required className={inputClass} />
      </Field>
      <Field label="Your email">
        <input name="email" type="email" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Choose a password" hint="At least 8 characters with a letter and a number.">
        <input name="password" type="password" autoComplete="new-password" required className={inputClass} />
      </Field>
      <Field label="Setup code" hint="The SETUP_CODE you added when putting the app online.">
        <input name="setup_code" type="password" required className={inputClass} />
      </Field>
      <SubmitButton className="w-full">Create admin account</SubmitButton>
    </KeepValuesForm>
  );
}
