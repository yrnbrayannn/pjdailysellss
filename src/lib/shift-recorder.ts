import type { Tables } from "@/integrations/supabase/types";

type Sale = Pick<Tables<"hotel_sales">, "total_cost" | "payment_method" | "cash_received" | "mpesa_part" | "mpesa_received" | "check_status">;
type ButcherySale = Pick<Tables<"butchery_sales">, "cost_kshs" | "payment_method">;
type Expense = Pick<Tables<"expenses">, "amount" | "paid_from">;

export type SalesGroup = {
  sales: number;
  cash: number;
  mpesa: number;
  unpaid: number;
};

export type ShiftSummary = {
  hotel: SalesGroup;
  butchery: SalesGroup;
  expensesCash: number;
  cashToHandOver: number;
  ownerSales: number;
  ownerMpesa: number;
  discrepancy: boolean;
};

function roundAmount(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function groupHotelSales(sales: Sale[]): SalesGroup {
  const total: SalesGroup = { sales: 0, cash: 0, mpesa: 0, unpaid: 0 };

  for (const sale of sales) {
    const amount = Number(sale.total_cost) || 0;
    total.sales += amount;

    if (sale.payment_method === "Unpaid" || sale.check_status === "UNPAID") {
      total.unpaid += amount;
    } else if (sale.payment_method === "Cash") {
      total.cash += Number(sale.cash_received ?? amount) || 0;
    } else if (sale.payment_method === "M-Pesa") {
      total.mpesa += Number(sale.mpesa_received ?? amount) || 0;
    } else if (sale.payment_method === "Cash + M-Pesa") {
      const mpesa = Number(sale.mpesa_received ?? sale.mpesa_part) || 0;
      total.mpesa += mpesa;
      total.cash += Number(sale.cash_received ?? amount - mpesa) || 0;
    }
  }

  return {
    sales: roundAmount(total.sales),
    cash: roundAmount(total.cash),
    mpesa: roundAmount(total.mpesa),
    unpaid: roundAmount(total.unpaid),
  };
}

function groupButcherySales(sales: ButcherySale[]): SalesGroup {
  const total: SalesGroup = { sales: 0, cash: 0, mpesa: 0, unpaid: 0 };

  for (const sale of sales) {
    const amount = Number(sale.cost_kshs) || 0;
    total.sales += amount;
    if (sale.payment_method === "Cash") total.cash += amount;
    if (sale.payment_method === "M-Pesa") total.mpesa += amount;
    if (sale.payment_method === "Unpaid") total.unpaid += amount;
  }

  return {
    sales: roundAmount(total.sales),
    cash: roundAmount(total.cash),
    mpesa: roundAmount(total.mpesa),
    unpaid: roundAmount(total.unpaid),
  };
}

export function calculateShiftSummary(
  hotelSales: Sale[],
  butcherySales: ButcherySale[],
  expenses: Expense[],
): ShiftSummary {
  const hotel = groupHotelSales(hotelSales);
  const butchery = groupButcherySales(butcherySales);
  const expensesCash = roundAmount(
    expenses.reduce(
      (sum, expense) =>
        sum + (expense.paid_from === "Cash" ? Number(expense.amount) || 0 : 0),
      0,
    ),
  );
  const cashToHandOver = roundAmount(hotel.cash + butchery.cash - expensesCash);
  const ownerSales = roundAmount(hotel.sales + butchery.sales);
  const ownerMpesa = roundAmount(hotel.mpesa + butchery.mpesa);
  const discrepancy = [hotel, butchery].some(
    (group) => roundAmount(group.sales) !== roundAmount(group.cash + group.mpesa + group.unpaid),
  );

  return {
    hotel,
    butchery,
    expensesCash,
    cashToHandOver,
    ownerSales,
    ownerMpesa,
    discrepancy,
  };
}