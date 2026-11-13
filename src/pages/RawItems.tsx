// Admin: raw materials kept in the Store and the Butchery (they appear on the stock sheets).
import { useState } from "react";
import { deleteRow, formatMoney, insertRow, rawPrice, updateRows } from "../lib/api";
import { useRawItems } from "../lib/useApp";
import type { RawItem, Section } from "../lib/types";
import { Button, Card, Empty, ErrorBox, Field, Flash, Segmented, Title, inputCls, useFlash } from "../components/ui";

const SECTIONS = ["Store", "Butchery"] as const;
const UNITS = ["kg", "litre", "piece", "packet", "bag", "tray", "bottle"];

export default function RawItems() {
  const raw = useRawItems();
  const { msg, flash } = useFlash();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Store");
  const [unit, setUnit] = useState("kg");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() !== "" && unit.trim() !== "" && !saving;

  function reset() { setEditing(null); setName(""); setSection("Store"); setUnit("kg"); setPrice(""); }

  function edit(r: RawItem) {
    setEditing(r.id); setName(r.item_name); setSection(r.section === "Butchery" ? "Butchery" : "Store");
    setUnit(r.unit_type); setPrice(rawPrice(r, raw.priceKey) ? String(rawPrice(r, raw.priceKey)) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    const row: Record<string, unknown> = { item_name: name.trim(), section, unit_type: unit.trim() };
    if (raw.priceKey && price !== "") row[raw.priceKey] = Number(price);
    if (!editing) row.sort_order = Math.max(0, ...raw.items.map((r) => r.sort_order ?? 0)) + 1;
    try {
      if (editing) await updateRows("raw_items", [editing], row);
      else await insertRow("raw_items", row);
      flash(editing ? "Item updated" : "Item added");
      reset();
      raw.reload();
    } catch (e) { flash((e as Error).message, true); }
    setSaving(false);
  }

  async function remove(r: RawItem) {
    if (!confirm(`Delete "${r.item_name}"? Past stock counts keep their data.`)) return;
    try { await deleteRow("raw_items", r.id); raw.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  const bySection = (s: Section) => raw.items.filter((r) => r.section === s);

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>{editing ? "Edit raw item" : "Add raw item"}</Title>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Section" group><Segmented options={SECTIONS} value={section} onChange={setSection} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit">
            <input className={inputCls} list="raw-units" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="raw-units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
          {raw.priceKey ? (
            <Field label="List price per unit (KSh)"><input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          ) : (
            <p className="self-end pb-2 text-xs text-muted">Price column not found in raw_items yet, so prices are hidden.</p>
          )}
        </div>
        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : editing ? "Update item" : "Add item"}</Button>
        {editing && <Button variant="ghost" onClick={reset}>Cancel</Button>}
      </Card>

      {raw.error && <ErrorBox>{raw.error}</ErrorBox>}
      {SECTIONS.map((s) => (
        <Card key={s}>
          <Title hint={`${bySection(s).length} items`}>{s}</Title>
          {bySection(s).length === 0 && <Empty>Nothing here yet.</Empty>}
          <ul className="divide-y divide-line">
            {bySection(s).map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{r.item_name}</div>
                  <div className="text-sm text-muted">{r.unit_type}{rawPrice(r, raw.priceKey) > 0 ? ` · ${formatMoney(rawPrice(r, raw.priceKey))} per ${r.unit_type}` : ""}</div>
                </div>
                <Button small variant="outline" onClick={() => edit(r)}>Edit</Button>
                <Button small variant="danger" onClick={() => void remove(r)} aria-label="Delete">✕</Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Flash msg={msg} />
    </div>
  );
}
