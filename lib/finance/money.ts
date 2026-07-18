import Decimal from "decimal.js";
export type MoneyInput = string;
export function decimal(value: MoneyInput): Decimal {
  return new Decimal(value);
}
export function add(a: MoneyInput, b: MoneyInput): string {
  return decimal(a).plus(decimal(b)).toFixed(4);
}
export function sub(a: MoneyInput, b: MoneyInput): string {
  return decimal(a).minus(decimal(b)).toFixed(4);
}
export function mul(a: MoneyInput, b: MoneyInput): string {
  return decimal(a).times(decimal(b)).toFixed(4);
}
export function convert(amount: MoneyInput, rate: MoneyInput): string {
  return mul(amount, rate);
}
export function formatMoney(amount: MoneyInput, currency = "USD"): string {
  return new Intl.NumberFormat("fr-CD", {
    style: "currency",
    currency,
    minimumFractionDigits: currency === "CDF" ? 0 : 2,
  }).format(decimal(amount).toNumber());
}
