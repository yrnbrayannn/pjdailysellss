// Admin: who edited or deleted what, and when (filled automatically by a database trigger).
import { useEffect, useState } from "react";
import { supabase } from "../lib/api";
import type { AuditLog } from "../lib/types";
import { Badge, Card, Empty, ErrorBox, Title } from "../components/ui";

const NAMES: Record<string, string> = {
  hotel_sales: "Order", butchery_sales: "Butchery sale", expenses: "Expense", menu_items: "Menu item",
  suppliers: "Supplier", stock_takes: "Stock count", stock_additions: "Delivery", stock_transfers: "Transfer",
  wastage: "Wastage", discrepancies: "Discrepancy", profiles: "User role",
};

const show = (v: unknown) => (v === null || v === undefined || v === "" ? "empty" : String(v));

function describe(a: AuditLog): string {
  const old = a.old_data ?? {};
  const label = show(old["item_name"] ?? old["food_item"] ?? old["meat_item"] ?? old["description"] ?? old["name"] ?? old["email"] ?? "");
  if (a.action === "DELETE") {
    const money = old["total_cost"] ?? old["cost_kshs"] ?? old["amount"] ?? old["selling_price"];
    return `${label === "empty" ? "" : label}${money !== undefined ? ` · KSh ${money}` : ""}`;
  }
  const now = a.new_data ?? {};
  const changes = Object.keys(now)
    .filter((k) => k !== "created_at" && JSON.stringify(now[k]) !== JSON.stringify(old[k]))
    .map((k) => `${k}: ${show(old[k])} → ${show(now[k])}`);
  return `${label === "empty" ? "" : label + " — "}${changes.join(", ")}`;
}

export default function Audit() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.from("audit_logs").select("*").order("changed_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (error) setError(error.message); else setRows((data ?? []) as AuditLog[]); });
  }, []);

  return (
    <Card>
      <Title hint="latest 100">Audit log</Title>
      {error && <ErrorBox>{error}</ErrorBox>}
      {!error && rows.length === 0 && <Empty>Nothing has been edited or deleted yet.</Empty>}
      <ul className="divide-y divide-line">
        {rows.map((a) => (
          <li key={a.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold">{NAMES[a.table_name] ?? a.table_name}</span>
              <Badge tone={a.action === "DELETE" ? "red" : "amber"}>{a.action === "DELETE" ? "Deleted" : "Edited"}</Badge>
            </div>
            <div className="break-words text-sm">{describe(a)}</div>
            <div className="text-xs text-muted">
              {a.changed_by_email ?? "unknown"} · {new Date(a.changed_at).toLocaleString("en-KE")}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
