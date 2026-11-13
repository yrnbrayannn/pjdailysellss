// Stock: the daily stock sheet, responsive for desktop.
import { useEffect, useMemo, useState } from "react";
import { addDays, formatMoney, getAll, supabase } from "../lib/api";
import { round2 } from "../lib/money";
import { SECTIONS_FOR, useApp, useShiftRows, useStockItems } from "../lib/useApp";
import type { Section, StockAddition, StockTake, StockTransfer, Supplier, Wastage } from "../lib/types";
import { Button, Card, Empty, ErrorBox, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";
import { IssueForm, Movement } from "../components/StockForms";

const TABS = ["Sheet", "Delivery", "Transfer", "Wastage", "Issue"] as const;
type Tab = (typeof TABS)[number];

export default function Stock() {
  const { role } = useApp();
  const allowed = SECTIONS_FOR[role];
  const [tab, setTab] = useState<Tab>("Sheet");
  const [section, setSection] = useState<Section>(allowed[0]!);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => { getAll<Supplier>("suppliers", "name").then(setSuppliers).catch(() => setSuppliers([])); }, []);

  return (
    <div className="grid gap-4 max-w-5xl mx-auto">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {TABS.map((t) => (
          <button
            key={t} type="button" onClick={() => setTab(t)}
            className={`h-12 shrink-0 rounded-full border-2 px-5 font-bold ${t === tab ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== "Issue" && allowed.length > 1 && <Segmented options={allowed} value={section} onChange={setSection} />}

      {tab === "Sheet" && <Sheet key={section} section={section} />}
      {tab === "Delivery" && <Movement key={`d-${section}`} kind="delivery" section={section} suppliers={suppliers} />}
      {tab === "Transfer" && <Movement key={`t-${section}`} kind="transfer" section={section} suppliers={suppliers} />}
      {tab === "Wastage" && <Movement key={`w-${section}`} kind="wastage" section={section} suppliers={suppliers} />}
      {tab === "Issue" && <IssueForm />}
    </div>
  );
}

type Vals = Record<string, { opening: string; closing: string }>;
const order = (d: string, s: string) => `${d}${s === "Night" ? 1 : 0}`;
const num = (v: string) => (v === "" ? null : Number(v));
const sum = (rows: { item_name: string; quantity: number }[], name: string) =>
  rows.filter((r) => r.item_name === name).reduce((s, r) => s + (Number(r.quantity) || 0), 0);

function Sheet({ section }: { section: Section }) {
  const { date, shift } = useApp();
  const stock = useStockItems(section);
  const adds = useShiftRows<StockAddition>("stock_additions", "entry_date");
  const moves = useShiftRows<StockTransfer>("stock_transfers", "entry_date");
  const waste = useShiftRows<Wastage>("wastage", "entry_date");
  const [takes, setTakes] = useState<StockTake[]>([]);
  const [vals, setVals] = useState<Vals>({});
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  const { msg, flash } = useFlash();

  useEffect(() => {
    let ignore = false;
    void supabase.from("stock_takes").select("*").eq("section", section)
      .gte("stock_date", addDays(date, -8)).lte("stock_date", date)
      .then(({ data, error }) => {
        if (ignore) return;
        if (error) setError(error.message);
        else { setTakes((data ?? []) as StockTake[]); setError(null); }
      });
    return () => { ignore = true; };
  }, [date, section, tick]);

  const today = useMemo(() => takes.filter((t) => t.stock_date === date && t.shift === shift), [takes, date, shift]);

  useEffect(() => {
    const now = order(date, shift);
    const next: Vals = {};
    for (const it of stock.items) {
      const mine = today.find((t) => t.item_name === it.name);
      if (mine) { next[it.name] = { opening: String(mine.opening_qty ?? ""), closing: mine.closing_qty === null || mine.closing_qty === undefined ? "" : String(mine.closing_qty) }; continue; }
      const prev = takes
        .filter((t) => t.item_name === it.name && t.closing_qty !== null && t.closing_qty !== undefined && order(t.stock_date, t.shift) < now)
        .sort((a, b) => order(b.stock_date, b.shift).localeCompare(order(a.stock_date, a.shift)))[0];
      next[it.name] = { opening: prev ? String(prev.closing_qty) : "", closing: "" };
    }
    setVals(next);
  }, [stock.items, takes, today, date, shift]);

  function set(name: string, field: "opening" | "closing", value: string) {
    setVals((v) => ({ ...v, [name]: { ...(v[name] ?? { opening: "", closing: "" }), [field]: value } }));
  }

  const figures = (name: string, price: number) => {
    const v = vals[name] ?? { opening: "", closing: "" };
    const opening = num(v.opening);
    const closing = num(v.closing);
    const added = sum(adds.rows.filter((r) => r.section === section), name) + sum(moves.rows.filter((r) => r.section === section && r.direction === "In"), name);
    const out = sum(moves.rows.filter((r) => r.section === section && r.direction === "Out"), name) + sum(waste.rows.filter((r) => r.section === section), name);
    const total = opening === null ? null : round2(opening + added);
    const sold = total === null || closing === null ? null : round2(total - out - closing);
    const amount = sold === null || price <= 0 ? null : round2(sold * price);
    return { opening, closing, added, out, total, sold, amount };
  };

  const counted = stock.items.filter((it) => (vals[it.name]?.closing ?? "") !== "").length;
  const grand = round2(stock.items.reduce((s, it) => s + (figures(it.name, it.price).amount ?? 0), 0));

  async function save() {
    const inserts: object[] = [];
    const updates: { id: string; patch: object }[] = [];
    for (const it of stock.items) {
      const v = vals[it.name];
      if (!v || (v.opening === "" && v.closing === "")) continue;
      const opening = Number(v.opening);
      if (v.opening === "" || !Number.isFinite(opening) || opening < 0) return flash(`Enter the opening count for ${it.name}`, true);
      if (v.closing !== "" && (!Number.isFinite(Number(v.closing)) || Number(v.closing) < 0)) return flash(`Check the closing count for ${it.name}`, true);
      const closing = v.closing === "" ? null : Number(v.closing);
      const existing = today.find((t) => t.item_name === it.name);
      if (existing) updates.push({ id: existing.id, patch: { opening_qty: opening, closing_qty: closing } });
      else inserts.push({ stock_date: date, shift, section, item_name: it.name, opening_qty: opening, closing_qty: closing });
    }
    if (inserts.length + updates.length === 0) return flash("Enter at least one count", true);
    setSaving(true);
    let failure: string | null = null;
    if (inserts.length) {
      const { error } = await supabase.from("stock_takes").insert(inserts);
      if (error) failure = error.message;
    }
    for (const u of updates) {
      const { error } = await supabase.from("stock_takes").update(u.patch).eq("id", u.id);
      if (error) failure = error.message;
    }
    setSaving(false);
    if (failure) return flash(failure, true);
    flash(`Saved ${inserts.length + updates.length} items`);
    setTick((t) => t + 1);
  }

  const shown = stock.items.filter((it) => it.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <Card className="grid gap-3">
        <Title hint={`${counted} of ${stock.items.length} closed`}>{section} stock sheet</Title>
        {(error || stock.error || adds.error) && <ErrorBox>{error ?? stock.error ?? adds.error}</ErrorBox>}
        <p className="text-sm text-muted">Fill Opening at the start of the shift and Closing at the end.</p>
        <input className={inputCls} placeholder="Search items" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {stock.items.length === 0 && <Empty>{section === "Display" ? "No stock items. The admin can tick Count in stock on menu items." : "No items here yet. The admin adds them under More, Raw items."}</Empty>}

        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((it) => {
            const f = figures(it.name, it.price);
            return (
              <li key={it.name} className="rounded-xl border border-line p-3 bg-white">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="truncate font-bold">{it.name}</span>
                  <span className="text-xs text-muted">{it.unit ?? ""}{it.price > 0 ? ` · ${formatMoney(it.price)}` : ""}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label>
                    <span className="text-[11px] font-semibold text-muted">Opening</span>
                    <input className="h-12 w-full rounded-lg border-2 border-line px-2 text-center text-lg" inputMode="decimal" value={vals[it.name]?.opening ?? ""} onChange={(e) => set(it.name, "opening", e.target.value)} />
                  </label>
                  <Cell label="Added" value={f.added ? String(f.added) : "0"} />
                  <Cell label="Total" value={f.total === null ? "" : String(f.total)} />
                  <label>
                    <span className="text-[11px] font-semibold text-muted">Closing</span>
                    <input className="h-12 w-full rounded-lg border-2 border-brand px-2 text-center text-lg font-bold" inputMode="decimal" placeholder="later" value={vals[it.name]?.closing ?? ""} onChange={(e) => set(it.name, "closing", e.target.value)} />
                  </label>
                  <Cell label="Sold" value={f.sold === null ? "pending" : String(f.sold)} bad={f.sold !== null && f.sold < 0} />
                  <Cell label="Amount" value={f.amount === null ? (f.sold === null ? "pending" : "") : formatMoney(f.amount)} />
                </div>
                {f.out > 0 && <div className="mt-1 text-xs text-muted">Already taken out: {f.out}</div>}
              </li>
            );
          })}
        </ul>

        {grand > 0 && (
          <div className="rounded-xl bg-brand p-3 text-center text-white">
            <div className="text-sm opacity-80">Total amount from stock sold</div>
            <div className="text-2xl font-extrabold tabular-nums">{formatMoney(grand)}</div>
          </div>
        )}
        <Button disabled={saving || stock.items.length === 0} onClick={() => void save()}>{saving ? "Saving…" : "Save sheet"}</Button>
      </Card>
      <Flash msg={msg} />
    </>
  );
}

function Cell({ label, value, bad = false }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <span className="text-[11px] font-semibold text-muted">{label}</span>
      <div className={`flex h-12 items-center justify-center rounded-lg bg-brand-soft px-1 text-center text-base font-bold tabular-nums ${bad ? "text-danger" : ""}`}>{value}</div>
    </div>
  );
}