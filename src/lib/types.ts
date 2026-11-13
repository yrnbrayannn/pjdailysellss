export type Shift = "Day" | "Night";
export type Role = "admin" | "staff";
export type Payment = "Cash" | "M-Pesa" | "Cash + M-Pesa" | "Unpaid";

export interface MenuItem {
  id: string;
  item_name: string;
  category: string;
  selling_price: number;
  unit_type: string | null;
  track_stock: boolean;
}
export interface HotelSale {
  id: string;
  sale_date: string;
  shift: Shift;
  food_item: string;
  quantity: number;
  unit_price: number | null;
  total_cost: number;
  payment_method: string;
  mpesa_part: number | null;
  cash_received: number | null;
  mpesa_received: number | null;
  table_no: string | null;
  check_status: string | null;
  created_at: string;
}
export interface ButcherySale {
  id: string;
  sale_date: string;
  shift: Shift;
  meat_item: string;
  quantity_kg: number;
  price_per_kg: number;
  cost_kshs: number;
  payment_method: string;
  created_at: string;
}
export interface Expense {
  id: string;
  expense_date: string;
  shift: Shift;
  description: string;
  amount: number;
  paid_from: string;
  supplier_id: string | null;
  receipt_url: string | null;
  created_at: string;
}
export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  products: string | null;
}
export interface StockTake {
  id: string;
  stock_date: string;
  shift: Shift;
  item_name: string;
  opening_qty: number;
  closing_qty: number;
}
export interface StockAddition {
  id: string;
  entry_date: string;
  shift: Shift;
  item_name: string;
  quantity: number;
  supplier_id: string | null;
  notes: string | null;
  created_at: string;
}
export interface StockTransfer {
  id: string;
  entry_date: string;
  shift: Shift;
  item_name: string;
  quantity: number;
  direction: "Out" | "In";
  location: string | null;
  created_at: string;
}
export interface Wastage {
  id: string;
  entry_date: string;
  shift: Shift;
  item_name: string;
  quantity: number;
  reason: string | null;
  created_at: string;
}
export interface Discrepancy {
  id: string;
  entry_date: string;
  shift: Shift;
  item_name: string;
  expected_amount: number | null;
  actual_amount: number | null;
  amount: number;
  note: string | null;
  receipt_url: string | null;
  status: "Open" | "Investigate" | "Approved";
  created_at: string;
}
export interface AuditLog {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "UPDATE" | "DELETE";
  changed_by_email: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_at: string;
}
