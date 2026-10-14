import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { getCurrentUser, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/labels";
import { signOut } from "../login/actions";
import { setAvailability } from "./actions";
import { BottomNav, SideNav, type NavItem } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { count: unread } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  const items: NavItem[] = [
    { href: "/my-day", label: "My day", icon: "day" },
    { href: "/leads", label: "Leads", icon: "leads" },
    { href: "/", label: "Dashboard", icon: "dashboard" },
  ];
  if (hasRole(user, "admin", "sales_manager", "demo_manager")) items.push({ href: "/demos", label: "Demos", icon: "demos" });
  if (hasRole(user, "admin", "sales_manager")) items.push({ href: "/targets", label: "Targets", icon: "targets" });
  if (hasRole(user, "admin")) {
    items.push({ href: "/admin/users", label: "Team", icon: "team" });
    items.push({ href: "/admin/settings", label: "Settings", icon: "settings" });
  }
  const takesLeads = hasRole(user, "sales_person", "call_executive");

  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <Link href="/" className="mb-6 px-2 text-xl font-bold text-blue-700">
          Elzy
        </Link>
        <SideNav items={items} />
        <div className="mt-auto space-y-3 border-t border-slate-200 pt-4">
          <div className="px-2">
            <div className="font-semibold">{user.full_name}</div>
            <div className="text-sm text-slate-500">{user.roles.map((r) => ROLE_LABELS[r]).join(", ")}</div>
          </div>
          {takesLeads && <AvailabilityToggle available={user.is_available} />}
          <form action={signOut}>
            <button className="flex w-full items-center gap-2 rounded-xl px-4 py-2 text-slate-600 hover:bg-slate-100">
              <LogOut size={18} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
          <Link href="/" className="text-lg font-bold text-blue-700 md:hidden">
            Elzy
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {takesLeads && (
              <div className="md:hidden">
                <AvailabilityToggle available={user.is_available} compact />
              </div>
            )}
            <Link href="/notifications" className="relative rounded-full p-2 hover:bg-slate-100" aria-label="Notifications">
              <Bell size={24} />
              {!!unread && (
                <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-rose-600 px-1.5 text-center text-xs font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <form action={signOut} className="md:hidden">
              <button className="rounded-full p-2 hover:bg-slate-100" aria-label="Sign out">
                <LogOut size={22} />
              </button>
            </form>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 pb-24 md:px-8 md:pb-8">{children}</main>
      </div>
      <BottomNav items={items} />
    </div>
  );
}

function AvailabilityToggle({ available, compact }: { available: boolean; compact?: boolean }) {
  return (
    <form action={setAvailability}>
      <input type="hidden" name="available" value={available ? "false" : "true"} />
      <button
        className={`flex w-full items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
          available ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
        }`}
        title="When you are away, new leads are not given to you"
      >
        <span className={`h-3 w-3 rounded-full ${available ? "bg-emerald-500" : "bg-slate-400"}`} />
        {available ? (compact ? "Available" : "Available for new leads") : compact ? "Away" : "Away (no new leads)"}
      </button>
    </form>
  );
}
