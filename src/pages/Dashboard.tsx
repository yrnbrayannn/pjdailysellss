// Admin only: cashier handover + stock reconciliation + reported issues.
import { useState } from "react";
import { formatMoney, insertRow, updateRows } from "../lib/api";
import { summarize } from "../lib/money";
import { reconcile, type ReconRow } from "../lib/reconcile";
import { useApp, useMenu, useShiftRows } from "../lib/useApp";
import type {
  ButcherySale, Discrepancy, Expense, HotelSale, StockAddition, StockTake, StockTransfer, Wastage,
} from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Flash, StatRow, Title, inputCls, useFlash } from "../components/ui";
import { ReceiptLink } from "../components/Receipt";

type Status = "Investigate" | "Approved";
const tone = (s: string) => (s === "Approved" ? "green" : s === "Investigate" ? "amber" : "gray");

export default function Dashboard() {
  const { date, shift, userId } = useApp();
  const { msg, flash } = useFlash();

  const hotel = useShiftRows<HotelSale>("hotel_sales", "sale_date");
  const meat = useShiftRows<ButcherySale>("butchery_sales", "sale_date");
  const exp = useShiftRows<Expense>("expenses", "expense_date");
  const takes = useShiftRows<StockTake>("stock_takes", "stock_date");
  const adds = useShiftRows<StockAddition>("stock_additions", "entry_date");
  const moves = useShiftRows<StockTransfer>("stock_transfers", "entry_date");
  const waste = useShiftRows<Wastage>("wastage", "entry_date");
  const issues = useShiftRows<Discrepancy>("discrepancies", "entry_date");
  const { items: menu } = useMenu();

  const [threshold, setThreshold] = useState(() => localStorage.getItem("pj-threshold") ?? "500");
  const limit = Number(threshold) >= 0 ? Number(threshold) : 500;

  const errors = [hotel, meat, exp, takes, adds, moves, waste, issues].map((q) => q.error).filter(Boolean);
  const h = summarize(hotel.rows, meat.rows, exp.rows);

  const recon = reconcile(
    { menu, takes: takes.rows, additions: adds.rows, transfers: moves.rows, wastage: waste.rows, sales: hotel.rows },
    limit,
  );
  const flagged = recon.filter((r) => r.flagged);
  const fine = recon.filter((r) => !r.flagged);
  const expectedTotal = recon.reduce((s, r) => s + r.expectedSales, 0);
  const actualTotal = recon.reduce((s, r) => s + r.actualSales, 0);
  const notCounted = menu.filter((m) => m.track_stock && !takes.rows.some((t) => t.item_name === m.item_name)).length;

  function changeThreshold(v: string) {
    setThreshold(v);
    localStorage.setItem("pj-threshold", v);
  }

  /** Investigate / Approve a flagged row (creates the record if staff did not report it). */
  async function reviewRow(row: ReconRow, status: Status) {
    const stamp = { status, reviewed_by: userId, reviewed_at: new Date().toISOString() };
    const existing = issues.rows.filter((d) => d.item_name === row.item);
    try {
      if (existing.length) await updateRows("discrepancies", existing.map((d) => d.id), stamp);
      else await insertRow("discrepancies", {
        entry_date: date, shift, item_name: row.item, expected_amount: row.expectedSales,
        actual_amount: row.actualSales, amount: row.diff, note: "Flagged by reconciliation", ...stamp,
      });
      issues.reload();
      flash(`${row.item}: ${status}`);
    } catch (e) { flash((e as Error).message, true); }
  }

  async function reviewIssue(d: Discrepancy, status: Status) {
    try {
      await updateRows("discrepancies", [d.id], { status, reviewed_by: userId, reviewed_at: new Date().toISOString() });
      issues.reload();
      flash(`${d.item_name}: ${status}`);
    } catch (e) { flash((e as Error).message, true); }
  }

  return (
    <div className="grid gap-4">
      {errors.length > 0 && <ErrorBox>{String(errors[0])}</ErrorBox>}

      {/* ---- Cashier handover ---- */}
      <Card>
        <Title hint={`${date} · ${shift}`}>Cashier handover</Title>
        <div className="divide-y divide-line">
          <StatRow label="Total Sales" value={formatMoney(h.totalSales)} note={`Hotel ${formatMoney(h.hotel.sales)} · Butchery ${formatMoney(h.butchery.sales)}`} />
          <StatRow label="Total Cash" value={formatMoney(h.totalCash)} />
          <StatRow label="Total M-Pesa" value={formatMoney(h.totalMpesa)} />
          <StatRow label="Total Unpaid" value={formatMoney(h.totalUnpaid)} />
          <StatRow label="Total Expenses" value={formatMoney(h.totalExpenses)} note={`Paid from cash (deducted): ${formatMoney(h.cashExpenses)}`} />
        </div>
        <div className="mt-3 rounded-xl bg-brand p-4 text-white">
          <StatRow big label="Cash to Hand Over" value={formatMoney(h.cashToHandOver)} note="Total cash − cash expenses" />
        </div>
        {h.mismatch && <ErrorBox>Some sales do not add up (cash + M-Pesa + unpaid ≠ total). Check the order lists.</ErrorBox>}
      </Card>

      {/* ---- Reconciliation ---- */}
      <Card>
        <Title>Stock reconciliation</Title>
        <div className="mb-3 grid grid-cols-[1fr_8rem] items-center gap-3">
          <span className="text-sm text-muted">Flag a gap bigger than (KSh)</span>
          <input className={`${inputCls} !h-12 text-center`} inputMode="decimal" value={threshold} onChange={(e) => changeThreshold(e.target.value)} />
        </div>

        {recon.length === 0 ? (
          <Empty>No stock count for this shift yet. Staff enter it on the Stock tab.</Empty>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Expected (from stock)</div><div className="font-extrabold">{formatMoney(expectedTotal)}</div></div>
              <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Actual (from orders)</div><div className="font-extrabold">{formatMoney(actualTotal)}</div></div>
            </div>
            <p className={`mb-3 rounded-xl p-3 text-center font-bold ${flagged.length ? "bg-danger-soft text-danger" : "bg-ok-soft text-green-800"}`}>
              {flagged.length ? `⚠ ${flagged.length} item${flagged.length > 1 ? "s" : ""} flagged` : "✓ All counted items are within the limit"}
            </p>
            {notCounted > 0 && <p className="mb-3 text-sm text-muted">{notCounted} stock item{notCounted > 1 ? "s" : ""} not counted yet.</p>}

            <ul className="grid gap-3">
              {flagged.map((r) => {
                const status = issues.rows.find((d) => d.item_name === r.item)?.status;
                return (
                  <li key={r.item} className="rounded-xl border-2 border-danger bg-danger-soft/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-lg font-extrabold">{r.item}</span>
                      {status && <Badge tone={tone(status)}>{status}</Badge>}
                    </div>
                    <Detail r={r} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button small variant="outline" onClick={() => void reviewRow(r, "Investigate")}>Investigate</Button>
                      <Button small onClick={() => void reviewRow(r, "Approved")}>Approve</Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {fine.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-bold text-brand">Within limit ({fine.length})</summary>
                <ul className="mt-2 divide-y divide-line">
                  {fine.map((r) => (
                    <li key={r.item} className="py-2"><div className="flex justify-between font-semibold"><span>{r.item}</span><span className="tabular-nums">{formatMoney(r.diff)}</span></div><Detail r={r} /></li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </Card>

      {/* ---- Reported issues ---- */}
      <Card>
        <Title hint={`${issues.rows.length}`}>Reported issues</Title>
        {issues.rows.length === 0 && <Empty>No issues for this shift.</Empty>}
        <ul className="divide-y divide-line">
          {issues.rows.map((d) => (
            <li key={d.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{d.item_name}</span>
                <span className="flex items-center gap-2"><span className="font-bold tabular-nums">{formatMoney(d.amount)}</span><Badge tone={tone(d.status)}>{d.status}</Badge></span>
              </div>
              <div className="text-sm text-muted">{d.note ?? "—"}</div>
              <ReceiptLink path={d.receipt_url} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button small variant="outline" onClick={() => void reviewIssue(d, "Investigate")}>Investigate</Button>
                <Button small onClick={() => void reviewIssue(d, "Approved")}>Approve</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}

function Detail({ r }: { r: ReconRow }) {
  const u = r.unit ? ` ${r.unit}` : "";
  return (
    <div className="mt-1 text-sm text-muted">
      <div>
        Opening {r.opening} + added {r.added + r.transferredIn} − out {r.transferredOut} − wasted {r.wasted} − closing {r.closing} = <b>{r.unitsUsed}{u} used</b>
      </div>
      <div className="mt-1 flex justify-between text-ink">
        <span>Expected {formatMoney(r.expectedSales)}</span>
        <span>Actual {formatMoney(r.actualSales)}</span>
        <span className={`font-bold ${r.flagged ? "text-danger" : ""}`}>{r.diff > 0 ? "Short " : r.diff < 0 ? "Extra " : ""}{formatMoney(Math.abs(r.diff))}</span>
      </div>
    </div>
  );
}
