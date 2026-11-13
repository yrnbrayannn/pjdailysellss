// Tiny hooks shared by the pages. No providers, no stores.
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { getAll, getByShift } from "./api";
import type { MenuItem, Role, Shift } from "./types";

export interface AppCtx {
  date: string; // from the header date picker
  shift: Shift; // from the header Day/Night toggle
  role: Role;
  userId: string;
  email: string;
}

/** Date, shift and role chosen in the header (passed down by the router). */
export const useApp = () => useOutletContext<AppCtx>();

/** Rows of a table for the header's date + shift. Refetches when either changes. */
export function useShiftRows<T>(table: string, dateCol: string) {
  const { date, shift } = useApp();
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    getByShift<T>(table, dateCol, date, shift)
      .then((r) => { if (!ignore) { setRows(r); setError(null); } })
      .catch((e: Error) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [table, dateCol, date, shift, tick]);

  return { rows, error, reload: () => setTick((t) => t + 1) };
}

/** The menu, sorted by category then name. */
export function useMenu(onlyStocked = false) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    getAll<MenuItem>("menu_items", "category")
      .then((r) => {
        if (ignore) return;
        r.sort((a, b) => a.category.localeCompare(b.category) || a.item_name.localeCompare(b.item_name));
        setItems(onlyStocked ? r.filter((i) => i.track_stock) : r);
        setError(null);
      })
      .catch((e: Error) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [onlyStocked, tick]);

  return { items, error, reload: () => setTick((t) => t + 1) };
}
