import { describe, expect, it } from "vitest";
import { groupOrders } from "./orders";
import type { HotelSale } from "./types";

const row = (o: Partial<HotelSale>): HotelSale => ({
  id: Math.random().toString(), sale_date: "2026-11-13", shift: "Day", food_item: "TEA", quantity: 1, unit_price: 50,
  total_cost: 50, payment_method: "Cash", mpesa_part: 0, cash_received: 50, mpesa_received: 0, table_no: null,
  check_status: "OK", order_ref: null, order_type: null, notes: null, created_by: null, created_at: "2026-11-13T08:00:00Z", ...o,
});

describe("groupOrders", () => {
  it("joins lines with the same order_ref and keeps old rows apart", () => {
    const g = groupOrders([row({ order_ref: "a" }), row({ order_ref: "a", food_item: "CHAPATI", total_cost: 25, cash_received: 25 }), row({})]);
    expect(g).toHaveLength(2);
    expect(g[0]!.total).toBe(75);
    expect(g[0]!.method).toBe("Cash");
  });
  it("shows a split and an unpaid order correctly", () => {
    const split = groupOrders([row({ order_ref: "s", payment_method: "Cash + M-Pesa", cash_received: 30, mpesa_part: 20, mpesa_received: 20 })])[0]!;
    expect(split.method).toBe("Cash + M-Pesa");
    const unpaid = groupOrders([row({ order_ref: "u", payment_method: "Unpaid", check_status: "UNPAID", cash_received: 0 })])[0]!;
    expect(unpaid.method).toBe("Unpaid");
    expect(unpaid.unpaid).toBe(50);
  });
});
