// Admin: see everyone who has a login and change their role by tapping.
// Creating a login still happens in Supabase (Authentication, Users): the browser must never hold the admin key.
import { useEffect, useState } from "react";
import { getAll, updateRows } from "../lib/api";
import { useApp } from "../lib/useApp";
import { ROLES, type Profile, type Role } from "../lib/types";
import { Badge, Card, Empty, ErrorBox, Flash, Title, inputCls, useFlash } from "../components/ui";

const HELP: Record<Role, string> = {
  admin: "Sees and edits everything",
  cashier: "Orders, butchery sales and the handover",
  butcher: "Butchery sales, butchery stock and own expenses",
  staff: "Own orders, display and store stock, own expenses",
};

export default function Team() {
  const { userId } = useApp();
  const { msg, flash } = useFlash();
  const [people, setPeople] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getAll<Profile>("profiles", "email").then((r) => { setPeople(r); setError(null); }).catch((e: Error) => setError(e.message));
  }, [tick]);

  async function change(p: Profile, role: Role) {
    if (role === p.role) return;
    if (!confirm(`Change ${p.email ?? "this user"} from ${p.role} to ${role}?`)) return;
    try {
      await updateRows("profiles", [p.id], { role });
      flash(`${p.email ?? "User"} is now ${role}`);
    } catch (e) { flash((e as Error).message, true); }
    setTick((t) => t + 1);
  }

  return (
    <div className="grid gap-4">
      <Card>
        <Title hint={`${people.length} people`}>Team and roles</Title>
        {error && <ErrorBox>{error}</ErrorBox>}
        {people.length === 0 && !error && <Empty>No users yet.</Empty>}
        <ul className="divide-y divide-line">
          {people.map((p) => (
            <li key={p.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">{p.full_name || p.email}</div>
                  {p.full_name && <div className="truncate text-sm text-muted">{p.email}</div>}
                </div>
                {p.id === userId && <Badge tone="green">you</Badge>}
              </div>
              <select className={`${inputCls} mt-2`} value={p.role} onChange={(e) => void change(p, e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="mt-1 text-xs text-muted">{HELP[p.role] ?? ""}</div>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <Title>Adding a new person</Title>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>In Supabase open Authentication, then Users, then Add user (email and password).</li>
          <li>Their profile should appear in the list above. If it does not, ask them to sign in once.</li>
          <li>Come back here and pick their role. New logins start as staff.</li>
        </ol>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
