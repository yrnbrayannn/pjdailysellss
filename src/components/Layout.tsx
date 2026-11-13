// App shell: login check, role check, header (date + shift), bottom navigation.
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

/** Bottom navigation per role. Keep it to 5 buttons so it stays easy to tap. */
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

  // 1. who is logged in?
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // 2. what is their role? (profiles.role = admin, cashier, butcher or staff)
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-brand px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white shadow">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-lg font-extrabold">PJ's Stock &amp; Sales</span>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase">{role}</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="date" value={date} aria-label="Date"
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-12 min-w-0 rounded-xl bg-white px-3 text-lg font-semibold text-ink"
            />
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1">
              {(["Day", "Night"] as const).map((s) => (
                <button
                  key={s} type="button" onClick={() => setShift(s)}
                  className={`h-10 rounded-lg px-4 font-bold ${s === shift ? "bg-white text-brand" : "text-white"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-32 pt-4">
        {setupError && <ErrorBox>{setupError}</ErrorBox>}
        {/* key makes every page reload cleanly when the date or shift changes */}
        <Outlet context={ctx} key={`${date}-${shift}`} />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
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
  );
}
