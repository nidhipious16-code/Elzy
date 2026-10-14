"use client";

import { createContext, useContext, useTransition } from "react";

const PendingContext = createContext(false);
export const useKeepValuesPending = () => useContext(PendingContext);

// A form that keeps what the person typed when the server sends back an error.
// (A plain <form action> is cleared by React after every submit, which would
// make someone retype a whole lead because of one wrong field.)
export function KeepValuesForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => action(data));
      }}
    >
      <PendingContext.Provider value={pending}>{children}</PendingContext.Provider>
    </form>
  );
}
