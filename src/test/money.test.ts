import { describe, expect, it } from "vitest";
import { round2, splitCash, splitError, summarize } from "../lib/money";
import { reconcile } from "../lib/reconcile";

describe("split payments", () => {
  it("cash = total − M-Pesa", () => {
    expect(splitCash(1000, 350)).toBe(650);
    expect(splitCash(99.9, 33.3)).toBe(66.6);
  });
  it("rejects M-Pesa that is empty, zero, or not below the total", () => {
    expect(splitError(1000, NaN)).not.toBeNull();
    expect(splitError(1000, 0)).not.toBeNull();
    expect(splitError(1000, 1000)).not.toBeNull();
    expect(splitError(1000, 1200)).not.toBeNull();
    expect(splitError(1000, 400)).toBeNull();
  });
});

describe("summarize (cashier handover)", () => {
  const hotel = [
    { total_cost: 800, payment_method: "Cash", cash_received: 800, mpesa_part: 0, mpesa_received: 0, check_status: "OK" },
    { total_cost: 1000, payment_method: "Cash + M-Pesa", cash_received: 600, mpesa_part: 400, mpesa_received: 400, check_status: "OK" },
    { total_cost: 500, payment_method: "M-Pesa", cash_received: 0, mpesa_part: 0, mpesa_received: 500, check_status: "OK" },
    { total_cost: 300, payment_method: "Unpaid", cash_received: 0, mpesa_part: 0, mpesa_received: 0, check_status: "UNPAID" },
  ];
  const meat = [{ cost_kshs: 1200, payment_method: "Cash" }];

  it("adds up every handover line", () => {
    const h = summarize(hotel, meat, [{ amount: 500, paid_from: "Cash" }, { amount: 200, paid_from: "M-Pesa" }]);
    expect(h.totalSales).toBe(3800);
    expect(h.totalCash).toBe(2600);
    expect(h.totalMpesa).toBe(900);
    expect(h.totalUnpaid).toBe(300);
    expect(h.totalExpenses).toBe(700);
    expect(h.cashExpenses).toBe(500);
    expect(h.cashToHandOver).toBe(2100);
    expect(h.mismatch).toBe(false);
  });

  it("flags sales whose parts do not add up", () => {
    const bad = [{ total_cost: 1000, payment_method: "Cash + M-Pesa", cash_received: 400, mpesa_part: 600, mpesa_received: 500, check_status: "OK" }];
    expect(summarize(bad, [], []).mismatch).toBe(true);
  });
  it("rounds to cents", () => expect(round2(0.1 + 0.2)).toBe(0.3));
});

describe("reconcile (expected vs actual sales)", () => {
  const menu = [{ id: "1", item_name: "Soda", category: "Drinks", selling_price: 100, unit_type: "bottle", track_stock: true }];
  const base = { menu, additions: [], transfers: [], wastage: [] };
  const take = (closing: number) => [{ id: "t", stock_date: "2026-11-13", shift: "Day" as const, item_name: "Soda", opening_qty: 20, closing_qty: closing }];

  it("matches when the stock used equals the orders entered", () => {
    const [r] = reconcile({ ...base, takes: take(10), sales: [{ food_item: "Soda", total_cost: 1000 }] }, 500);
    expect(r?.unitsUsed).toBe(10);
    expect(r?.expectedSales).toBe(1000);
    expect(r?.diff).toBe(0);
    expect(r?.flagged).toBe(false);
  });

  it("flags money that is missing beyond the threshold", () => {
    const [r] = reconcile({ ...base, takes: take(10), sales: [{ food_item: "Soda", total_cost: 300 }] }, 500);
    expect(r?.diff).toBe(700);
    expect(r?.flagged).toBe(true);
  });

  it("uses deliveries, transfers out and wastage in the stock used", () => {
    const [r] = reconcile({
      menu,
      takes: take(10),
      additions: [{ id: "a", entry_date: "", shift: "Day", item_name: "Soda", quantity: 12, supplier_id: null, notes: null, created_at: "" }],
      transfers: [{ id: "x", entry_date: "", shift: "Day", item_name: "Soda", quantity: 4, direction: "Out", location: null, created_at: "" }],
      wastage: [{ id: "w", entry_date: "", shift: "Day", item_name: "Soda", quantity: 1, reason: null, created_at: "" }],
      sales: [{ food_item: "Soda", total_cost: 1700 }],
    }, 100);
    // 20 + 12 − 4 − 1 − 10 = 17 used
    expect(r?.unitsUsed).toBe(17);
    expect(r?.flagged).toBe(false);
  });
});
