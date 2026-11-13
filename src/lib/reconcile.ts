// Stock used (from the counts) versus what was sold (from the orders). Works for any section.
import { round2 } from "./money";
import type { MenuItem, StockAddition, StockItemRef, StockTake, StockTransfer, Wastage } from "./types";

export interface ReconRow {
  item: string;
  unit: string | null;
  price: number;
  opening: number;
  added: number;
  transferredIn: number;
  transferredOut: number;
  wasted: number;
  closing: number;
  unitsUsed: number; // opening + added + in - out - wasted - closing
  unitsSold: number; // quantity found in the orders (or kg in butchery sales)
  unitsGap: number; // unitsUsed - unitsSold (positive = stock gone but not sold)
  expectedSales: number; // unitsUsed x price
  actualSales: number; // money from the orders entered
  diff: number; // unitsGap x price (positive = money missing)
  flagged: boolean;
}

/** A sale reduced to what reconciliation needs. Butchery sales are mapped to this too (kg as quantity). */
export interface SaleLine {
  food_item: string;
  quantity: number;
  total_cost: number;
}

interface Input {
  items: StockItemRef[]; // what this section counts
  menu: MenuItem[]; // used so JUICE (150) counts against JUICE and so on
  takes: StockTake[]; // already limited to this section
  additions: StockAddition[];
  transfers: StockTransfer[];
  wastage: Wastage[];
  sales: SaleLine[];
}

function total<T extends { item_name: string; quantity: number }>(rows: T[], item: string): number {
  return rows.filter((r) => r.item_name === item).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
}

/** The stock item a sold item draws from (itself unless the menu says otherwise). */
export function stockNameFor(menu: MenuItem[], foodItem: string): string {
  const m = menu.find((x) => x.item_name === foodItem);
  return m?.stock_item || foodItem;
}

export function reconcile(input: Input, threshold: number): ReconRow[] {
  const transfersIn = input.transfers.filter((r) => r.direction === "In");
  const transfersOut = input.transfers.filter((r) => r.direction === "Out");

  const rows: ReconRow[] = [];
  for (const t of input.takes) {
    if (t.closing_qty === null || t.closing_qty === undefined) continue; // closing not counted yet
    const ref = input.items.find((i) => i.name === t.item_name);
    const price = ref?.price ?? 0;
    const added = total(input.additions, t.item_name);
    const transferredIn = total(transfersIn, t.item_name);
    const transferredOut = total(transfersOut, t.item_name);
    const wasted = total(input.wastage, t.item_name);
    const opening = Number(t.opening_qty) || 0;
    const closing = Number(t.closing_qty) || 0;
    const unitsUsed = round2(opening + added + transferredIn - transferredOut - wasted - closing);

    const mine = input.sales.filter((s) => stockNameFor(input.menu, s.food_item) === t.item_name);
    const unitsSold = round2(mine.reduce((s, x) => s + (Number(x.quantity) || 0), 0));
    const actualSales = round2(mine.reduce((s, x) => s + (Number(x.total_cost) || 0), 0));
    const unitsGap = round2(unitsUsed - unitsSold);
    const diff = round2(unitsGap * price);
    rows.push({
      item: t.item_name, unit: ref?.unit ?? null, price,
      opening, added, transferredIn, transferredOut, wasted, closing,
      unitsUsed, unitsSold, unitsGap, expectedSales: round2(unitsUsed * price), actualSales, diff,
      flagged: price > 0 && Math.abs(diff) > threshold,
    });
  }
  // Flagged first, biggest gap first
  return rows.sort((a, b) => Number(b.flagged) - Number(a.flagged) || Math.abs(b.diff) - Math.abs(a.diff));
}
