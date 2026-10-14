"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles } from "./ui";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonStyles;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} name={name} value={value} className={`${buttonStyles[variant]} ${className}`}>
      {pending ? pendingText : children}
    </button>
  );
}
