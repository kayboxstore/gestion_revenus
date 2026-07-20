"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const decimal = z.string().regex(/^\d+(\.\d{1,4})?$/);
const optionalPrice = z.preprocess(
  (value) => (value === "" ? undefined : value),
  decimal.optional(),
);
const sku = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .trim()
    .max(40)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i)
    .optional(),
);

const countSchema = z.object({
  product_id: z.string().uuid(),
  counted_quantity: decimal,
  count_date: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().date().optional(),
  ),
  idempotency_key: z.string().uuid(),
});

const settingsSchema = z.object({
  product_id: z.string().uuid(),
  sku,
  suggested_price: optionalPrice,
  low_stock_threshold: decimal,
});

async function authenticatedHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/stock");
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member?.household_id) redirect("/onboarding");
  return { supabase, householdId: member.household_id as string };
}

function stockError(message: string, fallback: string) {
  if (message.includes("not allowed")) return "not_allowed";
  if (message.includes("idempotency key conflict")) return "count_conflict";
  if (
    message.includes("counted quantity") ||
    message.includes("cannot be in the future")
  )
    return "invalid_count";
  if (message.includes("products_household_id_sku_key")) return "duplicate_sku";
  return fallback;
}

export async function recordInventoryCount(formData: FormData) {
  const parsed = countSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/stock?error=invalid_count");
  const { supabase, householdId } = await authenticatedHousehold();
  const { error } = await supabase.rpc("record_inventory_count", {
    p_household_id: householdId,
    p_product_id: parsed.data.product_id,
    p_counted_quantity: parsed.data.counted_quantity,
    p_count_date: parsed.data.count_date ?? null,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error)
    redirect(`/stock?error=${stockError(error.message, "count_failed")}`);
  revalidatePath("/");
  revalidatePath("/stock");
  revalidatePath("/operations");
  redirect("/stock?success=count");
}

export async function updateStockProductSettings(formData: FormData) {
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/stock?error=invalid_settings");
  const { supabase, householdId } = await authenticatedHousehold();
  const { error } = await supabase.rpc("update_stock_product_settings", {
    p_household_id: householdId,
    p_product_id: parsed.data.product_id,
    p_sku: parsed.data.sku ?? null,
    p_suggested_price: parsed.data.suggested_price ?? null,
    p_low_stock_threshold: parsed.data.low_stock_threshold,
  });
  if (error)
    redirect(`/stock?error=${stockError(error.message, "settings_failed")}`);
  revalidatePath("/stock");
  revalidatePath("/operations");
  redirect("/stock?success=settings");
}
