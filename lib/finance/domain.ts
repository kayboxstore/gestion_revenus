import Decimal from "decimal.js";
import { convert, decimal } from "./money";
export type AccountType =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "cogs"
  | "operating_expense"
  | "family_expense";
export type JournalLine = {
  account: string;
  accountType: AccountType;
  debitBase: string;
  creditBase: string;
  currency: string;
  sourceAmount: string;
  exchangeRate: string;
};
export type JournalEntry = {
  id: string;
  type: string;
  status: "draft" | "posted" | "reversed";
  lines: JournalLine[];
  reversalOf?: string;
  idempotencyKey?: string;
};
export const defaultActivities = [
  { code: "IPTV", name: "Vente IPTV", active: true },
  { code: "MINI_UPS", name: "Vente Mini UPS", active: true },
  { code: "ANDROID_TV_BOX", name: "Vente Android TV Box", active: true },
  { code: "BILLIARD", name: "Table de billard", active: false },
];
export function assertBalanced(lines: JournalLine[]): void {
  const d = lines.reduce((s, l) => s.plus(l.debitBase), new Decimal(0));
  const c = lines.reduce((s, l) => s.plus(l.creditBase), new Decimal(0));
  if (!d.eq(c))
    throw new Error(
      `Écriture déséquilibrée: débit ${d.toFixed(4)} crédit ${c.toFixed(4)}`,
    );
}
function line(
  account: string,
  accountType: AccountType,
  debit: string,
  credit: string,
  currency: string,
  amount: string,
  rate: string,
): JournalLine {
  return {
    account,
    accountType,
    debitBase: debit,
    creditBase: credit,
    currency,
    sourceAmount: amount,
    exchangeRate: rate,
  };
}
export function saleCash(
  amount: string,
  cost: string,
  currency = "USD",
  rate = "1",
): JournalEntry {
  const base = convert(amount, rate),
    costBase = convert(cost, rate);
  const lines = [
    line("cash", "asset", base, "0", currency, amount, rate),
    line("sales_revenue", "income", "0", base, currency, amount, rate),
    line("cost_of_goods_sold", "cogs", costBase, "0", currency, cost, rate),
    line("inventory", "asset", "0", costBase, currency, cost, rate),
  ];
  assertBalanced(lines);
  return { id: "sale", type: "sale", status: "posted", lines };
}
export function familyExpense(
  amount: string,
  currency = "USD",
  rate = "1",
): JournalEntry {
  const base = convert(amount, rate);
  const lines = [
    line("family_expense", "family_expense", base, "0", currency, amount, rate),
    line("cash", "asset", "0", base, currency, amount, rate),
  ];
  assertBalanced(lines);
  return { id: "expense", type: "family_expense", status: "posted", lines };
}
export function transfer(
  amount: string,
  fee = "0",
  currency = "USD",
  rate = "1",
): JournalEntry {
  const base = convert(amount, rate),
    feeBase = convert(fee, rate);
  const lines = [
    line("mpesa", "asset", base, "0", currency, amount, rate),
    line("cash", "asset", "0", base, currency, amount, rate),
  ];
  if (decimal(fee).gt(0)) {
    lines.push(
      line("bank_fees", "operating_expense", feeBase, "0", currency, fee, rate),
      line("cash", "asset", "0", feeBase, currency, fee, rate),
    );
  }
  assertBalanced(lines);
  return { id: "transfer", type: "transfer", status: "posted", lines };
}
export function savingsContribution(
  amount: string,
  currency = "USD",
  rate = "1",
): JournalEntry {
  const base = convert(amount, rate);
  const lines = [
    line("savings", "asset", base, "0", currency, amount, rate),
    line("cash", "asset", "0", base, currency, amount, rate),
  ];
  assertBalanced(lines);
  return {
    id: "saving",
    type: "savings_contribution",
    status: "posted",
    lines,
  };
}
export function reverse(entry: JournalEntry, reason: string): JournalEntry {
  const lines = entry.lines.map((l) => ({
    ...l,
    debitBase: l.creditBase,
    creditBase: l.debitBase,
  }));
  assertBalanced(lines);
  return {
    id: `rev-${entry.id}`,
    type: `reversal:${reason}`,
    status: "posted",
    reversalOf: entry.id,
    lines,
  };
}
export function summarize(entries: JournalEntry[]) {
  let revenue = new Decimal(0),
    cogs = new Decimal(0),
    op = new Decimal(0),
    family = new Decimal(0),
    savings = new Decimal(0),
    cash = new Decimal(0);
  for (const e of entries.filter((e) => e.status === "posted"))
    for (const l of e.lines) {
      const net = decimal(l.debitBase).minus(l.creditBase);
      if (l.accountType === "income")
        revenue = revenue.plus(l.creditBase).minus(l.debitBase);
      if (l.accountType === "cogs") cogs = cogs.plus(net);
      if (l.accountType === "operating_expense") op = op.plus(net);
      if (l.accountType === "family_expense") family = family.plus(net);
      if (l.account === "savings") savings = savings.plus(net);
      if (["cash", "mpesa", "savings"].includes(l.account))
        cash = cash.plus(net);
    }
  return {
    revenue: revenue.toFixed(4),
    grossProfit: revenue.minus(cogs).toFixed(4),
    netProfit: revenue.minus(cogs).minus(op).toFixed(4),
    familyExpenses: family.toFixed(4),
    savings: savings.toFixed(4),
    cash: cash.toFixed(4),
  };
}
