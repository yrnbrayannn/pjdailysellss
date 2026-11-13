// Tiny hooks shared by the pages. No providers, no stores.
import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getAll, getByShift, rawPrice, rawPriceKey } from "./api";
import type { MenuItem, RawItem, Role, Section, Shift, StockItemRef } from "./types";

export interface AppCtx {
  date: string; // from the header date picker
  shift: Shift; // from the header Day/Night toggle
  role: Role;
  userId: string;
  email: string;
}

/** Date, shift and role chosen in the header (passed down by the router). */
export const useApp = () => useOutletContext<AppCtx>();

/** Which stock sections each role may use. The database enforces this too; this only hides the rest. */
export const SECTIONS_FOR: Record<Role, Section[]> = {
  admin: ["Display", "Store", "Butchery"],
  cashier: ["Display", "Store"],
  staff: ["Display", "Store"],
  butcher: ["Butchery"],
};

/** Rows of a table for the header's date + shift. Refetches when either changes. */
export function useShiftRows<T>(table: string, dateCol: string, enabled = true) {
  const { date, shift } = useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    getByShift<T>(table, dateCol, date, shift)
      .then((r) => { if (!ignore) { setRows(r); setError(null); } })
      .catch((e: Error) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [table, dateCol, date, shift, tick, enabled]);

  return { rows, error, reload: () => setTick((t) => t + 1) };
}

/** The menu in printed order (sort_order, then name). */
export function useMenu(onlyStocked = false) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    getAll<MenuItem>("menu_items", "sort_order")
      .then((r) => {
        if (ignore) return;
        r.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.item_name.localeCompare(b.item_name));
        setItems(onlyStocked ? r.filter((i) => i.track_stock) : r);
        setError(null);
      })
      .catch((e: Error) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [onlyStocked, tick]);

  return { items, error, reload: () => setTick((t) => t + 1) };
}

/** Raw materials of the Store or the Butchery, plus the name of their price column. */
export function useRawItems(section?: Section) {
  const [items, setItems] = useState<RawItem[]>([]);
  const [priceKey, setPriceKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    getAll<RawItem>("raw_items", "sort_order")
      .then((r) => {
        if (ignore) return;
        r.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.item_name.localeCompare(b.item_name));
        setPriceKey(rawPriceKey(r));
        setItems(section ? r.filter((i) => i.section === section) : r);
        setError(null);
      })
      .catch((e: Error) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [section, tick]);

  return { items, priceKey, error, reload: () => setTick((t) => t + 1) };
}

/** Everything that can be counted in one stock section, as simple {name, unit, price} entries. */
export function useStockItems(section: Section) {
  const menu = useMenu(true);
  const raw = useRawItems(section === "Display" ? undefined : section);
  // Memoised: pages use this list as an effect dependency, so it must keep the same identity between renders.
  const items = useMemo<StockItemRef[]>(
    () =>
      section === "Display"
        ? menu.items.map((m) => ({ name: m.item_name, unit: m.unit_type, price: Number(m.selling_price) || 0 }))
        : raw.items.map((r) => ({ name: r.item_name, unit: r.unit_type, price: rawPrice(r, raw.priceKey) })),
    [section, menu.items, raw.items, raw.priceKey],
  );
  return { items, error: section === "Display" ? menu.error : raw.error };
}
