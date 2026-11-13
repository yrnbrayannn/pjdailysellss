import { useState } from "react";
import { receiptUrl, uploadReceipt } from "../lib/api";
import { Button } from "./ui";

/** "Add receipt photo" button. Calls onChange with the stored file path (or null). */
export function ReceiptUpload({ path, onChange }: { path: string | null; onChange: (path: string | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadReceipt(file));
      setPreview(URL.createObjectURL(file));
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  if (path) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-ok-soft p-3">
        {preview && <img src={preview} alt="Receipt" className="h-16 w-16 rounded-lg object-cover" />}
        <span className="flex-1 font-semibold text-green-800">Receipt photo attached ✓</span>
        <Button small variant="ghost" onClick={() => { onChange(null); setPreview(null); }}>Remove</Button>
      </div>
    );
  }
  return (
    <div>
      <label className="flex h-14 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-brand text-lg font-bold text-brand active:bg-brand-soft">
        {busy ? "Uploading…" : "📷 Add receipt photo"}
        <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      {error && <p className="mt-1 text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}

/** "View receipt" link for a saved path (opens a short-lived private link). */
export function ReceiptLink({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!path) return null;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-2 block">
        <img src={url} alt="Receipt" className="max-h-72 rounded-lg border border-line" />
      </a>
    );
  }
  return (
    <>
      <button
        type="button" className="mt-1 text-sm font-bold text-brand underline"
        onClick={() => { receiptUrl(path).then(setUrl).catch((e: Error) => setError(e.message)); }}
      >
        📎 View receipt
      </button>
      {error && <span className="ml-2 text-xs text-danger">{error}</span>}
    </>
  );
}
