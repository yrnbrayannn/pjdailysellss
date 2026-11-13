// The ONE place that talks to Supabase. Pages call these small helpers (or supabase directly).
import { createClient } from "@supabase/supabase-js";
import type { Shift } from "./types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.");
}
export const supabase = createClient(url, key);

// ---------- database helpers ----------
export async function getByShift<T>(table: string, dateCol: string, date: string, shift: Shift): Promise<T[]> {
  const { data, error } = await supabase
    .from(table).select("*").eq(dateCol, date).eq("shift", shift)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function getAll<T>(table: string, orderBy: string, ascending = true): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export async function insertRow(table: string, row: object) {
  const { error } = await supabase.from(table).insert(row);
  if (error) throw new Error(error.message);
}

export async function updateRows(table: string, ids: string[], patch: object) {
  const { error } = await supabase.from(table).update(patch).in("id", ids);
  if (error) throw new Error(error.message);
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- receipt photos (Supabase Storage, private bucket "receipts") ----------
async function shrink(file: File): Promise<Blob> {
  // Phone photos are huge; scale to 1600px JPEG so uploads are quick on mobile data.
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((ok, fail) =>
      canvas.toBlob((b) => (b ? ok(b) : fail(new Error("no blob"))), "image/jpeg", 0.8),
    );
  } catch {
    return file; // fall back to the original
  }
}

/** Uploads a photo and returns its storage path (save this path in the row). */
export async function uploadReceipt(file: File): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error("Please sign in again.");
  const blob = await shrink(file);
  const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, blob, { contentType: blob.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

export async function receiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
  if (error || !data) throw new Error(error?.message ?? "Could not open receipt");
  return data.signedUrl;
}

// ---------- small formatting helpers ----------
export function localDate(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return localDate(new Date(y, m - 1, d + days));
}

export function guessShift(): Shift {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? "Day" : "Night";
}

export function formatMoney(n: number): string {
  return "KSh " + (Number(n) || 0).toLocaleString("en-KE", { maximumFractionDigits: 2 });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
}
