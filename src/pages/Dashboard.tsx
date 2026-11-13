// Cashier and admin: the shift handover.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatMoney, insertRow, rawPrice, updateRows } from "../lib/api";
import { summarize } from "../lib/money";
import { OTHER_NOTE } from "../lib/orders";
import { reconcile, type ReconRow, type SaleLine } from "../lib/reconcile";
import { useApp, useMenu, useRawItems, useShiftRows } from "../lib/useApp";
import type {
  ButcherySale, Discrepancy, Expense, HotelSale, Section, StockAddition, StockItemRef, StockTake, StockTransfer, Wastage,
} from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Flash, StatRow, Title, inputCls, useFlash } from "../components/ui";
import { ReceiptLink } from "../components/Receipt";

type Status = "Investigate" | "Approved";
const tone = (s: string) => (s === "Approved" ? "green" : s === "Investigate" ? "amber" : "gray");

export default function Dashboard() {
  const { date, shift, userId, role } = useApp();
  const isAdmin = role === "admin";
  const { msg, flash } = useFlash();

  const hotel = useShiftRows<HotelSale>("hotel_sales", "sale_date");
  const meat = useShiftRows<ButcherySale>("butchery_sales", "sale_date");
  const exp = useShiftRows<Expense>("expenses", "expense_date");
  const takes = useShiftRows<StockTake>("stock_takes", "stock_date", isAdmin);
  const adds = useShiftRows<StockAddition>("stock_additions", "entry_date", isAdmin);
  const moves = useShiftRows<StockTransfer>("stock_transfers", "entry_date", isAdmin);
  const waste = useShiftRows<Wastage>("wastage", "entry_date", isAdmin);
  const issues = useShiftRows<Discrepancy>("discrepancies", "entry_date", isAdmin);
  const { items: menu } = useMenu();
  const rawStore = useRawItems("Store");
  const rawMeat = useRawItems("Butchery");

  const [threshold, setThreshold] = useState(() => localStorage.getItem("pj-threshold") ?? "500");
  const limit = Number(threshold) >= 0 ? Number(threshold) : 500;

  const errors = [hotel, meat, exp, ...(isAdmin ? [takes, adds, moves, waste, issues] : [])].map((q) => q.error).filter(Boolean);
  const h = summarize(hotel.rows, meat.rows, exp.rows);
  const unpaidOrders = new Set(hotel.rows.filter((r) => r.payment_method === "Unpaid" || r.check_status === "UNPAID").map((r) => r.order_ref ?? r.id)).size;

  const display = useMemo(() => build("Display", menu.filter((m) => m.track_stock).map((m) => ({ name: m.item_name, unit: m.unit_type, price: Number(m.selling_price) || 0 })), hotel.rows), [menu, takes.rows, adds.rows, moves.rows, waste.rows, hotel.rows, limit]);
  const butchery = useMemo(() => build("Butchery", rawMeat.items.map((r) => ({ name: r.item_name, unit: r.unit_type, price: rawPrice(r, rawMeat.priceKey) })),
    meat.rows.map((m) => ({ food_item: m.meat_item, quantity: m.quantity_kg, total_cost: m.cost_kshs }))), [rawMeat.items, rawMeat.priceKey, takes.rows, adds.rows, moves.rows, waste.rows, meat.rows, limit]);
  const store = useMemo(() => build("Store", rawStore.items.map((r) => ({ name: r.item_name, unit: r.unit_type, price: 0 })), []), [rawStore.items, takes.rows, adds.rows, moves.rows, waste.rows, limit]);

  function build(section: Section, items: StockItemRef[], sales: SaleLine[]) {
    const mine = takes.rows.filter((t) => t.section === section);
    const rows = reconcile(
      {
        items, menu: section === "Display" ? menu : [], takes: mine,
        additions: adds.rows.filter((r) => r.section === section),
        transfers: moves.rows.filter((r) => r.section === section),
        wastage: waste.rows.filter((r) => r.section === section),
        sales,
      },
      limit,
    );
    const pending = items.filter((it) => !mine.some((t) => t.item_name === it.name && t.closing_qty !== null && t.closing_qty !== undefined)).length;
    return { rows, pending };
  }

  const others = useMemo(() => {
    const map = new Map<string, { qty: number; amount: number }>();
    for (const r of hotel.rows.filter((x) => x.notes === OTHER_NOTE)) {
      const cur = map.get(r.food_item) ?? { qty: 0, amount: 0 };
      map.set(r.food_item, { qty: cur.qty + Number(r.quantity), amount: cur.amount + Number(r.total_cost) });
    }
    return [...map.entries()].map(([name, v]) => ({ name, ...v }));
  }, [hotel.rows]);

  function changeThreshold(v: string) {
    setThreshold(v);
    localStorage.setItem("pj-threshold", v);
  }

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
    <div className="grid gap-4 items-start lg:grid-cols-3">
      {errors.length > 0 && <div className="lg:col-span-3"><ErrorBox>{String(errors[0])}</ErrorBox></div>}

      {/* ---- Cashier handover ---- */}
      <div className="lg:col-span-1">
        <Card>
          <Title hint={`${date} · ${shift}`}>Cashier handover</Title>
          <div className="divide-y divide-line">
            <StatRow label="Total Sales" value={formatMoney(h.totalSales)} note={`Hotel ${formatMoney(h.hotel.sales)} · Butchery ${formatMoney(h.butchery.sales)}`} />
            <StatRow label="Total Cash" value={formatMoney(h.totalCash)} />
            <StatRow label="Total M-Pesa" value={formatMoney(h.totalMpesa)} />
            <StatRow label="Total Unpaid" value={formatMoney(h.totalUnpaid)} note={unpaidOrders ? `${unpaidOrders} unpaid hotel order${unpaidOrders > 1 ? "s" : ""}` : undefined} />
            <StatRow label="Total Expenses" value={formatMoney(h.totalExpenses)} note={`Paid from cash (deducted): ${formatMoney(h.cashExpenses)}`} />
          </div>
          <div className="mt-3 rounded-xl bg-brand p-4 text-white">
            <StatRow big label="Cash to Hand Over" value={formatMoney(h.cashToHandOver)} note="Total cash − cash expenses" />
          </div>
          {unpaidOrders > 0 && (
            <Link to="/orders" className="mt-3 block rounded-xl bg-warn-soft p-3 text-center font-bold text-amber-800">
              {unpaidOrders} unpaid order{unpaidOrders > 1 ? "s" : ""}. Open Orders to mark them paid.
            </Link>
          )}
          {h.mismatch && <ErrorBox>Some sales do not add up (cash + M-Pesa + unpaid ≠ total). Check the order lists.</ErrorBox>}
        </Card>
      </div>

      {/* ---- Admin Extras ---- */}
      {isAdmin && (
        <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm border border-line">
              <span className="text-sm font-bold text-muted">Flag a stock gap bigger than (KSh)</span>
              <input className={`${inputCls} !h-10 w-24 text-center font-bold`} inputMode="decimal" value={threshold} onChange={(e) => changeThreshold(e.target.value)} />
            </div>
          </div>

          <ReconCard title="Display stock check" result={display} unitLabel="" onReview={reviewRow} issues={issues.rows} emptyText="No closed display count yet." />
          <ReconCard title="Butchery stock check" result={butchery} unitLabel="kg" onReview={reviewRow} issues={issues.rows} emptyText="No closed butchery count yet." />

          <Card>
            <Title hint={store.pending ? `${store.pending} not closed` : undefined}>Store check</Title>
            {store.rows.length === 0 ? <Empty>No closed store count for this shift.</Empty> : (
              <ul className="divide-y divide-line">
                {store.rows.map((r) => (
                  <li key={r.item} className="py-2">
                    <div className="flex justify-between font-semibold"><span>{r.item}</span><span className="tabular-nums">{r.unitsUsed}{r.unit ? ` ${r.unit}` : ""} used</span></div>
                    <Detail r={r} showMoney={false} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <Title hint={others.length ? `${others.length}` : undefined}>Other items sold</Title>
            {others.length === 0 ? <Empty>Nothing outside the menu was sold.</Empty> : (
              <ul className="divide-y divide-line">
                {others.map((o) => (
                  <li key={o.name} className="flex justify-between py-2 font-semibold"><span>{o.qty} × {o.name}</span><span className="tabular-nums">{formatMoney(o.amount)}</span></li>
                ))}
              </ul>
            )}
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <Title hint={`${issues.rows.length}`}>Reported issues</Title>
              {issues.rows.length === 0 && <Empty>No issues for this shift.</Empty>}
              <ul className="grid gap-3 md:grid-cols-2">
                {issues.rows.map((d) => (
                  <li key={d.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{d.item_name}</span>
                      <span className="flex items-center gap-2"><span className="font-bold tabular-nums">{formatMoney(d.amount)}</span><Badge tone={tone(d.status)}>{d.status}</Badge></span>
                    </div>
                    <div className="text-sm text-muted">{d.note ?? ""}</div>
                    <ReceiptLink path={d.receipt_url} />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button small variant="outline" onClick={() => void reviewIssue(d, "Investigate")}>Investigate</Button>
                      <Button small onClick={() => void reviewIssue(d, "Approved")}>Approve</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
      <Flash msg={msg} />
    </div>
  );
}

function ReconCard({ title, result, unitLabel, onReview, issues, emptyText }: { title: string; result: { rows: ReconRow[]; pending: number }; unitLabel: string; onReview: (r: ReconRow, s: Status) => Promise<void>; issues: Discrepancy[]; emptyText: string; }) {
  const { rows, pending } = result;
  const flagged = rows.filter((r) => r.flagged);
  const fine = rows.filter((r) => !r.flagged);
  const expected = rows.reduce((s, r) => s + r.expectedSales, 0);
  const actual = rows.reduce((s, r) => s + r.actualSales, 0);

  return (
    <Card>
      <Title hint={pending ? `${pending} not closed` : undefined}>{title}</Title>
      {rows.length === 0 ? <Empty>{emptyText}</Empty> : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Expected (from stock)</div><div className="font-extrabold">{formatMoney(expected)}</div></div>
            <div className="rounded-xl bg-brand-soft p-3"><div className="text-xs text-muted">Actual (from sales)</div><div className="font-extrabold">{formatMoney(actual)}</div></div>
          </div>
          <p className={`mb-3 rounded-xl p-3 text-center font-bold ${flagged.length ? "bg-danger-soft text-danger" : "bg-ok-soft text-green-800"}`}>
            {flagged.length ? `${flagged.length} item${flagged.length > 1 ? "s" : ""} flagged` : "All counted items are within the limit"}
          </p>
          <ul className="grid gap-3">
            {flagged.map((r) => {
              const status = issues.find((d) => d.item_name === r.item)?.status;
              return (
                <li key={r.item} className="rounded-xl border-2 border-danger bg-danger-soft/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-lg font-extrabold">{r.item}</span>
                    {status && <Badge tone={tone(status)}>{status}</Badge>}
                  </div>
                  <Detail r={r} unitLabel={unitLabel} />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button small variant="outline" onClick={() => void onReview(r, "Investigate")}>Investigate</Button>
                    <Button small onClick={() => void onReview(r, "Approved")}>Approve</Button>
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
                  <li key={r.item} className="py-2"><div className="flex justify-between font-semibold"><span>{r.item}</span><span className="tabular-nums">{formatMoney(r.diff)}</span></div><Detail r={r} unitLabel={unitLabel} /></li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Card>
  );
}

function Detail({ r, unitLabel = "", showMoney = true }: { r: ReconRow; unitLabel?: string; showMoney?: boolean }) {
  const u = r.unit && !unitLabel ? ` ${r.unit}` : unitLabel ? ` ${unitLabel}` : "";
  return (
    <div className="mt-1 text-sm text-muted">
      <div>Opening {r.opening} + added {r.added + r.transferredIn} − out {r.transferredOut} − wasted {r.wasted} − closing {r.closing} = <b>{r.unitsUsed}{u} used</b></div>
      {showMoney && (
        <>
          <div>Sold in orders: <b>{r.unitsSold}{u}</b>{r.unitsGap !== 0 ? ` (${r.unitsGap > 0 ? "short " : "extra "}${Math.abs(r.unitsGap)}${u})` : ""}</div>
          <div className="mt-1 flex justify-between text-ink">
            <span>Expected {formatMoney(r.expectedSales)}</span>
            <span>Actual {formatMoney(r.actualSales)}</span>
            <span className={`font-bold ${r.flagged ? "text-danger" : ""}`}>{r.diff > 0 ? "Short " : r.diff < 0 ? "Extra " : ""}{formatMoney(Math.abs(r.diff))}</span>
          </div>
        </>
      )}
    </div>
  );
}