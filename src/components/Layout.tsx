// App shell: login check, role check, header (date + shift), responsive navigation.
import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { guessShift, localDate, supabase } from "../lib/api";
import type { AppCtx } from "../lib/useApp";
import type { Role, Shift } from "../lib/types";
import { ErrorBox } from "./ui";

const ORDERS = { to: "/orders", icon: "🧾", label: "Orders" };
const BUTCHERY = { to: "/butchery", icon: "🥩", label: "Butchery" };
const STOCK = { to: "/stock", icon: "📦", label: "Stock" };
const EXPENSES = { to: "/expenses", icon: "💸", label: "Expenses" };
const MORE = { to: "/more", icon: "⋯", label: "More" };

const NAV: Record<Role, { to: string; icon: string; label: string }[]> = {
  admin: [{ to: "/dashboard", icon: "📊", label: "Dashboard" }, ORDERS, BUTCHERY, STOCK, MORE],
  cashier: [{ to: "/dashboard", icon: "📊", label: "Handover" }, ORDERS, BUTCHERY, STOCK, MORE],
  butcher: [BUTCHERY, STOCK, EXPENSES, MORE],
  staff: [ORDERS, STOCK, EXPENSES, MORE],
};

const KNOWN_ROLES: Role[] = ["admin", "cashier", "butcher", "staff"];

export default function Layout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [role, setRole] = useState<Role | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [date, setDate] = useState(localDate());
  const [shift, setShift] = useState<Shift>(guessShift());

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setRole(null); return; }
    void supabase.from("profiles").select("role").eq("id", userId).maybeSingle().then(({ data, error }) => {
      if (error) { setSetupError(`Could not read your profile: ${error.message}. Has supabase/schema.sql been run?`); setRole("staff"); }
      else if (!data) { setSetupError("No profile found for this login. Run supabase/schema.sql in Supabase."); setRole("staff"); }
      else { setSetupError(null); setRole(KNOWN_ROLES.includes(data.role as Role) ? (data.role as Role) : "staff"); }
    });
  }, [userId]);

  if (session === undefined || (session && role === null)) {
    return <div className="grid min-h-screen place-items-center text-lg text-muted">Loading…</div>;
  }
  if (!session || !role) return <Navigate to="/login" replace />;

  const ctx: AppCtx = { date, shift, role, userId: session.user.id, email: session.user.email ?? "" };
  const nav = NAV[role];

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-line bg-white md:flex">
        <div className="flex h-16 items-center border-b border-line px-6">
          <span className="text-xl font-extrabold text-brand">PJ's Stock & Sales</span>
        </div>
        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {nav.map((n) => (
            <NavLink
              key={n.to} to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 font-bold transition-colors ${
                  isActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-gray-100 hover:text-ink"
                }`
              }
            >
              <span className="text-xl leading-none">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          <div className="mb-3 px-2">
            <div className="text-xs font-bold uppercase text-muted">{role}</div>
            <div className="truncate text-sm font-semibold">{session.user.email}</div>
          </div>
          <button onClick={() => void supabase.auth.signOut()} className="w-full rounded-lg bg-danger-soft py-2 font-bold text-danger hover:bg-red-200">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header (Date + Shift) */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <span className="text-lg font-extrabold text-brand">PJ's</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
            <input
              type="date" value={date} aria-label="Date"
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-10 min-w-0 rounded-xl border-2 border-line bg-white px-3 text-base font-semibold text-ink"
            />
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              {(["Day", "Night"] as const).map((s) => (
                <button
                  key={s} type="button" onClick={() => setShift(s)}
                  className={`h-8 rounded-lg px-4 text-sm font-bold transition-colors ${s === shift ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="hidden rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase text-brand md:inline-block">{role}</span>
          </div>
        </header>

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {setupError && <ErrorBox>{setupError}</ErrorBox>}
            <Outlet context={ctx} key={`${date}-${shift}`} />
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map((n) => (
              <NavLink
                key={n.to} to={n.to}
                className={({ isActive }) =>
                  `flex h-16 flex-col items-center justify-center text-xs font-bold ${isActive ? "text-brand" : "text-muted"}`
                }
              >
                <span className="text-2xl leading-none">{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}