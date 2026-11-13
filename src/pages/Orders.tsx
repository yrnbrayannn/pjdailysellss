// Fast order entry: tap item → price fills → pick payment → save.
import { useState } from "react";
import { deleteRow, formatMoney, formatTime, insertRow } from "../lib/api";
import { round2, splitCash, splitError } from "../lib/money";
import { useApp, useMenu, useShiftRows } from "../lib/useApp";
import type { HotelSale, MenuItem, Payment } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";

const METHODS: Payment[] = ["Cash", "M-Pesa", "Cash + M-Pesa", "Unpaid"];

export default function Orders() {
  const { date, shift } = useApp();
  const menu = useMenu();
  const sales = useShiftRows<HotelSale>("hotel_sales", "sale_date");
  const { msg, flash } = useFlash();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState<Payment>("Cash");
  const [mpesa, setMpesa] = useState("");
  const [table, setTable] = useState("");
  const [saving, setSaving] = useState(false);

  const total = round2(Number(qty) * Number(price));
  const totalOk = Number.isFinite(total) && total > 0;
  const isSplit = method === "Cash + M-Pesa";
  const splitProblem = isSplit ? splitError(total, Number(mpesa)) : null;
  const canSave = !!item && totalOk && !splitProblem && !saving;
  const shown = menu.items.filter((i) => i.item_name.toLowerCase().includes(search.toLowerCase()));

  function pick(i: MenuItem) {
    setItem(i);
    setPrice(String(i.selling_price)); // auto-fill price
    setQty("1");
    setSearch("");
  }

  function step(delta: number) {
    setQty(String(Math.max(1, (Number(qty) || 0) + delta)));
  }

  async function save() {
    if (!item || !canSave) return;
    setSaving(true);
    const mpesaAmt = isSplit ? round2(Number(mpesa)) : method === "M-Pesa" ? total : 0;
    const cashAmt = method === "Cash" ? total : isSplit ? splitCash(total, mpesaAmt) : 0; // Total − M-Pesa = Cash
    try {
      await insertRow("hotel_sales", {
        sale_date: date, shift,
        food_item: item.item_name,
        quantity: Number(qty), unit_price: Number(price), total_cost: total,
        payment_method: method,
        cash_received: cashAmt, mpesa_part: isSplit ? mpesaAmt : 0, mpesa_received: mpesaAmt,
        table_no: table.trim() || null,
        check_status: method === "Unpaid" ? "UNPAID" : "OK",
      });
      flash(`Saved: ${item.item_name} · ${formatMoney(total)}`);
      setItem(null); setQty("1"); setPrice(""); setMethod("Cash"); setMpesa(""); setTable("");
      sales.reload();
    } catch (e) {
      flash((e as Error).message, true);
    }
    setSaving(false);
  }

  async function remove(s: HotelSale) {
    if (!confirm(`Delete ${s.food_item} (${formatMoney(s.total_cost)})?`)) return;
    try { await deleteRow("hotel_sales", s.id); sales.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  const listTotal = sales.rows.reduce((s, r) => s + Number(r.total_cost), 0);

  return (
    <div className="grid gap-4">
      {menu.error && <ErrorBox>{menu.error}</ErrorBox>}
      <Card className="grid gap-4">
        <Title>New order</Title>

        {item ? (
          <div className="flex items-center justify-between rounded-xl bg-brand-soft p-3">
            <div>
              <div className="text-xl font-extrabold">{item.item_name}</div>
              <div className="text-muted">{formatMoney(item.selling_price)}{item.unit_type ? ` / ${item.unit_type}` : ""}</div>
            </div>
            <Button small variant="outline" onClick={() => setItem(null)}>Change</Button>
          </div>
        ) : (
          <Field label="Food item">
            <input className={inputCls} placeholder="Search the menu…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto">
              {shown.map((i) => (
                <button key={i.id} type="button" onClick={() => pick(i)} className="flex min-h-14 items-center justify-between rounded-xl border-2 border-line bg-white px-4 text-left active:bg-brand-soft">
                  <span><span className="block text-lg font-bold">{i.item_name}</span><span className="text-xs text-muted">{i.category}</span></span>
                  <span className="font-bold tabular-nums">{formatMoney(i.selling_price)}</span>
                </button>
              ))}
              {shown.length === 0 && <Empty>{menu.items.length ? "No match" : "Menu is empty. Ask the admin to add items."}</Empty>}
            </div>
          </Field>
        )}

        {item && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" group>
                <div className="grid grid-cols-[3.5rem_1fr_3.5rem] gap-1">
                  <Button variant="outline" onClick={() => step(-1)} aria-label="Less" className="!px-0">−</Button>
                  <input className={`${inputCls} text-center`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
                  <Button variant="outline" onClick={() => step(1)} aria-label="More" className="!px-0">+</Button>
                </div>
              </Field>
              <Field label="Price each (KSh)">
                <input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </div>

            <div className="rounded-xl bg-brand p-3 text-center text-white">
              <div className="text-sm opacity-80">Total</div>
              <div className="text-3xl font-extrabold tabular-nums">{formatMoney(totalOk ? total : 0)}</div>
            </div>

            <Field label="Payment" group>
              <Segmented options={METHODS} value={method} onChange={(m) => { setMethod(m); setMpesa(""); }} cols={2} />
            </Field>

            {isSplit && (
              <div className="grid gap-2">
                <Field label="M-Pesa amount (KSh)">
                  <input className={inputCls} inputMode="decimal" placeholder="How much came by M-Pesa?" value={mpesa} onChange={(e) => setMpesa(e.target.value)} />
                </Field>
                {splitProblem ? (
                  <p className={`text-sm font-semibold ${mpesa ? "text-danger" : "text-muted"}`}>{splitProblem}</p>
                ) : (
                  <p className="rounded-xl bg-ok-soft p-3 text-center text-lg font-bold text-green-800">
                    Cash to collect: {formatMoney(splitCash(total, Number(mpesa)))}
                  </p>
                )}
              </div>
            )}

            <Field label="Table no. (optional)">
              <input className={inputCls} value={table} onChange={(e) => setTable(e.target.value)} />
            </Field>
          </>
        )}

        <Button disabled={!canSave} onClick={() => void save()}>
          {saving ? "Saving…" : item && totalOk ? `Save order · ${formatMoney(total)}` : "Save order"}
        </Button>
      </Card>

      <Card>
        <Title hint={`${sales.rows.length} · ${formatMoney(listTotal)}`}>{shift} shift orders</Title>
        {sales.error && <ErrorBox>{sales.error}</ErrorBox>}
        {sales.rows.length === 0 && <Empty>No orders yet.</Empty>}
        <ul className="divide-y divide-line">
          {sales.rows.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.quantity > 1 ? `${s.quantity} × ` : ""}{s.food_item}</div>
                <div className="text-sm text-muted">
                  {formatTime(s.created_at)}{s.table_no ? ` · Table ${s.table_no}` : ""}{" "}
                  <Badge tone={s.payment_method === "Unpaid" ? "red" : "gray"}>{s.payment_method}</Badge>
                </div>
              </div>
              <div className="font-bold tabular-nums">{formatMoney(s.total_cost)}</div>
              <Button small variant="danger" onClick={() => void remove(s)} aria-label="Delete">✕</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
