// Categorical slot 1 of the reference data-viz palette.
const BAR_COLOR = "#2a78d6";

// Horizontal bars for one measure across categories. The value is printed in
// text beside each bar so it never relies on colour.
export function BarList({ rows }: { rows: { key: string; label: string; value: number; href?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) return <p className="text-slate-500">Nothing to show yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const inner = (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">{r.label}</span>
              <span className="font-semibold tabular-nums text-slate-900">{r.value}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: BAR_COLOR }} />
            </div>
          </>
        );
        return (
          <li key={r.key} title={`${r.label}: ${r.value}`}>
            {r.href ? (
              <a href={r.href} className="block rounded-lg p-1 hover:bg-slate-50">
                {inner}
              </a>
            ) : (
              <div className="p-1">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
