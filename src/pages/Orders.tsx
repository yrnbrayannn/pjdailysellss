// Orders: type fast (Quick Type) or tap, review the order, pick payment once, save.
import { useEffect, useMemo, useState } from "react";
import { addDays, formatMoney, formatTime, supabase } from "../lib/api";
import { allocateSplit, paymentFields, round2, splitCash, splitError } from "../lib/money";
import { groupOrders, OTHER_NOTE, type OrderGroup } from "../lib/orders";
import { learnWord, loadLearned, parseOrder, searchMenu } from "../lib/parseOrder";
import { useApp, useMenu, useShiftRows } from "../lib/useApp";
import type { HotelSale, MenuItem, Payment } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";

const METHODS: Payment[] = ["Cash", "M-Pesa", "Cash + M-Pesa", "Unpaid"];
const PAID_METHODS = ["Cash", "M-Pesa", "Cash + M-Pesa"] as const;

interface Line {
  key: string;
  item: MenuItem | null;
  label: string;
  query: string;
  qty: number;
  price: string;
  other: boolean;
  suggestions: MenuItem[];
}

let counter = 0;
const newKey = () => `l${++counter}`;
const lineTotal = (l: Line) => round2(l.qty * Number(l.price));
const lineReady = (l: Line) => (l.item !== null || l.other) && l.qty > 0 && Number(l.price) > 0;

export default function Orders() {
  const { date, shift, role } = useApp();
  const menu = useMenu();
  const sales = useShiftRows<HotelSale>("hotel_sales", "sale_date");
  const { msg, flash } = useFlash();

  const [lines, setLines] = useState<Line[]>([]);
  const [quick, setQuick] = useState("");
  const [learned, setLearned] = useState(loadLearned);
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState("");
  const [popular, setPopular] = useState<string[]>([]);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [otherPrice, setOtherPrice] = useState("");
  const [method, setMethod] = useState<Payment>("Cash");
  const [mpesa, setMpesa] = useState("");
  const [table, setTable] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;
    void supabase.from("hotel_sales").select("food_item, quantity").gte("sale_date", addDays(date, -7)).limit(3000)
      .then(({ data }) => {
        if (ignore || !data) return;
        const count = new Map<string, number>();
        for (const r of data) count.set(String(r.food_item), (count.get(String(r.food_item)) ?? 0) + (Number(r.quantity) || 1));
        setPopular([...count.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n));
      });
    return () => { ignore = true; };
  }, [date]);

  const popularItems = useMemo(
    () => popular.map((n) => menu.items.find((m) => m.item_name === n)).filter((m): m is MenuItem => !!m).slice(0, 8),
    [popular, menu.items],
  );

  const preview = useMemo(() => parseOrder(quick, menu.items, learned), [quick, menu.items, learned]);

  function addItem(item: MenuItem, qty = 1) {
    setLines((ls) => {
      const same = ls.find((l) => l.item?.id === item.id);
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { key: newKey(), item, label: item.item_name, query: "", qty, price: String(item.selling_price), other: false, suggestions: [] }];
    });
  }

  function commitQuick() {
    if (preview.length === 0) return;
    for (const p of preview) {
      if (p.item) addItem(p.item, p.qty);
      else setLines((ls) => [...ls, { key: newKey(), item: null, label: p.raw, query: p.query, qty: p.qty, price: "", other: false, suggestions: p.suggestions }]);
    }
    setQuick("");
  }

  function resolve(key: string, item: MenuItem) {
    const line = lines.find((l) => l.key === key);
    if (line?.query) { learnWord(line.query, item.item_name); setLearned(loadLearned()); }
    setLines((ls) => {
      const target = ls.find((l) => l.key === key);
      if (!target) return ls;
      const twin = ls.find((l) => l.item?.id === item.id);
      if (twin) return ls.filter((l) => l.key !== key).map((l) => (l === twin ? { ...l, qty: l.qty + target.qty } : l));
      return ls.map((l) => (l.key === key ? { ...l, item, label: item.item_name, price: String(item.selling_price), suggestions: [] } : l));
    });
  }

  function addOther() {
    if (!otherName.trim() || !(Number(otherPrice) > 0)) return;
    setLines((ls) => [...ls, { key: newKey(), item: null, label: otherName.trim(), query: "", qty: 1, price: otherPrice, other: true, suggestions: [] }]);
    setOtherName(""); setOtherPrice(""); setOtherOpen(false);
  }

  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const drop = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const total = round2(lines.reduce((s, l) => s + (lineReady(l) ? lineTotal(l) : 0), 0));
  const unresolved = lines.filter((l) => l.item === null && !l.other).length;
  const allReady = lines.length > 0 && lines.every(lineReady);
  const isSplit = method === "Cash + M-Pesa";
  const splitProblem = isSplit ? splitError(total, Number(mpesa)) : null;
  const canSave = allReady && total > 0 && !splitProblem && !saving;
  const shown = searchMenu(menu.items, search);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    const totals = lines.map(lineTotal);
    const mpesaTotal = method === "M-Pesa" ? total : isSplit ? round2(Number(mpesa)) : 0;
    const shares = method === "M-Pesa" ? totals.map((t) => ({ mpesa: t, cash: 0 })) : allocateSplit(totals, mpesaTotal);
    const ref = crypto.randomUUID();
    const rows = lines.map((l, i) => {
      const t = totals[i]!;
      const pay =
        method === "Unpaid"
          ? { payment_method: "Unpaid", cash_received: 0, mpesa_part: 0, mpesa_received: 0, check_status: "UNPAID" }
          : { ...paymentFields(t, shares[i]!.mpesa), check_status: "OK" };
      return {
        sale_date: date, shift, order_ref: ref, food_item: l.label,
        quantity: l.qty, unit_price: Number(l.price), total_cost: t,
        table_no: table.trim() || null, notes: l.other ? OTHER_NOTE : null, ...pay,
      };
    });
    const { error } = await supabase.from("hotel_sales").insert(rows);
    if (error) flash(error.message, true);
    else {
      flash(`Saved ${lines.length} item${lines.length > 1 ? "s" : ""} · ${formatMoney(total)}`);
      setLines([]); setQuick(""); setMethod("Cash"); setMpesa(""); setTable("");
      sales.reload();
    }
    setSaving(false);
  }

  const groups = useMemo(() => groupOrders(sales.rows), [sales.rows]);
  const listTotal = round2(sales.rows.reduce((s, r) => s + Number(r.total_cost), 0));
  const canMarkPaid = role === "admin" || role === "cashier";

  async function remove(g: OrderGroup) {
    const names = g.rows.map((r) => r.food_item).join(", ");
    if (!confirm(`Delete this order (${names}) for ${formatMoney(g.total)}?`)) return;
    const { error } = await supabase.from("hotel_sales").delete().in("id", g.rows.map((r) => r.id));
    if (error) flash(error.message, true);
    else sales.reload();
  }

  async function markPaid(g: OrderGroup, how: (typeof PAID_METHODS)[number], mpesaAmount: number) {
    const totals = g.rows.map((r) => Number(r.total_cost) || 0);
    const grand = round2(totals.reduce((s, n) => s + n, 0));
    const mpesaTotal = how === "M-Pesa" ? grand : how === "Cash" ? 0 : mpesaAmount;
    const shares = how === "M-Pesa" ? totals.map((t) => ({ mpesa: t, cash: 0 })) : allocateSplit(totals, mpesaTotal);
    const results = await Promise.all(
      g.rows.map((r, i) =>
        supabase.from("hotel_sales").update({ ...paymentFields(totals[i]!, shares[i]!.mpesa), check_status: "OK" }).eq("id", r.id),
      ),
    );
    const failed = results.find((x) => x.error);
    if (failed?.error) flash(failed.error.message, true);
    else flash(`Marked paid · ${formatMoney(grand)}`);
    sales.reload();
  }

  return (
    <div className="grid gap-4 items-start lg:grid-cols-12">
      {menu.error && <div className="lg:col-span-12"><ErrorBox>{menu.error}</ErrorBox></div>}

      <div className="lg:col-span-7 xl:col-span-8 space-y-4">
        <Card className="grid gap-4">
          <Title hint={lines.length ? `${lines.length} item${lines.length > 1 ? "s" : ""}` : undefined}>New order</Title>

          <Field label="Quick type (example: chai x2 + chapo)">
            <input
              className={inputCls} placeholder="Type the order, then press Add" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={quick} onChange={(e) => setQuick(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitQuick(); } }}
            />
          </Field>
          {preview.length > 0 && (
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                {preview.map((p, i) => (
                  <span key={i} className={`rounded-full px-3 py-1 text-sm font-bold ${p.item ? "bg-ok-soft text-green-800" : "bg-danger-soft text-danger"}`}>
                    {p.item ? `${p.item.item_name} × ${p.qty}` : `? ${p.raw}`}
                  </span>
                ))}
              </div>
              <Button onClick={commitQuick}>Add to order</Button>
            </div>
          )}

          {popularItems.length > 0 && (
            <div>
              <div className="mb-1 text-sm font-semibold text-muted">Popular this week</div>
              <div className="flex flex-wrap gap-2">
                {popularItems.map((m) => (
                  <button key={m.id} type="button" onClick={() => addItem(m)} className="min-h-12 rounded-xl border-2 border-brand px-3 text-sm font-bold text-brand active:bg-brand-soft">
                    {m.item_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setBrowse((b) => !b)}>{browse ? "Hide menu" : "Browse menu"}</Button>
            <Button variant="outline" onClick={() => setOtherOpen((o) => !o)}>Other item</Button>
          </div>

          {browse && (
            <div>
              <input className={inputCls} placeholder="Search the menu" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto">
                {shown.map((i) => (
                  <button key={i.id} type="button" onClick={() => addItem(i)} className="flex min-h-14 items-center justify-between rounded-xl border-2 border-line bg-white px-4 text-left active:bg-brand-soft">
                    <span><span className="block text-lg font-bold">{i.item_name}</span><span className="text-xs text-muted">{i.category}</span></span>
                    <span className="font-bold tabular-nums">{formatMoney(i.selling_price)}</span>
                  </button>
                ))}
                {shown.length === 0 && <Empty>{menu.items.length ? "No match" : "Menu is empty. Ask the admin to add items."}</Empty>}
              </div>
            </div>
          )}

          {otherOpen && (
            <div className="grid gap-2 rounded-xl border-2 border-dashed border-line p-3">
              <p className="text-sm text-muted">For something not on the menu (soup, cabbage...). It is saved and marked as "other".</p>
              <input className={inputCls} placeholder="Item name" value={otherName} onChange={(e) => setOtherName(e.target.value)} />
              <input className={inputCls} inputMode="decimal" placeholder="Price (KSh)" value={otherPrice} onChange={(e) => setOtherPrice(e.target.value)} />
              <Button disabled={!otherName.trim() || !(Number(otherPrice) > 0)} onClick={addOther}>Add other item</Button>
            </div>
          )}

          {lines.length > 0 && (
            <ul className="grid gap-3 md:grid-cols-2">
              {lines.map((l) => (
                <li key={l.key} className={`rounded-xl border-2 p-3 ${l.item || l.other ? "border-line" : "border-danger bg-danger-soft/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-extrabold">{l.item || l.other ? l.label : `? ${l.label}`}</div>
                      {l.other && <Badge tone="amber">other item</Badge>}
                    </div>
                    <Button small variant="danger" onClick={() => drop(l.key)} aria-label="Remove">✕</Button>
                  </div>

                  {!l.item && !l.other && (
                    <div className="mt-2">
                      <div className="mb-1 text-sm font-semibold text-danger">Not sure which item this is. Tap the right one:</div>
                      <div className="flex flex-wrap gap-2">
                        {l.suggestions.map((s) => (
                          <button key={s.id} type="button" onClick={() => resolve(l.key, s)} className="min-h-12 rounded-xl border-2 border-brand bg-white px-3 text-sm font-bold text-brand active:bg-brand-soft">
                            {s.item_name}
                          </button>
                        ))}
                        <button type="button" onClick={() => { setBrowse(true); setSearch(l.query); }} className="min-h-12 rounded-xl border-2 border-line bg-white px-3 text-sm font-bold text-muted">
                          Search menu
                        </button>
                      </div>
                    </div>
                  )}

                  {(l.item || l.other) && (
                    <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-end gap-3">
                      <div className="grid grid-cols-[3rem_3rem_3rem] items-center gap-1">
                        <Button small variant="outline" className="!px-0" onClick={() => patch(l.key, { qty: Math.max(1, l.qty - 1) })} aria-label="Less">−</Button>
                        <div className="text-center text-xl font-extrabold tabular-nums">{l.qty}</div>
                        <Button small variant="outline" className="!px-0" onClick={() => patch(l.key, { qty: l.qty + 1 })} aria-label="More">+</Button>
                      </div>
                      <label className="block">
                        <span className="text-[11px] font-semibold text-muted">Price each</span>
                        <input className="h-12 w-full rounded-lg border-2 border-line px-2 text-center text-lg" inputMode="decimal" value={l.price} onChange={(e) => patch(l.key, { price: e.target.value })} />
                      </label>
                      <div className="pb-2 text-lg font-bold tabular-nums">{formatMoney(lineReady(l) ? lineTotal(l) : 0)}</div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {lines.length > 0 && (
            <>
              <div className="rounded-xl bg-brand p-3 text-center text-white">
                <div className="text-sm opacity-80">Total</div>
                <div className="text-3xl font-extrabold tabular-nums">{formatMoney(total)}</div>
              </div>

              <Field label="Payment (for the whole order)" group>
                <Segmented options={METHODS} value={method} onChange={(m) => { setMethod(m); setMpesa(""); }} cols={2} />
              </Field>

              {isSplit && (
                <div className="grid gap-2">
                  <Field label="M-Pesa amount (KSh)">
                    <input className={inputCls} inputMode="decimal" placeholder="How much came by M-Pesa?" value={mpesa} onChange={(e) => setMpesa(e.target.value)} />
                  </Field>
                  {splitProblem ? (
                    <p className={`text-sm font-semibold ${mpesa ? "text-danger" : "text-muted"}`}>{splitProblem}</p>
                  ) : (
                    <p className="rounded-xl bg-ok-soft p-3 text-center text-lg font-bold text-green-800">Cash to collect: {formatMoney(splitCash(total, Number(mpesa)))}</p>
                  )}
                </div>
              )}

              <Field label="Table no. (optional)">
                <input className={inputCls} value={table} onChange={(e) => setTable(e.target.value)} />
              </Field>
            </>
          )}

          {unresolved > 0 && (
            <p className="rounded-xl bg-danger-soft p-3 text-center text-sm font-bold text-danger">
              {unresolved} item{unresolved > 1 ? "s" : ""} not matched yet. Tap the right item above to unlock Save.
            </p>
          )}
          <Button disabled={!canSave} onClick={() => void save()}>
            {saving ? "Saving…" : allReady ? `Save order · ${formatMoney(total)}` : "Save order"}
          </Button>
        </Card>
      </div>

      <div className="lg:col-span-5 xl:col-span-4">
        <Card>
          <Title hint={`${groups.length} · ${formatMoney(listTotal)}`}>{shift} shift orders</Title>
          {sales.error && <ErrorBox>{sales.error}</ErrorBox>}
          {groups.length === 0 && <Empty>No orders yet.</Empty>}
          <ul className="divide-y divide-line">
            {groups.map((g) => (
              <OrderRow key={g.key} g={g} canMarkPaid={canMarkPaid} onDelete={() => void remove(g)} onPaid={markPaid} />
            ))}
          </ul>
        </Card>
      </div>
      <Flash msg={msg} />
    </div>
  );
}

function OrderRow({ g, canMarkPaid, onDelete, onPaid }: { g: OrderGroup; canMarkPaid: boolean; onDelete: () => void; onPaid: (g: OrderGroup, how: (typeof PAID_METHODS)[number], mpesa: number) => Promise<void>; }) {
  const [open, setOpen] = useState(false);
  const [how, setHow] = useState<(typeof PAID_METHODS)[number]>("Cash");
  const [mpesa, setMpesa] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = how === "Cash + M-Pesa" ? splitError(g.total, Number(mpesa)) : null;
  const unpaid = g.method === "Unpaid";

  async function confirmPaid() {
    setBusy(true);
    await onPaid(g, how, Number(mpesa));
    setBusy(false);
    setOpen(false);
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {g.rows.map((r) => (
            <div key={r.id} className="truncate font-bold">{r.quantity > 1 ? `${r.quantity} × ` : ""}{r.food_item}</div>
          ))}
          <div className="text-sm text-muted">
            {formatTime(g.createdAt)}{g.table ? ` · Table ${g.table}` : ""}{" "}
            <Badge tone={unpaid ? "red" : "gray"}>{g.method}</Badge>{" "}
            {g.hasOther && <Badge tone="amber">other</Badge>}
          </div>
        </div>
        <div className="font-bold tabular-nums">{formatMoney(g.total)}</div>
        <Button small variant="danger" onClick={onDelete} aria-label="Delete">✕</Button>
      </div>

      {unpaid && canMarkPaid && !open && (
        <div className="mt-2"><Button small onClick={() => setOpen(true)}>Mark paid</Button></div>
      )}
      {unpaid && canMarkPaid && open && (
        <div className="mt-2 grid gap-2 rounded-xl bg-brand-soft p-3">
          <Segmented options={PAID_METHODS} value={how} onChange={(v) => { setHow(v); setMpesa(""); }} cols={3} />
          {how === "Cash + M-Pesa" && (
            <>
              <input className={inputCls} inputMode="decimal" placeholder="M-Pesa amount (KSh)" value={mpesa} onChange={(e) => setMpesa(e.target.value)} />
              <p className={`text-sm font-semibold ${problem && mpesa ? "text-danger" : "text-muted"}`}>
                {problem ?? `Cash to collect: ${formatMoney(splitCash(g.total, Number(mpesa)))}`}
              </p>
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button small variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button small disabled={busy || !!problem} onClick={() => void confirmPaid()}>{busy ? "Saving…" : `Paid ${formatMoney(g.total)}`}</Button>
          </div>
        </div>
      )}
    </li>
  );
}