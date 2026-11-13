// Expected sales (from stock used) vs actual sales (from the orders entered).
import { round2 } from "./money";
import type { HotelSale, MenuItem, StockAddition, StockTake, StockTransfer, Wastage } from "./types";

export interface ReconRow {
  item: string;
  unit: string | null;
  opening: number;
  added: number;
  transferredIn: number;
  transferredOut: number;
  wasted: number;
  closing: number;
  unitsUsed: number; // opening + added + in − out − wasted − closing
  expectedSales: number; // unitsUsed × menu price
  actualSales: number; // sum of orders entered for this item
  diff: number; // expected − actual (positive = money missing)
  flagged: boolean;
}

interface Input {
  menu: MenuItem[];
  takes: StockTake[];
  additions: StockAddition[];
  transfers: StockTransfer[];
  wastage: Wastage[];
  sales: Pick<HotelSale, "food_item" | "total_cost">[];
}

function total<T extends { item_name: string; quantity: number }>(rows: T[], item: string): number {
  return rows.filter((r) => r.item_name === item).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}

export function reconcile(input: Input, threshold: number): ReconRow[] {
  const transfersIn = input.transfers.filter((r) => r.direction === "In");
  const transfersOut = input.transfers.filter((r) => r.direction === "Out");

  const rows = input.takes.map((t): ReconRow => {
    const menu = input.menu.find((m) => m.item_name === t.item_name);
    const added = total(input.additions, t.item_name);
    const transferredIn = total(transfersIn, t.item_name);
    const transferredOut = total(transfersOut, t.item_name);
    const wasted = total(input.wastage, t.item_name);
    const opening = Number(t.opening_qty) || 0;
    const closing = Number(t.closing_qty) || 0;
    const unitsUsed = round2(opening + added + transferredIn - transferredOut - wasted - closing);
    const expectedSales = round2(unitsUsed * (Number(menu?.selling_price) || 0));
    const actualSales = round2(
      input.sales.filter((s) => s.food_item === t.item_name).reduce((sum, s) => sum + (Number(s.total_cost) || 0), 0),
    );
    const diff = round2(expectedSales - actualSales);
    return {
      item: t.item_name, unit: menu?.unit_type ?? null,
      opening, added, transferredIn, transferredOut, wasted, closing,
      unitsUsed, expectedSales, actualSales, diff,
      flagged: Math.abs(diff) > threshold,
    };
  });
  // Flagged first, biggest gap first
  return rows.sort((a, b) => Number(b.flagged) - Number(a.flagged) || Math.abs(b.diff) - Math.abs(a.diff));
}
