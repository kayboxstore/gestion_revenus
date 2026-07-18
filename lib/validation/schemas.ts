import { z } from "zod";
export const moneySchema = z.string().regex(/^\d+(\.\d{1,4})?$/);
export const operationSchema = z.object({
  type: z.enum([
    "sale",
    "expense",
    "transfer",
    "contribution",
    "purchase",
    "family_withdrawal",
    "family_contribution",
  ]),
  amount: moneySchema,
  currency: z.enum(["USD", "CDF"]),
  exchangeRate: moneySchema,
  activityCode: z.string().optional(),
});
