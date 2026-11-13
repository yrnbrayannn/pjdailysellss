import { describe, expect, it } from "vitest";
import { calculateShiftSummary } from "@/lib/shift-recorder";

describe("calculateShiftSummary", () => {
  it("subtracts Cash expenses from cash collected across both counters", () => {
    const summary = calculateShiftSummary(
      [
        {
          total_cost: 800,
          payment_method: "Cash",
          cash_received: 800,
          mpesa_part: 0,
          mpesa_received: 0,
          check_status: "OK",
        },
      ],
      [{ cost_kshs: 1200, payment_method: "Cash" }],
      [{ amount: 500, paid_from: "Cash" }],
    );

    expect(summary.cashToHandOver).toBe(1500);
  });

  it("flags a sale amount that does not match cash, M-Pesa, and unpaid", () => {
    const summary = calculateShiftSummary(
      [
        {
          total_cost: 1000,
          payment_method: "Cash + M-Pesa",
          cash_received: 400,
          mpesa_part: 600,
          mpesa_received: 500,
          check_status: "OK",
        },
      ],
      [],
      [],
    );

    expect(summary.discrepancy).toBe(true);
  });
});