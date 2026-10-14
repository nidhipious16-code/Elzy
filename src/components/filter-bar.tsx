"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { X } from "lucide-react";

type Option = { value: string; label: string };
export type FilterField = { name: string; label: string; options: Option[] };

const selectClass =
  "rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-800 focus:border-blue-500 focus:outline-none";

// Dropdown filters that update the URL straight away, so the list and charts
// on the page refresh as soon as a choice is made.
export function FilterBar({ fields, showSearch, showDates = true }: { fields: FilterField[]; showSearch?: boolean; showDates?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function set(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const hasAny = [...params.keys()].length > 0;

  return (
    <div className={`mb-6 flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      {showSearch && (
        <input
          type="search"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search name, phone or email"
          className={`${selectClass} min-w-56 flex-1`}
          onKeyDown={(e) => e.key === "Enter" && set("q", (e.target as HTMLInputElement).value)}
          onBlur={(e) => e.target.value !== (params.get("q") ?? "") && set("q", e.target.value)}
        />
      )}
      {fields.map((f) => (
        <select key={f.name} aria-label={f.label} value={params.get(f.name) ?? ""} onChange={(e) => set(f.name, e.target.value)} className={selectClass}>
          <option value="">{f.label}: All</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {showDates && (
        <>
          <label className="flex items-center gap-1 text-sm text-slate-600">
            From
            <input type="date" value={params.get("from") ?? ""} onChange={(e) => set("from", e.target.value)} className={selectClass} />
          </label>
          <label className="flex items-center gap-1 text-sm text-slate-600">
            To
            <input type="date" value={params.get("to") ?? ""} onChange={(e) => set("to", e.target.value)} className={selectClass} />
          </label>
        </>
      )}
      {hasAny && (
        <button onClick={() => startTransition(() => router.replace(pathname))} className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-slate-600 hover:bg-slate-100">
          <X size={18} /> Clear
        </button>
      )}
    </div>
  );
}
