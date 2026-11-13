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
