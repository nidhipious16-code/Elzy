"use client";

import { useActionState } from "react";
import { createApiKey, type KeyState } from "./actions";
import { Alert, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ApiKeyForm() {
  const [state, action] = useActionState<KeyState, FormData>(createApiKey, undefined);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.key && (
        <Alert kind="success">
          <p className="font-semibold">Copy this key now. It won&apos;t be shown again.</p>
          <code className="mt-1 block break-all rounded bg-white p-2 text-sm">{state.key}</code>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        <input name="name" placeholder="e.g. Website contact form" className={`${inputClass} max-w-sm`} />
        <SubmitButton variant="secondary">Create key</SubmitButton>
      </div>
    </form>
  );
}
