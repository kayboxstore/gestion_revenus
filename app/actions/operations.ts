"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);
const optionalDecimal = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
);
const optionalRate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .regex(/^\d+(\.\d{1,8})?$/)
    .optional(),
);

const baseOperationSchema = z.object({
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
  product_id: optionalUuid,
  quantity: optionalDecimal,
  contact_id: optionalUuid,
  supplier_id: optionalUuid,
  sale_id: optionalUuid,
  due_date: z.string().optional(),
  source_cash_account_id: optionalUuid,
  destination_cash_account_id: optionalUuid,
  destination_amount: optionalDecimal,
  destination_currency: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["USD", "CDF"]).optional(),
  ),
  destination_exchange_rate: optionalRate,
  category_id: optionalUuid,
  savings_goal_id: optionalUuid,
  fees_source: optionalDecimal,
  idempotency_key: z.string().uuid(),
});

const operationSchema = baseOperationSchema.superRefine((value, context) => {
  const requireField = (
    field: keyof z.infer<typeof baseOperationSchema>,
    message: string,
  ) => {
    if (!value[field])
      context.addIssue({ code: "custom", path: [field], message });
  };
  if (
    ["cash_sale", "credit_sale", "stock_purchase"].includes(
      value.operation_type,
    )
  ) {
    requireField("product_id", "Produit obligatoire");
    requireField("quantity", "Quantité obligatoire");
  }
  if (
    [
      "cash_sale",
      "payment",
      "stock_purchase",
      "operating_expense",
      "family_expense",
      "family_contribution",
      "family_withdrawal",
      "savings_contribution",
    ].includes(value.operation_type)
  ) {
    requireField(
      "source_cash_account_id",
      "Compte source ou encaissement obligatoire",
    );
  }
  if (value.operation_type === "payment")
    requireField("sale_id", "Vente à régler obligatoire");
  if (
    value.operation_type === "transfer" ||
    value.operation_type === "savings_contribution"
  ) {
    requireField("source_cash_account_id", "Compte source obligatoire");
    requireField(
      "destination_cash_account_id",
      "Compte destination obligatoire",
    );
  }
  if (["operating_expense", "family_expense"].includes(value.operation_type))
    requireField("category_id", "Catégorie obligatoire");
  if (value.operation_type === "savings_contribution")
    requireField("savings_goal_id", "Objectif d’épargne obligatoire");
  if (value.operation_type === "credit_sale")
    requireField("due_date", "Échéance obligatoire");
});

export async function createQuickOperation(formData: FormData) {
  const parsed = operationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/operations?error=validation");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
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
