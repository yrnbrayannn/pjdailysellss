import { describe, expect, it } from "vitest";
import { allocateSplit, paymentFields } from "./money";

describe("allocateSplit", () => {
  it("always adds back up to the order total", () => {
    for (const [lines, mpesa] of [[[50, 25, 10], 40], [[100, 100, 100], 100], [[33.33, 33.33, 33.34], 50], [[50], 20]] as const) {
      const parts = allocateSplit([...lines], mpesa);
      const m = Math.round(parts.reduce((s, p) => s + p.mpesa, 0) * 100) / 100;
      expect(m).toBe(mpesa);
      parts.forEach((p, i) => expect(Math.round((p.mpesa + p.cash) * 100) / 100).toBe(lines[i]));
    }
  });
});

describe("paymentFields", () => {
  it("makes each line satisfy the database money rules", () => {
    expect(paymentFields(50, 0)).toEqual({ payment_method: "Cash", cash_received: 50, mpesa_part: 0, mpesa_received: 0 });
    expect(paymentFields(50, 50)).toEqual({ payment_method: "M-Pesa", cash_received: 0, mpesa_part: 0, mpesa_received: 50 });
    expect(paymentFields(50, 20)).toEqual({ payment_method: "Cash + M-Pesa", cash_received: 30, mpesa_part: 20, mpesa_received: 20 });
  });
});
