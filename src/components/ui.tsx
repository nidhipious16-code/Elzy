import Link from "next/link";
import type { LeadStatus } from "@/lib/types";
import { STATUS } from "@/lib/labels";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS[status];
  return <span className={`inline-block rounded-full px-3 py-1 text-sm font-medium ${s.color}`}>{s.label}</span>;
}

export const buttonStyles = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-base font-semibold text-white hover:bg-rose-700 disabled:opacity-50",
};

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: keyof typeof buttonStyles }) {
  return (
    <Link href={href} className={buttonStyles[variant]}>
      {children}
    </Link>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-500">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success"; children: React.ReactNode }) {
  const cls = kind === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return <div className={`rounded-xl border px-4 py-3 ${cls}`}>{children}</div>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">{children}</div>;
}
