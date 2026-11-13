// Deliveries, transfers, wastage (one small form each) and the discrepancy report.
import { useState } from "react";
import { deleteRow, formatMoney, formatTime, insertRow } from "../lib/api";
import { useApp, useMenu, useShiftRows, useStockItems } from "../lib/useApp";
import type { Discrepancy, Section, StockAddition, StockTransfer, Supplier, Wastage } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "./ui";
import { ReceiptLink, ReceiptUpload } from "./Receipt";

type Kind = "delivery" | "transfer" | "wastage";
type Row = StockAddition & StockTransfer & Wastage;

const TABLE: Record<Kind, string> = { delivery: "stock_additions", transfer: "stock_transfers", wastage: "wastage" };
const TITLE: Record<Kind, string> = { delivery: "Stock delivery", transfer: "Stock transfer", wastage: "Wastage" };
const REASONS = ["Spoilt", "Spilled", "Broken", "Expired", "Staff meal", "Other"];

export function Movement({ kind, section, suppliers }: { kind: Kind; section: Section; suppliers: Supplier[] }) {
  const { date, shift } = useApp();
  const stock = useStockItems(section);
  const allRows = useShiftRows<Row>(TABLE[kind], "entry_date");
  const list = { ...allRows, rows: allRows.rows.filter((r) => r.section === section) };
  const { msg, flash } = useFlash();

  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [direction, setDirection] = useState<"Out" | "In">("Out");
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState(REASONS[0]!);
  const [saving, setSaving] = useState(false);

  const unit = stock.items.find((m) => m.name === item)?.unit;
  const canSave = item !== "" && Number(qty) > 0 && !saving;

  async function save() {
    setSaving(true);
    const base = { entry_date: date, shift, section, item_name: item, quantity: Number(qty) };
    const extra =
      kind === "delivery" ? { supplier_id: supplier || null, notes: notes.trim() || null }
      : kind === "transfer" ? { direction, location: location.trim() || null }
      : { reason };
    try {
      await insertRow(TABLE[kind], { ...base, ...extra });
      flash(`Saved: ${qty} × ${item}`);
      setItem(""); setQty(""); setSupplier(""); setNotes(""); setLocation("");
      list.reload();
    } catch (e) {
      flash((e as Error).message, true);
    }
    setSaving(false);
  }

  async function remove(r: Row) {
    if (!confirm(`Delete ${r.quantity} × ${r.item_name}?`)) return;
    try { await deleteRow(TABLE[kind], r.id); list.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  function detail(r: Row): string {
    if (kind === "delivery") return [suppliers.find((s) => s.id === r.supplier_id)?.name, r.notes].filter(Boolean).join(" · ");
    if (kind === "transfer") return `${r.direction}${r.location ? ` · ${r.location}` : ""}`;
    return r.reason ?? "";
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title hint={section}>{TITLE[kind]}</Title>
        {stock.error && <ErrorBox>{stock.error}</ErrorBox>}
        <Field label="Item">
          <select className={inputCls} value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">Choose item…</option>
            {stock.items.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </Field>
        <Field label={`Quantity${unit ? ` (${unit})` : ""}`}>
          <input className={inputCls} inputMode="decimal" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>

        {kind === "delivery" && (
          <>
            <Field label="Supplier (optional)">
              <select className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Notes (optional)"><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </>
        )}
        {kind === "transfer" && (
          <>
            <Field label="Direction" group><Segmented options={["Out", "In"] as const} value={direction} onChange={setDirection} /></Field>
            <Field label={direction === "Out" ? "Sent to (optional)" : "Received from (optional)"}>
              <input className={inputCls} placeholder="e.g. Kitchen, Display, Butchery" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </>
        )}
        {kind === "wastage" && (
          <Field label="Reason">
            <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
        )}

        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button>
      </Card>

      <Card>
        <Title hint={`${list.rows.length} entries`}>{shift} shift {TITLE[kind].toLowerCase()}</Title>
        {list.error && <ErrorBox>{list.error}</ErrorBox>}
        {list.rows.length === 0 && <Empty>Nothing logged yet.</Empty>}
        <ul className="divide-y divide-line">
          {list.rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{r.quantity} × {r.item_name}</div>
                <div className="truncate text-sm text-muted">{formatTime(r.created_at)}{detail(r) ? ` · ${detail(r)}` : ""}</div>
              </div>
              <Button small variant="danger" onClick={() => void remove(r)} aria-label="Delete">✕</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}

/** Staff report a stock/cash discrepancy, with an optional receipt photo. */
export function IssueForm() {
  const { date, shift } = useApp();
  const menu = useMenu();
  const list = useShiftRows<Discrepancy>("discrepancies", "entry_date");
  const { msg, flash } = useFlash();

  const [item, setItem] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = item !== "" && Number(amount) !== 0 && Number.isFinite(Number(amount)) && !saving;

  async function save() {
    setSaving(true);
    try {
      await insertRow("discrepancies", {
        entry_date: date, shift, item_name: item, amount: Number(amount),
        note: note.trim() || null, receipt_url: receipt, status: "Open",
      });
      flash("Issue reported. The admin will review it.");
      setItem(""); setAmount(""); setNote(""); setReceipt(null);
      list.reload();
    } catch (e) {
      flash((e as Error).message, true);
    }
    setSaving(false);
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>Report a discrepancy</Title>
        <Field label="Item">
          <select className={inputCls} value={item} onChange={(e) => setItem(e.target.value)}>
            <option value="">Choose item…</option>
            <option value="General / cash">General / cash</option>
            {menu.items.map((m) => <option key={m.id} value={m.item_name}>{m.item_name}</option>)}
          </select>
        </Field>
        <Field label="Amount missing or extra (KSh)">
          <input className={inputCls} inputMode="decimal" placeholder="e.g. 500 (use -200 if extra)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="What happened?"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <ReceiptUpload path={receipt} onChange={setReceipt} />
        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : "Report issue"}</Button>
      </Card>

      <Card>
        <Title>{shift} shift issues</Title>
        {list.error && <ErrorBox>{list.error}</ErrorBox>}
        {list.rows.length === 0 && <Empty>No issues reported.</Empty>}
        <ul className="divide-y divide-line">
          {list.rows.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{d.item_name}</span>
                <span className="font-bold tabular-nums">{formatMoney(d.amount)}</span>
              </div>
              <div className="text-sm text-muted">
                {d.note ?? ""}{" "}
                <Badge tone={d.status === "Approved" ? "green" : d.status === "Investigate" ? "amber" : "gray"}>{d.status}</Badge>
              </div>
              <ReceiptLink path={d.receipt_url} />
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
