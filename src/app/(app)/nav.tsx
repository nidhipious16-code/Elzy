"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, ClipboardList, Presentation, Settings, Target, Users } from "lucide-react";

const ICONS = { dashboard: BarChart3, leads: ClipboardList, day: CalendarCheck, demos: Presentation, targets: Target, team: Users, settings: Settings };
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(path, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium ${
              active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <Icon size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Phone layout: the first four items as big tabs at the bottom of the screen.
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 grid border-t border-slate-200 bg-white md:hidden" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)` }}>
      {items.slice(0, 4).map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(path, item.href);
        return (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 py-2 text-xs font-medium ${active ? "text-blue-600" : "text-slate-600"}`}>
            <Icon size={24} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
