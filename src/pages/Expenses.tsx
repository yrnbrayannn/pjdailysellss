import { useEffect, useState } from "react";
import { deleteRow, formatMoney, formatTime, getAll, insertRow } from "../lib/api";
import { useApp, useShiftRows } from "../lib/useApp";
import type { Expense, Supplier } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";
import { ReceiptLink, ReceiptUpload } from "../components/Receipt";

const PAID_FROM = ["Cash", "M-Pesa"] as const;
// Same lists as the workbook, so reports line up.
const DEPARTMENTS = ["Kitchen", "Butchery", "General (Shared)"];
const CATEGORIES = [
  "Food & Groceries", "Meat & Butchery", "Utilities (Tokens/Water)", "Cleaning & Hygiene",
  "Transport & Delivery", "Miscellaneous",
];

export default function Expenses() {
  const { date, shift, role } = useApp();
  const list = useShiftRows<Expense>("expenses", "expense_date");
  const { msg, flash } = useFlash();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [paidFrom, setPaidFrom] = useState<(typeof PAID_FROM)[number]>("Cash");
  const [supplier, setSupplier] = useState("");
  const [department, setDepartment] = useState(role === "butcher" ? "Butchery" : "Kitchen");
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [boughtBy, setBoughtBy] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getAll<Supplier>("suppliers", "name").then(setSuppliers).catch(() => setSuppliers([])); }, []);

  const canSave = Number(amount) > 0 && what.trim() !== "" && !saving;

  async function save() {
    setSaving(true);
    try {
      await insertRow("expenses", {
        expense_date: date, shift, amount: Number(amount), description: what.trim(),
        paid_from: paidFrom, supplier_id: supplier || null, receipt_url: receipt,
        department, category, bought_by: boughtBy.trim() || null,
      });
      flash(`Saved expense · ${formatMoney(Number(amount))}`);
      setAmount(""); setWhat(""); setPaidFrom("Cash"); setSupplier(""); setReceipt(null); setBoughtBy("");
      list.reload();
    } catch (e) {
      flash((e as Error).message, true);
    }
    setSaving(false);
  }

  async function remove(x: Expense) {
    if (!confirm(`Delete expense "${x.description}" (${formatMoney(x.amount)})?`)) return;
    try { await deleteRow("expenses", x.id); list.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  const total = list.rows.reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>New expense</Title>
        <Field label="Amount (KSh)"><input className={inputCls} inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="What was it for?"><input className={inputCls} placeholder="e.g. Charcoal, Gas, Vegetables" value={what} onChange={(e) => setWhat(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <select className={inputCls} value={department} onChange={(e) => setDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Bought by">
          <input className={inputCls} list="buyers" placeholder="Who bought it?" value={boughtBy} onChange={(e) => setBoughtBy(e.target.value)} />
          <datalist id="buyers">{[...new Set(list.rows.map((r) => r.bought_by).filter(Boolean))].map((b) => <option key={b} value={b!} />)}</datalist>
        </Field>
        <Field label="Paid from" group><Segmented options={PAID_FROM} value={paidFrom} onChange={setPaidFrom} /></Field>
        <Field label="Supplier (optional)">
          <select className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <ReceiptUpload path={receipt} onChange={setReceipt} />
        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : "Save expense"}</Button>
      </Card>

      <Card>
        <Title hint={`${list.rows.length} · ${formatMoney(total)}`}>{shift} shift expenses</Title>
        {list.error && <ErrorBox>{list.error}</ErrorBox>}
        {list.rows.length === 0 && <Empty>No expenses yet.</Empty>}
        <ul className="divide-y divide-line">
          {list.rows.map((x) => (
            <li key={x.id} className="py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{x.description}</div>
                  <div className="text-sm text-muted">
                    {formatTime(x.created_at)} · {x.department} · {x.category}{x.bought_by ? ` · ${x.bought_by}` : ""}{x.supplier_id ? ` · ${suppliers.find((s) => s.id === x.supplier_id)?.name ?? ""}` : ""}{" "}
                    <Badge>{x.paid_from}</Badge>
                  </div>
                </div>
                <div className="font-bold tabular-nums">{formatMoney(x.amount)}</div>
                <Button small variant="danger" onClick={() => void remove(x)} aria-label="Delete">✕</Button>
              </div>
              <ReceiptLink path={x.receipt_url} />
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
