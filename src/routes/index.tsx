import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  CircleAlert,
  Clock3,
  Crosshair,
  LoaderCircle,
  LogOut,
  Menu,
  NotebookTabs,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { calculateShiftSummary, type SalesGroup } from "@/lib/shift-recorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = "hotel" | "butchery" | "summary";
type Shift = Tables<"hotel_sales">["shift"];
type MenuItem = Tables<"menu_items">;
type HotelSale = Tables<"hotel_sales">;
type ButcherySale = Tables<"butchery_sales">;
type Expense = Tables<"expenses">;

const defaultDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const money = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });
const meatPrices: Record<string, number> = { Beef: 800, Mbuzi: 1200, Pork: 1200 };
const paymentOptions = ["Cash", "M-Pesa", "Cash + M-Pesa", "Unpaid"] as const;
const tabMeta: Record<Tab, { label: string; title: string; subtitle: string }> = {
  hotel: { label: "Hotel", title: "Hotel orders", subtitle: "A quick tap. One more order accounted for." },
  butchery: { label: "Butchery", title: "Butchery sales", subtitle: "Weigh it. Record it. Keep moving." },
  summary: { label: "Summary", title: "Shift summary", subtitle: "A clear picture of every shilling." },
};

function formatMoney(amount: number) {
  return `KSh ${money.format(amount)}`;
}

function formatSaleTime(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "h:mm a");
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label className="text-[0.8rem] font-medium tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function MoneyValue({ value, prominent = false }: { value: number; prominent?: boolean }) {
  return <span className={cn("tabular-nums", prominent && "font-semibold")}>{formatMoney(value)}</span>;
}

function LoadingMark() {
  return <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />;
}

function StatusBadge({ status }: { status: string | null }) {
  const resolved = status ?? "OK";
  const tone =
    resolved === "OK" ? "status-ok" : resolved === "UNPAID" || resolved === "CHECK SPLIT" ? "status-warn" : "status-review";
  return <Badge className={cn("border-0 px-2.5 py-1 text-[0.7rem] font-semibold", tone)}>{resolved}</Badge>;
}

function PaymentSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="Payment method" className="field-control">
        <SelectValue placeholder="Choose payment method" />
      </SelectTrigger>
      <SelectContent>
        {paymentOptions.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DateAndShift({ date, setDate, shift, setShift }: {
  date: Date;
  setDate: (date: Date) => void;
  shift: Shift;
  setShift: (shift: Shift) => void;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="date-trigger" aria-label="Choose shift date">
            <CalendarDays className="size-[1.05rem] shrink-0 text-primary" />
            <span className="min-w-0 truncate">{format(date, "EEE, d MMM")}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selected) => { if (selected) setDate(selected); }}
            initialFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
      <div className="shift-segment" aria-label="Select shift">
        {(["Day", "Night"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant="ghost"
            aria-pressed={shift === option}
            onClick={() => setShift(option)}
            className={cn("shift-choice", shift === option && "shift-choice-active")}
          >
            {option === "Day" ? <Crosshair className="size-3.5" /> : <Clock3 className="size-3.5" />}
            {option}
          </Button>
        ))}
      </div>
    </div>
  );
}

function FilteredMenu({ items, value, onChange }: { items: MenuItem[]; value: MenuItem | null; onChange: (item: MenuItem) => void }) {
  const [open, setOpen] = useState(false);
  const groupedItems = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of items) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [items]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="field-control w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? value.item_name : "Choose a dish"}
          </span>
          <Search className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="pointer-events-auto w-[min(88vw,400px)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search your menu…" />
          <CommandList className="max-h-[min(58svh,390px)]">
            <CommandEmpty>{items.length ? "No dish matches that search." : "Your menu is still loading."}</CommandEmpty>
            {groupedItems.map(([category, grouped]) => (
              <CommandGroup key={category} heading={category}>
                {grouped.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.item_name} ${item.category}`}
                    onSelect={() => { onChange(item); setOpen(false); }}
                    className="min-h-12 justify-between"
                  >
                    <span>{item.item_name}</span>
                    <span className="text-xs text-muted-foreground">{formatMoney(Number(item.selling_price))}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MetricLine({ label, value, variant }: { label: string; value: number; variant?: "muted" | "bold" | "accent" }) {
  return (
    <div className={cn("flex min-h-11 items-center justify-between gap-4 py-2.5", variant === "bold" && "border-t border-border pt-3 font-semibold", variant === "accent" && "summary-accent", variant === "muted" && "text-muted-foreground")}>
      <span className="text-sm">{label}</span>
      <MoneyValue value={value} prominent={variant !== "muted"} />
    </div>
  );
}

function SummaryBlock({ title, icon, totals }: { title: string; icon: ReactNode; totals: SalesGroup }) {
  return (
    <section className="summary-block" aria-label={`${title} totals`}>
      <div className="mb-2 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <MetricLine label="Total sales" value={totals.sales} variant="bold" />
      <MetricLine label="Cash received" value={totals.cash} />
      <MetricLine label="M-Pesa received" value={totals.mpesa} />
      <MetricLine label="Unpaid" value={totals.unpaid} variant={totals.unpaid ? "muted" : undefined} />
    </section>
  );
}

function OrderCard({ sale }: { sale: HotelSale }) {
  return (
    <article className="sale-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="sale-icon sale-icon-hotel"><UtensilsCrossed className="size-[1.05rem]" /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate font-semibold">{sale.food_item}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span>{formatSaleTime(sale.created_at)}</span>
            <span aria-hidden="true">·</span>
            <span>{sale.order_type ?? "Order"}</span>
            {sale.table_no && <><span aria-hidden="true">·</span><span>Table {sale.table_no}</span></>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="font-semibold tabular-nums">{formatMoney(Number(sale.total_cost))}</span>
        <StatusBadge status={sale.check_status} />
      </div>
    </article>
  );
}

function ButcheryCard({ sale }: { sale: ButcherySale }) {
  return (
    <article className="sale-row">
      <div className="flex min-w-0 items-start gap-3">
        <span className="sale-icon sale-icon-butcher"><ShoppingBasket className="size-[1.05rem]" /></span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate font-semibold">{sale.meat_item}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">{Number(sale.quantity_kg).toFixed(2).replace(/\.00$/, "")} kg <span aria-hidden="true">·</span> {formatMoney(Number(sale.price_per_kg))} / kg</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="font-semibold tabular-nums">{formatMoney(Number(sale.cost_kshs))}</span>
        <Badge className="payment-badge">{sale.payment_method}</Badge>
      </div>
    </article>
  );
}

function EmptyState({ kind, error }: { kind: string; error: string | null }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{error ? <CircleAlert className="size-5" /> : <CheckCircle2 className="size-5" />}</span>
      <p className="mt-3 font-semibold">{error ? "Couldn’t load your records" : `No ${kind} yet`}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{error ?? "Orders added to this shift will appear here."}</p>
    </div>
  );
}

function AuthenticationScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [signingUp, setSigningUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = signingUp
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setError(result.error.message); return; }
    if (signingUp && !result.data.session) {
      setError("Check your inbox to confirm your email, then sign in.");
      setSigningUp(false);
      return;
    }
    if (result.data.session) onSignedIn();
  }

  return (
    <main className="auth-screen">
      <div className="auth-art">
        <span className="auth-mark"><Receipt className="size-7" /><span className="auth-mark-dot"><Check className="size-3.5" /></span></span>
        <span className="auth-art-tag"><span className="status-indicator" /> Shift ledger</span>
      </div>
      <div className="auth-body">
        <p className="eyebrow"><ShieldCheck className="size-3.5" /> YOUR SHIFT, ACCOUNTED FOR</p>
        <h1 className="auth-title">Good service.<br /><span>Good records.</span></h1>
        <p className="auth-description">Sign in to keep your restaurant and butchery sales in one place.</p>
        <form className="form-stack mt-7" onSubmit={handleSubmit}>
          <Field label="Email address">
            <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required className="field-control" />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete={signingUp ? "new-password" : "current-password"} placeholder="At least 6 characters" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} required className="field-control" />
          </Field>
          {error && <p role="alert" className="inline-error"><CircleAlert className="size-4 shrink-0" /> {error}</p>}
          <Button className="submit-button mt-1" type="submit" disabled={busy}>
            {busy ? <LoadingMark /> : <ArrowDownToLine className="size-[1.05rem]" />}
            {signingUp ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="auth-switch">{signingUp ? "Already have an account?" : "New to ShiftRecorder?"} <button type="button" onClick={() => { setSigningUp(!signingUp); setError(null); }} className="text-primary underline-offset-4 hover:underline">{signingUp ? "Sign in" : "Create an account"}</button></p>
        <p className="auth-footnote"><ShieldCheck className="size-3.5" /> Your shift records are private to your team.</p>
      </div>
    </main>
  );
}

function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("hotel");
  const [dateString, setDateString] = useState(defaultDate);
  const [shift, setShift] = useState<Shift>("Day");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [hotelSales, setHotelSales] = useState<HotelSale[]>([]);
  const [butcherySales, setButcherySales] = useState<ButcherySale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [savingHotel, setSavingHotel] = useState(false);
  const [savingMeat, setSavingMeat] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState<MenuItem | null>(null);
  const [orderType, setOrderType] = useState("Dine In");
  const [hotelAmount, setHotelAmount] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [mpesaPart, setMpesaPart] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [meatItem, setMeatItem] = useState("");
  const [meatQuantity, setMeatQuantity] = useState("");
  const [meatPrice, setMeatPrice] = useState("");
  const [meatTotal, setMeatTotal] = useState("");
  const [meatPayment, setMeatPayment] = useState("Cash");

  const date = useMemo(() => new Date(`${dateString}T12:00:00`), [dateString]);
  const dateLabel = format(date, "EEEE, d MMMM yyyy");
  const meta = tabMeta[activeTab];
  const hotelCashAmount = Number(hotelAmount) || 0;
  const mpesaAmount = Number(mpesaPart) || 0;
  const mpesaError = payment === "Cash + M-Pesa" && (mpesaAmount <= 0 || mpesaAmount >= hotelCashAmount);
  const calculatedMeatAmount = Number(meatQuantity) * Number(meatPrice);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const [{ data }, { data: subscription }] = await Promise.all([
        supabase.auth.getSession(),
        Promise.resolve({ data: null as unknown as { subscription: { unsubscribe: () => void } } | null }),
      ]);
      if (disposed) return;
      setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null);
      setAuthResolved(true);
      void subscription?.subscription.unsubscribe();
    })();
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
      setAuthResolved(true);
    });
    return () => { disposed = true; authSubscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("shift-recorder-shift");
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed !== null && typeof parsed === "object") {
          const preferences = parsed as { date?: string; shift?: Shift; tab?: Tab };
          if (preferences.date && /^\d{4}-\d{2}-\d{2}$/.test(preferences.date)) setDateString(preferences.date);
          if (preferences.shift === "Day" || preferences.shift === "Night") setShift(preferences.shift);
          if (preferences.tab === "hotel" || preferences.tab === "butchery" || preferences.tab === "summary") setActiveTab(preferences.tab);
        }
      }
    } catch {
      // Malformed local preferences should never prevent recording the shift.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("shift-recorder-shift", JSON.stringify({ date: dateString, shift, tab: activeTab }));
  }, [activeTab, dateString, hydrated, shift]);

  const fetchShiftData = useCallback(async (showLoader: boolean) => {
    if (!user) return;
    if (showLoader) setDataLoading(true);
    const [menuResult, hotelResult, meatResult, expenseResult] = await Promise.all([
      supabase.from("menu_items").select("*").order("category").order("item_name"),
      supabase.from("hotel_sales").select("*").eq("sale_date", dateString).eq("shift", shift).order("created_at", { ascending: false }),
      supabase.from("butchery_sales").select("*").eq("sale_date", dateString).eq("shift", shift).order("created_at", { ascending: false }),
      supabase.from("expenses").select("*").eq("expense_date", dateString).eq("shift", shift),
    ]);
    if (menuResult.error || hotelResult.error || meatResult.error || expenseResult.error) {
      setDataError("Check your connection, then pull down or change shifts to try again.");
    } else {
      setDataError(null);
      setMenuItems(menuResult.data ?? []);
      setHotelSales(hotelResult.data ?? []);
      setButcherySales(meatResult.data ?? []);
      setExpenses(expenseResult.data ?? []);
    }
    if (showLoader) setDataLoading(false);
  }, [dateString, shift, user]);

  useEffect(() => {
    if (!user) return;
    void fetchShiftData(true);
    const refresh = () => {
      if (document.visibilityState === "visible") void fetchShiftData(false);
    };
    const timer = window.setInterval(refresh, 25_000);
    window.addEventListener("focus", refresh);
    const channels = [
      supabase.channel(`shift-recorder-hotel-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "hotel_sales", filter: `sale_date=eq.${dateString}` }, refresh).subscribe(),
      supabase.channel(`shift-recorder-meat-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "butchery_sales", filter: `sale_date=eq.${dateString}` }, refresh).subscribe(),
      supabase.channel(`shift-recorder-expenses-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `expense_date=eq.${dateString}` }, refresh).subscribe(),
    ];
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      channels.forEach((channel) => { void supabase.removeChannel(channel); });
    };
  }, [dateString, fetchShiftData, shift, user]);

  const shiftSummary = useMemo(() => calculateShiftSummary(hotelSales, butcherySales, expenses), [hotelSales, butcherySales, expenses]);

  function changeDate(next: Date) {
    setDateString(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
  }

  async function handleHotelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedMenuItem) { toast.error("Choose a dish from your menu first."); return; }
    if (hotelCashAmount <= 0 || !Number.isFinite(hotelCashAmount)) { toast.error("Enter an amount greater than zero."); return; }
    if (payment === "Cash + M-Pesa" && mpesaError) { toast.error("The M-Pesa part must be greater than zero and less than the order total."); return; }
    setSavingHotel(true);
    const amountReceivedCash = payment === "Cash" ? hotelCashAmount : payment === "Cash + M-Pesa" ? hotelCashAmount - mpesaAmount : 0;
    const amountReceivedMpesa = payment === "M-Pesa" ? hotelCashAmount : payment === "Cash + M-Pesa" ? mpesaAmount : 0;
    const { error } = await supabase.from("hotel_sales").insert({
      sale_date: dateString,
      shift,
      food_item: selectedMenuItem.item_name,
      order_type: orderType,
      total_cost: hotelCashAmount,
      payment_method: payment,
      mpesa_part: payment === "Cash + M-Pesa" ? mpesaAmount : 0,
      cash_received: amountReceivedCash,
      mpesa_received: amountReceivedMpesa,
      table_no: tableNumber.trim() || null,
      notes: orderNotes.trim() || null,
    });
    setSavingHotel(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selectedMenuItem.item_name} added to ${shift.toLowerCase()} shift.`);
    setSelectedMenuItem(null);
    setHotelAmount("");
    setPayment("Cash");
    setMpesaPart("");
    setTableNumber("");
    setOrderNotes("");
    void fetchShiftData(false);
  }

  async function handleMeatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(meatQuantity);
    const pricePerKg = Number(meatPrice);
    const amount = Number(meatTotal);
    if (!meatItem) { toast.error("Choose a meat first."); return; }
    if (quantity <= 0 || pricePerKg <= 0 || amount <= 0 || ![quantity, pricePerKg, amount].every(Number.isFinite)) {
      toast.error("Quantity, price, and total must all be greater than zero.");
      return;
    }
    setSavingMeat(true);
    const { error } = await supabase.from("butchery_sales").insert({
      sale_date: dateString,
      shift,
      meat_item: meatItem,
      quantity_kg: quantity,
      cost_kshs: amount,
      price_per_kg: pricePerKg,
      payment_method: meatPayment,
    });
    setSavingMeat(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${meatItem} sale added to ${shift.toLowerCase()} shift.`);
    setMeatItem("");
    setMeatQuantity("");
    setMeatPrice("");
    setMeatTotal("");
    setMeatPayment("Cash");
    void fetchShiftData(false);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.success("You’re safely signed out.");
  }

  if (!authResolved) {
    return <main className="loading-screen"><span className="loading-brand"><Receipt className="size-6" /></span><LoadingMark /><span className="text-sm text-muted-foreground">Opening your shift book…</span></main>;
  }

  if (!user) return <AuthenticationScreen onSignedIn={() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) setUser({ id: data.user.id, email: data.user.email }); }); }} />;

  const tabs: { id: Tab; name: string; icon: ReactNode }[] = [
    { id: "hotel", name: "Hotel", icon: <UtensilsCrossed className="size-[1.2rem]" /> },
    { id: "butchery", name: "Butchery", icon: <ShoppingBasket className="size-[1.2rem]" /> },
    { id: "summary", name: "Summary", icon: <NotebookTabs className="size-[1.2rem]" /> },
  ];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="app-width topbar-inner">
          <div className="brand-mark" aria-label="ShiftRecorder"><Receipt className="size-[1.2rem]" /><span className="brand-tick"><Check className="size-2.5" /></span></div>
          <div className="brand-lockup"><span className="brand-name">shift<span>recorder</span></span><span className="brand-caption">THE DAILY LEDGER</span></div>
          <div className="topbar-meta"><span className="signed-user"><ShieldCheck className="size-3.5" /> <span className="max-w-[150px] truncate">{user.email?.split("@")[0] ?? "Signed in"}</span></span><Button variant="ghost" size="icon" className="signout-button" onClick={() => void handleSignOut()} title="Sign out" aria-label="Sign out"><LogOut className="size-4" /></Button></div>
        </div>
      </header>

      <div className="app-width">
        <section className="shift-bar" aria-label="Selected work shift">
          <DateAndShift date={date} setDate={changeDate} shift={shift} setShift={setShift} />
          <div className="shift-bar-date"><span className="status-indicator" /> {shift} shift · {format(date, "d MMM")}</div>
        </section>

        <div className="page-heading">
          <div className="min-w-0">
            <p className="eyebrow">{format(date, "EEEE, d MMMM yyyy")} <span className="eyebrow-divider">/</span> {shift} shift</p>
            <h1 className="page-title">{meta.title}<span className="title-period">.</span></h1>
            <p className="page-subtitle">{meta.subtitle}</p>
          </div>
          {activeTab !== "summary" && <span className="record-count"><span className="status-indicator" /> {activeTab === "hotel" ? hotelSales.length : butcherySales.length} recorded</span>}
        </div>

        <nav className="tab-strip" aria-label="Shift records">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Button key={tab.id} variant="ghost" className={cn("tab-button", active && "tab-button-active")} onClick={() => setActiveTab(tab.id)} aria-current={active ? "page" : undefined}>
                {tab.icon}<span>{tab.name}</span>{active && <span className="tab-indicator" />}
              </Button>
            );
          })}
        </nav>

        <section className="content-grid" key={activeTab}>
          {activeTab === "hotel" && <>
            <form onSubmit={handleHotelSubmit} className="entry-form">
              <div className="form-heading"><span className="form-icon hotel-form-icon"><ChefHat className="size-[1.15rem]" /></span><div><h2 className="section-title">New order</h2><p className="section-caption">Quick entry · fields marked optional can be skipped</p></div></div>
              <div className="form-stack">
                <Field label="FOOD ITEM"><FilteredMenu items={menuItems} value={selectedMenuItem} onChange={(item) => { setSelectedMenuItem(item); setHotelAmount(String(item.selling_price)); }} /></Field>
                {menuItems.length === 0 && !dataLoading && <p className="field-caption">Your saved menu appears here after it loads.</p>}
                <div className="form-row">
                  <Field label="ORDER TYPE">
                    <Select value={orderType} onValueChange={setOrderType}>
                      <SelectTrigger className="field-control"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Dine In">Dine In</SelectItem><SelectItem value="Take Away">Take Away</SelectItem><SelectItem value="Internal">Internal</SelectItem></SelectContent>
                    </Select>
                  </Field>
                  <Field label="TOTAL · KSH">
                    <Input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="0.00" aria-label="Order total in KSh" value={hotelAmount} onChange={(event) => setHotelAmount(event.target.value)} required className="field-control tabular-nums" />
                  </Field>
                </div>
                <Field label="PAYMENT METHOD"><PaymentSelect value={payment} onChange={(value) => { setPayment(value); setMpesaPart(""); }} /></Field>
                {payment === "Cash + M-Pesa" && <div className="split-panel">
                  <Field label="M-PESA · KSH">
                    <Input type="number" inputMode="decimal" step="0.01" min="0.01" max={hotelCashAmount ? Math.max(0.01, hotelCashAmount - 0.01) : undefined} placeholder="M-Pesa amount" aria-label="M-Pesa amount in KSh" value={mpesaPart} onChange={(event) => setMpesaPart(event.target.value)} required className="field-control tabular-nums" />
                  </Field>
                  <div className="cash-remainder"><ArrowLeftRight className="size-4" /><div className="min-w-0"><span className="cash-caption">CASH RECEIVED</span><span className="cash-amount"><MoneyValue value={Math.max(0, hotelCashAmount - mpesaAmount)} prominent /></span></div></div>
                  {mpesaError && <p role="alert" className="inline-error split-error"><CircleAlert className="size-4 shrink-0" /> M-Pesa must be less than the order total.</p>}
                </div>}
                <div className="form-row">
                  <Field label="TABLE NO. · OPTIONAL"><Input placeholder="e.g. 4" value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} className="field-control" /></Field>
                  <Field label="NOTES · OPTIONAL"><Input placeholder="Add a note…" value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} className="field-control" /></Field>
                </div>
              </div>
              <Button type="submit" className="submit-button" disabled={savingHotel || dataLoading || mpesaError}>
                {savingHotel ? <LoadingMark /> : <Check className="size-[1.1rem]" />}
                {savingHotel ? "Saving order…" : "Record order"}
                {!savingHotel && <span className="submit-price">{hotelCashAmount > 0 ? formatMoney(hotelCashAmount) : ""}</span>}
              </Button>
              {dataError && <p role="alert" className="inline-error mt-3"><CircleAlert className="size-4 shrink-0" /> {dataError}</p>}
            </form>
            <section className="activity-feed" aria-label="Hotel orders for selected shift">
              <div className="list-heading"><div><p className="eyebrow">THE RUNNING LIST</p><h2 className="section-title">Today’s orders</h2></div><Badge className="count-badge">{hotelSales.length}</Badge></div>
              {dataLoading ? <div className="loading-list"><LoadingMark /> Fetching the shift book…</div> : hotelSales.length ? <div className="sale-list">{hotelSales.map((sale) => <OrderCard key={sale.id} sale={sale} />)}</div> : <EmptyState kind="hotel orders" error={dataError} />}
              {hotelSales.length > 0 && <div className="list-total"><span>Shift total</span><MoneyValue value={shiftSummary.hotel.sales} prominent /></div>}
            </section>
          </>}

          {activeTab === "butchery" && <>
            <form onSubmit={handleMeatSubmit} className="entry-form">
              <div className="form-heading"><span className="form-icon butcher-form-icon"><ShoppingBasket className="size-[1.15rem]" /></span><div><h2 className="section-title">New meat sale</h2><p className="section-caption">Weight and price calculate as you go</p></div></div>
              <div className="form-stack">
                <Field label="MEAT ITEM">
                  <Select value={meatItem} onValueChange={(value) => { setMeatItem(value); setMeatPrice(String(meatPrices[value])); setMeatTotal(""); }}>
                    <SelectTrigger className="field-control"><SelectValue placeholder="Choose a meat" /></SelectTrigger>
                    <SelectContent>{Object.keys(meatPrices).map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <div className="form-row">
                  <Field label="QUANTITY · KG"><Input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" aria-label="Quantity in kilograms" value={meatQuantity} onChange={(event) => { setMeatQuantity(event.target.value); setMeatTotal(""); }} required className="field-control tabular-nums" /></Field>
                  <Field label="PRICE · KSH / KG"><Input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="800" aria-label="Price per kilogram in KSh" value={meatPrice} onChange={(event) => { setMeatPrice(event.target.value); setMeatTotal(""); }} required className="field-control tabular-nums" /></Field>
                </div>
                <Field label="TOTAL · KSH">
                  <div className="computed-total"><span className="computed-equals">=</span><Input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder={calculatedMeatAmount > 0 ? money.format(calculatedMeatAmount) : "Calculated from weight"} aria-label="Sale total in KSh" value={meatTotal || (calculatedMeatAmount > 0 ? money.format(calculatedMeatAmount) : "")} onChange={(event) => setMeatTotal(event.target.value)} required className="computed-input field-control tabular-nums" /><span className="computed-auto">EDITABLE</span></div>
                  <span className="field-caption">Based on weight × price per kilogram.</span>
                </Field>
                <Field label="PAYMENT METHOD"><PaymentSelect value={meatPayment} onChange={setMeatPayment} /></Field>
              </div>
              <Button type="submit" className="submit-button" disabled={savingMeat || dataLoading}>
                {savingMeat ? <LoadingMark /> : <Check className="size-[1.1rem]" />}
                {savingMeat ? "Saving sale…" : "Record sale"}
                {!savingMeat && <span className="submit-price">{Number(meatTotal || calculatedMeatAmount) > 0 ? formatMoney(Number(meatTotal || calculatedMeatAmount)) : ""}</span>}
              </Button>
              {dataError && <p role="alert" className="inline-error mt-3"><CircleAlert className="size-4 shrink-0" /> {dataError}</p>}
            </form>
            <section className="activity-feed" aria-label="Butchery sales for selected shift">
              <div className="list-heading"><div><p className="eyebrow">THE RUNNING LIST</p><h2 className="section-title">Today’s sales</h2></div><Badge className="count-badge">{butcherySales.length}</Badge></div>
              {dataLoading ? <div className="loading-list"><LoadingMark /> Fetching the shift book…</div> : butcherySales.length ? <div className="sale-list">{butcherySales.map((sale) => <ButcheryCard key={sale.id} sale={sale} />)}</div> : <EmptyState kind="butchery sales" error={dataError} />}
              {butcherySales.length > 0 && <div className="list-total"><span>Shift total</span><MoneyValue value={shiftSummary.butchery.sales} prominent /></div>}
            </section>
          </>}

          {activeTab === "summary" && <div className="summary-layout">
            <div className="summary-topline"><div><p className="eyebrow">{dateLabel}</p><h2 className="section-title">The full picture</h2></div><span className="shift-chip"><Clock3 className="size-3.5" /> {shift} shift</span></div>
            {shiftSummary.discrepancy && <section role="alert" className="warning-card"><span className="warning-icon"><CircleAlert className="size-[1.2rem]" /></span><div><h3>DISCREPANCY FOUND: Check splits</h3><p>Sales don’t match collected cash, M-Pesa, and unpaid amounts. Review this shift.</p></div></section>}
            {dataError && <p role="alert" className="inline-error"><CircleAlert className="size-4 shrink-0" /> {dataError}</p>}
            <div className="summary-columns">
              <SummaryBlock title="Hotel sales" icon={<UtensilsCrossed className="size-4" />} totals={shiftSummary.hotel} />
              <SummaryBlock title="Butchery sales" icon={<ShoppingBasket className="size-4" />} totals={shiftSummary.butchery} />
            </div>
            <section className="handover-block">
              <div className="handover-header"><span className="handover-icon"><Wallet className="size-5" /></span><div><p className="eyebrow">SHIFT HANDOVER</p><h3 className="handover-title">Cash to hand over</h3></div></div>
              <div className="handover-amount"><span>KSh</span>{money.format(shiftSummary.cashToHandOver)}</div>
              <div className="handover-math"><span>Hotel cash</span><MoneyValue value={shiftSummary.hotel.cash} /><span className="operator">+</span><span>Butchery cash</span><MoneyValue value={shiftSummary.butchery.cash} /><span className="operator">−</span><span>Cash expenses</span><MoneyValue value={shiftSummary.expensesCash} /></div>
            </section>
            <section className="owner-total">
              <span className="owner-icon"><ArrowLeftRight className="size-[1.15rem]" /></span>
              <div className="owner-copy"><p className="eyebrow">ALL COUNTERS · {shift.toUpperCase()} SHIFT</p><h3>Owner’s total sales</h3></div>
              <div className="owner-values"><strong>{formatMoney(shiftSummary.ownerSales)}</strong><span><ArrowDownToLine className="size-3.5" /> {formatMoney(shiftSummary.ownerMpesa)} M-Pesa</span></div>
            </section>
            {dataLoading && <div className="loading-list summary-refresh"><LoadingMark /> Updating shift totals…</div>}
            <p className="summary-note"><ShieldCheck className="size-3.5" /> Totals update automatically when new sales are recorded.</p>
          </div>}
        </section>

        <footer className="page-footer"><span className="footer-mark"><Receipt className="size-3.5" /><Check className="size-2" /></span><span>Every shilling, accounted for.</span><span className="footer-separator">·</span><span>{shift} shift book</span></footer>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return <Button key={tab.id} variant="ghost" aria-current={selected ? "page" : undefined} className={cn("bottom-tab", selected && "bottom-tab-active")} onClick={() => setActiveTab(tab.id)}>{tab.icon}<span>{tab.name}</span></Button>;
        })}
      </nav>
    </main>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShiftRecorder — Hotel, butchery & shift ledger" },
      { name: "description", content: "Record hotel orders and butchery sales, see live cash handover totals, and keep every shift in view with ShiftRecorder." },
      { property: "og:title", content: "ShiftRecorder — Hotel, butchery & shift ledger" },
      { property: "og:description", content: "Record restaurant and butchery sales and see your shift totals at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});