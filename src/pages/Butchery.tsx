import { useEffect, useState } from "react";
import { deleteRow, formatMoney, formatTime, insertRow, supabase } from "../lib/api";
import { round2 } from "../lib/money";
import { useApp, useShiftRows } from "../lib/useApp";
import type { ButcherySale } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";

const METHODS = ["Cash", "M-Pesa", "Unpaid"] as const;

export default function Butchery() {
  const { date, shift } = useApp();
  const sales = useShiftRows<ButcherySale>("butchery_sales", "sale_date");
  const { msg, flash } = useFlash();

  const [meat, setMeat] = useState("");
  const [kgs, setKgs] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("Cash");
  const [saving, setSaving] = useState(false);
  const [known, setKnown] = useState<string[]>([]);

  // Suggest meats entered before (just a convenience for the text box)
  useEffect(() => {
    void supabase.from("butchery_sales").select("meat_item").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setKnown([...new Set((data ?? []).map((r) => String(r.meat_item)))]));
  }, []);

  const total = round2(Number(kgs) * Number(price));
  const canSave = meat.trim() !== "" && Number(kgs) > 0 && Number(price) > 0 && total > 0 && !saving;

  async function save() {
    setSaving(true);
    try {
      await insertRow("butchery_sales", {
        sale_date: date, shift, meat_item: meat.trim(),
        quantity_kg: Number(kgs), price_per_kg: Number(price), cost_kshs: total, payment_method: method,
        check_status: method === "Unpaid" ? "UNPAID" : "OK",
      });
      flash(`Saved: ${meat.trim()} · ${formatMoney(total)}`);
      setMeat(""); setKgs(""); setPrice(""); setMethod("Cash");
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
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>Butchery sale</Title>
        <Field label="Meat item">
          <input className={inputCls} list="meats" placeholder="e.g. Beef, Goat…" value={meat} onChange={(e) => setMeat(e.target.value)} />
          <datalist id="meats">{known.map((k) => <option key={k} value={k} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kgs"><input className={inputCls} inputMode="decimal" placeholder="0.00" value={kgs} onChange={(e) => setKgs(e.target.value)} /></Field>
          <Field label="Price per kg (KSh)"><input className={inputCls} inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        </div>
        <div className="rounded-xl bg-brand p-3 text-center text-white">
          <div className="text-sm opacity-80">Total</div>
          <div className="text-3xl font-extrabold tabular-nums">{formatMoney(total > 0 ? total : 0)}</div>
        </div>
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
                  {formatTime(s.created_at)} · {s.quantity_kg} kg × {s.price_per_kg}{" "}
                  <Badge tone={s.payment_method === "Unpaid" ? "red" : "gray"}>{s.payment_method}</Badge>
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
