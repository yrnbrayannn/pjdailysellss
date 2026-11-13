import { Link } from "react-router-dom";
import { supabase } from "../lib/api";
import { useApp } from "../lib/useApp";
import { Button, Card } from "../components/ui";

export default function More() {
  const { role, email } = useApp();
  const links =
    role === "admin"
      ? [
          { to: "/expenses", label: "💸 Expenses" },
          { to: "/menu", label: "🍽️ Menu, prices and nicknames" },
          { to: "/raw-items", label: "🧂 Raw items (Store and Butchery)" },
          { to: "/team", label: "👥 Team and roles" },
          { to: "/suppliers", label: "🚚 Suppliers" },
          { to: "/audit", label: "🕵️ Audit log" },
        ]
      : role === "cashier"
        ? [{ to: "/expenses", label: "💸 Expenses" }]
        : [];

  return (
    <div className="grid gap-4">
      <Card>
        <div className="text-sm text-muted">Signed in as</div>
        <div className="break-all text-lg font-bold">{email}</div>
        <div className="text-sm capitalize text-muted">{role}</div>
      </Card>
      {links.length > 0 && (
        <Card className="grid gap-2">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="flex h-14 items-center rounded-xl border-2 border-line px-4 text-lg font-bold active:bg-brand-soft">
              {l.label}
            </Link>
          ))}
        </Card>
      )}
      <Button variant="danger" onClick={() => void supabase.auth.signOut()}>Sign out</Button>
    </div>
  );
}
