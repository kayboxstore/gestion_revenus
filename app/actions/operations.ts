"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const operationSchema = z.object({
  operation_type: z.enum([
    "cash_sale",
    "credit_sale",
    "payment",
    "stock_purchase",
    "operating_expense",
    "family_expense",
    "transfer",
    "family_contribution",
    "family_withdrawal",
    "savings_contribution",
  ]),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  currency: z.enum(["USD", "CDF"]),
  exchange_rate: z.string().regex(/^\d+(\.\d{1,8})?$/),
  description: z.string().trim().min(3).max(160),
  activity_code: z.string().optional(),
  operation_date: z.string().optional(),
  product_id: z.string().uuid().optional(),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  contact_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  sale_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  source_cash_account_id: z.string().uuid().optional(),
  destination_cash_account_id: z.string().uuid().optional(),
  destination_amount: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  destination_currency: z.enum(["USD", "CDF"]).optional(),
  destination_exchange_rate: z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/)
    .optional(),
  category_id: z.string().uuid().optional(),
  savings_goal_id: z.string().uuid().optional(),
  fees_source: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  idempotency_key: z.string().uuid(),
});

export async function createQuickOperation(formData: FormData) {
  const parsed = operationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/operations?error=validation");

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member?.household_id) redirect("/onboarding");

  const { error } = await supabase.rpc("record_financial_operation", {
    p_household_id: member.household_id,
    p_operation_type: parsed.data.operation_type,
    p_amount_source: parsed.data.amount,
    p_currency: parsed.data.currency,
    p_exchange_rate: parsed.data.exchange_rate,
    p_description: parsed.data.description,
    p_activity_code: parsed.data.activity_code || null,
    p_idempotency_key: parsed.data.idempotency_key,
    p_payload: {
      operation_date: parsed.data.operation_date || undefined,
      product_id: parsed.data.product_id || undefined,
      quantity: parsed.data.quantity || undefined,
      contact_id: parsed.data.contact_id || undefined,
      supplier_id: parsed.data.supplier_id || undefined,
      sale_id: parsed.data.sale_id || undefined,
      due_date: parsed.data.due_date || undefined,
      source_cash_account_id: parsed.data.source_cash_account_id || undefined,
      destination_cash_account_id:
        parsed.data.destination_cash_account_id || undefined,
      destination_amount_source: parsed.data.destination_amount || undefined,
      destination_currency: parsed.data.destination_currency || undefined,
      destination_exchange_rate:
        parsed.data.destination_exchange_rate || undefined,
      category_id: parsed.data.category_id || undefined,
      savings_goal_id: parsed.data.savings_goal_id || undefined,
      fees_source: parsed.data.fees_source || undefined,
    },
  });
  if (error) {
    const knownError = [
      "not allowed",
      "insufficient stock",
      "payment exceeds sale balance",
      "idempotency key conflict for household",
    ].find((message) => error.message.includes(message));
    const code = knownError?.replaceAll(" ", "_") ?? "operation_failed";
    redirect(`/operations?error=${code}`);
  }
  revalidatePath("/");
  revalidatePath("/operations");
  redirect("/operations?success=1");
}
