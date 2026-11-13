// A handful of big, mobile-friendly building blocks. Plain Tailwind, no UI library.
import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export const inputCls =
  "h-14 w-full rounded-xl border-2 border-line bg-white px-4 text-lg outline-none focus:border-brand disabled:opacity-60";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Title({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-xl font-bold">{children}</h2>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </div>
  );
}

export function Field({ label, children, group = false }: { label: string; children: ReactNode; group?: boolean }) {
  const inner = (
    <>
      <span className="mb-1 block text-sm font-semibold text-muted">{label}</span>
      {children}
    </>
  );
  return group ? <div className="block">{inner}</div> : <label className="block">{inner}</label>;
}

type Variant = "primary" | "outline" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white active:opacity-80 disabled:bg-line disabled:text-muted",
  outline: "border-2 border-brand text-brand bg-white active:bg-brand-soft",
  danger: "border-2 border-danger text-danger bg-white active:bg-danger-soft",
  ghost: "text-muted active:bg-brand-soft",
};

export function Button({
  variant = "primary", small = false, className = "", ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  const size = small ? "h-10 px-3 text-sm" : "h-14 px-5 text-lg w-full";
  return <button type="button" {...props} className={`rounded-xl font-bold ${size} ${variants[variant]} ${className}`} />;
}

/** A row of big choice buttons (payment method, Day/Night, tabs...). */
export function Segmented<T extends string>({
  options, value, onChange, cols,
}: { options: readonly T[]; value: T; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o} type="button" onClick={() => onChange(o)}
          className={`min-h-14 rounded-xl border-2 px-2 text-base font-bold ${
            o === value ? "border-brand bg-brand text-white" : "border-line bg-white text-ink active:bg-brand-soft"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

const tones = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-ok-soft text-green-800",
  red: "bg-danger-soft text-danger",
  amber: "bg-warn-soft text-amber-800",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-muted">{children}</p>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return <div className="mb-3 rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{children}</div>;
}

/** Small pop-up message at the bottom of the screen ("Saved", errors...). */
export function useFlash() {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  function flash(text: string, error = false) {
    window.clearTimeout(timer.current);
    setMsg({ text, error });
    timer.current = window.setTimeout(() => setMsg(null), error ? 6000 : 3000);
  }
  return { msg, flash };
}

export function Flash({ msg }: { msg: { text: string; error: boolean } | null }) {
  if (!msg) return null;
  return (
    <div
      role="status"
      className={`fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-xl p-4 text-center font-bold text-white shadow-lg ${
        msg.error ? "bg-danger" : "bg-brand"
      }`}
    >
      {msg.text}
    </div>
  );
}

/** One line of a summary: label on the left, amount on the right. */
export function StatRow({ label, value, big = false, note }: { label: string; value: string; big?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-2 ${big ? "text-2xl font-extrabold" : "text-lg"}`}>
      <div>
        <div className={big ? "" : "font-medium"}>{label}</div>
        {note && <div className="text-xs font-normal text-muted">{note}</div>}
      </div>
      <div className="tabular-nums font-bold">{value}</div>
    </div>
  );
}
