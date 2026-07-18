"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const activitySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  active: z.enum(["true", "false"]),
});

const savingsGoalSchema = z.object({
  name: z.string().trim().min(2).max(80),
  target_amount: z.string().regex(/^\d+(\.\d{1,4})?$/),
  currency: z.enum(["USD", "CDF"]),
  target_date: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().date().optional(),
  ),
});

const reversalSchema = z.object({
  entry_id: z.string().uuid(),
  reason: z.string().trim().min(3).max(160),
});

async function managedHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member?.household_id) redirect("/onboarding");
  if (!(["owner", "manager"] as string[]).includes(member.role)) return null;
  return { supabase, householdId: member.household_id };
}

export async function updateActivity(formData: FormData) {
  const parsed = activitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/activities?error=validation");
  const context = await managedHousehold();
  if (!context) redirect("/activities?error=not_allowed");
  const { error } = await context.supabase
    .from("activities")
    .update({
      name: parsed.data.name,
      active: parsed.data.active === "true",
    })
    .eq("household_id", context.householdId)
    .eq("id", parsed.data.id);
  if (error) redirect("/activities?error=update_failed");
  revalidatePath("/");
  revalidatePath("/activities");
  redirect("/activities?success=1");
}

export async function createSavingsGoal(formData: FormData) {
  const parsed = savingsGoalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/more?error=validation");
  const context = await managedHousehold();
  if (!context) redirect("/more?error=not_allowed");
  const { error } = await context.supabase.from("savings_goals").insert({
    household_id: context.householdId,
    name: parsed.data.name,
    target_amount: parsed.data.target_amount,
    currency: parsed.data.currency,
    target_date: parsed.data.target_date ?? null,
  });
  if (error) redirect("/more?error=goal_failed");
  revalidatePath("/more");
  revalidatePath("/operations");
  redirect("/more?success=goal");
}

export async function reverseOperation(formData: FormData) {
  const parsed = reversalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/operations?error=reversal_validation");
  const context = await managedHousehold();
  if (!context) redirect("/operations?error=not_allowed");
  const { error } = await context.supabase.rpc("reverse_journal_entry", {
    p_entry: parsed.data.entry_id,
    p_reason: parsed.data.reason,
  });
  if (error) redirect("/operations?error=reversal_failed");
  revalidatePath("/");
  revalidatePath("/operations");
  redirect("/operations?success=reversed");
}

const memberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["owner", "manager", "operator", "reader"]),
  status: z.enum(["active", "inactive"]),
});

const invitationSchema = z.object({
  email: z.string().trim().email().max(160),
  role: z.enum(["manager", "operator", "reader"]),
});

const cancelInvitationSchema = z.object({ id: z.string().uuid() });

async function ownedHousehold() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase
    .from("household_members")
    .select("household_id,role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!member?.household_id) redirect("/onboarding");
  if (member.role !== "owner") return null;
  return { supabase, householdId: member.household_id };
}

export async function updateMemberRole(formData: FormData) {
  const parsed = memberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/more?error=member_validation");
  const context = await ownedHousehold();
  if (!context) redirect("/more?error=not_allowed");
  const { error } = await context.supabase.rpc("owner_manage_member", {
    p_household_id: context.householdId,
    p_user_id: parsed.data.user_id,
    p_role: parsed.data.role,
    p_status: parsed.data.status,
  });
  if (error) redirect("/more?error=member_failed");
  revalidatePath("/more");
  redirect("/more?success=member");
}

export async function createInvitation(formData: FormData) {
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/more?error=invitation_validation");
  const context = await ownedHousehold();
  if (!context) redirect("/more?error=not_allowed");
  const { error } = await context.supabase.rpc("owner_create_invitation", {
    p_household_id: context.householdId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error) redirect("/more?error=invitation_failed");
  revalidatePath("/more");
  redirect("/more?success=invitation");
}

export async function cancelInvitation(formData: FormData) {
  const parsed = cancelInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/more?error=invitation_validation");
  const context = await ownedHousehold();
  if (!context) redirect("/more?error=not_allowed");
  const { error } = await context.supabase.rpc("owner_cancel_invitation", {
    p_invitation_id: parsed.data.id,
  });
  if (error) redirect("/more?error=invitation_failed");
  revalidatePath("/more");
  redirect("/more?success=invitation_cancelled");
}
