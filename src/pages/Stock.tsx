// Stock: closing count + deliveries, transfers, wastage and discrepancy reports.
import { useEffect, useState } from "react";
import { addDays, getAll, supabase } from "../lib/api";
import { useApp, useMenu } from "../lib/useApp";
import type { StockTake, Supplier } from "../lib/types";
import { Button, Card, Empty, ErrorBox, Flash, Title, inputCls, useFlash } from "../components/ui";
import { IssueForm, Movement } from "../components/StockForms";

const TABS = ["Count", "Delivery", "Transfer", "Wastage", "Issue"] as const;
type Tab = (typeof TABS)[number];

export default function Stock() {
  const [tab, setTab] = useState<Tab>("Count");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => { getAll<Supplier>("suppliers", "name").then(setSuppliers).catch(() => setSuppliers([])); }, []);

  return (
    <div className="grid gap-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button
            key={t} type="button" onClick={() => setTab(t)}
            className={`h-12 shrink-0 rounded-full border-2 px-5 font-bold ${t === tab ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Count" && <Count />}
      {tab === "Delivery" && <Movement key="delivery" kind="delivery" suppliers={suppliers} />}
      {tab === "Transfer" && <Movement key="transfer" kind="transfer" suppliers={suppliers} />}
      {tab === "Wastage" && <Movement key="wastage" kind="wastage" suppliers={suppliers} />}
      {tab === "Issue" && <IssueForm />}
    </div>
  );
}

type Vals = Record<string, { opening: string; closing: string }>;

function Count() {
  const { date, shift } = useApp();
  const menu = useMenu(true);
  const [takes, setTakes] = useState<StockTake[]>([]);
  const [vals, setVals] = useState<Vals>({});
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const { msg, flash } = useFlash();

  // Counts of the last 8 days (so we can pre-fill today's opening from the last closing)
  useEffect(() => {
    let ignore = false;
    void supabase.from("stock_takes").select("*").gte("stock_date", addDays(date, -8)).lte("stock_date", date)
      .then(({ data, error }) => {
        if (ignore) return;
        if (error) setError(error.message);
        else { setTakes((data ?? []) as StockTake[]); setError(null); }
      });
    return () => { ignore = true; };
  }, [date, tick]);

  useEffect(() => {
    const order = (d: string, s: string) => `${d}${s === "Night" ? 1 : 0}`;
    const now = order(date, shift);
    const next: Vals = {};
    for (const m of menu.items) {
      const mine = takes.find((t) => t.item_name === m.item_name && t.stock_date === date && t.shift === shift);
      if (mine) { next[m.item_name] = { opening: String(mine.opening_qty), closing: String(mine.closing_qty) }; continue; }
      const prev = takes
        .filter((t) => t.item_name === m.item_name && order(t.stock_date, t.shift) < now)
        .sort((a, b) => order(b.stock_date, b.shift).localeCompare(order(a.stock_date, a.shift)))[0];
      next[m.item_name] = { opening: prev ? String(prev.closing_qty) : "", closing: "" };
    }
    setVals(next);
  }, [menu.items, takes, date, shift]);

  function set(name: string, field: "opening" | "closing", value: string) {
    setVals((v) => ({ ...v, [name]: { ...(v[name] ?? { opening: "", closing: "" }), [field]: value } }));
  }

  const counted = menu.items.filter((m) => (vals[m.item_name]?.closing ?? "") !== "").length;

  async function save() {
    const rows = [];
    for (const m of menu.items) {
      const v = vals[m.item_name];
      if (!v || v.closing === "") continue;
      const opening = Number(v.opening), closing = Number(v.closing);
      if (v.opening === "" || !Number.isFinite(opening) || opening < 0) return flash(`Enter the opening count for ${m.item_name}`, true);
      if (!Number.isFinite(closing) || closing < 0) return flash(`Check the closing count for ${m.item_name}`, true);
      rows.push({ stock_date: date, shift, item_name: m.item_name, opening_qty: opening, closing_qty: closing });
    }
    if (rows.length === 0) return flash("Enter at least one closing count", true);
    setSaving(true);
    const { error } = await supabase.from("stock_takes").upsert(rows, { onConflict: "stock_date,shift,item_name" });
    setSaving(false);
    if (error) return flash(error.message, true);
    flash(`Saved ${rows.length} counts`);
    setTick((t) => t + 1);
  }

  const shown = menu.items.filter((m) => m.item_name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <Card className="grid gap-3">
        <Title hint={`${counted} of ${menu.items.length} counted`}>Closing stock count</Title>
        {(error || menu.error) && <ErrorBox>{error ?? menu.error}</ErrorBox>}
        <input className={inputCls} placeholder="Search items…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {menu.items.length === 0 && <Empty>No stock items. The admin can tick “Count in stock” on menu items.</Empty>}
        <ul className="divide-y divide-line">
          {shown.map((m) => (
            <li key={m.id} className="flex items-end gap-2 py-3">
              <div className="min-w-0 flex-1 pb-3">
                <div className="truncate font-bold">{m.item_name}</div>
                <div className="text-xs text-muted">{m.unit_type ?? m.category}</div>
              </div>
              <label className="w-20">
                <span className="text-[11px] font-semibold text-muted">Opening</span>
                <input className="h-12 w-full rounded-lg border-2 border-line px-2 text-center text-lg" inputMode="decimal"
                  value={vals[m.item_name]?.opening ?? ""} onChange={(e) => set(m.item_name, "opening", e.target.value)} />
              </label>
              <label className="w-28">
                <span className="text-[11px] font-semibold text-muted">Closing</span>
                <input className="h-14 w-full rounded-lg border-2 border-brand px-2 text-center text-2xl font-bold" inputMode="decimal" placeholder="—"
                  value={vals[m.item_name]?.closing ?? ""} onChange={(e) => set(m.item_name, "closing", e.target.value)} />
              </label>
            </li>
          ))}
        </ul>
        <Button disabled={saving || menu.items.length === 0} onClick={() => void save()}>{saving ? "Saving…" : "Save counts"}</Button>
      </Card>
      <Flash msg={msg} />
    </>
  );
}
