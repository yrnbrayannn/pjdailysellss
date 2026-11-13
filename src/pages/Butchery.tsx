// Butchery is sold by amount, responsive for desktop.
import { useState } from "react";
import { deleteRow, formatMoney, formatTime, insertRow, rawPrice } from "../lib/api";
import { round2 } from "../lib/money";
import { useApp, useRawItems, useShiftRows } from "../lib/useApp";
import type { ButcherySale } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";

const METHODS = ["Cash", "M-Pesa", "Unpaid"] as const;
const TOLERANCE = 0.1;

export default function Butchery() {
  const { date, shift } = useApp();
  const sales = useShiftRows<ButcherySale>("butchery_sales", "sale_date");
  const raw = useRawItems("Butchery");
  const { msg, flash } = useFlash();

  const [meat, setMeat] = useState("");
  const [kgs, setKgs] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Cash");
  const [saving, setSaving] = useState(false);

  const kg = Number(kgs);
  const amt = Number(amount);
  const perKg = kg > 0 && amt > 0 ? round2(amt / kg) : 0;
  const listPrice = rawPrice(raw.items.find((r) => r.item_name === meat) ?? {}, raw.priceKey);
  const off = listPrice > 0 && perKg > 0 ? Math.abs(perKg - listPrice) / listPrice : 0;
  const priceFlag = off > TOLERANCE;
  const canSave = meat !== "" && kg > 0 && amt > 0 && perKg > 0 && !saving;

  async function save() {
    setSaving(true);
    try {
      await insertRow("butchery_sales", {
        sale_date: date, shift, meat_item: meat,
        quantity_kg: kg, price_per_kg: perKg, cost_kshs: round2(amt), payment_method: method,
        check_status: method === "Unpaid" ? "UNPAID" : priceFlag ? "CHECK PRICE" : "OK",
      });
      flash(`Saved: ${meat} · ${formatMoney(amt)}`);
      setKgs(""); setAmount(""); setMethod("Cash");
      sales.reload();
    } catch (e) {
      flash((e as Error).message, true);
    }
    setSaving(false);
  }

  async function remove(s: ButcherySale) {
    if (!confirm(`Delete ${s.meat_item} (${formatMoney(s.cost_kshs)})?`)) return;
    try { await deleteRow("butchery_sales", s.id); sales.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  const listTotal = sales.rows.reduce((s, r) => s + Number(r.cost_kshs), 0);

  return (
    <div className="grid gap-4 items-start lg:grid-cols-2">
      <Card className="grid gap-4">
        <Title>Butchery sale</Title>
        {raw.error && <ErrorBox>{raw.error}</ErrorBox>}
        <Field label="Meat" group>
          {raw.items.length > 0 ? (
            <Segmented options={raw.items.map((r) => r.item_name)} value={meat} onChange={setMeat} cols={Math.min(raw.items.length, 3)} />
          ) : (
            <Empty>No butchery items yet. The admin adds them under More, Raw items.</Empty>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kgs"><input className={inputCls} inputMode="decimal" placeholder="0.00" value={kgs} onChange={(e) => setKgs(e.target.value)} /></Field>
          <Field label="Amount (KSh)"><input className={inputCls} inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        </div>

        <div className="rounded-xl bg-brand p-3 text-center text-white">
          <div className="text-sm opacity-80">Price per kg (worked out)</div>
          <div className="text-3xl font-extrabold tabular-nums">{perKg > 0 ? formatMoney(perKg) : "KSh 0"}</div>
          {listPrice > 0 && <div className="text-xs opacity-80">List price {formatMoney(listPrice)} per kg</div>}
        </div>
        {priceFlag && (
          <p className="rounded-xl bg-warn-soft p-3 text-center text-sm font-bold text-amber-800">
            This is {Math.round(off * 100)}% {perKg > listPrice ? "above" : "below"} the list price. Check the weight and the amount.
          </p>
        )}

        <Field label="Payment" group><Segmented options={METHODS} value={method} onChange={setMethod} /></Field>
        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : "Save sale"}</Button>
      </Card>

      <Card>
        <Title hint={`${sales.rows.length} · ${formatMoney(listTotal)}`}>{shift} shift butchery</Title>
        {sales.error && <ErrorBox>{sales.error}</ErrorBox>}
        {sales.rows.length === 0 && <Empty>No butchery sales yet.</Empty>}
        <ul className="divide-y divide-line">
          {sales.rows.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.meat_item}</div>
                <div className="text-sm text-muted">
                  {formatTime(s.created_at)} · {s.quantity_kg} kg at {s.price_per_kg}/kg{" "}
                  <Badge tone={s.payment_method === "Unpaid" ? "red" : "gray"}>{s.payment_method}</Badge>{" "}
                  {s.check_status === "CHECK PRICE" && <Badge tone="amber">check price</Badge>}
                </div>
              </div>
              <div className="font-bold tabular-nums">{formatMoney(s.cost_kshs)}</div>
              <Button small variant="danger" onClick={() => void remove(s)} aria-label="Delete">✕</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}