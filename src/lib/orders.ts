// Helpers for orders that have several lines (one customer: Tea + Chapati + Eggs).
import { round2 } from "./money";
import type { HotelSale } from "./types";

/** Saved in hotel_sales.notes for items that are not on the menu, so the dashboard can count them. */
export const OTHER_NOTE = "other item";

export interface OrderGroup {
  key: string;
  rows: HotelSale[];
  total: number;
  cash: number;
  mpesa: number;
  unpaid: number;
  method: "Cash" | "M-Pesa" | "Cash + M-Pesa" | "Unpaid";
  table: string | null;
  createdAt: string;
  hasOther: boolean;
}

/** Rows that share an order_ref become one order. Old rows without one stay on their own. */
export function groupOrders(rows: HotelSale[]): OrderGroup[] {
  const map = new Map<string, HotelSale[]>();
  for (const r of rows) {
    const k = r.order_ref ?? r.id;
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([key, rs]) => {
    let cash = 0, mpesa = 0, unpaid = 0, total = 0;
    for (const r of rs) {
      const t = Number(r.total_cost) || 0;
      total += t;
      if (r.payment_method === "Unpaid" || r.check_status === "UNPAID") unpaid += t;
      else if (r.payment_method === "M-Pesa") mpesa += Number(r.mpesa_received ?? t) || 0;
      else if (r.payment_method === "Cash") cash += Number(r.cash_received ?? t) || 0;
      else {
        const m = Number(r.mpesa_received ?? r.mpesa_part) || 0;
        mpesa += m;
        cash += Number(r.cash_received ?? t - m) || 0;
      }
    }
    const method = unpaid > 0 ? "Unpaid" : mpesa > 0 && cash > 0 ? "Cash + M-Pesa" : mpesa > 0 ? "M-Pesa" : "Cash";
    return {
      key, rows: rs, total: round2(total), cash: round2(cash), mpesa: round2(mpesa), unpaid: round2(unpaid), method,
      table: rs.find((r) => r.table_no)?.table_no ?? null,
      createdAt: rs[rs.length - 1]!.created_at,
      hasOther: rs.some((r) => r.notes === OTHER_NOTE),
    };
  });
}
