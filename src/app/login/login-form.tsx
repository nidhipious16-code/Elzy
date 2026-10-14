"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Alert, Field, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-5">
      {notice && <Alert>{notice}</Alert>}
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Email">
        <input name="email" type="email" inputMode="email" autoComplete="username" placeholder="you@company.com" required className={inputClass} />
      </Field>
      <Field label="Password">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <SubmitButton className="w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm text-slate-500">Forgot your password? Ask your admin to reset it.</p>
    </form>
  );
}
