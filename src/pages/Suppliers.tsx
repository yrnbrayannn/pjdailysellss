// Admin: a basic supplier directory.
import { useEffect, useState } from "react";
import { deleteRow, getAll, insertRow, updateRows } from "../lib/api";
import type { Supplier } from "../lib/types";
import { Button, Card, Empty, ErrorBox, Field, Flash, Title, inputCls, useFlash } from "../components/ui";

export default function Suppliers() {
  const { msg, flash } = useFlash();
  const [list, setList] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [products, setProducts] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAll<Supplier>("suppliers", "name").then((r) => { setList(r); setError(null); }).catch((e: Error) => setError(e.message));
  }, [tick]);

  function reset() { setEditing(null); setName(""); setPhone(""); setProducts(""); }

  async function save() {
    setSaving(true);
    const row = { name: name.trim(), phone: phone.trim() || null, products: products.trim() || null };
    try {
      if (editing) await updateRows("suppliers", [editing], row);
      else await insertRow("suppliers", row);
      flash(editing ? "Supplier updated" : "Supplier added");
      reset();
      setTick((t) => t + 1);
    } catch (e) { flash((e as Error).message, true); }
    setSaving(false);
  }

  async function remove(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    try { await deleteRow("suppliers", s.id); setTick((t) => t + 1); }
    catch (e) { flash((e as Error).message, true); }
  }

  return (
    <div className="grid gap-4">
      <Card className="grid gap-4">
        <Title>{editing ? "Edit supplier" : "Add supplier"}</Title>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Supplies (optional)"><input className={inputCls} placeholder="e.g. Vegetables, Soda, Meat" value={products} onChange={(e) => setProducts(e.target.value)} /></Field>
        <Button disabled={name.trim() === "" || saving} onClick={() => void save()}>{saving ? "Saving…" : editing ? "Update supplier" : "Add supplier"}</Button>
        {editing && <Button variant="ghost" onClick={reset}>Cancel</Button>}
      </Card>

      <Card>
        <Title hint={`${list.length}`}>Suppliers</Title>
        {error && <ErrorBox>{error}</ErrorBox>}
        {list.length === 0 && <Empty>No suppliers yet.</Empty>}
        <ul className="divide-y divide-line">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{s.name}</div>
                <div className="truncate text-sm text-muted">
                  {s.phone && <a className="font-semibold text-brand underline" href={`tel:${s.phone}`}>{s.phone}</a>}
                  {s.phone && s.products ? " · " : ""}{s.products}
                </div>
              </div>
              <Button small variant="outline" onClick={() => { setEditing(s.id); setName(s.name); setPhone(s.phone ?? ""); setProducts(s.products ?? ""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</Button>
              <Button small variant="danger" onClick={() => void remove(s)} aria-label="Delete">✕</Button>
            </li>
          ))}
        </ul>
      </Card>
      <Flash msg={msg} />
    </div>
  );
}
