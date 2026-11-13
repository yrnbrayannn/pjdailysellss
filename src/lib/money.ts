// All the money rules in one small, tested file.
import type { ButcherySale, Expense, HotelSale } from "./types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cash part of a split payment: Total Cost − M-Pesa Part = Cash Received. */
export function splitCash(total: number, mpesa: number): number {
  return round2(total - mpesa);
}

/** Returns a message if the M-Pesa part is not allowed, otherwise null. */
export function splitError(total: number, mpesa: number): string | null {
  if (!Number.isFinite(mpesa) || mpesa <= 0) return "Enter the M-Pesa amount";
  if (round2(mpesa) >= round2(total)) return "M-Pesa must be less than the total";
  return null;
}

/**
 * Splits one order's M-Pesa amount across its lines so every line still adds up.
 * Each line gets a share in proportion to its total; the last line takes the rounding remainder.
 * Returns, per line, the M-Pesa part and the cash part (cash = line total - M-Pesa).
 */
export function allocateSplit(lineTotals: number[], mpesaTotal: number): { mpesa: number; cash: number }[] {
  const grand = round2(lineTotals.reduce((s, n) => s + n, 0));
  let left = round2(mpesaTotal);
  return lineTotals.map((t, i) => {
    const isLast = i === lineTotals.length - 1;
    const share = isLast ? left : Math.min(left, round2((t / grand) * mpesaTotal));
    const mpesa = Math.min(round2(t), Math.max(0, round2(share)));
    left = round2(left - mpesa);
    return { mpesa, cash: round2(t - mpesa) };
  });
}

/** The payment fields for one saved line, given how much of it was paid by M-Pesa. */
export function paymentFields(total: number, mpesa: number) {
  const t = round2(total);
  const m = round2(mpesa);
  if (m <= 0) return { payment_method: "Cash" as const, cash_received: t, mpesa_part: 0, mpesa_received: 0 };
  if (m >= t) return { payment_method: "M-Pesa" as const, cash_received: 0, mpesa_part: 0, mpesa_received: t };
  return { payment_method: "Cash + M-Pesa" as const, cash_received: round2(t - m), mpesa_part: m, mpesa_received: m };
}

export interface Totals { sales: number; cash: number; mpesa: number; unpaid: number }

type SaleLike = Pick<HotelSale, "total_cost" | "payment_method" | "cash_received" | "mpesa_part" | "mpesa_received" | "check_status">;
type MeatLike = Pick<ButcherySale, "cost_kshs" | "payment_method">;
type ExpenseLike = Pick<Expense, "amount" | "paid_from">;

function hotelTotals(sales: SaleLike[]): Totals {
  const t: Totals = { sales: 0, cash: 0, mpesa: 0, unpaid: 0 };
  for (const s of sales) {
    const amount = Number(s.total_cost) || 0;
    t.sales += amount;
    if (s.payment_method === "Unpaid" || s.check_status === "UNPAID") t.unpaid += amount;
    else if (s.payment_method === "Cash") t.cash += Number(s.cash_received ?? amount) || 0;
    else if (s.payment_method === "M-Pesa") t.mpesa += Number(s.mpesa_received ?? amount) || 0;
    else if (s.payment_method === "Cash + M-Pesa") {
      const mpesa = Number(s.mpesa_received ?? s.mpesa_part) || 0;
      t.mpesa += mpesa;
      t.cash += Number(s.cash_received ?? amount - mpesa) || 0;
    }
  }
  return roundTotals(t);
}

function meatTotals(sales: MeatLike[]): Totals {
  const t: Totals = { sales: 0, cash: 0, mpesa: 0, unpaid: 0 };
  for (const s of sales) {
    const amount = Number(s.cost_kshs) || 0;
    t.sales += amount;
    if (s.payment_method === "Cash") t.cash += amount;
    if (s.payment_method === "M-Pesa") t.mpesa += amount;
    if (s.payment_method === "Unpaid") t.unpaid += amount;
  }
  return roundTotals(t);
}

function roundTotals(t: Totals): Totals {
  return { sales: round2(t.sales), cash: round2(t.cash), mpesa: round2(t.mpesa), unpaid: round2(t.unpaid) };
}

export interface Handover {
  hotel: Totals;
  butchery: Totals;
  totalSales: number;
  totalCash: number;
  totalMpesa: number;
  totalUnpaid: number;
  totalExpenses: number; // every expense of the shift
  cashExpenses: number; // only the ones paid out of the cash drawer
  cashToHandOver: number; // total cash − cash expenses
  mismatch: boolean; // true if sales ≠ cash + M-Pesa + unpaid somewhere
}

export function summarize(hotelSales: SaleLike[], meatSales: MeatLike[], expenses: ExpenseLike[]): Handover {
  const hotel = hotelTotals(hotelSales);
  const butchery = meatTotals(meatSales);
  const totalExpenses = round2(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0));
  const cashExpenses = round2(expenses.reduce((s, e) => s + (e.paid_from === "Cash" ? Number(e.amount) || 0 : 0), 0));
  const totalCash = round2(hotel.cash + butchery.cash);
  return {
    hotel,
    butchery,
    totalSales: round2(hotel.sales + butchery.sales),
    totalCash,
    totalMpesa: round2(hotel.mpesa + butchery.mpesa),
    totalUnpaid: round2(hotel.unpaid + butchery.unpaid),
    totalExpenses,
    cashExpenses,
    cashToHandOver: round2(totalCash - cashExpenses),
    mismatch: [hotel, butchery].some((g) => round2(g.sales) !== round2(g.cash + g.mpesa + g.unpaid)),
  };
}
