"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const optionalUuid = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().uuid().optional(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().date().optional(),
);

const subscriptionSchema = z
  .object({
    renewed_from_id: optionalUuid,
    plan_id: z.string().uuid(),
    customer_name: z.string().trim().max(100).optional().default(""),
    customer_phone: z.string().trim().max(40).optional().default(""),
    customer_identifier: z.string().trim().max(120).optional().default(""),
    activation_date: z.string().date(),
    payment_type: z.enum(["cash_sale", "credit_sale"]),
    cash_account_id: optionalUuid,
    due_date: optionalDate,
    exchange_rate: z
      .string()
      .regex(/^\d+(\.\d{1,8})?$/)
      .refine((value) => !/^0+(?:\.0+)?$/.test(value)),
    idempotency_key: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (!value.renewed_from_id && value.customer_name.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["customer_name"],
        message: "Nom du client obligatoire",
      });
    }
    if (!value.renewed_from_id && value.customer_identifier.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["customer_identifier"],
        message: "Identifiant IPTV obligatoire",
      });
    }
    if (value.payment_type === "cash_sale" && !value.cash_account_id) {
      context.addIssue({
        code: "custom",
        path: ["cash_account_id"],
        message: "Compte d’encaissement obligatoire",
      });
    }
    if (value.payment_type === "credit_sale" && !value.due_date) {
      context.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "Échéance de paiement obligatoire",
      });
    }
  });

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  duration_days: z.coerce.number().int().min(1).max(730),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .refine((value) => !/^0+(?:\.0+)?$/.test(value)),
  currency: z.enum(["USD", "CDF"]),
});

const planStatusSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["true", "false"]),
});

async function householdContext(manageOnly = false) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/activities/iptv");
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member?.household_id) redirect("/onboarding");
  const allowed = manageOnly
    ? ["owner", "manager"].includes(member.role)
    : ["owner", "manager", "operator"].includes(member.role);
  if (!allowed) return null;
  return { supabase, householdId: member.household_id };
}

function iptvErrorPath(code: string) {
  return `/activities/iptv?error=${encodeURIComponent(code)}`;
}

export async function recordIptvSubscription(formData: FormData) {
  const parsed = subscriptionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(iptvErrorPath("validation"));
  const context = await householdContext();
  if (!context) redirect(iptvErrorPath("not_allowed"));

  const { error } = await context.supabase.rpc(
    "record_iptv_subscription_sale",
    {
      p_household_id: context.householdId,
      p_renewed_from_id: parsed.data.renewed_from_id ?? null,
      p_plan_id: parsed.data.plan_id,
      p_customer_name: parsed.data.customer_name,
      p_customer_phone: parsed.data.customer_phone || null,
      p_customer_identifier: parsed.data.customer_identifier,
      p_activation_date: parsed.data.activation_date,
      p_payment_type: parsed.data.payment_type,
      p_cash_account_id: parsed.data.cash_account_id ?? null,
      p_due_date: parsed.data.due_date ?? null,
      p_exchange_rate: parsed.data.exchange_rate,
      p_idempotency_key: parsed.data.idempotency_key,
    },
  );
  if (error) {
    const knownErrors: Array<[string, string]> = [
      ["not allowed", "not_allowed"],
      ["IPTV plan is invalid or inactive", "invalid_plan"],
      ["source account currency", "account_currency"],
      ["idempotency key conflict", "submission_conflict"],
      ["active IPTV service product", "inactive_activity"],
      ["customer identifier already exists", "duplicate_customer"],
      ["subscription was already renewed", "already_renewed"],
    ];
    const code =
      knownErrors.find(([message]) => error.message.includes(message))?.[1] ??
      "operation_failed";
    redirect(iptvErrorPath(code));
  }

  revalidatePath("/");
  revalidatePath("/activities/iptv");
  revalidatePath("/operations");
  revalidatePath("/reports");
  redirect(
    `/activities/iptv?success=${parsed.data.renewed_from_id ? "renewed" : "activated"}`,
  );
}

export async function createIptvPlan(formData: FormData) {
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(iptvErrorPath("plan_validation"));
  const context = await householdContext(true);
  if (!context) redirect(iptvErrorPath("not_allowed"));
  const { error } = await context.supabase.from("iptv_plans").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    duration_days: parsed.data.duration_days,
    price: parsed.data.price,
    currency: parsed.data.currency,
    active: true,
  });
  if (error) {
    redirect(
      iptvErrorPath(error.code === "23505" ? "duplicate_plan" : "plan_failed"),
    );
  }
  revalidatePath("/activities/iptv");
  redirect("/activities/iptv?success=plan");
}

export async function setIptvPlanStatus(formData: FormData) {
  const parsed = planStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(iptvErrorPath("plan_validation"));
  const context = await householdContext(true);
  if (!context) redirect(iptvErrorPath("not_allowed"));
  const { error } = await context.supabase
    .from("iptv_plans")
    .update({ active: parsed.data.active === "true" })
    .eq("household_id", context.householdId)
    .eq("id", parsed.data.id);
  if (error) redirect(iptvErrorPath("plan_failed"));
  revalidatePath("/activities/iptv");
  redirect("/activities/iptv?success=plan_status");
}
