"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots 1 and 2 of the reference data-viz palette.
const SERIES = { leads: "#2a78d6", converted: "#eb6834" };

export function TrendChart({ data }: { data: { day: string; leads: number; converted: number }[] }) {
  if (data.length === 0) return <p className="text-slate-500">No leads in this period.</p>;
  const rows = data.map((d) => ({
    ...d,
    label: new Date(d.day + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#52514e", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#d6d3d1" }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fill: "#52514e", fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: "#a8a29e", strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 12, borderColor: "#e7e5e4", color: "#0b0b0b" }}
          />
          <Legend iconType="plainline" wrapperStyle={{ color: "#52514e", fontSize: 14 }} />
          <Line type="monotone" dataKey="leads" name="New leads" stroke={SERIES.leads} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="converted" name="Converted" stroke={SERIES.converted} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
