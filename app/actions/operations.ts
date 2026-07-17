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
  });
  if (error) redirect(`/operations?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/");
  revalidatePath("/operations");
  redirect("/operations?success=1");
}
