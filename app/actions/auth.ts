"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function onboardHousehold(formData: FormData) {
  const supabase = await createClient();
  const displayName = String(formData.get("display_name") ?? "");
  const householdName = String(formData.get("household_name") ?? "");
  await supabase.rpc("bootstrap_household", {
    p_household_name: householdName,
    p_display_name: displayName,
  });
  redirect("/");
}
