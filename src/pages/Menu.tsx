// Admin: add / edit / delete menu items.
import { useState } from "react";
import { deleteRow, formatMoney, insertRow, updateRows } from "../lib/api";
import { useMenu } from "../lib/useApp";
import type { MenuItem } from "../lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Field, Flash, Title, inputCls, useFlash } from "../components/ui";

const UNITS = ["plate", "portion", "bottle", "can", "cup", "glass", "piece", "kg", "litre", "packet"];

export default function Menu() {
  const menu = useMenu();
  const { msg, flash } = useFlash();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("plate");
  const [track, setTrack] = useState(true);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() !== "" && category.trim() !== "" && Number(price) >= 0 && price !== "" && !saving;
  const categories = [...new Set(menu.items.map((i) => i.category))];

  function reset() { setEditing(null); setName(""); setCategory(""); setPrice(""); setUnit("plate"); setTrack(true); }

  function edit(i: MenuItem) {
    setEditing(i.id); setName(i.item_name); setCategory(i.category);
    setPrice(String(i.selling_price)); setUnit(i.unit_type ?? ""); setTrack(i.track_stock);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    const row = { item_name: name.trim(), category: category.trim(), selling_price: Number(price), unit_type: unit.trim() || null, track_stock: track };
    try {
      if (editing) await updateRows("menu_items", [editing], row);
      else await insertRow("menu_items", row);
      flash(editing ? "Item updated" : "Item added");
      reset();
      menu.reload();
    } catch (e) { flash((e as Error).message, true); }
    setSaving(false);
  }

  async function remove(i: MenuItem) {
    if (!confirm(`Delete "${i.item_name}" from the menu?`)) return;
    try { await deleteRow("menu_items", i.id); menu.reload(); }
    catch (e) { flash((e as Error).message, true); }
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>{editing ? "Edit item" : "Add menu item"}</Title>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Category">
          <input className={inputCls} list="cats" placeholder="e.g. Food, Drinks" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (KSh)"><input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
          <Field label="Unit type">
            <input className={inputCls} list="units" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="units">{UNITS.map((u) => <option key={u} value={u} />)}</datalist>
          </Field>
        </div>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border-2 border-line px-4">
          <input type="checkbox" className="h-6 w-6" checked={track} onChange={(e) => setTrack(e.target.checked)} />
          <span className="font-semibold">Count in stock (shows on the Stock Count)</span>
        </label>
        <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Saving…" : editing ? "Update item" : "Add item"}</Button>
        {editing && <Button variant="ghost" onClick={reset}>Cancel</Button>}
      </Card>

      <Card>
        <Title hint={`${menu.items.length} items`}>Menu</Title>
        {menu.error && <ErrorBox>{menu.error}</ErrorBox>}
        {menu.items.length === 0 && <Empty>No items yet. Add your first one above.</Empty>}
        <ul className="divide-y divide-line">
          {menu.items.map((i) => (
            <li key={i.id} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{i.item_name}</div>
                <div className="text-sm text-muted">{i.category} · {formatMoney(i.selling_price)}{i.unit_type ? ` / ${i.unit_type}` : ""} {i.track_stock && <Badge tone="green">stock</Badge>}</div>
              </div>
              <Button small variant="outline" onClick={() => edit(i)}>Edit</Button>
              <Button small variant="danger" onClick={() => void remove(i)} aria-label="Delete">✕</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
